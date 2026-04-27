import { describe, it, expect } from 'vitest';

import {
  createWorkflowObservabilityBaseline,
  refreshWorkflowObservability,
  createWorkflowBudgetGuardrailBaseline,
  refreshWorkflowBudgetGuardrail,
  resolveWorkflowExecutionMode,
} from '../../../workflow/engine/observability.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('observability', () => {
  // ===================================================================
  // createWorkflowObservabilityBaseline
  // ===================================================================
  describe('createWorkflowObservabilityBaseline', () => {
    it('returns object with wave, mode, and aggregate with all zeros', () => {
      const result = createWorkflowObservabilityBaseline(['standard', 'eco']);

      expect(result['wave']).toBe(5);
      expect(result['mode']).toBe('standard');
      expect(result['upgrade_target']).toBe('standard');
      expect(result['upgrade_reason']).toBe('baseline');
      expect(result['mode_changed']).toBe(false);
      expect(result['threshold_triggered']).toBe(false);
      expect(result['aggregate']).toEqual({
        completed_steps: 0,
        failed_steps: 0,
        retry_count: 0,
        convergence_rounds: 0,
        mttr: 0.0,
        completion_rate: 0.0,
        failure_rate: 0.0,
      });
    });

    it('uses the first mode from the provided modes array', () => {
      const result = createWorkflowObservabilityBaseline(['fast', 'eco', 'standard']);
      expect(result['mode']).toBe('fast');
      expect(result['upgrade_target']).toBe('fast');
    });
  });

  // ===================================================================
  // refreshWorkflowObservability
  // ===================================================================
  describe('refreshWorkflowObservability', () => {
    const modes = ['standard', 'eco'] as const;

    it('counts done and failed steps using provided canonicalizeStatus', () => {
      const steps = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'error' },
        { status: 'pending' },
      ];
      const canonicalize = (s: string) => {
        if (s === 'completed') return 'done';
        if (s === 'error') return 'failed';
        return s;
      };

      const result = refreshWorkflowObservability(undefined, steps, canonicalize, modes);

      expect(result['aggregate']['completed_steps']).toBe(2);
      expect(result['aggregate']['failed_steps']).toBe(1);
    });

    it('computes completion_rate and failure_rate as percentages', () => {
      const steps = [
        { status: 'done' },
        { status: 'done' },
        { status: 'failed' },
        { status: 'pending' },
      ];
      const identity = (s: string) => s;

      const result = refreshWorkflowObservability(undefined, steps, identity, modes);

      // 2 done out of 4 = 50%, 1 failed out of 4 = 25%
      expect(result['aggregate']['completion_rate']).toBe(50);
      expect(result['aggregate']['failure_rate']).toBe(25);
    });

    it('handles empty steps array without division by zero', () => {
      const identity = (s: string) => s;
      const result = refreshWorkflowObservability(undefined, [], identity, modes);

      // totalSteps defaults to 1 when steps is empty
      expect(result['aggregate']['completion_rate']).toBe(0);
      expect(result['aggregate']['failure_rate']).toBe(0);
    });

    it('sets mode to the first observability mode', () => {
      const identity = (s: string) => s;
      const result = refreshWorkflowObservability(undefined, [], identity, modes);
      expect(result['mode']).toBe('standard');
    });

    it('merges into existing observability when current is provided', () => {
      const current = {
        wave: 3,
        mode: 'eco',
        aggregate: { completed_steps: 99 },
        extra_field: 'preserved',
      };
      const identity = (s: string) => s;
      const result = refreshWorkflowObservability(current, [{ status: 'done' }], identity, modes);

      expect(result['wave']).toBe(3);
      expect(result['extra_field']).toBe('preserved');
      expect(result['aggregate']['completed_steps']).toBe(1);
    });

    it('computes retry_count as max(0, failedSteps - 1)', () => {
      const steps = [
        { status: 'failed' },
        { status: 'failed' },
        { status: 'failed' },
      ];
      const identity = (s: string) => s;
      const result = refreshWorkflowObservability(undefined, steps, identity, modes);

      expect(result['aggregate']['failed_steps']).toBe(3);
      expect(result['aggregate']['retry_count']).toBe(2);
    });

    it('computes convergence_rounds as completedSteps + retry_count', () => {
      const steps = [
        { status: 'done' },
        { status: 'done' },
        { status: 'failed' },
      ];
      const identity = (s: string) => s;
      const result = refreshWorkflowObservability(undefined, steps, identity, modes);

      // completedSteps=2, retry_count=max(0,1-1)=0
      expect(result['aggregate']['convergence_rounds']).toBe(2);
    });
  });

  // ===================================================================
  // createWorkflowBudgetGuardrailBaseline
  // ===================================================================
  describe('createWorkflowBudgetGuardrailBaseline', () => {
    it('returns baseline with provided token/time budgets and zero usage', () => {
      const result = createWorkflowBudgetGuardrailBaseline(5000, 30);

      expect(result['token_budget']).toBe(5000);
      expect(result['time_budget_minutes']).toBe(30);
      expect(result['token_used']).toBe(0);
      expect(result['elapsed_minutes']).toBe(0.0);
      expect(result['threshold_triggered']).toBe(false);
      expect(result['degraded']).toBe(false);
      expect(result['degrade_mode']).toBe('');
      expect(result['reason']).toBe('within budget');
    });
  });

  // ===================================================================
  // refreshWorkflowBudgetGuardrail
  // ===================================================================
  describe('refreshWorkflowBudgetGuardrail', () => {
    it('computes token usage from step description lengths plus task length', () => {
      const steps = [
        { description: 'abcdefghij' },  // 10 chars
        { description: 'xyz' },         // 3 chars
      ];
      const task = 'hello';  // 5 chars
      const createdAt = new Date().toISOString();

      const result = refreshWorkflowBudgetGuardrail(
        undefined,
        steps,
        task,
        createdAt,
        1000,
        60,
        'eco',
      );

      expect(result.budgetGuardrail['token_used']).toBe(10 + 3 + 5);
    });

    it('computes elapsed time from createdAt', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const result = refreshWorkflowBudgetGuardrail(
        undefined,
        [],
        '',
        fiveMinutesAgo,
        10000,
        60,
        'eco',
      );

      const elapsed = result.budgetGuardrail['elapsed_minutes'] as number;
      // Allow small rounding tolerance
      expect(elapsed).toBeGreaterThanOrEqual(4.9);
      expect(elapsed).toBeLessThanOrEqual(5.1);
    });

    it('sets threshold_triggered and degraded when token budget exceeded', () => {
      const steps = [
        { description: 'a'.repeat(100) },
      ];
      const task = 'b'.repeat(100);

      const result = refreshWorkflowBudgetGuardrail(
        undefined,
        steps,
        task,
        new Date().toISOString(),
        50,  // token budget lower than 200 chars
        60,
        'eco',
      );

      expect(result.budgetGuardrail['threshold_triggered']).toBe(true);
      expect(result.budgetGuardrail['degraded']).toBe(true);
      expect(result.budgetGuardrail['degrade_mode']).toBe('eco');
      expect(result.budgetGuardrail['reason']).toBe('budget threshold breached');
      expect(result.overBudget).toBe(true);
    });

    it('does not degrade when within budget', () => {
      const result = refreshWorkflowBudgetGuardrail(
        undefined,
        [],
        'short',
        new Date().toISOString(),
        10000,
        60,
        'eco',
      );

      expect(result.budgetGuardrail['threshold_triggered']).toBe(false);
      expect(result.budgetGuardrail['degraded']).toBe(false);
      expect(result.budgetGuardrail['degrade_mode']).toBe('');
      expect(result.budgetGuardrail['reason']).toBe('within budget');
      expect(result.overBudget).toBe(false);
    });

    it('uses current budget values when provided instead of params', () => {
      const current = {
        token_budget: 20,
        time_budget_minutes: 1,
        token_used: 0,
        elapsed_minutes: 0,
      };
      const steps = [{ description: 'a'.repeat(25) }];
      const task = '';

      const result = refreshWorkflowBudgetGuardrail(
        current,
        steps,
        task,
        new Date().toISOString(),
        99999,  // high param budget, but current overrides
        999,    // high param time, but current overrides
        'eco',
      );

      // token_budget from current is 20, steps have 25 chars => over budget
      expect(result.overBudget).toBe(true);
      expect(result.budgetGuardrail['token_budget']).toBe(20);
    });

    it('handles steps without description field', () => {
      const steps = [
        { name: 'step-1' },
        { description: undefined },
      ];
      const task = 'task';

      const result = refreshWorkflowBudgetGuardrail(
        undefined,
        steps,
        task,
        new Date().toISOString(),
        10000,
        60,
        'eco',
      );

      // undefined description => length 0 (via nullish coalescing)
      expect(result.budgetGuardrail['token_used']).toBe(4);  // 'task'.length
    });
  });

  // ===================================================================
  // resolveWorkflowExecutionMode
  // ===================================================================
  describe('resolveWorkflowExecutionMode', () => {
    it('returns ecoModeLabel when degraded is true', () => {
      const result = resolveWorkflowExecutionMode(
        { degraded: true },
        'standard',
        'eco',
      );
      expect(result).toBe('eco');
    });

    it('returns observabilityMode when degraded is false', () => {
      const result = resolveWorkflowExecutionMode(
        { degraded: false },
        'standard',
        'eco',
      );
      expect(result).toBe('standard');
    });

    it('returns observabilityMode when degraded is absent (falsy)', () => {
      const result = resolveWorkflowExecutionMode(
        {},
        'fast',
        'eco',
      );
      expect(result).toBe('fast');
    });
  });
});
