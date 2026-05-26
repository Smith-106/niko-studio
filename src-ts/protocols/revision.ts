/**
 * Revision Service Protocol
 *
 * Defines the contract for the intelligent revision service.
 * Integrates Critic-driven multi-round revision with cross-iteration learning.
 */

import type {
  RevisionDimension,
  RevisionDimensionReport,
  RevisionAnalysisResult,
  WeakPoint,
  RevisionSuggestion,
  RevisionComparison,
  RevisionSession,
  RevisionIteration,
} from '../workflow/revision-session';

import type { RevisionDecision, RevisionConfig } from '../workflow/revision-loop';

// ============================================================
// Protocol interfaces
// ============================================================

/**
 * Cross-iteration learning result — insights accumulated from
 * comparing revision outcomes across multiple iterations.
 */
export interface RevisionLearningInsight {
  dimensionId: RevisionDimension;
  averageBaselineScore: number;
  averageDelta: number;
  occurrences: number;
  trend: 'improving' | 'stable' | 'declining';
  evidence: string[];
}

/**
 * Result of a full multi-pass revision cycle.
 */
export interface RevisionCycleResult {
  sessionId: string;
  finalDraft: string;
  finalDecision: RevisionDecision;
  finalScore: number;
  totalIterations: number;
  iterations: RevisionIteration[];
  learningInsights: RevisionLearningInsight[];
  comparison?: RevisionComparison;
}

/**
 * IRevisionService — Protocol for the intelligent revision service.
 *
 * Activates the Critic-driven revision loop, supports multi-round
 * revision with cross-iteration learning, and integrates with
 * the existing revision session lifecycle.
 */
export interface IRevisionService {
  /**
   * Initialize the revision service.
   */
  initialize(): Promise<void>;

  /**
   * Run a full multi-pass revision cycle on the given text.
   * Uses the Critic engine for evaluation and the Writer for revision.
   * The loop continues until the text passes quality threshold or
   * max iterations are reached.
   *
   * @param text - The text to revise
   * @param config - Optional revision configuration overrides
   * @param chapterId - Optional chapter identifier for session tracking
   */
  revise(
    text: string,
    config?: Partial<RevisionConfig>,
    chapterId?: string,
  ): Promise<RevisionCycleResult>;

  /**
   * Analyze text for weak points across all revision dimensions.
   */
  analyze(
    text: string,
    dimensions?: RevisionDimension[],
  ): RevisionAnalysisResult;

  /**
   * Generate revision suggestions from analysis results.
   */
  suggest(
    text: string,
    analysis: RevisionAnalysisResult,
    threshold?: number,
  ): { weakPoints: WeakPoint[]; suggestions: RevisionSuggestion[] };

  /**
   * Compare two revision analyses (baseline vs revised).
   */
  compare(params: {
    sessionId: string;
    iterationNumber: number;
    baseline: RevisionAnalysisResult;
    revised: RevisionAnalysisResult;
  }): RevisionComparison;

  /**
   * Get cross-iteration learning insights accumulated from past sessions.
   */
  getLearningInsights(): RevisionLearningInsight[];

  /**
   * Get the revision session history for a chapter.
   */
  getSessionHistory(chapterId: string): Promise<RevisionSession[]>;

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the service.
   */
  shutdown(): Promise<void>;
}