import { describe, it, expect, vi } from 'vitest';

import {
  canonicalWorkflowStepStatus,
  remainingWorkflowSteps,
  applyWorkflowStepTransition,
  applyWorkflowRunnerTransition,
  applyWorkflowTriageTransition,
  executeWorkflowStepWithTransitions,
} from '../../../workflow/engine/runtime-state.js';
import type {
  MutableWorkflowStepState,
  MutableWorkflowPlanRuntimeState,
} from '../../../workflow/engine/runtime-state.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const legacyMap: Record<string, string> = {
  pending: 'planned',
  running: 'executing',
  complete: 'done',
};

const stepTransitions: Record<string, Set<string>> = {
  planned: new Set(['executing']),
  executing: new Set(['review', 'failed']),
  review: new Set(['test', 'failed']),
  test: new Set(['done', 'failed']),
};

const runnerTransitions: Record<string, Set<string>> = {
  created: new Set(['running']),
  running: new Set(['paused', 'stopped']),
  paused: new Set(['running', 'stopped']),
  stopped: new Set([]),
};

const triageTransitions: Record<string, Set<string>> = {
  none: new Set(['in_progress', 'escalated', 'resolved', 'rejected']),
  in_progress: new Set(['escalated', 'resolved', 'rejected']),
  escalated: new Set(['in_progress', 'resolved', 'rejected']),
  resolved: new Set([]),
  rejected: new Set([]),
};

const NOW = '2026-04-27T12:00:00.000Z';

