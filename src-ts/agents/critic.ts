/**
 * critic.ts - Critic agent for content quality evaluation.
 *
 * Migrated from src/agents/critic.py
 * Integrates 8 editing dimensions + LOCK system + web novel satisfaction mechanics.
 */

import type { IAgentLLMService } from './base';
import { CriticEngine } from '../narrative/evaluators/critic-engine';

// ============================================================
// Score constants (from src/workflow/state.py)
// ============================================================

export const NOVEL_PASS_SCORE = 99;
export const NOVEL_HUMAN_REVIEW_SCORE = 95;

// ============================================================
// Interfaces (Pydantic models -> TS interfaces)
// ============================================================

export interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
  feedback: string;
  issues: string[];
}

export interface LOCKSceneCheck {
  L_exhibited: boolean;
  O_advanced: boolean;
  C_present: boolean;
  K_hook?: string;
}

export interface ShuangDianCheck {
  setup_score: number;
  setup_feedback: string;
  payoff_score: number;
  payoff_feedback: string;
  reaction_score: number;
  reaction_feedback: string;
}

export function shuangDianTotalScore(c: ShuangDianCheck): number {
  return c.setup_score + c.payoff_score + c.reaction_score;
}

export function shuangDianIsEffective(c: ShuangDianCheck): boolean {
  return shuangDianTotalScore(c) >= 7;
}

export interface RevisionInstruction {
  target: string;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LOCKDimensionResult {
  score: number;
  reasoning: string;
  improvement?: string;
}

export interface LOCKAnalysisResult {
  L: LOCKDimensionResult;
  O: LOCKDimensionResult;
  C: LOCKDimensionResult;
  K: LOCKDimensionResult;
}

export function lockWeightedScore(r: LOCKAnalysisResult): number {
  return (r.L.score * 0.20 + r.O.score * 0.20 + r.C.score * 0.40 + r.K.score * 0.20) * 4;
}

export function lockCScoreSufficient(r: LOCKAnalysisResult): boolean {
  return r.C.score >= 7;
}

export function lockHasCriticalFailure(r: LOCKAnalysisResult): boolean {
  return [r.L, r.O, r.C, r.K].some(d => d.score <= 2);
}

export type CriticDecision = 'APPROVED' | 'HUMAN_REVIEW' | 'REVISE' | 'REWRITE';

export interface CriticOutput {
  agent_role: string;
  evaluation_timestamp?: string;
  narrative_report?: Record<string, unknown> | null;

  lock_analysis: LOCKAnalysisResult | null;

  decision: CriticDecision;
  decision_reason: string;

  total_score: number;
  lock_score: number;
  style_score: number;
  logic_score: number;

  dimension_details: DimensionScore[];

  lock_scene_check: LOCKSceneCheck | null;
  shuangdian_check: ShuangDianCheck | null;

  suggestions_high: string[];
  suggestions_medium: string[];
  suggestions_low: string[];

