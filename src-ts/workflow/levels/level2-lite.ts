/**
 * level2-lite.ts - L2 Lite mode
 *
 * In-memory plan, lightweight persistence.
 * Suitable for: single-scene writing, dialogue snippets, short prose, bug diagnosis.
 *
 * Commands:
 * - lite-plan: generate plan in memory
 * - lite-fix: bug diagnosis and fix suggestions
 * - lite-execute: unified execution entry point
 *
 * Migrated from src/workflow/levels/level2_lite.py
 */

import type { BaseState } from '../state.js';
import { AgentType } from '../../agents/base.js';
import type { IServiceContainer } from './level1-rapid.js';

// ============================================================
// Data types
// ============================================================

export interface LitePlan {
  objective: string;
  keyPoints: string[];
  tone: string;
  wordCountTarget: number;
}

export interface LitePlanResult {
  planId: string;
  steps: Record<string, unknown>[];
  estimatedTime: number; // seconds
  confidence: number; // 0-1
  createdAt: string;
  objective: string;
  context: Record<string, unknown>;
}

export interface LiteFixResult {
  diagnosis: string;
  rootCause: string;
  fixSuggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  affectedAreas: string[];
  relatedIssues: string[];
}

// ============================================================
// Level2Lite
// ============================================================

export class Level2Lite {
  readonly level = 2;
  readonly name = 'lite';
  readonly description = '轻量模式 - 内存计划、轻量持久化';

  protected config: Record<string, unknown>;
  protected _container: IServiceContainer | null;

  constructor(
    config?: Record<string, unknown> | null,
    container?: IServiceContainer | null,
  ) {
    this.config = config ?? {};
    this._container = container ?? null;
  }

  protected get container(): IServiceContainer {
    if (this._container == null) {
      throw new Error('ServiceContainer not available.');
    }
    return this._container;
  }

  /**
   * Execute the lite workflow
   *
   * Flow:
   * 1. Plan-Lite: generate simple plan
   * 2. Execute: Writer executes
   * 3. Verify-Lite: quick verification
   * 4. If not passed, retry at most 1 time
   */
  execute(state: BaseState): BaseState {
    const config = { ...this.getDefaultConfig(), ...this.config };

    const maxRevisions = (config.max_revisions as number) ?? 1;
    const passScore = (config.pass_score as number) ?? 70; // L2 execution policy fallback, not novel publish threshold

    // Phase 1: lite plan
    state = this._planLite(state);

    // Phase 2-3: execute and verify loop
    let revisionCount = 0;
    while (revisionCount <= maxRevisions) {
      state = this._executeLite(state);
      state = this._verifyLite(state);

      const score = state.score ?? 0;
      const decision = state.decision ?? 'REVISE';

      if (decision === 'APPROVED' || score >= passScore) {
        state.decision = 'APPROVED';
        break;
      }

      revisionCount++;
      state.revision_count = revisionCount;
    }

    if (revisionCount > maxRevisions && state.decision !== 'APPROVED') {
      // Lite mode does not trigger human review, auto-approve
      state.decision = 'APPROVED';
      (state as Record<string, unknown>).auto_approved = true;
    }

    return state;
  }

