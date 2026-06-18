/**
 * Revision Service Implementation
 *
 * Activates the Critic-driven multi-round revision loop with
 * cross-iteration learning. Integrates the existing revision-session
 * and revision-loop modules, and provides the IRevisionService protocol.
 */

import type {
  RevisionDimension,
  RevisionAnalysisResult,
  WeakPoint,
  RevisionSuggestion,
  RevisionComparison,
  RevisionSession,
  RevisionIteration,
} from '../workflow/revision-session';

import {
  analyzeRevisionText,
  deriveWeakPoints,
  generateRevisionSuggestions,
  compareRevisionAnalyses,
} from '../workflow/revision-session';

import {
  RevisionDecision,
  DEFAULT_REVISION_CONFIG,
  runRevisionLoop,
  type RevisionConfig,
} from '../workflow/revision-loop';

import type {
  IRevisionService,
  RevisionCycleResult,
  RevisionLearningInsight,
} from '../protocols/revision';

import { createLogger } from '../logger/index';

const log = createLogger('revision-service');

// ============================================================
// Rule-based rewrite helpers (fallback when LLM unavailable)
// ============================================================

/**
 * Chinese AI template expressions that should be replaced with natural alternatives.
 */
const AI_TEMPLATE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /值得注意的是/g, replacement: '' },
  { pattern: /让我们/g, replacement: '' },
  { pattern: /综上所述/g, replacement: '' },
  { pattern: /首先[，,]/g, replacement: '' },
  { pattern: /其次[，,]/g, replacement: '' },
  { pattern: /最后[，,]/g, replacement: '' },
  { pattern: /总而言之/g, replacement: '' },
  { pattern: /不可否认/g, replacement: '' },
  { pattern: /毫无疑问/g, replacement: '' },
  { pattern: /显而易见/g, replacement: '' },
  { pattern: /从某种意义来说/g, replacement: '' },
  { pattern: /在一定程度上/g, replacement: '' },
  { pattern: /不难发现/g, replacement: '' },
  { pattern: /由此可见/g, replacement: '' },
  { pattern: /一言以蔽之/g, replacement: '' },
  { pattern: /更有甚者/g, replacement: '' },
  { pattern: /退一步说/g, replacement: '' },
  { pattern: /退一步讲/g, replacement: '' },
  { pattern: /退一步来看/g, replacement: '' },
  { pattern: /平心而论/g, replacement: '' },
  { pattern: /众所周知/g, replacement: '' },
  { pattern: /换言之/g, replacement: '' },
  { pattern: /追根溯源/g, replacement: '' },
  { pattern: /归根结底/g, replacement: '' },
  { pattern: /一言蔽之/g, replacement: '' },
  { pattern: /无独有偶/g, replacement: '' },
  { pattern: /需要指出的是/g, replacement: '' },
  { pattern: /必须承认/g, replacement: '' },
  { pattern: /不得不承认/g, replacement: '' },
  { pattern: /应当指出/g, replacement: '' },
  { pattern: /需要强调/g, replacement: '' },
  { pattern: /有必要说明/g, replacement: '' },
  { pattern: /特别需要/g, replacement: '' },
  { pattern: /特别值得一提的是/g, replacement: '' },
  { pattern: /特别值得注意的是/g, replacement: '' },
  { pattern: /更加重要的是/g, replacement: '' },
  { pattern: /更为重要的是/g, replacement: '' },
  { pattern: /更重要的是/g, replacement: '' },
];

/**
 * English AI template expressions that should be replaced.
 */
