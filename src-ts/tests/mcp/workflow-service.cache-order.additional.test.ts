import { afterEach, describe, expect, it } from 'vitest';
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

function buildTask(taskId: string, workspaceId: string, projectId: string) {
  return {
    task_id: taskId,
    title: `Task ${taskId}`,
    task: `run ${taskId}`,
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
      workspace_id: workspaceId,
      project_id: projectId,
    },
    last_run_id: null,
    last_plan_id: null,
    last_trigger: null,
  };
}

async function writeSchedulerStore(workspaceRoot: string, task: Record<string, unknown>) {
  await mkdir(join(workspaceRoot, '.writing', 'scheduler'), { recursive: true });
  await writeFile(
    join(workspaceRoot, '.writing', 'scheduler', 'tasks.json'),
    `${JSON.stringify({ version: 1, tasks: [task] }, null, 2)}\n`,
    'utf-8',
  );
}

describe('mcp workflow service cache order additional coverage', () => {
  const roots: string[] = [];

  afterEach(async () => {
    try {
      const workflow = await import('../../mcp/services/workflow.js');
      workflow.resetWorkflowEngineRuntimeProvider();
    } catch {
      // ignore when module was not loaded
    }
    while (roots.length > 0) {
      await rm(roots.pop() as string, { recursive: true, force: true });
    }
  });

  it('reorders fallback cache candidates so the preferred workspace is checked first', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'niko-workflow-cache-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'niko-workflow-cache-b-'));
    roots.push(rootA, rootB);

    await writeSchedulerStore(rootA, buildTask('task-a', 'workspace-alpha', 'project-shared'));
    await writeSchedulerStore(rootB, buildTask('task-b', 'workspace-beta', 'project-shared'));

    const {
      workflowSchedulerList,
      workflowSchedulerPause,
    } = await import('../../mcp/services/workflow.js');

    const workspaceA = buildWorkspace({
      workspaceRoot: rootA,
      workspaceId: 'workspace-alpha',
      projectId: 'project-shared',
      sessionId: '',
    });
    const workspaceB = buildWorkspace({
      workspaceRoot: rootB,
      workspaceId: 'workspace-beta',
      projectId: 'project-shared',
      sessionId: '',
    });

    await workflowSchedulerList({ workspace: workspaceA });
    await workflowSchedulerList({ workspace: workspaceB });

    await expect(workflowSchedulerPause({ taskId: 'task-b', workspace: workspaceB })).resolves.toEqual({
      status: 'paused',
      task: expect.objectContaining({
        task_id: 'task-b',
        status: 'paused',
        authority: {
          sessionId: null,
          workspaceId: 'workspace-beta',
          projectId: 'project-shared',
        },
      }),
    });
  });
});
