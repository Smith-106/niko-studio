import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearEntityStore,
  getEntityStore,
  sbCreateEntityEndpoint,
  sbDeleteEntityEndpoint,
  sbExtractFromManuscriptEndpoint,
  sbGetCompletenessEndpoint,
  sbGetEntitiesEndpoint,
  sbGetEntityEndpoint,
  sbUpdateEntityEndpoint,
} from '../../knowledge/mcp/story-bible-endpoints.js';

function mockRequest({
  method = 'POST',
  url = '/story-bible',
  body = {},
  query = {},
  params = {},
}: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method,
    url,
    headers: {},
    body,
    query,
    params,
  };
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

async function createEntity(body: Record<string, unknown>) {
  const response = await sbCreateEntityEndpoint(mockRequest({ body }));
  expect(response.statusCode).toBe(201);
  return getBody(response).entity as any;
}

afterEach(() => {
  clearEntityStore();
});

describe('knowledge/mcp/story-bible-endpoints', () => {
  it('validates required and typed list filters', async () => {
    const missingNovelId = await sbGetEntitiesEndpoint(mockRequest({ method: 'GET', query: {} }));
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required');

    const invalidType = await sbGetEntitiesEndpoint(
      mockRequest({ method: 'GET', query: { novelId: 'novel-1', type: 'invalid-type' } }),
    );
    expect(invalidType.statusCode).toBe(400);
    expect(getBody(invalidType).error).toContain('Invalid entity type: invalid-type');
  });

  it('creates entities and lists them from query and body filters', async () => {
    const character = await createEntity({
      novelId: 'novel-1',
      name: 'Ava',
      type: 'character',
      completenessScore: 0.8,
      backstory: 'Lead investigator.',
    });
    const worldRule = await createEntity({
      novelId: 'novel-1',
      name: 'Curfew',
      type: 'world-rule',
      completenessScore: 0.6,
      description: 'No one can leave after midnight.',
    });
    await createEntity({
      novelId: 'novel-2',
      name: 'Other',
      type: 'character',
    });

    const byQuery = await sbGetEntitiesEndpoint(
      mockRequest({ method: 'GET', query: { novelId: 'novel-1' } }),
    );
    expect(byQuery.statusCode).toBe(200);
    expect(getBody(byQuery)).toMatchObject({
      count: 2,
      novelId: 'novel-1',
      type: 'all',
    });
    expect(getBody(byQuery).entities.map((entity: any) => entity.id).sort()).toEqual(
      [character.id, worldRule.id].sort(),
    );

    const byBodyFilter = await sbGetEntitiesEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          type: 'character',
        },
      }),
    );
    expect(byBodyFilter.statusCode).toBe(200);
    expect(getBody(byBodyFilter)).toMatchObject({
      count: 1,
      novelId: 'novel-1',
      type: 'character',
    });
    expect(getBody(byBodyFilter).entities[0]).toMatchObject({
      id: character.id,
      type: 'character',
      name: 'Ava',
    });
  });

  it('returns empty results for novels without indexed entities', async () => {
    const response = await sbGetEntitiesEndpoint(
      mockRequest({ method: 'GET', query: { novelId: 'missing-novel' } }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response)).toEqual({
      entities: [],
      count: 0,
    });
  });

  it('gets, updates, and protects immutable entity fields', async () => {
    const created = await createEntity({
      novelId: 'novel-1',
      name: 'Mara',
      type: 'character',
      completenessScore: 0.4,
      metadata: { arc: 'setup' },
    });

    const fetched = await sbGetEntityEndpoint(
      mockRequest({ method: 'GET', params: { entityId: created.id } }),
    );
    expect(fetched.statusCode).toBe(200);
    expect(getBody(fetched).entity).toMatchObject({
      id: created.id,
      novelId: 'novel-1',
      type: 'character',
      name: 'Mara',
    });

    const updated = await sbUpdateEntityEndpoint(
      mockRequest({
        method: 'PUT',
        params: { entityId: created.id },
        body: {
          id: 'tampered-id',
          novelId: 'novel-2',
          type: 'world-rule',
          createdAt: '2000-01-01T00:00:00.000Z',
          name: 'Mara Renamed',
          completenessScore: 0.95,
          metadata: { arc: 'climax' },
        },
      }),
    );
    expect(updated.statusCode).toBe(200);
    expect(getBody(updated).entity).toMatchObject({
      id: created.id,
      novelId: 'novel-1',
      type: 'character',
      createdAt: created.createdAt,
      name: 'Mara Renamed',
      completenessScore: 0.95,
      metadata: { arc: 'climax' },
    });
  });

  it('validates entity ids for get, update, and delete endpoints', async () => {
    const missingGetId = await sbGetEntityEndpoint(mockRequest({ method: 'GET' }));
    expect(missingGetId.statusCode).toBe(400);
    expect(getBody(missingGetId).error).toBe('entityId is required');

    const missingUpdateId = await sbUpdateEntityEndpoint(mockRequest({ method: 'PUT' }));
    expect(missingUpdateId.statusCode).toBe(400);
    expect(getBody(missingUpdateId).error).toBe('entityId is required');

    const missingDeleteId = await sbDeleteEntityEndpoint(mockRequest({ method: 'DELETE' }));
    expect(missingDeleteId.statusCode).toBe(400);
    expect(getBody(missingDeleteId).error).toBe('entityId is required');

    const notFoundDelete = await sbDeleteEntityEndpoint(
      mockRequest({ method: 'DELETE', params: { entityId: 'missing' } }),
    );
    expect(notFoundDelete.statusCode).toBe(404);
    expect(getBody(notFoundDelete).error).toContain('Entity not found: missing');
  });

  it('deletes entities and clears the novel index when the last entity is removed', async () => {
    const created = await createEntity({
      novelId: 'novel-1',
      name: 'Vera',
      type: 'character',
    });

    const deleted = await sbDeleteEntityEndpoint(
      mockRequest({ method: 'DELETE', params: { entityId: created.id } }),
    );
    expect(deleted.statusCode).toBe(200);
    expect(getBody(deleted)).toEqual({
      status: 'deleted',
      entityId: created.id,
    });
    expect(getEntityStore().has(created.id)).toBe(false);

    const listed = await sbGetEntitiesEndpoint(
      mockRequest({ method: 'GET', query: { novelId: 'novel-1' } }),
    );
    expect(getBody(listed)).toEqual({
      entities: [],
      count: 0,
    });
  });

  it('validates create and extract requests and returns placeholder extraction results', async () => {
    const missingCreateFields = await sbCreateEntityEndpoint(
      mockRequest({ body: { novelId: 'novel-1', type: 'character' } }),
    );
    expect(missingCreateFields.statusCode).toBe(400);
    expect(getBody(missingCreateFields).error).toBe('novelId, name, and type are required');

    const invalidCreateType = await sbCreateEntityEndpoint(
      mockRequest({ body: { novelId: 'novel-1', name: 'Bad', type: 'invalid' } }),
    );
    expect(invalidCreateType.statusCode).toBe(400);
    expect(getBody(invalidCreateType).error).toContain('Invalid entity type: invalid');

    const missingExtractNovelId = await sbExtractFromManuscriptEndpoint(mockRequest({ body: {} }));
    expect(missingExtractNovelId.statusCode).toBe(400);
    expect(getBody(missingExtractNovelId).error).toBe('novelId is required');

    const extracted = await sbExtractFromManuscriptEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(extracted.statusCode).toBe(200);
    expect(getBody(extracted)).toMatchObject({
      novelId: 'novel-1',
      extracted: [],
      conflicts: [],
      confidence: 0,
      warnings: ['Extraction not yet implemented - placeholder result'],
    });
    expect(typeof getBody(extracted).timestamp).toBe('string');
  });

  it('builds completeness reports for empty and populated novels', async () => {
    const empty = await sbGetCompletenessEndpoint(
      mockRequest({ method: 'GET', query: { novelId: 'novel-empty' } }),
    );
    expect(empty.statusCode).toBe(200);
    expect(getBody(empty)).toMatchObject({
      novelId: 'novel-empty',
      overallScore: 0,
      byType: {
        character: { count: 0, avgScore: 0 },
        'world-rule': { count: 0, avgScore: 0 },
        'plot-thread': { count: 0, avgScore: 0 },
        'timeline-event': { count: 0, avgScore: 0 },
      },
    });
    expect(getBody(empty).missing).toEqual([
      { type: 'character', suggestion: 'Add at least one main character' },
      { type: 'world-rule', suggestion: 'Define world rules and constraints' },
      { type: 'plot-thread', suggestion: 'Create main plot thread' },
    ]);

    await createEntity({
      novelId: 'novel-1',
      name: 'Lead',
      type: 'character',
      completenessScore: 0.8,
    });
    await createEntity({
      novelId: 'novel-1',
      name: 'Law',
      type: 'world-rule',
      completenessScore: 0.6,
    });
    await createEntity({
      novelId: 'novel-1',
      name: 'Inciting Incident',
      type: 'timeline-event',
      completenessScore: 0.2,
    });

    const populated = await sbGetCompletenessEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(populated.statusCode).toBe(200);
    const report = getBody(populated);
    expect(report.novelId).toBe('novel-1');
    expect(report.overallScore).toBeCloseTo((0.8 + 0.6 + 0.2) / 3);
    expect(report.byType.character).toEqual({ count: 1, avgScore: 0.8 });
    expect(report.byType['world-rule']).toEqual({ count: 1, avgScore: 0.6 });
    expect(report.byType['timeline-event']).toEqual({ count: 1, avgScore: 0.2 });
    expect(report.byType['plot-thread']).toEqual({ count: 0, avgScore: 0 });
    expect(report.missing).toEqual([
      { type: 'plot-thread', suggestion: 'Create main plot thread' },
    ]);
  });

  it('validates completeness requests without novel ids', async () => {
    const response = await sbGetCompletenessEndpoint(mockRequest({ method: 'GET', query: {} }));
    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toBe('novelId is required');
  });
});
