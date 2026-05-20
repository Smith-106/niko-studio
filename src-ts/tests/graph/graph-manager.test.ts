import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CypherParser,
  Entity,
  EntityType,
  GraphManager,
  RelationType,
  Relationship,
  SubGraph,
} from '../../graph/graph-manager';

function createDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-graph-manager-'));
  return join(dir, 'graph-manager.db');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('graph/graph-manager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('supports bounded CRUD, query, stats, and shortest-path behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const aliceId = manager.createEntity(new Entity({
        id: 'char-alice',
        name: 'Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'lead' },
      }));
      const bobId = manager.createEntity(new Entity({
        id: 'char-bob',
        name: 'Bob',
        type: EntityType.CHARACTER,
        properties: { role: 'ally' },
      }));
      const keyId = manager.createEntity(new Entity({
        id: 'item-key',
        name: 'Silver Key',
        type: EntityType.ITEM,
        properties: { chapter: 1 },
      }));

      const relationId = manager.createRelationship({
        id: 'rel-a-b',
        source_id: aliceId,
        target_id: bobId,
        type: RelationType.KNOWS,
        properties: { since: 'chapter-1' },
      });
      manager.createRelationship({
        id: 'rel-b-key',
        source_id: bobId,
        target_id: keyId,
        type: RelationType.OWNS,
        properties: {},
      });

      const entity = manager.getEntity(aliceId);
      const query = manager.runCypher("MATCH (n:Character) WHERE n.name = 'Alice' RETURN n");
      const related = manager.findRelatedEntities(aliceId, 2, 10);
      const stats = manager.getEntityStats();
      const path = manager.findShortestPath(aliceId, keyId);

      expect(relationId).toBe('rel-a-b');
      expect(entity).toMatchObject({
        id: 'char-alice',
        name: 'Alice',
        type: EntityType.CHARACTER,
      });
      expect(query).toHaveLength(1);
      expect(query[0]).toMatchObject({
        n: {
          name: 'Alice',
        },
      });
      expect(related.map((item) => item.id)).toEqual(expect.arrayContaining([bobId, keyId]));
      expect(stats).toMatchObject({
        total_entities: 3,
        total_relationships: 2,
      });
      expect(path).not.toBeNull();
      expect(path?.nodes.map((node) => node.id)).toEqual([aliceId, bobId, keyId]);
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('supports the remaining update, relationship, search, and delete tail behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const aliceId = manager.createEntity(new Entity({
        id: 'char-alice-tail',
        name: 'Alice Tail',
        type: EntityType.CHARACTER,
        properties: { role: 'lead' },
      }));
      const bobId = manager.createEntity(new Entity({
        id: 'char-bob-tail',
        name: 'Bob Tail',
        type: EntityType.CHARACTER,
        properties: { role: 'ally' },
      }));
      const towerId = manager.createEntity(new Entity({
        id: 'loc-watchtower',
        name: 'Watchtower',
        type: EntityType.LOCATION,
        properties: { chapter: 3 },
      }));

      const knowsId = manager.createRelationship({
        id: 'rel-tail-knows',
        source_id: aliceId,
        target_id: bobId,
        type: RelationType.KNOWS,
        properties: { since: 'chapter-1' },
      });
      const locatedId = manager.createRelationship({
        id: 'rel-tail-located',
        source_id: bobId,
        target_id: towerId,
        type: RelationType.LOCATED_IN,
        properties: { chapter: 3 },
      });

      const updated = manager.updateEntity(new Entity({
        id: aliceId,
        name: 'Captain Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'captain', rank: 'senior' },
      }));
      const missingUpdate = manager.updateEntity(new Entity({
        id: 'missing-entity',
        name: 'Missing Entity',
        type: EntityType.CONCEPT,
        properties: {},
      }));
      const outbound = manager.getRelationships(aliceId, 'out');
      const inbound = manager.getRelationships(bobId, 'in');
      const both = manager.getRelationships(bobId, 'both');
      const search = manager.searchEntities('Captain', EntityType.CHARACTER, 5);
      const deletedRelationship = manager.deleteRelationship(knowsId);
      const outboundAfterDelete = manager.getRelationships(aliceId, 'out');
      const deletedEntity = manager.deleteEntity(bobId);
      const deletedEntityLookup = manager.getEntity(bobId);
      const towerInboundAfterDelete = manager.getRelationships(towerId, 'in');
      const missingDelete = manager.deleteEntity('missing-entity');

      expect(updated).toBe(true);
      expect(missingUpdate).toBe(false);
      expect(manager.getEntity(aliceId)).toMatchObject({
        id: aliceId,
        name: 'Captain Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'captain', rank: 'senior' },
      });
      expect(outbound.map((item) => item.id)).toEqual([knowsId]);
      expect(inbound.map((item) => item.id)).toEqual([knowsId]);
      expect(both.map((item) => item.id).sort()).toEqual([knowsId, locatedId].sort());
      expect(search.map((item) => item.id)).toContain(aliceId);
      expect(deletedRelationship).toBe(true);
      expect(manager.deleteRelationship(knowsId)).toBe(false);
      expect(outboundAfterDelete).toEqual([]);
      expect(deletedEntity).toBe(true);
      expect(deletedEntityLookup).toBeNull();
      expect(towerInboundAfterDelete).toEqual([]);
      expect(missingDelete).toBe(false);
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('supports shortest-path edge cases and subgraph compatibility behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const aliceId = manager.createEntity(new Entity({
        id: 'char-algo-alice',
        name: 'Algo Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'lead' },
      }));
      const bobId = manager.createEntity(new Entity({
        id: 'char-algo-bob',
        name: 'Algo Bob',
        type: EntityType.CHARACTER,
        properties: { role: 'ally' },
      }));
      const towerId = manager.createEntity(new Entity({
        id: 'loc-algo-tower',
        name: 'North Tower',
        type: EntityType.LOCATION,
        properties: { zone: 'north' },
      }));
      const ghostId = manager.createEntity(new Entity({
        id: 'char-algo-ghost',
        name: 'Ghost',
        type: EntityType.CHARACTER,
        properties: { role: 'isolated' },
      }));

      manager.createRelationship({
        id: 'rel-algo-a-b',
        source_id: aliceId,
        target_id: bobId,
        type: RelationType.KNOWS,
        properties: {},
      });
      manager.createRelationship({
        id: 'rel-algo-b-t',
        source_id: bobId,
        target_id: towerId,
        type: RelationType.LOCATED_IN,
        properties: {},
      });

      const selfPath = manager.findShortestPath(aliceId, aliceId);
      const missingPath = manager.findShortestPath(aliceId, ghostId);
      const radiusOne = manager.getSubGraph(aliceId, 1);
      const radiusTwoCompat = manager.getSubgraph(aliceId, 2);

      expect(selfPath).not.toBeNull();
      expect(selfPath?.nodes.map((node) => node.id)).toEqual([aliceId]);
      expect(selfPath?.edges).toEqual([]);
      expect(selfPath?.total_weight).toBe(0);
      expect(missingPath).toBeNull();
      expect(radiusOne.center_entity_id).toBe(aliceId);
      expect(radiusOne.entities.map((entity) => entity.id).sort()).toEqual([aliceId, bobId].sort());
      expect(radiusOne.relationships.map((relationship) => relationship.id)).toEqual(['rel-algo-a-b']);
      expect(radiusTwoCompat.entities.map((entity) => entity.id).sort()).toEqual(
        [aliceId, bobId, towerId].sort(),
      );
      expect(radiusTwoCompat.relationships.map((relationship) => relationship.id).sort()).toEqual(
        ['rel-algo-a-b', 'rel-algo-b-t'].sort(),
      );
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('supports deeper CREATE, property-filter, and relationship-match cypher behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const createdCharacters = manager.runCypher(
        "CREATE (n:Character {name: 'Cypher Alice', role: 'scout'})",
      );
      const createdEvents = manager.runCypher(
        "CREATE (n:Event {name: 'Bridge Alarm', summary: 'alarm on the north bridge'})",
      );
      const aliceQuery = manager.runCypher(
        "MATCH (n:Character) WHERE n.role CONTAINS 'cout' RETURN n",
      );

      const alice = aliceQuery[0]?.n as { id: string; name: string } | undefined;
      const bobId = manager.createEntity(new Entity({
        id: 'char-cypher-bob',
        name: 'Cypher Bob',
        type: EntityType.CHARACTER,
        properties: { role: 'guard' },
      }));
      const bridgeId = manager.createEntity(new Entity({
        id: 'loc-cypher-bridge',
        name: 'North Bridge',
        type: EntityType.LOCATION,
        properties: { zone: 'north' },
      }));

      manager.createRelationship({
        id: 'rel-cypher-bob-bridge',
        source_id: bobId,
        target_id: bridgeId,
        type: RelationType.LOCATED_IN,
        properties: { chapter: 4 },
      });

      const relationshipQuery = manager.runCypher(
        'MATCH (a:Character)-[r:LOCATED_IN]->(b:Location) RETURN a, r, b LIMIT 5',
      );

      expect(createdCharacters).toHaveLength(1);
      expect(createdCharacters[0]).toHaveProperty('created');
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0]).toHaveProperty('created');
      expect(alice).toMatchObject({
        name: 'Cypher Alice',
      });
      expect(relationshipQuery).toHaveLength(1);
      expect(relationshipQuery[0]).toMatchObject({
        source: {
          name: 'Cypher Bob',
          type: 'character',
        },
        relationship: {
          type: 'LOCATED_IN',
          properties: { chapter: 4 },
        },
        target: {
          name: 'North Bridge',
          type: 'location',
        },
      });
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('supports legacy addEntity and addRelation aliases for compatibility', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const aliceId = manager.addEntity(new Entity({
        id: 'char-legacy-alice',
        name: 'Legacy Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'lead' },
      }));
      const bobId = manager.addEntity(new Entity({
        id: 'char-legacy-bob',
        name: 'Legacy Bob',
        type: EntityType.CHARACTER,
        properties: { role: 'ally' },
      }));
      const relationId = manager.addRelation(new Relationship({
        id: 'rel-legacy-knows',
        source_id: aliceId,
        target_id: bobId,
        type: RelationType.KNOWS,
        properties: { since: 'chapter-5' },
      }));

      expect(aliceId).toBe('char-legacy-alice');
      expect(bobId).toBe('char-legacy-bob');
      expect(relationId).toBe('rel-legacy-knows');
      expect(manager.getEntity(aliceId)).toMatchObject({
        name: 'Legacy Alice',
      });
      expect(manager.getRelationships(aliceId, 'out')).toEqual([
        expect.objectContaining({
          id: 'rel-legacy-knows',
          type: RelationType.KNOWS,
        }),
      ]);
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers parser type detection and raw SQL fallback behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      manager.createEntity(new Entity({
        id: 'char-sql-alice',
        name: 'SQL Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'analyst' },
      }));

      expect(CypherParser.parse('DELETE n')).toMatchObject({ type: 'DELETE' });
      expect(CypherParser.parse('SET n.name = "Shifted"')).toMatchObject({ type: 'SET' });
      expect(CypherParser.parse('SELECT id FROM entities')).toMatchObject({ type: 'UNKNOWN' });

      const sqlRead = manager.runCypher('SELECT id, name FROM entities ORDER BY name LIMIT 1');
      const sqlWrite = manager.runCypher(
        "UPDATE entities SET name = 'SQL Captain' WHERE id = 'char-sql-alice'",
      );
      const sqlError = manager.runCypher('SELECT * FROM missing_graph_table');

      expect(sqlRead).toEqual([
        {
          id: 'char-sql-alice',
          name: 'SQL Alice',
        },
      ]);
      expect(sqlWrite).toEqual([{ affected_rows: 1 }]);
      expect(manager.getEntity('char-sql-alice')).toMatchObject({
        name: 'SQL Captain',
      });
      expect(sqlError).toHaveLength(1);
      expect(sqlError[0]).toMatchObject({
        error: expect.stringContaining('missing_graph_table'),
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Cypher execution error"'),
      );
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers traversal edge limits and LIKE-search fallback behavior', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const aliceId = manager.createEntity(new Entity({
        id: 'char-fallback-alice',
        name: 'Fallback Alice',
        type: EntityType.CHARACTER,
        properties: { role: 'lead', codename: 'north-star' },
      }));
      const bobId = manager.createEntity(new Entity({
        id: 'char-fallback-bob',
        name: 'Fallback Bob',
        type: EntityType.CHARACTER,
        properties: { role: 'ally' },
      }));
      manager.createRelationship({
        id: 'rel-fallback-knows',
        source_id: aliceId,
        target_id: bobId,
        type: RelationType.KNOWS,
        properties: { since: 'chapter-6' },
      });

      expect(manager.findRelatedEntities(aliceId, 0, 10)).toEqual([]);
      expect(manager.findRelatedEntities(aliceId, 2, 0)).toEqual([]);

      const conn = (manager as unknown as {
        _conn: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] } };
      })._conn;
      const originalPrepare = conn.prepare.bind(conn);
      vi.spyOn(conn, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('JOIN entities_fts')) {
          throw new Error('fts unavailable');
        }
        return originalPrepare(sql);
      });

      const fallbackResults = manager.searchEntities('Fallback', EntityType.CHARACTER, 5);

      expect(fallbackResults).toHaveLength(2);
      expect(fallbackResults.map((entity) => entity.id)).toEqual(
        expect.arrayContaining([aliceId, bobId]),
      );
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers parser conversions and internal fallback branches', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const initialStats = manager.getEntityStats();
      expect(initialStats.avg_connections_per_entity).toBe(0);
      expect(manager.getEntitiesBatch([])).toEqual({});

      const parsedWithLeftArrow = CypherParser.parse(
        'MATCH (a:Character)<-[r:KNOWS]->(b:Character) RETURN a, r, b LIMIT 2',
      );
      expect(parsedWithLeftArrow.relationships).toEqual([
        expect.objectContaining({
          direction: 'left',
          type: 'KNOWS',
        }),
      ]);
      expect(CypherParser._parseProps('')).toEqual({});
      expect(CypherParser._parseProps("count: 42, ratio: 1.5, ok: true, bad: false, note: 'alpha'"))
        .toEqual({
          count: 42,
          ratio: 1.5,
          ok: true,
          bad: false,
          note: 'alpha',
        });

      const noIdEntity = new Entity({
        id: '',
        name: 'No Id Entity',
        type: EntityType.CHARACTER,
      });
      const generatedEntityId = manager.createEntity(noIdEntity);
      expect(generatedEntityId).toBeTruthy();

      const createdWithoutName = manager.runCypher('CREATE (n:Mystery)');
      const createdWithoutLabel = manager.runCypher('CREATE (n)');
      const createHarness = manager as unknown as {
        _executeCreate: (parsed: Record<string, unknown>, original: string) => Record<string, unknown>[];
      };
      const fallbackLabelResult = createHarness._executeCreate(
        {
          nodes: [
            {
              label: {
                toLowerCase(): string {
                  throw new Error('label explode');
                },
              },
              properties: { name: 'Fallback Label Entity' },
            },
          ],
        },
        'CREATE (n)',
      );
      const fallbackNodePropsResult = createHarness._executeCreate(
        {
          nodes: [
            {
              label: 'Character',
            },
          ],
        },
        'CREATE (n:Character)',
      );
      const createdNoNameId = createdWithoutName[0]?.created as string;
      const createdNoNameEntity = createdNoNameId ? manager.getEntity(createdNoNameId) : null;
      const fallbackLabelCreatedId = fallbackLabelResult[0]?.created as string | undefined;
      const fallbackLabelEntity = fallbackLabelCreatedId ? manager.getEntity(fallbackLabelCreatedId) : null;
      const fallbackNodePropsCreatedId = fallbackNodePropsResult[0]?.created as string | undefined;
      const fallbackNodePropsEntity = fallbackNodePropsCreatedId ? manager.getEntity(fallbackNodePropsCreatedId) : null;

      expect(createdWithoutLabel).toEqual([]);
      expect(fallbackLabelResult).toHaveLength(1);
      expect(fallbackLabelEntity).toMatchObject({
        type: EntityType.CONCEPT,
        name: 'Fallback Label Entity',
      });
      expect(fallbackNodePropsResult).toHaveLength(1);
      expect(fallbackNodePropsEntity).toMatchObject({
        type: EntityType.CHARACTER,
      });
      expect(fallbackNodePropsEntity?.name).toContain('Entity_');

      const constrainedMatch = manager.runCypher(
        `MATCH (n:Character) WHERE n.id = '${generatedEntityId}' AND n.type = 'character' RETURN n LIMIT 1`,
      );
      expect(constrainedMatch).toEqual([
        {
          n: expect.objectContaining({
            id: generatedEntityId,
            type: EntityType.CHARACTER,
          }),
        },
      ]);

      const sourceWithNullProps = 'raw-null-props-source';
      const targetWithNullProps = 'raw-null-props-target';
      manager.runCypher(
        `INSERT INTO entities (id, name, type, properties, created_at, updated_at) VALUES ('${sourceWithNullProps}', 'Raw Source', 'unknown_type', NULL, NULL, NULL)`,
      );
      manager.runCypher(
        `INSERT INTO entities (id, name, type, properties, created_at, updated_at) VALUES ('${targetWithNullProps}', 'Raw Target', 'character', NULL, NULL, NULL)`,
      );
      manager.runCypher(
        `INSERT INTO relationships (id, source_id, target_id, type, properties, weight, created_at) VALUES ('raw-broken-rel', '${sourceWithNullProps}', '${targetWithNullProps}', 'BROKEN_REL', NULL, NULL, NULL)`,
      );

      const rawEntity = manager.getEntity(sourceWithNullProps);
      const rawRelationships = manager.getRelationships(sourceWithNullProps, 'out');
      const rawPathToSelf = manager.findShortestPath(sourceWithNullProps, sourceWithNullProps);
      const fallbackSubgraph = manager.getSubGraph(sourceWithNullProps, 2);

      expect(createdWithoutName).toHaveLength(1);
      expect(createdNoNameEntity).toMatchObject({
        type: EntityType.CONCEPT,
      });
      expect(createdNoNameEntity?.name).toContain('Entity_');
      expect(rawEntity).toMatchObject({
        id: sourceWithNullProps,
        type: EntityType.CONCEPT,
        properties: {},
      });
      expect(rawRelationships).toEqual([
        expect.objectContaining({
          id: 'raw-broken-rel',
          type: RelationType.RELATED_TO,
          properties: {},
          weight: 1,
        }),
      ]);
      expect(rawPathToSelf).toMatchObject({
        nodes: [expect.objectContaining({ id: sourceWithNullProps })],
        edges: [],
        total_weight: 0,
      });
      expect(fallbackSubgraph.entities.map((entity) => entity.id)).toEqual(
        expect.arrayContaining([sourceWithNullProps, targetWithNullProps]),
      );

      const entityToDict = (manager as unknown as {
        _entityToDict: (entity: Entity) => Record<string, unknown>;
      })._entityToDict;
      const nullTimeEntityDict = entityToDict(new Entity({
        id: 'null-time',
        name: 'Null Time',
        type: EntityType.CONCEPT,
        properties: {},
        created_at: null,
        updated_at: null,
      }));
      expect(nullTimeEntityDict).toMatchObject({
        created_at: null,
        updated_at: null,
      });

      const sourceA = manager.createEntity(new Entity({
        id: 'limit-source-a',
        name: 'Limit Source A',
        type: EntityType.CHARACTER,
      }));
      const sourceB = manager.createEntity(new Entity({
        id: 'limit-source-b',
        name: 'Limit Source B',
        type: EntityType.CHARACTER,
      }));
      const commonNeighbor = manager.createEntity(new Entity({
        id: 'limit-neighbor',
        name: 'Limit Neighbor',
        type: EntityType.CHARACTER,
      }));
      manager.createRelationship(new Relationship({
        id: '',
        source_id: sourceA,
        target_id: commonNeighbor,
        type: RelationType.KNOWS,
      }));
      manager.createRelationship(new Relationship({
        id: '',
        source_id: sourceB,
        target_id: commonNeighbor,
        type: RelationType.KNOWS,
      }));

      const limitedRelated = manager.findRelatedEntities(sourceA, 3, 1);
      expect(limitedRelated).toHaveLength(1);

      const isolatedId = manager.createEntity(new Entity({
        id: 'isolated-node',
        name: 'Isolated Node',
        type: EntityType.CHARACTER,
      }));
      expect(manager.findRelatedEntities(isolatedId, 2, 5)).toEqual([]);

      const rootId = manager.createEntity(new Entity({
        id: 'dup-root',
        name: 'Duplicate Root',
        type: EntityType.CHARACTER,
      }));
      const leftId = manager.createEntity(new Entity({
        id: 'dup-left',
        name: 'Duplicate Left',
        type: EntityType.CHARACTER,
      }));
      const rightId = manager.createEntity(new Entity({
        id: 'dup-right',
        name: 'Duplicate Right',
        type: EntityType.CHARACTER,
      }));
      const leafId = manager.createEntity(new Entity({
        id: 'dup-leaf',
        name: 'Duplicate Leaf',
        type: EntityType.CHARACTER,
      }));
      manager.createRelationship(new Relationship({
        id: 'dup-r-l',
        source_id: rootId,
        target_id: leftId,
        type: RelationType.KNOWS,
      }));
      manager.createRelationship(new Relationship({
        id: 'dup-r-r',
        source_id: rootId,
        target_id: rightId,
        type: RelationType.KNOWS,
      }));
      manager.createRelationship(new Relationship({
        id: 'dup-l-leaf',
        source_id: leftId,
        target_id: leafId,
        type: RelationType.KNOWS,
      }));
      manager.createRelationship(new Relationship({
        id: 'dup-r-leaf',
        source_id: rightId,
        target_id: leafId,
        type: RelationType.KNOWS,
      }));
      const duplicateTraversalSubgraph = manager.getSubGraph(rootId, 3);
      expect(duplicateTraversalSubgraph.entities.map((entity) => entity.id)).toEqual(
        expect.arrayContaining([rootId, leftId, rightId, leafId]),
      );
      expect(duplicateTraversalSubgraph.relationships.map((relationship) => relationship.id).sort()).toEqual(
        ['dup-l-leaf', 'dup-r-l', 'dup-r-leaf', 'dup-r-r'].sort(),
      );

      const rowToEntity = (manager as unknown as {
        _rowToEntity: (row: Record<string, unknown>) => Entity;
      })._rowToEntity;
      const throwingDate = {
        toString(): string {
          throw new Error('invalid date coercion');
        },
      };
      const invalidDateEntity = rowToEntity({
        id: 'invalid-date',
        name: 'Invalid Date',
        type: 'character',
        properties: null,
        created_at: throwingDate,
        updated_at: throwingDate,
      });
      expect(invalidDateEntity).toMatchObject({
        id: 'invalid-date',
        type: EntityType.CHARACTER,
        properties: {},
        created_at: null,
        updated_at: null,
      });
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers where-property compare and lifecycle compatibility branches', () => {
    const dbPath = createDbPath();
    const manager = new GraphManager(dbPath);

    try {
      const defaultSubGraph = new SubGraph({
        entities: [],
        relationships: [],
      });
      expect(defaultSubGraph.center_entity_id).toBeNull();

      const defaultPathManager = new GraphManager(null);
      try {
        expect(defaultPathManager.db_path).toContain('graph_manager.db');
      } finally {
        defaultPathManager.close();
        rmSync(join(defaultPathManager.db_path, '..'), { recursive: true, force: true });
      }

      const sourceId = manager.createEntity(new Entity({
        id: 'compare-source',
        name: 'Compare Source',
        type: EntityType.CHARACTER,
        properties: { chapter: '4' },
      }));
      const targetId = manager.createEntity(new Entity({
        id: 'compare-target',
        name: 'Compare Target',
        type: EntityType.CHARACTER,
        properties: { chapter: '8' },
      }));
      manager.createRelationship(new Relationship({
        id: 'compare-rel',
        source_id: sourceId,
        target_id: targetId,
        type: RelationType.KNOWS,
      }));

      const comparable = manager.runCypher(
        "MATCH (n:Character) WHERE n.chapter = '4' RETURN n",
      );
      const aliasLessMatch = manager.runCypher('MATCH (:Character) RETURN n LIMIT 1');
      const relationshipNullPropsQuery = manager.runCypher(
        'MATCH (a:Character)-[r:BROKEN_REL]->(b:Character) RETURN a, r, b LIMIT 1',
      );
      const missingSelfPath = manager.findShortestPath('missing-node', 'missing-node');

      expect(comparable).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({ id: sourceId }),
        }),
      ]);
      expect(aliasLessMatch).toHaveLength(1);
      expect(aliasLessMatch[0]).toHaveProperty('n');
      expect(relationshipNullPropsQuery).toEqual([]);
      expect(missingSelfPath).toBeNull();

      manager.runCypher(
        `INSERT INTO entities (id, name, type, properties, created_at, updated_at) VALUES ('compare-source-null', 'Compare Source Null', 'character', NULL, NULL, NULL)`,
      );
      manager.runCypher(
        `INSERT INTO entities (id, name, type, properties, created_at, updated_at) VALUES ('compare-target-null', 'Compare Target Null', 'character', NULL, NULL, NULL)`,
      );
      manager.runCypher(
        `INSERT INTO relationships (id, source_id, target_id, type, properties, weight, created_at) VALUES ('compare-rel-null', 'compare-source-null', 'compare-target-null', 'BROKEN_REL', NULL, NULL, NULL)`,
      );

      const relationshipWithNullPropsQuery = manager.runCypher(
        'MATCH (a:Character)-[r:BROKEN_REL]->(b:Character) RETURN a, r, b LIMIT 1',
      );
      expect(relationshipWithNullPropsQuery).toEqual([
        expect.objectContaining({
          source: expect.objectContaining({
            id: 'compare-source-null',
            properties: {},
          }),
          relationship: expect.objectContaining({
            id: 'compare-rel-null',
            properties: {},
          }),
          target: expect.objectContaining({
            id: 'compare-target-null',
            properties: {},
          }),
        }),
      ]);

      manager[Symbol.dispose]();
      const managerAfterDispose = manager as unknown as { _conn: unknown };
      expect(managerAfterDispose._conn).toBeNull();
    } finally {
      manager.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });
});
