/**
 * Fictional Dream Engine
 *
 * The ultimate goal of fiction writing is to create a "fictional dream" -
 * a powerful barrier that can completely detach readers from the real world,
 * making them "live" inside the story.
 *
 * Four-layer emotional progression:
 * Sympathy -> Identification -> Empathy -> Immersion
 */

import type { INarrativeLLMClient } from '../types';

import { SympathyAnalyzer } from './sympathy';
import type { SympathyAnalysisResult } from './sympathy';

import { IdentificationBuilder } from './identification';
import type { IdentificationAnalysisResult } from './identification';

import { EmpathyDeepener } from './empathy';
import type { EmpathyAnalysisResult } from './empathy';

import { ImmersionCatalyst } from './immersion';
import type { ImmersionAnalysisResult } from './immersion';

// ---------------------------------------------------------------------------
// Enums & types
// ---------------------------------------------------------------------------

export const DreamStrength = {
  HYPNOTIC: 'hypnotic',
  STRONG: 'strong',
  MODERATE: 'moderate',
  WEAK: 'weak',
  BROKEN: 'broken',
} as const;

export type DreamStrength = (typeof DreamStrength)[keyof typeof DreamStrength];

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface DreamLayerScore {
  layerName: string;
  score: number;
  isEffective: boolean;
  keyFindings: string[];
  suggestions: string[];
}