  revision_instructions: RevisionInstruction[];
  actionable_feedback: string;
}

// ============================================================
// Dimension configuration
// ============================================================

interface DimConfig {
  weight: number;
  category: string;
}

const DIMENSION_CONFIG: Record<string, DimConfig> = {
  // LOCK system (40%) - C has 2x weight
  L_lead: { weight: 0.08, category: 'lock' },
  O_objective: { weight: 0.08, category: 'lock' },
  C_confrontation: { weight: 0.16, category: 'lock' },
  K_knockout: { weight: 0.08, category: 'lock' },

  // Style quality (35%)
  sensory_balance: { weight: 0.07, category: 'style' },
  dickensian_style: { weight: 0.07, category: 'style' },
  dialogue_quality: { weight: 0.09, category: 'style' },
  character_consistency: { weight: 0.07, category: 'style' },
  rhythm_control: { weight: 0.05, category: 'style' },

  // Logic & experience (25%)
  plot_logic: { weight: 0.09, category: 'logic' },
  reader_experience: { weight: 0.09, category: 'logic' },
  worldbuilding_consistency: { weight: 0.07, category: 'logic' },
};

// ============================================================
// System Prompt
// ============================================================

const CRITIC_SYSTEM_PROMPT = `
You are a senior web novel editor and quality assessment expert with veto power.
Your task is to evaluate written content across multiple dimensions and provide specific improvement suggestions.

## Evaluation Dimensions and Weights

### LOCK System Evaluation (Weight 40%)

**L - Lead (25%)**
Check if the scene showcases protagonist charm:
- Does the protagonist's behavior align with their core desire?
- Are unique personality traits displayed?

**O - Objective (25%)**
Check if the scene advances the protagonist's goal:
- Is it clear what the protagonist wants?
- Are they closer or farther from the goal?

**C - Confrontation (30%)**
Check the scene's conflict:
- Is the conflict strong enough?
- Are sources diverse (external/internal/relational)?
- Is it escalating from the previous scene?

**K - Knockout (20%)**
Check chapter hooks (ending scenes only):
- Is there a driving force to make readers continue?
- Is there emotional impact or suspense?

### Style Quality Evaluation (Weight 35%)

**Sensory Description (20%)**
- Are multiple senses covered (sight/sound/touch/smell/taste)?
- Is pure visual description avoided?
- Are sensory details naturally integrated?

**Dickensian Style (20%)**
- Is the "animism" technique used?
- Does environment reflect character psychology?

**Dialogue Quality (25%)**
- Is it natural and conversational?
- Does it contain subtext?
- Is it paired with actions and expressions?

**Character Consistency (20%)**
- Does character behavior match established settings?

**Rhythm Control (15%)**
- Are short sentences used in tense scenes?
- Are details expanded in relaxed scenes?

### Logic & Experience Evaluation (Weight 25%)

**Plot Logic (35%)** - Are cause-effect relationships clear?
**Reader Experience (35%)** - Can it immerse the reader?
**Setting Consistency (30%)** - Consistent with established worldview?

## Decision Rules

- **APPROVED**: Total score >= 99, excellent quality
- **HUMAN_REVIEW**: 95 <= score < 99, recommend manual review
- **REVISE**: 50 <= score < 95, needs revision
- **REWRITE**: score < 50, needs rewrite

## Output Requirements

Output a CriticOutput JSON with:
1. Score (0-10) and feedback for each dimension
2. Weighted total score
3. Decision based on scores
4. All issues and improvement suggestions
5. Structured actionable_feedback
`;

const CRITIC_USER_PROMPT_TEMPLATE = `
## Content Under Review

{draft_content}

## Scene Information

- Scene ID: {scene_id}
- POV Character: {pov_character}
- Scene Objective: {scene_objective}
- Core Conflict: {scene_conflict}
- Expected Outcome: {scene_outcome}
- Is Climax Scene: {is_climax}

## Character Profiles

{character_profiles}

## World Settings

{world_settings}

## Forbidden Words

{forbidden_words}

## Please perform multi-dimensional evaluation and output CriticOutput JSON
`;

// ============================================================
// CriticAgent
// ============================================================

const FORBIDDEN_WORDS = ['\u7a81\u7136', '\u4e0d\u7981', '\u7adf\u7136', '\u5c45\u7136', '\u5fcd\u4e0d\u4f4f'];

export class CriticAgent {
  private llmService: IAgentLLMService;
  private narrativeEngine: CriticEngine | null;

  constructor(options: { llmService: IAgentLLMService; narrativeCriticEngine?: CriticEngine | null }) {
    this.llmService = options.llmService;
    this.narrativeEngine = options.narrativeCriticEngine ?? new CriticEngine();
  }

  // ---------- Main review method ----------

