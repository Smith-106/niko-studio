import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  Entity as GraphEntity,
  GraphEngine,
  Relation,
} from '../../graph/graph-engine';

function createDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-graph-engine-'));
  return join(dir, 'graph-engine.db');
}

describe('graph/graph-engine', () => {
  it('supports the remaining search, relationship, foreshadow, and mutation tail behavior', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Character', 'Alice', { role: 'lead' });
      await engine.createEntity('Character', 'Alicia', { role: 'ally' });
      await engine.createEntity('Character', 'Bob', { role: 'rival' });
      await engine.createEntity('Foreshadow', 'Broken Seal', {
        status: 'pending',
        planted_chapter: 2,
      });
      await engine.createEntity('Foreshadow', 'Late Bell', {
        status: 'pending',
        planted_chapter: 5,
      });
      await engine.createEntity('Foreshadow', 'Closed Loop', {
        status: 'resolved',
        planted_chapter: 1,
      });

      const knows = await engine.createRelation('Alice', 'Bob', 'KNOWS', {
        since: 'chapter-1',
      });
      const mentors = await engine.createRelation('Alice', 'Alicia', 'MENTORS', {
        since: 'chapter-2',
      });

      const search = await engine.searchEntitiesByName('Character', 'Alici%', 0);
      const mentorRelationships = await engine.getRelationships('Alice', 'MENTORS', 2);
      const foreshadows = await engine.getForeshadows('pending', 3);
      const updated = await engine.updateEntity('Alice', {
        role: 'captain',
        focus: 'bridge',
      });
      const alice = await engine.getCharacter('Alice', false, false);
      const deleted = await engine.deleteEntity('Bob');
      const deletedCharacter = await engine.getCharacter('Bob', false, false);
      const knowsAfterDelete = await engine.getRelationships('Alice', 'KNOWS', 1);

      expect(knows).toMatchObject({ status: 'created' });
      expect(mentors).toMatchObject({ status: 'created' });
      expect(search).toHaveLength(1);
      expect(search[0]).toMatchObject({
        name: 'Alicia',
        type: 'Character',
        properties: { role: 'ally' },
      });
      expect(mentorRelationships).toHaveLength(1);
      expect(mentorRelationships[0]).toMatchObject({
        type: 'MENTORS',
        from: 'Alice',
        to: 'Alicia',
        properties: { since: 'chapter-2' },
      });
      expect(foreshadows).toHaveLength(1);
      expect(foreshadows[0]).toMatchObject({
        name: 'Broken Seal',
        properties: { status: 'pending', planted_chapter: 2 },
      });
      expect(updated).toMatchObject({
        status: 'updated',
        properties: { role: 'captain', focus: 'bridge' },
      });
      expect(alice).toMatchObject({
        name: 'Alice',
        properties: { role: 'captain', focus: 'bridge' },
      });
      expect(deleted).toEqual({ status: 'deleted' });
      expect(deletedCharacter).toEqual({ error: "Character 'Bob' not found" });
      expect(knowsAfterDelete).toEqual([]);
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('returns bounded errors for missing entities on create, update, and delete flows', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Character', 'Alice', { role: 'lead' });

      await expect(engine.createRelation('Missing', 'Alice', 'KNOWS')).resolves.toEqual({
        error: "Entity 'Missing' not found",
      });
      await expect(engine.updateEntity('Missing', { role: 'ghost' })).resolves.toEqual({
        error: "Entity 'Missing' not found",
      });
      await expect(engine.deleteEntity('Missing')).resolves.toEqual({
        error: "Entity 'Missing' not found",
      });
      await expect(engine.searchEntitiesByName('Character', '', 5)).resolves.toEqual([]);
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('applies executeCypher guards and bounded typed-node query semantics', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Event', 'Bridge Alarm', {
        severity: 'high',
        zone: 'north',
      });
      await engine.createEntity('Event', 'Harbor Bell', {
        severity: 'low',
        zone: 'south',
      });

      const invalidInput = await engine.executeCypher(42 as unknown as string);
      const emptyQuery = await engine.executeCypher('   ');
      const oversizedQuery = await engine.executeCypher(
        `MATCH ${'x'.repeat(GraphEngine.MAX_CYPHER_LENGTH)}`,
      );
      const blockedCreate = await engine.executeCypher("CREATE (n:Event {name: 'Blocked'})");
      const allEvents = await engine.executeCypher('MATCH (n:Event) RETURN n');
      const filteredEvents = await engine.executeCypher(
        "MATCH (n:Event) WHERE n.severity = 'high' RETURN n",
      );

      expect(invalidInput).toEqual([{ error: 'Invalid query input' }]);
      expect(emptyQuery).toEqual([{ error: 'Query cannot be empty' }]);
      expect(oversizedQuery).toEqual([{ error: 'Query too long' }]);
      expect(blockedCreate).toEqual([{ error: 'Only MATCH queries are allowed' }]);
      expect(allEvents).toHaveLength(2);
      expect(
        allEvents.map((event) => (event.n as { name: string }).name),
      ).toEqual(
        expect.arrayContaining(['Bridge Alarm', 'Harbor Bell']),
      );
      expect(filteredEvents).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Bridge Alarm',
            type: 'Event',
            properties: { severity: 'high', zone: 'north' },
          }),
        }),
      ]);
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('supports relationship-match and traversal-like executeCypher queries', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Character', 'Alice', { role: 'lead' });
      await engine.createEntity('Character', 'Bob', { role: 'ally' });
      await engine.createEntity('Character', 'Carol', { role: 'scout' });

      await engine.createRelation('Alice', 'Bob', 'KNOWS', { since: 'chapter-1' });
      await engine.createRelation('Bob', 'Carol', 'KNOWS', { since: 'chapter-2' });

      const relationshipQuery = await engine.executeCypher(
        'MATCH (a:Character)-[r:KNOWS]->(b:Character) RETURN a, r, b',
      );
      const traversalQuery = await engine.executeCypher(
        "MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Alice' RETURN m, r",
      );

      expect(relationshipQuery).toHaveLength(2);
      expect(relationshipQuery).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({
              name: 'Alice',
              type: 'Character',
            }),
            relationship: expect.objectContaining({
              type: 'KNOWS',
              properties: { since: 'chapter-1' },
            }),
            target: expect.objectContaining({
              name: 'Bob',
              type: 'Character',
            }),
          }),
          expect.objectContaining({
            source: expect.objectContaining({
              name: 'Bob',
              type: 'Character',
            }),
            relationship: expect.objectContaining({
              type: 'KNOWS',
              properties: { since: 'chapter-2' },
            }),
            target: expect.objectContaining({
              name: 'Carol',
              type: 'Character',
            }),
          }),
        ]),
      );
      expect(traversalQuery).toHaveLength(2);
      expect(traversalQuery).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            m: expect.objectContaining({
              name: 'Bob',
              type: 'Character',
            }),
            r: [
              expect.objectContaining({
                type: 'KNOWS',
                from: 'Alice',
                to: 'Bob',
                properties: { since: 'chapter-1' },
              }),
            ],
          }),
          expect.objectContaining({
            m: expect.objectContaining({
              name: 'Carol',
              type: 'Character',
            }),
            r: [
              expect.objectContaining({
                type: 'KNOWS',
                from: 'Alice',
                to: 'Bob',
              }),
              expect.objectContaining({
                type: 'KNOWS',
                from: 'Bob',
                to: 'Carol',
                properties: { since: 'chapter-2' },
              }),
            ],
          }),
        ]),
      );
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers config-driven lifecycle, plugin, timeline, and projection compatibility branches', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'niko-graph-engine-config-'));
    const dataDir = join(tempRoot, 'data-root');
    const originalDataDir = process.env.DATA_DIR;
    const originalGraphDbPath = process.env.GRAPH_DB_PATH;

    process.env.DATA_DIR = dataDir;

    const okPlugin = {
      name: 'ok-plugin',
      load: vi.fn(async () => {}),
      healthCheck: vi.fn(async () => ({ status: 'ok' })),
    };
    const badPlugin = {
      name: 'bad-plugin',
      load: vi.fn(async () => {
        throw new Error('load failed');
      }),
      healthCheck: vi.fn(async () => {
        throw new Error('health failed');
      }),
    };

    const engine = new GraphEngine(null, [okPlugin, badPlugin, okPlugin]);
    let engineClosed = false;

    try {
      expect(engine.dbPath).toBe(join(dataDir, 'graph.db'));
      expect(engine.plugins).toHaveLength(2);

      const entity = new GraphEntity({
        id: 'entity-1',
        type: 'Character',
        name: 'Constructor Alice',
      });
      const relation = new Relation({
        id: 'relation-1',
        fromId: 'entity-1',
        toId: 'entity-2',
        type: 'KNOWS',
      });
      expect(entity).toMatchObject({
        id: 'entity-1',
        type: 'Character',
        name: 'Constructor Alice',
        properties: {},
      });
      expect(relation).toMatchObject({
        id: 'relation-1',
        fromId: 'entity-1',
        toId: 'entity-2',
        type: 'KNOWS',
        properties: {},
      });

      const adapters = (engine as unknown as {
        _integrationAdapters: {
          flags: { neo4jEnabled: boolean };
          graphProjection: {
            projectEntity: (entity: Record<string, unknown>) => Promise<void>;
            projectRelation: (relation: Record<string, unknown>) => Promise<void>;
          };
        };
        _normalizeCypherLimit: (limitValue?: string) => number | null;
        _parseProperties: (raw: unknown) => Record<string, unknown>;
      })._integrationAdapters;

      await adapters.graphProjection.projectEntity({ id: 'stub-entity' });
      await adapters.graphProjection.projectRelation({ id: 'stub-relation' });

      await engine.initialize();

      expect(okPlugin.load).toHaveBeenCalledTimes(1);
      expect(badPlugin.load).toHaveBeenCalledTimes(1);

      const healthWhileOpen = await engine.healthCheck();
      expect(healthWhileOpen).toMatchObject({
        db_ok: true,
        plugins: {
          'ok-plugin': { status: 'ok' },
          'bad-plugin': { status: 'error', error: 'Error: health failed' },
        },
      });

      const projectionHarness = engine as unknown as {
        _integrationAdapters: {
          flags: { neo4jEnabled: boolean };
          graphProjection: {
            projectEntity: ReturnType<typeof vi.fn>;
            projectRelation: ReturnType<typeof vi.fn>;
          };
        };
        _normalizeCypherLimit: (limitValue?: string) => number | null;
        _parseProperties: (raw: unknown) => Record<string, unknown>;
      };

      projectionHarness._integrationAdapters.flags.neo4jEnabled = true;
      projectionHarness._integrationAdapters.graphProjection = {
        projectEntity: vi.fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('entity projection down'))
          .mockResolvedValue(undefined),
        projectRelation: vi.fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('relation projection down'))
          .mockResolvedValue(undefined),
      };

      const invalidType = await engine.createEntity('Unknown', 'Invalid Entity', {});
      await engine.createEntity('Character', 'Alice', { role: 'lead' });
      await engine.createEntity('Event', 'Bridge Alarm', { time: 2, severity: 'high' });
      await engine.createEntity('Character', 'Bob', { role: 'ally' });
      await engine.createEntity('Location', 'Watchtower', { zone: 'north' });
      await engine.createEntity('Foreshadow', 'Signal Fire', { planted_chapter: 9 });

      const eventRelation = await engine.createRelation('Alice', 'Bridge Alarm', 'PARTICIPATES', {
        chapter: 2,
      });
      const knowsRelation = await engine.createRelation('Alice', 'Bob', 'KNOWS', {
        since: 'chapter-3',
      });

      const timelineCharacter = await engine.getCharacter('Alice', true, true);
      const limitedRelationshipQuery = await engine.executeCypher(
        'MATCH (a)-[r:KNOWS]->(b) RETURN a, r, b LIMIT 1',
      );
      const emptyTraversal = await engine.executeCypher(
        "MATCH (n)-[r*1..1]-(m) WHERE n.name CONTAINS 'Nobody' RETURN m, r",
      );
      const limitedTraversal = await engine.executeCypher(
        "MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Alice' RETURN m, r LIMIT 1",
      );
      const explodingLimitResults = await engine.searchEntitiesByName(
        'Character',
        'A%',
        {
          valueOf(): number {
            throw new Error('limit explode');
          },
        } as unknown as number,
      );
      const oversizedPatternResults = await engine.searchEntitiesByName(
        'Character',
        'A'.repeat(GraphEngine.MAX_NAME_PATTERN_LENGTH + 1),
        5,
      );

      expect(invalidType).toEqual({ error: 'Invalid entity type: Unknown' });
      expect(eventRelation).toMatchObject({ status: 'created' });
      expect(knowsRelation).toMatchObject({ status: 'created' });
      expect(timelineCharacter).toMatchObject({
        name: 'Alice',
        relations: expect.arrayContaining([
          expect.objectContaining({
            type: 'KNOWS',
            to: 'Bob',
          }),
        ]),
        timeline: [
          expect.objectContaining({
            event: 'Bridge Alarm',
            relation: 'PARTICIPATES',
            properties: { severity: 'high', time: 2 },
          }),
        ],
      });
      expect(limitedRelationshipQuery).toHaveLength(1);
      expect(limitedRelationshipQuery[0]).toMatchObject({
        relationship: {
          type: 'KNOWS',
        },
      });
      expect(emptyTraversal).toEqual([]);
      expect(limitedTraversal).toHaveLength(1);
      expect(explodingLimitResults).toEqual([
        expect.objectContaining({
          name: 'Alice',
        }),
      ]);
      expect(oversizedPatternResults).toEqual([]);
      expect(await engine.getRelationships('Missing')).toEqual([]);
      expect(await engine.getForeshadows('', null)).toEqual([
        expect.objectContaining({
          name: 'Signal Fire',
        }),
      ]);
      expect(projectionHarness._normalizeCypherLimit()).toBeNull();
      expect(projectionHarness._normalizeCypherLimit('0')).toBeNull();
      expect(projectionHarness._normalizeCypherLimit('999')).toBe(200);
      expect(projectionHarness._parseProperties({ role: 'lead' })).toEqual({ role: 'lead' });
      expect(projectionHarness._parseProperties('not-json')).toEqual({});

      process.env.GRAPH_DB_PATH = join(tempRoot, 'configured-graph.db');
      const configured = GraphEngine.fromConfig([okPlugin]);
      try {
        expect(configured.dbPath).toBe(process.env.GRAPH_DB_PATH);
      } finally {
        configured.close();
      }

      engine.close();
      engineClosed = true;

      const healthAfterClose = await engine.healthCheck();
      expect(healthAfterClose).toMatchObject({
        db_ok: false,
        plugins: {
          'ok-plugin': { status: 'ok' },
          'bad-plugin': { status: 'error', error: 'Error: health failed' },
        },
      });
      expect(String(healthAfterClose.error)).toContain('database connection is not open');
    } finally {
      if (!engineClosed) {
        engine.close();
      }
      if (originalDataDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = originalDataDir;
      }
      if (originalGraphDbPath === undefined) {
        delete process.env.GRAPH_DB_PATH;
      } else {
        process.env.GRAPH_DB_PATH = originalGraphDbPath;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
