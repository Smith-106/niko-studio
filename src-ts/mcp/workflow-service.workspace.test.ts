import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from './http-types';
import type { ProjectWorkspaceContext } from '../project/workspace-model';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const listCheckpointsMock = vi.fn();
const bindPlanSessionMock = vi.fn();
const bindPlanAuthorityMock = vi.fn();
const getPlanAuthorityMock = vi.fn();
const checkpointRecordsMock = new Map<string, {
  id: string;
  description: string;
  commit_hash: string | null;
  created_at: string;
  plan_id: string | null;
  step_id: string | null;
  replay_payload: Record<string, unknown>;
}>();

function mockWorkflowEngineRuntime() {
  vi.doMock('../workflow/workflow-engine.js', () => ({
    WorkflowEngine: vi.fn().mockImplementation(function() {
      return {
        route: routeMock,
        plan: planMock,
        execute: executeMock,
        quickRollback: quickRollbackMock,
        lifecycle: lifecycleMock,
        createCheckpoint: createCheckpointMock,
        restoreCheckpoint: restoreCheckpointMock,
        listCheckpoints: listCheckpointsMock,
        bindPlanSession: bindPlanSessionMock,
        bindPlanAuthority: bindPlanAuthorityMock,
        getPlanAuthority: getPlanAuthorityMock,
        checkpoints: checkpointRecordsMock,
        getCheckpoint: (checkpointId: string) => checkpointRecordsMock.get(checkpointId) ?? null,
      };
    }),
  }));
}

