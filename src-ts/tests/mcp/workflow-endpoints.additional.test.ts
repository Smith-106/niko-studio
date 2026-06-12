import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const workflowRouteMock = vi.hoisted(() => vi.fn());
const workflowPlanMock = vi.hoisted(() => vi.fn());
const workflowExecuteMock = vi.hoisted(() => vi.fn());
const workflowQuickRollbackMock = vi.hoisted(() => vi.fn());
const workflowLifecycleMock = vi.hoisted(() => vi.fn());
const checkpointCreateMock = vi.hoisted(() => vi.fn());
const checkpointRestoreMock = vi.hoisted(() => vi.fn());
const checkpointListMock = vi.hoisted(() => vi.fn());
const workflowSchedulerRegisterMock = vi.hoisted(() => vi.fn());
const workflowSchedulerListMock = vi.hoisted(() => vi.fn());
const workflowSchedulerPauseMock = vi.hoisted(() => vi.fn());
const workflowSchedulerResumeMock = vi.hoisted(() => vi.fn());
const workflowSchedulerRunNowMock = vi.hoisted(() => vi.fn());
const workflowSchedulerImportLitePlanMock = vi.hoisted(() => vi.fn());

const workflowRevisionStartSessionMock = vi.hoisted(() => vi.fn());
const workflowRevisionAnalyzeWeakPointsMock = vi.hoisted(() => vi.fn());
const workflowRevisionGenerateSuggestionsMock = vi.hoisted(() => vi.fn());
const workflowRevisionMarkRevisedMock = vi.hoisted(() => vi.fn());
const workflowRevisionCompareMock = vi.hoisted(() => vi.fn());
const workflowRevisionHistoryMock = vi.hoisted(() => vi.fn());

const normalizeProjectWorkspaceContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/workflow', () => ({
  workflowRoute: workflowRouteMock,
  workflowPlan: workflowPlanMock,
  workflowExecute: workflowExecuteMock,
  workflowQuickRollback: workflowQuickRollbackMock,
  workflowLifecycle: workflowLifecycleMock,
  checkpointCreate: checkpointCreateMock,
  checkpointRestore: checkpointRestoreMock,
  checkpointList: checkpointListMock,
  workflowSchedulerRegister: workflowSchedulerRegisterMock,
  workflowSchedulerList: workflowSchedulerListMock,
  workflowSchedulerPause: workflowSchedulerPauseMock,
  workflowSchedulerResume: workflowSchedulerResumeMock,
  workflowSchedulerRunNow: workflowSchedulerRunNowMock,
  workflowSchedulerImportLitePlan: workflowSchedulerImportLitePlanMock,
}));

vi.mock('../../mcp/services/workflow-revision', () => ({
  workflowRevisionStartSession: workflowRevisionStartSessionMock,
  workflowRevisionAnalyzeWeakPoints: workflowRevisionAnalyzeWeakPointsMock,
  workflowRevisionGenerateSuggestions: workflowRevisionGenerateSuggestionsMock,
  workflowRevisionMarkRevised: workflowRevisionMarkRevisedMock,
  workflowRevisionCompare: workflowRevisionCompareMock,
  workflowRevisionHistory: workflowRevisionHistoryMock,
}));

vi.mock('../../project/workspace-model.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../project/workspace-model.js')>();
  return {
    ...actual,
    normalizeProjectWorkspaceContext: normalizeProjectWorkspaceContextMock,
  };
});

