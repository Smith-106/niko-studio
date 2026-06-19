import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  publish = vi.fn((channel: string, payload: unknown) => {
    this.published.push({ channel, payload });
  });

  subscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    list.push(handler);
    this.handlers.set(channel, list);
    return () => this.unsubscribe(channel, handler);
  });

  unsubscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    this.handlers.set(channel, list.filter((item) => item !== handler));
  });

  emit(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }
}

class MockObsidianService {
  readonly notes = new Map<string, string | null>();

  readNote = vi.fn(async (_vaultRoot: string, notePath: string) => {
    return this.notes.get(notePath) ?? null;
  });

  writeNote = vi.fn(async (_vaultRoot: string, notePath: string, content: string) => {
    this.notes.set(notePath, content);
  });

  deleteNote = vi.fn(async (_vaultRoot: string, notePath: string) => {
    this.notes.delete(notePath);
  });
}

class MockKnowledgeService {
  readonly entities = new Map<string, KnowledgeEntity>();

  addDocument = vi.fn(async () => undefined);
  addRelation = vi.fn(async () => undefined);
  search = vi.fn(async () => []);
  getNeighbors = vi.fn(async () => []);
  distillKnowledge = vi.fn(async () => ({}));
  initialize = vi.fn(async () => undefined);

  addEntity = vi.fn(async (entity: KnowledgeEntity) => {
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

describe('ObsidianKnowledgeSyncImpl branch-gap coverage', () => {
  it('falls back to process cwd for vaultRoot and ignores watched events when watch is disabled', async () => {
    const originalCwd = process.cwd();
    const tempCwd = mkdtempSync(join(tmpdir(), 'niko-obsidian-sync-cwd-'));
    process.chdir(tempCwd);

    try {
      const { sync, eventBus, obsidianService } = createHarness({
        config: {
          watchEnabled: false,
          conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
        },
      });

      expect((sync as any).vaultRoot).toBe(tempCwd);

      sync.stopSync();
      expect(eventBus.unsubscribe).not.toHaveBeenCalled();

      await sync.startSync();
      eventBus.emit('obsidian:file-changed', { path: 'ignored.md' });
      eventBus.emit('knowledge:entity-updated', { id: 'hero' });
      eventBus.emit('knowledge:entity-created', { id: 'hero' });
      eventBus.emit('knowledge:entity-deleted', { id: 'hero' });
      await flushMicrotasks();

      expect((sync as any).vaultDebounceTimers.size).toBe(0);
      expect((sync as any).knowledgeDebounceTimers.size).toBe(0);
      expect(obsidianService.readNote).not.toHaveBeenCalled();
      expect(obsidianService.writeNote).not.toHaveBeenCalled();
      expect(obsidianService.deleteNote).not.toHaveBeenCalled();

      sync.stopSync();
      expect(eventBus.unsubscribe).toHaveBeenCalledTimes(4);
    } finally {
      process.chdir(originalCwd);
      rmSync(tempCwd, { recursive: true, force: true });
    }
  });

  it('stringifies non-Error failures and hydrates queued conflicts from omitted content', async () => {
    const { sync, obsidianService, knowledgeService, eventBus } = createHarness({
      config: { conflictStrategy: ConflictStrategy.HUMAN_QUEUE },
    });

    obsidianService.readNote.mockRejectedValueOnce('vault-string-failure');
    const vaultFailure = await sync.syncVaultToKnowledge('hero.md');
    expect(vaultFailure.errors).toEqual([{ item: 'hero.md', error: 'vault-string-failure' }]);

    knowledgeService.entities.set('hero', createEntity());
    obsidianService.writeNote.mockRejectedValueOnce('write-string-failure');
    const writeFailure = await sync.syncKnowledgeToVault('hero');
    expect(writeFailure.errors).toEqual([{ item: 'hero', error: 'write-string-failure' }]);

    obsidianService.notes.set('queued.md', '# Queued Hero\n\nVault body.');
    knowledgeService.entities.set('queued', createEntity({ id: 'queued', name: 'Queued Knowledge' }));
    await (sync as any).handleDetectedConflict('queued.md', 'queued', 10, 12);

    const conflictId = Array.from((sync as any).conflicts.keys())[0];
    const queuedConflict = (sync as any).conflicts.get(conflictId);
    expect(queuedConflict.vaultContent).toBe('# Queued Hero\n\nVault body.');
    expect(queuedConflict.knowledgeContent).toMatchObject({ id: 'queued', name: 'Queued Knowledge' });

    await sync.startSync();
    obsidianService.deleteNote.mockRejectedValueOnce('delete-string-failure');
    eventBus.emit('knowledge:entity-deleted', { id: 'villain' });
    await flushMicrotasks();

    expect(obsidianService.deleteNote).toHaveBeenCalledWith(process.cwd(), 'villain.md');
  });

  it('clears pending debounce timers when stopSync runs before queued work executes', async () => {
    vi.useFakeTimers();
    const { sync, eventBus, obsidianService, knowledgeService } = createHarness();
    obsidianService.notes.set('draft.md', '# Draft\n\nBody');
    knowledgeService.entities.set('hero', createEntity());

    await sync.startSync();
    eventBus.emit('obsidian:file-changed', { path: 'draft.md', timestamp: 1 });
    eventBus.emit('knowledge:entity-updated', { id: 'hero', timestamp: 2 });

    expect((sync as any).vaultDebounceTimers.size).toBe(1);
    expect((sync as any).knowledgeDebounceTimers.size).toBe(1);

    sync.stopSync();

    expect((sync as any).vaultDebounceTimers.size).toBe(0);
    expect((sync as any).knowledgeDebounceTimers.size).toBe(0);

    await vi.advanceTimersByTimeAsync(25);

    expect(obsidianService.readNote).not.toHaveBeenCalled();
    expect(obsidianService.writeNote).not.toHaveBeenCalled();
  });
});
