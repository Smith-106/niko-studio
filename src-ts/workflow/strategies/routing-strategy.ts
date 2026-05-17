import {
  normalizeWorkflowRouteRequest,
  type WorkflowRouteRequest,
  type WorkflowRouteResult,
  type WorkflowTemplateStepDescriptor,
} from '../engine/engine-contracts.js';
import { buildWorkflowRouteResponse } from '../engine/responses.js';
import { WorkflowLevel, type WorkflowLevelValue } from '../types.js';

export interface WorkflowRoutingStrategy {
  route(taskOrRequest: string | WorkflowRouteRequest): Promise<WorkflowRouteResult>;
  detectLevel(task: string): WorkflowLevelValue;
}

type WorkflowContractWrapper = <T extends Record<string, unknown>>(payload: T) => T;
type WorkflowTemplateResolver = (level: WorkflowLevelValue) => WorkflowTemplateStepDescriptor[];

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  [WorkflowLevel.L1_RAPID]: '简单问答模式 - 直接回答，无需规划',
  [WorkflowLevel.L2_LITE]: '段落生成模式 - 单次生成，可能需要技能包',
  [WorkflowLevel.L3_STANDARD]: '章节创作模式 - Plan-Act 模式，需要检查点',
  [WorkflowLevel.L4_BRAINSTORM]: '多章连续模式 - 状态管理，跨章节一致性',
  [WorkflowLevel.L5_COORDINATOR]: '全书规划模式 - 完整工作流，大纲到成稿',
};

class LevelRouter {
  private getLevelIndicators(): Record<number, string[]> {
    return {
      [WorkflowLevel.L1_RAPID]: ['回答', '解释', '什么是', '告诉我', '简单'],
      [WorkflowLevel.L2_LITE]: ['写一段', '描写', '生成段落', '扩写'],
      [WorkflowLevel.L3_STANDARD]: ['写一章', '创作章节', '完成场景', '第.*章'],
      [WorkflowLevel.L4_BRAINSTORM]: ['连续写', '多章', '接着写', '继续'],
      [WorkflowLevel.L5_COORDINATOR]: ['规划全书', '大纲', '整体设计', '完整故事'],
    };
  }

  private getRoutingFeatureModel(): Record<string, unknown> {
    return {
      weights: { keyword: 3, structure: 2, history: 2, long_text_escalation: 2 },
      thresholds: {
        min_structured_score: 1,
        long_text_escalation_min_length: 100,
        long_text_target_floor: 'L3',
        default_level: 'L2',
      },
      category_explanations: {
        keyword: '命中层级关键词',
        structure: '命中结构信号',
        history: '命中历史反馈信号',
        long_text_escalation: '长文本任务自动升级',
      },
      levels: {
        [WorkflowLevel.L1_RAPID]: {
          keyword: ['回答', '解释', '什么是', '告诉我', '简单'],
          structure: [/\?|？/, /如何/, /为什么/, /一句话/, /简述/, /速答/].map((r) => r.source),
          history: [],
        },
        [WorkflowLevel.L2_LITE]: {
          keyword: ['写一段', '描写', '生成段落', '扩写'],
          structure: [/段落/, /片段/, /短文/, /示例/].map((r) => r.source),
          history: [],
        },
        [WorkflowLevel.L3_STANDARD]: {
          keyword: ['写一章', '创作章节', '完成场景', '第.*章'],
          structure: [/章节/, /第\s*\d+\s*章/, /场景/].map((r) => r.source),
          history: [/根据反馈/, /上次/, /继续修改/, /迭代/].map((r) => r.source),
        },
        [WorkflowLevel.L4_BRAINSTORM]: {
          keyword: ['连续写', '多章', '接着写', '继续'],
          structure: [/同时/, /并且/, /先.*再/, /多线/].map((r) => r.source),
          history: [/汇总反馈/, /多轮/, /讨论/].map((r) => r.source),
        },
        [WorkflowLevel.L5_COORDINATOR]: {
          keyword: ['规划全书', '大纲', '整体设计', '完整故事'],
          structure: [/全书/, /世界观/, /角色设定/, /路线图/, /里程碑/].map((r) => r.source),
          history: [/跨章节/, /长期/, /版本/].map((r) => r.source),
        },
      },
    };
  }

