import { callAnalysisAgent } from '../api/intelligence';
import { processWritingHelper } from '../api/client';
import { createCheckpoint, restoreCheckpoint } from '../api/workflow/checkpoints';
import {
  workflowRevisionAnalyze,
  workflowRevisionCompare,
  workflowRevisionMarkRevised,
  workflowRevisionStartSession,
  workflowRevisionGenerateSuggestions,
} from '../api/workflow/revision';
import type { ProjectWorkspaceContext } from '../api/workspace';
import { logger } from '../utils/logger';

export type SuggestionFocus =
  | 'conflict'
  | 'pacing'
  | 'structure'
  | 'logic'
  | 'character'
  | 'dialogue'
  | 'detail'
  | 'style'
  | 'generic';

export interface Suggestion {
  title: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  focus: SuggestionFocus;
}

/**
 * Configuration for a revision pass.
 */
export interface RevisionConfig {
  // The quality score threshold to aim for. The loop will stop if this is reached.
  targetScore: number;
  // The maximum number of iterations to prevent infinite loops.
  maxIterations: number;
  // The project workspace context, including story bible, etc.
  workspace?: ProjectWorkspaceContext;
}

/**
 * The result of a revision pass.
 */
export interface RevisionResult {
  initialContent: string;
  revisedContent: string;
  initialScore: number;
  finalScore: number;
  iterations: number;
  completed: boolean;
  reason: 'target_reached' | 'max_iterations' | 'no_improvement' | 'error';
  sessionId?: string | null;
  revisionSession?: {
    id?: string | null;
    chapterId: string;
    state: string;
    iteration: number;
    comparisonSummary?: string | null;
  } | null;
}

/**
 * The RevisionOrchestrator service manages the autonomous multi-pass revision loop.
 */
export class RevisionOrchestrator {
  private config: RevisionConfig;

  constructor(config: RevisionConfig) {
    this.config = {
      ...{
        targetScore: 8.5,
        maxIterations: 5,
      },
      ...config,
    };
  }

