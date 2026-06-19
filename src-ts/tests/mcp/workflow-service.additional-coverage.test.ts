import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProjectWorkspaceContext } from '../../project/workspace-model.js';

const getContainerMock = vi.hoisted(() => vi.fn());

vi.mock('../../container/ServiceContainer.js', () => ({
  getContainer: getContainerMock,
}));

function buildWorkspace(params: {
  workspaceRoot: string;
  workspaceId: string;
  projectId: string;
  sessionId: string | null;
  conversationId?: string | null;
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
      sessionId: params.sessionId,
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: params.conversationId ?? params.sessionId,
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

function buildSchedulerDefinition(taskId: string, title: string, task: string) {
  return {
    task_id: taskId,
    title,
    task,
    level: 'L3',
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

describe('mcp workflow service additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('blocks stage-advancing lifecycle actions on failed quality gates and degrades gracefully when orchestration is unavailable', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-qgate-'));

    try {
      const lifecycleMock = vi.fn().mockResolvedValue({ runner_state: 'running' });
      getContainerMock
        .mockReturnValueOnce({
          phaseOrchestrator: {
            checkQualityGate: vi.fn().mockResolvedValue(false),
          },
        })
        .mockImplementationOnce(() => {
          throw new Error('container unavailable');
        });

      const {
        setWorkflowEngineRuntimeProvider,
        resetWorkflowEngineRuntimeProvider,
        workflowLifecycle,
      } = await import('../../mcp/services/workflow.js');

      setWorkflowEngineRuntimeProvider(() => createRuntime({ lifecycle: lifecycleMock }));

      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-quality-gate',
      });

      const blocked = await workflowLifecycle('plan-quality', 'resume', workspace);
      expect(blocked).toEqual({
        error: 'Quality gate blocked stage transition',
        action: 'resume',
        gateBlocked: true,
        planId: 'plan-quality',
      });
      expect(lifecycleMock).not.toHaveBeenCalled();

      const degraded = await workflowLifecycle('plan-quality', 'advance', workspace);
      expect(degraded).toEqual({ runner_state: 'running' });
      expect(lifecycleMock).toHaveBeenCalledWith(
        'plan-quality',
        'advance',
        undefined,
        expect.objectContaining({
          sessionId: 'session-quality-gate',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        }),
      );

      resetWorkflowEngineRuntimeProvider();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('reports lite-plan import precondition failures for missing roots, empty sessions, and plans without task ids', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-lite-errors-'));

    try {
      const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');
      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-lite-errors',
      });

      const missingDir = await workflowSchedulerImportLitePlan({ workspace });
      expect(missingDir).toEqual({
        error: `Lite-plan directory not found at '${join(workspaceRoot, '.workflow', '.lite-plan')}'`,
      });

      const baseDir = join(workspaceRoot, '.workflow', '.lite-plan');
      await mkdir(baseDir, { recursive: true });

      const noSession = await workflowSchedulerImportLitePlan({ workspace });
      expect(noSession).toEqual({ error: 'No lite-plan session available for import' });

      const emptySessionDir = join(baseDir, 'session-empty');
      await mkdir(emptySessionDir, { recursive: true });
      await writeFile(
        join(emptySessionDir, 'plan.json'),
        JSON.stringify({ summary: 'empty plan', task_ids: [] }),
        'utf-8',
      );

      const noTaskIds = await workflowSchedulerImportLitePlan({
        sessionId: 'session-empty',
        workspace,
      });
      expect(noTaskIds).toEqual({
        error: "No task_ids found in lite-plan session 'session-empty'",
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('loads persisted scheduler tasks, skips malformed entries, and normalizes workspace/global limit handling', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-store-load-'));

    try {
      await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
      await writeFile(
        join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
        JSON.stringify({
          version: 'invalid-version',
          tasks: [
            {
              task_id: 'persisted-task',
              title: 'Persisted task',
              task: 'loaded from disk',
              trigger_rule: { type: 'manual_run_now', run_now: true },
              backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
              progression_policy: {
                success_statuses: ['completed'],
                approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
                failure_policy: { retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 100 } },
              },
              status: 'paused',
              authority: {
                session_id: 'persisted-session',
                workspace_id: 'persisted-workspace',
                project_id: 'persisted-project',
              },
              last_trigger: 'manual_run_now',
            },
            {
              task_id: 'broken-task',
              title: '',
            },
          ],
        }),
        'utf-8',
      );

      const { workflowSchedulerList } = await import('../../mcp/services/workflow.js');
      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'persisted-workspace',
        projectId: 'persisted-project',
        sessionId: 'persisted-session',
      });

      const limited = await workflowSchedulerList({ workspace, limit: -5 });
      expect(limited['total']).toBe(1);
      expect(limited['tasks']).toEqual([]);

      const listed = await workflowSchedulerList({ workspace });
      expect(listed['tasks']).toEqual([
        expect.objectContaining({
          task_id: 'persisted-task',
          status: 'paused',
          last_trigger: 'manual_run_now',
          authority: {
            sessionId: 'persisted-session',
            workspaceId: 'persisted-workspace',
            projectId: 'persisted-project',
          },
        }),
      ]);

      const globalDefault = await workflowSchedulerList({ limit: Number.NaN });
      expect(globalDefault['total']).toBe(1);
      expect((globalDefault['tasks'] as Array<Record<string, unknown>>)[0]?.['task_id']).toBe('persisted-task');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('imports lite-plan tasks while separating updated, conflicting, malformed, and newly registered entries', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-lite-import-'));

    try {
      const {
        workflowSchedulerImportLitePlan,
        workflowSchedulerList,
        workflowSchedulerRegister,
      } = await import('../../mcp/services/workflow.js');

      const workspaceA = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-a',
      });
      const workspaceB = buildWorkspace({
        workspaceRoot,
        workspaceId: 'beacon-workspace',
        projectId: 'beacon-project',
        sessionId: 'session-b',
      });

      await workflowSchedulerRegister({
        definition: buildSchedulerDefinition(
          'lite-session-import-001-task-001',
          'Conflict task',
          'existing task from workspace A',
        ),
        workspace: workspaceA,
      });

      await workflowSchedulerRegister({
        definition: buildSchedulerDefinition(
          'lite-session-import-001-task-002',
          'Updated task',
          'existing task from workspace B',
        ),
        workspace: workspaceB,
      });

      const planDir = join(workspaceRoot, '.workflow', '.lite-plan', 'session-import-001');
      const taskDir = join(planDir, '.task');
      await mkdir(taskDir, { recursive: true });

      await writeFile(
        join(planDir, 'plan.json'),
        JSON.stringify({
          summary: 'scheduler import coverage',
          task_ids: ['TASK-001', 'TASK-002', 'TASK-003', 'TASK-004'],
        }),
        'utf-8',
      );

      await writeFile(
        join(taskDir, 'TASK-001.json'),
        JSON.stringify({
          id: 'TASK-001',
          title: 'Conflicting task',
          description: 'should conflict on authority',
        }),
        'utf-8',
      );
      await writeFile(
        join(taskDir, 'TASK-002.json'),
        JSON.stringify({
          id: 'TASK-002',
          title: 'Updated task',
          description: 'updated via lite import',
        }),
        'utf-8',
      );
      await writeFile(
        join(taskDir, 'TASK-003.json'),
        '{"id":"TASK-003","title":"Broken task"',
        'utf-8',
      );
      await writeFile(
        join(taskDir, 'TASK-004.json'),
        JSON.stringify({
          id: 'TASK-004',
          title: 'Fresh task',
          scope: 'scope fallback text',
        }),
        'utf-8',
      );

      const imported = await workflowSchedulerImportLitePlan({
        sessionId: 'session-import-001',
        forceLevel: 'L4',
        enabled: true,
        workspace: workspaceB,
      });

      expect(imported['session_id']).toBe('session-import-001');
      expect(imported['imported']).toBe(2);
      expect(imported['registered']).toBe(1);
      expect(imported['updated']).toBe(1);
      expect(imported['failed']).toBe(2);
      expect(imported['total_tasks']).toBe(4);
      expect(imported['force_level']).toBe('L4');

      const failures = imported['failures'] as Array<{ task_id: string; error: string }>;
      expect(failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            task_id: 'TASK-001',
            error: expect.stringContaining("workflow session 'session-a'"),
          }),
          expect.objectContaining({
            task_id: 'TASK-003',
            error: expect.stringContaining('Expected'),
          }),
        ]),
      );

      const tasks = imported['tasks'] as Array<Record<string, unknown>>;
      expect(tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            task_id: 'lite-session-import-001-task-002',
            title: 'Updated task',
            level: 'L4',
          }),
          expect.objectContaining({
            task_id: 'lite-session-import-001-task-004',
            task: 'scope fallback text',
            level: 'L4',
          }),
        ]),
      );

      const listed = await workflowSchedulerList({ workspace: workspaceB });
      const listedTasks = listed['tasks'] as Array<Record<string, unknown>>;
      expect(listedTasks.some((task) => task['task_id'] === 'lite-session-import-001-task-002')).toBe(true);
      expect(listedTasks.some((task) => task['task_id'] === 'lite-session-import-001-task-004')).toBe(true);
      expect(listedTasks.some((task) => task['task_id'] === 'lite-session-import-001-task-001')).toBe(false);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('imports the latest lite-plan session when no session id is provided and falls back to task id/title defaults', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-lite-latest-'));

    try {
      const { workflowSchedulerImportLitePlan } = await import('../../mcp/services/workflow.js');
      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-latest',
      });

      const baseDir = join(workspaceRoot, '.workflow', '.lite-plan');
      const oldDir = join(baseDir, 'session-old');
      const newDir = join(baseDir, 'session-new');
      await mkdir(join(oldDir, '.task'), { recursive: true });
      await writeFile(
        join(oldDir, 'plan.json'),
        JSON.stringify({ task_ids: ['TASK-OLD'] }),
        'utf-8',
      );
      await writeFile(
        join(oldDir, '.task', 'TASK-OLD.json'),
        JSON.stringify({ id: 'TASK-OLD', title: 'Old title', description: 'old description' }),
        'utf-8',
      );

      await new Promise((resolve) => setTimeout(resolve, 15));

      await mkdir(join(newDir, '.task'), { recursive: true });
      await writeFile(
        join(newDir, 'plan.json'),
        JSON.stringify({ task_ids: ['TASK-NEW'] }),
        'utf-8',
      );
      await writeFile(
        join(newDir, '.task', 'TASK-NEW.json'),
        JSON.stringify({ id: 'TASK-NEW', scope: 'scope-only fallback' }),
        'utf-8',
      );

      const imported = await workflowSchedulerImportLitePlan({
        workspace,
        enabled: false,
      });

      expect(imported['session_id']).toBe('session-new');
      expect(imported['imported']).toBe(1);
      expect(imported['registered']).toBe(1);
      expect(imported['force_level']).toBe('L5');
      expect(imported['tasks']).toEqual([
        expect.objectContaining({
          task_id: 'lite-session-new-task-new',
          title: 'TASK-NEW',
          task: 'scope-only fallback',
          status: 'paused',
          level: 'L5',
        }),
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('dedupes the global scheduler list by task id using the latest update across workspace roots', async () => {
    const workspaceRootA = await mkdtemp(join(tmpdir(), 'niko-workflow-list-a-'));
    const workspaceRootB = await mkdtemp(join(tmpdir(), 'niko-workflow-list-b-'));

    try {
      const { workflowSchedulerList, workflowSchedulerRegister } = await import('../../mcp/services/workflow.js');

      await workflowSchedulerRegister({
        definition: buildSchedulerDefinition('shared-task-id', 'Older title', 'older task body'),
        workspace: buildWorkspace({
          workspaceRoot: workspaceRootA,
          workspaceId: 'workspace-a',
          projectId: 'project-a',
          sessionId: 'session-a',
        }),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await workflowSchedulerRegister({
        definition: buildSchedulerDefinition('shared-task-id', 'Newer title', 'newer task body'),
        workspace: buildWorkspace({
          workspaceRoot: workspaceRootB,
          workspaceId: 'workspace-b',
          projectId: 'project-b',
          sessionId: 'session-b',
        }),
      });

      const listed = await workflowSchedulerList({ limit: 10 });
      expect(listed['total']).toBe(1);
      expect(listed['tasks']).toEqual([
        expect.objectContaining({
          task_id: 'shared-task-id',
          title: 'Newer title',
          task: 'newer task body',
        }),
      ]);
    } finally {
      await rm(workspaceRootA, { recursive: true, force: true });
      await rm(workspaceRootB, { recursive: true, force: true });
    }
  });

  it('falls back to bindPlanSession when the runtime does not expose bindPlanAuthority', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-bind-session-'));

    try {
      const bindPlanSessionMock = vi.fn();
      const {
        resetWorkflowEngineRuntimeProvider,
        setWorkflowEngineRuntimeProvider,
        workflowPlan,
      } = await import('../../mcp/services/workflow.js');

      setWorkflowEngineRuntimeProvider(() => ({
        ...createRuntime({
          plan: vi.fn().mockResolvedValue({ plan_id: 'plan-session-fallback' }),
          bindPlanSession: bindPlanSessionMock,
        }),
        bindPlanAuthority: undefined,
      }));

      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-bind-fallback',
      });

      const result = await workflowPlan({
        task: 'bind fallback task',
        workspace,
      });

      expect(result).toEqual({ plan_id: 'plan-session-fallback' });
      expect(bindPlanSessionMock).toHaveBeenCalledWith('plan-session-fallback', 'session-bind-fallback');

      resetWorkflowEngineRuntimeProvider();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns scheduler run-now planning failures without executing and preserves persisted scheduler state', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-run-now-fail-'));

    try {
      const executeMock = vi.fn();
      const planMock = vi.fn().mockResolvedValue({ error: 'plan creation failed' });

      const {
        setWorkflowEngineRuntimeProvider,
        resetWorkflowEngineRuntimeProvider,
        workflowSchedulerList,
        workflowSchedulerRegister,
        workflowSchedulerRunNow,
      } = await import('../../mcp/services/workflow.js');

      setWorkflowEngineRuntimeProvider(() => createRuntime({
        plan: planMock,
        execute: executeMock,
      }));

      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-run-now',
      });

      await workflowSchedulerRegister({
        definition: buildSchedulerDefinition('sched-run-fail', 'Run fail task', 'task that cannot plan'),
        workspace,
      });

      const failed = await workflowSchedulerRunNow({
        taskId: 'sched-run-fail',
        workspace,
      });
      expect(failed).toEqual({
        error: 'plan creation failed',
        task: expect.objectContaining({ task_id: 'sched-run-fail' }),
        plan: { error: 'plan creation failed' },
      });
      expect(executeMock).not.toHaveBeenCalled();

      const persisted = JSON.parse(
        await readFile(join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'), 'utf-8'),
      ) as {
        tasks: Array<Record<string, unknown>>;
      };
      expect(persisted.tasks).toEqual([
        expect.objectContaining({
          task_id: 'sched-run-fail',
          last_plan_id: null,
          last_run_id: null,
        }),
      ]);

      const listed = await workflowSchedulerList({ workspace });
      expect(listed['tasks']).toEqual([
        expect.objectContaining({
          task_id: 'sched-run-fail',
          last_plan_id: null,
          last_run_id: null,
        }),
      ]);
      expect(planMock).toHaveBeenCalledOnce();

      resetWorkflowEngineRuntimeProvider();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('rejects invalid scheduler definitions and missing resume targets', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-invalid-scheduler-'));

    try {
      const { workflowSchedulerRegister, workflowSchedulerResume } = await import('../../mcp/services/workflow.js');
      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-invalid-scheduler',
      });

      const invalid = await workflowSchedulerRegister({
        definition: { task_id: 'only-id' },
        workspace,
      });
      expect(invalid).toEqual({ error: 'Invalid scheduler task definition' });

      const missing = await workflowSchedulerResume({
        taskId: 'missing-task',
        workspace,
      });
      expect(missing).toEqual({ error: "Scheduler task 'missing-task' not found" });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('filters missing checkpoint summaries, rejects missing checkpoints, and blocks unbound checkpoint restores', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-workflow-checkpoints-'));

    try {
      const createCheckpointMock = vi.fn().mockResolvedValue({ checkpoint_id: 'cp-bound' });
      const listCheckpointsMock = vi.fn().mockResolvedValue([
        { id: 'cp-bound', description: 'bound checkpoint', created_at: '2026-06-05T00:00:00.000Z' },
        { id: 'cp-ghost', description: 'missing checkpoint', created_at: '2026-06-05T00:00:01.000Z' },
      ]);
      const getCheckpointMock = vi.fn((checkpointId: string) => {
        if (checkpointId === 'cp-bound') {
          return {
            id: 'cp-bound',
            description: 'bound checkpoint',
            created_at: '2026-06-05T00:00:00.000Z',
            replay_payload: {},
            plan_id: null,
            step_id: null,
          };
        }
        if (checkpointId === 'cp-plan') {
          return {
            id: 'cp-plan',
            description: 'plan checkpoint',
            created_at: '2026-06-05T00:00:02.000Z',
            replay_payload: {},
            plan_id: 'plan-9',
            step_id: null,
          };
        }
        return null;
      });

      const {
        checkpointCreate,
        checkpointList,
        checkpointRestore,
        resetWorkflowEngineRuntimeProvider,
        setWorkflowEngineRuntimeProvider,
      } = await import('../../mcp/services/workflow.js');

      setWorkflowEngineRuntimeProvider(() => createRuntime({
        createCheckpoint: createCheckpointMock,
        getCheckpoint: getCheckpointMock,
        listCheckpoints: listCheckpointsMock,
      }));

      const workspace = buildWorkspace({
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        sessionId: 'session-checkpoints',
      });

      await checkpointCreate('bound checkpoint', false, workspace);

      const listed = await checkpointList(10, workspace);
      expect(listed).toEqual([
        {
          id: 'cp-bound',
          description: 'bound checkpoint',
          created_at: '2026-06-05T00:00:00.000Z',
        },
      ]);

      const missing = await checkpointRestore('cp-missing', null, workspace);
      expect(missing).toEqual({ error: "Checkpoint 'cp-missing' not found" });

      const unbound = await checkpointRestore('cp-plan', null, workspace);
      expect(unbound).toEqual({
        error: "Checkpoint 'cp-plan' is not bound to workspace authority and cannot be restored from a different scope",
      });

      resetWorkflowEngineRuntimeProvider();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
