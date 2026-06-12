import { describe, expect, it, vi } from 'vitest';

import { QualityGateFeedbackLoopImpl } from '../../workflow/quality-gate-loop.js';
import type { RemediationPlan } from '../../workflow/quality-gate-loop.js';

function createEventBus() {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    unsubscribe: vi.fn(),
  };
}

describe('workflow/quality-gate-loop branch gap coverage', () => {
  it('marks dispatcher remediation as unfixed when no subtask completes', async () => {
    const eventBus = createEventBus();
    const dispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['fix-gap-a', { id: 'fix-gap-a', status: 'failed', error: 'still broken' }],
          ['fix-gap-b', { id: 'fix-gap-b', status: 'timed_out', error: null }],
        ]),
      }),
    };
    const loop = new QualityGateFeedbackLoopImpl(eventBus, dispatcher as never);
    const plan: RemediationPlan = {
      gapId: 'gap-a',
      gapTitle: 'Unfixed dispatcher gap',
      retryCount: 0,
      maxRetries: 2,
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

    await expect(loop.executeRemediation(plan)).resolves.toEqual({
      gapId: 'gap-a',
      status: 'unfixed',
      attempts: 1,
      evidence: '[fix-gap-a] failed: still broken; [fix-gap-b] timed_out: ok',
    });
  });

  it('reports simple execution failures when the fallback executor throws', async () => {
    const eventBus = createEventBus();
    const loop = new QualityGateFeedbackLoopImpl(eventBus);
    const plan: RemediationPlan = {
      gapId: 'gap-throw',
      gapTitle: 'Throwing fallback',
      retryCount: 2,
      maxRetries: 3,
      subPlanSpec: {
        parentTaskId: 'remediation-gap-throw',
        aggregation: 'sequential',
        maxParallelism: 1,
        subTasks: [{ id: 'fix-gap-throw', task: 'throwing fix' }],
      },
    };

    vi
      .spyOn(loop as unknown as { _simpleExecute(plan: RemediationPlan): Promise<boolean> }, '_simpleExecute')
      .mockRejectedValue(new Error('fallback exploded'));

    await expect(loop.executeRemediation(plan)).resolves.toEqual({
      gapId: 'gap-throw',
      status: 'unfixed',
      attempts: 3,
      evidence: 'Simple execution failed: Error: fallback exploded',
    });
  });
});
