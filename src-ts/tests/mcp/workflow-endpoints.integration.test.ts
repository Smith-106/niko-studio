import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
    authority: {
      recordSetId: null,
      activeSceneId: null,
      activeEventId: null,
      activeTimelineId: null,
      consistencyRunId: null,
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

  it('runs revision session endpoints through the workflow surface', async () => {
    const {
      workflowRevisionStartSessionEndpoint,
      workflowRevisionAnalyzeEndpoint,
      workflowRevisionSuggestEndpoint,
      workflowRevisionMarkRevisedEndpoint,
      workflowRevisionCompareEndpoint,
      workflowRevisionHistoryEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-revision', 'atlas-workspace', 'atlas-project');
    const originalText = '林岚攥着匿名信站在门口，她决定先等等再说。老陈只提醒她不要轻举妄动。';
    const revisedText = '林岚攥着匿名信站在门口，雨声像倒计时一样压向走廊。老陈提醒她不要轻举妄动，她却从信纸背面看见了只有死者才知道的暗号。';

    const started = await workflowRevisionStartSessionEndpoint(
      makeRequest({
        chapter_id: 'chapter-2',
        content: originalText,
        workspace: workspaceA,
      }),
    );
    expect(started.statusCode).toBe(200);
    const sessionId = String((started.body as Record<string, unknown>)['session_id']);
    expect(sessionId).toBeTruthy();

    const analyzed = await workflowRevisionAnalyzeEndpoint(
      makeRequest({
        session_id: sessionId,
        workspace: workspaceA,
      }),
    );
    expect((analyzed.body as Record<string, unknown>)['status']).toBe('ANALYZED');
    expect(Array.isArray((analyzed.body as Record<string, unknown>)['weak_points'])).toBe(true);

    const suggested = await workflowRevisionSuggestEndpoint(
      makeRequest({
        session_id: sessionId,
        workspace: workspaceA,
      }),
    );
    expect((suggested.body as Record<string, unknown>)['status']).toBe('SUGGESTED');
    expect(Array.isArray((suggested.body as Record<string, unknown>)['suggestions'])).toBe(true);

    const marked = await workflowRevisionMarkRevisedEndpoint(
      makeRequest({
        session_id: sessionId,
        revised_text: revisedText,
        workspace: workspaceA,
      }),
    );
    expect((marked.body as Record<string, unknown>)['status']).toBe('REVISED');

    const compared = await workflowRevisionCompareEndpoint(
      makeRequest({
        session_id: sessionId,
        workspace: workspaceA,
      }),
    );
    expect((compared.body as Record<string, unknown>)['status']).toBe('COMPARED');
    expect(((compared.body as Record<string, unknown>)['comparison'] as Record<string, unknown>)['summary']).toBeTruthy();

    const history = await workflowRevisionHistoryEndpoint(
      makeRequest({
        chapter_id: 'chapter-2',
        workspace: workspaceA,
      }),
    );
    expect((history.body as Record<string, unknown>)['total']).toBe(1);
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

  it('requires confirm token for destructive checkpoint restore and succeeds after confirmation', async () => {
    const {
      workflowPlanEndpoint,
      workflowLifecycleEndpoint,
      checkpointRestoreEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({ task: '写一章并逐步完善冲突与细节', level: 'L3' }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const pauseResponse = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'pause' }),
    );
    const checkpointId = String((pauseResponse.body as Record<string, unknown>)['checkpoint_id']);

    const blockedRestore = await checkpointRestoreEndpoint(
      makeRequest({ checkpoint_id: checkpointId }),
    );
    expect((blockedRestore.body as Record<string, unknown>)['status']).toBe('waiting_confirmation');
    expect((blockedRestore.body as Record<string, unknown>)['error']).toContain('destructive restore requires secondary confirmation');

    const confirmedRestore = await checkpointRestoreEndpoint(
      makeRequest({ checkpoint_id: checkpointId, confirm_token: 'approved-token' }),
    );
    expect((confirmedRestore.body as Record<string, unknown>)['status']).toBe('restored');
  });

  it('does not persist checkpoint state when quick rollback restore fails', async () => {
    const {
      workflowPlanEndpoint,
      workflowQuickRollbackEndpoint,
      workflowLifecycleEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-rollback', 'atlas-workspace', 'atlas-project');

    const planResponse = await workflowPlanEndpoint(
      makeRequest({
        task: '写一章并逐步完善冲突与细节',
        level: 'L3',
        workspace: workspaceA,
      }),
    );
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);

    const statusBefore = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'status', workspace: workspaceA }),
    );
    expect((statusBefore.body as Record<string, unknown>)['last_checkpoint_id']).toBe('');

    const failedRollback = await workflowQuickRollbackEndpoint(
      makeRequest({
        plan_id: planId,
        checkpoint_id: 'missing-checkpoint',
        reason: 'force failure branch',
        workspace: workspaceA,
      }),
    );

    const rollbackBody = failedRollback.body as Record<string, unknown>;
    expect(rollbackBody['restored']).toBe(false);
    expect(rollbackBody['reason']).toBe('force failure branch');
    expect((rollbackBody['restore'] as Record<string, unknown>)['error']).toContain("Checkpoint 'missing-checkpoint' not found");

    const statusAfter = await workflowLifecycleEndpoint(
      makeRequest({ plan_id: planId, action: 'status', workspace: workspaceA }),
    );
    expect((statusAfter.body as Record<string, unknown>)['last_checkpoint_id']).toBe('');
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


  it('imports lite-plan tasks into scheduler with force level and workspace authority', async () => {
    const {
      workflowSchedulerImportLitePlanEndpoint,
      workflowSchedulerListEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-a', 'atlas-workspace', 'atlas-project');
    const workspaceB = buildWorkspace('workflow-session-b', 'beacon-workspace', 'beacon-project');

    const sessionId = 'session-import-001';
    const planDir = join(workspace, '.workflow', '.lite-plan', sessionId);
    const taskDir = join(planDir, '.task');
    await mkdir(taskDir, { recursive: true });

    await writeFile(
      join(planDir, 'plan.json'),
      JSON.stringify({
        summary: 'import scheduler test',
        approach: 'integration',
        task_ids: ['TASK-001'],
      }),
      'utf-8',
    );

    await writeFile(
      join(taskDir, 'TASK-001.json'),
      JSON.stringify({
        id: 'TASK-001',
        title: '导入后任务',
        description: '推进章节修订并收敛',
        scope: 'chapter-revision',
      }),
      'utf-8',
    );

    const importResponse = await workflowSchedulerImportLitePlanEndpoint(
      makeRequest({
        session_id: sessionId,
        force_level: 'L5',
        enabled: true,
        workspace: workspaceA,
      }),
    );

    expect(importResponse.statusCode).toBe(200);
    const importBody = importResponse.body as Record<string, unknown>;
    expect(importBody['session_id']).toBe(sessionId);
    expect(importBody['imported']).toBe(1);
    expect(importBody['registered']).toBe(1);
    expect(importBody['failed']).toBe(0);
    expect(importBody['force_level']).toBe('L5');

    const importedTasks = importBody['tasks'] as Array<Record<string, unknown>>;
    expect(Array.isArray(importedTasks)).toBe(true);
    expect(importedTasks[0]?.['task_id']).toBe('lite-session-import-001-task-001');
    expect(importedTasks[0]?.['level']).toBe('L5');
    expect(importedTasks[0]?.['status']).toBe('active');

    const listAResponse = await workflowSchedulerListEndpoint(makeRequest({ workspace: workspaceA }));
    expect(listAResponse.statusCode).toBe(200);
    const tasksA = (listAResponse.body as Record<string, unknown>)['tasks'] as Array<Record<string, unknown>>;
    expect(tasksA.some((item) => item['task_id'] === 'lite-session-import-001-task-001')).toBe(true);

    const listBResponse = await workflowSchedulerListEndpoint(makeRequest({ workspace: workspaceB }));
    expect(listBResponse.statusCode).toBe(200);
    const tasksB = (listBResponse.body as Record<string, unknown>)['tasks'] as Array<Record<string, unknown>>;
    expect(tasksB.some((item) => item['task_id'] === 'lite-session-import-001-task-001')).toBe(false);
  });

  it('supports workflow scheduler register/list/pause/resume/run-now with workspace authority guards', async () => {
    const {
      workflowSchedulerRegisterEndpoint,
      workflowSchedulerListEndpoint,
      workflowSchedulerPauseEndpoint,
      workflowSchedulerResumeEndpoint,
      workflowSchedulerRunNowEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-a', 'atlas-workspace', 'atlas-project');
    const workspaceB = buildWorkspace('workflow-session-b', 'beacon-workspace', 'beacon-project');

    const schedulerTask = {
      task_id: 'sched-nightly-001',
      title: 'Nightly Automation',
      task: '推进项目到完成',
      level: 'L3',
      schedule_rule: {
        cadence: 'cron',
        cron: '0 2 * * *',
        timezone: 'Asia/Shanghai',
        enabled: true,
      },
      trigger_rule: {
        type: 'manual_run_now',
        run_now: true,
      },
      backend_mode_policy: {
        mode: 'inherit',
        fallback_mode: 'standard',
      },
      progression_policy: {
        success_statuses: ['completed'],
        approval_policy: {
          tiers: [
            {
              tier: 'critical',
              requires_confirmation: true,
              gate_status_on_hold: 'waiting_confirmation',
            },
          ],
          default_gate_status: 'waiting_confirmation',
        },
        failure_policy: {
          retry: {
            max_retries: 2,
            strategy: 'fixed',
            base_delay_ms: 1000,
          },
          on_retry_exhausted: 'manual_takeover',
          manual_takeover_status: 'gate_blocked',
        },
      },
    };

    const registerResponse = await workflowSchedulerRegisterEndpoint(
      makeRequest({ task: schedulerTask, workspace: workspaceA }),
    );
    expect(registerResponse.statusCode).toBe(200);
    expect((registerResponse.body as Record<string, unknown>)['status']).toBe('registered');

    const listAResponse = await workflowSchedulerListEndpoint(
      makeRequest({ workspace: workspaceA }),
    );
    expect(listAResponse.statusCode).toBe(200);
    expect(
      ((listAResponse.body as Record<string, unknown>)['tasks'] as Array<Record<string, unknown>>)
        .some((item) => item['task_id'] === 'sched-nightly-001'),
    ).toBe(true);

    const listBResponse = await workflowSchedulerListEndpoint(
      makeRequest({ workspace: workspaceB }),
    );
    expect(listBResponse.statusCode).toBe(200);
    expect(
      ((listBResponse.body as Record<string, unknown>)['tasks'] as Array<Record<string, unknown>>)
        .some((item) => item['task_id'] === 'sched-nightly-001'),
    ).toBe(false);

    const blockedPause = await workflowSchedulerPauseEndpoint(
      makeRequest({ task_id: 'sched-nightly-001', workspace: workspaceB }),
    );
    expect((blockedPause.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );

    const pauseA = await workflowSchedulerPauseEndpoint(
      makeRequest({ task_id: 'sched-nightly-001', workspace: workspaceA }),
    );
    expect((pauseA.body as Record<string, unknown>)['status']).toBe('paused');

    const resumeA = await workflowSchedulerResumeEndpoint(
      makeRequest({ task_id: 'sched-nightly-001', workspace: workspaceA }),
    );
    expect((resumeA.body as Record<string, unknown>)['status']).toBe('active');

    const blockedRunNow = await workflowSchedulerRunNowEndpoint(
      makeRequest({ task_id: 'sched-nightly-001', workspace: workspaceB }),
    );
    expect((blockedRunNow.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );

    const runNowResponse = await workflowSchedulerRunNowEndpoint(
      makeRequest({ task_id: 'sched-nightly-001', workspace: workspaceA }),
    );
    expect(runNowResponse.statusCode).toBe(200);
    expect((runNowResponse.body as Record<string, unknown>)['trigger']).toBe('manual_run_now');
    expect((runNowResponse.body as Record<string, unknown>)['plan_id']).toBeTruthy();
    expect((runNowResponse.body as Record<string, unknown>)['run_id']).toBeTruthy();
  });

  it('forwards request trace context to workflow plan service', async () => {
    const workflowService = await import('../../mcp/services/workflow.js');
    const spy = vi.spyOn(workflowService, 'workflowPlan');
    spy.mockResolvedValue({ plan_id: 'trace-plan' });

    const { workflowPlanEndpoint } = await import('../../mcp/endpoints/workflow.js');

    const request = makeRequest({ task: 'trace test', level: 'L2' });
    request.traceContext = {
      requestId: 'req-trace-1',
      route: '^/workflow/plan$',
      method: 'POST',
      startAtMs: 100,
    };

    const response = await workflowPlanEndpoint(request);

    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'trace test',
        level: 'L2',
        traceContext: {
          requestId: 'req-trace-1',
          route: '^/workflow/plan$',
          method: 'POST',
          startAtMs: 100,
        },
      }),
    );

    spy.mockRestore();
  });
});
