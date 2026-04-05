import { describe, expect, it } from 'vitest';

import {
  buildFeedbackArtifactEnvelope,
  RevisionDecision,
  RevisionLoop,
  runRevisionLoop,
} from '../../workflow/revision-loop';

describe('workflow/revision-loop', () => {
  it('updates from critic results, records checkpoints, and approves when score gates are met', () => {
    const checkpointStore: Record<string, unknown> = {};
    const loop = new RevisionLoop(
      {
        pass_score: 80,
        min_c_score: 7,
      },
      checkpointStore,
    );

    const decision = loop.updateFromCritic({
      decision: 'APPROVED',
      total_score: 88,
      actionable_feedback: '已经足够稳定',
      session_id: 'session-1',
      revision_instructions: [
        {
          target: 'scene-1',
          issue: '节奏略慢',
          suggestion: '压缩铺垫',
          priority: 'high',
        },
      ],
      lock_analysis: {
        C: {
          score: 8,
        },
      },
    });

    expect(decision).toBe(RevisionDecision.APPROVED);
    expect(loop.shouldContinue()).toBe(false);
    expect(loop.state.last_checkpoint_id).toContain('revision-round-1');
    expect(checkpointStore[loop.state.last_checkpoint_id]).toBeTruthy();
    expect(loop.getFeedbackForWriter()).toMatchObject({
      revision_count: 1,
      current_score: 88,
      feedback: '已经足够稳定',
    });
    expect(loop.state.feedback_artifacts[0]).toMatchObject({
      scope: 'scene',
      severity: 'high',
      issue: '节奏略慢',
    });
  });

  it('switches to human review after stagnation and tracks degrade steps on runtime events', () => {
    const loop = new RevisionLoop({
      max_revisions: 5,
      score_improvement_threshold: 5,
      quality_mode: 'auto',
      quality_level: 'ultra',
    });

    expect(loop.handleRuntimeEvent('timeout', 'critic')).toBe(true);
    expect(loop.state.effective_quality_level).toBe('high');
    expect(loop.state.degrade_steps).toHaveLength(1);

    loop.updateFromCritic({
      decision: 'REVISE',
      total_score: 60,
      actionable_feedback: '继续修改',
    });
    const second = loop.updateFromCritic({
      decision: 'REVISE',
      total_score: 62,
      actionable_feedback: '改进有限',
    });
    const third = loop.updateFromCritic({
      decision: 'REVISE',
      total_score: 63,
      actionable_feedback: '仍然停滞',
    });

    expect(second).toBe(RevisionDecision.REVISE);
    expect(third).toBe(RevisionDecision.HUMAN_REVIEW);
    expect(loop.shouldContinue()).toBe(false);
    expect(loop.getSummary()).toMatchObject({
      total_revisions: 3,
      final_decision: RevisionDecision.HUMAN_REVIEW,
      stagnant_count: 2,
      degrade_reason: 'timeout:critic',
    });
  });

  it('builds a feedback artifact envelope with traceable metadata', () => {
    const envelope = buildFeedbackArtifactEnvelope(
      [
        {
          feedback_id: 'feedback-round-1-1',
          issue: '节奏偏慢',
        },
      ],
      'session-1',
      'run-1',
      'revision-1',
      ['tests/workflow/revision-loop.test.ts'],
    );

    expect(envelope).toMatchObject({
      artifact_type: 'quality_feedback',
      schema_version: 'evidence.v1',
      result: 'PASS',
      input: {
        session_id: 'session-1',
        run_id: 'run-1',
        revision_id: 'revision-1',
      },
      output: {
        count: 1,
      },
      trace: {
        session_id: 'session-1',
      },
    });
    expect((envelope.evidence_links as string[])[0]).toContain('revision-loop.test.ts');
  });

  it('runs the minimal revision loop end to end and returns the final summary contract', async () => {
    const result = await runRevisionLoop({
      draft: '初稿内容',
      sceneCard: { title: 'scene-1' },
      verbose: false,
      writerFn: async (draft, feedback) => `${draft}\n[rev:${feedback.revision_count}]`,
      criticFn: async (draft) => ({
        decision: draft.includes('[rev:1]') ? 'APPROVED' : 'REVISE',
        total_score: draft.includes('[rev:1]') ? 90 : 68,
        actionable_feedback: '收紧节奏',
        revision_instructions: [
          {
            target: 'scene-1',
            issue: '冲突不足',
            suggestion: '增加压迫感',
            priority: 'medium',
          },
        ],
        lock_analysis: {
          C: {
            score: 8,
          },
        },
      }),
      config: {
        max_revisions: 3,
        quality_phase_timeout_seconds: 0,
        pass_score: 90,
        min_c_score: 8,
      },
      checkpointStore: {},
      sessionId: 'session-2',
    });

    expect(result).toMatchObject({
      final_decision: RevisionDecision.APPROVED,
      final_score: 90,
      total_revisions: 2,
    });
    expect((result.score_trend as number[])).toEqual([68, 90]);
    expect((result.feedback_artifacts as Array<Record<string, unknown>>)[0]).toMatchObject({
      scope: 'scene',
      issue: '冲突不足',
    });
  });
});
