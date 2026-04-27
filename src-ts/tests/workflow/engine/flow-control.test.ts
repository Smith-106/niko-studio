import { describe, it, expect, vi } from 'vitest';

import {
  resolveExecutableWorkflowStep,
  findIncompleteWorkflowDependency,
  resolveLifecycleTargetState,
  normalizeWorkflowLifecycleAction,
  shouldCreateWorkflowPauseCheckpoint,
  shouldPersistWorkflowHandoff,
  areAllWorkflowStepsDone,
  executeWorkflowLifecycleTransition,
} from '../../../workflow/engine/flow-control.js';
import type { WorkflowStepLike } from '../../../workflow/engine/flow-control.js';

const identity = (s: string): string => s;

function makeStep(overrides: Partial<WorkflowStepLike> = {}): WorkflowStepLike {
  return {
    id: 'step-1',
    name: 'Step 1',
    status: 'planned',
    dependencies: [],
    ...overrides,
  };
}

describe('flow-control', () => {
  // ------------------------------------------------------------------
  // resolveExecutableWorkflowStep
  // ------------------------------------------------------------------
  describe('resolveExecutableWorkflowStep', () => {
    it('finds a matching step by id and validates status is planned', () => {
      const steps = [
        makeStep({ id: 's1', status: 'done' }),
        makeStep({ id: 's2', status: 'planned' }),
      ];
      const result = resolveExecutableWorkflowStep(steps, 's2', identity);
      expect(result.step).toBe(steps[1]);
      expect(result.error).toBeUndefined();
      expect(result.allCompleted).toBeUndefined();
    });

    it('returns null with error when step id is not found', () => {
      const steps = [makeStep({ id: 's1' })];
      const result = resolveExecutableWorkflowStep(steps, 'missing', identity);
      expect(result.step).toBeNull();
      expect(result.error).toBe("Step 'missing' not found");
    });

    it('returns null with error when step id found but status is not planned', () => {
      const steps = [makeStep({ id: 's1', status: 'executing' })];
      const result = resolveExecutableWorkflowStep(steps, 's1', identity);
      expect(result.step).toBeNull();
      expect(result.error).toBe("Step 's1' is not planned (current status: executing)");
    });

    it('returns first planned step when stepId is undefined', () => {
      const steps = [
        makeStep({ id: 's1', status: 'done' }),
        makeStep({ id: 's2', status: 'planned' }),
        makeStep({ id: 's3', status: 'planned' }),
      ];
      const result = resolveExecutableWorkflowStep(steps, undefined, identity);
      expect(result.step).toBe(steps[1]);
    });

    it('returns allCompleted true when no planned steps remain', () => {
      const steps = [
        makeStep({ id: 's1', status: 'done' }),
        makeStep({ id: 's2', status: 'failed' }),
      ];
      const result = resolveExecutableWorkflowStep(steps, undefined, identity);
      expect(result.step).toBeNull();
      expect(result.allCompleted).toBe(true);
    });

    it('uses canonicalizeStatus to normalize statuses before comparing', () => {
      const steps = [makeStep({ id: 's1', status: 'PENDING' })];
      const toLower = (s: string) => s.toLowerCase();
      const result = resolveExecutableWorkflowStep(steps, undefined, toLower);
      // 'PENDING' lowered is 'pending', not 'planned', so no match
      expect(result.step).toBeNull();
      expect(result.allCompleted).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // findIncompleteWorkflowDependency
  // ------------------------------------------------------------------
  describe('findIncompleteWorkflowDependency', () => {
    it('returns null when all dependencies are done', () => {
      const steps = [
        makeStep({ id: 'a', status: 'done' }),
        makeStep({ id: 'b', status: 'done' }),
      ];
      const step = makeStep({ id: 'c', dependencies: ['a', 'b'] });
      expect(findIncompleteWorkflowDependency(steps, step, identity)).toBeNull();
    });

    it('returns the id of the first incomplete dependency', () => {
      const steps = [
        makeStep({ id: 'a', status: 'done' }),
        makeStep({ id: 'b', status: 'executing' }),
        makeStep({ id: 'c', status: 'planned' }),
      ];
      const step = makeStep({ id: 'd', dependencies: ['a', 'b', 'c'] });
      expect(findIncompleteWorkflowDependency(steps, step, identity)).toBe('b');
    });

    it('returns null when dependency id is not in steps array (missing dep is ignored)', () => {
      const steps: WorkflowStepLike[] = [];
      const step = makeStep({ id: 'x', dependencies: ['ghost'] });
      // dependency not found, so the loop body never matches, returns null
      expect(findIncompleteWorkflowDependency(steps, step, identity)).toBeNull();
    });

    it('returns null for step with empty dependencies', () => {
      const step = makeStep({ id: 's', dependencies: [] });
      expect(findIncompleteWorkflowDependency([], step, identity)).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // resolveLifecycleTargetState
  // ------------------------------------------------------------------
  describe('resolveLifecycleTargetState', () => {
    it('maps start to running', () => {
      expect(resolveLifecycleTargetState('start')).toBe('running');
    });

    it('maps pause to paused', () => {
      expect(resolveLifecycleTargetState('pause')).toBe('paused');
    });

    it('maps resume to running', () => {
      expect(resolveLifecycleTargetState('resume')).toBe('running');
    });

    it('maps stop to stopped', () => {
      expect(resolveLifecycleTargetState('stop')).toBe('stopped');
    });

    it('returns null for unknown action', () => {
      expect(resolveLifecycleTargetState('restart')).toBeNull();
      expect(resolveLifecycleTargetState('')).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // normalizeWorkflowLifecycleAction
  // ------------------------------------------------------------------
  describe('normalizeWorkflowLifecycleAction', () => {
    it('trims whitespace and lowercases', () => {
      expect(normalizeWorkflowLifecycleAction('  PAUSE ')).toBe('pause');
    });

    it('handles null/undefined by returning empty string', () => {
      // The function uses (action ?? '').trim() so falsy inputs yield ''
      expect(normalizeWorkflowLifecycleAction(null as unknown as string)).toBe('');
      expect(normalizeWorkflowLifecycleAction(undefined as unknown as string)).toBe('');
    });
  });

  // ------------------------------------------------------------------
  // shouldCreateWorkflowPauseCheckpoint
  // ------------------------------------------------------------------
  describe('shouldCreateWorkflowPauseCheckpoint', () => {
    it('returns true only for pause', () => {
      expect(shouldCreateWorkflowPauseCheckpoint('pause')).toBe(true);
    });

    it('returns false for start', () => {
      expect(shouldCreateWorkflowPauseCheckpoint('start')).toBe(false);
    });

    it('returns false for stop', () => {
      expect(shouldCreateWorkflowPauseCheckpoint('stop')).toBe(false);
    });

    it('returns false for resume', () => {
      expect(shouldCreateWorkflowPauseCheckpoint('resume')).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // shouldPersistWorkflowHandoff
  // ------------------------------------------------------------------
  describe('shouldPersistWorkflowHandoff', () => {
    it('returns true for pause', () => {
      expect(shouldPersistWorkflowHandoff('pause')).toBe(true);
    });

    it('returns true for stop', () => {
      expect(shouldPersistWorkflowHandoff('stop')).toBe(true);
    });

    it('returns false for start', () => {
      expect(shouldPersistWorkflowHandoff('start')).toBe(false);
    });

    it('returns false for resume', () => {
      expect(shouldPersistWorkflowHandoff('resume')).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // areAllWorkflowStepsDone
  // ------------------------------------------------------------------
  describe('areAllWorkflowStepsDone', () => {
    it('returns true when all steps have done status', () => {
      const steps = [
        { status: 'done' },
        { status: 'done' },
      ];
      expect(areAllWorkflowStepsDone(steps, identity)).toBe(true);
    });

    it('returns false when at least one step is not done', () => {
      const steps = [
        { status: 'done' },
        { status: 'executing' },
      ];
      expect(areAllWorkflowStepsDone(steps, identity)).toBe(false);
    });

    it('returns true for empty steps array', () => {
      expect(areAllWorkflowStepsDone([], identity)).toBe(true);
    });

    it('returns false when all steps are planned', () => {
      const steps = [
        { status: 'planned' },
        { status: 'planned' },
      ];
      expect(areAllWorkflowStepsDone(steps, identity)).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // executeWorkflowLifecycleTransition
  // ------------------------------------------------------------------
  describe('executeWorkflowLifecycleTransition', () => {
    function makePlan() {
      return { template_meta: { session_status: 'active' } };
    }

    function makeInput(overrides: Record<string, unknown> = {}) {
      const plan = makePlan();
      return {
        plan,
        normalizedAction: 'pause',
        createPauseCheckpoint: vi.fn<[], Promise<string | undefined>>().mockResolvedValue('ckpt-1'),
        setRunnerState: vi.fn().mockReturnValue({ status: 'paused' }),
        setTriageState: vi.fn(),
        persistHandoff: vi.fn(),
        buildActionResponse: vi.fn().mockReturnValue({
          plan_id: 'p1',
          action: 'pause',
          runner_state: 'paused',
        }),
        ...overrides,
      };
    }

    it('returns error for unsupported lifecycle action', async () => {
      const input = makeInput({ normalizedAction: 'restart' });
      const result = await executeWorkflowLifecycleTransition(input);
      expect(result).toEqual({ error: 'Unsupported lifecycle action: restart' });
    });

    it('creates checkpoint and persists handoff for pause action', async () => {
      const input = makeInput({ normalizedAction: 'pause' });
      const result = await executeWorkflowLifecycleTransition(input);

      expect(input.createPauseCheckpoint).toHaveBeenCalledWith(input.plan);
      expect(input.setRunnerState).toHaveBeenCalledWith(
        input.plan,
        'paused',
        'ckpt-1',
        'lifecycle:pause',
      );
      expect(input.persistHandoff).toHaveBeenCalledWith(input.plan, 'pause');
      expect(result).toEqual({
        plan_id: 'p1',
        action: 'pause',
        runner_state: 'paused',
      });
    });

    it('does not create checkpoint but does persist handoff for stop action', async () => {
      const input = makeInput({ normalizedAction: 'stop' });
      await executeWorkflowLifecycleTransition(input);

      expect(input.createPauseCheckpoint).not.toHaveBeenCalled();
      expect(input.setRunnerState).toHaveBeenCalledWith(
        input.plan,
        'stopped',
        undefined,
        'lifecycle:stop',
      );
      expect(input.persistHandoff).toHaveBeenCalledWith(input.plan, 'stop');
    });

    it('does not create checkpoint or persist handoff for start action', async () => {
      const input = makeInput({ normalizedAction: 'start' });
      await executeWorkflowLifecycleTransition(input);

      expect(input.createPauseCheckpoint).not.toHaveBeenCalled();
      expect(input.setRunnerState).toHaveBeenCalledWith(
        input.plan,
        'running',
        undefined,
        'lifecycle:start',
      );
      expect(input.persistHandoff).not.toHaveBeenCalled();
    });

    it('does not create checkpoint or persist handoff for resume action', async () => {
      const input = makeInput({ normalizedAction: 'resume' });
      await executeWorkflowLifecycleTransition(input);

      expect(input.createPauseCheckpoint).not.toHaveBeenCalled();
      expect(input.setRunnerState).toHaveBeenCalledWith(
        input.plan,
        'running',
        undefined,
        'lifecycle:resume',
      );
      expect(input.persistHandoff).not.toHaveBeenCalled();
    });

    it('catches error from setRunnerState and returns error result', async () => {
      const input = makeInput({
        normalizedAction: 'start',
        setRunnerState: vi.fn().mockImplementation(() => {
          throw new Error('state machine failure');
        }),
      });
      const result = await executeWorkflowLifecycleTransition(input);
      expect(result).toEqual({ error: 'Error: state machine failure' });
    });

    it('calls setTriageState when triageState is provided', async () => {
      const input = makeInput({
        normalizedAction: 'pause',
        triageState: 'escalated',
      });
      await executeWorkflowLifecycleTransition(input);

      expect(input.setTriageState).toHaveBeenCalledWith(
        input.plan,
        'escalated',
        'lifecycle:pause',
      );
    });

    it('does not call setTriageState when triageState is undefined', async () => {
      const input = makeInput({ normalizedAction: 'pause' });
      await executeWorkflowLifecycleTransition(input);
      expect(input.setTriageState).not.toHaveBeenCalled();
    });
  });
});
