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
    status: 'active',
    trigger_rule: { type: 'manual_run_now', run_now: true },
    backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
    progression_policy: {
      success_statuses: ['completed'],
      approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
      failure_policy: { retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 100 } },
    },
    created_at: '2026-06-06T00:00:00.000Z',
    updated_at: '2026-06-06T00:00:00.000Z',
    authority: null,
    last_run_id: null,
    last_plan_id: null,
    last_trigger: null,
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

async function writeLitePlanSession(
  workspaceRoot: string,
  sessionId: string,
  payload: Record<string, unknown>,
) {
  const baseDir = join(workspaceRoot, '.workflow', '.lite-plan', sessionId);
  await mkdir(baseDir, { recursive: true });
  await writeFile(join(baseDir, 'plan.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
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
    // ignore when the module was not loaded
  }
}

describe('mcp workflow service tail branches additional coverage', () => {
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

  it('treats non-array lite-plan task ids as missing task ids', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-lite-tail-');
    await writeLitePlanSession(workspaceRoot, 'session-non-array', {
      summary: 'non-array task ids',
      task_ids: { invalid: true },
    });

    const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');

    await expect(
      workflowSchedulerImportLitePlan({
        sessionId: 'session-non-array',
        workspace: buildWorkspace({
          workspaceRoot,
          workspaceId: 'workspace-lite',
          projectId: 'project-lite',
          sessionId: 'session-lite',
        }),
      }),
    ).resolves.toEqual({
      error: "No task_ids found in lite-plan session 'session-non-array'",
    });
  });

  it('returns scheduler access errors from run-now before invoking planner or executor', async () => {
    const workspaceRoot = await createWorkspaceRoot('niko-workflow-run-now-access-');
    await writeSchedulerStore(workspaceRoot, [
      buildSchedulerTask({
        task_id: 'workspace-task',
        authority: {
          workspace_id: 'workspace-alpha',
          project_id: 'project-shared',
        },
      }),
    ]);

    const plan = vi.fn();
    const execute = vi.fn();

    const {
      setWorkflowEngineRuntimeProvider,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    setWorkflowEngineRuntimeProvider(() =>
      createRuntime({
        plan,
        execute,
      }),
    );

    await expect(
      workflowSchedulerRunNow({
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
    expect(plan).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