  /**
   * Runs the autonomous revision loop on the given content.
   * @param content The initial text content to revise.
   * @returns A promise that resolves with the result of the revision pass.
   */
  public async run(content: string): Promise<RevisionResult> {
    let currentContent = content;
    let lastScore = 0;
    let iterations = 0;
    let checkpointId: string | null = null;
    let result: RevisionResult | null = null;
    let degradedScore: { from: number; to: number } | null = null;
    const chapterId = this.config.workspace?.manuscript?.chapterId ?? this.config.workspace?.workflow?.sessionId ?? 'chapter-unknown';
    let revisionSession: RevisionResult['revisionSession'] = null;
    let revisionSessionId: string | null = null;

    try {
      const revisionSessionResponse = await workflowRevisionStartSession(
        chapterId,
        content,
        undefined,
        this.config.workspace,
      );
      if (revisionSessionResponse.success && revisionSessionResponse.data) {
        const startData = revisionSessionResponse.data as NonNullable<typeof revisionSessionResponse.data> & {
          session_id: string;
          status: string;
        };
        revisionSessionId = startData.session_id;
        revisionSession = {
          id: revisionSessionId,
          chapterId,
          state: startData.status,
          iteration: 0,
          comparisonSummary: null,
        };
      }

      const cp = await createCheckpoint(
        `[Auto] Pre-revision checkpoint for orchestrator`,
        undefined,
        this.config.workspace,
      );
      if (cp.success && cp.data) {
        checkpointId = cp.data.checkpoint_id;
        logger.log(`Created checkpoint ${checkpointId}`);
      }

      const initialEval = await this.evaluate(currentContent);
      if (!initialEval) {
        result = {
          initialContent: content, revisedContent: content, initialScore: 0, finalScore: 0,
          iterations: 0, completed: false, reason: 'error', sessionId: null, revisionSession: null,
        };
        return result;
      }
      const initialScore = initialEval.score;
      lastScore = initialScore;

      for (let i = 0; i < this.config.maxIterations; i++) {
        iterations = i + 1;
        logger.log(`Iteration ${iterations}, current score: ${lastScore}`);

        if (lastScore >= this.config.targetScore) {
          result = {
            initialContent: content, revisedContent: currentContent, initialScore,
            finalScore: lastScore, iterations, completed: true, reason: 'target_reached',
            sessionId: checkpointId,
            revisionSession,
          };
          return result;
        }

        const currentEvaluation = await this.evaluate(currentContent);
        if (!currentEvaluation || !currentEvaluation.suggestions || currentEvaluation.suggestions.length === 0) {
          result = {
            initialContent: content, revisedContent: currentContent, initialScore,
            finalScore: lastScore, iterations, completed: true, reason: 'no_improvement',
            sessionId: checkpointId,
            revisionSession,
          };
          return result;
        }

        if (revisionSessionId) {
          const analyzeResponse = await workflowRevisionAnalyze(revisionSessionId, currentContent, undefined, this.config.workspace);
          if (analyzeResponse.success && analyzeResponse.data) {
            const suggestResponse = await workflowRevisionGenerateSuggestions(revisionSessionId, undefined, undefined, this.config.workspace);
            if (suggestResponse.success && suggestResponse.data) {
              const suggestData = suggestResponse.data as NonNullable<typeof suggestResponse.data> & {
                status: string;
                iteration_number?: number;
              };
              revisionSession = {
                id: revisionSessionId,
                chapterId,
                state: suggestData.status,
                iteration: suggestData.iteration_number ?? iterations,
                comparisonSummary: revisionSession?.comparisonSummary ?? null,
              };
            }
          }
        }
        
        const criticalSuggestion = this.selectNextSuggestion(currentEvaluation.suggestions);
        if (!criticalSuggestion) {
          result = {
            initialContent: content, revisedContent: currentContent, initialScore,
            finalScore: lastScore, iterations, completed: true, reason: 'no_improvement',
            sessionId: checkpointId,
            revisionSession,
          };
          return result;
        }

      const revisedContent = await this.revise(currentContent, criticalSuggestion);
      if (revisedContent === currentContent) {
        // Revision failed or produced no change
        result = {
          initialContent: content, revisedContent: currentContent, initialScore,
          finalScore: lastScore, iterations, completed: true, reason: 'no_improvement',
          sessionId: checkpointId,
          revisionSession,
        };
        return result;
      }

      const newEvaluation = await this.evaluate(revisedContent);
      if (!newEvaluation || newEvaluation.score <= lastScore) {
         if (newEvaluation && newEvaluation.score < lastScore) {
           degradedScore = {
             from: lastScore,
             to: newEvaluation.score,
           };
         }
         result = {
            initialContent: content, revisedContent: currentContent, initialScore,
            finalScore: lastScore, iterations, completed: true, reason: 'no_improvement',
            sessionId: checkpointId,
            revisionSession,
        };
        return result;
      }

      // Improvement found, update content and score for the next loop.
      currentContent = revisedContent;
      lastScore = newEvaluation.score;
      if (revisionSessionId) {
        const markResult = await workflowRevisionMarkRevised(
          revisionSessionId,
          revisedContent,
          undefined,
          this.config.workspace,
        );
        const compareResult = await workflowRevisionCompare(
          revisionSessionId,
          revisedContent,
          undefined,
          this.config.workspace,
        );
        if (markResult.success && compareResult.success && compareResult.data) {
          const compareData = compareResult.data as NonNullable<typeof compareResult.data> & {
            status: string;
            iteration_number?: number;
            comparison?: { summary?: string | null } | null;
          };
          revisionSession = {
            id: revisionSessionId,
            chapterId,
            state: compareData.status,
            iteration: compareData.iteration_number ?? iterations,
            comparisonSummary: compareData.comparison?.summary ?? null,
          };
        }
      }
      revisionSession = {
        id: revisionSessionId,
        chapterId,
        state: revisionSession?.state ?? 'REVISED',
        iteration: revisionSession?.iteration ?? iterations,
        comparisonSummary: revisionSession?.comparisonSummary ?? `Iteration ${iterations}: ${lastScore.toFixed(1)} score`,
      };
    }

    result = {
      initialContent: content, revisedContent: currentContent, initialScore,
      finalScore: lastScore, iterations, completed: true, reason: 'max_iterations',
      sessionId: checkpointId,
      revisionSession,
    };
    return result;

    } finally {
      if (result && checkpointId && degradedScore) {
        logger.warn(
          `Revision degraded quality from ${degradedScore.from} to ${degradedScore.to}. Restoring checkpoint...`,
        );
        await restoreCheckpoint(checkpointId, this.config.workspace);
      }
    }
  }

