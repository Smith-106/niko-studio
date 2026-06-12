/**
 * MemoryManager Tests
 *
 * Tests MemoryEntry, MemoryManager CRUD, search, topic/entity indexing,
 * temporal facts, supersession, and the adapter layer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MemoryEntry,
  MemoryManager,
  MemoryManagerAdapter,
  getMemoryManager,
  resetMemoryManager,
} from '../../memory/memory-manager';

import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-mm-'));
}

function createMockStore() {
  return {
    add: vi.fn().mockResolvedValue('store-id'),
    get: vi.fn().mockResolvedValue(null),
    getBatch: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue({ memories: [], total: 0 }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rebuildIndex: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function resolveMemoryFilePath(manager: MemoryManager, memoryId: string): string {
  const index = JSON.parse(readFileSync(manager.indexPath, 'utf-8')) as {
    memories: Record<string, string>;
  };
  return join(manager.memoriesDir, index.memories[memoryId]);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
  resetMemoryManager();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  resetMemoryManager();
  rmSync(tempDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// MemoryEntry
// ---------------------------------------------------------------------------

describe('MemoryEntry', () => {
  it('constructs with defaults', () => {
    const entry = new MemoryEntry({ id: 'm1', content: 'Hello' });
    expect(entry.id).toBe('m1');
    expect(entry.content).toBe('Hello');
    expect(entry.topics).toEqual([]);
    expect(entry.entityId).toBeNull();
    expect(entry.validFrom).toBeNull();
    expect(entry.validUntil).toBeNull();
    expect(entry.supersedes).toBeNull();
    expect(entry.supersededBy).toBeNull();
    expect(entry.importance).toBe(0.5);
    expect(entry.source).toBe('user');
    expect(entry.metadata).toEqual({});
    expect(entry.createdAt).toBeTruthy();
    expect(entry.updatedAt).toBeTruthy();
  });

  it('constructs with all parameters', () => {
    const entry = new MemoryEntry({
      id: 'm2',
      content: 'Full',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      topics: ['plot', 'character'],
      entityId: 'alice',
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-12-31T00:00:00Z',
      supersedes: 'old-id',
      supersededBy: 'new-id',
      importance: 0.9,
      source: 'system',
      metadata: { chapter: 1 },
    });
    expect(entry.topics).toEqual(['plot', 'character']);
    expect(entry.entityId).toBe('alice');
    expect(entry.importance).toBe(0.9);
    expect(entry.source).toBe('system');
  });

  it('toYamlFrontmatter produces valid format', () => {
    const entry = new MemoryEntry({
      id: 'yaml-test',
      content: 'Body text here.',
      topics: ['plot'],
      importance: 0.7,
    });
    const output = entry.toYamlFrontmatter();
    expect(output).toMatch(/^---\n/);
    expect(output).toContain('yaml-test');
    expect(output).toContain('Body text here.');
    expect(output).toMatch(/\n---\n/);
  });

  it('toYamlFrontmatter serializes boolean values through yamlDump', () => {
    const entry = new MemoryEntry({
      id: 'yaml-bool',
      content: 'Boolean body',
      source: true as any,
    });

    expect(entry.toYamlFrontmatter()).toContain('source: true');
  });

  it('fromYamlContent parses valid frontmatter', () => {
    const raw = `---
id: parse-test
created_at: 2026-03-15T10:00:00Z
updated_at: 2026-03-15T10:00:00Z
topics: []
entity_id: alice
importance: 0.8
---

This is the body content.`;

    const entry = MemoryEntry.fromYamlContent(raw);
    expect(entry.id).toBe('parse-test');
    expect(entry.content).toBe('This is the body content.');
    expect(entry.entityId).toBe('alice');
    expect(entry.importance).toBe(0.8);
    expect(entry.topics).toEqual([]);
  });

  it('fromYamlContent throws on invalid format', () => {
    expect(() => MemoryEntry.fromYamlContent('no frontmatter here')).toThrow(
      'Invalid YAML frontmatter format',
    );
  });

  it('fromYamlContent throws when frontmatter delimiter is incomplete', () => {
    expect(() => MemoryEntry.fromYamlContent('---\nid: broken')).toThrow(
      'Invalid YAML frontmatter format',
    );
  });

  it('fromYamlContent parses arrays, quoted strings, and JSON metadata', () => {
    const raw = `---
id: parse-advanced
topics:
  - plain-topic
  - "quoted:topic"
source: "system:user"
metadata: {"flag":true,"count":2}
---

Advanced body.`;

    const entry = MemoryEntry.fromYamlContent(raw);
    expect(entry.topics).toEqual(['plain-topic', 'quoted:topic']);
    expect(entry.source).toBe('system:user');
    expect(entry.metadata).toEqual({ flag: true, count: 2 });
    expect(entry.content).toBe('Advanced body.');
  });

  it('fromYamlContent flushes a trailing array block', () => {
    const raw = `---
id: parse-tail-array
topics:
  - alpha
  - beta
---

Tail array body.`;

    const entry = MemoryEntry.fromYamlContent(raw);
    expect(entry.topics).toEqual(['alpha', 'beta']);
    expect(entry.content).toBe('Tail array body.');
  });

  it('fromYamlFile reads and parses a file', () => {
    const filePath = join(tempDir, 'test.md');
    const content = `---
id: file-test
created_at: 2026-01-01T00:00:00Z
updated_at: 2026-01-01T00:00:00Z
topics: []
---

File body content.`;
    writeFileSync(filePath, content, 'utf-8');

    const entry = MemoryEntry.fromYamlFile(filePath);
    expect(entry.id).toBe('file-test');
    expect(entry.content).toBe('File body content.');
  });
});

// ---------------------------------------------------------------------------
// MemoryManager CRUD
// ---------------------------------------------------------------------------

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager(tempDir);
  });

  describe('store and index initialization', () => {
    it('returns injected store and skips initStore when already initialized', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);

      expect(storedManager.getStore()).toBe(store);
      await storedManager.initStore({ preferBackend: 'fs' });
      expect(storedManager.getStore()).toBe(store);
    });

    it('initStore creates a store when none exists', async () => {
      expect(manager.getStore()).toBeNull();
      await manager.initStore({ preferBackend: 'fs' });
      expect(manager.getStore()).not.toBeNull();
    });

    it('rebuilds a corrupted index and skips malformed files', () => {
      vi.useFakeTimers();
      try {
        const fixedDate = new Date('2026-04-10T08:30:00.000Z');
        vi.setSystemTime(fixedDate);

        const original = manager.add('Indexed content', ['rebuild-topic'], 'rebuild-entity');
        const dateDir = join(manager.byDateDir, '2026', '04', '10');
        writeFileSync(join(dateDir, 'broken.md'), 'not valid frontmatter', 'utf-8');
        writeFileSync(join(manager.byDateDir, 'junk.txt'), 'skip me', 'utf-8');
        writeFileSync(manager.indexPath, '{not-json', 'utf-8');

        manager = new MemoryManager(tempDir);

        expect(manager.get(original.id)?.content).toBe('Indexed content');
        expect(manager.getByTopic('rebuild-topic')).toHaveLength(1);
        expect(manager.getByEntity('rebuild-entity')).toHaveLength(1);
        expect((console.warn as any).mock.calls.some((call: any[]) =>
          String(call[0]).includes('Corrupted index, rebuilding'),
        )).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('safeReaddir returns empty when the directory cannot be read', () => {
      expect((manager as any)._safeReaddir(join(tempDir, 'missing-dir'))).toEqual([]);
    });
  });

  describe('add', () => {
    it('creates a new memory entry', () => {
      const entry = manager.add('Test content', ['topic1'], 'entity1');
      expect(entry.content).toBe('Test content');
      expect(entry.topics).toEqual(['topic1']);
      expect(entry.entityId).toBe('entity1');
      expect(entry.importance).toBe(0.5);
      expect(entry.source).toBe('user');
      expect(entry.id).toBeTruthy();
    });

    it('creates memory with importance and source', () => {
      const entry = manager.add(
        'Important content',
        null,
        null,
        undefined,
        undefined,
        0.9,
        'system',
      );
      expect(entry.importance).toBe(0.9);
      expect(entry.source).toBe('system');
    });

    it('creates memory with generated ID', () => {
      const entry = manager.add('Dated content');
      expect(entry.id).toBeTruthy();
      expect(entry.id).toMatch(/^mem-\d{14}-[a-f0-9]+$/);
    });

    it('stores file on disk with frontmatter', () => {
      const entry = manager.add('Disk content');
      const memDir = join(tempDir, 'memories', 'by_date');
      expect(existsSync(memDir)).toBe(true);
    });

    it('syncs to an injected store without forwarding the file-system id', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);

      storedManager.add('Dual write content', ['sync-topic'], 'sync-entity');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(store.add).toHaveBeenCalledTimes(1);
      const [payload] = store.add.mock.calls[0];
      expect(payload.id).toBeUndefined();
      expect(payload.content).toBe('Dual write content');
      expect(payload.topics).toEqual(['sync-topic']);
    });
  });

  describe('get', () => {
    it('retrieves a stored memory by ID', () => {
      const added = manager.add('Find me', ['search'], 'e1');
      const retrieved = manager.get(added.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Find me');
    });

    it('returns null for non-existent ID', () => {
      expect(manager.get('nonexistent')).toBeNull();
    });

    it('returns null and warns when the indexed file is missing', () => {
      const entry = manager.add('Missing file content', ['missing']);
      const filePath = resolveMemoryFilePath(manager, entry.id);

      rmSync(filePath);

      expect(manager.get(entry.id)).toBeNull();
      expect((console.warn as any).mock.calls.some((call: any[]) =>
        String(call[0]).includes('Memory file not found'),
      )).toBe(true);
    });
  });

  describe('getBatch', () => {
    it('retrieves multiple memories', () => {
      const e1 = manager.add('Batch 1', null, 'entity');
      const e2 = manager.add('Batch 2', null, 'entity');
      const results = manager.getBatch([e1.id, e2.id]);
      expect(results).toHaveLength(2);
    });

    it('returns empty for empty input', () => {
      expect(manager.getBatch([])).toEqual([]);
    });

    it('returns empty for null input', () => {
      expect(manager.getBatch(null as any)).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates content and persists to disk', () => {
      const added = manager.add('Original content', ['old-topic']);
      const updated = manager.update(added.id, 'Updated content', ['new-topic']);
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.topics).toEqual(['new-topic']);
    });

    it('updates importance', () => {
      const added = manager.add('Content');
      const updated = manager.update(added.id, undefined, undefined, undefined, 0.95);
      expect(updated!.importance).toBe(0.95);
    });

    it('returns null for non-existent ID', () => {
      expect(manager.update('nonexistent', 'New content')).toBeNull();
    });

    it('merges metadata', () => {
      const added = manager.add('Content', null, null, undefined, undefined, 0.5, 'user', { original: true });
      const updated = manager.update(added.id, undefined, undefined, undefined, undefined, { added: true });
      expect(updated!.metadata).toEqual({ original: true, added: true });
    });

    it('updates topic links with copy fallback and syncs to the store', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);
      const entry = storedManager.add('Topic rewrite', ['old-topic'], 'entity-update');
      const oldLinkPath = join(storedManager.topicsDir, 'old-topic', `${entry.id}.md`);
      const newTopicDir = join(storedManager.topicsDir, 'new-topic');
      const newLinkPath = join(newTopicDir, `${entry.id}.md`);

      rmSync(oldLinkPath, { recursive: true, force: true });
      mkdirSync(oldLinkPath, { recursive: true });
      mkdirSync(newTopicDir, { recursive: true });
      writeFileSync(newLinkPath, 'stale link content', 'utf-8');

      const updated = storedManager.update(
        entry.id,
        'Topic rewrite updated',
        ['new-topic'],
        undefined,
        0.75,
        { merged: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(updated?.content).toBe('Topic rewrite updated');
      expect(updated?.topics).toEqual(['new-topic']);
      expect(readFileSync(newLinkPath, 'utf-8')).toContain('Topic rewrite');
      expect(readFileSync(newLinkPath, 'utf-8')).not.toContain('stale link content');
      expect(store.update).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({
          content: 'Topic rewrite updated',
          topics: ['new-topic'],
          importance: 0.75,
          metadata: expect.objectContaining({ merged: true }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes a memory and returns true', () => {
      const added = manager.add('To delete');
      expect(manager.delete(added.id)).toBe(true);
      expect(manager.get(added.id)).toBeNull();
    });

    it('returns false for non-existent ID', () => {
      expect(manager.delete('nonexistent')).toBe(false);
    });

    it('cleans topic and entity indexes and syncs deletion to the store', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);
      const entry = storedManager.add('Delete me', ['cleanup-topic'], 'cleanup-entity');
      const topicLinkPath = join(storedManager.topicsDir, 'cleanup-topic', `${entry.id}.md`);

      rmSync(topicLinkPath, { recursive: true, force: true });
      mkdirSync(topicLinkPath, { recursive: true });

      expect(storedManager.delete(entry.id)).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(storedManager.getByTopic('cleanup-topic')).toEqual([]);
      expect(storedManager.getByEntity('cleanup-entity')).toEqual([]);
      expect(store.delete).toHaveBeenCalledWith(entry.id);
    });
  });

  describe('getByTopic', () => {
    it('returns memories for a topic', () => {
      manager.add('Topic A content', ['topic-a']);
      manager.add('Topic B content', ['topic-b']);
      const results = manager.getByTopic('topic-a');
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Topic A content');
    });

    it('returns empty for unknown topic', () => {
      expect(manager.getByTopic('unknown')).toEqual([]);
    });
  });

  describe('getByEntity', () => {
    it('returns memories for an entity', () => {
      manager.add('Alice info', null, 'alice');
      manager.add('Bob info', null, 'bob');
      const results = manager.getByEntity('alice');
      expect(results).toHaveLength(1);
      expect(results[0].entityId).toBe('alice');
    });
  });

  describe('getByDate', () => {
    it('returns memories for a specific date', () => {
      manager.add('Today memory');
      const results = manager.getByDate(new Date());
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('accepts string dates and skips malformed files', () => {
      vi.useFakeTimers();
      try {
        const fixedDate = new Date('2026-04-11T09:00:00.000Z');
        vi.setSystemTime(fixedDate);

        const entry = manager.add('Date string memory');
        const dateDir = join(manager.byDateDir, '2026', '04', '11');
        writeFileSync(join(dateDir, 'broken.md'), 'broken content', 'utf-8');

        const results = manager.getByDate('2026-04-11T09:00:00.000Z');
        expect(results.map((item) => item.id)).toContain(entry.id);
        expect((console.warn as any).mock.calls.some((call: any[]) =>
          String(call[0]).includes('Failed to read broken.md'),
        )).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getTemporalFacts', () => {
    it('returns valid facts for an entity', () => {
      const now = new Date();
      manager.add('Alice is alive', null, 'alice-tf', now.toISOString(), null, 0.8);
      const facts = manager.getTemporalFacts('alice-tf');
      expect(facts.length).toBeGreaterThanOrEqual(1);
      expect(facts[0].content).toBe('Alice is alive');
    });

    it('excludes superseded facts', () => {
      const now = new Date();
      const old = manager.add('Old state', null, 'alice-tf2', now.toISOString(), null, 0.8);
      manager.add('New state', null, 'alice-tf2', now.toISOString(), null, 0.9);
      // Mark old as superseded via update
      manager.update(old.id, undefined, undefined, now.toISOString(), undefined, { supersededBy: 'new-fake' });

      const facts = manager.getTemporalFacts('alice-tf2');
      expect(facts.length).toBeGreaterThanOrEqual(1);
    });

    it('filters future and expired facts at a target time', () => {
      manager.add('Current fact', null, 'alice-tf3', '2026-01-01T00:00:00.000Z', null, 0.6);
      manager.add('Future fact', null, 'alice-tf3', '2026-06-01T00:00:00.000Z', null, 0.9);
      manager.add(
        'Expired fact',
        null,
        'alice-tf3',
        '2025-01-01T00:00:00.000Z',
        '2026-01-15T00:00:00.000Z',
        0.8,
      );

      const facts = manager.getTemporalFacts('alice-tf3', '2026-03-01T00:00:00.000Z');
      expect(facts).toHaveLength(1);
      expect(facts[0].content).toBe('Current fact');
    });
  });

  describe('supersede', () => {
    it('creates new entry and marks old as superseded', () => {
      const old = manager.add('Old content', ['plot'], 'entity-sup');
      const newEntry = manager.supersede(old.id, 'New content');

      expect(newEntry).not.toBeNull();
      expect(newEntry!.supersedes).toBe(old.id);
      expect(newEntry!.content).toBe('New content');

      // Old entry has validUntil set (closed via update)
      const oldReloaded = manager.get(old.id);
      expect(oldReloaded).not.toBeNull();
      expect(oldReloaded!.validUntil).not.toBeNull();
    });

    it('returns null for non-existent old entry', () => {
      expect(manager.supersede('nonexistent', 'New content')).toBeNull();
    });
  });

  describe('search', () => {
    it('finds memories by content', () => {
      manager.add('The dragon breathed fire');
      manager.add('The knight drew his sword');
      const results = manager.search('dragon');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].content).toContain('dragon');
    });

    it('filters by topic', () => {
      manager.add('Dragon lore', ['fantasy']);
      manager.add('Spaceship manual', ['scifi']);
      const results = manager.search('', ['fantasy']);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by entity', () => {
      manager.add('Alice description', null, 'alice-search');
      manager.add('Bob description', null, 'bob-search');
      const results = manager.search('', null, 'alice-search');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('search returns all memories for entity when not filtered', () => {
      const entry = manager.add('Searchable state content', null, 'entity-excl');
      const results = manager.search('state', null, 'entity-excl');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.id === entry.id)).toBe(true);
    });
  });

  describe('listTopics / stats', () => {
    it('lists all topic names', () => {
      manager.add('Content 1', ['alpha', 'beta']);
      manager.add('Content 2', ['gamma']);
      const topics = manager.listTopics();
      expect(topics).toContain('alpha');
      expect(topics).toContain('beta');
      expect(topics).toContain('gamma');
    });

    it('stats returns correct counts', () => {
      manager.add('Stat content', ['stats-topic'], 'stats-entity');
      const stats = manager.stats();
      expect(stats.totalMemories).toBe(1);
      expect(stats.totalTopics).toBeGreaterThanOrEqual(1);
      expect(stats.totalEntities).toBeGreaterThanOrEqual(1);
    });
  });

  describe('alias methods', () => {
    it('saveMemory is alias for add', () => {
      const entry = manager.saveMemory('Saved content', ['alias']);
      expect(entry.content).toBe('Saved content');
    });

    it('loadMemory is alias for get', () => {
      const added = manager.add('Load content');
      expect(manager.loadMemory(added.id)!.content).toBe('Load content');
    });
  });

  describe('listing and async search', () => {
    it('listByDate supports string ranges and default start windows', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'));
        const older = manager.add('Older day memory', ['date-range'], 'dr-1');

        vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
        const newer = manager.add('Newer day memory', ['date-range'], 'dr-1');

        const explicit = manager.listByDate(
          '2026-04-09T00:00:00.000Z',
          '2026-04-10T23:59:59.000Z',
        );
        const implicit = manager.listByDate(undefined, '2026-04-10T23:59:59.000Z');

        expect(explicit.map((item) => item.id)).toEqual([newer.id, older.id]);
        expect(implicit.map((item) => item.id)).toEqual([newer.id, older.id]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('listByDate supports Date objects and default end dates', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'));
        const older = manager.add('Older object-date memory', ['object-range'], 'od-1');

        vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
        const newer = manager.add('Newer object-date memory', ['object-range'], 'od-1');

        const explicitDateObjects = manager.listByDate(
          new Date('2026-04-09T00:00:00.000Z'),
          new Date('2026-04-10T23:59:59.000Z'),
        );
        const defaultEndDate = manager.listByDate(new Date('2026-04-09T00:00:00.000Z'));

        expect(explicitDateObjects.map((item) => item.id)).toEqual([newer.id, older.id]);
        expect(defaultEndDate.map((item) => item.id)).toEqual([newer.id, older.id]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('listByTopic filters superseded memories, sorts by importance, and applies limit', () => {
      const old = manager.add('Superseded ranked memory', ['ranked'], 'ranked-entity', undefined, undefined, 0.2);
      manager.supersede(old.id, 'Replacement ranked memory', ['ranked']);
      manager.add('Important ranked memory', ['ranked'], 'ranked-entity', undefined, undefined, 0.9);
      manager.add('Less important ranked memory', ['ranked'], 'ranked-entity', undefined, undefined, 0.4);

      const limited = manager.listByTopic('ranked', 1, false);
      const withSuperseded = manager.listByTopic('ranked', 10, true);

      expect(limited).toHaveLength(1);
      expect(limited[0].content).toBe('Important ranked memory');
      expect(withSuperseded.some((entry) => entry.id === old.id)).toBe(true);
    });

    it('searchAsync maps store results back to file entries', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);
      const entry = storedManager.add('Async search memory', ['async-topic'], 'async-entity');

      store.search.mockResolvedValue({
        memories: [{ id: entry.id }, { id: 'missing-id' }],
        total: 2,
      });

      const results = await storedManager.searchAsync('Async', ['async-topic'], 'async-entity', 5);
      expect(results.map((item) => item.id)).toEqual([entry.id]);
      expect(store.search).toHaveBeenCalledWith({
        query: 'Async',
        topics: ['async-topic'],
        entityId: 'async-entity',
        limit: 5,
      });
    });

    it('searchAsync falls back to synchronous search when the store fails', async () => {
      const store = createMockStore();
      const storedManager = new MemoryManager(tempDir, store as any);
      const entry = storedManager.add('Fallback async search', ['fallback-topic'], 'fallback-entity');

      store.search.mockRejectedValue(new Error('fts unavailable'));

      const results = await storedManager.searchAsync('Fallback', ['fallback-topic'], 'fallback-entity', 5);
      expect(results.some((item) => item.id === entry.id)).toBe(true);
    });
  });

  describe('topic link fallbacks', () => {
    it('copies the source file when the initial link path is missing', () => {
      const entry = new MemoryEntry({
        id: 'topic-copy',
        content: 'Topic copy content',
        topics: ['copy-topic'],
      });
      const sourceFile = join(tempDir, 'source.md');
      const topicDir = join(manager.topicsDir, 'copy-topic');
      const linkPath = join(topicDir, 'topic-copy.md');

      writeFileSync(sourceFile, entry.toYamlFrontmatter(), 'utf-8');
      mkdirSync(topicDir, { recursive: true });

      (manager as any)._createTopicLinks(entry, sourceFile);

      expect(readFileSync(linkPath, 'utf-8')).toContain('Topic copy content');
    });

    it('warns when both symlink and copy fallback fail', () => {
      const entry = new MemoryEntry({
        id: 'topic-warn',
        content: 'Topic warn content',
        topics: ['warn-topic'],
      });
      const sourceFile = join(tempDir, 'missing-source.md');

      (manager as any)._createTopicLinks(entry, sourceFile);

      expect((console.warn as any).mock.calls.some((call: any[]) =>
        String(call[0]).includes('Failed to create topic link for warn-topic'),
      )).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// MemoryManagerAdapter
// ---------------------------------------------------------------------------

describe('MemoryManagerAdapter', () => {
  it('creates with default MemoryManager', () => {
    const adapter = new MemoryManagerAdapter(undefined, undefined, tempDir);
    expect(adapter.manager).toBeInstanceOf(MemoryManager);
    expect(adapter.service).toBeNull();
  });

  it('saves to file system and optionally to vector store', async () => {
    const mockService = {
      add: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new MemoryManagerAdapter(undefined, mockService, tempDir);
    const entry = await adapter.save('Content', ['test'], 'e1');
    expect(entry.content).toBe('Content');
    expect(mockService.add).toHaveBeenCalledTimes(1);
  });

  it('skips vector indexing when indexInVector is false', async () => {
    const mockService = {
      add: vi.fn(),
    };
    const adapter = new MemoryManagerAdapter(undefined, mockService, tempDir);
    await adapter.save('Content', null, null, 0.5, 'user', null, false);
    expect(mockService.add).not.toHaveBeenCalled();
  });

  it('returns successfully when the vector service does not expose add', async () => {
    const adapter = new MemoryManagerAdapter(undefined, {}, tempDir);
    const entry = await adapter.save('No add method content', ['safe']);
    expect(entry.content).toBe('No add method content');
  });

  it('warns when vector indexing fails during save', async () => {
    const adapter = new MemoryManagerAdapter(
      undefined,
      { add: vi.fn().mockRejectedValue(new Error('index failed')) },
      tempDir,
    );

    await expect(adapter.save('Warn content', ['warn-topic'])).resolves.toBeInstanceOf(MemoryEntry);
    expect((console.warn as any).mock.calls.some((call: any[]) =>
      String(call[0]).includes('Failed to index in vector store'),
    )).toBe(true);
  });

  it('merges file and vector search results without duplicates', async () => {
    const managerInstance = new MemoryManager(tempDir);
    const fileEntry = managerInstance.add('File memory content', ['hybrid'], 'hybrid-entity', undefined, undefined, 0.6);
    const service = {
      search: vi.fn().mockResolvedValue([
        {
          id: fileEntry.id,
          content: 'Duplicate file memory content',
          score: 0.95,
          metadata: { tags: ['hybrid'] },
        },
        {
          id: 'vector-only',
          content: 'Vector only content',
          score: 0.8,
          metadata: { tags: ['hybrid', 'vector'] },
        },
      ]),
    };
    const adapter = new MemoryManagerAdapter(managerInstance, service, tempDir);

    const results = await adapter.searchHybrid('content', ['hybrid'], 5);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'vector-only', source: 'vector' }));
    expect(results[1]).toEqual(expect.objectContaining({ id: fileEntry.id, source: 'file' }));
  });

  it('returns file results when vector search is unavailable or fails', async () => {
    const managerInstance = new MemoryManager(tempDir);
    const fileEntry = managerInstance.add('File-only search result', ['fallback-vector']);
    const adapterWithoutSearch = new MemoryManagerAdapter(managerInstance, {}, tempDir);
    const adapterWithFailure = new MemoryManagerAdapter(
      managerInstance,
      { search: vi.fn().mockRejectedValue(new Error('vector down')) },
      tempDir,
    );

    const missingSearchResults = await adapterWithoutSearch.searchHybrid('File-only', ['fallback-vector'], 5);
    const failedSearchResults = await adapterWithFailure.searchHybrid('File-only', ['fallback-vector'], 5);

    expect(missingSearchResults).toEqual([
      expect.objectContaining({ id: fileEntry.id, source: 'file' }),
    ]);
    expect(failedSearchResults).toEqual([
      expect.objectContaining({ id: fileEntry.id, source: 'file' }),
    ]);
    expect((console.warn as any).mock.calls.some((call: any[]) =>
      String(call[0]).includes('Vector search failed'),
    )).toBe(true);
  });
});

describe('getMemoryManager', () => {
  it('returns the same singleton instance until reset', () => {
    const first = getMemoryManager(tempDir);
    const second = getMemoryManager(join(tempDir, 'ignored-after-first'));

    expect(second).toBe(first);
    expect(first.basePath).toBe(tempDir);
  });

  it('creates a new singleton after reset', () => {
    const first = getMemoryManager(tempDir);
    resetMemoryManager();
    const second = getMemoryManager(join(tempDir, 'fresh-singleton'));

    expect(second).not.toBe(first);
    expect(second.basePath).toBe(join(tempDir, 'fresh-singleton'));
  });
});

describe('MemoryManager module fallbacks', () => {
  it('copies after removing an existing link when symlink creation fails', async () => {
    vi.resetModules();

    const symlinkSync = vi.fn(() => {
      throw new Error('symlink denied');
    });
    const unlinkSync = vi.fn((target: fs.PathLike) => {
      return rmSync(target as string, { recursive: true, force: true });
    });

    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return {
        ...actual,
        symlinkSync,
        unlinkSync,
      };
    });

    try {
      const isolatedTempDir = createTempDir();
      const mod = await import('../../memory/memory-manager');
      const isolatedManager = new mod.MemoryManager(isolatedTempDir);
      const entry = new mod.MemoryEntry({
        id: 'isolated-link',
        content: 'Isolated copy body',
        topics: ['isolated-topic'],
      });
      const sourceFile = join(isolatedTempDir, 'source.md');
      const topicDir = join(isolatedManager.topicsDir, 'isolated-topic');
      const linkPath = join(topicDir, 'isolated-link.md');

      writeFileSync(sourceFile, entry.toYamlFrontmatter(), 'utf-8');
      mkdirSync(topicDir, { recursive: true });
      writeFileSync(linkPath, 'old linked content', 'utf-8');

      (isolatedManager as any)._createTopicLinks(entry, sourceFile);

      expect(unlinkSync).toHaveBeenCalledWith(linkPath);
      expect(symlinkSync).toHaveBeenCalled();
      expect(readFileSync(linkPath, 'utf-8')).toContain('Isolated copy body');

      mod.resetMemoryManager();
      rmSync(isolatedTempDir, { recursive: true, force: true });
    } finally {
      vi.doUnmock('fs');
      vi.resetModules();
    }
  });
});
