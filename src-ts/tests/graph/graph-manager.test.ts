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
        expect.stringContaining('Cypher execution error:'),
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
});
