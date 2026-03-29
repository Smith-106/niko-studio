/**
 * Conflict element analyzer
 *
 * Extracts conflict elements from text:
 * - Internal (character inner contradictions)
 * - External (character vs. outside forces)
 * - Interpersonal (character vs. character)
 */

import { BaseAnalyzer, AnalysisResult, AnalysisType } from './base';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ConflictType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  INTERPERSONAL = 'interpersonal',
}

export enum ConflictIntensity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const CONFLICT_INDICATORS: Record<ConflictType, string[]> = {
  [ConflictType.INTERNAL]: [
    '犹豫', '踌躇', '彷徨', '迷茫', '困惑', '纠结',
    '矛盾', '挣扎', '煎熬', '痛苦', '两难', '抉择',
    '我该', '我应该', '如果我', '但是我', '可是我',
    '一方面', '另一方面', '心想', '暗想', '自问',
    '爱恨', '喜忧', '悲喜', '又想', '却又',
  ],
  [ConflictType.EXTERNAL]: [
    '对抗', '抵抗', '反抗', '战斗', '斗争', '抗争',
    '威胁', '危机', '险境', '困境', '绝境', '死亡',
    '压力', '阻碍', '障碍', '困难', '挑战', '考验',
    '风暴', '灾难', '战争', '敌人', '命运',
  ],
  [ConflictType.INTERPERSONAL]: [
    '争吵', '争论', '争执', '吵架', '冲突', '对峙',
    '敌对', '仇恨', '背叛', '欺骗', '谎言', '误解',
    '怀疑', '猜忌', '嫉妒', '愤怒', '指责', '质问',
    '分歧', '决裂', '反目', '翻脸', '对立',
  ],
};

const INTENSITY_INDICATORS: Record<ConflictIntensity, string[]> = {
  [ConflictIntensity.CRITICAL]: ['绝望', '崩溃', '毁灭', '死亡', '致命', '生死'],
  [ConflictIntensity.HIGH]: ['激烈', '剧烈', '强烈', '爆发', '冲突', '对抗'],
  [ConflictIntensity.MEDIUM]: ['紧张', '不安', '焦虑', '担忧', '困扰', '烦恼'],
  [ConflictIntensity.LOW]: ['轻微', '略微', '有些', '稍微', '微小', '隐约'],
};

// ---------------------------------------------------------------------------
// Data class
// ---------------------------------------------------------------------------

export class Conflict {
  readonly type: ConflictType;
  readonly content: string;
  readonly parties: string[];
  readonly intensity: ConflictIntensity;
  readonly indicators: string[];
  readonly position: number | null;
  readonly description: string;

  constructor(
    type: ConflictType,
    content: string,
    parties: string[] = [],
    intensity = ConflictIntensity.MEDIUM,
    indicators: string[] = [],
    position: number | null = null,
    description = '',
  ) {
    this.type = type;
    this.content = content;
    this.parties = parties;
    this.intensity = intensity;
    this.indicators = indicators;
    this.position = position;
    this.description = description;
  }

