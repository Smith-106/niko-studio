import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProjectWorkspaceContext } from '../../project/workspace-model.js';

function buildWorkspace(params: {
  workspaceRoot: string;
  workspaceId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
}): ProjectWorkspaceContext {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: params.workspaceId ?? '',
      projectId: params.projectId ?? '',
      projectName: params.projectId ?? 'project',
      workspaceRoot: params.workspaceRoot,
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
    },
    storyBible: {
      storyBibleId: null,
      draftId: null,
      version: null,
      storage: 'workspace',
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
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
      sessionId: params.sessionId ?? null,
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: params.sessionId ?? null,
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

function buildSchedulerTask(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 'task-default',
    title: 'Task default',
    task: 'run default task',
    trigger_rule: { type: 'manual_run_now', run_now: true },
    backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
    progression_policy: {
      success_statuses: ['completed'],
      approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
      failure_policy: { retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 100 } },
    },
    ...overrides,
  };
}

function createRuntime(overrides: Record<string, unknown> = {}) {
  return {
    route: vi.fn().mockResolvedValue({ level: 'L1' }),
    plan: vi.fn().mockResolvedValue({ plan_id: 'plan-default' }),
    execute: vi.fn().mockResolvedValue({ status: 'completed' }),
    quickRollback: vi.fn().mockResolvedValue({ restored: true }),
    lifecycle: vi.fn().mockResolvedValue({ runner_state: 'running' }),
    createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-default' }),
    restoreCheckpoint: vi.fn().mockResolvedValue({ status: 'restored' }),
    listCheckpoints: vi.fn().mockResolvedValue([]),
    bindPlanSession: vi.fn(),
    ...overrides,
  };
}

const workspaceRoots: string[] = [];

async function createWorkspaceRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  workspaceRoots.push(root);
  return root;
}

async function writeSchedulerStore(workspaceRoot: string, tasks: Array<Record<string, unknown>>) {
  await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
  await writeFile(
    join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
    `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`,
    'utf-8',
  );
}

async function resetWorkflowModule() {
  try {
    const workflow = await import('../../mcp/services/workflow.js');
    workflow.resetWorkflowEngineRuntimeProvider();
  } catch {
    // 忽略模块尚未加载的情况
  }
}

