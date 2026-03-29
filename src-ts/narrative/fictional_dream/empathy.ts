/**
 * Layer 3: Empathy System
 *
 * If sympathy is "I understand your feelings", empathy is "I feel your feelings".
 * This is a more intense and direct emotional experience.
 *
 * Core technique: Sensory details that evoke emotion - "implant" readers into the
 * character's body
 */

import type { INarrativeLLMClient } from '../types';

// ---------------------------------------------------------------------------
// Enums & types
// ---------------------------------------------------------------------------

export const SenseType = {
  VISUAL: 'visual',
  AUDITORY: 'auditory',
  TACTILE: 'tactile',
  OLFACTORY: 'olfactory',
  GUSTATORY: 'gustatory',
  KINESTHETIC: 'kinesthetic',
} as const;

export type SenseType = (typeof SenseType)[keyof typeof SenseType];

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface SensoryDetail {
  senseType: SenseType;
  content: string;
  emotionEvoked: string;
  bodyPlantEffect: number;
  textLocation: string;
}

export interface CarrieTechnique {
  isDetected: boolean;
  physicalStateDescriptions: string[];
  emotionThroughBody: string[];
  effectiveness: number;
}

export interface RedBadgeTechnique {
  isDetected: boolean;
  sensoryChain: string[];
  immersiveEffect: number;
}

export interface EmpathyAnalysisResult {
  overallScore: number;
  sensoryDetails: SensoryDetail[];
  sensoryCoverage: Record<SenseType, number>;
  carrieTechnique: CarrieTechnique;
  redBadgeTechnique: RedBadgeTechnique;
  bodyPlantScore: number;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Deepener
// ---------------------------------------------------------------------------

export class EmpathyDeepener {
  private llm: INarrativeLLMClient | null;

  private readonly sensoryKeywords: Record<string, string[]> = {
    [SenseType.VISUAL]: [
      '看见', '望着', '眼前', '光线', '颜色', '影子', '闪烁',
      '目光', '视野', '明亮', '黑暗', '模糊', '清晰',
    ],
    [SenseType.AUDITORY]: [
      '听见', '声音', '回响', '沙沙', '嗡嗡', '尖叫', '低语',
      '轰鸣', '寂静', '嘈杂', '节奏', '旋律',
    ],
    [SenseType.TACTILE]: [
      '触摸', '感觉', '冰冷', '温暖', '粗糙', '光滑', '刺痛',
      '颤抖', '紧握', '抚摸', '压迫', '柔软',
    ],
    [SenseType.OLFACTORY]: [
      '气味', '香气', '臭味', '芬芳', '刺鼻', '清新', '腐烂',
      '闻到', '嗅觉', '弥漫',
    ],
    [SenseType.GUSTATORY]: [
      '味道', '甜', '苦', '酸', '咸', '辣', '品尝',
      '舌尖', '口感', '滋味',
    ],
    [SenseType.KINESTHETIC]: [
      '身体', '肌肉', '紧绷', '放松', '跳动', '颤抖', '僵硬',
      '背部挺直', '手心出汗', '心跳加速', '呼吸急促',
    ],
  };

  private readonly bodyStateKeywords = [
    '心跳', '呼吸', '颤抖', '出汗', '发抖', '紧绷',
    '放松', '僵硬', '软弱', '无力', '挺直', '弯曲',
    '手心', '额头', '脊背', '胸口', '喉咙', '胃部',
  ];

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.llm = llmClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Analyze empathy elements in text */
  async analyze(
    content: string,
    characterInfo?: Record<string, unknown>,
    identificationScore = 0,
  ): Promise<EmpathyAnalysisResult> {
    // 1. Extract sensory details
    const sensoryDetails = await this.extractSensoryDetails(content);

    // 2. Calculate sensory coverage
    const sensoryCoverage = this.calculateCoverage(sensoryDetails);

    // 3. Analyze Carrie technique
    const carrie = await this.analyzeCarrieTechnique(content);

    // 4. Analyze Red Badge technique
    const redBadge = await this.analyzeRedBadgeTechnique(content);

    // 5. Calculate body-plant score
    const bodyPlantScore = this.calculateBodyPlantScore(
      sensoryDetails,
      carrie,
      redBadge,
    );

    // 6. Calculate total score
    const overallScore = this.calculateScore(
      sensoryDetails,
      sensoryCoverage,
      bodyPlantScore,
      identificationScore,
    );

    // 7. Generate suggestions
    const suggestions = await this.generateSuggestions(
      content,
      sensoryDetails,
      sensoryCoverage,
      overallScore,
    );

    return {
      overallScore,
      sensoryDetails,
      sensoryCoverage,
      carrieTechnique: carrie,
      redBadgeTechnique: redBadge,
      bodyPlantScore,
      suggestions,
    };
  }