  async review(
    draftContent: string,
    sceneCard: Record<string, unknown>,
    characterProfiles: Record<string, unknown>[],
    worldSettings: Record<string, unknown>,
    allowLlmFallback: boolean = true,
  ): Promise<CriticOutput> {
    const userPrompt = CRITIC_USER_PROMPT_TEMPLATE
      .replace('{draft_content}', draftContent)
      .replace('{scene_id}', String(sceneCard['scene_id'] ?? ''))
      .replace('{pov_character}', String(sceneCard['pov_character'] ?? ''))
      .replace('{scene_objective}', String(sceneCard['objective'] ?? ''))
      .replace('{scene_conflict}', String(sceneCard['conflict'] ?? ''))
      .replace('{scene_outcome}', String(sceneCard['outcome'] ?? ''))
      .replace('{is_climax}', String(['Climax', 'Door2'].includes(String(sceneCard['structural_function'] ?? ''))))
      .replace('{character_profiles}', JSON.stringify(characterProfiles, null, 2))
      .replace('{world_settings}', JSON.stringify(worldSettings, null, 2))
      .replace('{forbidden_words}', FORBIDDEN_WORDS.join(', '));

    let result: CriticOutput;
    try {
      result = await this.llmService.generateJson<CriticOutput>(userPrompt, {
        systemPrompt: CRITIC_SYSTEM_PROMPT,
      });
    } catch (exc) {
      if (!allowLlmFallback) {
        throw new Error('LLM execution failed with fallback disabled');
      }
      throw exc;
    }

    // Apply deterministic rule checks
    result = this.applyRuleChecks(result, draftContent);

    // Narrative CriticEngine supplementary report
    const narrativeReport = await this.evaluateNarrativeReport(
      draftContent, sceneCard, characterProfiles, worldSettings,
    );
    if (narrativeReport) {
      result.narrative_report = narrativeReport;
    }

    return result;
  }

  private async evaluateNarrativeReport(
    content: string,
    sceneCard: Record<string, unknown>,
    characterProfiles: Record<string, unknown>[],
    worldSettings: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!this.narrativeEngine) return null;

    const context = {
      scene_card: sceneCard,
      character_profiles: characterProfiles,
      world_settings: worldSettings,
    };

    try {
      const report = await this.narrativeEngine.evaluate(content, context);
      return {
        overall_score: Math.round(report.overallScore * 100) / 100,
        overall_level: report.overallLevel,
        module_scores: report.moduleScores,
        summary: report.summary,
        recommended_skills: report.recommendedSkills,
        issues_count: report.allIssues.length,
        critical_count: report.criticalIssues.length,
      };
    } catch {
      return null;
    }
  }

  // ---------- Rule checks ----------

  private applyRuleChecks(result: CriticOutput, content: string): CriticOutput {
    // Forbidden word check
    const forbiddenFound: string[] = [];
    for (const word of FORBIDDEN_WORDS) {
      const count = content.split(word).length - 1;
      if (count > 0) {
        forbiddenFound.push(`"${word}" appears ${count} times`);
      }
    }

    if (forbiddenFound.length > 0) {
      result.suggestions_high.unshift(`Forbidden words found: ${forbiddenFound.join(', ')}`);
      for (const detail of result.dimension_details) {
        if (detail.dimension === 'dialogue_quality') {
          detail.score = Math.max(0, detail.score - forbiddenFound.length);
          detail.issues.push(...forbiddenFound);
        }
      }
    }

    // Recalculate total score
    result.total_score = this.calculateTotalScore(result.dimension_details);

    // Re-decide
    result.decision = this.makeDecision(result);

    return result;
  }

  private calculateTotalScore(dimensions: DimensionScore[]): number {
    let total = 0.0;
    for (const dim of dimensions) {
      const cfg = DIMENSION_CONFIG[dim.dimension];
      if (cfg) {
        total += dim.score * cfg.weight * 10;
      }
    }
    return Math.round(total * 10) / 10;
  }

  private makeDecision(result: CriticOutput): CriticDecision {
    const score = result.total_score;

    // Check LOCK analysis
    let cSufficient = true;
    if (result.lock_analysis) {
      if (lockHasCriticalFailure(result.lock_analysis)) {
        return 'REWRITE';
      }
      cSufficient = lockCScoreSufficient(result.lock_analysis);
    }

    if (score >= NOVEL_PASS_SCORE && cSufficient) {
      return 'APPROVED';
    } else if (score >= NOVEL_HUMAN_REVIEW_SCORE) {
      return 'HUMAN_REVIEW';
    } else if (score >= 50) {
      return 'REVISE';
    } else {
      return 'REWRITE';
    }
  }

