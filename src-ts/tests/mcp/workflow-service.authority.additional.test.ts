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

async function resetWorkflowModule() {
  try {
    const workflow = await import('../../mcp/services/workflow.js');
    workflow.resetWorkflowEngineRuntimeProvider();
  } catch {
    // 忽略模块尚未加载的情况
  }
}

describe('mcp workflow service authority additional coverage', () => {
  afterEach(async () => {
    await resetWorkflowModule();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    await Promise.all(
      workspaceRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
  });

  it('restores unbound checkpoints when the request workspace resolves to no authority', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-open-checkpoint-');
    const restoreCheckpointMock = vi.fn().mockResolvedValue({
      status: 'restored',
      checkpoint_id: 'cp-open',
    });

    const { checkpointList, checkpointRestore, setWorkflowEngineRuntimeProvider } = await import(
      '../../mcp/services/workflow.js'
    );

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        getCheckpoint: vi.fn((checkpointId: string) => {
          if (checkpointId === 'cp-open') {
            return {
              id: 'cp-open',
              description: 'open checkpoint',
              commit_hash: null,
              created_at: '2026-06-05T00:00:00.000Z',
              plan_id: null,
              step_id: null,
              replay_payload: {},
            };
          }
          return null;
        }),
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            id: 'cp-open',
            description: 'open checkpoint',
            created_at: '2026-06-05T00:00:00.000Z',
          },
        ]),
        restoreCheckpoint: restoreCheckpointMock,
      }),
    );

    const unscopedWorkspace = buildWorkspace({
      workspaceRoot,
      workspaceId: '',
      projectId: '',
      sessionId: '',
    });

    await expect(checkpointList(10, unscopedWorkspace)).resolves.toEqual([
      {
        id: 'cp-open',
        description: 'open checkpoint',
        created_at: '2026-06-05T00:00:00.000Z',
      },
    ]);

    await expect(checkpointRestore('cp-open', null, unscopedWorkspace)).resolves.toEqual({
      status: 'restored',
      checkpoint_id: 'cp-open',
    });
    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-open', undefined);
  });

  it('rejects workspace-scoped checkpoint restores when workspace authority mismatches', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-checkpoint-workspace-');
    const restoreCheckpointMock = vi.fn().mockResolvedValue({ status: 'restored' });

    const {
      checkpointCreate,
      checkpointList,
      checkpointRestore,
      setWorkflowEngineRuntimeProvider,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-workspace' }),
        getCheckpoint: vi.fn((checkpointId: string) => {
          if (checkpointId === 'cp-workspace') {
            return {
              id: 'cp-workspace',
              description: 'workspace checkpoint',
              commit_hash: null,
              created_at: '2026-06-05T00:00:00.000Z',
              plan_id: null,
              step_id: null,
              replay_payload: {},
            };
          }
          return null;
        }),
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            id: 'cp-workspace',
            description: 'workspace checkpoint',
            created_at: '2026-06-05T00:00:00.000Z',
          },
        ]),
        restoreCheckpoint: restoreCheckpointMock,
      }),
    );

    const ownerWorkspace = buildWorkspace({
      workspaceRoot,
      workspaceId: 'workspace-alpha',
      projectId: 'project-shared',
      sessionId: '',
    });
    const foreignWorkspace = buildWorkspace({
      workspaceRoot,
      workspaceId: 'workspace-beta',
      projectId: 'project-shared',
      sessionId: '',
    });

    await checkpointCreate('workspace checkpoint', false, ownerWorkspace);

    await expect(checkpointList(10, foreignWorkspace)).resolves.toEqual([]);

    await expect(checkpointRestore('cp-workspace', null, foreignWorkspace)).resolves.toEqual({
      error:
        "Checkpoint 'cp-workspace' is bound to workspace 'workspace-alpha' and cannot be used with 'workspace-beta'",
    });
    expect(restoreCheckpointMock).not.toHaveBeenCalled();
  });

  it('rejects project-scoped checkpoint restores when only project authority differs', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-checkpoint-project-');
    const restoreCheckpointMock = vi.fn().mockResolvedValue({ status: 'restored' });

    const {
      checkpointCreate,
      checkpointRestore,
      setWorkflowEngineRuntimeProvider,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-project' }),
        getCheckpoint: vi.fn((checkpointId: string) => {
          if (checkpointId === 'cp-project') {
            return {
              id: 'cp-project',
              description: 'project checkpoint',
              commit_hash: null,
              created_at: '2026-06-05T00:00:00.000Z',
              plan_id: null,
              step_id: null,
              replay_payload: {},
            };
          }
          return null;
        }),
        restoreCheckpoint: restoreCheckpointMock,
      }),
    );

    await checkpointCreate(
      'project checkpoint',
      false,
      buildWorkspace({
        workspaceRoot,
        workspaceId: '',
        projectId: 'project-alpha',
        sessionId: '',
      }),
    );

    await expect(
      checkpointRestore(
        'cp-project',
        null,
        buildWorkspace({
          workspaceRoot,
          workspaceId: '',
          projectId: 'project-beta',
          sessionId: '',
        }),
      ),
    ).resolves.toEqual({
      error:
        "Checkpoint 'cp-project' is bound to project 'project-alpha' and cannot be used with 'project-beta'",
    });
    expect(restoreCheckpointMock).not.toHaveBeenCalled();
  });

  it('rejects scoped scheduler access for unbound persisted tasks', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-unbound-scheduler-');
    await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
      JSON.stringify({
        version: 2,
        tasks: [
          {
            task_id: 'unbound-task',
            title: 'Unbound task',
            task: 'available only globally',
            trigger_rule: { type: 'manual_run_now', run_now: true },
            backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
            progression_policy: {
              success_statuses: ['completed'],
              approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
              failure_policy: { retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 100 } },
            },
            authority: {},
          },
        ],
      }),
      'utf-8',
    );

    const { workflowSchedulerResume } = await import('../../mcp/services/workflow.js');
    const workspace = buildWorkspace({
      workspaceRoot,
      workspaceId: 'workspace-scoped',
      projectId: 'project-scoped',
      sessionId: 'session-scoped',
    });

    await expect(workflowSchedulerResume({ taskId: 'unbound-task', workspace })).resolves.toEqual({
      error:
        "Scheduler task 'unbound-task' is not bound to workspace authority and cannot be used from a different scope",
    });
  });

  it('rejects scheduler operations when only project authority mismatches', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-project-scheduler-');
    await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            task_id: 'project-task',
            title: 'Project task',
            task: 'project protected',
            trigger_rule: { type: 'manual_run_now', run_now: true },
            backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
            progression_policy: {
              success_statuses: ['completed'],
              approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
              failure_policy: { retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 100 } },
            },
            authority: {
              project_id: 'project-alpha',
            },
          },
        ],
      }),
      'utf-8',
    );

    const { workflowSchedulerPause } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerPause({
        taskId: 'project-task',
        workspace: buildWorkspace({
          workspaceRoot,
          workspaceId: '',
          projectId: 'project-beta',
          sessionId: '',
        }),
      }),
    ).resolves.toEqual({
      error:
        "Scheduler task 'project-task' is bound to project 'project-alpha' and cannot be used with 'project-beta'",
    });
  });

  it('sanitizes requested lite-plan session ids and falls back to task id when metadata is missing', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-sanitized-import-');
    const sessionDir = join(workspaceRoot, '.workflow', '.lite-plan', 'sessionsafe');
    await mkdir(join(sessionDir, '.task'), { recursive: true });
    await writeFile(
      join(sessionDir, 'plan.json'),
      JSON.stringify({ task_ids: ['Task 01'] }),
      'utf-8',
    );
    await writeFile(
      join(sessionDir, '.task', 'Task 01.json'),
      JSON.stringify({ id: 'Task 01' }),
      'utf-8',
    );

    const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');
    const workspace = buildWorkspace({
      workspaceRoot,
      workspaceId: 'workspace-safe',
      projectId: 'project-safe',
      sessionId: 'session-safe',
    });

    await expect(
      workflowSchedulerImportLitePlan({
        sessionId: 'session<>safe',
        workspace,
      }),
    ).resolves.toMatchObject({
      session_id: 'sessionsafe',
      imported: 1,
      registered: 1,
      failed: 0,
      tasks: [
        expect.objectContaining({
          task_id: 'lite-sessionsafe-task-01',
          title: 'Task 01',
          task: 'Task 01',
          level: 'L5',
        }),
      ],
    });
  });
});
