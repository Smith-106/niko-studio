import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { WorkflowEngine } from '../../workflow/workflow-engine.js';

describe('WorkflowEngine integration', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-workflow-engine-'));
  });

  afterEach(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('plans and executes an L2 workflow to completion through the public API', async () => {
    const engine = new WorkflowEngine(workspace, 'phase3-test');

    const plan = await engine.plan('写一段角色初次登场的描写', 'L2');
    const planId = String(plan['plan_id']);

    expect(plan['level']).toBe('L2');
    expect(plan['total_steps']).toBe(3);

    let latest = await engine.execute(planId);
    expect(latest['status']).toBe('completed');
    expect(latest['step_name']).toBe('analyze');

    latest = await engine.execute(planId);
    expect(latest['step_name']).toBe('match_skills');

    latest = await engine.execute(planId);
    expect(latest['step_name']).toBe('generate');
    expect(latest['plan_status']).toBe('completed');

    const status = engine.getPlanStatus(planId);
    expect(status['status']).toBe('completed');
    expect(status['progress']).toBe('3/3');
  });

  it('streams L2 workflow events from plan creation to completion', async () => {
    const engine = new WorkflowEngine(workspace, 'phase3-stream');

    const events: Record<string, unknown>[] = [];
    for await (const event of engine.runStream('写一段带冲突的场景', 'L2')) {
      events.push(event);
    }

    expect(events[0]?.['type']).toBe('plan_created');
    expect(events.some(event => event['type'] === 'step_complete')).toBe(true);
    expect(events.at(-1)?.['type']).toBe('plan_complete');
    expect(events.at(-1)?.['status']).toBe('completed');
  });

  it('supports lifecycle pause and resume on a public plan', async () => {
    const engine = new WorkflowEngine(workspace, 'phase3-lifecycle');

    const plan = await engine.plan('写一章并逐步完善冲突与细节', 'L3');
    const planId = String(plan['plan_id']);

    const pauseResult = await engine.lifecycle(planId, 'pause');
    expect(pauseResult['runner_state']).toBe('paused');
    expect(pauseResult['checkpoint_id']).toBeTruthy();

    const resumeResult = await engine.lifecycle(planId, 'resume');
    expect(resumeResult['runner_state']).toBe('running');

    const status = engine.getPlanStatus(planId);
    expect(status['runner_state']).toBe('running');
  });
});
