/**
 * Dream Evaluator
 *
 * Provides quick evaluation and detailed reporting capabilities
 */

import type { INarrativeLLMClient } from '../types';

import { FictionalDreamEngine } from './engine';
import { DreamStrength } from './engine';
import type { FictionalDreamResult } from './engine';

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface QuickDreamReport {
  strength: DreamStrength;
  score: number;
  weakestLayer: string;
  top3Issues: string[];
  quickWins: string[];
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export class DreamEvaluator {
  private engine: FictionalDreamEngine;

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.engine = new FictionalDreamEngine(llmClient);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Quick scan - keyword analysis without LLM, suitable for bulk screening */
  async quickScan(content: string): Promise<QuickDreamReport> {
    const scores = await this.engine.quickEvaluate(content);

    const overall =
      scores['sympathy'] * 0.2 +
      scores['identification'] * 0.25 +
      scores['empathy'] * 0.25 +
      scores['immersion'] * 0.3;

    const strength = this.determineStrength(overall);

    // Find weakest layer
    const entries = Object.entries(scores) as [string, number][];
    const weakest = entries.reduce((prev, cur) =>
      cur[1] < prev[1] ? cur : prev,
    )[0];

    // Quick issue diagnosis
    const issues: string[] = [];
    if (scores['sympathy'] < 40) {
      issues.push('缺少同情触发器（危险/贫穷/孤独/无助）');
    }
    if (scores['empathy'] < 40) {
      issues.push('感官细节不足，读者无法"感受"角色');
    }
    if (scores['immersion'] < 40) {
      issues.push('缺少内心冲突，读者无法"成为"角色');
    }

    // Quick wins
    const quickWins: string[] = [];
    if (scores['sympathy'] < 60) {
      quickWins.push('在开篇添加一个普遍性困境');
    }
    if (scores['empathy'] < 60) {
      quickWins.push('添加3个以上的感官细节描写');
    }
    if (scores['immersion'] < 60) {
      quickWins.push('让角色面临一个两难抉择');
    }

    return {
      strength,
      score: overall,
      weakestLayer: weakest,
      top3Issues: issues.slice(0, 3),
      quickWins: quickWins.slice(0, 3),
    };
  }

  /** Standard evaluation - full four-layer analysis with LLM */
  async standardEvaluate(
    content: string,
    characterInfo?: Record<string, unknown>,
  ): Promise<FictionalDreamResult> {
    return this.engine.evaluate(content, characterInfo);
  }

  /** Deep diagnosis - includes master comparisons and improvement plan */
  async deepDiagnosis(
    content: string,
    characterInfo?: Record<string, unknown>,
  ): Promise<DeepDiagnosisResult> {
    const result = await this.engine.evaluate(content, characterInfo);

    return {
      result,
      diagnosis: {
        overallHealth: this.assessHealth(result),
        layerDiagnosis: this.diagnoseLayers(result),
        masterComparisons: this.getMasterComparisons(result),
        improvementPlan: this.createImprovementPlan(result),
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private determineStrength(score: number): DreamStrength {
    if (score >= 90) return DreamStrength.HYPNOTIC;
    if (score >= 75) return DreamStrength.STRONG;
    if (score >= 60) return DreamStrength.MODERATE;
    if (score >= 40) return DreamStrength.WEAK;
    return DreamStrength.BROKEN;
  }

  private assessHealth(result: FictionalDreamResult): string {
    if (result.dreamStrength === DreamStrength.HYPNOTIC) {
      return '优秀 - 虚构梦境完美建立';
    }
    if (result.dreamStrength === DreamStrength.STRONG) {
      return '良好 - 略有不足但整体有效';
    }
    if (result.dreamStrength === DreamStrength.MODERATE) {
      return '一般 - 需要针对性改进';
    }
    if (result.dreamStrength === DreamStrength.WEAK) {
      return '较差 - 需要大幅改进';
    }
    return '严重 - 需要全面重构';
  }

  private diagnoseLayers(
    result: FictionalDreamResult,
  ): LayerDiagnosis[] {
    return result.layerScores.map((layer) => ({
      layer: layer.layerName,
      status: layer.isEffective ? 'PASS' : 'FAIL',
      score: layer.score,
      keyFindings: layer.keyFindings,
      priority: layer.score < 50 ? 'HIGH' : layer.score < 70 ? 'MEDIUM' : 'LOW',
    }));
  }

  private getMasterComparisons(
    result: FictionalDreamResult,
  ): MasterComparison[] {
    const comparisons: MasterComparison[] = [];

    if (result.sympathy.overallScore < 60) {
      comparisons.push({
        layer: '同情',
        masterWork: '《悲惨世界》',
        technique: '冉·阿让虽有钱却无人接纳——展示社会偏见造成的无助',
        yourGap: '缺少普遍性困境的展示',
      });
    }

    if (result.empathy.overallScore < 60) {
      comparisons.push({
        layer: '移情',
        masterWork: '《魔女嘉莉》',
        technique: '"她的背部不知不觉挺直了"——通过身体姿态展示内心转变',
        yourGap: '缺少将情感身体化的描写',
      });
    }

    if (result.immersion.overallScore < 60) {
      comparisons.push({
        layer: '沉浸',
        masterWork: '《罪与罚》',
        technique: '"我难道能做吗？这太荒谬了！"——道德困境引发读者参与',
        yourGap: '缺少让读者参与权衡的内心冲突',
      });
    }

    return comparisons;
  }

  private createImprovementPlan(
    result: FictionalDreamResult,
  ): ImprovementItem[] {
    const plan: ImprovementItem[] = [];

    const sorted = [...result.layerScores].sort((a, b) => a.score - b.score);

    for (const layer of sorted) {
      if (layer.score < 80) {
        plan.push({
          priority: layer.score < 50 ? 1 : layer.score < 70 ? 2 : 3,
          layer: layer.layerName,
          currentScore: layer.score,
          targetScore: 80,
          actions: layer.suggestions.slice(0, 2),
          estimatedEffort: layer.score < 50 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    return plan.sort((a, b) => a.priority - b.priority);
  }
}

// ---------------------------------------------------------------------------
// Helper interfaces (used only by deep diagnosis)
// ---------------------------------------------------------------------------

export interface LayerDiagnosis {
  layer: string;
  status: string;
  score: number;
  keyFindings: string[];
  priority: string;
}

export interface MasterComparison {
  layer: string;
  masterWork: string;
  technique: string;
  yourGap: string;
}

export interface ImprovementItem {
  priority: number;
  layer: string;
  currentScore: number;
  targetScore: number;
  actions: string[];
  estimatedEffort: string;
}

export interface DeepDiagnosisResult {
  result: FictionalDreamResult;
  diagnosis: {
    overallHealth: string;
    layerDiagnosis: LayerDiagnosis[];
    masterComparisons: MasterComparison[];
    improvementPlan: ImprovementItem[];
  };
}
