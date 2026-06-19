import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConflictStrategy, ObsidianKnowledgeSyncImpl } from '../../services/obsidian-knowledge-sync.js';
import type { KnowledgeEntity } from '../../protocols/knowledge.js';

function createEntity(overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return {
    id: 'hero',
    name: 'Hero',
    type: 'character',
    description: 'Leads the crew.',
    properties: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

class MockEventBus {
  readonly published: Array<{ channel: string; payload: unknown }> = [];
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  throwOnPublish = false;

  publish = vi.fn((channel: string, payload: unknown) => {
    this.published.push({ channel, payload });
    if (this.throwOnPublish) {
      throw new Error('publish failed');
    }
  });

  subscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    list.push(handler);
    this.handlers.set(channel, list);
    return () => this.unsubscribe(channel, handler);
  });

  unsubscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    this.handlers.set(channel, list.filter(item => item !== handler));
  });

  emit(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }
}

class MockObsidianService {
  readonly notes = new Map<string, string | null>();
  readonly failReads = new Set<string>();
  readonly failWrites = new Set<string>();
  readonly failDeletes = new Set<string>();

  readNote = vi.fn(async (_vaultRoot: string, notePath: string) => {
    if (this.failReads.has(notePath)) {
      throw new Error(`read failed: ${notePath}`);
    }
    return this.notes.get(notePath) ?? null;
  });

  writeNote = vi.fn(async (_vaultRoot: string, notePath: string, content: string) => {
    if (this.failWrites.has(notePath)) {
      throw new Error(`write failed: ${notePath}`);
    }
    this.notes.set(notePath, content);
  });

  deleteNote = vi.fn(async (_vaultRoot: string, notePath: string) => {
    if (this.failDeletes.has(notePath)) {
      throw new Error(`delete failed: ${notePath}`);
    }
    this.notes.delete(notePath);
  });
}

class MockKnowledgeService {
  readonly entities = new Map<string, KnowledgeEntity>();
  readonly failAddIds = new Set<string>();

  addDocument = vi.fn(async () => undefined);
  addRelation = vi.fn(async () => undefined);
  search = vi.fn(async () => []);
  getNeighbors = vi.fn(async () => []);
  distillKnowledge = vi.fn(async () => ({}));
  initialize = vi.fn(async () => undefined);

  addEntity = vi.fn(async (entity: KnowledgeEntity) => {
    if (this.failAddIds.has(entity.id)) {
      throw new Error(`add failed: ${entity.id}`);
    }
    this.entities.set(entity.id, entity);
  });

  getEntity = vi.fn((entityId: string) => this.entities.get(entityId));

  deleteEntity = vi.fn(async (entityId: string) => {
    this.entities.delete(entityId);
  });

  listEntities = vi.fn(() => Array.from(this.entities.values()));
}

