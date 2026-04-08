import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { HttpRequest } from '../../mcp/http-types';
import { GraphEngine } from '../../graph/graph-engine.js';

let graphEngineInstance: GraphEngine | null = null;

vi.mock('../../mcp/engine', () => ({
  getGraphEngine: vi.fn(() => graphEngineInstance),
}));

function makeRequest(url: string, body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function buildWorkspaceBody(
  workspaceId = 'atlas-workspace',
  projectId = 'atlas-project',
): Record<string, unknown> {
  return {
    workspace: {
      identity: {
        workspaceId,
        projectId,
        projectName: projectId,
        workspaceRoot: `/tmp/${workspaceId}`,
      },
    },
  };
}

function getEntityId(engine: GraphEngine, name: string, workspaceId: string): string {
  const row = engine.db
    .prepare(
      "SELECT id FROM entities WHERE name = ? AND json_extract(properties, '$.workspaceId') = ?"
    )
    .get(name, workspaceId) as { id: string } | undefined;

  if (!row) {
    throw new Error(`Expected entity '${name}' in workspace '${workspaceId}'`);
  }

  return row.id;
}

function insertRelation(
  engine: GraphEngine,
  params: {
    id: string;
    fromId: string;
    toId: string;
    type: string;
    properties?: Record<string, unknown>;
  },
): void {
  const createdAt = new Date().toISOString();
  engine.db
    .prepare(
      `INSERT INTO relations (id, from_id, to_id, type, properties, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      params.fromId,
      params.toId,
      params.type,
      JSON.stringify(params.properties ?? {}),
      createdAt,
    );
}

describe('graph endpoints', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'niko-graph-endpoints-'));
    graphEngineInstance = new GraphEngine(join(tempRoot, 'graph.db'));
    vi.resetModules();
  });

  afterEach(async () => {
    graphEngineInstance?.close();
    graphEngineInstance = null;
    vi.resetModules();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('scopes generic graph queries before applying LIMIT so other workspaces cannot consume the page', async () => {
    const engine = graphEngineInstance!;

    for (const name of ['Outside One', 'Outside Two', 'Outside Three']) {
      await engine.createEntity('Character', name, {
        workspaceId: 'outside-workspace',
        projectId: 'outside-project',
        itemKind: 'character',
      });
    }

    await engine.createEntity('Character', 'Atlas Hero', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      itemKind: 'character',
    });
    await engine.createEntity('Character', 'Atlas Mentor', {
      projectId: 'atlas-project',
      itemKind: 'character',
    });

    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await graphQueryEndpoint(makeRequest('/graph/query', {
      cypher: 'MATCH (n:Character) RETURN n LIMIT 2',
      ...buildWorkspaceBody(),
    }));

    expect(response.statusCode).toBe(200);
    const rows = response.body as Array<{ n: { name: string } }>;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.n.name).sort()).toEqual(['Atlas Hero', 'Atlas Mentor']);
  });

  it('scopes named graph detail queries so duplicate names in other workspaces do not leak', async () => {
    const engine = graphEngineInstance!;

    await engine.createEntity('Character', 'Captain Lin', {
      workspaceId: 'outside-workspace',
      projectId: 'outside-project',
      role: 'outsider',
    });
    await engine.createEntity('Character', 'Captain Lin', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      role: 'hero',
    });

    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await graphQueryEndpoint(makeRequest('/graph/query', {
      cypher: "MATCH (n:Character) WHERE n.name = 'Captain Lin' RETURN n",
      ...buildWorkspaceBody(),
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        n: expect.objectContaining({
          name: 'Captain Lin',
          properties: expect.objectContaining({
            workspaceId: 'atlas-workspace',
            role: 'hero',
          }),
        }),
      }),
    ]);
  });

  it('scopes the character endpoint and related records to the active workspace', async () => {
    const engine = graphEngineInstance!;

    await engine.createEntity('Character', 'Captain Lin', {
      workspaceId: 'outside-workspace',
      projectId: 'outside-project',
      role: 'outsider',
    });
    await engine.createEntity('Character', 'Captain Lin', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      role: 'hero',
    });
    await engine.createEntity('Character', 'Atlas Bob', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      role: 'ally',
    });
    await engine.createEntity('Character', 'Outside Carol', {
      workspaceId: 'outside-workspace',
      projectId: 'outside-project',
      role: 'rival',
    });

    insertRelation(engine, {
      id: 'rel-outside',
      fromId: getEntityId(engine, 'Captain Lin', 'outside-workspace'),
      toId: getEntityId(engine, 'Outside Carol', 'outside-workspace'),
      type: 'KNOWS',
      properties: { since: 'chapter-1' },
    });
    insertRelation(engine, {
      id: 'rel-atlas',
      fromId: getEntityId(engine, 'Captain Lin', 'atlas-workspace'),
      toId: getEntityId(engine, 'Atlas Bob', 'atlas-workspace'),
      type: 'KNOWS',
      properties: { since: 'chapter-2' },
    });

    const { graphCharacterEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await graphCharacterEndpoint(makeRequest('/graph/character', {
      name: 'Captain Lin',
      include_relations: true,
      ...buildWorkspaceBody(),
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      name: 'Captain Lin',
      properties: {
        workspaceId: 'atlas-workspace',
        role: 'hero',
      },
      relations: [
        expect.objectContaining({
          type: 'KNOWS',
          from: 'Captain Lin',
          to: 'Atlas Bob',
          properties: { since: 'chapter-2' },
        }),
      ],
    });
  });

  it('scopes the foreshadow endpoint to workspace and project rows while preserving status filters', async () => {
    const engine = graphEngineInstance!;

    await engine.createEntity('Foreshadow', 'Outside Echo', {
      workspaceId: 'outside-workspace',
      projectId: 'outside-project',
      status: 'pending',
      planted_chapter: 1,
    });
    await engine.createEntity('Foreshadow', 'Atlas Echo', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      status: 'pending',
      planted_chapter: 2,
    });
    await engine.createEntity('Foreshadow', 'Atlas Omen', {
      projectId: 'atlas-project',
      status: 'pending',
      planted_chapter: 1,
    });
    await engine.createEntity('Foreshadow', 'Late Atlas', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      status: 'pending',
      planted_chapter: 5,
    });
    await engine.createEntity('Foreshadow', 'Resolved Atlas', {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      status: 'resolved',
      planted_chapter: 1,
    });

    const { graphForeshadowsEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await graphForeshadowsEndpoint(makeRequest('/graph/foreshadows', {
      status: 'pending',
      chapter: 3,
      ...buildWorkspaceBody(),
    }));

    expect(response.statusCode).toBe(200);
    const rows = response.body as Array<{ name: string }>;
    expect(rows.map((row) => row.name).sort()).toEqual(['Atlas Echo', 'Atlas Omen']);
  });
});
