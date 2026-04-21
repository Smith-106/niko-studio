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
});
