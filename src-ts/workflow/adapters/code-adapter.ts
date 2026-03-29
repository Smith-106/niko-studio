/**
 * Code Domain Adapter
 *
 * Implements a practical code workflow:
 * planner -> coder -> evaluator -> finalize.
 *
 * Migrated from src/workflow/adapters/code_adapter.py
 */

import {
  BaseDomainAdapter,
  AdapterRegistry,
  type BaseEvaluationResult,
} from './base-adapter';
import type { BaseState } from '../state';
import { createBaseState } from '../state';

export class CodeAdapter extends BaseDomainAdapter {

  getDomainType(): string {
    return 'code';
  }

  getStateClass(): new (...args: unknown[]) => BaseState {
    return class {} as new (...args: unknown[]) => BaseState;
  }

  createInitialState(userRequest: string, extra: Record<string, unknown> = {}): BaseState {
    let metadata = (extra['metadata'] as Record<string, unknown>) ?? {};
    const resumeDecision = extra['resume_decision'];
    if (resumeDecision) {
      metadata = { ...metadata, resume_decision: resumeDecision };
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extra)) {
      if (key !== 'metadata' && key !== 'resume_decision') {
        filtered[key] = value;
      }
    }

    return createBaseState(userRequest, {
      domain: 'code',
      metadata,
      ...filtered,
    });
  }

  evaluate(state: BaseState): BaseEvaluationResult {
    const configAny = this.config as Record<string, unknown>;
    const passScore = Number(configAny['pass_score'] ?? 80);
    const coverageThreshold = Number(configAny['code_coverage_threshold'] ?? 80);
    const maxRevisions = Number(configAny['max_revisions'] ?? 3);

    const testsPassed = this._resolveBoolSignal(state, 'tests_passed');
    const lintPassed = this._resolveBoolSignal(state, 'lint_passed');
    const buildPassed = this._resolveBoolSignal(state, 'build_passed');
    const coverage = this._resolveCoverage(state);

    const dimensionScores: Record<string, number> = {
      tests: CodeAdapter._scoreBinarySignal(testsPassed, 35.0, 18.0),
      lint: CodeAdapter._scoreBinarySignal(lintPassed, 20.0, 10.0),
      build: CodeAdapter._scoreBinarySignal(buildPassed, 25.0, 12.0),
      coverage: CodeAdapter._scoreCoverage(coverage),
    };
    const totalScore = Math.round(
      Object.values(dimensionScores).reduce((a, b) => a + b, 0) * 100,
    ) / 100;

    const stateAny = state as Record<string, unknown>;
    const errors = ((stateAny['errors'] as string[]) ?? []);
    const revisionCount = Number(stateAny['revision_count'] ?? 0);
    const coverageBelowThreshold = coverage !== null && coverage < coverageThreshold;

    const blockingReasons: string[] = [];
    const revisionInstructions: Array<Record<string, string>> = [];

    if (errors.length > 0) {
      blockingReasons.push('runtime_or_execution_errors');
      revisionInstructions.push({
        target: 'error',
        issue: 'Resolve execution/runtime errors first',
        action: 'Inspect errors and fix root causes before next evaluation',
      });
    }

    if (testsPassed === false) {
      blockingReasons.push('tests_failed');
      revisionInstructions.push({
        target: 'tests',
        issue: 'Tests are failing',
        action: 'Fix failing tests and keep regression suite green',
      });
    }

    if (lintPassed === false) {
      blockingReasons.push('lint_failed');
      revisionInstructions.push({
        target: 'lint',
        issue: 'Lint checks are failing',
        action: 'Apply lint fixes and formatting before merge',
      });
    }

    if (buildPassed === false) {
      blockingReasons.push('build_failed');
      revisionInstructions.push({
        target: 'build',
        issue: 'Build checks are failing',
        action: 'Fix build breakages and verify clean build',
      });
    }

    if (coverageBelowThreshold) {
      blockingReasons.push('coverage_below_threshold');
      revisionInstructions.push({
        target: 'coverage',
        issue: `Coverage ${coverage!.toFixed(2)}% below ${coverageThreshold.toFixed(2)}%`,
        action: 'Add/adjust tests to satisfy coverage threshold',
      });
    }

    let decision: string;
    let decisionReason: string;

    if (blockingReasons.length > 0) {
      if (revisionCount >= maxRevisions) {
        decision = 'HUMAN_REVIEW';
        decisionReason =
          `Blocking checks still failing after ${revisionCount} revisions: ` +
          `${blockingReasons.join(', ')}`;
      } else {
        decision = 'REVISE';
        decisionReason = `Blocking checks failed: ${blockingReasons.join(', ')}`;
      }
    } else if (totalScore >= passScore) {
      decision = 'APPROVED';
      decisionReason = `Code quality gates passed (score=${totalScore.toFixed(2)})`;
    } else {
      decision = 'REVISE';
      decisionReason = `Quality score ${totalScore.toFixed(2)} below pass score ${passScore.toFixed(2)}`;
    }

    const feedback =
      `Code evaluation completed: ` +
      `tests=${testsPassed}, lint=${lintPassed}, build=${buildPassed}, coverage=${coverage}`;

    return {
      decision,
      decision_reason: decisionReason,
      total_score: totalScore,
      dimension_scores: dimensionScores,
      feedback,
      revision_instructions: revisionInstructions,
    };
  }

  createGraph(): import('./base-adapter').IWorkflowGraph {
    const { SimpleWorkflowGraph } = require('../graph');
    const graph = new SimpleWorkflowGraph();

    graph.addNode('planner', this._plannerNode.bind(this));
    graph.addNode('coder', this._coderNode.bind(this));
    graph.addNode('evaluator', this._evaluatorNode.bind(this));
    graph.addNode('finalize', this._finalizeNode.bind(this));

    graph.setEntryPoint('planner');
    graph.addEdge('planner', 'coder');
    graph.addEdge('coder', 'evaluator');
    graph.addEdge('evaluator', 'finalize');

    return graph;
  }

  // --- Node implementations ---

  private async _plannerNode(state: BaseState): Promise<BaseState> {
    const stateAny = state as Record<string, unknown>;
    const userRequest = (stateAny['user_request'] as string) ?? '';
    const plan = [
      'Analyze requirements and constraints',
      'Implement code changes',
      'Run tests/lint/build/coverage checks',
      'Prepare final output and decision',
    ];
    return { ...state, current_step: 'planner', context: `Code task: ${userRequest}`, implementation_plan: plan } as BaseState;
  }

  private async _coderNode(state: BaseState): Promise<BaseState> {
    const stateAny = state as Record<string, unknown>;
    const metadata = (stateAny['metadata'] as Record<string, unknown>) ?? {};
    let changeSummary = metadata['change_summary'] as string | undefined;
    if (!changeSummary) {
      changeSummary = `Implement request: ${(stateAny['user_request'] as string) ?? ''}`;
    }

    return {
      ...state,
      current_step: 'coder',
      draft_content: changeSummary,
      iteration_count: Number(stateAny['iteration_count'] ?? 0) + 1,
    } as BaseState;
  }

  private async _evaluatorNode(state: BaseState): Promise<BaseState> {
    const evaluation = this.evaluate(state);
    const stateAny = state as Record<string, unknown>;
    const metadata = { ...((stateAny['metadata'] as Record<string, unknown>) ?? {}) };
    metadata['quality_assessment'] = {
      total_score: evaluation.total_score,
      dimension_scores: evaluation.dimension_scores,
    };

    return {
      ...state,
      current_step: 'evaluator',
      decision: evaluation.decision,
      decision_reason: evaluation.decision_reason,
      score: evaluation.total_score,
      feedback_context: evaluation.feedback,
      revision_instructions: evaluation.revision_instructions,
      metadata,
    } as BaseState;
  }

  private async _finalizeNode(state: BaseState): Promise<BaseState> {
    const stateAny = state as Record<string, unknown>;
    const decision = (stateAny['decision'] as string) ?? 'REVISE';
    const approved = decision === 'APPROVED';
    return {
      ...state,
      current_step: 'finalize',
      requires_human_intervention: decision === 'HUMAN_REVIEW',
      final_output: approved
        ? (stateAny['draft_content'] as string) ?? ''
        : (stateAny['final_output'] as string) ?? '',
    } as BaseState;
  }

  // --- Signal resolution helpers ---

  private _resolveBoolSignal(state: BaseState, key: string): boolean | null {
    const stateAny = state as Record<string, unknown>;
    let value: unknown = stateAny[key];

    if (value === undefined) {
      const metadata = (stateAny['metadata'] as Record<string, unknown>) ?? {};
      const qualitySignals = typeof metadata['quality_signals'] === 'object' && metadata['quality_signals'] !== null
        ? (metadata['quality_signals'] as Record<string, unknown>)
        : null;
      if (qualitySignals && key in qualitySignals) {
        value = qualitySignals[key];
      } else if (typeof metadata === 'object' && key in metadata) {
        value = metadata[key];
      }
    }

    return CodeAdapter._toOptionalBool(value);
  }

  private _resolveCoverage(state: BaseState): number | null {
    const stateAny = state as Record<string, unknown>;
    const coverageKeys = ['coverage', 'coverage_pct', 'coverage_percent'];
    const metadata = (stateAny['metadata'] as Record<string, unknown>) ?? {};
    const qualitySignals = typeof metadata['quality_signals'] === 'object' && metadata['quality_signals'] !== null
      ? (metadata['quality_signals'] as Record<string, unknown>)
      : null;

    let value: unknown = undefined;
    for (const key of coverageKeys) {
      if (key in stateAny) { value = stateAny[key]; break; }
      if (qualitySignals && key in qualitySignals) { value = qualitySignals[key]; break; }
      if (typeof metadata === 'object' && key in metadata) { value = metadata[key]; break; }
    }

    if (value === undefined || value === null) return null;
    if (typeof value === 'string') value = value.trim().replace(/%$/, '');
    const coverage = Number(value);
    if (isNaN(coverage)) return null;
    return Math.max(0.0, Math.min(coverage, 100.0));
  }

  private static _toOptionalBool(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Boolean(value);
    if (typeof value === 'string') {
      const n = value.trim().toLowerCase();
      if (['true', 'pass', 'passed', 'yes', 'y', '1'].includes(n)) return true;
      if (['false', 'fail', 'failed', 'no', 'n', '0'].includes(n)) return false;
    }
    return null;
  }

  private static _scoreBinarySignal(signal: boolean | null, passScore: number, unknownScore: number): number {
    if (signal === true) return passScore;
    if (signal === false) return 0.0;
    return unknownScore;
  }

  private static _scoreCoverage(coverage: number | null): number {
    if (coverage === null) return 8.0;
    return Math.round((coverage / 100.0) * 20.0 * 100) / 100;
  }
}

// Auto-register
AdapterRegistry.registerAdapter('code', CodeAdapter, ['strict-governance', 'cli-exposed']);