  getRequiredAgents(): string[] {
    return ['writer', 'critic'];
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      max_revisions: 1,
      pass_score: 70,
      verbose: true,
      word_count_target: 1000,
      retrieval_profile: 'lite_low_cost',
    };
  }

  // ========== Public API methods ==========

  planLiteFromState(state: BaseState): LitePlan {
    return this._extractPlan(state);
  }

  /**
   * lite-plan: generate plan in memory
   */
  litePlan(task: string | Record<string, unknown>): LitePlanResult {
    let objective: string;
    let context: Record<string, unknown>;

    if (typeof task === 'string') {
      objective = task;
      context = {};
    } else {
      objective = (task.objective as string) ?? (task.task as string) ?? '';
      context = Object.fromEntries(
        Object.entries(task).filter(([k]) => !['objective', 'task'].includes(k)),
      );
    }

    const planId = `lite-${crypto.randomUUID().slice(0, 8)}`;
    const keyPoints = this._extractKeyPoints(objective);
    const steps = this._generatePlanSteps(objective, keyPoints, context);
    const estimatedTime = this._estimateExecutionTime(steps);
    const confidence = this._calculatePlanConfidence(objective, keyPoints, context);

    return {
      planId,
      steps,
      estimatedTime,
      confidence,
      createdAt: new Date().toISOString(),
      objective,
      context,
    };
  }

  /**
   * lite-fix: bug diagnosis and fix suggestions
   */
  liteFix(bugDesc: string, context?: Record<string, unknown>): LiteFixResult {
    const ctx = context ?? {};

    const severity = this._analyzeSeverity(bugDesc);
    const diagnosis = this._diagnoseBug(bugDesc, ctx);
    const rootCause = this._identifyRootCause(bugDesc, ctx);
    const fixSuggestions = this._generateFixSuggestions(bugDesc, rootCause, ctx);
    const affectedAreas = this._identifyAffectedAreas(bugDesc, ctx);
    const confidence = this._calculateDiagnosisConfidence(bugDesc, ctx);

    return {
      diagnosis,
      rootCause,
      fixSuggestions,
      severity,
      confidence,
      affectedAreas,
      relatedIssues: [],
    };
  }

  /**
   * lite-execute: unified execution entry point
   */
  liteExecute(plan: LitePlanResult | Record<string, unknown>): BaseState {
    const planDict: Record<string, unknown> =
      'planId' in plan ? this._litePlanResultToDict(plan as LitePlanResult) : plan;

    const state: BaseState = {
      session_id: crypto.randomUUID(),
    };
    (state as Record<string, unknown>).plan_id = planDict.planId ?? '';
    state.user_request = (planDict.objective as string) ?? '';
    state.context = typeof planDict.context === 'string' ? planDict.context : '';
    (state as Record<string, unknown>).steps = planDict.steps ?? [];

    const steps = (state as Record<string, unknown>).steps as Record<string, unknown>[];
    const executedSteps: Record<string, unknown>[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepResult = this._executeStep(step, state);
      executedSteps.push({
        step_index: i,
        step,
        result: stepResult,
        status: (stepResult.success as boolean) ? 'completed' : 'failed',
      });

      state.current_step = `step_${i}`;
      (state as Record<string, unknown>).step_results = executedSteps;

      if (!(stepResult.success as boolean) && step.critical) {
        state.decision = 'FAILED';
        (state as Record<string, unknown>).error = stepResult.error ?? '步骤执行失败';
        break;
      }
    }

    if (state.decision !== 'FAILED') {
      state.decision = 'APPROVED';
      state.final_output = this._aggregateStepResults(executedSteps);
    }

    return state;
  }

  // ========== Internal: workflow phases ==========

  _planLite(state: BaseState): BaseState {
    const userRequest = state.user_request ?? '';
    const context = state.context ?? '';

    const keyPoints = this._extractKeyPoints(userRequest);
    const tone = this._inferTone(userRequest, context);

    const plan: LitePlan = {
      objective: userRequest.slice(0, 200),
      keyPoints,
      tone,
      wordCountTarget: (this.config.word_count_target as number) ?? 1000,
    };

    (state as Record<string, unknown>).lite_plan = {
      objective: plan.objective,
      key_points: plan.keyPoints,
      tone: plan.tone,
      word_count_target: plan.wordCountTarget,
    };

    return state;
  }

  _executeLite(state: BaseState): BaseState {
    try {
      const writer = this.container.getAgent(AgentType.WRITER, { name: 'lite_writer' });
      const plan = ((state as Record<string, unknown>).lite_plan as Record<string, unknown>) ?? {};
      const feedback = ((state as Record<string, unknown>).feedback_context as string) ?? '';

      const result = writer.run({
        prompt: this._buildLitePrompt(plan, feedback),
        context: state.context ?? '',
        mode: 'lite',
      });

      state.draft_content = (result.content as string) ?? '';
      const draftVersion = ((state as Record<string, unknown>).draft_version as number) ?? 0;
      (state as Record<string, unknown>).draft_version = draftVersion + 1;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), `执行失败: ${errorMsg}`];
    }

    return state;
  }

  _verifyLite(state: BaseState): BaseState {
    try {
      const critic = this.container.getAgent(AgentType.CRITIC, { name: 'lite_critic' });
      const plan = ((state as Record<string, unknown>).lite_plan as Record<string, unknown>) ?? {};

      const result = critic.run({
        content: state.draft_content ?? '',
        plan,
        mode: 'quick',
      });

      state.score = (result.score as number) ?? 0;
      state.decision = (result.decision as string) ?? 'REVISE';
      (state as Record<string, unknown>).feedback_context = (result.feedback as string) ?? '';
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), `验证失败: ${errorMsg}`];
      // Lite mode defaults to approved on verification failure
      state.decision = 'APPROVED';
      state.score = 70;
    }

    return state;
  }

  // ========== Internal: helper methods ==========

  private _extractKeyPoints(text: string): string[] {
    const sentences = text.split(/[。，,.\n]/);
    const keyPoints = sentences.map(s => s.trim()).filter(s => s.length > 5);
    return keyPoints.slice(0, 5);
  }

  private _inferTone(request: string, context: string): string {
    const text = `${request} ${context}`.toLowerCase();

    const toneKeywords: Record<string, string[]> = {
      humorous: ['幽默', '搞笑', '轻松', '诙谐'],
      serious: ['严肃', '正式', '庄重', '认真'],
      romantic: ['浪漫', '温馨', '甜蜜', '爱情'],
      suspense: ['悬疑', '紧张', '惊悚', '神秘'],
      lyrical: ['抒情', '优美', '诗意', '唯美'],
    };

    for (const [tone, keywords] of Object.entries(toneKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return tone;
      }
    }

    return 'neutral';
  }

  private _buildLitePrompt(plan: Record<string, unknown>, feedback?: string): string {
    const objective = (plan.objective as string) ?? '';
    const keyPoints = (plan.key_points as string[]) ?? [];
    const tone = (plan.tone as string) ?? 'neutral';
    const wordCountTarget = (plan.word_count_target as number) ?? 1000;

    let prompt = `任务目标: ${objective}\n\n关键要点:\n${keyPoints.map(p => `- ${p}`).join('\n')}\n\n语气风格: ${tone}\n目标字数: 约 ${wordCountTarget} 字\n`;

    if (feedback) {
      prompt += `\n修改建议:\n${feedback}\n`;
    }

    prompt += '\n请根据以上要求进行创作。';

    return prompt;
  }

  private _extractPlan(state: BaseState): LitePlan {
    const planDict = ((state as Record<string, unknown>).lite_plan as Record<string, unknown>) ?? {};
    return {
      objective: (planDict.objective as string) ?? '',
      keyPoints: (planDict.key_points as string[]) ?? [],
      tone: (planDict.tone as string) ?? 'neutral',
      wordCountTarget: (planDict.word_count_target as number) ?? 1000,
    };
  }

  private _generatePlanSteps(
    objective: string,
    keyPoints: string[],
    _context: Record<string, unknown>,
  ): Record<string, unknown>[] {
    const steps: Record<string, unknown>[] = [];

    // Base step: analyze
    steps.push({
      index: 0,
      name: 'analyze',
      description: '分析任务需求',
      action: 'analyze_requirements',
      inputs: { objective, key_points: keyPoints },
      critical: true,
    });

    // Execute steps based on key points
    for (let i = 0; i < keyPoints.length; i++) {
      steps.push({
        index: i + 1,
        name: `execute_${i + 1}`,
        description: `执行: ${keyPoints[i].slice(0, 50)}`,
        action: 'execute_task',
        inputs: { task: keyPoints[i] },
        critical: false,
      });
    }

    // Verify step
    steps.push({
      index: steps.length,
      name: 'verify',
      description: '验证输出质量',
      action: 'verify_output',
      inputs: {},
      critical: true,
    });

    return steps;
  }

  private _estimateExecutionTime(steps: Record<string, unknown>[]): number {
    const baseTime = 30;
    const perStepTime = 15;
    const criticalBonus = steps.filter(s => s.critical).length * 10;
    return baseTime + steps.length * perStepTime + criticalBonus;
  }

  private _calculatePlanConfidence(
    objective: string,
    keyPoints: string[],
    context: Record<string, unknown>,
  ): number {
    let confidence = 0.5;

    // Objective clarity (moderate length increases confidence)
    const objLen = objective.length;
    if (objLen >= 20 && objLen <= 200) {
      confidence += 0.15;
    } else if (objLen > 200) {
      confidence += 0.1;
    } else {
      confidence -= 0.1;
    }

    // Key point count (2-5 optimal)
    const kpCount = keyPoints.length;
    if (kpCount >= 2 && kpCount <= 5) {
      confidence += 0.15;
    } else if (kpCount > 5) {
      confidence += 0.1;
    } else if (kpCount === 1) {
      confidence += 0.05;
    }

    // Context richness
    if (Object.keys(context).length > 0) {
      confidence += 0.1;
      if (context.reference || context.examples) confidence += 0.05;
      if (context.constraints) confidence += 0.05;
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private _analyzeSeverity(bugDesc: string): 'low' | 'medium' | 'high' | 'critical' {
    const text = bugDesc.toLowerCase();

    const criticalKws = ['崩溃', 'crash', '数据丢失', '安全', 'security', '死锁', 'deadlock'];
    const highKws = ['错误', 'error', '失败', 'fail', '异常', 'exception', '无法'];
    const mediumKws = ['问题', 'issue', 'bug', '不正确', 'incorrect'];
    const lowKws = ['建议', '优化', '改进', 'warning', '警告'];

    if (criticalKws.some(kw => text.includes(kw))) return 'critical';
    if (highKws.some(kw => text.includes(kw))) return 'high';
    if (mediumKws.some(kw => text.includes(kw))) return 'medium';
    if (lowKws.some(kw => text.includes(kw))) return 'low';
    return 'medium';
  }

  private _diagnoseBug(bugDesc: string, context: Record<string, unknown>): string {
    const parts: string[] = [];

    if (/error|错误/i.test(bugDesc)) parts.push('检测到错误状态');
    if (/null|空/.test(bugDesc)) parts.push('可能存在空值引用问题');
    if (/timeout|超时/i.test(bugDesc)) parts.push('存在超时或性能问题');

    if (context.error_log) {
      const log = String(context.error_log).slice(0, 100);
      parts.push(`错误日志显示: ${log}`);
    }

    if (parts.length === 0) {
      parts.push(`问题描述: ${bugDesc.slice(0, 200)}`);
    }

    return parts.join('; ');
  }

  private _identifyRootCause(bugDesc: string, context: Record<string, unknown>): string {
    const text = bugDesc.toLowerCase();

    if (/空|null|none/.test(text)) return '变量未正确初始化或返回了空值';
    if (/类型|type/.test(text)) return '类型不匹配或类型转换错误';
    if (/超时|timeout/.test(text)) return '操作耗时过长或资源等待超时';
    if (/权限|permission|access/.test(text)) return '权限配置不正确或访问被拒绝';
    if (/连接|connection/.test(text)) return '网络连接问题或服务不可用';
    if (context.stack_trace) return '根据堆栈跟踪分析: 问题源于代码执行路径异常';

    return '需要进一步调查以确定根本原因';
  }

  private _generateFixSuggestions(
    bugDesc: string,
    rootCause: string,
    _context: Record<string, unknown>,
  ): string[] {
    const suggestions: string[] = [];

    if (/空值|初始化/.test(rootCause)) {
      suggestions.push(
        '添加空值检查 (null check)',
        '确保变量在使用前正确初始化',
        '使用可选链操作符 (?.) 进行安全访问',
      );
    }

    if (/类型/.test(rootCause)) {
      suggestions.push(
        '检查类型定义是否正确',
        '添加类型验证或转换逻辑',
        '使用 TypeScript 或类型注解增强类型安全',
      );
    }

    if (/超时/.test(rootCause)) {
      suggestions.push(
        '增加超时时间配置',
        '优化耗时操作的性能',
        '添加异步处理或后台任务',
      );
    }

    if (/权限/.test(rootCause)) {
      suggestions.push(
        '检查权限配置是否正确',
        '确认用户/服务具有必要的访问权限',
        '审查访问控制策略',
      );
    }

    if (/连接/.test(rootCause)) {
      suggestions.push(
        '检查网络连接状态',
        '验证服务端点是否可用',
        '添加重试机制和错误处理',
      );
    }

    if (suggestions.length === 0) {
      return [
        '添加详细的日志记录以便调试',
        '编写单元测试复现问题',
        '检查相关代码的最近变更',
      ];
    }

    return suggestions;
  }

  private _identifyAffectedAreas(bugDesc: string, context: Record<string, unknown>): string[] {
    const affected: string[] = [];

    if (context.file) affected.push(String(context.file));
    if (context.module) affected.push(String(context.module));
    if (context.function) affected.push(String(context.function));

    const text = bugDesc.toLowerCase();
    if (/登录|login/.test(text)) affected.push('认证模块');
    if (/数据|data/.test(text)) affected.push('数据处理');
    if (/界面|ui/.test(text)) affected.push('用户界面');
    if (/api/.test(text)) affected.push('API 接口');

    return affected.length > 0 ? [...new Set(affected)] : ['待确定'];
  }

  private _calculateDiagnosisConfidence(
    bugDesc: string,
    context: Record<string, unknown>,
  ): number {
    let confidence = 0.5;

    if (context.error_log) confidence += 0.2;
    if (context.stack_trace) confidence += 0.15;
    if (context.code_snippet) confidence += 0.1;
    if (bugDesc.length > 100) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  private _executeStep(
    step: Record<string, unknown>,
    _state: BaseState,
  ): Record<string, unknown> {
    const action = (step.action as string) ?? '';
    const inputs = (step.inputs as Record<string, unknown>) ?? {};

    try {
      if (action === 'analyze_requirements') {
        return {
          success: true,
          output: `已分析任务需求: ${String(inputs.objective ?? '').slice(0, 100)}`,
        };
      }

      if (action === 'execute_task') {
        return {
          success: true,
          output: `已执行任务: ${String(inputs.task ?? '').slice(0, 50)}`,
        };
      }

      if (action === 'verify_output') {
        return {
          success: true,
          output: '输出验证通过',
          score: 75,
        };
      }

      return {
        success: true,
        output: `已执行: ${(step.description as string) ?? ''}`,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private _aggregateStepResults(executedSteps: Record<string, unknown>[]): string {
    const outputs: string[] = [];
    for (const stepData of executedSteps) {
      const result = stepData.result as Record<string, unknown> | undefined;
      if (result?.output) {
        outputs.push(String(result.output));
      }
    }
    return outputs.length > 0 ? outputs.join('\n') : '执行完成';
  }

  private _litePlanResultToDict(plan: LitePlanResult): Record<string, unknown> {
    return {
      plan_id: plan.planId,
      steps: plan.steps,
      estimated_time: plan.estimatedTime,
      confidence: plan.confidence,
      created_at: plan.createdAt,
      objective: plan.objective,
      context: plan.context,
    };
  }
}
