/**
 * Layer 1: Sympathy System
 *
 * Sympathy is the first gate readers pass through to enter a story world.
 * To make readers care about a character, first evoke pity for their situation.
 *
 * Key: Show the character's "universal predicament"
 */

import type { INarrativeLLMClient } from '../types';

// ---------------------------------------------------------------------------
// Enums & types
// ---------------------------------------------------------------------------

export const SympathyTrigger = {
  DANGER: 'danger',
  POVERTY_HUMILIATION: 'poverty_humiliation',
  LONELINESS_EXCLUSION: 'loneliness_exclusion',
  HELPLESSNESS: 'helplessness',
  INJUSTICE: 'injustice',
  LOSS: 'loss',
} as const;

export type SympathyTrigger =
  (typeof SympathyTrigger)[keyof typeof SympathyTrigger];

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface SympathyEvidence {
  triggerType: typeof SympathyTrigger[keyof typeof SympathyTrigger];
  textExcerpt: string;
  effectiveness: number;
  vulnerabilityLevel: number;
  universality: number;
}

export interface SympathyAnalysisResult {
  overallScore: number;
  triggersDetected: SympathyEvidence[];
  vulnerabilityDisplay: number;
  universalPredicament: boolean;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class SympathyAnalyzer {
  private llm: INarrativeLLMClient | null;

  private readonly predicamentKeywords: Record<string, string[]> = {
    [SympathyTrigger.DANGER]: [
      '威胁', '危险', '恐惧', '害怕', '逃离', '追杀', '生命', '死亡',
    ],
    [SympathyTrigger.POVERTY_HUMILIATION]: [
      '贫穷', '穷困', '羞辱', '嘲笑', '轻蔑', '鄙视', '欠债', '卑微',
    ],
    [SympathyTrigger.LONELINESS_EXCLUSION]: [
      '孤独', '排挤', '孤立', '独自', '无人', '被遗弃', '格格不入',
    ],
    [SympathyTrigger.HELPLESSNESS]: [
      '无助', '无力', '绝望', '无奈', '束手无策', '走投无路',
    ],
    [SympathyTrigger.INJUSTICE]: [
      '冤枉', '不公', '误解', '背叛', '陷害', '诬陷',
    ],
    [SympathyTrigger.LOSS]: [
      '失去', '丧失', '离别', '死亡', '分离', '告别',
    ],
  };

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.llm = llmClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Analyze sympathy elements in text */
  async analyze(
    content: string,
    characterInfo?: Record<string, unknown>,
  ): Promise<SympathyAnalysisResult> {
    // 1. Detect universal predicaments
    const triggers = await this.detectTriggers(content, characterInfo);

    // 2. Evaluate vulnerability display
    const vulnerability = await this.evaluateVulnerability(content, triggers);

    // 3. Check universality
    const universality = this.checkUniversality(triggers);

    // 4. Calculate total score
    const overallScore = this.calculateScore(triggers, vulnerability, universality);

    // 5. Generate suggestions
    const suggestions = await this.generateSuggestions(
      content,
      triggers,
      vulnerability,
      overallScore,
    );

    return {
      overallScore,
      triggersDetected: triggers,
      vulnerabilityDisplay: vulnerability,
      universalPredicament: universality,
      suggestions,
    };
  }

  /** Quick detection of universal predicament types */
  detectUniversalPredicament(content: string): string[] {
    const detected: string[] = [];
    for (const [triggerType, keywords] of Object.entries(this.predicamentKeywords)) {
      if (keywords.some((kw) => content.includes(kw))) {
        detected.push(triggerType);
      }
    }
    return detected;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async detectTriggers(
    content: string,
    _characterInfo?: Record<string, unknown>,
  ): Promise<SympathyEvidence[]> {
    const triggers: SympathyEvidence[] = [];

    // Keyword-based initial screening
    for (const [triggerType, keywords] of Object.entries(this.predicamentKeywords)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          const sentences = content.split('。');
          for (const sentence of sentences) {
            if (sentence.includes(keyword)) {
              triggers.push({
                triggerType: triggerType as SympathyTrigger,
                textExcerpt: sentence.trim(),
                effectiveness: 0.5,
                vulnerabilityLevel: 0.5,
                universality: 0.5,
              });
              break;
            }
          }
          break;
        }
      }
    }

    // LLM deep analysis (if available)
    if (this.llm && triggers.length > 0) {
      return this.llmRefineTriggers(content, triggers);
    }

    return triggers;
  }