  /** Quick evaluation of body-plant effect */
  evaluateBodyPlant(content: string): number {
    let score = 0;
    for (const keyword of this.bodyStateKeywords) {
      if (content.includes(keyword)) score += 1;
    }
    return Math.min((score / this.bodyStateKeywords.length) * 100, 100);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async extractSensoryDetails(content: string): Promise<SensoryDetail[]> {
    const details: SensoryDetail[] = [];
    const sentences = content.split('。');

    for (const sentence of sentences) {
      for (const [senseType, keywords] of Object.entries(this.sensoryKeywords)) {
        for (const keyword of keywords) {
          if (sentence.includes(keyword)) {
            details.push({
              senseType: senseType as SenseType,
              content: sentence.trim(),
              emotionEvoked: '待分析',
              bodyPlantEffect: 0.5,
              textLocation: sentence.slice(0, 20),
            });
            break;
          }
        }
      }
    }

    return details;
  }

  private calculateCoverage(details: SensoryDetail[]): Record<SenseType, number> {
    const coverage: Record<string, number> = {};
    for (const sense of Object.values(SenseType)) {
      coverage[sense] = 0;
    }
    for (const detail of details) {
      coverage[detail.senseType] = (coverage[detail.senseType] ?? 0) + 1;
    }
    return coverage as Record<SenseType, number>;
  }

  private async analyzeCarrieTechnique(content: string): Promise<CarrieTechnique> {
    const physicalStateDescriptions: string[] = [];

    for (const keyword of this.bodyStateKeywords) {
      if (content.includes(keyword)) {
        const sentences = content.split('。');
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            physicalStateDescriptions.push(sentence.trim());
            break;
          }
        }
      }
    }

    const isDetected = physicalStateDescriptions.length > 0;
    const effectiveness = isDetected
      ? Math.min(physicalStateDescriptions.length * 0.2, 1)
      : 0;

    return {
      isDetected,
      physicalStateDescriptions,
      emotionThroughBody: [],
      effectiveness,
    };
  }

  private async analyzeRedBadgeTechnique(content: string): Promise<RedBadgeTechnique> {
    const sentences = content.split('。');
    const sensoryChain: string[] = [];
    let consecutiveSensory = 0;
    let maxChain = 0;

    for (const sentence of sentences) {
      let hasSensory = false;
      for (const keywords of Object.values(this.sensoryKeywords)) {
        if (keywords.some((kw) => sentence.includes(kw))) {
          hasSensory = true;
          break;
        }
      }

      if (hasSensory) {
        consecutiveSensory += 1;
        sensoryChain.push(sentence.trim());
      } else {
        maxChain = Math.max(maxChain, consecutiveSensory);
        consecutiveSensory = 0;
      }
    }

    maxChain = Math.max(maxChain, consecutiveSensory);

    const isDetected = maxChain >= 3;
    const immersiveEffect = isDetected ? Math.min(maxChain * 0.15, 1) : 0;

    return { isDetected, sensoryChain, immersiveEffect };
  }

  private calculateBodyPlantScore(
    details: SensoryDetail[],
    carrie: CarrieTechnique,
    redBadge: RedBadgeTechnique,
  ): number {
    const base = Math.min(details.length * 5, 40);
    const carrieBonus = carrie.isDetected ? carrie.effectiveness * 30 : 0;
    const redBadgeBonus = redBadge.isDetected ? redBadge.immersiveEffect * 30 : 0;
    return Math.min(base + carrieBonus + redBadgeBonus, 100);
  }

  private calculateScore(
    details: SensoryDetail[],
    coverage: Record<SenseType, number>,
    bodyPlant: number,
    identificationScore: number,
  ): number {
    const idBase = Math.min((identificationScore / 100) * 15, 15);
    const detailScore = Math.min(details.length * 5, 25);
    const diversity = Object.values(coverage).filter((c) => c > 0).length;
    const diversityScore = (diversity / Object.keys(SenseType).length) * 20;
    const bodyPlantScore = bodyPlant * 0.4;

    return Math.min(idBase + detailScore + diversityScore + bodyPlantScore, 100);
  }

  private async generateSuggestions(
    _content: string,
    details: SensoryDetail[],
    coverage: Record<SenseType, number>,
    score: number,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (score < 40) {
      suggestions.push('移情元素严重不足！读者无法真正"感受"角色的体验');
    }

    const missingSenses = Object.entries(coverage)
      .filter(([, count]) => count === 0)
      .map(([sense]) => sense);

    if (missingSenses.length > 0) {
      suggestions.push(`缺少以下感官描写: [${missingSenses.join(', ')}]`);
      suggestions.push('建议添加更多感官细节，让读者"身临其境"');
    }

    if ((coverage[SenseType.KINESTHETIC] ?? 0) === 0) {
      suggestions.push('\n嘉莉技巧建议：');
      suggestions.push('- 不要只说"角色很紧张"，而要描写身体状态');
      suggestions.push('- 例如："她的背部不知不觉挺直了"');
      suggestions.push('- 例如："他感到手心开始出汗，心跳加速"');
    }

    if (details.length < 5) {
      suggestions.push('\n红色英勇勋章技巧建议：');
      suggestions.push('- 使用连续的感官细节链创造沉浸感');
      suggestions.push('- 例如：描写物品撞击身体的节奏、背包的重量、武器的触感');
    }

    if (score < 60) {
      suggestions.push('\n大师案例参考：');
      suggestions.push('- 《魔女嘉莉》："一半是羞愧，一半是挑衅的兴奋"——通过复杂情感的身体化表达');
      suggestions.push('- 《红色英勇勋章》：餐具盒、背包、步枪——三重感官细节链');
    }

    return suggestions;
  }
}