function createHarness(options: {
  config?: Partial<{
    conflictStrategy: ConflictStrategy;
    debounceMs: number;
    watchEnabled: boolean;
    vaultRoot: string;
  }>;
} = {}) {
  const obsidianService = new MockObsidianService();
  const knowledgeService = new MockKnowledgeService();
  const eventBus = new MockEventBus();
  const conflictBridge = {
    detectConflicts: vi.fn(async () => [] as Array<{ localPath: string; knowledgeId: string; conflictType: string }>),
    resolveConflict: vi.fn(async () => true),
  };

  const sync = new ObsidianKnowledgeSyncImpl({
    obsidianService: obsidianService as never,
    knowledgeService: knowledgeService as never,
    eventBus: eventBus as never,
    conflictBridge: conflictBridge as never,
    config: {
      conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
      debounceMs: 20,
      watchEnabled: true,
      vaultRoot: '/vault',
      ...options.config,
    },
  });

  return {
    sync,
    obsidianService,
    knowledgeService,
    eventBus,
    conflictBridge,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ObsidianKnowledgeSyncImpl', () => {
  it('syncs vault notes into knowledge entities with parsed markdown metadata', async () => {
    const { sync, obsidianService, knowledgeService, eventBus } = createHarness();
    obsidianService.notes.set(
      'notes/hero.md',
      [
        '---',
        'type: character',
        'mood: tense',
        '---',
        '# Captain',
        '',
        'Leads the crew through a storm.',
      ].join('\n'),
    );

    const result = await sync.syncVaultToKnowledge('notes/hero.md');

    expect(result).toMatchObject({
      direction: 'vault-to-knowledge',
      syncedCount: 1,
      conflictedCount: 0,
      errors: [],
    });
    expect(knowledgeService.entities.get('hero')).toMatchObject({
      id: 'hero',
      name: 'Captain',
      type: 'character',
      description: 'Leads the crew through a storm.',
      properties: { mood: 'tense' },
    });
    expect(eventBus.published.some(event => event.channel === 'obsidian-sync:vault-to-knowledge')).toBe(true);
  });

  it('reports missing notes and add failures during vault-to-knowledge sync', async () => {
    const { sync, obsidianService, knowledgeService } = createHarness();

    const missing = await sync.syncVaultToKnowledge('missing.md');
    expect(missing.errors).toEqual([{ item: 'missing.md', error: 'Note not found in vault' }]);

    obsidianService.notes.set('broken.md', '# Broken');
    knowledgeService.failAddIds.add('broken');

    const failed = await sync.syncVaultToKnowledge('broken.md');
    expect(failed.syncedCount).toBe(0);
    expect(failed.errors).toEqual([{ item: 'broken.md', error: 'add failed: broken' }]);
  });

  it('syncs knowledge entities into vault notes and swallows event publish failures', async () => {
    const { sync, obsidianService, knowledgeService, eventBus } = createHarness();
    knowledgeService.entities.set('hero', createEntity({
      properties: {
        mood: 'focused',
        chapter: 3,
        nested: { ignore: true },
      },
    }));
    eventBus.throwOnPublish = true;

    const result = await sync.syncKnowledgeToVault('hero');

    expect(result.syncedCount).toBe(1);
    expect(result.errors).toEqual([]);
    expect(obsidianService.notes.get('hero.md')).toContain('mood: focused');
    expect(obsidianService.notes.get('hero.md')).toContain('chapter: 3');
    expect(obsidianService.notes.get('hero.md')).not.toContain('nested');
  });

  it('reports missing entities and write failures during knowledge-to-vault sync', async () => {
    const { sync, obsidianService, knowledgeService } = createHarness();

    const missing = await sync.syncKnowledgeToVault('ghost');
    expect(missing.errors).toEqual([{ item: 'ghost', error: 'Entity not found in knowledge store' }]);

    knowledgeService.entities.set('hero', createEntity());
    obsidianService.failWrites.add('hero.md');

    const failed = await sync.syncKnowledgeToVault('hero');
    expect(failed.syncedCount).toBe(0);
    expect(failed.errors).toEqual([{ item: 'hero', error: 'write failed: hero.md' }]);
  });

  it('resolves queued conflicts for vault, knowledge, and merge strategies', async () => {
    const { sync, obsidianService, knowledgeService } = createHarness();
    const internal = sync as any;

    internal.conflicts.set('vault-conflict', {
      id: 'vault-conflict',
      vaultPath: 'vault-win.md',
      entityId: 'vault-win',
      vaultTimestamp: 1,
      knowledgeTimestamp: 2,
      vaultContent: '# Vault Winner\n\nFrom vault.',
      knowledgeContent: createEntity({ id: 'vault-win', name: 'Old Vault Winner' }),
    });
    await sync.resolveConflict('vault-conflict', 'vault');
    expect(knowledgeService.entities.get('vault-win')).toMatchObject({
      id: 'vault-win',
      name: 'Vault Winner',
      description: 'From vault.',
    });

    internal.conflicts.set('knowledge-conflict', {
      id: 'knowledge-conflict',
      vaultPath: 'hero.md',
      entityId: 'hero',
      vaultTimestamp: 1,
      knowledgeTimestamp: 2,
      vaultContent: '# Old Hero',
      knowledgeContent: createEntity({ name: 'Hero From Knowledge', description: 'Wins from knowledge.' }),
    });
    await sync.resolveConflict('knowledge-conflict', 'knowledge');
    expect(obsidianService.notes.get('hero.md')).toContain('# Hero From Knowledge');

    internal.conflicts.set('merge-conflict', {
      id: 'merge-conflict',
      vaultPath: 'merge.md',
      entityId: 'merge',
      vaultTimestamp: 1,
      knowledgeTimestamp: 2,
      vaultContent: '# Vault Merge\n\nVault body.',
      knowledgeContent: createEntity({
        id: 'merge',
        name: 'Merge Hero',
        description: 'Knowledge body.',
      }),
    });
    await sync.resolveConflict('merge-conflict', 'merge');

    expect(knowledgeService.entities.get('merge')).toMatchObject({
      id: 'merge',
      name: 'Vault Merge',
    });
    expect(obsidianService.notes.get('merge.md')).toContain('# Merge Hero');
    expect(sync.getSyncStatus().pendingConflicts).toBe(0);
  });

  it('throws when resolving an unknown conflict id', async () => {
    const { sync } = createHarness();

    await expect(sync.resolveConflict('missing-conflict', 'vault')).rejects.toThrow(
      'Conflict not found: missing-conflict',
    );
  });

  it('subscribes once, debounces repeated events, and clears timers on stop', async () => {
    vi.useFakeTimers();
    const { sync, eventBus, obsidianService, knowledgeService } = createHarness();
    obsidianService.notes.set('draft.md', '# Draft\n\nBody');
    knowledgeService.entities.set('hero', createEntity());

    await sync.startSync();
    await sync.startSync();

    expect(eventBus.subscribe).toHaveBeenCalledTimes(4);

    eventBus.emit('obsidian:file-changed', {});
    eventBus.emit('knowledge:entity-updated', {});
    eventBus.emit('knowledge:entity-created', {});
    eventBus.emit('knowledge:entity-deleted', {});

    eventBus.emit('obsidian:file-changed', { path: 'draft.txt', timestamp: 1 });
    eventBus.emit('obsidian:file-changed', { path: 'draft.md', timestamp: 2 });
    eventBus.emit('obsidian:file-changed', { path: 'draft.md', timestamp: 3 });

    eventBus.emit('knowledge:entity-updated', { id: 'hero', timestamp: 4 });
    eventBus.emit('knowledge:entity-updated', { id: 'hero', timestamp: 5 });
    eventBus.emit('knowledge:entity-created', { id: 'hero', timestamp: 6 });

    expect((sync as any).vaultDebounceTimers.size).toBe(1);
    expect((sync as any).knowledgeDebounceTimers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(25);

    expect(obsidianService.readNote).toHaveBeenCalledTimes(1);
    expect(obsidianService.writeNote).toHaveBeenCalledTimes(1);

    sync.stopSync();

    expect(eventBus.unsubscribe).toHaveBeenCalledTimes(4);
    expect((sync as any).vaultDebounceTimers.size).toBe(0);
    expect((sync as any).knowledgeDebounceTimers.size).toBe(0);
  });

  it('deletes vault notes for removed entities and swallows delete failures', async () => {
    const { sync, eventBus, obsidianService } = createHarness();
    const internal = sync as any;
    obsidianService.notes.set('hero.md', '# Hero');
    internal.vaultChangeTimestamps.set('hero.md', 1);
    internal.knowledgeChangeTimestamps.set('hero', 2);

    await sync.startSync();

    eventBus.emit('knowledge:entity-deleted', { id: 'hero' });
    await flushMicrotasks();

    expect(obsidianService.deleteNote).toHaveBeenCalledWith('/vault', 'hero.md');
    expect(internal.vaultChangeTimestamps.has('hero.md')).toBe(false);
    expect(internal.knowledgeChangeTimestamps.has('hero')).toBe(false);

    obsidianService.failDeletes.add('villain.md');
    eventBus.emit('knowledge:entity-deleted', { id: 'villain' });
    await flushMicrotasks();

    expect(obsidianService.deleteNote).toHaveBeenCalledWith('/vault', 'villain.md');
  });

  it('applies last-write-wins and publishes reverse conflict events when vault wins', async () => {
    const { sync, obsidianService, knowledgeService, eventBus, conflictBridge } = createHarness();
    obsidianService.notes.set('hero.md', '# Vault Hero\n\nFrom vault.');
    (sync as any).knowledgeChangeTimestamps.set('hero', 995);
    conflictBridge.detectConflicts.mockResolvedValue([
      { localPath: 'hero.md', knowledgeId: 'hero', conflictType: 'reverse' },
    ]);
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const result = await sync.syncVaultToKnowledge('hero.md');

    expect(result.conflictedCount).toBe(1);
    expect(knowledgeService.entities.get('hero')).toMatchObject({
      id: 'hero',
      name: 'Vault Hero',
    });
    expect(eventBus.published.some(event => event.channel === 'obsidian-sync:conflict-detected')).toBe(true);
    expect(eventBus.published.some(event => event.channel === 'obsidian-sync:reverse-conflict-detected')).toBe(true);
    expect(sync.getSyncStatus().pendingConflicts).toBe(0);
  });

  it('applies last-write-wins when knowledge wins even if reverse detection fails', async () => {
    const { sync, obsidianService, knowledgeService, eventBus, conflictBridge } = createHarness();
    knowledgeService.entities.set('hero', createEntity({ name: 'Knowledge Hero' }));
    obsidianService.notes.set('hero.md', '# Old Hero');
    (sync as any).vaultChangeTimestamps.set('hero.md', 995);
    conflictBridge.detectConflicts.mockRejectedValue(new Error('bridge failed'));
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const result = await sync.syncKnowledgeToVault('hero');

    expect(result.conflictedCount).toBe(1);
    expect(obsidianService.notes.get('hero.md')).toContain('# Knowledge Hero');
    expect(eventBus.published.some(event => event.channel === 'obsidian-sync:conflict-detected')).toBe(true);
    expect(eventBus.published.some(event => event.channel === 'obsidian-sync:reverse-conflict-detected')).toBe(false);
  });

  it('supports merge and human-queue conflict strategies', async () => {
    const mergeHarness = createHarness({
      config: { conflictStrategy: ConflictStrategy.MERGE },
    });
    await (mergeHarness.sync as any).handleDetectedConflict(
      'merge.md',
      'merge',
      10,
      12,
      '# Merge Title\n\nVault body.',
      createEntity({
        id: 'merge',
        name: 'Knowledge Merge',
        description: 'Knowledge body.',
      }),
    );

    expect(mergeHarness.knowledgeService.entities.get('merge')).toMatchObject({
      id: 'merge',
      name: 'Merge Title',
    });
    expect(mergeHarness.obsidianService.notes.get('merge.md')).toContain('# Knowledge Merge');
    expect(mergeHarness.sync.getSyncStatus().pendingConflicts).toBe(0);

    const queueHarness = createHarness({
      config: { conflictStrategy: ConflictStrategy.HUMAN_QUEUE },
    });
    await (queueHarness.sync as any).handleDetectedConflict(
      'queued.md',
      'queued',
      10,
      12,
      '# Queued Title',
      createEntity({ id: 'queued', name: 'Queued Knowledge' }),
    );

    const conflictId = Array.from((queueHarness.sync as any).conflicts.keys())[0];
    expect(queueHarness.sync.getSyncStatus()).toMatchObject({
      running: false,
      lastVaultSync: null,
      lastKnowledgeSync: null,
      pendingConflicts: 1,
    });

    await queueHarness.sync.resolveConflict(conflictId, 'knowledge');
    expect(queueHarness.sync.getSyncStatus().pendingConflicts).toBe(0);
  });

  it('parses front matter, preserves explicit descriptions, and merges object payloads', () => {
    const { sync } = createHarness();

    const parsed = (sync as any).parseMarkdownToEntity(
      [
        '---',
        'name: Placeholder',
        'type: scene',
        'description: Keep this description.',
        'tone: dark',
        '---',
        '# Final Scene Title',
        '',
        'Body that should not replace the description.',
      ].join('\n'),
      'scene-1',
    );

    expect(parsed).toMatchObject({
      id: 'scene-1',
      name: 'Final Scene Title',
      type: 'scene',
      description: 'Keep this description.',
      properties: { tone: 'dark' },
    });

    const merged = (sync as any).mergeContents({ left: 1 }, 'right side');
    expect(merged).toContain('"left": 1');
    expect(merged).toContain('right side');
    expect(merged).toContain('---');
  });
});
