import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CitationManager,
  PersistedCitation,
  TransientCitation,
  getCitationManager,
  resetCitationManager,
  type MemoryManagerLike,
} from '../../memory/citation-manager';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-citation-additional-'));
}

function createMemoryManager(
  entry: { content: string; topics: string[]; entityId: string | null; importance: number } | null,
): MemoryManagerLike {
  return {
    get: vi.fn().mockReturnValue(entry),
  };
}

describe('memory/citation-manager additional coverage', () => {
  let tempDir: string;
  let manager: CitationManager;

  beforeEach(() => {
    tempDir = createTempDir();
    manager = new CitationManager(tempDir);
  });

  afterEach(() => {
    resetCitationManager();
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('treats non-string expiration values as expired and exposes the loc alias', () => {
    const transient = new TransientCitation({
      citationId: 'broken-expiry',
      sourceText: 'text',
      sourceLocation: {},
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: null as unknown as string,
    });
    expect(transient.isExpired()).toBe(true);

    const persisted = new PersistedCitation({
      citationId: 'with-loc',
      sourceLocation: {
        path: '/doc.md',
        loc: { kind: 'line', start: 3, end: 5 },
      },
    });
    expect(persisted.loc).toEqual({ kind: 'line', start: 3, end: 5 });
  });

  it('covers legacy createTransientCitation branches for kw content, primitive sources, and location aliases', () => {
    const transient = manager.createTransientCitation(null, {}, null, {
      content: 'payload from kwargs',
      path: '/legacy.txt',
      surface: 'legacy-surface',
      loc: { kind: 'line', start: 7, end: 9 },
      id: 'legacy-content-id',
    });

    expect(transient.citationId).toBe('legacy-content-id');
    expect(transient.sourceText).toBe('');
    expect(transient.sourceLocation).toEqual({
      path: '/legacy.txt',
      surface: 'legacy-surface',
      loc: { kind: 'line', start: 7, end: 9 },
    });
  });

  it('persists citations with context in makeCitation and validates against file hashes and mismatches', () => {
    const sourceFile = join(tempDir, 'source.txt');
    writeFileSync(sourceFile, 'file-backed content', 'utf8');

    const withContext = manager.makeCitation(
      new TransientCitation({
        citationId: 'ctx-citation',
        sourceText: 'quote from context',
        sourceLocation: { path: sourceFile, surface: 'file' },
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
        contextBefore: 'before',
        contextAfter: 'after',
      }),
      'standard',
      ['ctx'],
    );
    expect(withContext.context).toEqual({ before: 'before', after: 'after' });

    const fileHash = (manager as any)._calculateTextHash('file-backed content');
    const fileBacked = new PersistedCitation({
      citationId: 'file-backed',
      sourceHash: fileHash,
      sourceLocation: { path: sourceFile, surface: 'file' },
      quote: 'different quote text',
      retentionClass: 'standard',
      createdAt: '2026-01-01T00:00:00Z',
    });
    manager.addCitation(fileBacked);
    expect(manager.verifyCitationDetailed('file-backed')).toMatchObject({
      valid: true,
      storedHash: fileHash,
      currentHash: fileHash,
    });

    const mismatched = new PersistedCitation({
      citationId: 'mismatched',
      sourceHash: 'not-the-right-hash',
      sourceLocation: { path: sourceFile, surface: 'file' },
      quote: 'still different',
      retentionClass: 'standard',
      createdAt: '2026-01-01T00:00:00Z',
    });
    manager.addCitation(mismatched);

    const detail = manager.verifyCitationDetailed('mismatched');
    expect(detail.valid).toBe(false);
    expect(detail.currentHash).toBe(fileHash);
  });

  it('returns null for corrupt citation files and skips invalid entries when listing citations', () => {
    const good = new PersistedCitation({
      citationId: 'good-citation',
      quote: 'good',
      createdAt: '2026-02-01T00:00:00Z',
      sourceLocation: { path: '/good.txt' },
    });
    manager.addCitation(good);

    writeFileSync(join(manager.citationsDir, 'broken.json'), '{not-json', 'utf8');
    writeFileSync(join(manager.citationsDir, 'corrupt-citation.json'), '{also-bad', 'utf8');

    expect(manager.getCitation('corrupt-citation')).toBeNull();

    const listed = manager.listCitations();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.citationId).toBe('good-citation');
  });

  it('garbage-collects expired and corrupt persisted citations while ignoring bad date payloads', () => {
    const expired = new PersistedCitation({
      citationId: 'expired-ephemeral',
      quote: 'old',
      retentionClass: 'ephemeral',
      createdAt: '2020-01-01T00:00:00Z',
    });
    manager.addCitation(expired);

    writeFileSync(
      join(manager.citationsDir, 'invalid-date.json'),
      JSON.stringify({
        citationId: 'invalid-date',
        quote: 'bad date payload',
        retentionClass: 'ephemeral',
        createdAt: {},
      }),
      'utf8',
    );
    writeFileSync(join(manager.citationsDir, 'broken-gc.json'), '{broken', 'utf8');

    const deleted = manager.gcExpired(false);
    expect(deleted).toEqual(expect.arrayContaining(['expired-ephemeral', 'broken-gc']));
    expect(existsSync(join(manager.citationsDir, 'expired-ephemeral.json'))).toBe(false);
    expect(existsSync(join(manager.citationsDir, 'broken-gc.json'))).toBe(false);
    expect(existsSync(join(manager.citationsDir, 'invalid-date.json'))).toBe(true);
  });

  it('garbage-collects orphaned and corrupt citations in legacy GC while tolerating invalid createdAt values', () => {
    const keptSource = join(tempDir, 'existing.txt');
    writeFileSync(keptSource, 'still here', 'utf8');

    writeFileSync(
      join(manager.citationsDir, 'legacy-invalid-date.json'),
      JSON.stringify({
        citationId: 'legacy-invalid-date',
        sourceLocation: { path: keptSource },
        quote: 'legacy bad date',
        retentionClass: 'ephemeral',
        createdAt: {},
      }),
      'utf8',
    );
    writeFileSync(join(manager.citationsDir, 'legacy-broken.json'), '{broken', 'utf8');

    const orphan = new PersistedCitation({
      citationId: 'legacy-orphan',
      sourceLocation: { path: join(tempDir, 'missing.txt') },
      quote: 'gone',
      retentionClass: 'standard',
      createdAt: '2026-01-01T00:00:00Z',
    });
    manager.addCitation(orphan);

    const deleted = manager.gcOrphanedCitations(false, 1);
    expect(deleted).toEqual(expect.arrayContaining(['legacy-orphan', 'legacy-broken']));
    expect(existsSync(join(manager.citationsDir, 'legacy-invalid-date.json'))).toBe(true);
  });

  it('truncates long memory fallbacks, exposes file-hash errors, and updates legacy citations', () => {
    const longContent = `${'A'.repeat(205)} ending`;
    manager.setMemoryManager(createMemoryManager({
      content: longContent,
      topics: ['memory'],
      entityId: 'entity-1',
      importance: 0.7,
    }));

    const citation = manager.createCitationFromMemory('mem-long', 'missing excerpt');
    expect(citation).not.toBeNull();
    expect(citation?.sourceText).toHaveLength(200);

    expect((manager as any)._calculateFileHash(join(tempDir, 'missing.bin'))).toBe('');

    const legacy = new PersistedCitation({
      citationId: 'legacy-update',
      quote: 'before',
      sourceLocation: { path: '/before.txt' },
      createdAt: '2026-01-01T00:00:00Z',
    });
    manager.addCitation(legacy);
    legacy.quote = 'after';
    legacy.sourceLocation = { path: '/after.txt' };
    manager.updateCitation(legacy);

    const stored = JSON.parse(readFileSync(join(manager.citationsDir, 'legacy-update.json'), 'utf8'));
    expect(stored.quote).toBe('after');
    expect(stored.sourceLocation).toEqual({ path: '/after.txt' });
  });

  it('reports expired transient stats and wires a memory manager into the singleton on a later call', () => {
    const expired = new TransientCitation({
      citationId: 'expired-stat',
      sourceText: 'old',
      sourceLocation: {},
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-01-01T00:01:00Z',
    });
    (manager as any)._transientCache.set('expired-stat', expired);

    expect(manager.stats()).toMatchObject({
      transientCount: 1,
      expiredTransientCount: 1,
    });

    resetCitationManager();
    const singletonDir = createTempDir();
    try {
      const singleton = getCitationManager(singletonDir);
      const memoryManager = createMemoryManager({
        content: 'singleton memory content',
        topics: ['singleton'],
        entityId: null,
        importance: 0.5,
      });
      const sameSingleton = getCitationManager(singletonDir, memoryManager);

      expect(singleton).toBe(sameSingleton);
      expect(sameSingleton.createCitationFromMemory('singleton-memory', 'memory')).not.toBeNull();
    } finally {
      rmSync(singletonDir, { recursive: true, force: true });
      resetCitationManager();
    }
  });

  it('covers default deserializers, legacy aliases, and partial location normalization', () => {
    const transientDefaults = TransientCitation.fromDict({});
    expect(transientDefaults.toDict()).toMatchObject({
      citationId: '',
      sourceText: '',
      sourceLocation: {},
      createdAt: '',
      expiresAt: '',
      contextBefore: '',
      contextAfter: '',
      score: null,
      metadata: {},
    });

    const persistedAliases = new PersistedCitation({
      p: '/legacy.md',
      loc: { kind: 'line', start: 2, end: 4 },
      surface: 'disk',
    });
    expect(persistedAliases.citationId).toBe('');
    expect(persistedAliases.sourceHash).toBe('');
    expect(persistedAliases.sourceType).toBe('doc');
    expect(persistedAliases.sourceLocation).toEqual({
      path: '/legacy.md',
      loc: { kind: 'line', start: 2, end: 4 },
      surface: 'disk',
    });

    const emptyPersisted = new PersistedCitation({});
    expect(emptyPersisted.path).toBeNull();
    expect(emptyPersisted.loc).toBeNull();

    const normalized = manager.createCitation('partial location', {
      surface: 'memory',
      loc: {},
    });
    expect(normalized.sourceLocation).toEqual({
      path: null,
      surface: 'memory',
      loc: { kind: 'char', start: 0, end: null },
    });
  });

  it('covers payload id routing, null fallbacks, sort defaults, and orphan ttl cleanup', () => {
    const sourced = manager.createTransientCitation(
      null,
      null,
      { content: 'payload body', id: 'payload-id', metadata: {} },
      {},
    );
    expect(sourced.citationId).toBe('payload-id');

    const overridden = manager.createTransientCitation(
      null,
      null,
      { content: 'payload body', id: 'payload-id', metadata: {} },
      { citationId: 'manual-id' },
    );
    expect(overridden.citationId).toBe('manual-id');

    const nullLocation = manager.createTransientCitation('plain text', null, null, {});
    expect(nullLocation.sourceLocation).toEqual({
      path: null,
      surface: null,
      loc: null,
    });

    const tagless = manager.makeCitation(
      new TransientCitation({
        citationId: 'tagless',
        sourceText: 'quote',
        sourceLocation: { path: '/tagless.txt' },
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
      }),
      'standard',
      null,
    );
    expect(tagless.tags).toEqual([]);

    writeFileSync(
      join(manager.citationsDir, 'null-created.json'),
      JSON.stringify({
        citationId: 'null-created',
        quote: 'older fallback',
        createdAt: null,
        sourceLocation: { path: '/null-created.txt' },
      }),
      'utf8',
    );
    manager.addCitation(
      new PersistedCitation({
        citationId: 'dated-created',
        quote: 'dated',
        createdAt: '2026-03-01T00:00:00Z',
        sourceLocation: { path: '/dated-created.txt' },
      }),
    );
    const listed = manager.listCitations();
    expect(listed.at(-1)?.citationId).toBe('null-created');
    expect(listed.some((citation) => citation.citationId === 'null-created')).toBe(true);

    const existingSource = join(tempDir, 'ephemeral-source.txt');
    writeFileSync(existingSource, 'still present', 'utf8');
    manager.addCitation(
      new PersistedCitation({
        citationId: 'legacy-ephemeral-expired',
        quote: 'aged',
        retentionClass: 'ephemeral',
        createdAt: '2020-01-01T00:00:00Z',
        sourceLocation: { path: existingSource },
      }),
    );
    const deleted = manager.gcOrphanedCitations(false, 1);
    expect(deleted).toContain('legacy-ephemeral-expired');
    expect(existsSync(join(manager.citationsDir, 'legacy-ephemeral-expired.json'))).toBe(false);
  });
});
