import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from '../../mcp/http-types';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/workflow/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function buildWorkspace(
  sessionId: string | null,
  workspaceId = 'atlas-workspace',
  projectId = 'atlas-project',
  conversationId: string | null = sessionId,
) {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId,
      projectId,
      projectName: projectId,
      workspaceRoot: `/tmp/${workspaceId}`,
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-2',
      chapterTitle: null,
      chapterNumber: 2,
    },
    storyBible: {
      storyBibleId: null,
      draftId: 'draft-1',
      version: null,
      storage: 'local-draft',
    },
    knowledge: {
      focusEntityId: 'hero-1',
      graphEntityIds: ['hero-1'],
      memoryEntryIds: [],
    },
    workflow: {
      sessionId,
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId,
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

describe('workflow endpoints integration', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-workflow-endpoint-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspace;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
    vi.resetModules();
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('runs route -> plan -> execute through real workflow endpoints', async () => {
    const {
      workflowRouteEndpoint,
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const routeResponse = await workflowRouteEndpoint(
      makeRequest({ task: '写一段角色初次登场的描写' }),
    );
    expect(routeResponse.statusCode).toBe(200);
    expect((routeResponse.body as Record<string, unknown>)['level']).toBe('L2');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一段角色初次登场的描写', level: 'L2' }),
    );
    expect(planResponse.statusCode).toBe(200);
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);
    expect(planId).toBeTruthy();

    let executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }),
    );
    expect(executeResponse.statusCode).toBe(200);
    expect((executeResponse.body as Record<string, unknown>)['step_name']).toBe('analyze');

    executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }),
    );
    expect((executeResponse.body as Record<string, unknown>)['step_name']).toBe('match_skills');

    executeResponse = await workflowExecuteEndpoint(
      makeRequest({ plan_id: planId }),
    );
    expect((executeResponse.body as Record<string, unknown>)['step_name']).toBe('generate');
    expect((executeResponse.body as Record<string, unknown>)['plan_status']).toBe('completed');
  });

  it('supports lifecycle endpoint over a real workflow plan', async () => {
    const {
      workflowPlanEndpoint,
      workflowLifecycleEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一章并逐步完善冲突与细节', level: 'L3' }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const pauseResponse = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'pause' }),
    );
    expect(pauseResponse.statusCode).toBe(200);
    expect((pauseResponse.body as Record<string, unknown>)['runner_state']).toBe('paused');
    expect((pauseResponse.body as Record<string, unknown>)['checkpoint_id']).toBeTruthy();

    const statusResponse = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'status' }),
    );
    expect((statusResponse.body as Record<string, unknown>)['runner_state']).toBe('paused');

    const resumeResponse = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'resume' }),
    );
    expect((resumeResponse.body as Record<string, unknown>)['runner_state']).toBe('running');
  });

  it('blocks destructive execute until confirm token is provided', async () => {
    const {
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一段需要覆盖旧稿的修订', level: 'L2' }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const destructiveRecommendations = [
      { title: '覆盖旧稿', action: 'overwrite existing content' },
    ];

    const blockedResponse = await workflowExecuteEndpoint(
      makeRequest({
        plan_id: planId,
        recommendations: destructiveRecommendations,
      }),
    );
    expect(blockedResponse.statusCode).toBe(200);
    expect((blockedResponse.body as Record<string, unknown>)['status']).toBe('waiting_confirmation');
    expect(((blockedResponse.body as Record<string, unknown>)['gate'] as Record<string, unknown>)['confirm_required']).toBe(true);
    expect(((blockedResponse.body as Record<string, unknown>)['gate'] as Record<string, unknown>)['destructive']).toBe(true);

    const confirmedResponse = await workflowExecuteEndpoint(
      makeRequest({
        plan_id: planId,
        recommendations: destructiveRecommendations,
        confirm_token: 'approved-token',
      }),
    );
    expect((confirmedResponse.body as Record<string, unknown>)['status']).toBe('completed');
    expect((confirmedResponse.body as Record<string, unknown>)['step_name']).toBe('analyze');
  });

  it('supports checkpoint create/list and quick rollback through workflow endpoints', async () => {
    const {
      workflowPlanEndpoint,
      workflowLifecycleEndpoint,
      workflowQuickRollbackEndpoint,
      checkpointListEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一章并逐步完善冲突与细节', level: 'L3' }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const pauseResponse = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'pause' }),
    );
    const checkpointId = String((pauseResponse.body as Record<string, unknown>)['checkpoint_id']);
    expect(checkpointId).toBeTruthy();

    const listResponse = await checkpointListEndpoint(
      makeRequest({ limit: 10 }),
    );
    expect(listResponse.statusCode).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect((listResponse.body as Array<Record<string, unknown>>).some(item => item['id'] === checkpointId)).toBe(true);

    const rollbackResponse = await workflowQuickRollbackEndpoint(
      makeRequest({
        plan_id: planId,
        checkpoint_id: checkpointId,
        reason: 'integration rollback test',
      }),
    );
    expect(rollbackResponse.statusCode).toBe(200);
    expect((rollbackResponse.body as Record<string, unknown>)['plan_id']).toBe(planId);
    expect((rollbackResponse.body as Record<string, unknown>)['checkpoint_id']).toBe(checkpointId);
    expect((rollbackResponse.body as Record<string, unknown>)['restore']).toBeTruthy();
  });

  it('scopes checkpoint create/list and restore to the request workspace authority', async () => {
    const {
      workflowPlanEndpoint,
      workflowLifecycleEndpoint,
      checkpointCreateEndpoint,
      checkpointListEndpoint,
      checkpointRestoreEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-a', 'atlas-workspace', 'atlas-project');
    const workspaceB = buildWorkspace('workflow-session-b', 'beacon-workspace', 'beacon-project');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({
        task: '写一章并逐步完善冲突与细节',
        level: 'L3',
        workspace: workspaceA,
      }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const pauseResponse = await workflowLifecycleEndpoint(
      makeRequest({
        plan_id: planId,
        action: 'pause',
        workspace: workspaceA,
      }),
    );
    const planCheckpointId = String((pauseResponse.body as Record<string, unknown>)['checkpoint_id']);
    expect(planCheckpointId).toBeTruthy();

    const createResponse = await checkpointCreateEndpoint(
      makeRequest({
        description: 'manual checkpoint',
        auto_commit: false,
        workspace: workspaceA,
      }),
    );
    expect(createResponse.statusCode).toBe(200);
    const manualCheckpointId = String((createResponse.body as Record<string, unknown>)['checkpoint_id']);
    expect(manualCheckpointId).toBeTruthy();

    const visibleList = await checkpointListEndpoint(
      makeRequest({ limit: 10, workspace: workspaceA }),
    );
    expect(visibleList.statusCode).toBe(200);
    expect(Array.isArray(visibleList.body)).toBe(true);
    expect(
      (visibleList.body as Array<Record<string, unknown>>).some((item) => item['id'] === planCheckpointId),
    ).toBe(true);
    expect(
      (visibleList.body as Array<Record<string, unknown>>).some((item) => item['id'] === manualCheckpointId),
    ).toBe(true);

    const hiddenList = await checkpointListEndpoint(
      makeRequest({ limit: 10, workspace: workspaceB }),
    );
    expect(hiddenList.statusCode).toBe(200);
    expect(
      (hiddenList.body as Array<Record<string, unknown>>).some((item) => item['id'] === planCheckpointId),
    ).toBe(false);
    expect(
      (hiddenList.body as Array<Record<string, unknown>>).some((item) => item['id'] === manualCheckpointId),
    ).toBe(false);

    const mismatchedPlanRestore = await checkpointRestoreEndpoint(
      makeRequest({ checkpoint_id: planCheckpointId, workspace: workspaceB }),
    );
    expect((mismatchedPlanRestore.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );

    const mismatchedManualRestore = await checkpointRestoreEndpoint(
      makeRequest({ checkpoint_id: manualCheckpointId, workspace: workspaceB }),
    );
    expect((mismatchedManualRestore.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );

    const matchingManualRestore = await checkpointRestoreEndpoint(
      makeRequest({ checkpoint_id: manualCheckpointId, workspace: workspaceA }),
    );
    expect((matchingManualRestore.body as Record<string, unknown>)['error']).toBe(
      'No commit hash available for this checkpoint',
    );
  });
});