const AI_TEMPLATE_REPLACEMENTS_EN: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /it is important to note that/gi, replacement: '' },
  { pattern: /it should be noted that/gi, replacement: '' },
  { pattern: /in conclusion/gi, replacement: '' },
  { pattern: /to summarize/gi, replacement: '' },
  { pattern: /in summary/gi, replacement: '' },
  { pattern: /it is worth noting/gi, replacement: '' },
  { pattern: /it is worth mentioning/gi, replacement: '' },
  { pattern: /delve into/gi, replacement: 'explore' },
  { pattern: /navigate the complexities of/gi, replacement: 'understand' },
  { pattern: /in the realm of/gi, replacement: 'in' },
  { pattern: /a myriad of/gi, replacement: 'many' },
  { pattern: /tapestry of/gi, replacement: 'rich' },
  { pattern: /landscape of/gi, replacement: 'world of' },
  { pattern: /multifaceted/gi, replacement: 'complex' },
  { pattern: /underscores the importance of/gi, replacement: 'shows' },
  { pattern: /highlights the need for/gi, replacement: 'shows why' },
  { pattern: /serves as a testament to/gi, replacement: 'shows' },
  { pattern: /sheds light on/gi, replacement: 'reveals' },
  { pattern: /paves the way for/gi, replacement: 'enables' },
  { pattern: /opens the door to/gi, replacement: 'allows' },
  { pattern: /at the end of the day/gi, replacement: 'ultimately' },
  { pattern: /it goes without saying/gi, replacement: '' },
  { pattern: /needless to say/gi, replacement: '' },
  { pattern: /as a matter of fact/gi, replacement: '' },
  { pattern: /to put it simply/gi, replacement: '' },
];

/**
 * Apply rule-based de-AI rewrites to text.
 * Removes or replaces common AI template expressions.
 * Returns the rewritten text and a list of applied changes.
 */
function applyRuleBasedDeAI(text: string): { text: string; changes: string[] } {
  let result = text;
  const changes: string[] = [];

  for (const { pattern, replacement } of AI_TEMPLATE_REPLACEMENTS) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      changes.push(`Replaced "${matches[0]}" with natural expression`);
    }
  }

  for (const { pattern, replacement } of AI_TEMPLATE_REPLACEMENTS_EN) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      changes.push(`Replaced "${matches[0]}" with "${replacement}"`);
    }
  }

  // Clean up double spaces and leading/trailing spaces in sentences
  result = result.replace(/\s{2,}/g, ' ').trim();

  return { text: result, changes };
}

/**
 * Build a de-AI rewrite prompt for LLM.
 */
function buildDeAIPrompt(
  draft: string,
  feedback: Record<string, unknown>,
  qualityGoals?: string[],
  targetStyle?: string,
): string {
  const goals = qualityGoals && qualityGoals.length > 0
    ? qualityGoals.join('\n')
    : 'Remove AI-generated template expressions and make the text sound more natural and human-written.';

  const styleHint = targetStyle
    ? `\nTarget style: ${targetStyle}\n`
    : '';

  const feedbackText = feedback['feedback_artifacts']
    ? JSON.stringify(feedback['feedback_artifacts'], null, 2)
    : String(feedback['feedback'] ?? '');

  return `You are a professional editor specializing in removing AI-generated prose patterns and making text sound natural and human-written.

## Original Text
${draft}

## Critic Feedback
${feedbackText}

## Revision Goals
${goals}${styleHint}

## Instructions
Rewrite the text to eliminate AI-generated patterns (template expressions, repetitive structures, generic transitions). Keep the original meaning and narrative flow. Make the prose feel organic and varied. Return ONLY the rewritten text, no explanations.`;
}

/**
 * Call LLM for text rewriting. Returns rewritten text or null on failure.
 */
