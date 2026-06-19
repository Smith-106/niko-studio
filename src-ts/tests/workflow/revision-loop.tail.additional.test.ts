import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RevisionDecision,
  RevisionLoop,
  runRevisionLoop,
} from '../../workflow/revision-loop';

describe('workflow/revision-loop tail additional coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reset restores config-driven quality state after runtime degradation', () => {
    const checkpointStore: Record<string, unknown> = {};
    const loop = new RevisionLoop(
      {
        quality_mode: 'auto',
        quality_level: 'medium',
      },
      checkpointStore,
    );

    expect(loop.handleRuntimeEvent('error', 'critic', 'TypeError')).toBe(true);

    loop.updateFromCritic({
      decision: 'REVISE',
      total_score: 58,
      actionable_feedback: 'tighten the conflict',
      session_id: 'reset-case',
    });

    expect(loop.state).toMatchObject({
      revision_count: 1,
      effective_quality_level: 'fluent',
      degrade_reason: 'error:critic:TypeError',
    });

    loop.reset();

    expect(loop.state).toMatchObject({
      revision_count: 0,
      current_score: 0,
      previous_score: 0,
      decision: RevisionDecision.REVISE,
      quality_mode: 'auto',
      requested_quality_level: 'medium',
      effective_quality_level: 'medium',
      degrade_reason: '',
    });
    expect(loop.state.history).toEqual([]);
    expect(loop.state.checkpoint_trace).toEqual([]);
    expect(Object.keys(checkpointStore)).toHaveLength(1);
  });

  it('degrades on writer timeout and retries when verbose logging is enabled', async () => {
    vi.useFakeTimers();

    const criticFn = vi
      .fn()
      .mockResolvedValueOnce({
        decision: 'REVISE',
        total_score: 64,
        actionable_feedback: 'raise the tension',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      })
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 92,
        actionable_feedback: 'ship it',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      });

    const writerFn = vi
      .fn()
      .mockImplementationOnce(async () => await new Promise<string>(() => undefined));

    const resultPromise = runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'writer-timeout-retry' },
      writerFn,
      criticFn,
      verbose: true,
      config: {
        quality_mode: 'auto',
        quality_level: 'ultra',
        quality_phase_timeout_seconds: 1,
        pass_score: 90,
        min_c_score: 8,
      },
    });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result).toMatchObject({
      final_decision: RevisionDecision.APPROVED,
      total_revisions: 2,
      degrade_reason: 'timeout:writer',
      effective_quality_level: 'high',
    });
    expect(writerFn).toHaveBeenCalledTimes(1);
    expect(criticFn).toHaveBeenCalledTimes(2);
  });

  it('defaults missing scores, infers scene scope, and keeps rewrite decisions before the max limit', () => {
    const loop = new RevisionLoop({ max_revisions: 3 });

    const decision = loop.updateFromCritic({
      decision: 'REWRITE',
      actionable_feedback: 'reshape scene pacing',
      revision_instructions: [
        {
          target: 'scene-7',
          issue: 'pacing drift',
          suggestion: 'rewrite the confrontation',
          priority: 'urgent',
        },
      ],
    });

    expect(decision).toBe(RevisionDecision.REWRITE);
    expect(loop.state.current_score).toBe(0);
    expect(loop.state.feedback_artifacts).toMatchObject([
      {
        scope: 'scene',
        severity: 'medium',
        issue: 'pacing drift',
      },
    ]);
  });
});
