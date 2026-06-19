import { describe, expect, it } from 'vitest';

import { buildWorkflowPlanStatusResult } from '../../../workflow/engine/runtime-state.js';
import type { WorkflowPlanStatusResult } from '../../../workflow/engine/engine-contracts.js';

function makeStatusResult(): WorkflowPlanStatusResult {
  return {
    plan_id: 'plan-1',
    task: 'Draft chapter',
    level: 'L3',
    status: 'running',
    runner_state: 'running',
    triage_state: 'none',
    fix_status: '',
    fix_owner: '',
    template_meta: {
      nested: { phase: 1 },
    },
    gate_decision: 'allow',
    recommendations: [{ id: 'rec-1', score: 1 }],
    recommendations_frozen: false,
    plan_hash: 'hash-1',
    execution_mode: 'standard',
    observability_metrics: { latency_ms: 42 },
    budget_guardrail: { remaining: 2 },
    handoff_package: { notes: ['keep context'] },
    steps: [
      {
        id: 'step-1',
        name: 'Write',
        status: 'running',
        output: { partial: true },
      },
    ],
    progress: '1/3',
  };
}

describe('runtime-state additional coverage', () => {
  it('returns a structured clone for workflow plan status results', () => {
    const source = makeStatusResult();

    const cloned = buildWorkflowPlanStatusResult(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.template_meta).not.toBe(source.template_meta);
    expect(cloned.steps).not.toBe(source.steps);

    (cloned.template_meta.nested as { phase: number }).phase = 2;
    (cloned.steps[0]?.output as { partial: boolean }).partial = false;

    expect((source.template_meta.nested as { phase: number }).phase).toBe(1);
    expect((source.steps[0]?.output as { partial: boolean }).partial).toBe(true);
  });
});
