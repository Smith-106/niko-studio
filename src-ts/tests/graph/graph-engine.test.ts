import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigManager } from '../../config';
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
  beforeEach(() => {
    ConfigManager.resetInstance();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
      expect(blockedCreate).toEqual([{ error: 'Only MATCH queries and scoped MERGE mutations are allowed' }]);
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
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Blocked non-string graph query input"'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Blocked oversized graph query"'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Blocked graph query outside MATCH/MERGE subset"'),
      );
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

  it('supports scoped MERGE mutations for persisted authoring and survives reloads', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      const createResult = await engine.executeCypher(
        `MERGE (n:Character ${JSON.stringify({ name: 'Alice', workspaceId: 'atlas-workspace' })}) SET ${JSON.stringify({
          name: 'Alice',
          description: 'Archive captain',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          itemKind: 'character',
        })} RETURN n`,
      );

      const updateResult = await engine.executeCypher(
        `MERGE (n:Character ${JSON.stringify({ name: 'Alice', workspaceId: 'atlas-workspace' })}) SET ${JSON.stringify({
          name: 'Alicia',
          description: 'Updated archive captain',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          itemKind: 'character',
        })} RETURN n`,
      );

      expect(createResult).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Alice',
            type: 'Character',
            properties: expect.objectContaining({
              description: 'Archive captain',
              workspaceId: 'atlas-workspace',
              projectId: 'atlas-project',
              itemKind: 'character',
            }),
          }),
        }),
      ]);

      expect(updateResult).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Alicia',
            type: 'Character',
            properties: expect.objectContaining({
              description: 'Updated archive captain',
              workspaceId: 'atlas-workspace',
              projectId: 'atlas-project',
              itemKind: 'character',
            }),
          }),
        }),
      ]);

      engine.close();
      const reopened = new GraphEngine(dbPath);
      try {
        const persistedRows = await reopened.executeCypher('MATCH (n:Character) RETURN n');
        expect(persistedRows).toEqual([
          expect.objectContaining({
            n: expect.objectContaining({
              name: 'Alicia',
              type: 'Character',
              properties: expect.objectContaining({
                description: 'Updated archive captain',
                workspaceId: 'atlas-workspace',
                projectId: 'atlas-project',
              }),
            }),
          }),
        ]);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers config-driven lifecycle, plugin, timeline, and projection compatibility branches', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'niko-graph-engine-config-'));
    const dataDir = join(tempRoot, 'data-root');
    const originalDataDir = process.env.DATA_DIR;
    const originalNikoDataDir = process.env.NIKO_DATA_DIR;
    const originalGraphDbPath = process.env.GRAPH_DB_PATH;
    const originalNikoGraphDbPath = process.env.NIKO_GRAPH_DB_PATH;
    const originalNikoNeo4jEnabled = process.env.NIKO_NEO4J_ENABLED;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    process.env.DATA_DIR = dataDir;
    process.env.NIKO_DATA_DIR = dataDir;
    process.env.NIKO_NEO4J_ENABLED = 'true';

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
          requestedFlags: { neo4jEnabled: boolean };
          capabilities: {
            neo4jEnabled: {
              support_level: string;
              requested: boolean;
              enabled: boolean;
            };
          };
          graphProjection: {
            projectEntity: (entity: Record<string, unknown>) => Promise<void>;
            projectRelation: (relation: Record<string, unknown>) => Promise<void>;
          };
        };
        _normalizeCypherLimit: (limitValue?: string) => number | null;
        _parseProperties: (raw: unknown) => Record<string, unknown>;
      })._integrationAdapters;

      expect(adapters.flags.neo4jEnabled).toBe(false);
      expect(adapters.requestedFlags.neo4jEnabled).toBe(true);
      expect(adapters.capabilities.neo4jEnabled).toMatchObject({
        support_level: 'disabled',
        requested: true,
        enabled: false,
      });
      await adapters.graphProjection.projectEntity({ id: 'stub-entity' });
      await adapters.graphProjection.projectRelation({ id: 'stub-relation' });

      await engine.initialize();

      expect(okPlugin.load).toHaveBeenCalledTimes(1);
      expect(badPlugin.load).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Graph plugin load failed: bad-plugin"'),
      );

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
          requestedFlags: { neo4jEnabled: boolean };
          capabilities: {
            neo4jEnabled: {
              support_level: string;
              requested: boolean;
              enabled: boolean;
            };
          };
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
      expect(projectionHarness._parseProperties(42)).toEqual({});

      process.env.GRAPH_DB_PATH = join(tempRoot, 'configured-graph.db');
      const configured = GraphEngine.fromConfig([okPlugin]);
      try {
        expect(configured.dbPath).toBe(process.env.GRAPH_DB_PATH);
      } finally {
        configured.close();
      }

      delete process.env.GRAPH_DB_PATH;
      process.env.NIKO_GRAPH_DB_PATH = join(tempRoot, 'configured-niko-graph.db');
      const configuredFromNiko = GraphEngine.fromConfig([okPlugin]);
      try {
        expect(configuredFromNiko.dbPath).toBe(process.env.NIKO_GRAPH_DB_PATH);
      } finally {
        configuredFromNiko.close();
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
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Neo4j entity projection failed, local-first path preserved"'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Neo4j relation projection failed, local-first path preserved"'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Blocked oversized entity name pattern"'),
      );
    } finally {
      if (!engineClosed) {
        engine.close();
      }
      if (originalDataDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = originalDataDir;
      }
      if (originalNikoDataDir === undefined) {
        delete process.env.NIKO_DATA_DIR;
      } else {
        process.env.NIKO_DATA_DIR = originalNikoDataDir;
      }
      if (originalGraphDbPath === undefined) {
        delete process.env.GRAPH_DB_PATH;
      } else {
        process.env.GRAPH_DB_PATH = originalGraphDbPath;
      }
      if (originalNikoGraphDbPath === undefined) {
        delete process.env.NIKO_GRAPH_DB_PATH;
      } else {
        process.env.NIKO_GRAPH_DB_PATH = originalNikoGraphDbPath;
      }
      if (originalNikoNeo4jEnabled === undefined) {
        delete process.env.NIKO_NEO4J_ENABLED;
      } else {
        process.env.NIKO_NEO4J_ENABLED = originalNikoNeo4jEnabled;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('covers scoped reads and merge mutation parser edge branches', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Character', 'Scoped Hero', {
        workspaceId: 'scope-w1',
      });
      await engine.createEntity('Character', 'Project Scout', {
        projectId: 'scope-p1',
      });
      await engine.createEntity('Character', 'Legacy Echo', {
        role: 'legacy',
      });
      await engine.createEntity('Character', 'Other Realm', {
        workspaceId: 'scope-w2',
      });
      await engine.createEntity('Character', 'Null Props', null);
      await engine.createRelation('Scoped Hero', 'Project Scout', 'KNOWS', {
        lane: 'scope',
      });

      const strictScopedRows = await engine.executeCypher('MATCH (n:Character) RETURN n', {
        workspaceId: 'scope-w1',
        projectId: 'scope-p1',
        allowLegacy: false,
      });
      const scopedNames = strictScopedRows.map((row) => (row.n as { name: string }).name).sort();

      const legacyScopedRows = await engine.executeCypher('MATCH (n:Character) RETURN n LIMIT 3', {
        workspaceId: 'scope-w1',
        projectId: 'scope-p1',
        allowLegacy: true,
      });
      const legacyScopedNames = legacyScopedRows.map((row) => (row.n as { name: string }).name);

      const trimmedScopeRows = await engine.executeCypher(
        "MATCH (n:Character) WHERE n.name = 'Project Scout' RETURN n LIMIT 1",
        {
          workspaceId: '   ',
          projectId: '  scope-p1  ',
          allowLegacy: false,
        },
      );

      const scopedRelationRows = await engine.executeCypher(
        'MATCH (a:Character)-[r:KNOWS]->(b:Character) RETURN a, r, b LIMIT 1',
        {
          workspaceId: 'scope-w1',
          projectId: 'scope-p1',
          allowLegacy: false,
        },
      );
      const scopedTraversalRows = await engine.executeCypher(
        "MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Scoped' RETURN m, r LIMIT 1",
        {
          workspaceId: 'scope-w1',
          projectId: 'scope-p1',
          allowLegacy: false,
        },
      );
      const relationshipWithoutTypeRows = await engine.executeCypher(
        'MATCH (a:Character)-[r]->(b:Character) RETURN a, r, b LIMIT 2',
      );
      const traversalDepthFallbackRows = await (engine as unknown as {
        _executeTraversalMatch: (
          depthValue: string,
          startNameFragment: string,
          limitValue?: string,
          scope?: unknown,
        ) => Record<string, unknown>[];
      })._executeTraversalMatch('0', 'Scoped', '10');

      const legacyBlocked = await engine.getCharacter('Legacy Echo', false, false, {
        workspaceId: 'scope-w1',
        allowLegacy: false,
      });
      const legacyAllowed = await engine.getCharacter('Legacy Echo', false, false, {
        workspaceId: 'scope-w1',
        allowLegacy: true,
      });
      const scopedForeshadows = await engine.getForeshadows('pending', null, {
        workspaceId: 'scope-w1',
        allowLegacy: false,
      });

      const missingTargetRelation = await engine.createRelation('Scoped Hero', 'Missing Target', 'KNOWS');

      const invalidMergeShape = await engine.executeCypher(
        'MERGE (n:Character {"name":"Broken"} SET {"name":"Broken"} RETURN n',
      );
      const invalidMergeType = await engine.executeCypher(
        'MERGE (n:Unknown {"name":"Broken"}) SET {"name":"Broken"} RETURN n',
      );
      const mergeMissingName = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-missing-name"}) SET {"workspaceId":"scope-w1"} RETURN n',
      );
      const mergeInvalidMatchArray = await engine.executeCypher(
        'MERGE (n:Character [{"name":"Broken"}]) SET {"name":"Broken"} RETURN n',
      );
      const mergeInvalidSetArray = await engine.executeCypher(
        'MERGE (n:Character {"name":"Broken"}) SET ["oops"] RETURN n',
      );
      const mergeWithTrailingTokens = await engine.executeCypher(
        'MERGE (n:Character {"name":"Trailing"}) SET {"name":"Trailing"} RETURN n EXTRA',
      );

      const createFromMatchName = await engine.executeCypher(
        'MERGE (n:Character {"name":"Match Only"}) SET {"description":"slash \\\\ and quote \\\"ok\\\""} RETURN n',
      );
      const createMergeById = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-id-row","name":"Row Name"}) SET {"name":"Row Name","workspaceId":"scope-w1"} RETURN n',
      );
      const updateMergeById = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-id-row"}) SET {"projectId":"scope-p1"} RETURN n',
      );
      const mergeByTypeOnly = await engine.executeCypher(
        'MERGE (n:Character {"projectId":"project-only"}) SET {"name":"Project Only"} RETURN n',
      );
      const mergeWithExtraMatchProps = await engine.executeCypher(
        'MERGE (n:Character {"name":"Scoped Hero","workspaceId":"scope-w1","projectId":"scope-p1"}) SET {"name":"Scoped Hero"} RETURN n',
      );
      const mergeWithIdMismatch = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-id-row","name":"Mismatch Name"}) SET {"name":"Mismatch Name"} RETURN n',
      );

      const parseHarness = engine as unknown as {
        _parseMergeMutation: (cypher: string) => {
          alias: string;
          entityType: string;
          matchProps: Record<string, unknown>;
          setProps: Record<string, unknown>;
        } | null;
      };
      const mergeInvalidMatchLiteral = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":42}) SET {"name":"Broken"} RETURN n',
      );
      const mergeInvalidSetLiteral = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) SET {"name":42} RETURN n',
      );
      const mergeMalformedJsonThrows = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) SET {"name": } RETURN n',
      );
      const mergeLeadingWhitespaceSetObject = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) SET   {"name":"Broken"} RETURN n',
      );
      const mergeMissingHeader = parseHarness._parseMergeMutation('MATCH (n:Character) RETURN n');
      const extractionHarness = parseHarness as unknown as {
        _extractBalancedJsonObject: (
          text: string,
          startIndex: number,
        ) => { json: string; endIndex: number } | null;
      };
      const missingOpenBraceExtraction = extractionHarness._extractBalancedJsonObject('SET ["bad"]', 0);
      const whitespaceOnlyExtraction = extractionHarness._extractBalancedJsonObject('   ', 0);
      const unclosedExtraction = extractionHarness._extractBalancedJsonObject('{"name":"broken"', 0);
      const escapedExtraction = extractionHarness._extractBalancedJsonObject(
        '{"text":"brace \\\"quoted\\\" and escaped slash \\\\ ok"}',
        0,
      );
      const mergeByIdMismatchedName = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-id-row","name":"Definitely Different"}) SET {"name":"Still Different"} RETURN n',
      );
      const mergeByIdNonexistent = await engine.executeCypher(
        'MERGE (n:Character {"id":"merge-id-nonexistent","name":"By Id Missing"}) SET {"name":"By Id Missing"} RETURN n',
      );
      const mergeWithNumericNameField = await engine.executeCypher(
        'MERGE (n:Character {"name":42}) SET {"name":"Numeric Match Name"} RETURN n',
      );
      const mergeWithNumericSetName = await engine.executeCypher(
        'MERGE (n:Character {"name":"Numeric Set Name"}) SET {"name":42} RETURN n',
      );
      const mergeWithMalformedJson = await engine.executeCypher(
        'MERGE (n:Character {"name":"Broken Json"}) SET {"name": } RETURN n',
      );
      const mergeWithMissingExtraProperty = await engine.executeCypher(
        'MERGE (n:Character {"name":"Scoped Hero","lane":"nonexistent"}) SET {"name":"Scoped Hero"} RETURN n',
      );
      const mergeWithPropertyMatch = await engine.executeCypher(
        'MERGE (n:Character {"name":"Scoped Hero","workspaceId":"scope-w1"}) SET {"name":"Scoped Hero"} RETURN n',
      );
      const relationWithNullProps = await engine.createRelation('Scoped Hero', 'Project Scout', 'ALLY', null);
      const mergeByIdResultingName = (mergeByIdMismatchedName[0]?.n as { name?: string } | undefined)?.name;

      const fallbackHomeRoot = mkdtempSync(join(tmpdir(), 'niko-graph-home-fallback-'));
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;
      const originalGraphDbPath = process.env.GRAPH_DB_PATH;
      const originalNikoGraphDbPath = process.env.NIKO_GRAPH_DB_PATH;
      const originalDataDir = process.env.DATA_DIR;
      const originalNikoDataDir = process.env.NIKO_DATA_DIR;
      const configModule = await import('../../config');
      const configSpy = vi.spyOn(configModule, 'getConfigValue').mockImplementation(() => null);
      process.env.HOME = fallbackHomeRoot;
      process.env.USERPROFILE = fallbackHomeRoot;
      delete process.env.GRAPH_DB_PATH;
      delete process.env.NIKO_GRAPH_DB_PATH;
      delete process.env.DATA_DIR;
      delete process.env.NIKO_DATA_DIR;

      const homedirFallbackEngine = GraphEngine.fromConfig();
      try {
        expect(homedirFallbackEngine.dbPath).toBe(join(homedir(), '.niko', 'graph.db'));
      } finally {
        homedirFallbackEngine.close();
        configSpy.mockRestore();
        if (originalHome === undefined) {
          delete process.env.HOME;
        } else {
          process.env.HOME = originalHome;
        }
        if (originalUserProfile === undefined) {
          delete process.env.USERPROFILE;
        } else {
          process.env.USERPROFILE = originalUserProfile;
        }
        if (originalGraphDbPath === undefined) {
          delete process.env.GRAPH_DB_PATH;
        } else {
          process.env.GRAPH_DB_PATH = originalGraphDbPath;
        }
        if (originalNikoGraphDbPath === undefined) {
          delete process.env.NIKO_GRAPH_DB_PATH;
        } else {
          process.env.NIKO_GRAPH_DB_PATH = originalNikoGraphDbPath;
        }
        if (originalDataDir === undefined) {
          delete process.env.DATA_DIR;
        } else {
          process.env.DATA_DIR = originalDataDir;
        }
        if (originalNikoDataDir === undefined) {
          delete process.env.NIKO_DATA_DIR;
        } else {
          process.env.NIKO_DATA_DIR = originalNikoDataDir;
        }
        rmSync(fallbackHomeRoot, { recursive: true, force: true });
      }

      expect(mergeByIdResultingName).toBe('Still Different');

      const rawSqlEngine = new GraphEngine(createDbPath());
      try {
        rawSqlEngine.db.prepare(
          'INSERT INTO entities (id, type, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          'raw-object-props',
          'Character',
          'Raw Object Props',
          JSON.stringify({ lane: 'alpha' }),
          new Date().toISOString(),
          new Date().toISOString(),
        );
        rawSqlEngine.db.prepare('UPDATE entities SET properties = NULL WHERE id = ?').run('raw-object-props');
        const nullPropsEntityRows = await rawSqlEngine.searchEntitiesByName('Character', 'Raw%', 5);
        const nullPropsCharacter = await rawSqlEngine.getCharacter('Raw Object Props', false, false);
        rawSqlEngine.db.prepare(
          'INSERT INTO entities (id, type, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          'raw-event-null-props',
          'Event',
          'Raw Event Null',
          null,
          new Date().toISOString(),
          new Date().toISOString(),
        );
        rawSqlEngine.db.prepare(
          'INSERT INTO relations (id, from_id, to_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          'raw-rel-null-props',
          'raw-object-props',
          'raw-event-null-props',
          'PARTICIPATES',
          null,
          new Date().toISOString(),
        );
        const nullPropsRelationships = await rawSqlEngine.getRelationships('Raw Object Props');
        const nullPropsTimeline = await rawSqlEngine.getCharacter('Raw Object Props', false, true);
        await rawSqlEngine.createEntity('Foreshadow', 'Raw Foreshadow Null', {
          status: 'pending',
          planted_chapter: 1,
        });
        rawSqlEngine.db.prepare('UPDATE entities SET properties = NULL WHERE name = ?').run('Raw Foreshadow Null');
        const rawForeshadowRows = rawSqlEngine.db.prepare(
          "SELECT id, name, properties FROM entities WHERE type = 'Foreshadow' AND name = ?",
        ).all('Raw Foreshadow Null') as Array<{ id: string; name: string; properties: unknown }>;

        expect(nullPropsEntityRows).toEqual([
          expect.objectContaining({
            name: 'Raw Object Props',
            properties: {},
          }),
        ]);
        expect(nullPropsCharacter).toMatchObject({
          name: 'Raw Object Props',
          properties: {},
        });
        expect(nullPropsRelationships).toEqual([
          expect.objectContaining({
            properties: {},
          }),
        ]);
        expect(nullPropsTimeline).toMatchObject({
          timeline: [
            expect.objectContaining({
              properties: {},
            }),
          ],
        });
        expect(rawForeshadowRows).toEqual([
          expect.objectContaining({
            name: 'Raw Foreshadow Null',
            properties: null,
          }),
        ]);
        const nullPropsForeshadowMapHarness = rawSqlEngine as unknown as {
          _mapEntityResult: (row: Record<string, unknown>) => Record<string, unknown>;
        };
        expect(
          nullPropsForeshadowMapHarness._mapEntityResult({
            id: rawForeshadowRows[0]?.id,
            type: 'Foreshadow',
            name: rawForeshadowRows[0]?.name,
            properties: rawForeshadowRows[0]?.properties,
            created_at: null,
            updated_at: null,
          }),
        ).toMatchObject({
          properties: {},
        });
        const mapEntityResultHarness = (rawSqlEngine as unknown as {
          _mapEntityResult: (row: Record<string, unknown>) => Record<string, unknown>;
          _resolveNodeResultKey: (cypher: string, nodeAlias: string) => string;
        });
        expect(
          mapEntityResultHarness._mapEntityResult({
            id: 'null-props-map',
            type: 'Character',
            name: 'Null Props Map',
            properties: null,
            created_at: null,
            updated_at: null,
          }),
        ).toMatchObject({ properties: {} });
        expect(mapEntityResultHarness._resolveNodeResultKey('MATCH (n:Character) RETURN n', 'n')).toBe('n');
        expect(mapEntityResultHarness._resolveNodeResultKey('MATCH (n:Character) RETURN m', 'n')).toBe('n');
        expect(mapEntityResultHarness._resolveNodeResultKey('MATCH (n:Character)', 'n')).toBe('n');
        const limitHarness = rawSqlEngine as unknown as {
          _normalizeCypherLimit: (limitValue?: string) => number | null;
        };
        expect(limitHarness._normalizeCypherLimit('-5')).toBeNull();
        expect(limitHarness._normalizeCypherLimit('abc')).toBeNull();
        expect(limitHarness._normalizeCypherLimit('300')).toBe(200);
        expect(limitHarness._normalizeCypherLimit('12')).toBe(12);
        const parsePropsHarness = rawSqlEngine as unknown as {
          _parseProperties: (raw: unknown) => Record<string, unknown>;
        };
        expect(parsePropsHarness._parseProperties(null)).toEqual({});
        const mergeMatchHarness = rawSqlEngine as unknown as {
          _findEntityForMerge: (
            entityType: string,
            matchProps: Record<string, unknown>,
          ) => Record<string, unknown> | null;
        };
        expect(
          mergeMatchHarness._findEntityForMerge('Character', {
            name: 'Raw Object Props',
            lane: 'alpha',
          }),
        ).toBeNull();
        rawSqlEngine.db.prepare('UPDATE entities SET properties = ? WHERE id = ?').run(
          JSON.stringify({ lane: 'alpha' }),
          'raw-object-props',
        );
        expect(
          mergeMatchHarness._findEntityForMerge('Character', {
            name: 'Raw Object Props',
            lane: 'alpha',
          }),
        ).toMatchObject({
          name: 'Raw Object Props',
        });
        rawSqlEngine.db.prepare('UPDATE entities SET properties = NULL WHERE id = ?').run('raw-object-props');
        expect(
          mergeMatchHarness._findEntityForMerge('Character', {
            name: 'Raw Object Props',
            lane: 'alpha',
          }),
        ).toBeNull();
        expect(
          mergeMatchHarness._findEntityForMerge('Character', {
            id: 'raw-object-props',
            name: 'Definitely not this one',
          }),
        ).toMatchObject({
          id: 'raw-object-props',
          name: 'Raw Object Props',
        });
        expect(mergeMatchHarness._findEntityForMerge('Character', { id: 'missing-id' })).toBeNull();
        expect(mergeMatchHarness._findEntityForMerge('Character', { lane: 'missing' })).toBeNull();
        const createOnlyEngine = new GraphEngine(createDbPath());
        try {
          await createOnlyEngine.createEntity('Character', 'CreateOnly Hero', {
            scope: 'create-only',
          });
          const createOnlyTraversal = await createOnlyEngine.executeCypher(
            "MATCH (n)-[r*1..3]-(m) WHERE n.name CONTAINS 'CreateOnly Hero' RETURN m, r",
          );
          expect(createOnlyTraversal).toEqual([]);
        } finally {
          createOnlyEngine.close();
          rmSync(join(createOnlyEngine.dbPath, '..'), { recursive: true, force: true });
        }
        const mergePropsHarness = rawSqlEngine as unknown as {
          _resolveMergedEntityProperties: (
            row: Record<string, unknown> | null,
            matchProps: Record<string, unknown>,
            setProps: Record<string, unknown>,
          ) => Record<string, unknown>;
        };
        expect(
          mergePropsHarness._resolveMergedEntityProperties(
            {
              id: 'raw-object-props',
              properties: JSON.stringify({ baseline: true }),
              created_at: null,
            },
            { id: 'raw-object-props', name: 'Ignored Name', lane: 'west' },
            { name: 'Still Ignored', rank: 'captain' },
          ),
        ).toMatchObject({
          baseline: true,
          lane: 'west',
          rank: 'captain',
          updated_at: expect.any(String),
        });
        expect(
          mergePropsHarness._resolveMergedEntityProperties(
            null,
            { id: 'none', name: 'none', lane: 'solo' },
            { name: 'still none', tier: 'alpha' },
          ),
        ).toMatchObject({
          lane: 'solo',
          tier: 'alpha',
          updated_at: expect.any(String),
        });
        const mergeNameHarness = rawSqlEngine as unknown as {
          _resolveMergedEntityName: (
            row: Record<string, unknown> | null,
            matchProps: Record<string, unknown>,
            setProps: Record<string, unknown>,
          ) => string;
        };
        expect(
          mergeNameHarness._resolveMergedEntityName(
            { name: 'row-name' },
            { name: 'match-name' },
            { name: 'set-name' },
          ),
        ).toBe('set-name');
        expect(
          mergeNameHarness._resolveMergedEntityName(
            { name: 'row-name' },
            { name: 'match-name' },
            {},
          ),
        ).toBe('row-name');
        expect(mergeNameHarness._resolveMergedEntityName(null, { name: 'match-name' }, {})).toBe('match-name');
        expect(mergeNameHarness._resolveMergedEntityName(null, {}, {})).toBe('');
      } finally {
        rawSqlEngine.close();
        rmSync(join(rawSqlEngine.dbPath, '..'), { recursive: true, force: true });
      }

      const traversalClampEngine = new GraphEngine(createDbPath());
      try {
        await traversalClampEngine.createEntity('Character', 'Clamp A', {});
        await traversalClampEngine.createEntity('Character', 'Clamp B', {});
        await traversalClampEngine.createEntity('Character', 'Clamp C', {});
        await traversalClampEngine.createRelation('Clamp A', 'Clamp B', 'KNOWS');
        await traversalClampEngine.createRelation('Clamp B', 'Clamp C', 'KNOWS');

        const clampedTraversal = await traversalClampEngine.executeCypher(
          "MATCH (n)-[r*1..999]-(m) WHERE n.name CONTAINS 'Clamp A' RETURN m, r LIMIT 10",
        );
        expect(clampedTraversal).toEqual([
          expect.objectContaining({
            m: expect.objectContaining({ name: 'Clamp B' }),
          }),
          expect.objectContaining({
            m: expect.objectContaining({ name: 'Clamp C' }),
          }),
        ]);
      } finally {
        traversalClampEngine.close();
        rmSync(join(traversalClampEngine.dbPath, '..'), { recursive: true, force: true });
      }

      const traversalExistingPathEngine = new GraphEngine(createDbPath());
      try {
        await traversalExistingPathEngine.createEntity('Character', 'Center', {});
        await traversalExistingPathEngine.createEntity('Character', 'Mid', {});
        await traversalExistingPathEngine.createEntity('Character', 'Leaf', {});
        await traversalExistingPathEngine.createRelation('Center', 'Mid', 'KNOWS');
        await traversalExistingPathEngine.createRelation('Center', 'Leaf', 'KNOWS');
        await traversalExistingPathEngine.createRelation('Mid', 'Leaf', 'KNOWS');

        const traversalExistingPathRows = await traversalExistingPathEngine.executeCypher(
          "MATCH (n)-[r*1..3]-(m) WHERE n.name CONTAINS 'Center' RETURN m, r LIMIT 20",
        );
        const leafRow = traversalExistingPathRows.find((row) => (row.m as { name?: string }).name === 'Leaf') as
          | { r?: Array<Record<string, unknown>> }
          | undefined;
        expect(leafRow?.r).toHaveLength(1);
      } finally {
        traversalExistingPathEngine.close();
        rmSync(join(traversalExistingPathEngine.dbPath, '..'), { recursive: true, force: true });
      }

      const nodeResultAliasEngine = new GraphEngine(createDbPath());
      try {
        await nodeResultAliasEngine.createEntity('Character', 'Alias Hero', {});
        const aliasResult = await nodeResultAliasEngine.executeCypher('MATCH (n:Character) RETURN m LIMIT 1');
        expect(aliasResult).toEqual([
          {
            n: expect.objectContaining({
              name: 'Alias Hero',
            }),
          },
        ]);
      } finally {
        nodeResultAliasEngine.close();
        rmSync(join(nodeResultAliasEngine.dbPath, '..'), { recursive: true, force: true });
      }

      const mergeMissingSetKeyword = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) {"name":"Broken"} RETURN n',
      );
      const mergeMissingReturnAlias = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) SET {"name":"Broken"} RETURN m',
      );
      const mergeUnclosedSetObject = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Broken"}) SET {"name":"Broken" RETURN n',
      );

      expect(scopedNames).toEqual(['Project Scout', 'Scoped Hero']);
      expect(legacyScopedNames).toEqual(
        expect.arrayContaining(['Scoped Hero', 'Project Scout', 'Legacy Echo']),
      );
      expect(trimmedScopeRows).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Project Scout',
          }),
        }),
      ]);
      expect(scopedRelationRows).toEqual([
        expect.objectContaining({
          source: expect.objectContaining({ name: 'Scoped Hero' }),
          target: expect.objectContaining({ name: 'Project Scout' }),
        }),
      ]);
      expect(scopedTraversalRows).toEqual([
        expect.objectContaining({
          m: expect.objectContaining({ name: 'Project Scout' }),
        }),
      ]);
      expect(relationshipWithoutTypeRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relationship: expect.objectContaining({
              type: 'KNOWS',
            }),
          }),
        ]),
      );
      expect(traversalDepthFallbackRows).toEqual([
        expect.objectContaining({
          m: expect.objectContaining({ name: 'Project Scout' }),
        }),
      ]);
      expect(legacyBlocked).toEqual({ error: "Character 'Legacy Echo' not found" });
      expect(legacyAllowed).toMatchObject({ name: 'Legacy Echo' });
      expect(scopedForeshadows).toEqual([]);
      expect(missingTargetRelation).toEqual({ error: "Entity 'Missing Target' not found" });

      expect(invalidMergeShape).toEqual([{ error: 'Invalid MERGE mutation syntax' }]);
      expect(invalidMergeType).toEqual([{ error: 'Invalid entity type: Unknown' }]);
      expect(mergeMissingName).toEqual([{ error: 'MERGE mutation requires a name field' }]);
      expect(mergeInvalidMatchArray).toEqual([{ error: 'Invalid MERGE mutation syntax' }]);
      expect(mergeInvalidSetArray).toEqual([{ error: 'Invalid MERGE mutation syntax' }]);
      expect(mergeWithTrailingTokens).toEqual([{ error: 'Invalid MERGE mutation syntax' }]);
      expect(createFromMatchName).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Match Only',
            properties: expect.objectContaining({
              description: 'slash \\ and quote \"ok\"',
            }),
          }),
        }),
      ]);
      expect(createMergeById).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            id: 'merge-id-row',
            name: 'Row Name',
          }),
        }),
      ]);
      expect(updateMergeById).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            id: 'merge-id-row',
            name: 'Row Name',
            properties: expect.objectContaining({
              workspaceId: 'scope-w1',
              projectId: 'scope-p1',
            }),
          }),
        }),
      ]);
      expect(mergeByTypeOnly).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Project Only',
            properties: expect.objectContaining({
              projectId: 'project-only',
            }),
          }),
        }),
      ]);
      expect(mergeWithExtraMatchProps).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Scoped Hero',
          }),
        }),
      ]);
      expect(mergeWithIdMismatch).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            id: 'merge-id-row',
            name: 'Mismatch Name',
          }),
        }),
      ]);
      expect(mergeByIdNonexistent).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            id: 'merge-id-nonexistent',
            name: 'By Id Missing',
          }),
        }),
      ]);
      expect(mergeWithNumericNameField).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Numeric Match Name',
          }),
        }),
      ]);
      expect(mergeWithNumericSetName).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Numeric Set Name',
          }),
        }),
      ]);
      expect(mergeWithMalformedJson).toEqual([{ error: 'Invalid MERGE mutation syntax' }]);
      expect(mergeWithMissingExtraProperty).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Scoped Hero',
          }),
        }),
      ]);
      expect(mergeWithPropertyMatch).toEqual([
        expect.objectContaining({
          n: expect.objectContaining({
            name: 'Scoped Hero',
          }),
        }),
      ]);
      expect(relationWithNullProps).toMatchObject({ status: 'created' });
      const allyRelations = await engine.getRelationships('Scoped Hero', 'ALLY', 1);
      expect(allyRelations).toEqual([
        expect.objectContaining({
          type: 'ALLY',
          properties: {},
        }),
      ]);
      const scopedForeshadowWithNullProps = await engine.createEntity('Foreshadow', 'Scoped Null Props', {
        status: 'pending',
      });
      expect(scopedForeshadowWithNullProps).toMatchObject({ status: 'created' });
      const scopedNullPropsRow = engine.db
        .prepare('SELECT id, properties FROM entities WHERE name = ?')
        .get('Scoped Null Props') as { id: string; properties: unknown };
      engine.db.prepare('UPDATE entities SET properties = NULL WHERE id = ?').run(scopedNullPropsRow.id);
      const foreshadowsAfterNullProps = await engine.getForeshadows('', null);
      expect(foreshadowsAfterNullProps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Scoped Null Props',
            properties: {},
          }),
        ]),
      );
      const scopedHeroRow = engine.db
        .prepare('SELECT id, properties FROM entities WHERE name = ?')
        .get('Scoped Hero') as { id: string; properties: string };
      const scopedHeroProps = JSON.parse(scopedHeroRow.properties) as Record<string, unknown>;
      expect(scopedHeroProps).toMatchObject({
        workspaceId: 'scope-w1',
      });
      const mergeNameHarness = engine as unknown as {
        _resolveMergedEntityName: (
          row: Record<string, unknown> | null,
          matchProps: Record<string, unknown>,
          setProps: Record<string, unknown>,
        ) => string;
      };
      expect(
        mergeNameHarness._resolveMergedEntityName(
          { name: 'row-wins' },
          { name: 'match-fallback' },
          { name: '   ' },
        ),
      ).toBe('row-wins');
      expect(mergeNameHarness._resolveMergedEntityName(null, { name: 'match-fallback' }, { name: '   ' })).toBe(
        'match-fallback',
      );
      expect(
        mergeNameHarness._resolveMergedEntityName(null, { name: '   ' }, { name: '   ' }),
      ).toBe('');
      const mergePropsHarness = engine as unknown as {
        _resolveMergedEntityProperties: (
          row: Record<string, unknown> | null,
          matchProps: Record<string, unknown>,
          setProps: Record<string, unknown>,
        ) => Record<string, unknown>;
      };
      expect(
        mergePropsHarness._resolveMergedEntityProperties(
          {
            id: 'row-props',
            properties: JSON.stringify({ baseline: true }),
            created_at: null,
          },
          { name: 'Scoped Hero', lane: 'west' },
          { name: 'Scoped Hero', rank: 'captain' },
        ),
      ).toMatchObject({
        baseline: true,
        lane: 'west',
        rank: 'captain',
        updated_at: expect.any(String),
      });
      expect(
        mergePropsHarness._resolveMergedEntityProperties(
          {
            id: 'row-created-at',
            properties: JSON.stringify({ baseline: true }),
            created_at: '2026-04-01T00:00:00.000Z',
          },
          { name: 'Scoped Hero' },
          { name: 'Scoped Hero' },
        ),
      ).toMatchObject({
        created_at: '2026-04-01T00:00:00.000Z',
      });
      expect(
        mergePropsHarness._resolveMergedEntityProperties(
          null,
          { name: 'Match Only', lane: 'solo' },
          { name: 'Set Only', tier: 'alpha' },
        ),
      ).toMatchObject({
        lane: 'solo',
        tier: 'alpha',
        updated_at: expect.any(String),
      });
      const parsePropsHarness = engine as unknown as {
        _parseProperties: (raw: unknown) => Record<string, unknown>;
      };
      expect(parsePropsHarness._parseProperties(null)).toEqual({});
      expect(parsePropsHarness._parseProperties({ lane: 'obj' })).toEqual({ lane: 'obj' });
      expect(parsePropsHarness._parseProperties('not-json')).toEqual({});
      const matchHarness = engine as unknown as {
        _findEntityForMerge: (
          entityType: string,
          matchProps: Record<string, unknown>,
        ) => Record<string, unknown> | null;
      };
      expect(matchHarness._findEntityForMerge('Character', { id: 'merge-id-row' })).toMatchObject({
        id: 'merge-id-row',
      });
      expect(matchHarness._findEntityForMerge('Character', { name: 'Scoped Hero', workspaceId: 'scope-w1' })).toMatchObject(
        {
          name: 'Scoped Hero',
        },
      );
      expect(matchHarness._findEntityForMerge('Character', { name: 'Scoped Hero', workspaceId: 'missing' })).toBeNull();
      const limitHarness = engine as unknown as {
        _normalizeCypherLimit: (value?: string) => number | null;
      };
      expect(limitHarness._normalizeCypherLimit('abc')).toBeNull();
      expect(limitHarness._normalizeCypherLimit('-2')).toBeNull();
      expect(limitHarness._normalizeCypherLimit('0')).toBeNull();
      expect(limitHarness._normalizeCypherLimit('7')).toBe(7);
      expect(limitHarness._normalizeCypherLimit('999')).toBe(200);
      const keyHarness = engine as unknown as {
        _resolveNodeResultKey: (cypher: string, nodeAlias: string) => string;
      };
      expect(keyHarness._resolveNodeResultKey('MATCH (n:Character) RETURN n', 'n')).toBe('n');
      expect(keyHarness._resolveNodeResultKey('MATCH (n:Character) RETURN m', 'n')).toBe('n');
      expect(keyHarness._resolveNodeResultKey('MATCH (n:Character)', 'n')).toBe('n');
      const mapHarness = engine as unknown as {
        _mapEntityResult: (row: Record<string, unknown>) => Record<string, unknown>;
      };
      expect(
        mapHarness._mapEntityResult({
          id: 'map-null',
          type: 'Character',
          name: 'Map Null',
          properties: null,
          created_at: null,
          updated_at: null,
        }),
      ).toMatchObject({ properties: {} });
      expect(mergeWithIdMismatch[0]?.n).toMatchObject(
        expect.objectContaining({
          properties: expect.objectContaining({
            workspaceId: 'scope-w1',
            projectId: 'scope-p1',
          }),
        }),
      );
      expect((mergeWithIdMismatch[0]?.n as { properties?: Record<string, unknown> }).properties).not.toMatchObject(
        expect.objectContaining({
          id: 'merge-id-row',
        }),
      );
      expect((mergeWithIdMismatch[0]?.n as { properties?: Record<string, unknown> }).properties).not.toMatchObject(
        expect.objectContaining({
          name: 'Mismatch Name',
        }),
      );
      expect(mergeInvalidMatchLiteral).not.toBeNull();
      expect(mergeInvalidSetLiteral).not.toBeNull();
      expect(mergeMalformedJsonThrows).toBeNull();
      expect(mergeInvalidMatchLiteral?.matchProps).toMatchObject({ name: 42 });
      expect(mergeInvalidSetLiteral?.setProps).toMatchObject({ name: 42 });
      expect(mergeLeadingWhitespaceSetObject).not.toBeNull();
      expect(mergeMissingHeader).toBeNull();
      expect(mergeMissingSetKeyword).toBeNull();
      expect(mergeMissingReturnAlias).toBeNull();
      expect(mergeUnclosedSetObject).toBeNull();
      expect(missingOpenBraceExtraction).toBeNull();
      expect(whitespaceOnlyExtraction).toBeNull();
      expect(unclosedExtraction).toBeNull();
      expect(escapedExtraction).toMatchObject({
        json: '{"text":"brace \\\"quoted\\\" and escaped slash \\\\ ok"}',
      });
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers remaining helper fallback branches with controlled harnesses', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await engine.createEntity('Character', 'Branch Hero', {});
      await engine.createEntity('Character', 'Branch Ally', {});
      await engine.createRelation('Branch Hero', 'Branch Ally', 'KNOWS', {});

      const traversalMethod = (engine as unknown as {
        _executeTraversalMatch: (
          depthValue: string,
          startNameFragment: string,
          limitValue?: string,
          scope?: unknown,
        ) => Record<string, unknown>[];
      })._executeTraversalMatch as unknown as (
        this: {
          _normalizeCypherLimit: (value?: string) => number | null;
          db: {
            prepare: (sql: string) => {
              all: (...params: unknown[]) => {
                length: number;
                map: (
                  mapper: (
                    row: Record<string, unknown>,
                    index: number,
                    array: unknown,
                  ) => Record<string, unknown>,
                ) => Array<Record<string, unknown>>;
              };
            };
          };
        },
        depthValue: string,
        startNameFragment: string,
        limitValue?: string,
        scope?: unknown,
      ) => Record<string, unknown>[];
      const forcedTraversal = traversalMethod.call(
        {
          _normalizeCypherLimit: () => 5,
          db: {
            prepare: () => ({
              all: () => ({
                length: 1,
                map: () => [
                  {
                    entityId: 'forced-branch-id',
                    path: [{}],
                    visited: ['forced-branch-id'],
                  },
                ],
              }),
            }),
          },
        },
        '1',
        'Branch Hero',
        '5',
        null,
      );
      expect(forcedTraversal).toEqual([]);

      const parseHarness = engine as unknown as {
        _parseMergeMutation: (cypher: string) => Record<string, unknown> | null;
        _extractBalancedJsonObject: (
          text: string,
          startIndex: number,
        ) => { json: string; endIndex: number } | null;
      };
      const originalExtract = parseHarness._extractBalancedJsonObject.bind(engine);
      let callIndex = 0;
      const matchArraySpy = vi
        .spyOn(engine as unknown as { _extractBalancedJsonObject: typeof parseHarness._extractBalancedJsonObject }, '_extractBalancedJsonObject')
        .mockImplementation((text: string, startIndex: number) => {
          const out = originalExtract(text, startIndex);
          callIndex += 1;
          if (!out) return out;
          if (callIndex === 1) {
            return { ...out, json: '[]' };
          }
          return out;
        });
      const invalidMatchObject = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Branch Hero"}) SET {"name":"Branch Hero"} RETURN n',
      );
      matchArraySpy.mockRestore();

      callIndex = 0;
      const setArraySpy = vi
        .spyOn(engine as unknown as { _extractBalancedJsonObject: typeof parseHarness._extractBalancedJsonObject }, '_extractBalancedJsonObject')
        .mockImplementation((text: string, startIndex: number) => {
          const out = originalExtract(text, startIndex);
          callIndex += 1;
          if (!out) return out;
          if (callIndex === 2) {
            return { ...out, json: '[]' };
          }
          return out;
        });
      const invalidSetObject = parseHarness._parseMergeMutation(
        'MERGE (n:Character {"name":"Branch Hero"}) SET {"name":"Branch Hero"} RETURN n',
      );
      setArraySpy.mockRestore();

      expect(invalidMatchObject).toBeNull();
      expect(invalidSetObject).toBeNull();

      const namelessPlugin = {
        load: vi.fn(async () => {
          throw new Error('plugin-load-failed');
        }),
        healthCheck: vi.fn(async () => {
          throw new Error('plugin-health-failed');
        }),
      } as unknown as {
        name: string;
        load: (engine: GraphEngine) => Promise<void>;
        healthCheck: () => Promise<Record<string, unknown>>;
      };
      const pluginDbPath = createDbPath();
      const pluginEngine = new GraphEngine(pluginDbPath, [namelessPlugin]);
      try {
        await pluginEngine.initialize();
        const pluginHealth = await pluginEngine.healthCheck();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Graph plugin load failed: unknown"'),
        );
        expect(pluginHealth.plugins).toMatchObject({
          unknown: {
            status: 'error',
          },
        });
      } finally {
        pluginEngine.close();
        rmSync(join(pluginDbPath, '..'), { recursive: true, force: true });
      }

      const fromConfigRoot = mkdtempSync(join(tmpdir(), 'niko-graph-from-config-'));
      const originalDataDir = process.env.DATA_DIR;
      const originalNikoDataDir = process.env.NIKO_DATA_DIR;
      const originalGraphDbPath = process.env.GRAPH_DB_PATH;
      const originalNikoGraphDbPath = process.env.NIKO_GRAPH_DB_PATH;
      const configModule = await import('../../config');
      const configSpy = vi.spyOn(configModule, 'getConfigValue').mockImplementation(() => null);
      try {
        process.env.DATA_DIR = fromConfigRoot;
        delete process.env.NIKO_DATA_DIR;
        delete process.env.GRAPH_DB_PATH;
        delete process.env.NIKO_GRAPH_DB_PATH;

        const configuredFromDataDir = GraphEngine.fromConfig();
        try {
          expect(configuredFromDataDir.dbPath).toBe(join(fromConfigRoot, 'graph.db'));
        } finally {
          configuredFromDataDir.close();
        }
      } finally {
        configSpy.mockRestore();
        if (originalDataDir === undefined) {
          delete process.env.DATA_DIR;
        } else {
          process.env.DATA_DIR = originalDataDir;
        }
        if (originalNikoDataDir === undefined) {
          delete process.env.NIKO_DATA_DIR;
        } else {
          process.env.NIKO_DATA_DIR = originalNikoDataDir;
        }
        if (originalGraphDbPath === undefined) {
          delete process.env.GRAPH_DB_PATH;
        } else {
          process.env.GRAPH_DB_PATH = originalGraphDbPath;
        }
        if (originalNikoGraphDbPath === undefined) {
          delete process.env.NIKO_GRAPH_DB_PATH;
        } else {
          process.env.NIKO_GRAPH_DB_PATH = originalNikoGraphDbPath;
        }
        rmSync(fromConfigRoot, { recursive: true, force: true });
      }

      const now = new Date().toISOString();
      engine.db
        .prepare(
          'INSERT INTO entities (id, type, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('branch-foreshadow-null', 'Foreshadow', 'Branch Foreshadow Null', null, now, now);
      engine.db
        .prepare(
          'INSERT INTO entities (id, type, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('branch-update-null', 'Character', 'Branch Update Null', null, now, now);

      const foreshadowsWithNullProps = await engine.getForeshadows('', null);
      expect(foreshadowsWithNullProps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Branch Foreshadow Null',
            properties: {},
          }),
        ]),
      );

      await expect(engine.updateEntity('Branch Update Null', { role: 'patched' })).resolves.toMatchObject({
        status: 'updated',
        properties: {
          role: 'patched',
        },
      });

      const findHarness = engine as unknown as {
        _findEntityForMerge: (
          entityType: string,
          matchProps: Record<string, unknown>,
        ) => Record<string, unknown> | null;
      };
      expect(
        findHarness._findEntityForMerge('Character', {
          id: 123,
          name: 'Branch Hero',
        }),
      ).toBeNull();
    } finally {
      errorSpy.mockRestore();
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });

  it('covers fallback match and scoped timeline traversal branches', async () => {
    const dbPath = createDbPath();
    const engine = new GraphEngine(dbPath);

    try {
      await engine.createEntity('Character', 'Alice Scope', {
        workspaceId: 'timeline-w1',
        projectId: 'timeline-p1',
      });
      await engine.createEntity('Character', 'Bob Scope', {
        workspaceId: 'timeline-w1',
      });
      await engine.createEntity('Character', 'Carol Scope', {
        workspaceId: 'timeline-w1',
      });
      await engine.createEntity('Event', 'Bridge Alarm Scoped', {
        workspaceId: 'timeline-w1',
        time: 7,
      });

      await engine.createRelation('Alice Scope', 'Bob Scope', 'KNOWS', { via: 'north' });
      await engine.createRelation('Bob Scope', 'Carol Scope', 'KNOWS', { via: 'south' });
      await engine.createRelation('Alice Scope', 'Bridge Alarm Scoped', 'PARTICIPATES', { chapter: 7 });

      const noReturnAlias = await engine.executeCypher('MATCH (n:Character)');
      const unmatchedMatch = await engine.executeCypher('MATCH (invalid) RETURN invalid');
      const malformedTraversal = await engine.executeCypher(
        "MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Alice Scope' RETURN m, r LIMIT not-a-number",
      );

      const fallbackConfigured = GraphEngine.fromConfig();
      try {
        expect(fallbackConfigured.dbPath).toBe('.writing/graph_db');
      } finally {
        fallbackConfigured.close();
      }

      const reverseTraversal = await engine.executeCypher(
        "MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Bob Scope' RETURN m, r LIMIT 5",
        { workspaceId: 'timeline-w1', allowLegacy: false },
      );
      const scopedRelationships = await engine.getRelationships('Alice Scope', null, 1, {
        workspaceId: 'timeline-w1',
        projectId: 'timeline-p1',
        allowLegacy: false,
      });
      const scopedCharacterTimeline = await engine.getCharacter('Alice Scope', false, true, {
        workspaceId: 'timeline-w1',
        projectId: 'timeline-p1',
        allowLegacy: false,
      });

      expect(noReturnAlias).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            n: expect.objectContaining({
              name: 'Alice Scope',
            }),
          }),
        ]),
      );
      expect(unmatchedMatch).toEqual([]);
      expect(malformedTraversal).toEqual([]);
      expect(reverseTraversal).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            m: expect.objectContaining({ name: 'Alice Scope' }),
          }),
          expect.objectContaining({
            m: expect.objectContaining({ name: 'Carol Scope' }),
          }),
        ]),
      );
      expect(scopedRelationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'KNOWS',
            from: 'Alice Scope',
            to: 'Bob Scope',
          }),
        ]),
      );
      expect(scopedCharacterTimeline).toMatchObject({
        name: 'Alice Scope',
        timeline: [
          expect.objectContaining({
            event: 'Bridge Alarm Scoped',
            relation: 'PARTICIPATES',
          }),
        ],
      });
    } finally {
      engine.close();
      rmSync(join(dbPath, '..'), { recursive: true, force: true });
    }
  });
});
