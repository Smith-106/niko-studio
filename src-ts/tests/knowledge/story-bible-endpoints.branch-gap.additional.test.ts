import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearEntityStore,
  getEntityStore,
  sbCreateEntityEndpoint,
  sbGetEntityEndpoint,
  sbUpdateEntityEndpoint,
} from '../../knowledge/mcp/story-bible-endpoints.js';
import { SB_ENTITY_TYPES } from '../../knowledge/entities/story-bible-types.js';

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
  return response.body as Record<string, unknown>;
}

afterEach(() => {
  clearEntityStore();
});

describe('knowledge/mcp/story-bible-endpoints branch-gap coverage', () => {
  it('creates plot-thread entities through the CRUD endpoint', async () => {
    const response = await sbCreateEntityEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-plot',
          name: 'Recover the archive',
          type: 'plot-thread',
          premise: 'The archive holds the map.',
          goal: 'Retrieve it before dawn.',
          stakes: 'The resistance loses its last route.',
        },
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(getBody(response).entity).toMatchObject({
      novelId: 'novel-plot',
      name: 'Recover the archive',
      type: 'plot-thread',
      premise: 'The archive holds the map.',
    });
  });

  it('returns not-found errors for missing get and update entity ids', async () => {
    const getResponse = await sbGetEntityEndpoint(
      mockRequest({
        method: 'GET',
        params: { entityId: 'missing-get' },
      }),
    );
    expect(getResponse.statusCode).toBe(404);
    expect(getBody(getResponse).error).toBe('Entity not found: missing-get');

    const updateResponse = await sbUpdateEntityEndpoint(
      mockRequest({
        method: 'PUT',
        params: { entityId: 'missing-update' },
        body: { name: 'ignored' },
      }),
    );
    expect(updateResponse.statusCode).toBe(404);
    expect(getBody(updateResponse).error).toBe('Entity not found: missing-update');
  });

  it('surfaces creation failures when a validated type cannot be constructed', async () => {
    const mutableTypes = SB_ENTITY_TYPES as unknown as string[];
    mutableTypes.push('mystery-entity');

    try {
      const response = await sbCreateEntityEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-bad',
            name: 'Impossible entity',
            type: 'mystery-entity',
          },
        }),
      );

      expect(response.statusCode).toBe(400);
      expect(getBody(response).error).toBe('Unknown entity type: mystery-entity');
      expect(getEntityStore().size).toBe(0);
    } finally {
      mutableTypes.splice(mutableTypes.indexOf('mystery-entity'), 1);
    }
  });

  it('stringifies non-Error failures raised during entity creation', async () => {
    const body = {
      novelId: 'novel-primitive',
      name: 'Primitive throw',
      type: 'character',
      get boom() {
        throw 'primitive creation failure';
      },
    };

    const response = await sbCreateEntityEndpoint(
      mockRequest({
        body,
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toBe('primitive creation failure');
    expect(getEntityStore().size).toBe(0);
  });
});
