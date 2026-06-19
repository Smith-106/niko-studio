import Database from 'better-sqlite3';
import { access, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadModule(options: { preserveOsMock?: boolean } = {}) {
  vi.resetModules();
  vi.doUnmock('better-sqlite3');
  vi.doUnmock('node:fs');
  vi.doUnmock('node:path');
  if (!options.preserveOsMock) {
    vi.doUnmock('node:os');
  }
  return import('../../mcp-servers/memory-mcp.js');
}

async function expectPathExists(target: string) {
  await expect(access(target, fsConstants.F_OK)).resolves.toBeUndefined();
}

async function expectPathMissing(target: string) {
  await expect(access(target, fsConstants.F_OK)).rejects.toBeDefined();
}

describe('mcp-servers/memory-mcp', () => {
  let workspace: string;
  let dbPath: string;
  let originalUserProfile: string | undefined;
  let originalHome: string | undefined;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-memory-mcp-'));
    dbPath = join(workspace, 'memory-graph.db');
    originalUserProfile = process.env.USERPROFILE;
    originalHome = process.env.HOME;
  });

  afterEach(async () => {
    vi.doUnmock('better-sqlite3');
    vi.doUnmock('node:fs');
    vi.doUnmock('node:path');
    vi.doUnmock('node:os');
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.USERPROFILE = originalUserProfile;
    process.env.HOME = originalHome;

    try {
      await rm(workspace, { recursive: true, force: true });
    } catch {
      // Lazy singleton tests may keep a SQLite handle open until process exit.
    }
  });

  it('migrates legacy JSON graphs into SQLite and exports the imported graph', async () => {
    const jsonPath = dbPath.replace(/\.db$/, '.json');
    const backupPath = dbPath.replace(/\.db$/, '.json.bak');
    const now = '2026-06-04T00:00:00.000Z';

    await writeFile(
      jsonPath,
      JSON.stringify({
        entities: {
          Alice: {
            id: 'ent-alice',
            name: 'Alice',
            entityType: 'character',
            observations: ['Lead investigator'],
            properties: { rank: 'captain' },
            tags: ['hero'],
            createdAt: now,
            updatedAt: now,
          },
          Harbor: {
            id: 'ent-harbor',
            name: 'Harbor',
            entityType: 'location',
            observations: ['Storm-worn port'],
            properties: { district: 'north' },
            createdAt: now,
            updatedAt: now,
          },
        },
        relations: {
          'rel-1': {
            id: 'rel-1',
            from: 'Alice',
            to: 'Harbor',
            relationType: 'VISITS',
            properties: { frequency: 'nightly' },
            weight: 2,
            createdAt: now,
          },
        },
      }),
      'utf8',
    );

    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    expect(store.getEntity('Alice')).toMatchObject({
      id: 'ent-alice',
      entityType: 'character',
      observations: ['Lead investigator'],
      properties: { rank: 'captain' },
    });
    expect(store.getEntityRelations('Alice', 'out')).toEqual([
      expect.objectContaining({
        id: 'rel-1',
        from: 'Alice',
        to: 'Harbor',
        relationType: 'VISITS',
        properties: { frequency: 'nightly' },
        weight: 2,
      }),
    ]);
    expect(store.getGraphStats()).toMatchObject({
      totalEntities: 2,
      totalRelations: 1,
      entitiesByType: { character: 1, location: 1 },
      relationsByType: { VISITS: 1 },
      avgRelationsPerEntity: 0.5,
    });
    expect(store.exportToJson()).toMatchObject({
      entities: {
        Alice: expect.objectContaining({ id: 'ent-alice' }),
        Harbor: expect.objectContaining({ id: 'ent-harbor' }),
      },
      relations: {
        'rel-1': expect.objectContaining({ from: 'Alice', to: 'Harbor' }),
      },
    });
    expect(store.getAllEntities({ entityType: 'character', limit: 5 })).toHaveLength(1);
    expect(store.getEntityGraph({ name: 'Alice', depth: 1 })).toMatchObject({
      center: expect.objectContaining({ name: 'Alice' }),
      nodes: [expect.objectContaining({ name: 'Harbor' })],
      edges: [expect.objectContaining({ id: 'rel-1' })],
    });

    store.close();

    await expectPathMissing(jsonPath);
    await expectPathExists(backupPath);
  });

  it('handles invalid legacy JSON without crashing migration', async () => {
    const jsonPath = dbPath.replace(/\.db$/, '.json');
    const backupPath = dbPath.replace(/\.db$/, '.json.bak');

    await writeFile(jsonPath, '{invalid json', 'utf8');

    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    expect(store.getGraphStats()).toMatchObject({
      totalEntities: 0,
      totalRelations: 0,
      avgRelationsPerEntity: 0,
    });

    store.close();

    await expectPathExists(jsonPath);
    await expectPathMissing(backupPath);
  });

  it('supports entity lifecycle, safe JSON fallback, and relation cleanup', async () => {
    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    const created = store.createEntities([
      {
        name: 'Alice',
        entityType: 'character',
        observations: ['observed'],
        properties: { rank: 'captain' },
        tags: ['lead'],
      },
      { name: 'Bob', entityType: 'character' },
    ]);
    const relation = store.createRelation({
      from: 'Alice',
      to: 'Bob',
      relationType: 'KNOWS',
      properties: { trust: 'high' },
      weight: 1.5,
    });

    expect(created).toHaveLength(2);
    expect(store.createEntity({ name: 'Alice' })).toEqual({
      error: "Entity 'Alice' already exists",
      name: 'Alice',
    });
    expect(store.updateEntity('Alice', {
      observations: ['again'],
      properties: { region: 'east' },
      entityType: 'protagonist',
      tags: ['veteran'],
    })).toEqual({ name: 'Alice', status: 'updated' });
    expect(store.updateEntity('Missing', { observations: ['x'] })).toEqual({
      error: "Entity 'Missing' not found",
    });
    expect(store.getEntity('Alice')).toMatchObject({
      entityType: 'protagonist',
      observations: ['observed', 'again'],
      properties: { rank: 'captain', region: 'east' },
      tags: ['lead', 'veteran'],
    });

    const sqlite = new Database(dbPath);
    sqlite
      .prepare("UPDATE entities SET observations = 'not-json', properties = 'not-json', tags = 'not-json' WHERE name = ?")
      .run('Bob');
    sqlite
      .prepare("UPDATE relations SET properties = 'not-json' WHERE id = ?")
      .run((relation as { id: string }).id);

    expect(store.getEntity('Bob')).toMatchObject({
      observations: [],
      properties: {},
      tags: [],
    });
    expect(store.getEntityRelations('Alice')).toEqual([
      expect.objectContaining({
        properties: {},
      }),
    ]);

    store.searchEntities({ query: 'alice' });
    expect(
      sqlite.prepare('SELECT COUNT(*) as c FROM search_history WHERE entity_name = ?').get('Alice'),
    ).toMatchObject({ c: 1 });

    expect(store.deleteRelation((relation as { id: string }).id)).toEqual({
      id: (relation as { id: string }).id,
      status: 'deleted',
    });
    expect(store.deleteRelation('missing-relation')).toEqual({
      error: "Relation 'missing-relation' not found",
    });
    expect(store.deleteEntity('Bob')).toEqual({ name: 'Bob', status: 'deleted' });
    expect(store.deleteEntity('Bob')).toEqual({ error: "Entity 'Bob' not found" });
    expect(store.deleteEntities(['Alice', 'Missing'])).toEqual([
      { name: 'Alice', status: 'deleted' },
      { error: "Entity 'Missing' not found" },
    ]);
    expect(
      sqlite.prepare('SELECT COUNT(*) as c FROM search_history WHERE entity_name = ?').get('Alice'),
    ).toMatchObject({ c: 0 });

    sqlite.close();
    store.close();
  });

  it('supports search heat tracking, graph traversal, filters, and exports', async () => {
    const { KnowledgeGraphStore } = await loadModule();
    const store = new KnowledgeGraphStore(dbPath);

    store.createEntities([
      {
        name: 'Alice',
        entityType: 'character',
        observations: ['Captain of the harbor watch'],
      },
      {
        name: 'Bob',
        entityType: 'character',
        observations: ['Keeps the harbor ledger'],
      },
      {
        name: 'Carol',
        entityType: 'character',
        observations: ['Charts the storm routes'],
      },
      {
        name: 'Harbor',
        entityType: 'location',
        observations: ['Main harbor gate'],
      },
    ]);

    const firstRelation = store.createRelation({
      from: 'Alice',
      to: 'Bob',
      relationType: 'KNOWS',
    }) as { id: string };
    const secondRelation = store.createRelation({
      from: 'Bob',
      to: 'Carol',
      relationType: 'GUIDES',
    }) as { id: string };

    expect(store.createRelation({ from: 'Missing', to: 'Bob' })).toEqual({
      error: "Entity 'Missing' not found",
    });
    expect(store.createRelation({ from: 'Alice', to: 'Unknown' })).toEqual({
      error: "Entity 'Unknown' not found",
    });

    expect(store.searchNodes({ query: 'HARBOR', limit: 10 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alice' }),
        expect.objectContaining({ name: 'Bob' }),
        expect.objectContaining({ name: 'Harbor' }),
      ]),
    );
    expect(store.searchNodes({ query: 'harbor', entityType: 'location', limit: 10 })).toEqual([
      expect.objectContaining({ name: 'Harbor' }),
    ]);

    expect(store.searchEntities({ query: 'harbor', entityType: 'location', trackHeat: false })).toEqual([
      expect.objectContaining({ name: 'Harbor', heatScore: 0 }),
    ]);

    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-04T00:00:00.000Z').getTime());
    const coldResults = store.searchEntities({ query: 'harbor', limit: 10 });
    expect(coldResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alice', heatScore: 0 }),
        expect.objectContaining({ name: 'Bob', heatScore: 0 }),
        expect.objectContaining({ name: 'Harbor', heatScore: 0 }),
      ]),
    );

    vi.mocked(Date.now).mockReturnValue(new Date('2026-06-05T00:00:00.000Z').getTime());
    const warmResults = store.searchEntities({ query: 'harbor', limit: 10 });
    expect(warmResults.some((result) => result.name === 'Alice' && result.heatScore > 0)).toBe(true);
    expect(warmResults.some((result) => result.name === 'Harbor' && result.heatScore > 0)).toBe(true);

    const sqlite = new Database(dbPath);
    expect(
      sqlite.prepare('SELECT hit_count FROM search_history WHERE entity_name = ? AND query = ?').get('Alice', 'harbor'),
    ).toMatchObject({ hit_count: 2 });

    expect(store.getEntityRelations('Bob', 'in')).toEqual([
      expect.objectContaining({ id: firstRelation.id, from: 'Alice', to: 'Bob' }),
    ]);
    expect(store.getEntityRelations('Bob', 'out')).toEqual([
      expect.objectContaining({ id: secondRelation.id, from: 'Bob', to: 'Carol' }),
    ]);
    expect(store.getEntityRelations('Bob', 'both')).toHaveLength(2);
    expect(store.getAllEntities({ entityType: 'character', limit: 2 })).toHaveLength(2);
    expect(store.getGraphStats()).toMatchObject({
      totalEntities: 4,
      totalRelations: 2,
      entitiesByType: { character: 3, location: 1 },
      relationsByType: { GUIDES: 1, KNOWS: 1 },
      avgRelationsPerEntity: 0.5,
    });
    expect(store.getEntityGraph({ name: 'Alice', depth: 2 })).toMatchObject({
      center: expect.objectContaining({ name: 'Alice' }),
      nodes: [
        expect.objectContaining({ name: 'Bob' }),
        expect.objectContaining({ name: 'Carol' }),
      ],
      edges: [
        expect.objectContaining({ id: firstRelation.id }),
        expect.objectContaining({ id: secondRelation.id }),
      ],
    });
    expect(store.getEntityGraph({ name: 'Missing' })).toEqual({
      error: "Entity 'Missing' not found",
    });
    expect(store.exportToJson()).toMatchObject({
      entities: {
        Alice: expect.objectContaining({ entityType: 'character' }),
        Harbor: expect.objectContaining({ entityType: 'location' }),
      },
      relations: {
        [firstRelation.id]: expect.objectContaining({ relationType: 'KNOWS' }),
        [secondRelation.id]: expect.objectContaining({ relationType: 'GUIDES' }),
      },
    });

    sqlite.close();
    store.close();
  });

  it('uses the lazy singleton wrappers against the default home-directory database', async () => {
    const tempHome = await mkdtemp(join(tmpdir(), 'niko-memory-mcp-home-'));
    process.env.USERPROFILE = tempHome;
    process.env.HOME = tempHome;

    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        homedir: () => tempHome,
      };
    });

    const mod = await loadModule({ preserveOsMock: true });

    const entityResults = mod.createEntities([
      {
        name: 'Wrapper Hero',
        entityType: 'character',
        observations: ['first note'],
        properties: { origin: 'bridge' },
      },
      {
        name: 'Wrapper Harbor',
        entityType: 'location',
        observations: ['deep water'],
      },
    ]);
    const relationResults = mod.createRelations([
      { from: 'Wrapper Hero', to: 'Wrapper Harbor', relationType: 'VISITS' },
    ]);

    expect(entityResults).toHaveLength(2);
    expect(relationResults).toEqual([
      expect.objectContaining({
        from: 'Wrapper Hero',
        to: 'Wrapper Harbor',
        type: 'VISITS',
        status: 'created',
      }),
    ]);
    expect(mod.openNodes(['Wrapper Hero'])).toEqual([
      expect.objectContaining({
        name: 'Wrapper Hero',
        relations: [expect.objectContaining({ relationType: 'VISITS' })],
      }),
    ]);
    expect(mod.addObservations('Wrapper Hero', ['second note'])).toEqual({
      name: 'Wrapper Hero',
      status: 'updated',
    });
    expect(mod.searchNodes({ query: 'wrapper', limit: 5 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Wrapper Hero' }),
        expect.objectContaining({ name: 'Wrapper Harbor' }),
      ]),
    );
    expect(mod.readGraph({ entityType: 'character', limit: 5 })).toMatchObject({
      entities: [expect.objectContaining({ name: 'Wrapper Hero' })],
      stats: expect.objectContaining({
        totalEntities: 2,
        totalRelations: 1,
      }),
    });
    expect(mod.getEntityGraph({ name: 'Wrapper Hero', depth: 1 })).toMatchObject({
      center: expect.objectContaining({ name: 'Wrapper Hero' }),
      nodes: [expect.objectContaining({ name: 'Wrapper Harbor' })],
      edges: [expect.objectContaining({ relationType: 'VISITS' })],
    });

    const relationId = (relationResults[0] as { id: string }).id;
    expect(mod.deleteRelations([relationId, 'missing-relation'])).toEqual([
      { id: relationId, status: 'deleted' },
      { error: "Relation 'missing-relation' not found" },
    ]);
    expect(mod.deleteEntities(['Wrapper Harbor', 'Wrapper Hero'])).toEqual([
      { name: 'Wrapper Harbor', status: 'deleted' },
      { name: 'Wrapper Hero', status: 'deleted' },
    ]);

    const defaultDb = join(tempHome, '.niko', 'memory_graph.db');
    await expectPathExists(defaultDb);
    expect((await stat(defaultDb)).size).toBeGreaterThan(0);
  });
});
