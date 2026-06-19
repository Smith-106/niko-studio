import { describe, expect, it, vi } from 'vitest';

import { QualityGateFeedbackLoopImpl } from '../../workflow/quality-gate-loop.js';
import type {
  RemediationPlan,
  VerificationGap,
} from '../../workflow/quality-gate-loop.js';

function createEventBus() {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    unsubscribe: vi.fn(),
  };
}

describe('workflow/quality-gate-loop additional coverage', () => {
  it('keeps manual remediation plans without executing them when autoExecute is disabled', async () => {
    const eventBus = createEventBus();
    const loop = new QualityGateFeedbackLoopImpl(eventBus, undefined, undefined, {
      autoExecute: false,
      maxRetries: 2,
    });

    const gaps = [
      {
        id: 'gap-1',
        title: 'Auth coverage gap',
        status: 'FAILED',
        evidence: 'no auth assertions',
      },
      {
        id: 'gap-2',
        title: 'Cache stub',
        status: 'STUB',
        evidence: 'stubbed implementation',
      },
      {
        id: 'gap-3',
        title: 'Ignored by filter',
        status: 'PASSED' as never,
        evidence: 'already clean',
      },
    ] satisfies VerificationGap[];

    const actionable = loop.detectGaps({ gaps });
    expect(actionable.map((gap) => gap.id)).toEqual(['gap-1', 'gap-2']);

    const plans = loop.generateRemediation(actionable);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      gapId: 'gap-1',
      retryCount: 0,
      maxRetries: 2,
    });
    expect(plans[0].subPlanSpec.subTasks[0]?.task).toContain('no auth assertions');
    expect(loop.getActiveRemediations()).toHaveLength(2);

    const result = await loop.runFeedbackLoop({ gaps });

    expect(result).toMatchObject({
      totalGaps: 2,
      fixedGaps: 0,
      unfixedGaps: 2,
      escalated: 0,
      iterations: 1,
    });
    expect(result.details.every((detail) => detail.evidence.includes('not auto-executed'))).toBe(true);
    expect(loop.getActiveRemediations()).toEqual([]);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'quality:gap-detected',
      expect.objectContaining({ gapId: 'gap-1' }),
    );
  });

  it('handles dispatcher partial success, dispatcher failure, and empty fallback plans', async () => {
    const eventBus = createEventBus();
    const completeDispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['fix-gap-ok-a', { id: 'fix-gap-ok-a', status: 'completed', error: null }],
          ['fix-gap-ok-b', { id: 'fix-gap-ok-b', status: 'completed', error: null }],
        ]),
      }),
    };
    const completeLoop = new QualityGateFeedbackLoopImpl(eventBus, completeDispatcher as never);
    const completePlan: RemediationPlan = {
      gapId: 'gap-complete',
      gapTitle: 'Complete gap',
      retryCount: 0,
      maxRetries: 2,
      subPlanSpec: {
        parentTaskId: 'remediation-gap-complete',
        aggregation: 'sequential',
        maxParallelism: 1,
        subTasks: [
          { id: 'fix-gap-ok-a', task: 'first fix' },
          { id: 'fix-gap-ok-b', task: 'second fix' },
        ],
      },
    };

    await expect(completeLoop.executeRemediation(completePlan)).resolves.toEqual({
      gapId: 'gap-complete',
      status: 'fixed',
      attempts: 1,
      evidence: '[fix-gap-ok-a] completed: ok; [fix-gap-ok-b] completed: ok',
    });

    const partialDispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['fix-gap-a', { id: 'fix-gap-a', status: 'completed', error: null }],
          ['fix-gap-b', { id: 'fix-gap-b', status: 'failed', error: 'still broken' }],
        ]),
      }),
    };
    const partialLoop = new QualityGateFeedbackLoopImpl(eventBus, partialDispatcher as never);
    const partialPlan: RemediationPlan = {
      gapId: 'gap-a',
      gapTitle: 'Partial gap',
      retryCount: 1,
      maxRetries: 3,
      subPlanSpec: {
        parentTaskId: 'remediation-gap-a',
        aggregation: 'sequential',
        maxParallelism: 1,
        subTasks: [
          { id: 'fix-gap-a', task: 'first fix' },
          { id: 'fix-gap-b', task: 'second fix' },
        ],
      },
    };

    await expect(partialLoop.executeRemediation(partialPlan)).resolves.toEqual({
      gapId: 'gap-a',
      status: 'partially-fixed',
      attempts: 2,
      evidence: '[fix-gap-a] completed: ok; [fix-gap-b] failed: still broken',
    });

    const throwingDispatcher = {
      submitSubPlan: vi.fn().mockRejectedValue(new Error('dispatcher offline')),
    };
    const throwingLoop = new QualityGateFeedbackLoopImpl(eventBus, throwingDispatcher as never);

    await expect(throwingLoop.executeRemediation(partialPlan)).resolves.toMatchObject({
      gapId: 'gap-a',
      status: 'unfixed',
      attempts: 2,
    });

    const fallbackLoop = new QualityGateFeedbackLoopImpl(eventBus);
    const emptyPlan: RemediationPlan = {
      gapId: 'gap-empty',
      gapTitle: 'Empty task list',
      retryCount: 0,
      maxRetries: 1,
      subPlanSpec: {
        parentTaskId: 'remediation-gap-empty',
        aggregation: 'sequential',
        maxParallelism: 1,
        subTasks: [],
      },
    };

    await expect(fallbackLoop.executeRemediation(emptyPlan)).resolves.toEqual({
      gapId: 'gap-empty',
      status: 'unfixed',
      attempts: 1,
      evidence: 'Simple execution could not resolve gap "Empty task list"',
    });
  });

  it('escalates exhausted gaps and removes them from the active remediation map', () => {
    const eventBus = createEventBus();
    const loop = new QualityGateFeedbackLoopImpl(eventBus, undefined, undefined, {
      escalationChannel: 'quality:custom-escalation',
    });

    loop.generateRemediation([
      {
        id: 'gap-escalate',
        title: 'Needs human review',
        status: 'FAILED',
        evidence: 'non-deterministic failure',
      },
    ]);
    expect(loop.getActiveRemediations()).toHaveLength(1);

    loop.escalate(
      {
        id: 'gap-escalate',
        title: 'Needs human review',
        status: 'FAILED',
        evidence: 'non-deterministic failure',
        mappedTaskId: 'task-9',
      },
      'manual escalation',
    );

    expect(loop.getActiveRemediations()).toEqual([]);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'quality:custom-escalation',
      expect.objectContaining({
        gapId: 'gap-escalate',
        mappedTaskId: 'task-9',
        requiresHumanReview: true,
        reason: 'manual escalation',
      }),
    );
  });
});
