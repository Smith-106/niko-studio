import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  vi.doUnmock('./http-types.js');
  vi.resetModules();
});

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

  it('falls back to process.cwd() when the workflow workspace env is blank', async () => {
    const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '   ';

    try {
      const { workspaceContextEndpoint } = await import('./endpoints/workspace.js');
      const response = await workspaceContextEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        workspace: {
          identity: {
            workspaceRoot: process.cwd(),
          },
        },
      });
    } finally {
      if (originalWorkspace === undefined) {
        delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      } else {
        process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
      }
    }
  });

  it('falls back to an empty payload when parseBody returns null', async () => {
    vi.resetModules();
    vi.doMock('./http-types.js', async () => {
      const actual = await vi.importActual<typeof import('./http-types.js')>('./http-types.js');
      return {
        ...actual,
        parseBody: vi.fn(() => null),
      };
    });

    const { workspaceContextEndpoint } = await import('./endpoints/workspace.js');
    const response = await workspaceContextEndpoint(makeRequest({ payload: 'ignored' }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      workspace: {
        identity: {
          workspaceRoot: process.env['NIKO_WORKFLOW_WORKSPACE']?.trim() || process.cwd(),
        },
      },
    });
  });
});