function makeStep(overrides: Partial<MutableWorkflowStepState> = {}): MutableWorkflowStepState {
  return {
    name: 'Step 1',
    status: 'planned',
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

function makePlan(overrides: Partial<MutableWorkflowPlanRuntimeState> = {}): MutableWorkflowPlanRuntimeState {
  return {
    id: 'plan-1',
    status: 'created',
    runner_state: 'created',
    triage_state: 'none',
    fix_status: '',
    fix_owner: '',
    template_meta: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runtime-state', () => {
  // ------------------------------------------------------------------
  // canonicalWorkflowStepStatus
  // ------------------------------------------------------------------
  describe('canonicalWorkflowStepStatus', () => {
    it('maps legacy status through the provided map', () => {
      expect(canonicalWorkflowStepStatus('pending', legacyMap)).toBe('planned');
      expect(canonicalWorkflowStepStatus('running', legacyMap)).toBe('executing');
      expect(canonicalWorkflowStepStatus('complete', legacyMap)).toBe('done');
    });

    it('returns status unchanged when not in the legacy map', () => {
      expect(canonicalWorkflowStepStatus('planned', legacyMap)).toBe('planned');
      expect(canonicalWorkflowStepStatus('executing', legacyMap)).toBe('executing');
    });

    it('returns status unchanged for empty map', () => {
      expect(canonicalWorkflowStepStatus('done', {})).toBe('done');
    });
  });

  // ------------------------------------------------------------------
  // remainingWorkflowSteps
  // ------------------------------------------------------------------
  describe('remainingWorkflowSteps', () => {
    it('counts non-done steps', () => {
      const steps = [
        makeStep({ status: 'done' }),
        makeStep({ status: 'executing' }),
        makeStep({ status: 'planned' }),
      ];
      expect(remainingWorkflowSteps(steps, legacyMap)).toBe(2);
    });

    it('returns 0 when all steps are done', () => {
      const steps = [
        makeStep({ status: 'done' }),
        makeStep({ status: 'done' }),
      ];
      expect(remainingWorkflowSteps(steps, legacyMap)).toBe(0);
    });

    it('returns 0 for empty array', () => {
      expect(remainingWorkflowSteps([], legacyMap)).toBe(0);
    });

    it('resolves legacy statuses before counting', () => {
      const steps = [
        makeStep({ status: 'complete' }), // maps to 'done'
        makeStep({ status: 'pending' }),   // maps to 'planned', not done
      ];
      expect(remainingWorkflowSteps(steps, legacyMap)).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // applyWorkflowStepTransition
  // ------------------------------------------------------------------
  describe('applyWorkflowStepTransition', () => {
    it('performs a valid transition and returns current/target', () => {
      const step = makeStep({ status: 'planned' });
      const result = applyWorkflowStepTransition(step, 'executing', (s) => s, stepTransitions, NOW);

      expect(result).toEqual({ current: 'planned', target: 'executing' });
      expect(step.status).toBe('executing');
    });

    it('sets started_at when transitioning to executing', () => {
      const step = makeStep({ status: 'planned', started_at: null });
      applyWorkflowStepTransition(step, 'executing', (s) => s, stepTransitions, NOW);
      expect(step.started_at).toBe(NOW);
    });

    it('does not overwrite started_at if already set', () => {
      const step = makeStep({ status: 'planned', started_at: 'earlier' });
      applyWorkflowStepTransition(step, 'executing', (s) => s, stepTransitions, NOW);
      expect(step.started_at).toBe('earlier');
    });

    it('sets completed_at when transitioning to done', () => {
      const step = makeStep({ status: 'test' });
      stepTransitions['test'] = new Set(['done', 'failed']);
      applyWorkflowStepTransition(step, 'done', (s) => s, stepTransitions, NOW);
      expect(step.completed_at).toBe(NOW);
    });

    it('sets completed_at when transitioning to failed', () => {
      const step = makeStep({ status: 'executing' });
      applyWorkflowStepTransition(step, 'failed', (s) => s, stepTransitions, NOW);
      expect(step.completed_at).toBe(NOW);
    });

    it('does not set completed_at for intermediate transitions', () => {
      const step = makeStep({ status: 'planned' });
      applyWorkflowStepTransition(step, 'executing', (s) => s, stepTransitions, NOW);
      expect(step.completed_at).toBeNull();
    });

    it('throws for invalid transition', () => {
      const step = makeStep({ status: 'planned' });
      expect(() =>
        applyWorkflowStepTransition(step, 'done', (s) => s, stepTransitions, NOW),
      ).toThrow('Invalid step transition: planned -> done');
    });

    it('allows transition to same status (no-op)', () => {
      const step = makeStep({ status: 'planned' });
      const result = applyWorkflowStepTransition(step, 'planned', (s) => s, stepTransitions, NOW);
      expect(result).toEqual({ current: 'planned', target: 'planned' });
      expect(step.status).toBe('planned');
    });
  });

  // ------------------------------------------------------------------
  // applyWorkflowRunnerTransition
  // ------------------------------------------------------------------
  describe('applyWorkflowRunnerTransition', () => {
    it('performs valid transition and updates runner_state', () => {
      const plan = makePlan({ runner_state: 'created' });
      const result = applyWorkflowRunnerTransition(plan, 'running', runnerTransitions, 'lifecycle:start');

      expect(result).toEqual({ currentState: 'created', targetState: 'running' });
      expect(plan.runner_state).toBe('running');
    });

    it('sets template_meta runner_transition_reason', () => {
      const plan = makePlan({ runner_state: 'created' });
      applyWorkflowRunnerTransition(plan, 'running', runnerTransitions, 'lifecycle:start');
      expect(plan.template_meta['runner_transition_reason']).toBe('lifecycle:start');
    });

    it('sets plan status to running when transitioning to running from created', () => {
      const plan = makePlan({ status: 'created', runner_state: 'created' });
      applyWorkflowRunnerTransition(plan, 'running', runnerTransitions, 'reason');
      expect(plan.status).toBe('running');
    });

    it('does not overwrite plan status if it is not created when transitioning to running', () => {
      const plan = makePlan({ status: 'paused_plan', runner_state: 'paused' });
      applyWorkflowRunnerTransition(plan, 'running', runnerTransitions, 'reason');
      expect(plan.status).toBe('paused_plan');
    });

    it('sets plan status to failed when transitioning to stopped and plan is not completed/failed', () => {
      const plan = makePlan({ status: 'running', runner_state: 'running' });
      applyWorkflowRunnerTransition(plan, 'stopped', runnerTransitions, 'reason');
      expect(plan.status).toBe('failed');
    });

    it('does not overwrite plan status to failed if already completed', () => {
      const plan = makePlan({ status: 'completed', runner_state: 'running' });
      applyWorkflowRunnerTransition(plan, 'stopped', runnerTransitions, 'reason');
      expect(plan.status).toBe('completed');
    });

    it('does not overwrite plan status to failed if already failed', () => {
      const plan = makePlan({ status: 'failed', runner_state: 'running' });
      applyWorkflowRunnerTransition(plan, 'stopped', runnerTransitions, 'reason');
      expect(plan.status).toBe('failed');
    });

    it('throws for invalid runner transition', () => {
      const plan = makePlan({ runner_state: 'stopped' });
      expect(() =>
        applyWorkflowRunnerTransition(plan, 'running', runnerTransitions, 'reason'),
      ).toThrow('Invalid runner transition: stopped -> running');
    });
  });

  // ------------------------------------------------------------------
  // applyWorkflowTriageTransition
  // ------------------------------------------------------------------
  describe('applyWorkflowTriageTransition', () => {
    it('performs valid transition and updates triage_state', () => {
      const plan = makePlan({ triage_state: 'none' });
      const result = applyWorkflowTriageTransition(plan, 'in_progress', triageTransitions);
      expect(result).toEqual({ changed: true });
      expect(plan.triage_state).toBe('in_progress');
    });

    it('returns changed false for same-state transition', () => {
      const plan = makePlan({ triage_state: 'none' });
      const result = applyWorkflowTriageTransition(plan, 'none', triageTransitions);
      expect(result).toEqual({ changed: false });
      expect(plan.triage_state).toBe('none');
    });

    it('sets fix_status to in_progress for in_progress state', () => {
      const plan = makePlan({ triage_state: 'none', fix_status: '', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'in_progress', triageTransitions);
      expect(plan.fix_status).toBe('in_progress');
    });

    it('sets fix_status to in_progress for escalated state', () => {
      const plan = makePlan({ triage_state: 'none', fix_status: '', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'escalated', triageTransitions);
      expect(plan.fix_status).toBe('in_progress');
    });

    it('sets fix_owner to plan id when transitioning and fix_owner is empty (in_progress)', () => {
      const plan = makePlan({ triage_state: 'none', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'in_progress', triageTransitions);
      expect(plan.fix_owner).toBe('plan-1');
    });

    it('sets fix_status to fixed for resolved state', () => {
      const plan = makePlan({ triage_state: 'in_progress', fix_status: 'in_progress', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'resolved', triageTransitions);
      expect(plan.fix_status).toBe('fixed');
    });

    it('sets fix_owner to plan id for resolved state when fix_owner is empty', () => {
      const plan = makePlan({ triage_state: 'in_progress', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'resolved', triageTransitions);
      expect(plan.fix_owner).toBe('plan-1');
    });

    it('sets fix_status to wont_fix for rejected state', () => {
      const plan = makePlan({ triage_state: 'in_progress', fix_status: 'in_progress', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'rejected', triageTransitions);
      expect(plan.fix_status).toBe('wont_fix');
    });

    it('sets fix_owner to plan id for rejected state when fix_owner is empty', () => {
      const plan = makePlan({ triage_state: 'in_progress', fix_owner: '' });
      applyWorkflowTriageTransition(plan, 'rejected', triageTransitions);
      expect(plan.fix_owner).toBe('plan-1');
    });

    it('does not overwrite fix_owner if already set', () => {
      const plan = makePlan({ triage_state: 'none', fix_owner: 'existing-owner' });
      applyWorkflowTriageTransition(plan, 'in_progress', triageTransitions);
      expect(plan.fix_owner).toBe('existing-owner');
    });

    it('throws for invalid triage transition', () => {
      const plan = makePlan({ triage_state: 'resolved' });
      expect(() =>
        applyWorkflowTriageTransition(plan, 'in_progress', triageTransitions),
      ).toThrow('Invalid triage transition: resolved -> in_progress');
    });
  });

  // ------------------------------------------------------------------
  // executeWorkflowStepWithTransitions
  // ------------------------------------------------------------------
  describe('executeWorkflowStepWithTransitions', () => {
    it('success path: transitions through executing, review, test, done then calls completeExecutionStep', async () => {
      const plan = { id: 'plan-1' };
      const step = { id: 'step-1' };
      const gate = { decision: 'go' };
      const executionResult = { data: 'output' };
      const runtime = {
        observability: {},
        budgetGuardrail: {},
        executionMode: 'standard',
      };

      const transitionStepState = vi.fn();
      const completeExecutionStep = vi.fn().mockReturnValue({ status: 'completed' });

      const result = await executeWorkflowStepWithTransitions({
        plan,
        step,
        gate,
        executeStep: vi.fn().mockResolvedValue(executionResult),
        transitionStepState,
        completeExecutionStep,
        failExecutionStep: vi.fn(),
        runtime,
      });

      expect(transitionStepState).toHaveBeenCalledTimes(4);
      expect(transitionStepState).toHaveBeenNthCalledWith(1, plan, step, 'executing', 'execution_started');
      expect(transitionStepState).toHaveBeenNthCalledWith(2, plan, step, 'review', 'execution_review');
      expect(transitionStepState).toHaveBeenNthCalledWith(3, plan, step, 'test', 'execution_test');
      expect(transitionStepState).toHaveBeenNthCalledWith(4, plan, step, 'done', 'execution_completed');

      expect(completeExecutionStep).toHaveBeenCalledWith(plan, step, gate, executionResult);
      expect(result).toEqual({ status: 'completed' });
    });

    it('failure path: calls failExecutionStep when executeStep throws', async () => {
      const plan = { id: 'plan-1' };
      const step = { id: 'step-1' };
      const gate = { decision: 'go' };
      const error = new Error('step exploded');
      const runtime = {
        observability: { log: true },
        budgetGuardrail: { limit: 100 },
        executionMode: 'standard',
      };

      const transitionStepState = vi.fn();
      const failExecutionStep = vi.fn().mockReturnValue({ error: 'step exploded' });

      const result = await executeWorkflowStepWithTransitions({
        plan,
        step,
        gate,
        executeStep: vi.fn().mockRejectedValue(error),
        transitionStepState,
        completeExecutionStep: vi.fn(),
        failExecutionStep,
        runtime,
      });

      // Only the first transition (executing) happens before failure
      expect(transitionStepState).toHaveBeenCalledTimes(1);
      expect(transitionStepState).toHaveBeenCalledWith(plan, step, 'executing', 'execution_started');

      expect(failExecutionStep).toHaveBeenCalledWith(plan, step, error, runtime);
      expect(result).toEqual({ error: 'step exploded' });
    });
  });
});
