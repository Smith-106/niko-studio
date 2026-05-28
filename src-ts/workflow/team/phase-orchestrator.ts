/**
 * PhaseOrchestrator — workflow 阶段编排器
 *
 * 参考 maestro-flow 的 PhaseOrchestrator，管理 TeamPhase 状态转换、
 * gate 评估和 fix-retry 循环。
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IWebSocketRelayService } from '../../container/types';
import {
  evaluatePhaseGate,
  MAX_FIX_ATTEMPTS,
  TeamPhase,
  TEAM_TRANSITIONS,
  type PhaseGateInput,
  type GateResult,
  type PhaseTransitionRecord,
  type TransitionResult,
} from './phase-gate-evaluator.js';
import { createLogger } from '../../logger/index.js';

const _log = createLogger('phase-orchestrator');

export class PhaseOrchestrator {
  private _phase: TeamPhase;
  private _fixAttempts = 0;
  private _history: PhaseTransitionRecord[] = [];
  private _jsonlPath: string | null;
  private readonly _relay: IWebSocketRelayService | null;

  constructor(initialPhase: TeamPhase = TeamPhase.planning, jsonlDir?: string, relay?: IWebSocketRelayService) {
    this._phase = initialPhase;
    this._jsonlPath = jsonlDir ? join(jsonlDir, 'phase-transitions.jsonl') : null;
    this._relay = relay ?? null;

    if (this._jsonlPath) {
      const dir = join(this._jsonlPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  get phase(): TeamPhase {
    return this._phase;
  }

  get fixAttempts(): number {
    return this._fixAttempts;
  }

  get history(): readonly PhaseTransitionRecord[] {
    return this._history;
  }

  /**
   * 尝试推进到下一阶段
   *
   * @returns TransitionResult — 包含是否成功、gate 原因、fix 次数等
   */
  advance(gateInput: PhaseGateInput, force = false): TransitionResult {
    const gate = evaluatePhaseGate(gateInput);
    const transitions = TEAM_TRANSITIONS.get(this._phase) ?? [];

    // 找到目标阶段
    let target: TeamPhase | null = null;

    if (gate.allowed || (gate.overridable && force)) {
      // gate 通过或强制覆盖 → 选第一个非 fix 的转换
      const nonFix = transitions.find(t => t.to !== TeamPhase.fix);
      target = nonFix?.to ?? transitions[0]?.to ?? null;
    } else if (!gate.allowed && !gate.overridable) {
      // 硬门控 — 不允许推进
      return {
        success: false,
        from: this._phase,
        to: this._phase,
        fixAttempts: this._fixAttempts,
        gateReasons: gate.reasons,
      };
    } else {
      // 软门控但未 force → 进入 fix
      const fixTransition = transitions.find(t => t.to === TeamPhase.fix);
      target = fixTransition?.to ?? null;

      if (target === TeamPhase.fix && this._fixAttempts >= MAX_FIX_ATTEMPTS) {
        // fix 次数耗尽 → 强制完成（降级）
        _log.warn('Fix attempts exhausted, forcing completion', {
          attempts: this._fixAttempts,
          phase: this._phase,
          reasons: gate.reasons,
        });

        const record = this._recordTransition(this._phase, TeamPhase.complete, 'fix-exhausted', true, gate.reasons);
        this._phase = TeamPhase.complete;
        this._persistRecord(record);

        return {
          success: true,
          from: record.from,
          to: TeamPhase.complete,
          fixAttempts: this._fixAttempts,
          forcedComplete: true,
          gateReasons: gate.reasons,
        };
      }
    }

    if (!target) {
      return {
        success: false,
        from: this._phase,
        to: this._phase,
        fixAttempts: this._fixAttempts,
        gateReasons: gate.reasons,
      };
    }

    // 执行转换
    if (target === TeamPhase.fix) {
      this._fixAttempts += 1;
    } else if (target === TeamPhase.complete) {
      // Complete is terminal — reset fixAttempts
      this._fixAttempts = 0;
    }
    // Note: fix→review and review→verification do NOT reset fixAttempts.
    // Fix-retry exhaustion is tracked as total fix cycles in the current verification loop.
    // Only reaching complete (gate fully passes) clears the count.

    const trigger = gate.allowed ? 'gate-passed' : (force ? 'force-override' : 'gate-failed-fix');
    const record = this._recordTransition(this._phase, target, trigger, force, gate.reasons);
    this._phase = target;
    this._persistRecord(record);

    return {
      success: true,
      from: record.from,
      to: target,
      fixAttempts: this._fixAttempts,
      forcedComplete: target === TeamPhase.complete && !gate.allowed,
      gateReasons: gate.reasons,
    };
  }

  /**
   * 重置到初始阶段
   */
  reset(phase: TeamPhase = TeamPhase.planning): void {
    this._phase = phase;
    this._fixAttempts = 0;
    this._history = [];
  }

  private _recordTransition(
    from: TeamPhase,
    to: TeamPhase,
    trigger: string,
    force: boolean,
    gateReasons: string[],
  ): PhaseTransitionRecord {
    const record: PhaseTransitionRecord = {
      from,
      to,
      timestamp: new Date().toISOString(),
      trigger,
      force,
      gateReasons,
    };
    this._history.push(record);
    return record;
  }

  private _persistRecord(record: PhaseTransitionRecord): void {
    if (!this._jsonlPath) return;
    try {
      appendFileSync(this._jsonlPath, JSON.stringify(record) + '\n', 'utf-8');
    } catch (err) {
      _log.warn('Failed to persist transition record', { error: String(err) });
    }
  }
}
