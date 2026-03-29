/**
 * level3-standard.ts - L3 Standard mode
 *
 * Full session, verification steps.
 * Suitable for: multi-chapter development, character development, feature development.
 *
 * Command chain:
 * plan -> plan-verify -> execute -> verify
 *
 * Migrated from src/workflow/levels/level3_standard.py
 */

import type { BaseState } from '../state.js';
import { AgentType } from '../../agents/base.js';
import type { IServiceContainer } from './level1-rapid.js';

// ============================================================
// Data types
// ============================================================

export interface PlanPhase {
  phase: number;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  output: string | null;
}

// ============================================================
// Level3Standard
// ============================================================

export class Level3Standard {
  readonly level = 3;
  readonly name = 'standard';
  readonly description = '標準模式 - 完整會話、驗證步驟';

  static readonly PLAN_PHASES: PlanPhase[] = [
    { phase: 1, name: '需求理解', description: '理解用戶需求，澄清模糊點', status: 'pending', output: null },
    { phase: 2, name: '內容分析', description: '分析已有章節、角色、世界觀', status: 'pending', output: null },
    { phase: 3, name: '變更範圍', description: '定義修改範圍，識別影響點', status: 'pending', output: null },
    { phase: 4, name: '實施計劃', description: '生成詳細執行步驟', status: 'pending', output: null },
    { phase: 5, name: '驗證定義', description: '定義驗收標準和測試用例', status: 'pending', output: null },
  ];

  protected config: Record<string, unknown>;
  protected _container: IServiceContainer | null;
  private _architect: { run(input: Record<string, unknown>): Record<string, unknown> } | null;
  private _writer: { run(input: Record<string, unknown>): Record<string, unknown> } | null;
  private _critic: { run(input: Record<string, unknown>): Record<string, unknown> } | null;

  constructor(
    options?: {
      config?: Record<string, unknown>;
      container?: IServiceContainer;
      architect?: { run(input: Record<string, unknown>): Record<string, unknown> };
      writer?: { run(input: Record<string, unknown>): Record<string, unknown> };
      critic?: { run(input: Record<string, unknown>): Record<string, unknown> };
    },
  ) {
    this.config = options?.config ?? {};
    this._container = options?.container ?? null;
    this._architect = options?.architect ?? null;
    this._writer = options?.writer ?? null;
    this._critic = options?.critic ?? null;
  }

  protected get container(): IServiceContainer {
    if (this._container == null) {
      throw new Error('ServiceContainer not available.');
    }
    return this._container;
  }

  private _getArchitect(): { run(input: Record<string, unknown>): Record<string, unknown> } {
    if (this._architect == null) {
      this._architect = this.container.getAgent(AgentType.ARCHITECT);
    }
    return this._architect;
  }

  private _getWriter(): { run(input: Record<string, unknown>): Record<string, unknown> } {
    if (this._writer == null) {
      this._writer = this.container.getAgent(AgentType.WRITER);
    }
    return this._writer;
  }

  private _getCritic(): { run(input: Record<string, unknown>): Record<string, unknown> } {
    if (this._critic == null) {
      this._critic = this.container.getAgent(AgentType.CRITIC);
    }
    return this._critic;
  }