async function callLLMForRewrite(prompt: string): Promise<string | null> {
  try {
    // Check for LLM provider configuration in environment
    const apiKey = process.env['LLM_API_KEY'];
    const baseUrl = process.env['LLM_BASE_URL'];
    const model = process.env['LLM_MODEL'];

    if (!apiKey || !baseUrl || !model) {
      log.debug('LLM not configured, falling back to rule-based rewrite');
      return null;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a professional editor. Rewrite text to remove AI patterns. Return only the rewritten text.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      log.warn('LLM rewrite call failed', { status: response.status });
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    const content = choices?.[0]?.message?.content ?? '';

    return content.trim() || null;
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    log.warn('LLM rewrite call error', { error: message });
    return null;
  }
}

// ============================================================
// Cross-iteration learning accumulator
// ============================================================

interface DimensionLearningEntry {
  baselines: number[];
  deltas: number[];
  evidence: string[];
  occurrences: number;
}

export class RevisionServiceImpl implements IRevisionService {
  private readonly learningAccumulator = new Map<string, DimensionLearningEntry>();
  private readonly sessionStoreDir: string;
  private initialized = false;

  constructor(config?: { sessionStoreDir?: string }) {
    this.sessionStoreDir = config?.sessionStoreDir ?? '.writing/revision-sessions';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    log.info('Revision service initialized');
    this.initialized = true;
  }

  async revise(
    text: string,
    config?: Partial<RevisionConfig>,
    chapterId?: string,
  ): Promise<RevisionCycleResult> {
    if (!text.trim()) {
      return {
        sessionId: `revision-empty-${Date.now()}`,
        finalDraft: text,
        finalDecision: RevisionDecision.REVISE,
        finalScore: 0,
        totalIterations: 0,
        iterations: [],
        learningInsights: [],
      };
    }

    const mergedConfig = { ...DEFAULT_REVISION_CONFIG, ...config } as RevisionConfig;

    // Critic function — evaluates draft and returns structured feedback
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const criticFn = async (draft: string, sceneCard: Record<string, unknown>) => {
      const { evaluateContent } = await import('../mcp/services/critic.js');
      const result = await evaluateContent(draft);
      return {
        decision: result.decision,
        total_score: result.total_score,
        actionable_feedback: result.actionable_feedback,
        lock_analysis: { C: { score: result.logic_score > 6 ? 10 : result.logic_score } },
        revision_instructions: [],
      };
    };

    // Writer function — performs actual text rewriting
    // Strategy: try LLM first, fall back to rule-based rewrite
    const writerFn = async (draft: string, feedback: Record<string, unknown>) => {
      const prompt = buildDeAIPrompt(
        draft,
        feedback,
        mergedConfig.quality_goals,
        mergedConfig.target_style,
      );

      // Attempt 1: LLM rewrite
      const llmResult = await callLLMForRewrite(prompt);
      if (llmResult && llmResult.length > 0 && llmResult !== draft) {
        log.info('LLM rewrite applied', { originalLength: draft.length, rewrittenLength: llmResult.length });
        return llmResult;
      }

      // Attempt 2: Rule-based fallback
      const ruleResult = applyRuleBasedDeAI(draft);
      if (ruleResult.changes.length > 0) {
        log.info('Rule-based de-AI rewrite applied', { changes: ruleResult.changes.length });
        return ruleResult.text;
      }

      // Fallback: return original with a note
      log.debug('No rewrites applied, returning original draft');
      return draft;
    };

    const loopResult = await runRevisionLoop({
      draft: text,
      sceneCard: {},
      writerFn,
      criticFn,
      config: mergedConfig,
      verbose: false,
    });

    // Extract iteration data from the loop result
    const loopState = loopResult as Record<string, unknown>;
    const history = Array.isArray(loopState['history']) ? loopState['history'] as Array<Record<string, unknown>> : [];

    // Build revision iterations from loop history
    const iterations: RevisionIteration[] = [];
    const baselineAnalysis = this.analyze(text);

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const score = typeof entry['score'] === 'number' ? entry['score'] as number : 0;

      // Track cross-iteration learning per dimension
      for (const report of baselineAnalysis.reports) {
        this._accumulateDimension(report.dimensionId, report.score, score - report.score, report.evidence.slice(0, 2));
      }

      iterations.push({
        iterationNumber: i + 1,
        analyzedAt: new Date().toISOString(),
        weakPoints: deriveWeakPoints(text, baselineAnalysis),
        suggestions: generateRevisionSuggestions(deriveWeakPoints(text, baselineAnalysis), baselineAnalysis),
        resultScores: { ...baselineAnalysis.scores },
        comparison: undefined,
      });
    }

    const finalDraft = typeof loopState['final_draft'] === 'string' ? loopState['final_draft'] as string : text;
    const finalScore = typeof loopState['final_score'] === 'number' ? loopState['final_score'] as number : 0;
    const finalDecisionRaw = String(loopState['final_decision'] ?? 'REVISE');
    const finalDecision = this._normalizeDecision(finalDecisionRaw);

    let comparison: RevisionComparison | undefined;
    if (iterations.length > 0 && finalDraft !== text) {
      const revisedAnalysis = this.analyze(finalDraft);
      comparison = this.compare({
        sessionId: `revision-${Date.now()}`,
        iterationNumber: iterations.length,
        baseline: baselineAnalysis,
        revised: revisedAnalysis,
      });

      for (const [dim, delta] of Object.entries(comparison.delta)) {
        const numericDelta = typeof delta === 'number' ? delta : 0;
        this._accumulateDimensionDelta(dim, numericDelta);
      }
    }

    return {
      sessionId: `revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      finalDraft,
      finalDecision,
      finalScore,
      totalIterations: iterations.length,
      iterations,
      learningInsights: this.getLearningInsights(),
      comparison,
    };
  }

  analyze(text: string, dimensions?: RevisionDimension[]): RevisionAnalysisResult {
    return analyzeRevisionText(text, dimensions);
  }

  suggest(
    text: string,
    analysis: RevisionAnalysisResult,
    threshold = 7,
  ): { weakPoints: WeakPoint[]; suggestions: RevisionSuggestion[] } {
    const weakPoints = deriveWeakPoints(text, analysis, threshold);
    const suggestions = generateRevisionSuggestions(weakPoints, analysis);
    return { weakPoints, suggestions };
  }

  compare(params: {
    sessionId: string;
    iterationNumber: number;
    baseline: RevisionAnalysisResult;
    revised: RevisionAnalysisResult;
  }): RevisionComparison {
    return compareRevisionAnalyses(params);
  }

  getLearningInsights(): RevisionLearningInsight[] {
    const insights: RevisionLearningInsight[] = [];

    for (const [dimensionId, entry] of this.learningAccumulator) {
      const averageBaseline = entry.baselines.length > 0
        ? entry.baselines.reduce((sum, v) => sum + v, 0) / entry.baselines.length
        : 0;
      const averageDelta = entry.deltas.length > 0
        ? entry.deltas.reduce((sum, v) => sum + v, 0) / entry.deltas.length
        : 0;
      const trend = averageDelta > 0.2
        ? 'improving'
        : averageDelta < -0.2
          ? 'declining'
          : 'stable';

      insights.push({
        dimensionId: dimensionId as RevisionDimension,
        averageBaselineScore: Math.round(averageBaseline * 10) / 10,
        averageDelta: Math.round(averageDelta * 10) / 10,
        occurrences: entry.occurrences,
        trend,
        evidence: [...new Set(entry.evidence)].slice(0, 4),
      });
    }

    return insights.sort((a, b) => b.occurrences - a.occurrences);
  }

  async getSessionHistory(chapterId: string): Promise<RevisionSession[]> {
    try {
      const { readdir, readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { existsSync } = await import('node:fs');
      const workspaceRoot = process.env['NIKO_WORKFLOW_WORKSPACE']?.trim() || process.cwd();
      const dir = join(workspaceRoot, this.sessionStoreDir);

      if (!existsSync(dir)) return [];

      const entries = await readdir(dir, { withFileTypes: true });
      const sessions: RevisionSession[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
          const content = await readFile(join(dir, entry.name), 'utf-8');
          const session = JSON.parse(content) as RevisionSession;
          if (session.chapterId === chapterId) {
            sessions.push(session);
          }
        } catch {
          // skip malformed
        }
      }

      return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.learningAccumulator.clear();
    this.initialized = false;
    log.info('Revision service shut down');
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private _accumulateDimension(
    dimensionId: string,
    baseline: number,
    delta: number,
    evidence: string[],
  ): void {
    const entry = this.learningAccumulator.get(dimensionId) ?? {
      baselines: [],
      deltas: [],
      evidence: [],
      occurrences: 0,
    };
    entry.baselines.push(baseline);
    entry.deltas.push(delta);
    entry.evidence.push(...evidence);
    entry.occurrences += 1;
    this.learningAccumulator.set(dimensionId, entry);
  }

  private _accumulateDimensionDelta(dimensionId: string, delta: number): void {
    const entry = this.learningAccumulator.get(dimensionId) ?? {
      baselines: [],
      deltas: [],
      evidence: [],
      occurrences: 0,
    };
    entry.deltas.push(delta);
    entry.occurrences += 1;
    this.learningAccumulator.set(dimensionId, entry);
  }

  private _normalizeDecision(raw: string): RevisionDecision {
    if (raw === 'APPROVED') return RevisionDecision.APPROVED;
    if (raw === 'REWRITE') return RevisionDecision.REWRITE;
    if (raw === 'HUMAN_REVIEW') return RevisionDecision.HUMAN_REVIEW;
    return RevisionDecision.REVISE;
  }
}