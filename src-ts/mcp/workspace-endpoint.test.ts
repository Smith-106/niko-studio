import { describe, expect, it } from 'vitest';

import type { HttpRequest } from './http-types';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/workspace/context',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('workspace context endpoint', () => {
  it('normalizes legacy and nested workspace fields into the authoritative model', async () => {
    const { workspaceContextEndpoint } = await import('./endpoints/workspace.js');

    const response = await workspaceContextEndpoint(makeRequest({
      project_id: 'atlas-project',
      session_id: 'session-5',
      context: {
        chapterId: 'chapter-5',
      },
      workspace: {
        storyBible: {
          draftId: 'draft-5',
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-5',
          graphEntityIds: ['hero-5'],
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      workspace: {
        identity: {
          projectId: 'atlas-project',
        },
        manuscript: {
          chapterId: 'chapter-5',
        },
        workflow: {
          sessionId: 'session-5',
        },
        storyBible: {
          draftId: 'draft-5',
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-5',
        },
      },
      compatibility: {
        additiveContract: true,
        migratedLegacyFields: expect.arrayContaining(['project_id', 'session_id', 'context.chapterId']),
      },
    });
  });
});
