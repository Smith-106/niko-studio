/**
 * Layer 2: Identification System
 *
 * Identification is a deeper emotional bond than sympathy.
 * It means readers not only pity the character's predicament but also support
 * their goals, recognise their courage, and strongly hope they succeed.
 *
 * Key technique: Godfather technique - bind a morally flawed character to a noble goal
 */

import type { INarrativeLLMClient } from '../types';

// ---------------------------------------------------------------------------
// Enums & types
// ---------------------------------------------------------------------------

export const IdentificationElement = {
  GOAL_SUPPORT: 'goal_support',
  COURAGE_RECOGNITION: 'courage_recognition',
  NOBLE_VALUE_BINDING: 'noble_value_binding',
  JUSTICE_EMBODIMENT: 'justice_embodiment',
} as const;

export type IdentificationElement =
  (typeof IdentificationElement)[keyof typeof IdentificationElement];

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface GodfatherTechnique {
  isDetected: boolean;
  moralFlaw: string | null;
  nobleGoal: string | null;
  sympathyTransferPath: string | null;
  effectiveness: number;
}

export interface IdentificationEvidence {
  elementType: IdentificationElement;
  textExcerpt: string;
  goalWorthiness: number;
  readerSupportLevel: number;
  nobleValue?: string;
}

export interface IdentificationAnalysisResult {
  overallScore: number;
  elementsDetected: IdentificationEvidence[];
  godfatherTechnique: GodfatherTechnique;
  goalClarity: number;
  goalWorthiness: number;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export class IdentificationBuilder {
  private llm: INarrativeLLMClient | null;

  private readonly nobleValues = [
    '正义', '公平', '保护', '拯救', '牺牲', '勇气', '忠诚',
    '自由', '尊严', '真相', '家庭', '爱', '希望', '守护',
  ];

  private readonly goalKeywords = [
    '必须', '一定要', '决心', '发誓', '目标', '使命',
    '为了', '不惜', '无论如何', '拯救', '保护', '复仇',
  ];

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.llm = llmClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Analyze identification elements in text */
  async analyze(
    content: string,
    characterInfo?: Record<string, unknown>,
    sympathyScore = 0,
  ): Promise<IdentificationAnalysisResult> {
    // 1. Detect identification elements
    const elements = await this.detectElements(content, characterInfo);

    // 2. Analyze godfather technique
    const godfather = await this.analyzeGodfatherTechnique(content, characterInfo);

    // 3. Evaluate goal clarity and worthiness
    const goalClarity = await this.evaluateGoalClarity(content);
    const goalWorthiness = await this.evaluateGoalWorthiness(content, elements);

    // 4. Calculate total score (identification requires sympathy as foundation)
    const overallScore = this.calculateScore(
      elements,
      godfather,
      goalClarity,
      goalWorthiness,
      sympathyScore,
    );

    // 5. Generate suggestions
    const suggestions = await this.generateSuggestions(
      content,
      elements,
      godfather,
      goalClarity,
      overallScore,
    );

    return {
      overallScore,
      elementsDetected: elements,
      godfatherTechnique: godfather,
      goalClarity,
      goalWorthiness,
      suggestions,
    };
  }

  /** Check whether the godfather technique is applicable */
  detectGodfatherPotential(
    characterHasMoralFlaw: boolean,
    characterGoal: string,
  ): boolean {
    if (!characterHasMoralFlaw) return false;
    return this.nobleValues.some((value) => characterGoal.includes(value));
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async detectElements(
    content: string,
    _characterInfo?: Record<string, unknown>,
  ): Promise<IdentificationEvidence[]> {
    const elements: IdentificationEvidence[] = [];

    // Detect goal support
    for (const keyword of this.goalKeywords) {
      if (content.includes(keyword)) {
        const sentences = content.split('。');
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            elements.push({
              elementType: IdentificationElement.GOAL_SUPPORT,
              textExcerpt: sentence.trim(),
              goalWorthiness: 0.5,
              readerSupportLevel: 0.5,
            });
            break;
          }
        }
        break;
      }
    }

    // Detect noble value binding
    for (const value of this.nobleValues) {
      if (content.includes(value)) {
        const sentences = content.split('。');
        for (const sentence of sentences) {
          if (sentence.includes(value)) {
            elements.push({
              elementType: IdentificationElement.NOBLE_VALUE_BINDING,
              textExcerpt: sentence.trim(),
              goalWorthiness: 0.7,
              readerSupportLevel: 0.6,
              nobleValue: value,
            });
            break;
          }
        }
        break;
      }
    }

    return elements;
  }