export interface FictionalDreamResult {
  overallScore: number;
  dreamStrength: DreamStrength;
  sympathy: SympathyAnalysisResult;
  identification: IdentificationAnalysisResult;
  empathy: EmpathyAnalysisResult;
  immersion: ImmersionAnalysisResult;
  layerScores: DreamLayerScore[];
  masterSuggestions: string[];
  dreamBreakers: string[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class FictionalDreamEngine {
  private llm: INarrativeLLMClient | null;
  private sympathyAnalyzer: SympathyAnalyzer;
  private identificationBuilder: IdentificationBuilder;
  private empathyDeepener: EmpathyDeepener;
  private immersionCatalyst: ImmersionCatalyst;

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.llm = llmClient;
    this.sympathyAnalyzer = new SympathyAnalyzer(llmClient);
    this.identificationBuilder = new IdentificationBuilder(llmClient);
    this.empathyDeepener = new EmpathyDeepener(llmClient);
    this.immersionCatalyst = new ImmersionCatalyst(llmClient);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Evaluate the fictional-dream effect of a text */
  async evaluate(
    content: string,
    characterInfo?: Record<string, unknown>,
    _characterGoal?: string,
  ): Promise<FictionalDreamResult> {
    const layerScores: DreamLayerScore[] = [];

    // === Layer 1: Sympathy ===
    const sympathyResult = await this.sympathyAnalyzer.analyze(
      content,
      characterInfo,
    );
    layerScores.push({
      layerName: '同情 (Sympathy)',
      score: sympathyResult.overallScore,
      isEffective: sympathyResult.overallScore >= 60,
      keyFindings: [
        `检测到 ${sympathyResult.triggersDetected.length} 个同情触发器`,
        `脆弱性展示: ${(sympathyResult.vulnerabilityDisplay * 100).toFixed(0)}%`,
        `普遍性困境: ${sympathyResult.universalPredicament ? '是' : '否'}`,
      ],
      suggestions: sympathyResult.suggestions.slice(0, 3),
    });

    // === Layer 2: Identification ===
    const identificationResult = await this.identificationBuilder.analyze(
      content,
      characterInfo,
      sympathyResult.overallScore,
    );
    layerScores.push({
      layerName: '认同 (Identification)',
      score: identificationResult.overallScore,
      isEffective: identificationResult.overallScore >= 60,
      keyFindings: [
        `目标清晰度: ${(identificationResult.goalClarity * 100).toFixed(0)}%`,
        `目标值得性: ${(identificationResult.goalWorthiness * 100).toFixed(0)}%`,
        `教父技巧: ${identificationResult.godfatherTechnique.isDetected ? '已检测' : '未检测'}`,
      ],
      suggestions: identificationResult.suggestions.slice(0, 3),
    });

    // === Layer 3: Empathy ===
    const empathyResult = await this.empathyDeepener.analyze(
      content,
      characterInfo,
      identificationResult.overallScore,
    );
    layerScores.push({
      layerName: '移情 (Empathy)',
      score: empathyResult.overallScore,
      isEffective: empathyResult.overallScore >= 60,
      keyFindings: [
        `感官细节数: ${empathyResult.sensoryDetails.length}`,
        `身体植入分: ${empathyResult.bodyPlantScore.toFixed(1)}`,
        `嘉莉技巧: ${empathyResult.carrieTechnique.isDetected ? '已检测' : '未检测'}`,
      ],
      suggestions: empathyResult.suggestions.slice(0, 3),
    });

    // === Layer 4: Immersion ===
    const immersionResult = await this.immersionCatalyst.analyze(
      content,
      characterInfo,
      empathyResult.overallScore,
    );
    layerScores.push({
      layerName: '沉浸 (Immersion)',
      score: immersionResult.overallScore,
      isEffective: immersionResult.overallScore >= 60,
      keyFindings: [
        `内心冲突数: ${immersionResult.internalConflicts.length}`,
        `读者参与度: ${(immersionResult.readerParticipation * 100).toFixed(0)}%`,
        `抉择紧迫感: ${(immersionResult.choiceUrgency * 100).toFixed(0)}%`,
      ],
      suggestions: immersionResult.suggestions.slice(0, 3),
    });

    // === Calculate overall score ===
    const overallScore = this.calculateOverallScore(layerScores);
    const dreamStrength = this.determineStrength(overallScore);

    // === Detect dream breakers ===
    const dreamBreakers = await this.detectDreamBreakers(content);

    // === Generate master suggestions ===
    const masterSuggestions = this.generateMasterSuggestions(
      layerScores,
      dreamStrength,
      dreamBreakers,
    );

    return {
      overallScore,
      dreamStrength,
      sympathy: sympathyResult,
      identification: identificationResult,
      empathy: empathyResult,
      immersion: immersionResult,
      layerScores,
      masterSuggestions,
      dreamBreakers,
    };
  }

  /** Quick evaluation (no LLM required) */
  async quickEvaluate(content: string): Promise<Record<string, number>> {
    const sympathyScore = this.sympathyAnalyzer.detectUniversalPredicament(content);
    const empathyScore = this.empathyDeepener.evaluateBodyPlant(content);
    const immersionScore = this.immersionCatalyst.detectMoralDilemma(content) ? 50 : 20;

    return {
      sympathy: sympathyScore.length * 25,
      identification: 50,
      empathy: empathyScore,
      immersion: immersionScore,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Weighted score:
   * - Sympathy 20%  (gate layer)
   * - Identification 25% (key layer)
   * - Empathy 25% (experience layer)
   * - Immersion 30% (peak layer)
   */
  private calculateOverallScore(layerScores: DreamLayerScore[]): number {
    const weights = [0.2, 0.25, 0.25, 0.3];
    if (layerScores.length !== 4) return 0;
    return layerScores.reduce(
      (sum, layer, i) => sum + layer.score * weights[i],
      0,
    );
  }

  private determineStrength(score: number): DreamStrength {
    if (score >= 90) return DreamStrength.HYPNOTIC;
    if (score >= 75) return DreamStrength.STRONG;
    if (score >= 60) return DreamStrength.MODERATE;
    if (score >= 40) return DreamStrength.WEAK;
    return DreamStrength.BROKEN;
  }

  private async detectDreamBreakers(content: string): Promise<string[]> {
    const breakers: string[] = [];

    // Overly explicit authorial explanations
    if (content.includes('读者会') || content.includes('观众会')) {
      breakers.push('检测到作者跳出叙事的解释性语言');
    }

    // Info dump detection
    const infoDumpKeywords = ['首先', '其次', '第一', '第二', '总之'];
    const dumpCount = infoDumpKeywords.filter((kw) => content.includes(kw)).length;
    if (dumpCount >= 3) {
      breakers.push('可能存在信息堆砌，建议通过场景展示');
    }

    return breakers;
  }

  private generateMasterSuggestions(
    layerScores: DreamLayerScore[],
    strength: DreamStrength,
    breakers: string[],
  ): string[] {
    const suggestions: string[] = [];

    // Overall status
    if (strength === DreamStrength.HYPNOTIC) {
      suggestions.push('虚构梦境效果极佳！读者将完全沉浸其中');
    } else if (strength === DreamStrength.STRONG) {
      suggestions.push('虚构梦境效果良好，有几处可以优化');
    } else if (strength === DreamStrength.MODERATE) {
      suggestions.push('虚构梦境基本建立，但需要加强');
    } else if (strength === DreamStrength.WEAK) {
      suggestions.push('虚构梦境较弱，读者可能频繁出戏');
    } else {
      suggestions.push('虚构梦境未能建立，需要全面重构');
    }

    // Weakest layer
    const weakest = layerScores.reduce((prev, cur) =>
      cur.score < prev.score ? cur : prev,
    );
    suggestions.push(`\n最需要加强的层级: ${weakest.layerName}`);
    suggestions.push(...weakest.suggestions);

    // Layer continuity
    for (let i = 0; i < layerScores.length - 1; i++) {
      const current = layerScores[i];
      const next = layerScores[i + 1];
      if (current.score < 50 && next.score > 60) {
        suggestions.push(
          `\n层级断裂警告: ${current.layerName} 未能有效支撑 ${next.layerName}`,
        );
      }
    }

    // Dream breakers
    if (breakers.length > 0) {
      suggestions.push('\n梦境破坏者:');
      suggestions.push(...breakers);
    }

    return suggestions;
  }
}
