/**
 * Workflow Gate Evaluator — 纯函数门控评估
 *
 * 参考 maestro-flow PhaseOrchestrator 的 evaluatePhaseGate 模式。
 * 在 workflow step 完成后检查质量条件，决定是否允许进入下一阶段。
 */

export interface PhaseGateInput {
  review?: {
    verdict?: string;
    findings_count?: number;
  };
  verification?: {
    status?: string;
    gaps?: Array<{ id?: string; severity?: string; description?: string }>;
  };
  validation?: {
    status?: string;
    test_coverage?: { statements?: number; branches?: number; functions?: number; lines?: number } | number | null;
  };
}

export interface GateResult {
  allowed: boolean;
  reasons: string[];
  overridable: boolean;
}

/**
 * 评估门控条件
 *
 * 三条规则（按严重程度）：
 * 1. 硬门控：review verdict = BLOCK → 不可覆盖
 * 2. 软门控：存在 high/critical verification gaps → 可 --force 覆盖
 * 3. 软门控：测试覆盖率 lines = 0 → 可 --force 覆盖
 */
export function evaluatePhaseGate(phase: PhaseGateInput): GateResult {
  const reasons: string[] = [];
  let hasHardBlock = false;

  // 规则 1: review verdict BLOCK (硬门控)
  if (phase.review?.verdict === 'BLOCK') {
    reasons.push(`Review verdict is BLOCK (${phase.review.findings_count ?? '?'} findings)`);
    hasHardBlock = true;
  }

  // 规则 2: high/critical verification gaps (软门控)
  if (phase.verification?.status === 'gaps_found') {
    const highGaps = (phase.verification.gaps ?? []).filter(
      g => g.severity === 'high' || g.severity === 'critical'
    );
    if (highGaps.length > 0) {
      reasons.push(`${highGaps.length} high/critical verification gap(s)`);
    }
  }

  // 规则 3: 零测试覆盖率 (软门控)
  if (phase.validation?.test_coverage != null && typeof phase.validation.test_coverage === 'object') {
    if (phase.validation.test_coverage.lines === 0) {
      reasons.push('Test coverage is 0% (lines)');
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    overridable: !hasHardBlock,
  };
}

/**
 * Fix-Retry 常量
 */
export const MAX_FIX_ATTEMPTS = 3;

/**
 * TeamPhase 状态机
 */
export enum TeamPhase {
  planning = 'planning',
  execution = 'execution',
  review = 'review',
  verification = 'verification',
  fix = 'fix',
  complete = 'complete',
}

export const TEAM_TRANSITIONS: ReadonlyMap<TeamPhase, readonly { to: TeamPhase; maxRetries: number | null }[]> = new Map([
  [TeamPhase.planning,    [{ to: TeamPhase.execution, maxRetries: null }]],
  [TeamPhase.execution,   [{ to: TeamPhase.review, maxRetries: null }]],
  [TeamPhase.review,      [{ to: TeamPhase.verification, maxRetries: null }]],
  [TeamPhase.verification, [{ to: TeamPhase.complete, maxRetries: null }, { to: TeamPhase.fix, maxRetries: null }]],
  [TeamPhase.fix,         [{ to: TeamPhase.review, maxRetries: MAX_FIX_ATTEMPTS }]],
  [TeamPhase.complete,    []],
]);

export interface PhaseTransitionRecord {
  from: TeamPhase;
  to: TeamPhase;
  timestamp: string;
  trigger: string;
  force: boolean;
  gateReasons: string[];
}

export interface TransitionResult {
  success: boolean;
  from: TeamPhase;
  to: TeamPhase;
  fixAttempts: number;
  forcedComplete?: boolean;
  gateReasons: string[];
}
