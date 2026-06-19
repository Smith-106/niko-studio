import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProjectWorkspaceContext } from '../../project/workspace-model.js';

function buildWorkspace(params: {
  workspaceRoot: string;
  workspaceId: string;
  projectId: string;
  sessionId?: string | null;
}): ProjectWorkspaceContext {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      projectName: params.projectId,
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

async function writeSchedulerStore(workspaceRoot: string) {
  await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
  await writeFile(
    join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
    `${JSON.stringify({
      version: 1,
      tasks: [
        {
          task_id: 'project-task',
          title: 'Project-bound task',
          task: 'run project scoped task',
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
          authority: {
            workspace_id: 'shared-workspace',
            project_id: 'project-alpha',
          },
          last_run_id: null,
          last_plan_id: null,
          last_trigger: null,
        },
      ],
    }, null, 2)}\n`,
    'utf-8',
  );
}

describe('mcp workflow service project authority additional coverage', () => {
  afterEach(async () => {
    try {
      const workflow = await import('../../mcp/services/workflow.js');
      workflow.resetWorkflowEngineRuntimeProvider();
    } catch {
      // module may not have been loaded yet
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
  });

  it('rejects scheduler run-now when the stored project authority differs', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-project-mismatch-'));

    try {
      await writeSchedulerStore(workspaceRoot);

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
          taskId: 'project-task',
          workspace: buildWorkspace({
            workspaceRoot,
            workspaceId: 'shared-workspace',
            projectId: 'project-beta',
            sessionId: '',
          }),
        }),
      ).resolves.toEqual({
        error:
          "Scheduler task 'project-task' is bound to project 'project-alpha' and cannot be used with 'project-beta'",
      });
      expect(plan).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
