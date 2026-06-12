import { describe, expect, it, vi } from 'vitest';

import { Level2Lite } from '../../workflow/levels/level2-lite.js';

describe('workflow/level2-lite additional branches', () => {
  it('auto-approves after exhausting revisions without a passing verification result', () => {
    const lite = new Level2Lite({ max_revisions: 0 }) as unknown as {
      execute: (state: Record<string, unknown>) => Record<string, unknown>;
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    vi.spyOn(lite, '_planLite').mockImplementation((state) => state);
    vi.spyOn(lite, '_executeLite').mockImplementation((state) => ({
      ...state,
      draft_content: 'still revising',
    }));
    vi.spyOn(lite, '_verifyLite').mockImplementation((state) => ({
      ...state,
      decision: 'REVISE',
      score: 45,
    }));

    const result = lite.execute({
      user_request: 'force auto approval fallback',
      errors: [],
    });

    expect(result.decision).toBe('APPROVED');
    expect(result.revision_count).toBe(1);
    expect(result.auto_approved).toBe(true);
  });

  it('supports object-based lite plans and preserves derived execution state for LitePlanResult input', () => {
    const lite = new Level2Lite({ word_count_target: 1500 });

    const plan = lite.litePlan({
      task: 'Write a noir dialogue scene with a hidden clue, a false confession, and a stormy alley reveal.',
      reference: 'case file',
      examples: ['sample'],
      constraints: ['no exposition dump'],
    });

    expect(plan.objective).toContain('Write a noir dialogue scene');
    expect(plan.context).toMatchObject({
      reference: 'case file',
      examples: ['sample'],
      constraints: ['no exposition dump'],
    });
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);

    const executed = lite.liteExecute({
      ...plan,
      steps: [
        { action: 'analyze_requirements', inputs: { objective: plan.objective }, critical: true },
        { action: 'execute_task', inputs: { task: 'draft the dialogue' }, critical: false },
        { action: 'verify_output', inputs: {}, critical: true },
        { action: 'custom_action', description: 'custom fallback branch', critical: false },
      ],
    }) as Record<string, unknown>;

    expect(executed.plan_id).toBe(plan.planId);
    expect(executed.user_request).toBe(plan.objective);
    expect(executed.decision).toBe('APPROVED');
    expect(executed.current_step).toBe('step_3');
    expect(executed.final_output).toContain('draft the dialogue');
    expect(executed.final_output).toContain('custom fallback branch');
  });

  it('marks liteExecute as failed on critical step failure and keeps non-critical failures auto-approved', () => {
    const lite = new Level2Lite() as unknown as {
      liteExecute: (plan: Record<string, unknown>) => Record<string, unknown>;
      _executeStep: (step: Record<string, unknown>, state: Record<string, unknown>) => Record<string, unknown>;
    };

    const executeStepSpy = vi.spyOn(lite, '_executeStep');
    executeStepSpy
      .mockReturnValueOnce({ success: false, error: 'critical broke' })
      .mockReturnValueOnce({ success: false });

    const failed = lite.liteExecute({
      planId: 'plan-failed',
      objective: 'fail fast',
      context: '',
      steps: [
        { action: 'custom', critical: true },
      ],
    });

    expect(failed.decision).toBe('FAILED');
    expect(failed.error).toBe('critical broke');

    executeStepSpy.mockReset();
    executeStepSpy.mockReturnValue({ success: false });

    const fallback = lite.liteExecute({
      planId: 'plan-soft',
      objective: 'soft fail',
      context: '',
      steps: [
        { action: 'custom', critical: false },
      ],
    });

    expect(fallback.decision).toBe('APPROVED');
    expect(fallback.final_output).toBeTruthy();
  });

  it('handles missing containers and thrown writers or critics in internal execution phases', () => {
    const noContainer = new Level2Lite() as unknown as {
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const executeState = noContainer._executeLite({
      lite_plan: { objective: 'test', key_points: [], tone: 'neutral', word_count_target: 1000 },
      errors: [],
    });
    expect(executeState.errors).toHaveLength(1);

    const verifyState = noContainer._verifyLite({
      lite_plan: {},
      draft_content: 'draft',
      errors: [],
    });
    expect(verifyState.errors).toHaveLength(1);
    expect(verifyState.decision).toBe('APPROVED');
    expect(verifyState.score).toBe(70);

    const writer = {
      run: vi.fn(() => {
        throw new Error('writer offline');
      }),
    };
    const critic = {
      run: vi.fn(() => {
        throw new Error('critic offline');
      }),
    };
    const lite = new Level2Lite({}, {
      getAgent: vi
        .fn()
        .mockReturnValueOnce(writer)
        .mockReturnValueOnce(critic),
    } as never) as unknown as {
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const writerFailed = lite._executeLite({
      lite_plan: { objective: 'test', key_points: ['point'], tone: 'neutral', word_count_target: 1000 },
      feedback_context: 'tighten pace',
      errors: [],
    });
    expect(writerFailed.errors).toHaveLength(1);

    const criticFailed = lite._verifyLite({
      lite_plan: {},
      draft_content: 'draft',
      errors: [],
    });
    expect(criticFailed.errors).toHaveLength(1);
    expect(criticFailed.decision).toBe('APPROVED');
    expect(criticFailed.score).toBe(70);
  });

  it('covers confidence heuristics, prompt generation, and plan extraction helpers', () => {
    const lite = new Level2Lite({ word_count_target: 1800 }) as unknown as {
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _buildLitePrompt: (plan: Record<string, unknown>, feedback?: string) => string;
      _extractPlan: (state: Record<string, unknown>) => Record<string, unknown>;
      _calculatePlanConfidence: (
        objective: string,
        keyPoints: string[],
        context: Record<string, unknown>,
      ) => number;
      _estimateExecutionTime: (steps: Array<Record<string, unknown>>) => number;
    };

    const planned = lite._planLite({
      user_request: '这是一个悬疑场景，需要旧怀表、暴雨巷口、虚假口供和最终反转。',
      context: '悬疑 氛围 紧张',
    });

    expect(planned.lite_plan).toMatchObject({
      tone: 'suspense',
      word_count_target: 1800,
    });

    const prompt = lite._buildLitePrompt(planned.lite_plan as Record<string, unknown>, 'reduce exposition');
    expect(prompt).toContain('reduce exposition');

    const extracted = lite._extractPlan({
      lite_plan: {
        objective: 'goal',
        key_points: ['a'],
        tone: 'serious',
        word_count_target: 900,
      },
    });
    expect(extracted).toEqual({
      objective: 'goal',
      keyPoints: ['a'],
      tone: 'serious',
      wordCountTarget: 900,
    });

    expect(lite._calculatePlanConfidence('tiny', [], {})).toBe(0.4);
    expect(lite._calculatePlanConfidence('x'.repeat(250), ['a', 'b', 'c', 'd', 'e', 'f'], {
      reference: true,
      examples: true,
      constraints: true,
    })).toBe(0.9);
    expect(lite._calculatePlanConfidence('x'.repeat(40), ['one'], {})).toBeCloseTo(0.7, 10);
    expect(lite._estimateExecutionTime([{ critical: true }, { critical: false }, { critical: true }])).toBe(95);
  });

  it('covers diagnosis, root cause, fix suggestion, and affected-area helper branches', () => {
    const lite = new Level2Lite() as unknown as {
      _analyzeSeverity: (bugDesc: string) => string;
      _diagnoseBug: (bugDesc: string, context: Record<string, unknown>) => string;
      _identifyRootCause: (bugDesc: string, context: Record<string, unknown>) => string;
      _generateFixSuggestions: (
        bugDesc: string,
        rootCause: string,
        context: Record<string, unknown>,
      ) => string[];
      _identifyAffectedAreas: (bugDesc: string, context: Record<string, unknown>) => string[];
      _calculateDiagnosisConfidence: (bugDesc: string, context: Record<string, unknown>) => number;
    };

    expect(lite._analyzeSeverity('crash deadlock security incident')).toBe('critical');
    expect(lite._analyzeSeverity('error exception fail state')).toBe('high');
    expect(lite._analyzeSeverity('bug issue in parser')).toBe('medium');
    expect(lite._analyzeSeverity('warning suggests optimization')).toBe('low');
    expect(lite._analyzeSeverity('mysterious behavior')).toBe('medium');

    const diagnosis = lite._diagnoseBug('error null timeout', {
      error_log: 'stack exploded',
    });
    expect(diagnosis).toContain('stack exploded');

    expect(lite._diagnoseBug('plain symptom', {})).toContain('plain symptom');

    expect(lite._identifyRootCause('null reference', {})).toContain('空');
    expect(lite._identifyRootCause('type mismatch', {})).toContain('类型');
    expect(lite._identifyRootCause('timeout exceeded', {})).toContain('超时');
    expect(lite._identifyRootCause('permission denied', {})).toContain('权限');
    expect(lite._identifyRootCause('connection refused', {})).toContain('连接');
    expect(lite._identifyRootCause('unknown failure', { stack_trace: 'trace' })).toContain('堆栈');
    expect(lite._identifyRootCause('unknown failure', {})).toContain('进一步调查');

    expect(lite._generateFixSuggestions('bug', '变量未正确初始化或返回了空值', {})).toHaveLength(3);
    expect(lite._generateFixSuggestions('bug', '类型不匹配或类型转换错误', {})).toHaveLength(3);
    expect(lite._generateFixSuggestions('bug', '操作耗时过长或资源等待超时', {})).toHaveLength(3);
    expect(lite._generateFixSuggestions('bug', '权限配置不正确或访问被拒绝', {})).toHaveLength(3);
    expect(lite._generateFixSuggestions('bug', '网络连接问题或服务不可用', {})).toHaveLength(3);
    expect(lite._generateFixSuggestions('bug', 'other', {})).toHaveLength(3);

    expect(lite._identifyAffectedAreas('login data ui api regression', {
      file: 'src/a.ts',
      module: 'auth',
      function: 'run',
    })).toEqual(expect.arrayContaining([
      'src/a.ts',
      'auth',
      'run',
      '认证模块',
      '数据处理',
      '用户界面',
      'API 接口',
    ]));
    expect(lite._identifyAffectedAreas('plain bug', {})).toEqual(['待确定']);

    expect(lite._calculateDiagnosisConfidence('x'.repeat(120), {
      error_log: 'log',
      stack_trace: 'trace',
      code_snippet: 'snippet',
    })).toBe(0.95);
  });

  it('covers internal step execution catch and aggregation fallback helpers', () => {
    const lite = new Level2Lite() as unknown as {
      _executeStep: (step: Record<string, unknown>, state: Record<string, unknown>) => Record<string, unknown>;
      _aggregateStepResults: (steps: Array<Record<string, unknown>>) => string;
    };

    const thrownStep = new Proxy({}, {
      get(_target, property) {
        if (property === 'action') {
          throw new Error('broken getter');
        }
        return undefined;
      },
    }) as Record<string, unknown>;

    expect(lite._executeStep(thrownStep, {})).toMatchObject({
      success: false,
      error: 'broken getter',
    });
    expect(lite._aggregateStepResults([{ result: {} }, { result: { output: 'done' } }])).toBe('done');
    expect(lite._aggregateStepResults([{ result: {} }])).toBeTruthy();
  });

  it('auto-approves after exceeding max revisions without a passing verification', () => {
    const lite = new Level2Lite({ max_revisions: 1, pass_score: 90 }) as unknown as {
      execute: (state: Record<string, unknown>) => Record<string, unknown>;
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    vi.spyOn(lite, '_planLite').mockImplementation((state) => state);
    vi.spyOn(lite, '_executeLite').mockImplementation((state) => state);
    vi.spyOn(lite, '_verifyLite').mockImplementation((state) => ({
      ...state,
      decision: 'REVISE',
      score: 10,
    }));

    const result = lite.execute({
      user_request: 'keep revising',
      errors: [],
    });

    expect(result.decision).toBe('APPROVED');
    expect(result.revision_count).toBe(2);
    expect(result.auto_approved).toBe(true);
  });

  it('uses default execute fallbacks when config and verification output are sparse', () => {
    const lite = new Level2Lite() as unknown as {
      execute: (state: Record<string, unknown>) => Record<string, unknown>;
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    vi.spyOn(lite, '_planLite').mockImplementation((state) => state);
    vi.spyOn(lite, '_executeLite').mockImplementation((state) => state);
    vi.spyOn(lite, '_verifyLite').mockImplementation((state) => state);

    const result = lite.execute({
      user_request: 'default fallback path',
      errors: [],
    });

    expect(result.decision).toBe('APPROVED');
    expect(result.revision_count).toBe(2);
    expect(result.auto_approved).toBe(true);

    const nullConfigLite = new Level2Lite({
      max_revisions: null,
      pass_score: null,
    }) as unknown as {
      execute: (state: Record<string, unknown>) => Record<string, unknown>;
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    vi.spyOn(nullConfigLite, '_planLite').mockImplementation((state) => state);
    vi.spyOn(nullConfigLite, '_executeLite').mockImplementation((state) => state);
    vi.spyOn(nullConfigLite, '_verifyLite').mockImplementation((state) => ({
      ...state,
      decision: 'APPROVED',
      score: 70,
    }));

    const nullConfigResult = nullConfigLite.execute({
      user_request: 'null config fallback',
    });

    expect(nullConfigResult.decision).toBe('APPROVED');
    expect(nullConfigResult.revision_count).toBeUndefined();
  });

  it('supports sparse legacy liteExecute inputs and default critical failure messages', () => {
    const lite = new Level2Lite() as unknown as {
      litePlan: (task: Record<string, unknown>) => Record<string, unknown>;
      liteExecute: (plan: Record<string, unknown>) => Record<string, unknown>;
      _executeStep: (step: Record<string, unknown>, state: Record<string, unknown>) => Record<string, unknown>;
    };

    const sparsePlan = lite.litePlan({
      notes: 'preserve opaque context',
    });
    expect(sparsePlan.objective).toBe('');
    expect(sparsePlan.context).toEqual({ notes: 'preserve opaque context' });

    const executeStepSpy = vi.spyOn(lite, '_executeStep');
    executeStepSpy.mockReturnValue({ success: false });

    const failed = lite.liteExecute({
      plan_id: 'legacy-plan',
      context: { rich: true },
      steps: [{ critical: true }],
    });

    expect(failed.plan_id).toBe('legacy-plan');
    expect(failed.user_request).toBe('');
    expect(failed.context).toBe('');
    expect(failed.decision).toBe('FAILED');
    expect(failed.error).toBeTruthy();

    executeStepSpy.mockReset();

    const emptyPlan = lite.liteExecute({
      plan_id: 'legacy-empty',
    });

    expect(emptyPlan.plan_id).toBe('legacy-empty');
    expect(emptyPlan.decision).toBe('APPROVED');
    expect(emptyPlan.final_output).toBeTruthy();

    const missingPlanId = lite.liteExecute({});
    expect(missingPlanId.plan_id).toBe('');
  });

  it('covers writer and critic fallback branches for sparse results and non-Error throws', () => {
    const writerLite = new Level2Lite({}, {
      getAgent: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({}),
      }),
    } as never) as unknown as {
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const writerState = writerLite._executeLite({
      errors: [],
    });

    expect(writerState.draft_content).toBe('');
    expect(writerState.draft_version).toBe(1);

    const criticLite = new Level2Lite({}, {
      getAgent: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({}),
      }),
    } as never) as unknown as {
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const criticState = criticLite._verifyLite({
      errors: [],
    });

    expect(criticState.score).toBe(0);
    expect(criticState.decision).toBe('REVISE');
    expect(criticState.feedback_context).toBe('');

    const thrownWriterLite = new Level2Lite({}, {
      getAgent: vi.fn().mockReturnValue({
        run: vi.fn(() => {
          throw 'writer string failure';
        }),
      }),
    } as never) as unknown as {
      _executeLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const thrownWriterState = thrownWriterLite._executeLite({});
    expect(thrownWriterState.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('writer string failure')]),
    );

    const thrownCriticLite = new Level2Lite({}, {
      getAgent: vi.fn().mockReturnValue({
        run: vi.fn(() => {
          throw 'critic string failure';
        }),
      }),
    } as never) as unknown as {
      _verifyLite: (state: Record<string, unknown>) => Record<string, unknown>;
    };

    const thrownCriticState = thrownCriticLite._verifyLite({});
    expect(thrownCriticState.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('critic string failure')]),
    );
    expect(thrownCriticState.decision).toBe('APPROVED');
    expect(thrownCriticState.score).toBe(70);
  });

  it('covers helper defaults for prompts, confidence, extraction, and step execution', () => {
    const lite = new Level2Lite() as unknown as {
      _planLite: (state: Record<string, unknown>) => Record<string, unknown>;
      _buildLitePrompt: (plan: Record<string, unknown>, feedback?: string) => string;
      _extractPlan: (state: Record<string, unknown>) => Record<string, unknown>;
      _calculatePlanConfidence: (
        objective: string,
        keyPoints: string[],
        context: Record<string, unknown>,
      ) => number;
      _executeStep: (step: Record<string, unknown>, state: Record<string, unknown>) => Record<string, unknown>;
    };

    const prompt = lite._buildLitePrompt({});
    expect(prompt).toContain('neutral');
    expect(prompt).toContain('1000');

    expect(
      lite._planLite({
        context: 'context only',
      }).lite_plan,
    ).toMatchObject({
      objective: '',
    });

    expect(lite._extractPlan({})).toEqual({
      objective: '',
      keyPoints: [],
      tone: 'neutral',
      wordCountTarget: 1000,
    });

    expect(
      lite._calculatePlanConfidence('x'.repeat(40), [], {
        notes: 'context without examples',
      }),
    ).toBeCloseTo(0.75, 10);

    expect(lite._executeStep({ action: 'analyze_requirements', inputs: {} }, {})).toMatchObject({
      success: true,
    });
    expect(lite._executeStep({ action: 'execute_task', inputs: {} }, {})).toMatchObject({
      success: true,
    });
    expect(lite._executeStep({}, {})).toMatchObject({
      success: true,
    });

    const thrownStringStep = new Proxy({}, {
      get(_target, property) {
        if (property === 'action') {
          throw 'string getter failure';
        }
        return undefined;
      },
    }) as Record<string, unknown>;

    expect(lite._executeStep(thrownStringStep, {})).toMatchObject({
      success: false,
      error: 'string getter failure',
    });
  });
});