  /**
   * Selects the most critical suggestion from a list based on severity and focus.
   * @param suggestions The list of suggestions.
   * @returns The most critical suggestion, or null if the list is empty.
   */
  private selectNextSuggestion(suggestions: Suggestion[]): Suggestion | null {
    if (!suggestions || suggestions.length === 0) {
      return null;
    }

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const focusOrder = [
      'logic', 'conflict', 'character', 'pacing', 
      'structure', 'dialogue', 'style', 'detail', 'generic'
    ];

    return [...suggestions].sort((a, b) => {
      // Sort by severity first
      const severityA = severityOrder[a.severity] ?? 99;
      const severityB = severityOrder[b.severity] ?? 99;
      if (severityA !== severityB) {
        return severityA - severityB;
      }

      // Then sort by focus
      const focusA = focusOrder.indexOf(a.focus);
      const focusB = focusOrder.indexOf(b.focus);
      if (focusA !== -1 && focusB !== -1 && focusA !== focusB) {
        return focusA - focusB;
      }

      return 0; // Keep original order if severity and focus are the same
    })[0];
  }

  /**
   * Evaluates the given text content using the 'readability' analysis module.
   * @param content The text to evaluate.
   * @returns A promise that resolves with the evaluation score and suggestions, or null on failure.
   */
  private async evaluate(content: string): Promise<{ score: number; suggestions: Suggestion[] } | null> {
    try {
      logger.log('Evaluating content snippet:', content.substring(0, 50));
      const response = await callAnalysisAgent('readability', content);

      if (!response.success || !response.data) {
        logger.error('Evaluation failed:', response);
        return null;
      }

      const score = (response.data.readability_score as number) / 10.0;
      const rawSuggestions = (response.data.suggestions as unknown[]) || [];
      const suggestions = this.mapToStructuredSuggestions(rawSuggestions);

      return { score, suggestions };
    } catch (error) {
      logger.error('Error during evaluation:', error);
      return null;
    }
  }

  /**
   * Maps raw suggestion data from an API to a structured Suggestion array.
   * @param rawSuggestions The array of raw suggestion objects.
   * @returns A structured array of Suggestions.
   */
  private mapToStructuredSuggestions(rawSuggestions: unknown[]): Suggestion[] {
    return rawSuggestions.map((raw) => {
      const item = raw as Record<string, unknown>;
      const title = (typeof item.title === 'string' ? item.title : '') || 'Untitled Suggestion';
      const reason = (typeof item.reason === 'string' ? item.reason : '') || 'No reason provided.';
      const focus = this.detectSuggestionFocus(title, reason);

      const severity = (['high', 'medium', 'low'] as const).includes(item.severity as 'high' | 'medium' | 'low')
        ? (item.severity as 'high' | 'medium' | 'low')
        : 'medium';

      return { title, reason, severity, focus };
    });
  }

  /**
   * Infers the 'focus' of a suggestion based on keywords in its text.
   * @param title The title of the suggestion.
   * @param reason The reason for the suggestion.
   * @returns The inferred SuggestionFocus.
   */
  private detectSuggestionFocus(title: string, reason: string): SuggestionFocus {
    const normalized = `${title} ${reason}`.toLowerCase();
    if (normalized.includes('logic') || normalized.includes('continuity')) return 'logic';
    if (normalized.includes('conflict') || normalized.includes('tension')) return 'conflict';
    if (normalized.includes('character') || normalized.includes('motivation')) return 'character';
    if (normalized.includes('pacing') || normalized.includes('rhythm')) return 'pacing';
    if (normalized.includes('structure') || normalized.includes('outline')) return 'structure';
    if (normalized.includes('dialogue') || normalized.includes('voice')) return 'dialogue';
    if (normalized.includes('style') || normalized.includes('tone')) return 'style';
    if (normalized.includes('detail') || normalized.includes('imagery')) return 'detail';
    return 'generic';
  }

  /**
   * Revises the content based on a suggestion by calling the writing helper API.
   * @param content The content to revise.
   * @param suggestion The suggestion to apply.
   * @returns A promise that resolves with the revised text, or the original text on failure.
   */
  private async revise(content: string, suggestion: Suggestion): Promise<string> {
    try {
      logger.log(`Revising content based on '${suggestion.focus}' suggestion: ${suggestion.title}`);
      const instruction = `Rewrite the text according to the evaluation guidance below. Return only the revised full text with no explanation.\n\nSuggestion: ${suggestion.title}\nReason: ${suggestion.reason}`;

      const response = await processWritingHelper({
        content,
        mode: 'rewrite',
        instruction,
        workspace: this.config.workspace,
      });

      if (response.success && response.data?.processed_text) {
        return response.data.processed_text;
      }

      logger.error('Revision failed:', response.error);
      return content; // Return original content if revision fails
    } catch (error) {
      logger.error('Error during revision:', error);
      return content; // Return original content if revision fails
    }
  }
}

