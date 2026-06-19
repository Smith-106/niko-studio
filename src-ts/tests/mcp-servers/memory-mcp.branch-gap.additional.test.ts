import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  vi.doUnmock('better-sqlite3');
  vi.doUnmock('node:fs');
  vi.doUnmock('node:path');
  vi.doUnmock('node:os');
  return import('../../mcp-servers/memory-mcp.js');
}

async function expectPathExists(target: string) {
  await expect(access(target, fsConstants.F_OK)).resolves.toBeUndefined();
}

describe('mcp-servers/memory-mcp branch gap additional coverage', () => {
  let workspace: string;
  let dbPath: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-memory-mcp-branch-gap-'));
    dbPath = join(workspace, 'memory-graph.db');
  });

  afterEach(async () => {
    vi.doUnmock('better-sqlite3');
    vi.doUnmock('node:fs');
    vi.doUnmock('node:path');
    vi.doUnmock('node:os');
    vi.restoreAllMocks();
    vi.resetModules();
    await rm(workspace, { recursive: true, force: true });
  });

  it('skips legacy json migration when sqlite already contains entities', async () => {
    const jsonPath = dbPath.replace(/\.db$/, '.json');

    const { KnowledgeGraphStore } = await loadModule();
    const seededStore = new KnowledgeGraphStore(dbPath);
    expect(seededStore.createEntity({ name: 'Existing Hero', entityType: 'character' })).toMatchObject({
      name: 'Existing Hero',
      status: 'created',
    });
    seededStore.close();

    await writeFile(
      jsonPath,
      JSON.stringify({
        entities: {
          LegacyHero: {
            id: 'legacy-hero',
            name: 'Legacy Hero',
            entityType: 'character',
          },
        },
      }),
      'utf8',
    );

    const reopenedStore = new KnowledgeGraphStore(dbPath);
    expect(reopenedStore.getEntity('Existing Hero')).toMatchObject({
      name: 'Existing Hero',
      entityType: 'character',
    });
    expect(reopenedStore.getEntity('Legacy Hero')).toBeNull();
    reopenedStore.close();

    await expectPathExists(jsonPath);
  });

  it('fills entity and relation defaults during legacy json migration', async () => {
    const jsonPath = dbPath.replace(/\.db$/, '.json');

    await writeFile(
      jsonPath,
      JSON.stringify({
        entities: {
          DefaultHero: {
            id: 'ent-default-hero',
            name: 'Default Hero',
          },
          DefaultHarbor: {
            id: 'ent-default-harbor',
            name: 'Default Harbor',
          },
        },
        relations: {
          'rel-default': {
            id: 'rel-default',
            from: 'Default Hero',
            to: 'Default Harbor',
          },
        },
      }),
      'utf8',
    );

    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    expect(store.getEntity('Default Hero')).toMatchObject({
      entityType: 'concept',
      observations: [],
      properties: {},
      tags: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(store.getEntityRelations('Default Hero', 'out')).toEqual([
      expect.objectContaining({
        relationType: 'RELATED_TO',
        properties: {},
        weight: 1,
        createdAt: expect.any(String),
      }),
    ]);

    store.close();
  });

  it('covers relation defaults, missing entity fallback, default entity listing, and non-unique rethrow path', async () => {
    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    expect(store.getEntity('Missing Hero')).toBeNull();

    expect(store.createEntity({ name: 'Alice' })).toMatchObject({
      name: 'Alice',
      status: 'created',
    });
    expect(store.createEntity({ name: 'Bob' })).toMatchObject({
      name: 'Bob',
      status: 'created',
    });

    expect(store.createRelation({ from: 'Alice', to: 'Bob' })).toEqual(
      expect.objectContaining({
        from: 'Alice',
        to: 'Bob',
        type: 'RELATED_TO',
        status: 'created',
      }),
    );
    expect(store.getEntityRelations('Alice', 'out')).toEqual([
      expect.objectContaining({
        relationType: 'RELATED_TO',
        properties: {},
        weight: 1,
      }),
    ]);

    expect(store.getAllEntities().map((entity) => entity.name).sort()).toEqual(['Alice', 'Bob']);

    const db = (store as unknown as { db: { prepare: (sql: string) => unknown } }).db;
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO entities')) {
        return {
          run() {
            throw 'database unavailable';
          },
        } as unknown;
      }
      return originalPrepare(sql);
    });

    let thrown: unknown;
    try {
      store.createEntity({ name: 'Carol' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe('database unavailable');

    store.close();
  });
});