  private async analyzeGodfatherTechnique(
    content: string,
    characterInfo?: Record<string, unknown>,
  ): Promise<GodfatherTechnique> {
    if (!this.llm) {
      return this.emptyGodfather();
    }

    const prompt = `分析以下文本是否运用了"教父技巧"：

教父技巧定义：
- 主角可能存在道德瑕疵（如反派、罪犯、道德灰色人物）
- 但通过将其与崇高目标（正义、保护弱者）绑定
- 使读者认同并支持这个本不完美的角色

文本内容：
${content.slice(0, 2000)}

角色信息：
${JSON.stringify(characterInfo)}

请分析：
1. 主角是否存在道德瑕疵？具体是什么？
2. 主角的目标是否触及崇高价值？
3. 是否存在同情转移路径？（通过另一角色引入）
4. 教父技巧的有效性评分（0-1）

返回JSON格式。`;

    await this.llm.generateJson(prompt);
    return this.emptyGodfather();
  }

  private emptyGodfather(): GodfatherTechnique {
    return {
      isDetected: false,
      moralFlaw: null,
      nobleGoal: null,
      sympathyTransferPath: null,
      effectiveness: 0,
    };
  }

  private async evaluateGoalClarity(content: string): Promise<number> {
    const goalIndicators = ['必须', '一定要', '目标是', '为了', '决心'];
    const clarity =
      goalIndicators.filter((ind) => content.includes(ind)).length /
      goalIndicators.length;
    return Math.min(clarity * 2, 1);
  }

  private async evaluateGoalWorthiness(
    _content: string,
    elements: IdentificationEvidence[],
  ): Promise<number> {
    if (elements.length === 0) return 0;

    const nobleElements = elements.filter(
      (e) => e.elementType === IdentificationElement.NOBLE_VALUE_BINDING,
    );

    if (nobleElements.length > 0) {
      return (
        nobleElements.reduce((sum, e) => sum + e.goalWorthiness, 0) /
        nobleElements.length
      );
    }

    return (
      elements.reduce((sum, e) => sum + e.goalWorthiness, 0) / elements.length
    );
  }

  private calculateScore(
    elements: IdentificationEvidence[],
    godfather: GodfatherTechnique,
    goalClarity: number,
    goalWorthiness: number,
    sympathyScore: number,
  ): number {
    const sympathyBase = Math.min((sympathyScore / 100) * 20, 20);
    const elementScore = Math.min(elements.length * 10, 25);
    const clarityScore = goalClarity * 15;
    const worthinessScore = goalWorthiness * 20;
    const godfatherBonus = godfather.isDetected
      ? godfather.effectiveness * 20
      : 0;

    return Math.min(
      sympathyBase + elementScore + clarityScore + worthinessScore + godfatherBonus,
      100,
    );
  }

  private async generateSuggestions(
    _content: string,
    elements: IdentificationEvidence[],
    godfather: GodfatherTechnique,
    goalClarity: number,
    score: number,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (score < 40) {
      suggestions.push('认同元素严重不足！读者可能不会支持角色的目标');
    }

    if (goalClarity < 0.5) {
      suggestions.push('目标不够清晰，建议：');
      suggestions.push('- 让角色明确表达其核心目标');
      suggestions.push('- 展示角色为目标付出的努力和决心');
    }

    if (!elements.some((e) => e.elementType === IdentificationElement.NOBLE_VALUE_BINDING)) {
      suggestions.push('未检测到崇高价值绑定，考虑：');
      suggestions.push('- 将角色目标与正义、保护弱者等崇高价值关联');
      suggestions.push('- 展示角色的目标如何帮助他人或社会');
    }

    if (!godfather.isDetected && score < 60) {
      suggestions.push('\n考虑使用"教父技巧"：');
      suggestions.push('- 即使角色有道德瑕疵，也可通过崇高目标赢得认同');
      suggestions.push('- 可通过另一个受害者的视角引入，转移读者的同情');
      suggestions.push('- 参考《教父》开场：通过伯纳塞拉的困境，让柯里昂成为正义化身');
    }

    return suggestions;
  }
}
