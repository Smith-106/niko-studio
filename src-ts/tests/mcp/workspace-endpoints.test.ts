import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve as pathResolve } from 'node:path';

import type { HttpRequest } from '../../mcp/http-types';

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

describe('workspace endpoints', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  const originalAllowOutside = process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
    if (originalAllowOutside === undefined) {
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    } else {
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = originalAllowOutside;
    }
  });

  describe('workspaceContextEndpoint', () => {
    it('returns normalized default workspace with empty body', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      expect(workspace.schemaVersion).toBe('2026-04-08');
      const identity = workspace.identity as Record<string, unknown>;
      expect(typeof identity.workspaceId).toBe('string');
      expect(typeof identity.projectId).toBe('string');
      expect(identity.workspaceId.length).toBeGreaterThan(0);
      expect(identity.projectId.length).toBeGreaterThan(0);
      expect(body.summary).toMatchObject({
        schemaVersion: '2026-04-08',
      });
      expect(body.compatibility).toMatchObject({
        additiveContract: true,
      });
    });

    it('returns normalized workspace with populated identity', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(
        makeRequest({
          identity: {
            workspaceId: 'test-workspace',
            projectId: 'test-project',
            projectName: 'Test Project',
            workspaceRoot: '/tmp/test',
          },
        }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      const identity = workspace.identity as Record<string, unknown>;
      expect(identity.workspaceId).toBe('test-workspace');
      expect(identity.projectId).toBe('test-project');
      expect(identity.projectName).toBe('Test Project');
      expect(identity.workspaceRoot).toBe('/tmp/test');
      const summary = body.summary as Record<string, unknown>;
      expect(summary.workspaceId).toBe('test-workspace');
      expect(summary.projectId).toBe('test-project');
    });

    it('returns summary with key fields from the workspace', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(
        makeRequest({
          identity: { workspaceId: 'ws-1', projectId: 'proj-1' },
          manuscript: { chapterId: 'ch-10' },
          knowledge: { focusEntityId: 'entity-99' },
        }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const summary = body.summary as Record<string, unknown>;
      expect(summary.chapterId).toBe('ch-10');
      expect(summary.focusEntityId).toBe('entity-99');
    });

    it('returns compatibility with additiveContract true', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const compatibility = body.compatibility as Record<string, unknown>;
      expect(compatibility.additiveContract).toBe(true);
      expect(Array.isArray(compatibility.migratedLegacyFields)).toBe(true);
    });

    it('migrates legacy snake_case fields and records them in compatibility', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(
        makeRequest({
          project_id: 'legacy-proj',
          session_id: 'sess-001',
        }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      const identity = workspace.identity as Record<string, unknown>;
      expect(identity.projectId).toBe('legacy-proj');
      const workflow = workspace.workflow as Record<string, unknown>;
      expect(workflow.sessionId).toBe('sess-001');
      const compatibility = body.compatibility as Record<string, unknown>;
      const migrated = compatibility.migratedLegacyFields as string[];
      expect(migrated).toContain('project_id');
      expect(migrated).toContain('session_id');
    });

    it('falls back gracefully when body is null (undefined body)', async () => {
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const request: HttpRequest = {
        method: 'POST',
        url: '/workspace/context',
        headers: {},
        body: null,
        query: {},
        params: {},
      };

      const response = await workspaceContextEndpoint(request);

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      const identity = workspace.identity as Record<string, unknown>;
      expect(typeof identity.workspaceId).toBe('string');
      expect(identity.workspaceId.length).toBeGreaterThan(0);
    });

    it('respects NIKO_WORKFLOW_WORKSPACE env var for workspaceRoot', async () => {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = '/custom/workspace/path';
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';

      vi.resetModules();
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      const identity = workspace.identity as Record<string, unknown>;
      expect(identity.workspaceRoot).toBe(pathResolve('/custom/workspace/path'));
    });

    it('derives workspaceId from workspaceRoot basename when no identity provided', async () => {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = '/some/nice-project';
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';

      vi.resetModules();
      const { workspaceContextEndpoint } = await import('../../mcp/endpoints/workspace.js');

      const response = await workspaceContextEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const workspace = body.workspace as Record<string, unknown>;
      const identity = workspace.identity as Record<string, unknown>;
      expect(identity.workspaceId).toBe('nice-project');
    });
  });
});
