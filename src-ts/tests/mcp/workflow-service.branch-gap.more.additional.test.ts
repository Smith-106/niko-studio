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
    // module not loaded
  }
}

describe('mcp workflow service deeper branch coverage', () => {
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

  it('rejects checkpoint restores when workflow session authority mismatches', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-checkpoint-session-');
    const { checkpointCreate, checkpointRestore, setWorkflowEngineRuntimeProvider } = await import(
      '../../mcp/services/workflow.js',
    );

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-session' }),
        getCheckpoint: vi.fn((checkpointId: string) => {
          if (checkpointId !== 'cp-session') {
            return null;
          }
          return {
            id: 'cp-session',
            description: 'session checkpoint',
            commit_hash: null,
            created_at: '2026-06-10T00:00:00.000Z',
            plan_id: null,
            step_id: null,
            replay_payload: {},
          };
        }),
      }),
    );

    await checkpointCreate(
      'session checkpoint',
      false,
      buildWorkspace({
        workspaceRoot,
        workspaceId: 'workspace-alpha',
        projectId: 'project-alpha',
        sessionId: 'session-alpha',
      }),
    );

    await expect(
      checkpointRestore(
        'cp-session',
        null,
        buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-alpha',
          projectId: 'project-alpha',
          sessionId: 'session-beta',
        }),
      ),
    ).resolves.toEqual({
      error:
        "Checkpoint 'cp-session' is bound to workflow session 'session-alpha' and cannot be used with 'session-beta'",
    });
  });

  it('restores bound checkpoints when only stored workspace and project authorities are available', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-checkpoint-fallback-');
    const restoreCheckpointMock = vi.fn().mockResolvedValue({ status: 'restored', checkpoint_id: 'cp-fallback' });
    const { checkpointCreate, checkpointRestore, setWorkflowEngineRuntimeProvider } = await import(
      '../../mcp/services/workflow.js',
    );

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        createCheckpoint: vi.fn().mockResolvedValue({ checkpoint_id: 'cp-fallback' }),
        getCheckpoint: vi.fn((checkpointId: string) => {
          if (checkpointId !== 'cp-fallback') {
            return null;
          }
          return {
            id: 'cp-fallback',
            description: 'fallback checkpoint',
            commit_hash: null,
            created_at: '2026-06-10T00:00:00.000Z',
            plan_id: null,
            step_id: null,
            replay_payload: undefined,
          };
        }),
        restoreCheckpoint: restoreCheckpointMock,
      }),
    );

    await checkpointCreate(
      'fallback checkpoint',
      false,
      buildWorkspace({
        workspaceRoot,
        workspaceId: 'workspace-stored',
        projectId: 'project-stored',
        sessionId: 'session-stored',
      }),
    );

    await expect(
      checkpointRestore(
        'cp-fallback',
        null,
        buildWorkspace({
          workspaceRoot,
          workspaceId: '',
          projectId: '',
          sessionId: 'session-stored',
        }),
      ),
    ).resolves.toEqual({
      status: 'restored',
      checkpoint_id: 'cp-fallback',
    });
    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-fallback', undefined);
  });

  it('rejects null scheduler definitions and skips non-object persisted scheduler entries', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-null-scheduler-');
    await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
      JSON.stringify({
        version: 1,
        tasks: [
          null,
          {
            task_id: 'kept-task',
            title: 'Kept task',
            task: 'still valid',
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

    const { workflowSchedulerList, workflowSchedulerRegister } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerRegister({
        definition: null,
        workspace: buildWorkspace({ workspaceRoot, sessionId: 'session-null' }),
      } as never),
    ).resolves.toEqual({ error: 'Invalid scheduler task definition' });

    await expect(
      workflowSchedulerList({
        workspace: buildWorkspace({ workspaceRoot, sessionId: 'session-null' }),
      }),
    ).resolves.toEqual({
      total: 0,
      tasks: [],
    });

    await expect(
      workflowSchedulerList({}),
    ).resolves.toEqual({
      total: 1,
      tasks: [expect.objectContaining({ task_id: 'kept-task' })],
    });
  });

  it('tolerates scheduler store payloads with non-array tasks', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-bad-tasks-payload-');
    await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
      JSON.stringify({
        version: 1,
        tasks: {},
      }),
      'utf-8',
    );

    const { workflowSchedulerList } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerList({
        workspace: buildWorkspace({ workspaceRoot, sessionId: 'session-bad-payload' }),
      }),
    ).resolves.toEqual({
      total: 0,
      tasks: [],
    });
  });

  it('treats fully sanitized-empty lite-plan session ids as missing selections', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-empty-sanitized-session-');
    await mkdir(join(workspaceRoot, '.workflow', '.lite-plan'), { recursive: true });
    const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerImportLitePlan({
        sessionId: '<>',
        workspace: buildWorkspace({ workspaceRoot, sessionId: 'session-sanitized-empty' }),
      }),
    ).resolves.toEqual({
      error: 'No lite-plan session available for import',
    });
  });

  it('passes through string import failures and supports global quick rollback defaults', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-import-string-failure-');
    const planDir = join(workspaceRoot, '.workflow', '.lite-plan', 'session-string-failure');
    await mkdir(join(planDir, '.task'), { recursive: true });
    await writeFile(
      join(planDir, 'plan.json'),
      JSON.stringify({ task_ids: ['TASK-STRING'] }),
      'utf-8',
    );
    await writeFile(
      join(planDir, '.task', 'TASK-STRING.json'),
      JSON.stringify({ id: 'TASK-STRING', title: 'throw-now' }),
      'utf-8',
    );

    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;
    const originalParse = JSON.parse.bind(JSON);
    const parseSpy = vi.spyOn(JSON, 'parse');
    parseSpy.mockImplementation(((text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) => {
      if (String(text).includes('throw-now')) {
        throw 'string parse failure';
      }
      return originalParse(text, reviver);
    }) as typeof JSON.parse);

    const quickRollbackMock = vi.fn().mockResolvedValue({ restored: true });
    const createCheckpointMock = vi.fn().mockResolvedValue({});

    const {
      setWorkflowEngineRuntimeProvider,
      workflowQuickRollback,
      workflowSchedulerImportLitePlan,
      checkpointCreate,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        quickRollback: quickRollbackMock,
        createCheckpoint: createCheckpointMock,
      }),
    );

    await expect(
      workflowSchedulerImportLitePlan({
        sessionId: 'session-string-failure',
      }),
    ).resolves.toMatchObject({
      imported: 0,
      failed: 1,
      failures: [
        {
          task_id: 'TASK-STRING',
          error: 'Failed to import task',
        },
      ],
    });

    await expect(
      workflowQuickRollback({
        planId: 'plan-global',
        checkpointId: 'cp-global',
      }),
    ).resolves.toEqual({ restored: true });
    expect(quickRollbackMock).toHaveBeenCalledWith('plan-global', 'cp-global', '');

    await expect(checkpointCreate('no-id-checkpoint', false)).resolves.toEqual({});
    expect(createCheckpointMock).toHaveBeenCalledWith('no-id-checkpoint', false);
  });
});