function makeRequest(body: Record<string, unknown>, url = '/workflow/test'): HttpRequest {
  return {
    method: 'POST',
    url,
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
): ProjectWorkspaceContext {
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

describe('workflow service workspace binding', () => {
  afterEach(() => {
    vi.doUnmock('../workflow/workflow-engine.js');
    vi.resetModules();
    vi.clearAllMocks();
    checkpointRecordsMock.clear();
  });

  it('binds workspace authority when authoritative workspace context provides one', async () => {
    mockWorkflowEngineRuntime();
    bindPlanAuthorityMock.mockImplementation(
      (_planId: string, authority: Record<string, unknown>) => authority,
    );
    planMock.mockResolvedValueOnce({ plan_id: 'plan-workspace' });

    const { workflowPlan } = await import('./services/workflow.js');

    const result = await workflowPlan({
      task: '整理章节计划',
      level: 'L3',
      workspace: buildWorkspace('workflow-session-1'),
    });

    expect(bindPlanAuthorityMock).toHaveBeenCalledWith('plan-workspace', {
      sessionId: 'workflow-session-1',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
    expect(bindPlanSessionMock).not.toHaveBeenCalled();
    expect(result).toEqual({ plan_id: 'plan-workspace' });
  });

  it('falls back to the conversation id when workflow session scope is absent', async () => {
    mockWorkflowEngineRuntime();
    bindPlanAuthorityMock.mockImplementation(
      (_planId: string, authority: Record<string, unknown>) => authority,
    );
    planMock.mockResolvedValueOnce({ plan_id: 'plan-conversation' });

    const { workflowPlan } = await import('./services/workflow.js');

    await workflowPlan({
      task: '恢复对话内的写作流程',
      level: 'L3',
      workspace: buildWorkspace(null, 'atlas-workspace', 'atlas-project', 'conversation-7'),
    });

    expect(bindPlanAuthorityMock).toHaveBeenCalledWith('plan-conversation', {
      sessionId: 'conversation-7',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
  });

  it('threads workspace authority through execute, lifecycle, and quick rollback calls', async () => {
    mockWorkflowEngineRuntime();
    executeMock.mockResolvedValueOnce({ status: 'completed', plan_id: 'plan-3' });
    lifecycleMock.mockResolvedValueOnce({ runner_state: 'paused', plan_id: 'plan-3' });
    quickRollbackMock.mockResolvedValueOnce({ restored: false, plan_id: 'plan-3' });

    const { workflowExecute, workflowLifecycle, workflowQuickRollback } = await import('./services/workflow.js');
    const workspace = buildWorkspace('workflow-session-3', 'beacon-workspace', 'beacon-project');
    const authority = {
      sessionId: 'workflow-session-3',
      workspaceId: 'beacon-workspace',
      projectId: 'beacon-project',
    };

    await workflowExecute({
      planId: 'plan-3',
      stepId: 'step-3',
      recommendations: [{ title: '保留冲突' }],
      confirmToken: 'token-3',
      workspace,
    });
    await workflowLifecycle('plan-3', 'pause', workspace);
    await workflowQuickRollback({
      planId: 'plan-3',
      checkpointId: 'cp-3',
      reason: 'rollback',
      workspace,
    });

    expect(executeMock).toHaveBeenCalledWith(
      'plan-3',
      'step-3',
      [{ title: '保留冲突' }],
      'token-3',
      authority,
    );
    expect(lifecycleMock).toHaveBeenCalledWith('plan-3', 'pause', undefined, authority);
    expect(quickRollbackMock).toHaveBeenCalledWith('plan-3', 'cp-3', 'rollback', authority);
  });

  it('binds anonymous checkpoints to workspace authority for list and restore calls', async () => {
    mockWorkflowEngineRuntime();
    const createdAt = '2026-04-13T02:00:00.000Z';
    const checkpointSummary = {
      id: 'cp-local',
      description: 'manual checkpoint',
      created_at: createdAt,
    };
    createCheckpointMock.mockImplementationOnce(async () => {
      checkpointRecordsMock.set('cp-local', {
        id: 'cp-local',
        description: 'manual checkpoint',
        commit_hash: null,
        created_at: createdAt,
        plan_id: null,
        step_id: null,
        replay_payload: {},
      });
      return {
        checkpoint_id: 'cp-local',
        description: 'manual checkpoint',
        created_at: createdAt,
      };
    });
    listCheckpointsMock.mockResolvedValue([checkpointSummary]);
    restoreCheckpointMock.mockResolvedValue({ status: 'restored', checkpoint_id: 'cp-local' });

    const { checkpointCreate, checkpointList, checkpointRestore } = await import('./services/workflow.js');
    const workspaceA = buildWorkspace('workflow-session-4', 'atlas-workspace', 'atlas-project');
    const workspaceB = buildWorkspace('workflow-session-5', 'beacon-workspace', 'beacon-project');

    await checkpointCreate('manual checkpoint', false, workspaceA);

    await expect(checkpointList(10, workspaceA)).resolves.toEqual([checkpointSummary]);
    await expect(checkpointList(10, workspaceB)).resolves.toEqual([]);

    const blockedRestore = await checkpointRestore('cp-local', undefined, workspaceB);
    expect(blockedRestore['error']).toContain("workflow session 'workflow-session-4'");
    expect(restoreCheckpointMock).not.toHaveBeenCalled();

    const allowedRestore = await checkpointRestore('cp-local', undefined, workspaceA);
    expect(allowedRestore).toEqual({ status: 'restored', checkpoint_id: 'cp-local' });
    expect(restoreCheckpointMock).toHaveBeenCalledTimes(1);
    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-local', undefined);
  });
});

describe('workflow workspace authority integration', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  let workspaceRoot = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-authority-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;
    vi.doUnmock('../workflow/workflow-engine.js');
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
    vi.doUnmock('../workflow/workflow-engine.js');
    vi.resetModules();
    vi.clearAllMocks();
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('persists execution state under the bound session and rejects mismatched workspace lifecycle calls', async () => {
    const {
      workflowPlanEndpoint,
      workflowExecuteEndpoint,
      workflowLifecycleEndpoint,
      workflowQuickRollbackEndpoint,
    } = await import('./endpoints/workflow.js');

    const workspaceA = buildWorkspace('workflow-session-a', 'atlas-workspace', 'atlas-project');
    const workspaceB = buildWorkspace('workflow-session-b', 'beacon-workspace', 'beacon-project');

    const planResponse = await workflowPlanEndpoint(
      makeRequest(
        {
          task: '写一章并逐步完善冲突与细节',
          level: 'L3',
          workspace: workspaceA,
        },
        '/workflow/plan',
      ),
    );

    expect(planResponse.statusCode).toBe(200);
    const planId = String((planResponse.body as Record<string, unknown>)['plan_id']);
    expect(planId).toBeTruthy();

    const statePath = join(
      workspaceRoot,
      '.writing',
      'sessions',
      'active',
      'workflow-session-a',
      '.data',
      'state.json',
    );
    expect(existsSync(statePath)).toBe(true);

    const plannedState = JSON.parse(await readFile(statePath, 'utf-8')) as Record<string, unknown>;
    expect(plannedState['plan_id']).toBe(planId);
    expect((plannedState['metadata'] as Record<string, unknown>)['workspace_authority']).toEqual({
      session_id: 'workflow-session-a',
      workspace_id: 'atlas-workspace',
      project_id: 'atlas-project',
    });

    const executeResponse = await workflowExecuteEndpoint(
      makeRequest(
        {
          plan_id: planId,
          workspace: workspaceA,
        },
        '/workflow/execute',
      ),
    );

    expect(executeResponse.statusCode).toBe(200);
    expect((executeResponse.body as Record<string, unknown>)['step_name']).toBe('analyze');

    const executedState = JSON.parse(await readFile(statePath, 'utf-8')) as Record<string, unknown>;
    expect(executedState['runner_state']).toBe('running');
    expect((executedState['metadata'] as Record<string, unknown>)['workspace_authority']).toEqual({
      session_id: 'workflow-session-a',
      workspace_id: 'atlas-workspace',
      project_id: 'atlas-project',
    });

    const mismatchedExecute = await workflowExecuteEndpoint(
      makeRequest(
        {
          plan_id: planId,
          workspace: workspaceB,
        },
        '/workflow/execute',
      ),
    );

    expect(mismatchedExecute.statusCode).toBe(200);
    expect((mismatchedExecute.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );
    expect(
      existsSync(
        join(
          workspaceRoot,
          '.writing',
          'sessions',
          'active',
          'workflow-session-b',
          '.data',
          'state.json',
        ),
      ),
    ).toBe(false);

    const pauseResponse = await workflowLifecycleEndpoint(
      makeRequest(
        {
          plan_id: planId,
          action: 'pause',
          workspace: workspaceA,
        },
        '/workflow/lifecycle',
      ),
    );

    expect(pauseResponse.statusCode).toBe(200);
    expect((pauseResponse.body as Record<string, unknown>)['runner_state']).toBe('paused');
    expect((pauseResponse.body as Record<string, unknown>)['session_status']).toBe('checkpointed');

    const checkpointId = String((pauseResponse.body as Record<string, unknown>)['checkpoint_id']);
    expect(checkpointId).toBeTruthy();

    const sessionInfoPath = join(
      workspaceRoot,
      '.writing',
      'sessions',
      'active',
      'workflow-session-a',
      'session.json',
    );
    const sessionInfo = JSON.parse(await readFile(sessionInfoPath, 'utf-8')) as Record<string, unknown>;
    expect(sessionInfo).toMatchObject({
      runner_state: 'paused',
      status: 'checkpointed',
      last_checkpoint_id: checkpointId,
    });

    const mismatchedResume = await workflowLifecycleEndpoint(
      makeRequest(
        {
          plan_id: planId,
          action: 'resume',
          workspace: workspaceB,
        },
        '/workflow/lifecycle',
      ),
    );

    expect((mismatchedResume.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );

    const mismatchedRollback = await workflowQuickRollbackEndpoint(
      makeRequest(
        {
          plan_id: planId,
          checkpoint_id: checkpointId,
          reason: 'test rollback',
          workspace: workspaceB,
        },
        '/workflow/rollback',
      ),
    );

    expect((mismatchedRollback.body as Record<string, unknown>)['error']).toContain(
      "workflow session 'workflow-session-a'",
    );
  });
});
