/**
 * Revision Loop Module
 *
 * Implements Critic feedback-driven Writer revision loop.
 * Supports max-loop limit and human-intervention triggers.
 *
 * Migrated from src/workflow/revision_loop.py
 */

import type { QualityMode, QualityLevel } from './novel-state.js';
import {
  NOVEL_PASS_SCORE,
  NOVEL_MIN_C_SCORE,
  NOVEL_HUMAN_REVIEW_SCORE,
  NOVEL_SCORE_IMPROVEMENT_THRESHOLD,
} from './novel-state.js';
import { type ContentType as SessionContentType } from './session/session-manager.js';
import { createLogger } from '../logger/index.js';

const _log = createLogger('workflow-revision-loop');

// ============================================================
// Types
// ============================================================

export const QUALITY_LEVEL_ORDER: readonly QualityLevel[] = ['ultra', 'high', 'medium', 'fluent'] as const;

export enum RevisionDecision {
  APPROVED = 'APPROVED',
  REVISE = 'REVISE',
  REWRITE = 'REWRITE',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
}

// ============================================================
// RevisionConfig
// ============================================================

export interface RevisionConfig {
  max_revisions: number;
  pass_score: number;
  min_c_score: number;
  human_review_score: number;
  score_improvement_threshold: number;
  quality_mode: QualityMode;
  quality_level: QualityLevel;
  degrade_on_timeout: boolean;
  degrade_on_error: boolean;
  quality_phase_timeout_seconds: number;
}

export const DEFAULT_REVISION_CONFIG: RevisionConfig = {
  max_revisions: 3,
  pass_score: NOVEL_PASS_SCORE,
  min_c_score: NOVEL_MIN_C_SCORE,
  human_review_score: NOVEL_HUMAN_REVIEW_SCORE,
  score_improvement_threshold: NOVEL_SCORE_IMPROVEMENT_THRESHOLD,
  quality_mode: 'auto',
  quality_level: 'high',
  degrade_on_timeout: true,
  degrade_on_error: true,
  quality_phase_timeout_seconds: 30,
};

// ============================================================
// RevisionState
// ============================================================

export interface RevisionState {
  revision_count: number;
  current_score: number;
  previous_score: number;
  decision: RevisionDecision;
  feedback: string;
  history: Array<Record<string, unknown>>;
  stagnant_count: number;
  checkpoint_trace: Array<Record<string, unknown>>;
  last_checkpoint_id: string;
  quality_mode: QualityMode;
  requested_quality_level: QualityLevel;
  effective_quality_level: QualityLevel;
  degrade_reason: string;
  degrade_steps: Array<Record<string, unknown>>;
  feedback_artifacts: Array<Record<string, unknown>>;
}

function createRevisionState(
  qualityMode: QualityMode,
  requestedLevel: QualityLevel,
  effectiveLevel: QualityLevel,
): RevisionState {
  return {
    revision_count: 0,
    current_score: 0.0,
    previous_score: 0.0,
    decision: RevisionDecision.REVISE,
    feedback: '',
    history: [],
    stagnant_count: 0,
    checkpoint_trace: [],
    last_checkpoint_id: '',
    quality_mode: qualityMode,
    requested_quality_level: requestedLevel,
    effective_quality_level: effectiveLevel,
    degrade_reason: '',
    degrade_steps: [],
    feedback_artifacts: [],
  };
}

// ============================================================
// RevisionLoop class
// ============================================================

export class RevisionLoop {
  public config: RevisionConfig;
  public state: RevisionState;
  public checkpointStore: Record<string, unknown>;

  constructor(config?: Partial<RevisionConfig>, checkpointStore?: Record<string, unknown>) {
    this.config = { ...DEFAULT_REVISION_CONFIG, ...config };
    const normalizedLevel = RevisionLoop.normalizeQualityLevel(this.config.quality_level);
    this.state = createRevisionState(
      this.config.quality_mode,
      normalizedLevel,
      normalizedLevel,
    );
    this.checkpointStore = checkpointStore ?? {};
  }

  static normalizeQualityLevel(level: string): QualityLevel {
    if ((QUALITY_LEVEL_ORDER as readonly string[]).includes(level)) return level as QualityLevel;
    return 'high';
  }

  static nextQualityLevel(level: QualityLevel): QualityLevel {
    const index = QUALITY_LEVEL_ORDER.indexOf(level);
    if (index >= QUALITY_LEVEL_ORDER.length - 1) return level;
    return QUALITY_LEVEL_ORDER[index + 1];
  }

