import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RevisionDecision,
  RevisionLoop,
  runRevisionLoop,
  type ISessionManager,
} from '../../workflow/revision-loop';

describe('workflow/revision-loop additional coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('covers normalization and runtime degrade guard branches', () => {
    expect(RevisionLoop.normalizeQualityLevel('weird')).toBe('high');
    expect(RevisionLoop.nextQualityLevel('fluent')).toBe('fluent');

    const manualLoop = new RevisionLoop({
      quality_mode: 'manual',
      quality_level: 'medium',
    });
    expect(manualLoop.handleRuntimeEvent('timeout', 'critic')).toBe(false);
    expect(manualLoop.state.degrade_steps).toHaveLength(0);

    const timeoutDisabledLoop = new RevisionLoop({
      quality_level: 'ultra',
      degrade_on_timeout: false,
    });
    expect(timeoutDisabledLoop.handleRuntimeEvent('timeout', 'critic')).toBe(false);

    const errorDisabledLoop = new RevisionLoop({
      quality_level: 'ultra',
      degrade_on_error: false,
    });
    expect(errorDisabledLoop.handleRuntimeEvent('error', 'writer', 'OOMError')).toBe(false);
  });

  it('covers feedback artifact fallbacks and decision edges', () => {
    const approvalLoop = new RevisionLoop({
      pass_score: 80,
      min_c_score: 7,
      max_revisions: 3,
    });

    const approvalDecision = approvalLoop.updateFromCritic({
      decision: 'APPROVED',
      total_score: 95,
      actionable_feedback: '需要继续补强',
      revision_instructions: ['invalid-item'],
      lock_analysis: {
        C: {
          score: 6,
        },
      },
    });

    expect(approvalDecision).toBe(RevisionDecision.REVISE);
    expect(approvalLoop.state.feedback_artifacts).toMatchObject([
      {
        scope: 'chapter',
        anchor: 'chapter-1',
        severity: 'medium',
        issue: '需要继续补强',
        recommendation: '需要继续补强',
      },
    ]);

    const lowSeverityLoop = new RevisionLoop({ max_revisions: 3 });
    lowSeverityLoop.updateFromCritic({
      decision: 'REVISE',
      total_score: 60,
      actionable_feedback: '',
      revision_instructions: [
        {
          target: 'chapter-2',
          issue: '',
          suggestion: '',
          priority: 'minor',
        },
      ],
    });
    expect(lowSeverityLoop.state.feedback_artifacts).toMatchObject([
      {
        scope: 'chapter',
        anchor: 'chapter-2',
        severity: 'low',
        issue: 'unspecified issue',
        recommendation: 'revise content',
      },
    ]);

    const rewriteLoop = new RevisionLoop({ max_revisions: 1 });
    expect(
      rewriteLoop.updateFromCritic({
        decision: 'REWRITE',
        total_score: 40,
        actionable_feedback: '需要整体重写',
      }),
    ).toBe(RevisionDecision.HUMAN_REVIEW);

    const humanReviewLoop = new RevisionLoop();
    expect(
      humanReviewLoop.updateFromCritic({
        decision: 'HUMAN_REVIEW',
        total_score: 12,
      }),
    ).toBe(RevisionDecision.HUMAN_REVIEW);
  });

  it('degrades after critic timeout, injects session id, and finishes on retry', async () => {
    vi.useFakeTimers();

    const checkpointStore: Record<string, unknown> = {};
    const sessionManager: ISessionManager = {
      activePath: '/tmp/active',
      archivedPath: '/tmp/archived',
      init: vi.fn(),
      write: vi.fn(),
      resolvePath: vi.fn(() => '/tmp/path'),
    };
    const writerFn = vi.fn(async (draft: string) => `${draft}\nwriter`);
    const criticFn = vi
      .fn()
      .mockImplementationOnce(async () => await new Promise<Record<string, unknown>>(() => undefined))
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 90,
        actionable_feedback: '可以通过',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      });

    const resultPromise = runRevisionLoop({
      draft: '初稿',
      sceneCard: { title: 'scene-1' },
      writerFn,
      criticFn,
      verbose: true,
      checkpointStore,
      sessionId: 'session-auto',
      sessionManager,
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
      total_revisions: 1,
      degrade_reason: 'timeout:critic',
      effective_quality_level: 'high',
    });
    expect(writerFn).not.toHaveBeenCalled();
    expect(checkpointStore['revision-round-1']).toMatchObject({
      session_id: 'session-auto',
    });
  });

  it('returns human review when writer timeout cannot degrade further', async () => {
    vi.useFakeTimers();

    const criticFn = vi.fn().mockResolvedValue({
      decision: 'REVISE',
      total_score: 61,
      actionable_feedback: '继续修改',
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
      draft: '初稿',
      sceneCard: { title: 'scene-2' },
      writerFn,
      criticFn,
      verbose: false,
      config: {
        quality_mode: 'auto',
        quality_level: 'fluent',
        quality_phase_timeout_seconds: 1,
        max_revisions: 3,
      },
    });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result).toMatchObject({
      final_decision: RevisionDecision.HUMAN_REVIEW,
      total_revisions: 1,
      degrade_reason: 'timeout:writer',
      effective_quality_level: 'fluent',
    });
  });

  it('degrades on writer error and retries until approval', async () => {
    const criticFn = vi
      .fn()
      .mockResolvedValueOnce({
        decision: 'REVISE',
        total_score: 55,
        actionable_feedback: '继续收紧冲突',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      })
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 92,
        actionable_feedback: '通过',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      });
    const writerFn = vi.fn().mockRejectedValueOnce(new TypeError('writer failed'));

    const result = await runRevisionLoop({
      draft: '初稿',
      sceneCard: { title: 'scene-3' },
      writerFn,
      criticFn,
      verbose: false,
      config: {
        quality_mode: 'auto',
        quality_level: 'ultra',
        quality_phase_timeout_seconds: 0,
        pass_score: 90,
        min_c_score: 8,
        max_revisions: 3,
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

  it('returns human review when critic error cannot degrade further', async () => {
    const criticFn = vi.fn().mockRejectedValue(new TypeError('critic failed'));
    const writerFn = vi.fn();

    const result = await runRevisionLoop({
      draft: '初稿',
      sceneCard: { title: 'scene-4' },
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
      total_revisions: 0,
      degrade_reason: 'error:critic:TypeError',
      effective_quality_level: 'fluent',
    });
    expect(writerFn).not.toHaveBeenCalled();
  });
});
