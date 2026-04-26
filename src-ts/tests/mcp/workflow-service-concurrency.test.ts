import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectWorkspaceContext } from '../../project/workspace-model';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const bindPlanSessionMock = vi.fn();
const listCheckpointsMock = vi.fn();
const checkpointsMock = new Map<string, Record<string, unknown>>();

vi.mock('../../workflow/workflow-engine.js', () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({
    route: routeMock,
    plan: planMock,
    execute: executeMock,
    quickRollback: quickRollbackMock,
    lifecycle: lifecycleMock,
    createCheckpoint: createCheckpointMock,
    restoreCheckpoint: restoreCheckpointMock,
    listCheckpoints: listCheckpointsMock,
    bindPlanSession: bindPlanSessionMock,
    checkpoints: checkpointsMock,
  })),
}));

function buildWorkspace(params: {
  workspaceRoot: string;
  workspaceId: string;
  projectId: string;
  sessionId: string;
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
      conversationId: params.sessionId,
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
    schedule_rule: {
      cadence: 'cron',
      cron: '0 2 * * *',
      timezone: 'Asia/Shanghai',
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
}

describe('workflow scheduler workspace concurrency isolation', () => {
  let workspaceRootA = '';
  let workspaceRootB = '';

  beforeEach(async () => {
    workspaceRootA = await mkdtemp(join(tmpdir(), 'niko-workflow-concurrency-a-'));
    workspaceRootB = await mkdtemp(join(tmpdir(), 'niko-workflow-concurrency-b-'));
    planMock.mockReset();
    executeMock.mockReset();
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    checkpointsMock.clear();
    await rm(workspaceRootA, { recursive: true, force: true });
    await rm(workspaceRootB, { recursive: true, force: true });
  });

  it('isolates concurrent registration for identical task IDs across different workspace roots', async () => {
    const { workflowSchedulerRegister, workflowSchedulerList } = await import('../../mcp/services/workflow.js');

    const taskId = 'shared-task-id';
    const workspaceA = buildWorkspace({
      workspaceRoot: workspaceRootA,
      workspaceId: 'workspace-a',
      projectId: 'project-a',
      sessionId: 'workflow-session-a',
    });
    const workspaceB = buildWorkspace({
      workspaceRoot: workspaceRootB,
      workspaceId: 'workspace-b',
      projectId: 'project-b',
      sessionId: 'workflow-session-b',
    });

    const [registerA, registerB] = await Promise.all([
      workflowSchedulerRegister({
        definition: buildSchedulerDefinition(taskId, 'Task A', 'draft chapter for workspace A'),
        workspace: workspaceA,
      }),
      workflowSchedulerRegister({
        definition: buildSchedulerDefinition(taskId, 'Task B', 'draft chapter for workspace B'),
        workspace: workspaceB,
      }),
    ]);

    expect(registerA.status).toBe('registered');
    expect(registerB.status).toBe('registered');

    const [listA, listB] = await Promise.all([
      workflowSchedulerList({ workspace: workspaceA }),
      workflowSchedulerList({ workspace: workspaceB }),
    ]);

    const tasksA = listA.tasks as Array<Record<string, unknown>>;
    const tasksB = listB.tasks as Array<Record<string, unknown>>;

    expect(tasksA).toHaveLength(1);
    expect(tasksB).toHaveLength(1);
    expect(tasksA[0]?.task_id).toBe(taskId);
    expect(tasksB[0]?.task_id).toBe(taskId);
    expect(tasksA[0]?.title).toBe('Task A');
    expect(tasksB[0]?.title).toBe('Task B');

    const storeA = JSON.parse(
      await readFile(join(workspaceRootA, '.writing', 'scheduler', 'tasks.json'), 'utf-8'),
    ) as { tasks: Array<Record<string, unknown>> };
    const storeB = JSON.parse(
      await readFile(join(workspaceRootB, '.writing', 'scheduler', 'tasks.json'), 'utf-8'),
    ) as { tasks: Array<Record<string, unknown>> };

    expect(storeA.tasks).toHaveLength(1);
    expect(storeB.tasks).toHaveLength(1);
    expect(storeA.tasks[0]?.title).toBe('Task A');
    expect(storeB.tasks[0]?.title).toBe('Task B');
  });

  it('keeps pause and run-now isolated during concurrent cross-workspace operations', async () => {
    const {
      workflowSchedulerRegister,
      workflowSchedulerPause,
      workflowSchedulerRunNow,
      workflowSchedulerList,
    } = await import('../../mcp/services/workflow.js');

    planMock.mockImplementation(async (task: string) => ({
      plan_id: task.includes('workspace A') ? 'plan-workspace-a' : 'plan-workspace-b',
    }));
    executeMock.mockResolvedValue({ status: 'completed', step_name: 'analyze' });

    const taskId = 'shared-task-ops';
    const workspaceA = buildWorkspace({
      workspaceRoot: workspaceRootA,
      workspaceId: 'workspace-a',
      projectId: 'project-a',
      sessionId: 'workflow-session-a',
    });
    const workspaceB = buildWorkspace({
      workspaceRoot: workspaceRootB,
      workspaceId: 'workspace-b',
      projectId: 'project-b',
      sessionId: 'workflow-session-b',
    });

    await Promise.all([
      workflowSchedulerRegister({
        definition: buildSchedulerDefinition(taskId, 'Task A', 'run task for workspace A'),
        workspace: workspaceA,
      }),
      workflowSchedulerRegister({
        definition: buildSchedulerDefinition(taskId, 'Task B', 'run task for workspace B'),
        workspace: workspaceB,
      }),
    ]);

    const [pauseA, runNowB] = await Promise.all([
      workflowSchedulerPause({ taskId, workspace: workspaceA }),
      workflowSchedulerRunNow({ taskId, workspace: workspaceB }),
    ]);

    expect(pauseA.status).toBe('paused');
    expect(runNowB.status).toBe('completed');
    expect(runNowB.plan_id).toBe('plan-workspace-b');

    const [listA, listB] = await Promise.all([
      workflowSchedulerList({ workspace: workspaceA }),
      workflowSchedulerList({ workspace: workspaceB }),
    ]);

    const taskA = (listA.tasks as Array<Record<string, unknown>>)[0];
    const taskB = (listB.tasks as Array<Record<string, unknown>>)[0];

    expect(taskA?.status).toBe('paused');
    expect(taskA?.last_plan_id).toBeNull();
    expect(taskB?.status).toBe('active');
    expect(taskB?.last_plan_id).toBe('plan-workspace-b');
    expect(taskB?.last_trigger).toBe('manual_run_now');
  });
});
