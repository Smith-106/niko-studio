import { describe, expect, it, vi } from 'vitest';

import { runWorkflowLifecycleTransition } from '../../../workflow/engine/lifecycle.js';

describe('workflow/engine/lifecycle', () => {
  it('normalizes lifecycle actions and routes pause transitions through the wrapper callbacks', async () => {
    const createPauseCheckpoint = vi.fn().mockResolvedValue('checkpoint-1');
    const setRunnerState = vi.fn().mockReturnValue({ status: 'paused' });
    const setTriageState = vi.fn();
    const persistHandoffPackage = vi.fn();
    const buildLifecycleActionResponse = vi.fn().mockReturnValue({
      plan_id: 'plan-1',
      action: 'pause',
      runner_state: 'paused',
      session_status: 'paused',
    });

    const result = await runWorkflowLifecycleTransition({
      plan: {
        id: 'plan-1',
        template_meta: {
          session_status: 'template-active',
        },
      },
      action: '  PAUSE  ',
      triageState: '  Escalated  ',
      createPauseCheckpoint,
      setRunnerState,
      setTriageState,
      persistHandoffPackage,
      buildLifecycleActionResponse,
    });

    expect(createPauseCheckpoint).toHaveBeenCalledWith('loop-pause:plan-1', 'plan-1');
    expect(setRunnerState).toHaveBeenCalledWith(
      'paused',
      'checkpoint-1',
      'lifecycle:pause',
    );
    expect(setTriageState).toHaveBeenCalledWith('escalated', 'lifecycle:pause');
    expect(persistHandoffPackage).toHaveBeenCalledWith('pause');
    expect(buildLifecycleActionResponse).toHaveBeenCalledWith(
      'pause',
      'checkpoint-1',
      'paused',
    );
    expect(result).toEqual({
      plan_id: 'plan-1',
      action: 'pause',
      runner_state: 'paused',
      session_status: 'paused',
    });
  });

  it('falls back to template session status when the runner transition returns none', async () => {
    const result = await runWorkflowLifecycleTransition({
      plan: {
        id: 'plan-2',
        template_meta: {
          session_status: 'template-paused',
        },
      },
      action: 'resume',
      createPauseCheckpoint: vi.fn(),
      setRunnerState: vi.fn().mockReturnValue({}),
      setTriageState: vi.fn(),
      persistHandoffPackage: vi.fn(),
      buildLifecycleActionResponse: vi.fn().mockReturnValue({
        plan_id: 'plan-2',
        action: 'resume',
        runner_state: 'running',
        session_status: 'template-paused',
      }),
    });

    expect(result).toEqual({
      plan_id: 'plan-2',
      action: 'resume',
      runner_state: 'running',
      session_status: 'template-paused',
    });
  });

  it('returns an error result for unsupported actions', async () => {
    const result = await runWorkflowLifecycleTransition({
      plan: {
        id: 'plan-3',
        template_meta: {},
      },
      action: 'unknown',
      createPauseCheckpoint: vi.fn(),
      setRunnerState: vi.fn(),
      setTriageState: vi.fn(),
      persistHandoffPackage: vi.fn(),
      buildLifecycleActionResponse: vi.fn(),
    });

    expect(result).toEqual({
      error: 'Unsupported lifecycle action: unknown',
    });
  });
});