  private _recordDegradeStep(reason: string, phase: string): boolean {
    if (this.state.quality_mode !== 'auto') return false;

    const fromLevel = this.state.effective_quality_level;
    const toLevel = RevisionLoop.nextQualityLevel(fromLevel);
    if (toLevel === fromLevel) return false;

    this.state.effective_quality_level = toLevel;
    this.state.degrade_reason = reason;
    this.state.degrade_steps.push({
      from_level: fromLevel,
      to_level: toLevel,
      reason,
      phase,
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  handleRuntimeEvent(
    event: 'timeout' | 'error',
    phase: string,
    detail: string = '',
  ): boolean {
    if (event === 'timeout' && !this.config.degrade_on_timeout) return false;
    if (event === 'error' && !this.config.degrade_on_error) return false;

    let reason = `${event}:${phase}`;
    if (detail) reason = `${reason}:${detail}`;
    return this._recordDegradeStep(reason, phase);
  }

  shouldContinue(): boolean {
    if (this.state.decision === RevisionDecision.APPROVED) return false;
    if (this.state.decision === RevisionDecision.HUMAN_REVIEW) return false;
    if (this.state.revision_count >= this.config.max_revisions) return false;
    if (this.state.stagnant_count >= 2) return false;
    return true;
  }

  // -----------------------------------------------
  // Checkpoint helpers
  // -----------------------------------------------

  private _buildRoundIdentifier(): string {
    return `round-${this.state.revision_count}`;
  }

  private _buildCheckpointArtifact(
    roundIdentifier: string,
    criticResult: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      checkpoint_id: `revision-${roundIdentifier}`,
      revision_count: this.state.revision_count,
      round_identifier: roundIdentifier,
      step_id: roundIdentifier,
      stage: 'critic',
      decision: this.state.decision,
      score: this.state.current_score,
      previous_score: this.state.previous_score,
      stagnant_count: this.state.stagnant_count,
      session_id: String(criticResult['session_id'] ?? ''),
      trace: {
        state_trace_id: `${roundIdentifier}:${this.state.current_score}`,
        revision_checkpoint_id: `revision-${roundIdentifier}`,
      },
    };
  }

  private _persistCheckpointArtifact(artifact: Record<string, unknown>): string {
    const checkpointId = String(artifact['checkpoint_id'] ?? '');
    if (!checkpointId) return '';

    this.checkpointStore[checkpointId] = artifact;
    this.state.last_checkpoint_id = checkpointId;
    this.state.checkpoint_trace.push({
      checkpoint_id: checkpointId,
      step_id: String(artifact['step_id'] ?? ''),
      stage: String(artifact['stage'] ?? 'critic'),
      round_identifier: String(artifact['round_identifier'] ?? ''),
    });

    return checkpointId;
  }

  // -----------------------------------------------
  // Feedback artifact helpers
  // -----------------------------------------------

  private _normalizeSeverity(priority: string): string {
    const normalized = (priority ?? '').trim().toLowerCase();
    if (normalized === 'high' || normalized === 'critical') return 'high';
    if (normalized === 'medium' || normalized === 'med') return 'medium';
    if (normalized === 'low' || normalized === 'minor') return 'low';
    return 'medium';
  }

  private _inferScope(anchor: string): string {
    const token = (anchor ?? '').toLowerCase();
    if (token.includes('scene') || token.includes('\u573a\u666f')) return 'scene';
    return 'chapter';
  }

  private _buildFeedbackArtifacts(
    roundIdentifier: string,
    criticResult: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const instructions = criticResult['revision_instructions'];
    const actionableFeedback = String(criticResult['actionable_feedback'] ?? '').trim();

    const artifacts: Array<Record<string, unknown>> = [];

    if (Array.isArray(instructions) && instructions.length > 0) {
      instructions.forEach((item: unknown, index: number) => {
        if (typeof item !== 'object' || item === null) return;
        const entry = item as Record<string, unknown>;

        const anchor = String(entry['target'] ?? '').trim() || `chapter-${this.state.revision_count}`;
        const issue = String(entry['issue'] ?? '').trim() || 'unspecified issue';
        const recommendation = String(entry['suggestion'] ?? '').trim() || actionableFeedback || 'revise content';
        const priority = String(entry['priority'] ?? 'medium');
        const severity = this._normalizeSeverity(priority);

        artifacts.push({
          feedback_id: `feedback-${roundIdentifier}-${index + 1}`,
          round_id: roundIdentifier,
          scope: this._inferScope(anchor),
          anchor,
          severity,
          issue,
          recommendation,
          source: 'critic',
        });
      });
    }

    if (artifacts.length === 0) {
      const defaultAnchor = `chapter-${this.state.revision_count}`;
      const defaultIssue = actionableFeedback || 'quality improvement needed';
      artifacts.push({
        feedback_id: `feedback-${roundIdentifier}-1`,
        round_id: roundIdentifier,
        scope: 'chapter',
        anchor: defaultAnchor,
        severity: 'medium',
        issue: defaultIssue,
        recommendation: actionableFeedback || 'revise according to critic feedback',
        source: 'critic',
      });
    }

    return artifacts;
  }

  // -----------------------------------------------
  // Core update logic
  // -----------------------------------------------

  updateFromCritic(criticResult: Record<string, unknown>): RevisionDecision {
    this.state.previous_score = this.state.current_score;
    this.state.current_score = typeof criticResult['total_score'] === 'number'
      ? criticResult['total_score'] as number
      : 0;
    this.state.revision_count += 1;

    const rawDecision = String(criticResult['decision'] ?? 'REVISE');
    this.state.feedback = String(criticResult['actionable_feedback'] ?? '');

    // Record history
    this.state.history.push({
      revision: this.state.revision_count,
      score: this.state.current_score,
      decision: rawDecision,
      feedback_preview: this.state.feedback ? this.state.feedback.substring(0, 100) : '',
    });

    // Check score improvement
    const scoreImprovement = this.state.current_score - this.state.previous_score;
    if (this.state.revision_count > 1 && scoreImprovement < this.config.score_improvement_threshold) {
      this.state.stagnant_count += 1;
    } else {
      this.state.stagnant_count = 0;
    }

    // Determine final decision
    const decision = this._determineDecision(rawDecision, criticResult);
    this.state.decision = decision;

    const roundIdentifier = this._buildRoundIdentifier();
    const artifact = this._buildCheckpointArtifact(roundIdentifier, criticResult);
    this._persistCheckpointArtifact(artifact);
    this.state.feedback_artifacts = this._buildFeedbackArtifacts(roundIdentifier, criticResult);

    return decision;
  }

  private _determineDecision(
    rawDecision: string,
    criticResult: Record<string, unknown>,
  ): RevisionDecision {
    const score = this.state.current_score;

    // Check LOCK analysis C score
    const lockAnalysis = criticResult['lock_analysis'] as Record<string, unknown> | undefined;
    let cScore = 10;  // Default full score
    if (lockAnalysis && typeof lockAnalysis === 'object') {
      const cData = lockAnalysis['C'] as Record<string, unknown> | undefined;
      if (cData && typeof cData === 'object') {
        cScore = typeof cData['score'] === 'number' ? cData['score'] : 10;
      }
    }

    // Decision logic
    if (rawDecision === 'APPROVED') {
      if (score >= this.config.pass_score && cScore >= this.config.min_c_score) {
        return RevisionDecision.APPROVED;
      }
      return RevisionDecision.REVISE;
    }

    if (rawDecision === 'REWRITE') {
      if (this.state.revision_count >= this.config.max_revisions) {
        return RevisionDecision.HUMAN_REVIEW;
      }
      return RevisionDecision.REWRITE;
    }

    if (rawDecision === 'HUMAN_REVIEW') {
      return RevisionDecision.HUMAN_REVIEW;
    }

    // REVISE case
    if (this.state.revision_count >= this.config.max_revisions) {
      return RevisionDecision.HUMAN_REVIEW;
    }

    if (this.state.stagnant_count >= 2) {
      return RevisionDecision.HUMAN_REVIEW;
    }

    return RevisionDecision.REVISE;
  }

  // -----------------------------------------------
  // Feedback / summary accessors
  // -----------------------------------------------

  getFeedbackForWriter(): Record<string, unknown> {
    return {
      feedback: this.state.feedback,
      revision_count: this.state.revision_count,
      previous_score: this.state.previous_score,
      current_score: this.state.current_score,
      history: this.state.history,
      last_checkpoint_id: this.state.last_checkpoint_id,
      checkpoint_trace: this.state.checkpoint_trace,
      quality_mode: this.state.quality_mode,
      requested_quality_level: this.state.requested_quality_level,
      effective_quality_level: this.state.effective_quality_level,
      degrade_reason: this.state.degrade_reason,
      degrade_steps: this.state.degrade_steps,
      feedback_artifacts: this.state.feedback_artifacts,
    };
  }

  getSummary(): Record<string, unknown> {
    return {
      total_revisions: this.state.revision_count,
      final_score: this.state.current_score,
      final_decision: this.state.decision,
      score_trend: (this.state.history as Array<Record<string, unknown>>).map(h => h.score),
      stagnant_count: this.state.stagnant_count,
      history: this.state.history,
      last_checkpoint_id: this.state.last_checkpoint_id,
      checkpoint_trace: this.state.checkpoint_trace,
      quality_mode: this.state.quality_mode,
      requested_quality_level: this.state.requested_quality_level,
      effective_quality_level: this.state.effective_quality_level,
      degrade_reason: this.state.degrade_reason,
      degrade_steps: this.state.degrade_steps,
      feedback_artifacts: this.state.feedback_artifacts,
    };
  }

  reset(): void {
    const normalizedLevel = RevisionLoop.normalizeQualityLevel(this.config.quality_level);
    this.state = createRevisionState(
      this.config.quality_mode,
      normalizedLevel,
      normalizedLevel,
    );
  }
}

// ============================================================
// Feedback artifact envelope builder
// ============================================================

export function buildFeedbackArtifactEnvelope(
  feedbackArtifacts: Array<Record<string, unknown>>,
  sessionId: string,
  runId: string,
  revisionId: string,
  evidenceLinks: string[],
): Record<string, unknown> {
  return {
    artifact_type: 'quality_feedback',
    schema_version: 'evidence.v1',
    date: new Date().toISOString().split('T')[0],
    owner: 'revision_loop',
    input: {
      session_id: sessionId,
      run_id: runId,
      revision_id: revisionId,
    },
    output: {
      feedback_artifacts: feedbackArtifacts,
      count: feedbackArtifacts.length,
    },
    result: 'PASS',
    evidence_links: evidenceLinks,
    trace: {
      session_id: sessionId,
      run_id: runId,
      revision_id: revisionId,
    },
  };
}

// ============================================================
// Session manager (real service from session/session-manager.ts)
// ============================================================

export type ContentType = SessionContentType;

export interface ISessionManager {
  readonly activePath: string;
  readonly archivedPath: string;
  init(options: { sessionId: string; sessionType: string; projectName: string; domain: string }): void;
  write(options: { sessionId: string; contentType: ContentType; content: string; id: string }): void;
  resolvePath(options: { sessionId: string; contentType: ContentType; id: string }): string;
}

// ============================================================
// runRevisionLoop - Top-level async loop
// ============================================================

export type WriterFn = (draft: string, feedback: Record<string, unknown>) => Promise<string>;
export type CriticFn = (draft: string, sceneCard: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface RunRevisionLoopOptions {
  draft: string;
  sceneCard: Record<string, unknown>;
  writerFn: WriterFn;
  criticFn: CriticFn;
  config?: Partial<RevisionConfig>;
  verbose?: boolean;
  checkpointStore?: Record<string, unknown>;
  checkpointBasePath?: string;
  sessionId?: string;
  sessionManager?: ISessionManager;
}

export async function runRevisionLoop(options: RunRevisionLoopOptions): Promise<Record<string, unknown>> {
  const {
    draft,
    sceneCard,
    writerFn,
    criticFn,
    verbose = true,
    checkpointStore,
    checkpointBasePath,
    sessionId,
    sessionManager,
  } = options;

  const loop = new RevisionLoop(options.config, checkpointStore);
  let currentDraft = draft;

  // Session init (mirrors Python behavior)
  if (sessionManager && sessionId) {
    const activePath = `${sessionManager.activePath}/${sessionId}`;
    const archivedPath = `${sessionManager.archivedPath}/${sessionId}`;
    // In Node.js we skip the filesystem exists check here; the session manager
    // implementation should handle idempotent init.
  }

  while (true) {
    // Evaluate current draft
    if (verbose) {
      _log.info(`\n\uD83E\uDDD0 \u7B2C ${loop.state.revision_count + 1} \u6B21\u8BC4\u4F30...`);
    }

    try {
      const timeoutSeconds = Math.max(loop.config.quality_phase_timeout_seconds, 0);
      let criticResult: Record<string, unknown>;

      if (timeoutSeconds > 0) {
        criticResult = await Promise.race([
          criticFn(currentDraft, sceneCard),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TimeoutError')), timeoutSeconds * 1000),
          ),
        ]);
      } else {
        criticResult = await criticFn(currentDraft, sceneCard);
      }

      if (sessionId && typeof criticResult === 'object' && !criticResult['session_id']) {
        criticResult = { ...criticResult, session_id: sessionId };
      }

      const decision = loop.updateFromCritic(criticResult);

      if (verbose) {
        _log.info(`   \u5206\u6570: ${loop.state.current_score.toFixed(1)}`);
        _log.info(`   \u51B3\u7B56: ${decision}`);
      }

      // Check whether to continue
      if (!loop.shouldContinue()) break;

      // Get feedback and revise
      const feedback = loop.getFeedbackForWriter();

      if (verbose) {
        _log.info(`\n\u270D\uFE0F \u7B2C ${loop.state.revision_count} \u6B21\u4FEE\u8BA2...`);
      }

      try {
        const writerTimeout = Math.max(loop.config.quality_phase_timeout_seconds, 0);
        if (writerTimeout > 0) {
          currentDraft = await Promise.race([
            writerFn(currentDraft, feedback),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('TimeoutError')), writerTimeout * 1000),
            ),
          ]);
        } else {
          currentDraft = await writerFn(currentDraft, feedback);
        }
      } catch (exc) {
        const errorMsg = exc instanceof Error ? exc.message : String(exc);
        const isTimeout = errorMsg === 'TimeoutError';

        if (isTimeout) {
          const degraded = loop.handleRuntimeEvent('timeout', 'writer');
          if (degraded) {
            if (verbose) {
              _log.info(`   \u8D28\u91CF\u964D\u7EA7: writer timeout -> ${loop.state.effective_quality_level}`);
            }
            continue;
          }
          loop.state.decision = RevisionDecision.HUMAN_REVIEW;
          loop.state.degrade_reason = 'timeout:writer';
          break;
        } else {
          const detail = exc instanceof Error ? exc.constructor.name : 'UnknownError';
          const degraded = loop.handleRuntimeEvent('error', 'writer', detail);
          if (degraded) {
            if (verbose) {
              _log.info(`   \u8D28\u91CF\u964D\u7EA7: writer error -> ${loop.state.effective_quality_level}`);
            }
            continue;
          }
          loop.state.decision = RevisionDecision.HUMAN_REVIEW;
          loop.state.degrade_reason = `error:writer:${detail}`;
          break;
        }
      }
    } catch (exc) {
      const errorMsg = exc instanceof Error ? exc.message : String(exc);
      const isTimeout = errorMsg === 'TimeoutError';

      if (isTimeout) {
        const degraded = loop.handleRuntimeEvent('timeout', 'critic');
        if (degraded) {
          if (verbose) {
            _log.info(`   \u8D28\u91CF\u964D\u7EA7: critic timeout -> ${loop.state.effective_quality_level}`);
          }
          continue;
        }
        loop.state.decision = RevisionDecision.HUMAN_REVIEW;
        loop.state.degrade_reason = 'timeout:critic';
        break;
      } else {
        const detail = exc instanceof Error ? exc.constructor.name : 'UnknownError';
        const degraded = loop.handleRuntimeEvent('error', 'critic', detail);
        if (degraded) {
          if (verbose) {
            _log.info(`   \u8D28\u91CF\u964D\u7EA7: critic error -> ${loop.state.effective_quality_level}`);
          }
          continue;
        }
        loop.state.decision = RevisionDecision.HUMAN_REVIEW;
        loop.state.degrade_reason = `error:critic:${detail}`;
        break;
      }
    }
  }

  // Return result
  const summary = loop.getSummary();
  (summary as Record<string, unknown>)['final_draft'] = currentDraft;

  if (verbose) {
    _log.info(`\n${'='.repeat(50)}`);
    _log.info('\u4FEE\u8BA2\u5FAA\u73AF\u5B8C\u6210');
    _log.info(`   \u603B\u4FEE\u8BA2\u6B21\u6570: ${summary.total_revisions}`);
    _log.info(`   \u6700\u7EC8\u5206\u6570: ${(summary.final_score as number).toFixed(1)}`);
    _log.info(`   \u6700\u7EC8\u51B3\u7B56: ${summary.final_decision}`);
    _log.info('='.repeat(50));
  }

  return summary;
}