  scoreRouteFeatures(task: string): Record<string, unknown> {
    const taskLower = (task ?? '').toLowerCase();
    const model = this.getRoutingFeatureModel();
    const weights = model.weights as Record<string, number>;
    const thresholds = model.thresholds as Record<string, unknown>;

    const structuredLevels = [
      WorkflowLevel.L1_RAPID,
      WorkflowLevel.L2_LITE,
      WorkflowLevel.L3_STANDARD,
      WorkflowLevel.L4_BRAINSTORM,
      WorkflowLevel.L5_COORDINATOR,
    ];

    const structuredScores: Record<number, number> = {};
    const legacyScores: Record<number, number> = {};
    for (const level of structuredLevels) {
      structuredScores[level] = 0;
      legacyScores[level] = 0;
    }
    const matchedFeatures: Record<string, unknown>[] = [];

    const levels = model.levels as Record<number, Record<string, string[]>>;
    for (const level of structuredLevels) {
      const levelFeatures = levels[level] ?? {};
      for (const category of ['keyword', 'structure', 'history'] as const) {
        for (const pattern of levelFeatures[category] ?? []) {
          try {
            if (new RegExp(pattern).test(taskLower)) {
              const weight = weights[category] ?? 0;
              structuredScores[level] += weight;
              matchedFeatures.push({
                level: levelToLabel(level),
                category,
                signal: pattern,
                weight,
                explanation: (model.category_explanations as Record<string, string>)[category] ?? '',
              });
            }
          } catch {
            // skip invalid regex
          }
        }
      }
    }

    for (const [level, indicators] of Object.entries(this.getLevelIndicators())) {
      const numericLevel = Number(level);
      if (numericLevel === 4) continue;
      legacyScores[numericLevel] = indicators.filter((pattern) => {
        try {
          return new RegExp(pattern).test(taskLower);
        } catch {
          return false;
        }
      }).length;
    }

    const defaultLevel = WorkflowLevel.L3_STANDARD;

    const pickLevel = (scores: Record<number, number>, fallback: number): [number, number] => {
      const ordered = Object.entries(scores).sort((a, b) => {
        const scoreDiff = b[1] - a[1];
        if (scoreDiff !== 0) return scoreDiff;
        return (legacyScores[Number(b[0])] ?? 0) - (legacyScores[Number(a[0])] ?? 0);
      });
      const [topLevelStr, topScore] = ordered[0];
      const topLevel = Number(topLevelStr);
      const minScore = Number(thresholds.min_structured_score ?? 1);
      if (topScore < minScore) return [fallback, 0];
      return [topLevel, topScore];
    };

    const [legacyLevel, legacyTopScore] = pickLevel(legacyScores, defaultLevel);
    const [matchedLevel, structuredTopScore] = pickLevel(structuredScores, legacyLevel);

    const escalationMinLength = Number(thresholds.long_text_escalation_min_length ?? 100);
    const escalationFloor = WorkflowLevel.L3_STANDARD;
    let finalMatchedLevel = matchedLevel;
    let finalStructuredTopScore = structuredTopScore;

    if ((task ?? '').length > escalationMinLength && matchedLevel < escalationFloor) {
      finalMatchedLevel = escalationFloor;
      const escalationWeight = weights.long_text_escalation ?? 0;
      structuredScores[finalMatchedLevel] += escalationWeight;
      matchedFeatures.push({
        level: levelToLabel(finalMatchedLevel),
        category: 'long_text_escalation',
        signal: `len>${escalationMinLength}`,
        weight: escalationWeight,
        explanation: (model.category_explanations as Record<string, string>).long_text_escalation ?? '',
      });
      finalStructuredTopScore = Math.max(finalStructuredTopScore, structuredScores[finalMatchedLevel]);
    }

    return {
      matched_level: finalMatchedLevel,
      structured_scores: Object.fromEntries(
        Object.entries(structuredScores).map(([key, value]) => [levelToLabel(Number(key)), value]),
      ),
      legacy_scores: Object.fromEntries(
        Object.entries(legacyScores).map(([key, value]) => [levelToLabel(Number(key)), value]),
      ),
      matched_features: matchedFeatures,
      structured_top_score: finalStructuredTopScore,
      legacy_level: legacyLevel,
      legacy_top_score: legacyTopScore,
      feature_model: {
        categories: ['keyword', 'structure', 'history', 'long_text_escalation'],
        weights,
        thresholds,
        category_explanations: model.category_explanations,
      },
    };
  }
}

function levelToLabel(level: number): string {
  const map: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5' };
  return map[level] ?? 'L3';
}

export class DefaultWorkflowRoutingStrategy implements WorkflowRoutingStrategy {
  private readonly router = new LevelRouter();

  constructor(
    private readonly resolveTemplate: WorkflowTemplateResolver,
    private readonly withContract: WorkflowContractWrapper,
  ) {}

  detectLevel(task: string): WorkflowLevelValue {
    const routingScore = this.router.scoreRouteFeatures(task);
    return Number(routingScore.matched_level ?? WorkflowLevel.L3_STANDARD) as WorkflowLevelValue;
  }

  async route(taskOrRequest: string | WorkflowRouteRequest): Promise<WorkflowRouteResult> {
    const request = normalizeWorkflowRouteRequest(taskOrRequest);
    const matchedLevel = this.detectLevel(request.task);
    const routingScore = this.router.scoreRouteFeatures(request.task);

    return this.withContract(
      buildWorkflowRouteResponse({
        level: levelToLabel(matchedLevel),
        description: LEVEL_DESCRIPTIONS[matchedLevel] ?? LEVEL_DESCRIPTIONS[WorkflowLevel.L3_STANDARD],
        suggestedWorkflow: this.resolveTemplate(matchedLevel),
        reason: `匹配关键词得分: ${routingScore.legacy_top_score} | 结构化得分: ${routingScore.structured_top_score}`,
        matchedFeatures: routingScore.matched_features as Array<Record<string, unknown>>,
        score: Number(routingScore.structured_top_score ?? 0),
        finalLevel: levelToLabel(matchedLevel),
        routingDiagnostics: routingScore,
      }),
    ) as WorkflowRouteResult;
  }
}