  // ---------- Feedback generation ----------

  generateRevisionFeedback(result: CriticOutput): string {
    const lines: string[] = ['## Review Result\n'];
    lines.push(`**Decision**: ${result.decision}`);
    lines.push(`**Total Score**: ${result.total_score}/100\n`);

    if (result.suggestions_high.length > 0) {
      lines.push('### Must Fix\n');
      result.suggestions_high.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push('');
    }

    if (result.suggestions_medium.length > 0) {
      lines.push('### Should Fix\n');
      result.suggestions_medium.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push('');
    }

    if (result.revision_instructions.length > 0) {
      lines.push('### Specific Revision Instructions\n');
      for (const inst of result.revision_instructions) {
        lines.push(`**Location**: ${inst.target}`);
        lines.push(`**Issue**: ${inst.issue}`);
        lines.push(`**Suggestion**: ${inst.suggestion}`);
        lines.push(`**Priority**: ${inst.priority}\n`);
      }
    }

    return lines.join('\n');
  }

  generateActionableFeedback(result: CriticOutput): Record<string, unknown> {
    const issues: string[] = [];
    for (const detail of result.dimension_details) {
      issues.push(...detail.issues);
    }

    const suggestions: string[] = [
      ...result.suggestions_high,
      ...result.suggestions_medium.slice(0, 3),
    ];

    const dimensionScores: Record<string, number> = {};
    for (const detail of result.dimension_details) {
      dimensionScores[detail.dimension] = detail.score;
    }

    if (result.lock_analysis) {
      dimensionScores['L_lead'] = result.lock_analysis.L.score;
      dimensionScores['O_objective'] = result.lock_analysis.O.score;
      dimensionScores['C_confrontation'] = result.lock_analysis.C.score;
      dimensionScores['K_knockout'] = result.lock_analysis.K.score;
    }

    const revisionInstructions = result.revision_instructions.map(inst => ({
      target: inst.target,
      issue: inst.issue,
      suggestion: inst.suggestion,
      priority: inst.priority,
    }));

    return {
      decision: result.decision,
      total_score: result.total_score,
      issues,
      suggestions,
      dimension_scores: dimensionScores,
      revision_instructions: revisionInstructions,
      lock_score: result.lock_score,
      style_score: result.style_score,
      logic_score: result.logic_score,
    };
  }

  shouldRevise(result: CriticOutput): boolean {
    return result.decision === 'REVISE' || result.decision === 'REWRITE';
  }

  shouldHumanReview(result: CriticOutput): boolean {
    return result.decision === 'HUMAN_REVIEW';
  }

  getLowScoreDimensions(result: CriticOutput, threshold: number = 7.0): string[] {
    return result.dimension_details
      .filter(d => d.score < threshold)
      .map(d => d.dimension);
  }
}

// ============================================================
// LangGraph Node
// ============================================================

export function createCriticNode(
  llmService: IAgentLLMService,
): (state: Record<string, unknown>) => Promise<Record<string, unknown>> {
  const agent = new CriticAgent({ llmService });

  return async function criticNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = await agent.review(
      (state['draft_content'] as string) ?? '',
      (state['current_scene_card'] as Record<string, unknown>) ?? {},
      (state['character_profiles'] as Record<string, unknown>[]) ?? [],
      (state['world_settings'] as Record<string, unknown>) ?? {},
      (state['allow_llm_fallback'] as boolean) ?? true,
    );

    return {
      ...state,
      critic_result: result,
      critic_decision: result.decision,
      critic_score: result.total_score,
      revision_feedback: agent.generateRevisionFeedback(result),
    };
  };
}

/** Test helper */
export function createCriticChain(llmService: IAgentLLMService): {
  review(draftContent: string, sceneCard: Record<string, unknown>, characterProfiles: Record<string, unknown>[], worldSettings: Record<string, unknown>): Promise<CriticOutput>;
} {
  const agent = new CriticAgent({ llmService });
  return {
    async review(draftContent, sceneCard, characterProfiles, worldSettings) {
      return agent.review(draftContent, sceneCard, characterProfiles, worldSettings);
    },
  };
}
