import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RevisionDecision,
  runRevisionLoop,
} from '../../workflow/revision-loop';

describe('workflow/revision-loop more additional coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns human review when critic timeout cannot degrade further', async () => {
    vi.useFakeTimers();

    const criticFn = vi
      .fn()
      .mockImplementation(async () => await new Promise<Record<string, unknown>>(() => undefined));

    const resultPromise = runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'scene-timeout' },
      writerFn: vi.fn(),
      criticFn,
      verbose: false,
      config: {
        quality_mode: 'auto',
        quality_level: 'fluent',
        quality_phase_timeout_seconds: 1,
      },
    });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result).toMatchObject({
      final_decision: RevisionDecision.HUMAN_REVIEW,
      total_revisions: 0,
      degrade_reason: 'timeout:critic',
      effective_quality_level: 'fluent',
    });
  });

  it('degrades on critic error, logs the downgrade path, and retries to approval', async () => {
    const criticFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('critic crashed'))
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 91,
        actionable_feedback: 'pass',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      });

    const writerFn = vi.fn();

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'scene-error' },
      writerFn,
      criticFn,
      verbose: true,
      config: {
        quality_mode: 'auto',
        quality_level: 'ultra',
        quality_phase_timeout_seconds: 0,
        pass_score: 90,
        min_c_score: 8,
      },
    });

    expect(result).toMatchObject({
      final_decision: RevisionDecision.APPROVED,
      total_revisions: 1,
      degrade_reason: 'error:critic:TypeError',
      effective_quality_level: 'high',
    });
    expect(criticFn).toHaveBeenCalledTimes(2);
    expect(writerFn).not.toHaveBeenCalled();
  });

  it('degrades on writer error when verbose logging is enabled and retries to approval', async () => {
    const criticFn = vi
      .fn()
      .mockResolvedValueOnce({
        decision: 'REVISE',
        total_score: 62,
        actionable_feedback: 'tighten conflict',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      })
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 93,
        actionable_feedback: 'pass',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      });

    const writerFn = vi.fn().mockRejectedValueOnce(new TypeError('writer crashed'));

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'scene-writer-error' },
      writerFn,
      criticFn,
      verbose: true,
      config: {
        quality_mode: 'auto',
        quality_level: 'ultra',
        quality_phase_timeout_seconds: 0,
        pass_score: 90,
        min_c_score: 8,
      },
    });

    expect(result).toMatchObject({
      final_decision: RevisionDecision.APPROVED,
      total_revisions: 2,
      degrade_reason: 'error:writer:TypeError',
      effective_quality_level: 'high',
    });
    expect(writerFn).toHaveBeenCalledTimes(1);
  });

  it('returns human review when writer error cannot degrade further', async () => {
    const criticFn = vi.fn().mockResolvedValue({
      decision: 'REVISE',
      total_score: 61,
      actionable_feedback: 'needs more work',
      lock_analysis: {
        C: {
          score: 8,
        },
      },
    });

    const writerFn = vi.fn().mockRejectedValue(new TypeError('writer blocked'));

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'scene-writer-human-review' },
      writerFn,
      criticFn,
      verbose: false,
      config: {
        quality_mode: 'auto',
        quality_level: 'fluent',
        quality_phase_timeout_seconds: 0,
      },
    });

    expect(result).toMatchObject({
      final_decision: RevisionDecision.HUMAN_REVIEW,
      total_revisions: 1,
      degrade_reason: 'error:writer:TypeError',
      effective_quality_level: 'fluent',
    });
  });
});
