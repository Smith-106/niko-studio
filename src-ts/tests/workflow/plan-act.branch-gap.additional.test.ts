import { describe, expect, it, vi } from 'vitest';

import {
  ActPhaseExecutor,
  PlanActState,
  PlanPhaseExecutor,
  ReviewPhaseExecutor,
  RevisePhaseExecutor,
  WorkflowPhase,
} from '../../workflow/modes/plan-act.js';

describe('workflow/modes/plan-act branch-gap coverage', () => {
  it('restores missing checkpoint fields and exercises fallback task or steps or issues branches', async () => {
    const checkpointState = new PlanActState('checkpoint-fallback');
    checkpointState.currentPhase = WorkflowPhase.REVIEW;
    checkpointState.iteration = 2;
    checkpointState.restoreCheckpoint({
      phase: WorkflowPhase.REVIEW,
      timestamp: new Date().toISOString(),
      state: {},
      iteration: 2,
    });

    expect(checkpointState.plan).toBeNull();
    expect(checkpointState.output).toBeNull();
    expect(checkpointState.reviewFeedback).toBeNull();

    const planState = new PlanActState('plan-fallback');
    const planResult = await new PlanPhaseExecutor().execute(planState, {
      requirements: ['preserve-default-task'],
    });

    expect(planResult.success).toBe(true);
    expect(planState.plan).toMatchObject({
      task: '',
      skills_required: [],
    });

    const actState = new PlanActState('act-fallback');
    actState.plan = {};
    actState.reviewFeedback = null;
    const actResult = await new ActPhaseExecutor().execute(actState, {});

    expect(actResult).toMatchObject({
      phase: WorkflowPhase.ACT,
      success: true,
      nextPhase: WorkflowPhase.REVIEW,
    });
    expect(String(actResult.output)).toContain('[Generated content for: ]');

    const reviseState = new PlanActState('revise-fallback');
    reviseState.output = 'draft output';
    reviseState.reviewFeedback = {};
    const reviseResult = await new RevisePhaseExecutor().execute(reviseState, {});

    expect(reviseResult).toMatchObject({
      phase: WorkflowPhase.REVISE,
      success: true,
      nextPhase: WorkflowPhase.REVIEW,
      metadata: {
        iteration: 1,
      },
    });
    expect(reviseResult.output).toBe('draft output');
  });

  it('wraps non-Error thrown values in every phase executor', async () => {
    const planResult = await new PlanPhaseExecutor({
      plan: vi.fn().mockRejectedValue('plan-string-failure'),
    }).execute(new PlanActState('plan-string'), {});
    expect(planResult.error?.message).toBe('plan-string-failure');

    const actState = new PlanActState('act-string');
    actState.plan = { steps: [] };
    const actResult = await new ActPhaseExecutor({
      write: vi.fn().mockRejectedValue({ reason: 'write-object-failure' }),
    }).execute(actState, {});
    expect(actResult.error?.message).toBe('[object Object]');

    const reviewState = new PlanActState('review-string');
    reviewState.output = 'draft';
    const reviewResult = await new ReviewPhaseExecutor({
      evaluate: vi.fn().mockRejectedValue(42),
    }).execute(reviewState, {});
    expect(reviewResult.error?.message).toBe('42');

    const reviseState = new PlanActState('revise-string');
    reviseState.output = 'draft';
    reviseState.reviewFeedback = { issues: [] };
    const reviseResult = await new RevisePhaseExecutor({
      revise: vi.fn().mockRejectedValue(false),
    }).execute(reviseState, {});
    expect(reviseResult.error?.message).toBe('false');
  });
});
