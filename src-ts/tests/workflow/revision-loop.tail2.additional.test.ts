import { describe, expect, it, vi } from 'vitest';

import {
  RevisionDecision,
  RevisionLoop,
  runRevisionLoop,
} from '../../workflow/revision-loop';

describe('workflow/revision-loop tail2 additional coverage', () => {
  it('covers shouldContinue guards and checkpoint helper defaults', () => {
    const loop = new RevisionLoop({ max_revisions: 2 });

    loop.state.decision = RevisionDecision.REVISE;
    loop.state.revision_count = 2;
    expect(loop.shouldContinue()).toBe(false);

    loop.state.revision_count = 0;
    loop.state.stagnant_count = 2;
    expect(loop.shouldContinue()).toBe(false);

    expect((loop as any)._persistCheckpointArtifact({})).toBe('');
    expect(loop.state.last_checkpoint_id).toBe('');

    expect((loop as any)._persistCheckpointArtifact({ checkpoint_id: 'checkpoint-only' })).toBe(
      'checkpoint-only',
    );
    expect(loop.state.checkpoint_trace).toMatchObject([
      {
        checkpoint_id: 'checkpoint-only',
        step_id: '',
        stage: 'critic',
        round_identifier: '',
      },
    ]);
  });

  it('covers helper fallbacks and revise max-revision decision branches', () => {
    const loop = new RevisionLoop();

    expect((loop as any)._normalizeSeverity(undefined)).toBe('medium');
    expect((loop as any)._inferScope(undefined)).toBe('chapter');

    loop.updateFromCritic({
      decision: 'REVISE',
      total_score: 55,
      revision_instructions: [{}],
    });
    expect(loop.state.feedback_artifacts).toMatchObject([
      {
        anchor: 'chapter-1',
        scope: 'chapter',
        severity: 'medium',
        issue: 'unspecified issue',
        recommendation: 'revise content',
      },
    ]);

    const cScoreFallbackLoop = new RevisionLoop({
      pass_score: 80,
      min_c_score: 7,
    });
    expect(
      cScoreFallbackLoop.updateFromCritic({
        decision: 'APPROVED',
        total_score: 88,
        lock_analysis: { C: {} },
      }),
    ).toBe(RevisionDecision.APPROVED);

    const maxReviseLoop = new RevisionLoop({ max_revisions: 1 });
    expect(
      maxReviseLoop.updateFromCritic({
        total_score: 30,
      }),
    ).toBe(RevisionDecision.HUMAN_REVIEW);
  });

  it('covers the writer timeout window success path', async () => {
    const criticFn = vi
      .fn()
      .mockResolvedValueOnce({
        decision: 'REVISE',
        total_score: 64,
        actionable_feedback: 'tighten conflict',
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      })
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
    const writerFn = vi.fn(async (draft: string) => `${draft}\nrevised`);

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'writer-timeout-success' },
      writerFn,
      criticFn,
      verbose: false,
      config: {
        quality_mode: 'auto',
        quality_level: 'ultra',
        quality_phase_timeout_seconds: 1,
        pass_score: 90,
        min_c_score: 8,
      },
    });

    expect(result).toMatchObject({
      final_decision: RevisionDecision.APPROVED,
      total_revisions: 2,
    });
    expect(writerFn).toHaveBeenCalledTimes(1);
    expect(criticFn).toHaveBeenCalledTimes(2);
  });

  it('returns human review with UnknownError for non-Error writer failures', async () => {
    const criticFn = vi.fn().mockResolvedValue({
      decision: 'REVISE',
      total_score: 61,
      actionable_feedback: 'retry',
      lock_analysis: {
        C: {
          score: 8,
        },
      },
    });
    const writerFn = vi.fn().mockRejectedValue('writer boom');

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'writer-unknown-error' },
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
      degrade_reason: 'error:writer:UnknownError',
      effective_quality_level: 'fluent',
    });
  });

  it('returns human review with UnknownError for non-Error critic failures', async () => {
    const criticFn = vi.fn().mockRejectedValue('critic boom');
    const writerFn = vi.fn();

    const result = await runRevisionLoop({
      draft: 'draft',
      sceneCard: { title: 'critic-unknown-error' },
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
      degrade_reason: 'error:critic:UnknownError',
      effective_quality_level: 'fluent',
    });
    expect(writerFn).not.toHaveBeenCalled();
  });
});