  private async llmRefineTriggers(
    content: string,
    triggers: SympathyEvidence[],
  ): Promise<SympathyEvidence[]> {
    const triggerList = triggers
      .map((t) => `- ${t.triggerType}: ${t.textExcerpt}`)
      .join('\n');

    const prompt = `分析以下文本中的同情触发元素，评估其有效性。

文本内容：
${content.slice(0, 2000)}

已检测到的触发器：
${triggerList}

请为每个触发器评分（0-1）：
1. effectiveness（有效性）：该困境是否能有效激发读者同情？
2. vulnerability_level（脆弱性）：角色的脆弱性展示得是否充分？
3. universality（普遍性）：这是否是读者能共情的普遍困境？

返回JSON格式。`;

    await this.llm!.generateJson(prompt);
    // TODO: merge LLM response into triggers
    return triggers;
  }

  private async evaluateVulnerability(
    _content: string,
    triggers: SympathyEvidence[],
  ): Promise<number> {
    if (triggers.length === 0) return 0;
    return triggers.reduce((sum, t) => sum + t.vulnerabilityLevel, 0) / triggers.length;
  }

  private checkUniversality(triggers: SympathyEvidence[]): boolean {
    if (triggers.length === 0) return false;
    return triggers.some((t) => t.universality >= 0.6);
  }

  private calculateScore(
    triggers: SympathyEvidence[],
    vulnerability: number,
    universality: boolean,
  ): number {
    if (triggers.length === 0) return 0;

    const triggerScore = Math.min(triggers.length * 15, 40);
    const effectivenessScore =
      (triggers.reduce((sum, t) => sum + t.effectiveness, 0) / triggers.length) * 30;
    const vulnerabilityScore = vulnerability * 20;
    const universalityBonus = universality ? 10 : 0;

    return Math.min(
      triggerScore + effectivenessScore + vulnerabilityScore + universalityBonus,
      100,
    );
  }

  private async generateSuggestions(
    _content: string,
    triggers: SympathyEvidence[],
    vulnerability: number,
    score: number,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (score < 30) {
      suggestions.push('同情元素严重不足！建议在开篇展示角色的普遍性困境');
      suggestions.push('参考技巧：让角色陷入危险/贫穷/孤独/无助等处境');
    }

    if (triggers.length === 0) {
      suggestions.push('未检测到明显的同情触发器，考虑添加：');
      suggestions.push('- 危险困境：让角色面临生命威胁');
      suggestions.push('- 羞辱处境：让角色在公开场合受辱');
      suggestions.push('- 孤独排挤：让角色成为"天鹅中的丑小鸭"');
    }

    if (vulnerability < 0.5) {
      suggestions.push('脆弱性展示不足，建议：');
      suggestions.push('- 展示角色的内心恐惧和不安');
      suggestions.push('- 描写角色在困境中的无力感');
    }

    if (!triggers.some((t) => t.universality >= 0.6)) {
      suggestions.push('困境的普遍性不够，读者可能难以共情');
      suggestions.push('建议使用更普遍的困境类型（如被误解、失去所爱）');
    }

    if (score < 60) {
      suggestions.push('\n大师案例参考：');
      suggestions.push('- 《悲惨世界》：冉·阿让虽有钱却无人接纳，展示社会偏见的无助');
      suggestions.push('- 《魔女嘉莉》：嘉莉因相貌和出身被孤立，引发读者对校园霸凌的共情');
      suggestions.push('- 《傲慢与偏见》：伊丽莎白在舞会上被公开羞辱，激发读者的愤怒和同情');
    }

    return suggestions;
  }
}