function makeRequest(body: unknown): HttpRequest {
  return {
    method: 'POST',
    url: '/workflow/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function buildNormalizedWorkspace(seed: Record<string, unknown> = {}) {
  const workflowSessionId =
    typeof seed['session_id'] === 'string' ? seed['session_id'] : 'workflow-session-seed';
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas Project',
      workspaceRoot: 'normalized-before-override',
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-1',
      chapterTitle: null,
      chapterNumber: 1,
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
      sessionId: workflowSessionId,
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: workflowSessionId,
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

function expectWorkspace(workspaceRoot: string) {
  return expect.objectContaining({
    identity: expect.objectContaining({
      workspaceRoot,
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    }),
    workflow: expect.objectContaining({
      level: 'L3',
    }),
  });
}

describe('workflow endpoints additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];

    normalizeProjectWorkspaceContextMock.mockImplementation((body: unknown) =>
      buildNormalizedWorkspace((body ?? {}) as Record<string, unknown>),
    );
  });

  afterEach(() => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('maps workflow endpoint payloads and defaults with the configured workspace root', async () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '  C:/tmp/workflow-root  ';
    workflowRouteMock.mockResolvedValue({ level: 'L2', route: 'route-result' });
    workflowPlanMock.mockResolvedValue({ plan_id: 'plan-1' });
    workflowExecuteMock.mockResolvedValue({ status: 'executed' });
    workflowLifecycleMock.mockResolvedValue({ runner_state: 'paused' });
    workflowQuickRollbackMock.mockResolvedValue({ restored: false });

    const {
      workflowRouteEndpoint,
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
      workflowLifecycleEndpoint,
      workflowQuickRollbackEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const routeResponse = await workflowRouteEndpoint(makeRequest({}));
    expect(routeResponse.statusCode).toBe(200);
    expect(workflowRouteMock).toHaveBeenCalledWith('', expectWorkspace('C:/tmp/workflow-root'));
    expect(normalizeProjectWorkspaceContextMock).toHaveBeenNthCalledWith(
      1,
      {},
      { workspaceRoot: 'C:/tmp/workflow-root' },
    );
    expect(routeResponse.body).toEqual(
      expect.objectContaining({
        level: 'L2',
        workspace: expectWorkspace('C:/tmp/workflow-root'),
      }),
    );

    const planResponse = await workflowPlanEndpoint(
      makeRequest({
        task: '整理章节计划',
        level: 'L2',
        recommendations: { mode: 'careful' },
        genre: 'mystery',
      }),
    );
    expect(planResponse.statusCode).toBe(200);
    expect(workflowPlanMock).toHaveBeenCalledWith({
      task: '整理章节计划',
      level: 'L2',
      recommendations: { mode: 'careful' },
      traceContext: null,
      genre: 'mystery',
      workspace: expectWorkspace('C:/tmp/workflow-root'),
    });

    const executeResponse = await workflowExecuteEndpoint(makeRequest({ plan_id: 'plan-1' }));
    expect(executeResponse.statusCode).toBe(200);
    expect(workflowExecuteMock).toHaveBeenCalledWith({
      planId: 'plan-1',
      stepId: undefined,
      recommendations: undefined,
      confirmToken: undefined,
      workspace: expectWorkspace('C:/tmp/workflow-root'),
    });

    const lifecycleResponse = await workflowLifecycleEndpoint(makeRequest({ plan_id: 'plan-1' }));
    expect(lifecycleResponse.statusCode).toBe(200);
    expect(workflowLifecycleMock).toHaveBeenCalledWith(
      'plan-1',
      'status',
      expectWorkspace('C:/tmp/workflow-root'),
    );

    const rollbackResponse = await workflowQuickRollbackEndpoint(
      makeRequest({
        plan_id: 'plan-1',
        checkpoint_id: 'checkpoint-1',
      }),
    );
    expect(rollbackResponse.statusCode).toBe(200);
    expect(workflowQuickRollbackMock).toHaveBeenCalledWith({
      planId: 'plan-1',
      checkpointId: 'checkpoint-1',
      reason: '',
      workspace: expectWorkspace('C:/tmp/workflow-root'),
    });
  });

  it('maps revision endpoints, filters weak point ids, and falls back to process.cwd for workspace root', async () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '   ';
    workflowRevisionStartSessionMock.mockResolvedValue({ session_id: 'revision-1' });
    workflowRevisionAnalyzeWeakPointsMock.mockResolvedValue({ weak_points: [] });
    workflowRevisionGenerateSuggestionsMock
      .mockResolvedValueOnce({ suggestions: ['s-1'] })
      .mockResolvedValueOnce({ suggestions: [] });
    workflowRevisionMarkRevisedMock.mockResolvedValue({ status: 'saved' });
    workflowRevisionCompareMock.mockResolvedValue({ comparison: { changed: true } });
    workflowRevisionHistoryMock.mockResolvedValue({ sessions: [] });

    const {
      workflowRevisionStartSessionEndpoint,
      workflowRevisionAnalyzeEndpoint,
      workflowRevisionSuggestEndpoint,
      workflowRevisionMarkRevisedEndpoint,
      workflowRevisionCompareEndpoint,
      workflowRevisionHistoryEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const cwd = process.cwd();

    await workflowRevisionStartSessionEndpoint(
      makeRequest({
        chapter_id: 'chapter-9',
        content: '章节草稿',
      }),
    );
    expect(normalizeProjectWorkspaceContextMock).toHaveBeenNthCalledWith(
      1,
      { chapter_id: 'chapter-9', content: '章节草稿' },
      { workspaceRoot: cwd },
    );
    expect(workflowRevisionStartSessionMock).toHaveBeenCalledWith({
      chapterId: 'chapter-9',
      content: '章节草稿',
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionAnalyzeEndpoint(makeRequest({ session_id: 'revision-1' }));
    expect(workflowRevisionAnalyzeWeakPointsMock).toHaveBeenCalledWith({
      sessionId: 'revision-1',
      content: undefined,
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionSuggestEndpoint(
      makeRequest({
        session_id: 'revision-1',
        weak_point_ids: ['wp-1', 2, null, 'wp-2'],
      }),
    );
    expect(workflowRevisionGenerateSuggestionsMock).toHaveBeenNthCalledWith(1, {
      sessionId: 'revision-1',
      weakPointIds: ['wp-1', 'wp-2'],
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionSuggestEndpoint(
      makeRequest({
        session_id: 'revision-1',
        weak_point_ids: 'not-an-array',
      }),
    );
    expect(workflowRevisionGenerateSuggestionsMock).toHaveBeenNthCalledWith(2, {
      sessionId: 'revision-1',
      weakPointIds: null,
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionMarkRevisedEndpoint(makeRequest({}));
    expect(workflowRevisionMarkRevisedMock).toHaveBeenCalledWith({
      sessionId: '',
      revisedText: '',
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionCompareEndpoint(
      makeRequest({
        session_id: 'revision-1',
        revised_text: null,
      }),
    );
    expect(workflowRevisionCompareMock).toHaveBeenCalledWith({
      sessionId: 'revision-1',
      revisedText: null,
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionHistoryEndpoint(makeRequest({ chapter_id: 'chapter-9' }));
    expect(workflowRevisionHistoryMock).toHaveBeenCalledWith({
      chapterId: 'chapter-9',
      workspace: expectWorkspace(cwd),
    });
  });

  it('maps scheduler endpoint payloads, defaults, and optional fields', async () => {
    workflowSchedulerRegisterMock.mockResolvedValue({ task_id: 'task-1' });
    workflowSchedulerListMock.mockResolvedValue({ tasks: [] });
    workflowSchedulerPauseMock.mockResolvedValue({ status: 'paused' });
    workflowSchedulerResumeMock.mockResolvedValue({ status: 'active' });
    workflowSchedulerRunNowMock.mockResolvedValue({ run_id: 'run-1' });
    workflowSchedulerImportLitePlanMock.mockResolvedValue({ imported: 0 });

    const {
      workflowSchedulerRegisterEndpoint,
      workflowSchedulerListEndpoint,
      workflowSchedulerPauseEndpoint,
      workflowSchedulerResumeEndpoint,
      workflowSchedulerRunNowEndpoint,
      workflowSchedulerImportLitePlanEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const cwd = process.cwd();

    await workflowSchedulerRegisterEndpoint(
      makeRequest({
        task: { cron: '0 0 * * *', prompt: 'nightly task' },
        enabled: false,
      }),
    );
    expect(workflowSchedulerRegisterMock).toHaveBeenCalledWith({
      definition: { cron: '0 0 * * *', prompt: 'nightly task' },
      enabled: false,
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerListEndpoint(makeRequest({}));
    expect(workflowSchedulerListMock).toHaveBeenCalledWith({
      limit: undefined,
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerPauseEndpoint(makeRequest({}));
    expect(workflowSchedulerPauseMock).toHaveBeenCalledWith({
      taskId: '',
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerResumeEndpoint(makeRequest({ task_id: 'task-2' }));
    expect(workflowSchedulerResumeMock).toHaveBeenCalledWith({
      taskId: 'task-2',
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerRunNowEndpoint(
      makeRequest({
        task_id: 'task-3',
        confirm_token: 'confirm-1',
        recommendations: { level: 'L3' },
      }),
    );
    expect(workflowSchedulerRunNowMock).toHaveBeenCalledWith({
      taskId: 'task-3',
      confirmToken: 'confirm-1',
      recommendations: { level: 'L3' },
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerImportLitePlanEndpoint(makeRequest({}));
    expect(workflowSchedulerImportLitePlanMock).toHaveBeenCalledWith({
      sessionId: null,
      forceLevel: null,
      enabled: undefined,
      workspace: expectWorkspace(cwd),
    });
  });

  it('falls back to empty identifiers and default checkpoint fields when payload keys are missing', async () => {
    workflowPlanMock.mockResolvedValue({ plan_id: 'fallback-plan' });
    workflowExecuteMock.mockResolvedValue({ status: 'queued' });
    workflowLifecycleMock.mockResolvedValue({ runner_state: 'idle' });
    workflowQuickRollbackMock.mockResolvedValue({ restored: false });
    workflowRevisionStartSessionMock.mockResolvedValue({ session_id: 'revision-fallback' });
    workflowRevisionAnalyzeWeakPointsMock.mockResolvedValue({ weak_points: [] });
    workflowRevisionGenerateSuggestionsMock.mockResolvedValue({ suggestions: [] });
    workflowRevisionCompareMock.mockResolvedValue({ comparison: { changed: false } });
    workflowRevisionHistoryMock.mockResolvedValue({ sessions: [] });
    workflowSchedulerResumeMock.mockResolvedValue({ status: 'resumed' });
    workflowSchedulerRunNowMock.mockResolvedValue({ run_id: 'run-fallback' });
    checkpointCreateMock.mockResolvedValue({ checkpoint_id: 'checkpoint-fallback' });
    checkpointRestoreMock.mockResolvedValue({ restored: false });

    const {
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
      workflowLifecycleEndpoint,
      workflowQuickRollbackEndpoint,
      workflowRevisionStartSessionEndpoint,
      workflowRevisionAnalyzeEndpoint,
      workflowRevisionSuggestEndpoint,
      workflowRevisionCompareEndpoint,
      workflowRevisionHistoryEndpoint,
      workflowSchedulerResumeEndpoint,
      workflowSchedulerRunNowEndpoint,
      checkpointCreateEndpoint,
      checkpointRestoreEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const cwd = process.cwd();

    await workflowPlanEndpoint(makeRequest({ level: 'L4' }));
    expect(workflowPlanMock).toHaveBeenLastCalledWith({
      task: '',
      level: 'L4',
      recommendations: undefined,
      traceContext: null,
      genre: undefined,
      workspace: expectWorkspace(cwd),
    });

    await workflowExecuteEndpoint(makeRequest({ step_id: 'step-2' }));
    expect(workflowExecuteMock).toHaveBeenLastCalledWith({
      planId: '',
      stepId: 'step-2',
      recommendations: undefined,
      confirmToken: undefined,
      workspace: expectWorkspace(cwd),
    });

    await workflowLifecycleEndpoint(makeRequest({ action: 'resume' }));
    expect(workflowLifecycleMock).toHaveBeenLastCalledWith(
      '',
      'resume',
      expectWorkspace(cwd),
    );

    await workflowQuickRollbackEndpoint(makeRequest({ reason: 'manual rollback' }));
    expect(workflowQuickRollbackMock).toHaveBeenLastCalledWith({
      planId: '',
      checkpointId: '',
      reason: 'manual rollback',
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionStartSessionEndpoint(makeRequest({}));
    expect(workflowRevisionStartSessionMock).toHaveBeenLastCalledWith({
      chapterId: '',
      content: '',
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionAnalyzeEndpoint(makeRequest({ content: null }));
    expect(workflowRevisionAnalyzeWeakPointsMock).toHaveBeenLastCalledWith({
      sessionId: '',
      content: null,
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionSuggestEndpoint(makeRequest({}));
    expect(workflowRevisionGenerateSuggestionsMock).toHaveBeenLastCalledWith({
      sessionId: '',
      weakPointIds: null,
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionCompareEndpoint(makeRequest({ revised_text: 'updated copy' }));
    expect(workflowRevisionCompareMock).toHaveBeenLastCalledWith({
      sessionId: '',
      revisedText: 'updated copy',
      workspace: expectWorkspace(cwd),
    });

    await workflowRevisionHistoryEndpoint(makeRequest({}));
    expect(workflowRevisionHistoryMock).toHaveBeenLastCalledWith({
      chapterId: '',
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerResumeEndpoint(makeRequest({}));
    expect(workflowSchedulerResumeMock).toHaveBeenLastCalledWith({
      taskId: '',
      workspace: expectWorkspace(cwd),
    });

    await workflowSchedulerRunNowEndpoint(makeRequest({}));
    expect(workflowSchedulerRunNowMock).toHaveBeenLastCalledWith({
      taskId: '',
      confirmToken: undefined,
      recommendations: undefined,
      workspace: expectWorkspace(cwd),
    });

    await checkpointCreateEndpoint(makeRequest({ auto_commit: false }));
    expect(checkpointCreateMock).toHaveBeenLastCalledWith(
      '',
      false,
      expectWorkspace(cwd),
    );

    await checkpointRestoreEndpoint(makeRequest({}));
    expect(checkpointRestoreMock).toHaveBeenLastCalledWith(
      '',
      undefined,
      expectWorkspace(cwd),
    );
  });

  it('returns 403 for every ui bridge wrapper while disabled', async () => {
    const {
      uiBridgeWorkflowRouteEndpoint,
      uiBridgeWorkflowPlanEndpoint,
      uiBridgeWorkflowExecuteEndpoint,
      uiBridgeWorkflowLifecycleEndpoint,
      uiBridgeWorkflowSchedulerRegisterEndpoint,
      uiBridgeWorkflowSchedulerListEndpoint,
      uiBridgeWorkflowSchedulerPauseEndpoint,
      uiBridgeWorkflowSchedulerResumeEndpoint,
      uiBridgeWorkflowSchedulerRunNowEndpoint,
      uiBridgeWorkflowSchedulerImportLitePlanEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const wrappers = [
      uiBridgeWorkflowRouteEndpoint,
      uiBridgeWorkflowPlanEndpoint,
      uiBridgeWorkflowExecuteEndpoint,
      uiBridgeWorkflowLifecycleEndpoint,
      uiBridgeWorkflowSchedulerRegisterEndpoint,
      uiBridgeWorkflowSchedulerListEndpoint,
      uiBridgeWorkflowSchedulerPauseEndpoint,
      uiBridgeWorkflowSchedulerResumeEndpoint,
      uiBridgeWorkflowSchedulerRunNowEndpoint,
      uiBridgeWorkflowSchedulerImportLitePlanEndpoint,
    ];

    for (const wrapper of wrappers) {
      await expect(wrapper(makeRequest({}))).resolves.toEqual({
        statusCode: 403,
        body: {
          error: 'UI Bridge is disabled',
          status: 'disabled',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  });

  it('forwards every ui bridge wrapper while enabled', async () => {
    workflowRouteMock.mockResolvedValue({ level: 'L2' });
    workflowPlanMock.mockResolvedValue({ plan_id: 'plan-ui' });
    workflowExecuteMock.mockResolvedValue({ status: 'ok' });
    workflowLifecycleMock.mockResolvedValue({ runner_state: 'active' });
    workflowSchedulerRegisterMock.mockResolvedValue({ task_id: 'task-ui' });
    workflowSchedulerListMock.mockResolvedValue({ tasks: [] });
    workflowSchedulerPauseMock.mockResolvedValue({ status: 'paused' });
    workflowSchedulerResumeMock.mockResolvedValue({ status: 'active' });
    workflowSchedulerRunNowMock.mockResolvedValue({ run_id: 'run-ui' });
    workflowSchedulerImportLitePlanMock.mockResolvedValue({ imported: 1 });

    const {
      setUiBridgeEnabled,
      uiBridgeWorkflowRouteEndpoint,
      uiBridgeWorkflowPlanEndpoint,
      uiBridgeWorkflowExecuteEndpoint,
      uiBridgeWorkflowLifecycleEndpoint,
      uiBridgeWorkflowSchedulerRegisterEndpoint,
      uiBridgeWorkflowSchedulerListEndpoint,
      uiBridgeWorkflowSchedulerPauseEndpoint,
      uiBridgeWorkflowSchedulerResumeEndpoint,
      uiBridgeWorkflowSchedulerRunNowEndpoint,
      uiBridgeWorkflowSchedulerImportLitePlanEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    setUiBridgeEnabled(true);

    await uiBridgeWorkflowRouteEndpoint(makeRequest({ task: 'route task' }));
    await uiBridgeWorkflowPlanEndpoint(makeRequest({ task: 'plan task' }));
    await uiBridgeWorkflowExecuteEndpoint(makeRequest({ plan_id: 'plan-ui' }));
    await uiBridgeWorkflowLifecycleEndpoint(makeRequest({ plan_id: 'plan-ui', action: 'resume' }));
    await uiBridgeWorkflowSchedulerRegisterEndpoint(makeRequest({ task: { cron: '* * * * *' } }));
    await uiBridgeWorkflowSchedulerListEndpoint(makeRequest({ limit: 3 }));
    await uiBridgeWorkflowSchedulerPauseEndpoint(makeRequest({ task_id: 'task-ui' }));
    await uiBridgeWorkflowSchedulerResumeEndpoint(makeRequest({ task_id: 'task-ui' }));
    await uiBridgeWorkflowSchedulerRunNowEndpoint(makeRequest({ task_id: 'task-ui' }));
    await uiBridgeWorkflowSchedulerImportLitePlanEndpoint(
      makeRequest({
        session_id: 'session-ui',
        force_level: 'L2',
        enabled: true,
      }),
    );

    expect(workflowRouteMock).toHaveBeenCalledWith('route task', expect.any(Object));
    expect(workflowPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'plan task',
      }),
    );
    expect(workflowExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-ui',
      }),
    );
    expect(workflowLifecycleMock).toHaveBeenCalledWith('plan-ui', 'resume', expect.any(Object));
    expect(workflowSchedulerRegisterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: { cron: '* * * * *' },
      }),
    );
    expect(workflowSchedulerListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 3,
      }),
    );
    expect(workflowSchedulerPauseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-ui',
      }),
    );
    expect(workflowSchedulerResumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-ui',
      }),
    );
    expect(workflowSchedulerRunNowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-ui',
      }),
    );
    expect(workflowSchedulerImportLitePlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-ui',
        forceLevel: 'L2',
        enabled: true,
      }),
    );
  });

  it('maps checkpoint endpoints and applies default checkpoint values', async () => {
    checkpointCreateMock.mockResolvedValue({ checkpoint_id: 'checkpoint-1' });
    checkpointRestoreMock.mockResolvedValue({ restored: true });
    checkpointListMock.mockResolvedValue([{ id: 'checkpoint-1' }]);

    const {
      checkpointCreateEndpoint,
      checkpointRestoreEndpoint,
      checkpointListEndpoint,
    } = await import('../../mcp/endpoints/workflow.js');

    const createResponse = await checkpointCreateEndpoint(
      makeRequest({
        description: 'manual checkpoint',
      }),
    );
    expect(createResponse.statusCode).toBe(200);
    expect(checkpointCreateMock).toHaveBeenCalledWith(
      'manual checkpoint',
      true,
      expectWorkspace(process.cwd()),
    );
    expect(createResponse.body).toEqual({ checkpoint_id: 'checkpoint-1' });

    const restoreResponse = await checkpointRestoreEndpoint(
      makeRequest({
        checkpoint_id: 'checkpoint-1',
        confirm_token: 'restore-token',
      }),
    );
    expect(restoreResponse.statusCode).toBe(200);
    expect(checkpointRestoreMock).toHaveBeenCalledWith(
      'checkpoint-1',
      'restore-token',
      expectWorkspace(process.cwd()),
    );
    expect(restoreResponse.body).toEqual({ restored: true });

    const listResponse = await checkpointListEndpoint(makeRequest({}));
    expect(listResponse.statusCode).toBe(200);
    expect(checkpointListMock).toHaveBeenCalledWith(10, expectWorkspace(process.cwd()));
    expect(listResponse.body).toEqual([{ id: 'checkpoint-1' }]);
  });
});