  toDict(): Record<string, unknown> {
    return {
      type: this.type,
      content: this.content,
      parties: this.parties,
      intensity: this.intensity,
      indicators: this.indicators,
      position: this.position,
      description: this.description,
    };
  }
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class ConflictAnalyzer extends BaseAnalyzer<Conflict> {
  get name(): string {
    return 'ConflictAnalyzer';
  }

  get analysisType(): AnalysisType {
    return AnalysisType.CONFLICT;
  }

  get description(): string {
    return '分析文本中的冲突元素（内在、外在、人际冲突）';
  }

  async analyze(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<AnalysisResult<Conflict>> {
    if (this.llmClient) {
      return this._analyzeWithLLM(content, context);
    }
    return this.quickAnalyze(content);
  }

  // -- LLM path ---------------------------------------------------------------

  private async _analyzeWithLLM(
    content: string,
    _context?: Record<string, unknown>,
  ): Promise<AnalysisResult<Conflict>> {
    const systemPrompt = `你是一位专业的叙事分析专家，擅长识别文本中的冲突元素。
请分析文本中的冲突，识别以下类型：
- internal: 内在冲突（角色内心的矛盾）
- external: 外在冲突（角色与外部力量的对抗）
- interpersonal: 人际冲突（角色之间的冲突）

返回 JSON 格式，包含 conflicts 数组，每个元素包含：
- type: 冲突类型 (internal/external/interpersonal)
- content: 冲突相关的原文片段（最多100字）
- parties: 冲突方列表
- intensity: 强度 (low/medium/high/critical)
- description: 冲突描述`;

    const prompt = `分析以下文本中的冲突元素：\n\n${content.slice(0, 2000)}`;

    try {
      const result = await this.llmClient!.generateJson(prompt, {
        systemPrompt,
        temperature: 0.3,
      });

      const conflicts: Conflict[] = [];
      const llmConflicts =
        (result as Record<string, unknown>).conflicts as Record<string, unknown>[] | undefined ??
        [];

      for (const item of llmConflicts) {
        try {
          const conflictType = conflictTypeFromValue(
            (item.type as string) ?? 'interpersonal',
          );
          const intensity = intensityFromValue(
            (item.intensity as string) ?? 'medium',
          );
          conflicts.push(
            new Conflict(
              conflictType,
              ((item.content as string) ?? '').slice(0, 200),
              (item.parties as string[]) ?? [],
              intensity,
              [],
              null,
              (item.description as string) ?? '',
            ),
          );
        } catch {
          continue;
        }
      }

      const ruleResult = this.quickAnalyze(content);
      const allConflicts = conflicts.concat(ruleResult.items);

      const typeCounts = initRecord<ConflictType>(Object.values(ConflictType));
      for (const c of allConflicts) typeCounts[c.type]++;

      return new AnalysisResult(
        this.name,
        this.analysisType,
        allConflicts,
        {
          total_count: allConflicts.length,
          llm_count: conflicts.length,
          rule_count: ruleResult.items.length,
          type_distribution: mapEnumCounts(typeCounts),
        },
        `发现 ${allConflicts.length} 处冲突元素（LLM: ${conflicts.length}, 规则: ${ruleResult.items.length}）`,
      );
    } catch {
      return this.quickAnalyze(content);
    }
  }

  // -- Rule-based path --------------------------------------------------------

  quickAnalyze(content: string): AnalysisResult<Conflict> {
    const conflicts: Conflict[] = [];
    const typeCounts = initRecord<ConflictType>(Object.values(ConflictType));

    let paragraphs = content.split('\n\n');
    if (paragraphs.length === 1) {
      paragraphs = content.split(/[。！？]/);
    }

    paragraphs.forEach((raw, idx) => {
      const para = raw.trim();
      if (!para) return;

      for (const [conflictType, indicators] of Object.entries(CONFLICT_INDICATORS)) {
        const ct = conflictType as ConflictType;
        const found = indicators.filter((ind) => para.includes(ind));

        if (found.length > 0) {
          typeCounts[ct]++;
          const intensity = this._detectIntensity(para);

          conflicts.push(
            new Conflict(
              ct,
              para.slice(0, 200),
              [],
              intensity,
              found,
              idx,
              this._generateDescription(ct, found),
            ),
          );
        }
      }
    });

    const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    const distribution = Object.entries(typeCounts)
      .filter(([, c]) => c > 0)
      .map(([t, c]) => `${t}: ${c}`)
      .join(', ');

    return new AnalysisResult(
      this.name,
      this.analysisType,
      conflicts,
      {
        total_count: total,
        type_distribution: mapEnumCounts(typeCounts),
        intensity_distribution: this._getIntensityDistribution(conflicts),
      },
      `发现 ${total} 处冲突元素。分布: ${distribution || '无'}`,
    );
  }

  // -- Private helpers --------------------------------------------------------

  private _detectIntensity(text: string): ConflictIntensity {
    for (const level of [
      ConflictIntensity.CRITICAL,
      ConflictIntensity.HIGH,
      ConflictIntensity.MEDIUM,
      ConflictIntensity.LOW,
    ] as ConflictIntensity[]) {
      for (const indicator of INTENSITY_INDICATORS[level]) {
        if (text.includes(indicator)) return level;
      }
    }
    return ConflictIntensity.MEDIUM;
  }

  private _generateDescription(conflictType: ConflictType, indicators: string[]): string {
    const names: Record<ConflictType, string> = {
      [ConflictType.INTERNAL]: '内在冲突',
      [ConflictType.EXTERNAL]: '外在冲突',
      [ConflictType.INTERPERSONAL]: '人际冲突',
    };
    return `${names[conflictType]}，关键词: ${indicators.slice(0, 3).join(', ')}`;
  }

  private _getIntensityDistribution(conflicts: Conflict[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const i of Object.values(ConflictIntensity)) dist[i] = 0;
    for (const c of conflicts) dist[c.intensity]++;
    return dist;
  }

  // -- Convenience helpers ----------------------------------------------------

  getDominantConflictType(content: string): ConflictType | null {
    const result = this.quickAnalyze(content);
    const typeDist = result.metadata.type_distribution as Record<string, number> | undefined;
    if (!typeDist) return null;

    const entries = Object.entries(typeDist);
    if (entries.length === 0) return null;

    let maxEntry = entries[0];
    for (const e of entries) {
      if (e[1] > maxEntry[1]) maxEntry = e;
    }
    if (maxEntry[1] === 0) return null;

    try {
      return conflictTypeFromValue(maxEntry[0]);
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function conflictTypeFromValue(v: string): ConflictType {
  const map: Record<string, ConflictType> = {
    internal: ConflictType.INTERNAL,
    external: ConflictType.EXTERNAL,
    interpersonal: ConflictType.INTERPERSONAL,
  };
  const result = map[v];
  if (!result) throw new Error(`Invalid ConflictType: ${v}`);
  return result;
}

function intensityFromValue(v: string): ConflictIntensity {
  const map: Record<string, ConflictIntensity> = {
    low: ConflictIntensity.LOW,
    medium: ConflictIntensity.MEDIUM,
    high: ConflictIntensity.HIGH,
    critical: ConflictIntensity.CRITICAL,
  };
  const result = map[v];
  if (!result) throw new Error(`Invalid ConflictIntensity: ${v}`);
  return result;
}

function initRecord<T extends string>(values: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const v of values) out[v] = 0;
  return out;
}

function mapEnumCounts(counts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v;
  return out;
}
