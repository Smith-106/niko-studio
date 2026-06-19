import { describe, expect, it, vi } from 'vitest';

import {
  ActPhaseExecutor,
  PlanActMode,
  PlanActState,
  PlanPhaseExecutor,
  ReviewPhaseExecutor,
  RevisePhaseExecutor,
  WorkflowPhase,
} from '../../workflow/modes/plan-act';

describe('workflow/modes/plan-act additional coverage', () => {
  it('covers executor failure results for thrown agent errors and missing prerequisites', async () => {
    const planFailure = await new PlanPhaseExecutor({
      plan: vi.fn().mockRejectedValue(new Error('plan exploded')),
    }).execute(new PlanActState('plan-fail'), {
      task: '写计划',
      requirements: ['测试优先'],
    });
    expect(planFailure).toMatchObject({
      phase: WorkflowPhase.PLAN,
      success: false,
      nextPhase: null,
      output: null,
      durationMs: 0,
    });
    expect(planFailure.error?.message).toBe('plan exploded');

    const actMissingPlan = await new ActPhaseExecutor().execute(
      new PlanActState('act-missing-plan'),
      { task: '执行任务' },
    );
    expect(actMissingPlan.error?.message).toBe('No plan available for execution');

    const actFailureState = new PlanActState('act-fail');
    actFailureState.plan = { steps: [] };
    const actFailure = await new ActPhaseExecutor({
      write: vi.fn().mockRejectedValue(new Error('write exploded')),
    }).execute(actFailureState, { task: '执行任务' });
    expect(actFailure).toMatchObject({
      phase: WorkflowPhase.ACT,
      success: false,
      nextPhase: null,
    });
    expect(actFailure.error?.message).toBe('write exploded');

    const reviewMissingOutput = await new ReviewPhaseExecutor().execute(
      new PlanActState('review-missing-output'),
      {},
    );
    expect(reviewMissingOutput.error?.message).toBe('No output to review');

    const reviewFailureState = new PlanActState('review-fail');
    reviewFailureState.output = '初稿';
    const reviewFailure = await new ReviewPhaseExecutor({
      evaluate: vi.fn().mockRejectedValue(new Error('critic exploded')),
    }).execute(reviewFailureState, { task: '审查任务' });
    expect(reviewFailure).toMatchObject({
      phase: WorkflowPhase.REVIEW,
      success: false,
      nextPhase: null,
    });
    expect(reviewFailure.error?.message).toBe('critic exploded');

    const reviseMissingState = new PlanActState('revise-missing');
    reviseMissingState.output = '初稿';
    const reviseMissing = await new RevisePhaseExecutor().execute(reviseMissingState, {});
    expect(reviseMissing.error?.message).toBe('Missing output or feedback for revision');

    const reviseFailureState = new PlanActState('revise-fail');
    reviseFailureState.output = '初稿';
    reviseFailureState.reviewFeedback = { issues: ['补充细节'] };
    const reviseFailure = await new RevisePhaseExecutor({
      revise: vi.fn().mockRejectedValue(new Error('revise exploded')),
    }).execute(reviseFailureState, { task: '修订任务' });
    expect(reviseFailure).toMatchObject({
      phase: WorkflowPhase.REVISE,
      success: false,
      nextPhase: null,
    });
    expect(reviseFailure.error?.message).toBe('revise exploded');
  });

  it('covers fallback review and revise branches without injected agents', async () => {
    const reviewState = new PlanActState('fallback-review', 3);
    reviewState.output = '默认输出';
    reviewState.iteration = 1;

    const reviewResult = await new ReviewPhaseExecutor(undefined, 0.8).execute(
      reviewState,
      { task: '默认审查' },
    );

    expect(reviewResult).toMatchObject({
      phase: WorkflowPhase.REVIEW,
      success: true,
      nextPhase: WorkflowPhase.REVISE,
      metadata: {
        quality_score: 0.75,
      },
    });
    expect(reviewState.reviewFeedback).toMatchObject({
      dimensions: {
        coherence: 0.8,
        engagement: 0.7,
        style: 0.75,
      },
    });

    const reviseState = new PlanActState('fallback-revise');
    reviseState.output = '默认输出';
    reviseState.reviewFeedback = {
      issues: ['补足细节', '收紧结构'],
    };

    const reviseResult = await new RevisePhaseExecutor().execute(reviseState, {
      task: '默认修订',
    });

    expect(reviseResult).toMatchObject({
      phase: WorkflowPhase.REVISE,
      success: true,
      nextPhase: WorkflowPhase.REVIEW,
      metadata: {
        iteration: 1,
      },
    });
    expect(String(reviseResult.output)).toContain('Addressed 2 issues');
    expect(reviseState.iteration).toBe(1);
  });

  it('restores from checkpoint when resuming and merges extra execution context', async () => {
    const criticAgent = {
      evaluate: vi.fn().mockResolvedValue({
        overall_score: 0.95,
        suggestions: [],
        issues: [],
      }),
    };
    const mode = new PlanActMode({
      criticAgent,
      maxIterations: 4,
    });

    const resumed = new PlanActState('resume-session', 4);
    resumed.currentPhase = WorkflowPhase.REVIEW;
    resumed.plan = { steps: [{ step: 1, description: '恢复执行' }] };
    resumed.output = 'checkpoint-output';
    resumed.iteration = 2;
    resumed.saveCheckpoint();

    resumed.currentPhase = WorkflowPhase.PLAN;
    resumed.output = 'mutated-output';
    resumed.iteration = 0;

    (mode as unknown as { _states: Map<string, PlanActState> })._states.set(
      'resume-session',
      resumed,
    );

    const result = await mode.execute(
      'resume-session',
      '恢复任务',
      {
        requirements: ['保留上下文'],
        extra_flag: true,
      },
      true,
    );

    expect(result).toMatchObject({
      phase: WorkflowPhase.COMPLETE,
      success: true,
      output: 'checkpoint-output',
      metadata: {
        iterations: 2,
        phase_count: 1,
      },
    });
    expect(criticAgent.evaluate).toHaveBeenCalledWith(
      'checkpoint-output',
      expect.objectContaining({
        task: '恢复任务',
        requirements: ['保留上下文'],
        extra_flag: true,
      }),
    );
  });

  it('stores saved checkpoint state in a serializable dictionary shape', () => {
    const state = new PlanActState('checkpoint-dict');
    state.plan = { steps: [{ step: 1, description: '检查序列化' }] };
    state.output = 'checkpoint-output';
    state.reviewFeedback = { issues: [] };
    state.iteration = 3;

    const checkpoint = state.saveCheckpoint();

    expect(state.checkpoints[0]).toEqual(checkpoint);
    expect(checkpoint).toMatchObject({
      phase: WorkflowPhase.PLAN,
      state: {
        plan: state.plan,
        output: 'checkpoint-output',
        review_feedback: { issues: [] },
      },
      iteration: 3,
    });
  });

  it('returns the failing phase result when the workflow loop hits an execution error', async () => {
    const mode = new PlanActMode({
      architectAgent: {
        plan: vi.fn().mockResolvedValue({
          steps: [{ step: 1, description: '先做计划' }],
        }),
      },
      writerAgent: {
        write: vi.fn().mockRejectedValue(new Error('writer failed in loop')),
      },
    });

    const result = await mode.execute('loop-failure', '失败闭环任务', {
      skills: ['vitest'],
    });

    expect(result).toMatchObject({
      phase: WorkflowPhase.ACT,
      success: false,
      nextPhase: null,
    });
    expect(result.error?.message).toBe('writer failed in loop');
  });

  it('covers missing executor and null-next-phase early stop branches', async () => {
    const missingExecutorMode = new PlanActMode({
      architectAgent: {
        plan: vi.fn().mockResolvedValue({
          steps: [{ step: 1, description: '只做计划' }],
        }),
      },
    });
    (
      missingExecutorMode as unknown as {
        _executors: Map<WorkflowPhase, unknown>;
      }
    )._executors.delete(WorkflowPhase.ACT);

    const missingExecutorResult = await missingExecutorMode.execute(
      'missing-executor',
      '缺少执行器任务',
    );

    expect(missingExecutorResult).toMatchObject({
      phase: WorkflowPhase.COMPLETE,
      success: true,
      output: null,
      metadata: {
        phase_count: 1,
      },
    });

    const nullNextPhaseMode = new PlanActMode();
    (
      nullNextPhaseMode as unknown as {
        _executors: Map<
          WorkflowPhase,
          { execute: (state: PlanActState) => Promise<Record<string, unknown>> }
        >;
      }
    )._executors.set(WorkflowPhase.PLAN, {
      async execute(state: PlanActState) {
        state.plan = { steps: [{ step: 1, description: '静态结束' }] };
        state.output = 'stopped-early';
        return {
          phase: WorkflowPhase.PLAN,
          success: true,
          output: state.plan,
          metadata: { source: 'test' },
          error: null,
          durationMs: 0,
          nextPhase: null,
        };
      },
    });

    const nullNextPhaseResult = await nullNextPhaseMode.execute(
      'null-next-phase',
      '空跳转任务',
      { extra: 'value' },
    );

    expect(nullNextPhaseResult).toMatchObject({
      phase: WorkflowPhase.COMPLETE,
      success: true,
      output: 'stopped-early',
      metadata: {
        phase_count: 1,
        iterations: 0,
      },
    });
  });
});
