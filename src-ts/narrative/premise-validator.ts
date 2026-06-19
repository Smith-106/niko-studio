/**
 * Premise Validator
 *
 * Based on Frey's premise theory:
 * - Premise = Character Trait + Conflict -> Conclusion
 * - Premise is the blueprint and validation tool for a story
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums
// ============================================================

export enum PremiseType {
  CHAIN_REACTION = 'chain_reaction',
  REVERSAL = 'reversal',
  SITUATIONAL = 'situational',
}

// ============================================================
// Data Types
// ============================================================

export interface Premise {
  characterTrait: string;
  conflict: string;
  conclusion: string;
  premiseType: PremiseType;
  fullStatement: string;
}

export function premiseFromStatement(
  statement: string,
  premiseType: PremiseType = PremiseType.REVERSAL,
): Premise {
  return {
    characterTrait: '',
    conflict: '',
    conclusion: '',
    premiseType,
    fullStatement: statement,
  };
}

export interface PremiseAlignment {
  sceneId: string;
  alignmentScore: number;
  contribution: string;
  evidence: string[];
  driftDetected: boolean;
  driftDescription: string | null;
}

export interface PremiseValidationResult {
  premise: Premise;
  sceneAlignments: PremiseAlignment[];
  overallAlignment: number;
  proofProgress: number;
  driftCount: number;
  criticalIssues: string[];
  realignmentSuggestions: string[];
}

export function computeValidationResult(
  premise: Premise,
  sceneAlignments: PremiseAlignment[],
): PremiseValidationResult {
  const overallAlignment =
    sceneAlignments.length > 0
      ? (sceneAlignments.reduce((sum, a) => sum + a.alignmentScore, 0) /
          sceneAlignments.length) *
        10
      : 0;

  const driftCount = sceneAlignments.filter((a) => a.driftDetected).length;

  return {
    premise,
    sceneAlignments,
    overallAlignment,
    proofProgress: 0,
    driftCount,
    criticalIssues: [],
    realignmentSuggestions: [],
  };
}

// ============================================================
// LLM Prompts
// ============================================================

const PREMISE_PARSING_PROMPT = `
## 预设解析 (Premise Parsing)

将以下故事预设解析为结构化格式。

**预设定义**:
预设 = 角色特质 + 冲突 -> 结局
公式: "X 导致 Y" 或 "X vs Y = Z"

**预设类型**:
1. 连锁反应式 (chain_reaction): 初始事件引发一连串后果
2. 反向式 (reversal): 两种力量竞争，一方胜出
3. 情景式 (situational): 特定环境对所有角色的影响

**待解析预设**:
{premise_statement}

请输出JSON格式:
`;

const SCENE_ALIGNMENT_PROMPT = `
## 场景-预设对齐验证 (Scene-Premise Alignment)

验证以下场景是否在证明故事预设。

**核心问题**: 这个场景的发生，是否有助于证明预设？

**故事预设**:
{premise}

**场景内容**:
{scene_content}

**场景信息**:
- 场景ID: {scene_id}
- 场景目标: {scene_objective}

请输出JSON格式:
`;

const PREMISE_PROGRESS_PROMPT = `
## 预设证明进度追踪 (Premise Proof Progress)

根据已完成的场景，评估预设的证明进度。

**故事预设**:
{premise}

**已完成场景摘要**:
{scenes_summary}

请输出JSON格式:
`;

// ============================================================
// PremiseValidator
// ============================================================

export class PremiseValidator {
  private llmClient: INarrativeLLMClient | null;
  private currentPremise: Premise | null = null;
  private sceneAlignments: PremiseAlignment[] = [];

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  async parsePremise(premiseStatement: string): Promise<Premise> {
    if (!this.llmClient) {
      const premise = premiseFromStatement(premiseStatement);
      this.currentPremise = premise;
      return premise;
    }

    const prompt = PREMISE_PARSING_PROMPT.replace(
      '{premise_statement}',
      premiseStatement,
    );

    const result = await this.llmClient.generateJson<{
      character_trait: string;
      conflict: string;
      conclusion: string;
      premise_type: string;
    }>(prompt);

    const premiseType =
      result.premise_type === 'chain_reaction'
        ? PremiseType.CHAIN_REACTION
        : result.premise_type === 'situational'
          ? PremiseType.SITUATIONAL
          : PremiseType.REVERSAL;

    const premise: Premise = {
      characterTrait: result.character_trait,
      conflict: result.conflict,
      conclusion: result.conclusion,
      premiseType,
      fullStatement: premiseStatement,
    };

    this.currentPremise = premise;
    return premise;
  }

  async validateScene(
    sceneId: string,
    sceneContent: string,
    sceneObjective = '',
  ): Promise<PremiseAlignment> {
    if (!this.currentPremise) {
      throw new Error('请先使用 parsePremise() 设置预设');
    }

    if (!this.llmClient) {
      return this.mockAlignment(sceneId);
    }

    const prompt = SCENE_ALIGNMENT_PROMPT.replace(
      '{premise}',
      this.currentPremise.fullStatement,
    )
      .replace('{scene_content}', sceneContent)
      .replace('{scene_id}', sceneId)
      .replace('{scene_objective}', sceneObjective);

    const result = await this.llmClient.generateJson<{
      alignment_score: number;
      contribution: string;
      evidence: string[];
      drift_detected: boolean;
      drift_description: string;
    }>(prompt);

    const alignment: PremiseAlignment = {
      sceneId,
      alignmentScore: result.alignment_score,
      contribution: result.contribution,
      evidence: result.evidence ?? [],
      driftDetected: result.drift_detected ?? false,
      driftDescription: result.drift_description ?? null,
    };

    this.sceneAlignments.push(alignment);
    return alignment;
  }

  async trackPremiseProgress(
    scenesSummary: string,
  ): Promise<Record<string, unknown>> {
    if (!this.currentPremise) {
      throw new Error('请先使用 parsePremise() 设置预设');
    }

    if (!this.llmClient) {
      return {
        proof_progress: 50.0,
        current_stage: '发展中',
        remaining_elements: ['需要更多冲突升级'],
        trajectory: '正在正确轨道上',
      };
    }

    const prompt = PREMISE_PROGRESS_PROMPT.replace(
      '{premise}',
      this.currentPremise.fullStatement,
    ).replace('{scenes_summary}', scenesSummary);

    return this.llmClient.generateJson<Record<string, unknown>>(prompt);
  }

  detectPremiseDrift(): PremiseAlignment[] {
    return this.sceneAlignments.filter((a) => a.driftDetected);
  }

  getValidationResult(): PremiseValidationResult {
    if (!this.currentPremise) {
      throw new Error('请先使用 parsePremise() 设置预设');
    }

    const result = computeValidationResult(
      this.currentPremise,
      this.sceneAlignments,
    );

    const drifts = this.detectPremiseDrift();
    if (drifts.length > 0) {
      result.criticalIssues.push(
        `发现 ${drifts.length} 个场景偏离预设`,
      );
      for (const drift of drifts) {
        if (drift.driftDescription) {
          result.realignmentSuggestions.push(
            `场景 ${drift.sceneId}: ${drift.driftDescription}`,
          );
        }
      }
    }

    return result;
  }

  suggestRealignment(sceneId: string): string[] {
    const alignment = this.sceneAlignments.find(
      (a) => a.sceneId === sceneId,
    );
    if (!alignment) return ['场景未找到'];
    if (!alignment.driftDetected)
      return ['场景与预设对齐良好，无需修改'];

    return [
      `当前贡献: ${alignment.contribution}`,
      `偏离描述: ${alignment.driftDescription}`,
      '建议修改方向:',
      `- 确保场景推进预设: ${this.currentPremise?.fullStatement ?? ''}`,
      '- 检查角色行为是否符合预设中的角色特质',
      '- 确保冲突指向预设中的结局',
    ];
  }

  reset(): void {
    this.currentPremise = null;
    this.sceneAlignments = [];
  }

  private mockAlignment(sceneId: string): PremiseAlignment {
    return {
      sceneId,
      alignmentScore: 7.0,
      contribution: '场景推进了主要冲突',
      evidence: ['冲突升级', '角色面临选择'],
      driftDetected: false,
      driftDescription: null,
    };
  }
}

// ============================================================
// M14: Outline Quality Assessment
// Source: 《小说的骨架:好提纲成就好故事》
// ============================================================

export enum OutlineQualityDimension {
  CHARACTER_ARC_CLARITY = 'character_arc_clarity',
  CONFLICT_SUSTAINABILITY = 'conflict_sustainability',
  PACING_STRUCTURE = 'pacing_structure',
  THEMATIC_COHERENCE = 'thematic_coherence',
  HOOK_STRENGTH = 'hook_strength',
}

export interface DimensionAssessment {
  dimension: OutlineQualityDimension;
  label: string;
  score: number;
  confidence: number;
  evidence: string[];
  issues: string[];
  suggestions: string[];
}

export interface OutlineAssessment {
  outlineText: string;
  dimensions: DimensionAssessment[];
  overallQualityScore: number;
  qualityLevel: string;
  criticalGaps: string[];
  actionableSuggestions: {
    dimension: OutlineQualityDimension;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export const DIMENSION_THRESHOLDS: Record<
  OutlineQualityDimension,
  { threshold: number; weight: number; description: string }
> = {
  [OutlineQualityDimension.CHARACTER_ARC_CLARITY]: {
    threshold: 5,
    weight: 0.25,
    description: '大纲是否清晰展示了主角的成长/变化轨迹',
  },
  [OutlineQualityDimension.CONFLICT_SUSTAINABILITY]: {
    threshold: 5,
    weight: 0.25,
    description: '核心冲突是否能支撑完整故事长度',
  },
  [OutlineQualityDimension.PACING_STRUCTURE]: {
    threshold: 5,
    weight: 0.2,
    description: '情节节奏是否有合理的高低起伏',
  },
  [OutlineQualityDimension.THEMATIC_COHERENCE]: {
    threshold: 5,
    weight: 0.15,
    description: '主题是否贯穿始终且一致',
  },
  [OutlineQualityDimension.HOOK_STRENGTH]: {
    threshold: 6,
    weight: 0.15,
    description: '开篇钩子是否有足够的吸引力',
  },
};

export const OUTLINE_QUALITY_PATTERNS: Record<
  OutlineQualityDimension,
  { positive: string[]; negative: string[] }
> = {
  [OutlineQualityDimension.CHARACTER_ARC_CLARITY]: {
    positive: ['成长', '改变', '转变', '成为', '学会', '认识到', '觉醒', '蜕变', '不再', '后来'],
    negative: ['一成不变', '始终如一', '依然', '照旧'],
  },
  [OutlineQualityDimension.CONFLICT_SUSTAINABILITY]: {
    positive: ['对抗', '冲突', '矛盾', '阻碍', '升级', '加剧', '反复', '多次', '层层', '一波三折'],
    negative: ['轻易', '轻松', '顺利', '毫无阻挡', '一帆风顺'],
  },
  [OutlineQualityDimension.HOOK_STRENGTH]: {
    positive: ['悬念', '意外', '发现', '谜团', '危机', '转折', '突然', '秘密', '不该', '竟然'],
    negative: ['日常', '平常', '惯例'],
  },
  [OutlineQualityDimension.PACING_STRUCTURE]: {
    positive: ['高潮', '低谷', '转折', '平静', '爆发', '铺垫', '伏笔', '前后', '呼应'],
    negative: ['平铺直叙', '流水账', '平淡'],
  },
  [OutlineQualityDimension.THEMATIC_COHERENCE]: {
    positive: ['主题', '核心', '主线', '围绕', '贯穿', '呼应', '照应'],
    negative: ['偏离', '跑题', '断裂'],
  },
};

export function assessOutlineQuality(outlineText: string): OutlineAssessment {
  const dimensions: DimensionAssessment[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of Object.values(OutlineQualityDimension)) {
    const patterns = OUTLINE_QUALITY_PATTERNS[dim];
    const threshold = DIMENSION_THRESHOLDS[dim];

    const positiveHits = patterns.positive.filter((kw) => outlineText.includes(kw));
    const negativeHits = patterns.negative.filter((kw) => outlineText.includes(kw));

    const rawScore = positiveHits.length * 2;
    const penalty = negativeHits.length * 1.0;
    const score = Math.max(0, Math.min(10, Math.round((rawScore - penalty) * 10) / 10));

    const confidence = positiveHits.length > 0
      ? Math.min(1, positiveHits.length / patterns.positive.length + 0.2)
      : 0;

    const issues: string[] = [];
    const suggestions: string[] = [];

    if (score < threshold.threshold) {
      issues.push(`${threshold.description} — 得分 ${score} 低于阈值 ${threshold.threshold}`);
      suggestions.push(`建议加强: ${threshold.description}`);
    }
    if (negativeHits.length > 0) {
      issues.push(`检测到负面信号: ${negativeHits.join(', ')}`);
    }

    dimensions.push({
      dimension: dim,
      label: threshold.description,
      score,
      confidence: Math.round(confidence * 100) / 100,
      evidence: positiveHits,
      issues,
      suggestions,
    });

    weightedSum += score * threshold.weight;
    totalWeight += threshold.weight;
  }

  const overallQualityScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0;

  let qualityLevel: string;
  if (overallQualityScore >= 8.5) qualityLevel = 'EXCELLENT';
  else if (overallQualityScore >= 7.0) qualityLevel = 'GOOD';
  else if (overallQualityScore >= 5.0) qualityLevel = 'ADEQUATE';
  else qualityLevel = 'WEAK';

  const criticalGaps = dimensions
    .filter((d) => d.score < DIMENSION_THRESHOLDS[d.dimension].threshold)
    .map((d) => d.label);

  const actionableSuggestions = dimensions
    .filter((d) => d.score < DIMENSION_THRESHOLDS[d.dimension].threshold)
    .map((d) => ({
      dimension: d.dimension,
      suggestion: d.suggestions[0]!,
      priority: d.score < DIMENSION_THRESHOLDS[d.dimension].threshold / 2 ? 'high' as const
        : d.score < DIMENSION_THRESHOLDS[d.dimension].threshold * 0.8 ? 'medium' as const
        : 'low' as const,
    }));

  return {
    outlineText,
    dimensions,
    overallQualityScore,
    qualityLevel,
    criticalGaps,
    actionableSuggestions,
  };
}
