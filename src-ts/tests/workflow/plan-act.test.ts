import { describe, expect, it, vi } from 'vitest';

import {
  ActPhaseExecutor,
  getDefaultPlanActMode,
  PlanActMode,
  PlanActState,
  PlanPhaseExecutor,
  ReviewPhaseExecutor,
  RevisePhaseExecutor,
  WorkflowPhase,
} from '../../workflow/modes/plan-act';

describe('workflow/modes/plan-act', () => {
  it('saves and restores checkpoints on PlanActState', () => {
    const state = new PlanActState('session-1', 4);
    state.plan = { step: 1 };
    state.output = 'draft';
    state.reviewFeedback = { score: 0.8 };
    state.currentPhase = WorkflowPhase.REVIEW;
    state.iteration = 2;

    const checkpoint = state.saveCheckpoint();

    state.plan = null;
    state.output = null;
    state.reviewFeedback = null;
    state.currentPhase = WorkflowPhase.PLAN;
    state.iteration = 0;
    state.restoreCheckpoint(checkpoint);

    expect(state.currentPhase).toBe(WorkflowPhase.REVIEW);
    expect(state.iteration).toBe(2);
    expect(state.plan).toEqual({ step: 1 });
    expect(state.output).toBe('draft');
    expect(state.reviewFeedback).toEqual({ score: 0.8 });
  });

  it('uses fallback phase executors when no agents are injected', async () => {
    const state = new PlanActState('session-2');
    const context = { task: '整理一个执行计划', requirements: ['测试优先'] };

    const planResult = await new PlanPhaseExecutor().execute(state, context);
    expect(planResult.success).toBe(true);
    expect(planResult.nextPhase).toBe(WorkflowPhase.ACT);
    expect((planResult.output as Record<string, unknown>).steps).toHaveLength(3);

    state.plan = planResult.output as Record<string, unknown>;
    const actResult = await new ActPhaseExecutor().execute(state, context);
    expect(actResult.success).toBe(true);
    expect(String(actResult.output)).toContain('整理一个执行计划');
    expect(actResult.nextPhase).toBe(WorkflowPhase.REVIEW);

    state.output = actResult.output as string;
    const reviewResult = await new ReviewPhaseExecutor(undefined, 0.7).execute(
      state,
      context,
    );
    expect(reviewResult.success).toBe(true);
    expect((reviewResult.output as Record<string, unknown>).overall_score).toBe(0.75);

    state.reviewFeedback = reviewResult.output as Record<string, unknown>;
    const reviseResult = await new RevisePhaseExecutor().execute(state, context);
    expect(reviseResult.success).toBe(true);
    expect(String(reviseResult.output)).toContain('[Generated content for: 整理一个执行计划]');
  });

  it('runs a minimal plan-act workflow with mocked architect, writer, and critic agents', async () => {
    const architectAgent = {
      plan: vi.fn().mockResolvedValue({
        steps: [{ step: 1, description: '先做计划' }],
      }),
    };
    const writerAgent = {
      write: vi.fn().mockResolvedValue('初稿输出'),
      revise: vi.fn().mockResolvedValue('修订后输出'),
    };
    const criticAgent = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce({ overall_score: 0.6, suggestions: ['补足细节'], issues: ['细节不足'] })
        .mockResolvedValueOnce({ overall_score: 0.9, suggestions: [], issues: [] }),
    };

    const mode = new PlanActMode({
      architectAgent,
      writerAgent,
      criticAgent,
      qualityThreshold: 0.7,
      maxIterations: 3,
    });

    const result = await mode.execute('session-3', '完成一个计划-执行-复盘闭环');

    expect(result.phase).toBe(WorkflowPhase.COMPLETE);
    expect(result.success).toBe(true);
    expect(result.output).toBe('修订后输出');
    expect(result.metadata).toMatchObject({
      iterations: 1,
      phase_count: 5,
    });
    expect(architectAgent.plan).toHaveBeenCalled();
    expect(writerAgent.write).toHaveBeenCalled();
    expect(writerAgent.revise).toHaveBeenCalled();
    expect(criticAgent.evaluate).toHaveBeenCalledTimes(2);
  });

  it('creates a default mode, exposes stored session state, and clears sessions', async () => {
    const writerAgent = {
      write: vi.fn().mockResolvedValue('默认输出'),
      revise: vi.fn().mockResolvedValue('默认修订'),
    };
    const criticAgent = {
      evaluate: vi.fn().mockResolvedValue({ quality_score: 0.9, suggestions: [] }),
    };

    const mode = getDefaultPlanActMode(undefined, writerAgent, criticAgent);
    const result = await mode.execute('session-4', '默认模式任务');

    expect(result.success).toBe(true);
    expect(mode.listSessions()).toContain('session-4');
    expect(mode.getState('session-4')?.output).toBe('默认修订');
    expect(mode.clearState('session-4')).toBe(true);
    expect(mode.getState('session-4')).toBeUndefined();
  });
});
