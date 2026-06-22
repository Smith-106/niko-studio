import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from '../../mcp/http-types';

function makeRequest(body: Record<string, unknown>, url = '/integration/test'): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('workflow + critic smoke integration', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  const originalAllowOutside = process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-workflow-critic-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspace;
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
    if (originalAllowOutside === undefined) {
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    } else {
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = originalAllowOutside;
    }
    }
    vi.resetModules();
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('generates workflow content and evaluates it through critic endpoints', async () => {
    const {
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');
    const {
      criticEvaluateEndpoint,
      criticSuggestionsEndpoint,
      criticConsistencyEndpoint,
    } = await import('../../mcp/endpoints/critic.js');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一段带悬念和角色细节的开场', level: 'L2' }, '/workflow/plan'),
    );
    expect(planResponse.statusCode).toBe(200);
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);
    expect(planId).toBeTruthy();

    let executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }, '/workflow/execute'),
    );
    expect(executeResponse.statusCode).toBe(200);

    executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }, '/workflow/execute'),
    );
    executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }, '/workflow/execute'),
    );

    const generated = ((executeResponse.body as Record<string, unknown>)['result'] as Record<string, unknown>)['content'] as string;
    expect(generated).toContain('任务：写一段带悬念和角色细节的开场');

    const evaluateResponse = await criticEvaluateEndpoint(
      makeRequest(
        {
          content: generated,
          scene_card: { scene_id: 'SC-1' },
          dimensions: ['logic', 'voice'],
          quality_goals: { coherence: 80 },
        },
        '/critic/evaluate',
      ),
    );
    expect(evaluateResponse.statusCode).toBe(200);
    const evaluation = evaluateResponse.body as Record<string, unknown>;
    expect(['APPROVED', 'REVISE', 'REWRITE']).toContain(String(evaluation['decision']));
    expect(Number(evaluation['total_score'])).toBeGreaterThan(0);

    const suggestionsResponse = await criticSuggestionsEndpoint(
      makeRequest(
        {
          content: generated,
          issues: [String(evaluation['actionable_feedback'] ?? '')],
          max_suggestions: 3,
        },
        '/critic/suggestions',
      ),
    );
    expect(suggestionsResponse.statusCode).toBe(200);
    expect(Array.isArray(suggestionsResponse.body)).toBe(true);

    const consistencyResponse = await criticConsistencyEndpoint(
      makeRequest(
        {
          chapters: [generated],
          chapterMeta: [{ chapterNumber: 1, title: 'Opening' }],
          workspace: {
            identity: {
              workspaceId: 'atlas-workspace',
              projectId: 'atlas-project',
            },
            workflow: {
              sessionId: 'session-1',
            },
          },
        },
        '/critic/consistency',
      ),
    );
    expect(consistencyResponse.statusCode).toBe(200);
    const consistencyBody = consistencyResponse.body as Record<string, unknown>;
    expect(String(consistencyBody['runId'])).toContain('consistency-atlas-workspace-');
    expect(consistencyBody['workspace']).toMatchObject({
      authority: {
        recordSetId: 'atlas-workspace',
      },
    });
    expect(consistencyBody['narrativeAuthority']).toMatchObject({
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
  });
});