  /**
   * Execute the standard workflow
   *
   * Flow:
   * 1. Plan: generate 5-phase plan
   * 2. Plan-Verify: verify plan completeness
   * 3. Execute: call Writer
   * 4. Critic: evaluate quality
   * 5. Loop until passed or max_revisions reached
   */
  execute(state: BaseState): BaseState {
    const config = { ...this.getDefaultConfig(), ...this.config };

    const maxRevisions = (config.max_revisions as number) ?? 3;
    const passScore = (config.pass_score as number) ?? 80; // L3 execution policy fallback, not novel publish threshold

    // Phase 1: plan
    state = this._planPhase(state);

    // Phase 2: plan verification
    if (!this._verifyPlan(state)) {
      state.errors = [...(state.errors ?? []), '計劃驗證失敗'];
      state.decision = 'HUMAN_REVIEW';
      return state;
    }

    // Phase 3-5: execution loop
    let revisionCount = 0;
    while (revisionCount < maxRevisions) {
      state = this._executePhase(state);
      state = this._criticPhase(state);

      const score = state.score ?? 0;
      const decision = state.decision ?? 'REVISE';

      if (decision === 'APPROVED' || score >= passScore) {
        state.decision = 'APPROVED';
        break;
      }

      if (decision === 'HUMAN_REVIEW') {
        break;
      }

      revisionCount++;
      state.revision_count = revisionCount;
    }

    if (revisionCount >= maxRevisions && state.decision !== 'APPROVED') {
      state.decision = 'HUMAN_REVIEW';
      state.requires_human_intervention = true;
    }

    return state;
  }

  getRequiredAgents(): string[] {
    return ['architect', 'writer', 'critic'];
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      max_revisions: 3,
      pass_score: 80,
      verbose: true,
      retrieval_profile: 'standard_balanced',
    };
  }

  // ========== Public API ==========

  plan(state: BaseState): PlanPhase[] {
    const updated = this._planPhase(state);
    return ((updated as Record<string, unknown>).plan_phases as PlanPhase[]) ?? Level3Standard.PLAN_PHASES;
  }

  planVerify(state: BaseState): { valid: boolean; missing: string[]; warnings: string[] } {
    return {
      valid: this._verifyPlan(state),
      missing: [],
      warnings: [],
    };
  }

  // ========== Internal phases ==========

  _planPhase(state: BaseState): BaseState {
    try {
      const architect = this._getArchitect();
      const result = architect.run({
        user_request: state.user_request ?? '',
        context: state.context ?? '',
        mode: 'planning',
      });

      (state as Record<string, unknown>).plan_phases = result.phases ?? Level3Standard.PLAN_PHASES;
      (state as Record<string, unknown>).implementation_plan = result.plan ?? {};
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), `計劃失敗: ${errorMsg}`];
      (state as Record<string, unknown>).plan_phases = Level3Standard.PLAN_PHASES;
    }

    return state;
  }

  _verifyPlan(state: BaseState): boolean {
    const plan = (state as Record<string, unknown>).implementation_plan;
    const phases = (state as Record<string, unknown>).plan_phases;

    if (!plan || !phases) return false;

    if (Array.isArray(phases)) {
      for (const phase of phases) {
        if (typeof phase === 'object' && phase !== null && !(phase as Record<string, unknown>).output) {
          return false;
        }
      }
    }

    return true;
  }

  _executePhase(state: BaseState): BaseState {
    try {
      const writer = this._getWriter();
      const result = writer.run({
        plan: (state as Record<string, unknown>).implementation_plan ?? {},
        context: state.context ?? '',
        feedback: ((state as Record<string, unknown>).feedback_context as string) ?? '',
        mode: 'execute',
      });

      state.draft_content = (result.content as string) ?? '';
      const draftVersion = ((state as Record<string, unknown>).draft_version as number) ?? 0;
      (state as Record<string, unknown>).draft_version = draftVersion + 1;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), `執行失敗: ${errorMsg}`];
    }

    return state;
  }

  _criticPhase(state: BaseState): BaseState {
    try {
      const critic = this._getCritic();
      const result = critic.run({
        content: state.draft_content ?? '',
        plan: (state as Record<string, unknown>).implementation_plan ?? {},
        mode: 'evaluate',
      });

      state.score = (result.score as number) ?? 0;
      state.decision = (result.decision as string) ?? 'REVISE';
      (state as Record<string, unknown>).feedback_context = (result.feedback as string) ?? '';
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), `評估失敗: ${errorMsg}`];
      state.decision = 'HUMAN_REVIEW';
    }

    return state;
  }
}
