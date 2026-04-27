import { describe, it, expect, vi } from 'vitest';

import {
  validateWorkflowRunnerState,
  applyWorkflowRecommendationRefresh,
  applyWorkflowPreflightExecutionMode,
} from '../../../workflow/engine/preflight.js';
import type { WorkflowPlanPreflightState } from '../../../workflow/engine/preflight.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('preflight', () => {
  // ===================================================================
  // validateWorkflowRunnerState
  // ===================================================================
  describe('validateWorkflowRunnerState', () => {
    it('returns error message for stopped state', () => {
      const result = validateWorkflowRunnerState('stopped');
      expect(result).toBe('Loop runner is stopped');
    });

    it('returns error message for paused state', () => {
      const result = validateWorkflowRunnerState('paused');
      expect(result).toBe('Loop runner is paused');
    });

    it('returns null for running state', () => {
      const result = validateWorkflowRunnerState('running');
      expect(result).toBeNull();
    });

    it('returns null for any other state', () => {
      expect(validateWorkflowRunnerState('idle')).toBeNull();
      expect(validateWorkflowRunnerState('completed')).toBeNull();
      expect(validateWorkflowRunnerState('')).toBeNull();
    });
  });

  // ===================================================================
  // applyWorkflowRecommendationRefresh
  // ===================================================================
  describe('applyWorkflowRecommendationRefresh', () => {
    it('updates recommendations, sets frozen=false, and recomputes hash when recommendations provided', () => {
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: [{ old: true }],
        recommendations_frozen: true,
        plan_hash: 'old-hash',
        template_meta: {},
      };
      const newRecs = [{ action: 'refresh' }];
      const canonicalize = vi.fn().mockReturnValue([{ action: 'refresh', canonical: true }]);
      const computeHash = vi.fn().mockReturnValue('new-hash');

      applyWorkflowRecommendationRefresh(plan, newRecs, canonicalize, computeHash);

      expect(canonicalize).toHaveBeenCalledWith(newRecs);
      expect(plan.recommendations).toEqual([{ action: 'refresh', canonical: true }]);
      expect(plan.recommendations_frozen).toBe(false);
      expect(plan.plan_hash).toBe('new-hash');
      expect(computeHash).toHaveBeenCalled();
    });

    it('does not modify plan when recommendations are undefined', () => {
      const originalRecs = [{ existing: true }];
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: originalRecs,
        recommendations_frozen: true,
        plan_hash: 'existing-hash',
        template_meta: {},
      };
      const canonicalize = vi.fn();
      const computeHash = vi.fn().mockReturnValue('hash-1');

      applyWorkflowRecommendationRefresh(plan, undefined, canonicalize, computeHash);

      expect(canonicalize).not.toHaveBeenCalled();
      // recommendations unchanged
      expect(plan.recommendations).toBe(originalRecs);
      expect(plan.recommendations_frozen).toBe(true);
      // plan_hash is still set because of the fallback for empty plan_hash
      // but in this case plan_hash was 'existing-hash', so no recomputation
      expect(plan.plan_hash).toBe('existing-hash');
    });

    it('computes hash when plan_hash is empty even without recommendations', () => {
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: [],
        recommendations_frozen: false,
        plan_hash: '',
        template_meta: {},
      };
      const computeHash = vi.fn().mockReturnValue('fallback-hash');

      applyWorkflowRecommendationRefresh(plan, undefined, vi.fn(), computeHash);

      expect(plan.plan_hash).toBe('fallback-hash');
    });
  });

  // ===================================================================
  // applyWorkflowPreflightExecutionMode
  // ===================================================================
  describe('applyWorkflowPreflightExecutionMode', () => {
    it('calls refresh functions, resolves execution mode, and stores in template_meta', () => {
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: [],
        recommendations_frozen: false,
        plan_hash: 'hash-1',
        template_meta: {},
      };

      const observabilityResult = { mode: 'fast', aggregate: { completion_rate: 50 } };
      const budgetResult = { degraded: false, token_used: 100 };

      const refreshObs = vi.fn().mockReturnValue(observabilityResult);
      const refreshBudget = vi.fn().mockReturnValue(budgetResult);
      const resolveMode = vi.fn().mockReturnValue('fast');

      const result = applyWorkflowPreflightExecutionMode(
        plan,
        refreshObs,
        refreshBudget,
        resolveMode,
      );

      expect(refreshObs).toHaveBeenCalledOnce();
      expect(refreshBudget).toHaveBeenCalledOnce();
      expect(resolveMode).toHaveBeenCalledWith('fast');
      expect(result.observability).toBe(observabilityResult);
      expect(result.budgetGuardrail).toBe(budgetResult);
      expect(result.executionMode).toBe('fast');
      expect(plan.template_meta['execution_mode']).toBe('fast');
    });

    it('handles observability with missing mode key', () => {
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: [],
        recommendations_frozen: false,
        plan_hash: 'hash-1',
        template_meta: {},
      };

      const observabilityResult = {};  // no 'mode' key
      const refreshObs = vi.fn().mockReturnValue(observabilityResult);
      const refreshBudget = vi.fn().mockReturnValue({});
      const resolveMode = vi.fn().mockReturnValue('standard');

      applyWorkflowPreflightExecutionMode(plan, refreshObs, refreshBudget, resolveMode);

      // resolveMode receives '' because observability['mode'] is undefined
      expect(resolveMode).toHaveBeenCalledWith('');
      expect(plan.template_meta['execution_mode']).toBe('standard');
    });

    it('stores resolved execution mode in template_meta', () => {
      const plan: WorkflowPlanPreflightState = {
        runner_state: 'running',
        recommendations: [],
        recommendations_frozen: false,
        plan_hash: 'hash-1',
        template_meta: { existing_key: true },
      };

      const refreshObs = vi.fn().mockReturnValue({ mode: 'eco' });
      const refreshBudget = vi.fn().mockReturnValue({ degraded: true });
      const resolveMode = vi.fn().mockReturnValue('eco');

      applyWorkflowPreflightExecutionMode(plan, refreshObs, refreshBudget, resolveMode);

      // template_meta should gain execution_mode but keep existing keys
      expect(plan.template_meta['execution_mode']).toBe('eco');
      expect(plan.template_meta['existing_key']).toBe(true);
    });
  });
});