describe('mcp workflow service scheduler fallback additional coverage', () => {
  afterEach(async () => {
    await resetWorkflowModule();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    await Promise.all(
      workspaceRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it('allows global access to unbound persisted tasks when no workspace authority is present', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-unbound-global-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'unbound-task',
        title: 'Unbound task',
        task: 'run globally',
        authority: {},
      }),
    ]);

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    const { workflowSchedulerPause } = await import('../../mcp/services/workflow.js');

    await expect(workflowSchedulerPause({ taskId: 'unbound-task' })).resolves.toEqual({
      status: 'paused',
      task: expect.objectContaining({
        task_id: 'unbound-task',
        status: 'paused',
        authority: null,
      }),
    });
  });

  it('returns workspace authority mismatch errors for persisted scheduler tasks', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-workspace-mismatch-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'workspace-task',
        authority: {
          workspace_id: 'workspace-alpha',
          project_id: 'project-shared',
        },
      }),
    ]);

    const { workflowSchedulerResume } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerResume({
        taskId: 'workspace-task',
        workspace: buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-beta',
          projectId: 'project-shared',
          sessionId: '',
        }),
      }),
    ).resolves.toEqual({
      error:
        "Scheduler task 'workspace-task' is bound to workspace 'workspace-alpha' and cannot be used with 'workspace-beta'",
    });
  });

  it('surfaces plan failures from scheduler run-now and passes null levels through workflow planning', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-run-now-plan-fail-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'task-no-plan',
        title: 'Task without plan',
        task: 'planner should fail',
      }),
    ]);

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    const planMock = vi.fn().mockResolvedValue({ error: 'planner unavailable' });
    const executeMock = vi.fn();

    const {
      setWorkflowEngineRuntimeProvider,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        plan: planMock,
        execute: executeMock,
      }),
    );

    await expect(workflowSchedulerRunNow({ taskId: 'task-no-plan' })).resolves.toEqual({
      error: 'planner unavailable',
      task: expect.objectContaining({
        task_id: 'task-no-plan',
      }),
      plan: { error: 'planner unavailable' },
    });
    expect(planMock).toHaveBeenCalledWith(
      'planner should fail',
      undefined,
      [],
      undefined,
    );
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('defaults scheduler run-now status to completed when execute returns no explicit status', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-run-now-default-status-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'task-run',
        level: 'L2',
      }),
    ]);

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    const {
      setWorkflowEngineRuntimeProvider,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        plan: vi.fn().mockResolvedValue({ plan_id: 'plan-run' }),
        execute: vi.fn().mockResolvedValue({}),
      }),
    );

    await expect(workflowSchedulerRunNow({ taskId: 'task-run' })).resolves.toEqual(
      expect.objectContaining({
        status: 'completed',
        trigger: 'manual_run_now',
        plan_id: 'plan-run',
        task: expect.objectContaining({
          task_id: 'task-run',
          last_plan_id: 'plan-run',
          last_trigger: 'manual_run_now',
        }),
      }),
    );
  });

  it('derives the initial scheduler trigger from schedule cadence when trigger type is absent', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-cadence-trigger-');

    const { workflowSchedulerRegister } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerRegister({
        definition: buildSchedulerTask({
          task_id: 'cadence-task',
          title: 'Cadence task',
          task: 'run on cron',
          trigger_rule: { run_now: false },
          schedule_rule: { cadence: 'cron', cron: '0 2 * * *', timezone: 'Asia/Shanghai' },
        }),
        workspace: buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-cadence',
          projectId: 'project-cadence',
          sessionId: 'session-cadence',
        }),
      }),
    ).resolves.toEqual({
      status: 'registered',
      task: expect.objectContaining({
        task_id: 'cadence-task',
        schedule_rule: { cadence: 'cron', cron: '0 2 * * *', timezone: 'Asia/Shanghai' },
        trigger_rule: { run_now: false },
        last_trigger: 'cron',
        authority: {
          sessionId: 'session-cadence',
          workspaceId: 'workspace-cadence',
          projectId: 'project-cadence',
        },
      }),
    });
  });

  it('does not run paused scheduler tasks or call the planner', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-run-now-paused-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'task-paused',
        status: 'paused',
      }),
    ]);

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    const planMock = vi.fn();
    const executeMock = vi.fn();

    const {
      setWorkflowEngineRuntimeProvider,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        plan: planMock,
        execute: executeMock,
      }),
    );

    await expect(workflowSchedulerRunNow({ taskId: 'task-paused' })).resolves.toEqual({
      error: "Scheduler task 'task-paused' is paused",
    });
    expect(planMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('uses the default scheduler plan failure when the planner returns no plan id or error', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-run-now-empty-plan-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'task-empty-plan',
        task: 'planner returns empty result',
      }),
    ]);

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    const planMock = vi.fn().mockResolvedValue({});
    const executeMock = vi.fn();

    const {
      setWorkflowEngineRuntimeProvider,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        plan: planMock,
        execute: executeMock,
      }),
    );

    await expect(workflowSchedulerRunNow({ taskId: 'task-empty-plan' })).resolves.toEqual({
      error: 'Failed to create workflow plan from scheduler task',
      task: expect.objectContaining({
        task_id: 'task-empty-plan',
        last_plan_id: null,
        last_run_id: null,
      }),
      plan: {},
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('invalidates cached workflow engines when the runtime provider changes', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-provider-cache-');
    const routeA = vi.fn().mockResolvedValue({ level: 'L1', provider: 'a' });
    const routeB = vi.fn().mockResolvedValue({ level: 'L5', provider: 'b' });

    const {
      setWorkflowEngineRuntimeProvider,
      workflowRoute,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() => createRuntime({ route: routeA }));
    await expect(
      workflowRoute(
        'route with provider a',
        buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-provider',
          projectId: 'project-provider',
          sessionId: 'session-provider',
        }),
      ),
    ).resolves.toEqual({ level: 'L1', provider: 'a' });

    setWorkflowEngineRuntimeProvider(() => createRuntime({ route: routeB }));
    await expect(
      workflowRoute(
        'route with provider b',
        buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-provider',
          projectId: 'project-provider',
          sessionId: 'session-provider',
        }),
      ),
    ).resolves.toEqual({ level: 'L5', provider: 'b' });

    expect(routeA).toHaveBeenCalledTimes(1);
    expect(routeB).toHaveBeenCalledTimes(1);
  });

  it('filters non-string lite-plan task ids before importing valid tasks', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-taskid-filter-');
    const planDir = join(workspaceRoot, '.workflow', '.lite-plan', 'session-filter');
    await mkdir(join(planDir, '.task'), { recursive: true });
    await writeFile(
      join(planDir, 'plan.json'),
      `${JSON.stringify({ task_ids: [42, '   ', 'TASK-OK'] }, null, 2)}\n`,
      'utf-8',
    );
    await writeFile(
      join(planDir, '.task', 'TASK-OK.json'),
      `${JSON.stringify({ id: 'TASK-OK', title: 'Imported title' }, null, 2)}\n`,
      'utf-8',
    );

    const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerImportLitePlan({
        sessionId: 'session-filter',
        workspace: buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-filter',
          projectId: 'project-filter',
          sessionId: 'session-filter',
        }),
      }),
    ).resolves.toMatchObject({
      session_id: 'session-filter',
      imported: 1,
      registered: 1,
      failed: 0,
      total_tasks: 1,
      tasks: [
        expect.objectContaining({
          task_id: 'lite-session-filter-task-ok',
          title: 'Imported title',
          task: 'Imported title',
          level: 'L5',
        }),
      ],
    });
  });

  it('filters out checkpoint summaries that no longer have backing records', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-missing-checkpoint-record-');
    const listCheckpointsMock = vi.fn().mockResolvedValue([
      {
        id: 'ghost-checkpoint',
        description: 'ghost',
        created_at: '2026-06-05T00:00:00.000Z',
      },
    ]);

    const {
      checkpointList,
      setWorkflowEngineRuntimeProvider,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        listCheckpoints: listCheckpointsMock,
        getCheckpoint: vi.fn().mockReturnValue(null),
      }),
    );

    await expect(
      checkpointList(
        10,
        buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-ghost',
          projectId: 'project-ghost',
          sessionId: '',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it('resolves checkpoint authority bindings from another workspace cache before rejecting mismatched access', async () => {
    const workspaceRootA = await createWorkspaceRoot('niko-workflow-cross-cache-a-');
    const workspaceRootB = await createWorkspaceRoot('niko-workflow-cross-cache-b-');
    const restoreCheckpointMock = vi.fn().mockResolvedValue({ status: 'restored' });
    const sharedCheckpoint = {
      id: 'cp-cross-cache',
      description: 'cross-cache checkpoint',
      commit_hash: null,
      created_at: '2026-06-05T00:00:00.000Z',
      plan_id: null,
      step_id: null,
      replay_payload: {},
    };

    const {
      checkpointCreate,
      checkpointRestore,
      setWorkflowEngineRuntimeProvider,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-cross-cache' }),
        getCheckpoint: vi.fn((checkpointId: string) =>
          checkpointId === 'cp-cross-cache' ? sharedCheckpoint : null,
        ),
        restoreCheckpoint: restoreCheckpointMock,
      }),
    );

    await checkpointCreate(
      'cross-cache checkpoint',
      false,
      buildWorkspace({
        workspaceRoot: workspaceRootA,
        workspaceId: 'workspace-alpha',
        projectId: 'project-shared',
        sessionId: '',
      }),
    );

    await expect(
      checkpointRestore(
        'cp-cross-cache',
        null,
        buildWorkspace({
          workspaceRoot: workspaceRootB,
          workspaceId: 'workspace-beta',
          projectId: 'project-shared',
          sessionId: '',
        }),
      ),
    ).resolves.toEqual({
      error:
        "Checkpoint 'cp-cross-cache' is bound to workspace 'workspace-alpha' and cannot be used with 'workspace-beta'",
    });
    expect(restoreCheckpointMock).not.toHaveBeenCalled();
  });
});
