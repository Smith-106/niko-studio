/**
 * Sensory detail analyzer
 *
 * Extracts five sensory categories from text:
 * - Visual, Auditory, Olfactory, Tactile, Gustatory
 */

import { BaseAnalyzer, AnalysisResult, AnalysisType } from './base';

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

export enum SensoryType {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  OLFACTORY = 'olfactory',
  TACTILE = 'tactile',
  GUSTATORY = 'gustatory',
}

// ---------------------------------------------------------------------------
// Keyword dictionaries (rule-based detection)
// ---------------------------------------------------------------------------

const SENSORY_KEYWORDS: Record<SensoryType, string[]> = {
  [SensoryType.VISUAL]: [
    // colors
    '红', '蓝', '绿', '黄', '白', '黑', '紫', '橙', '灰', '金', '银',
    '明亮', '昏暗', '闪烁', '光芒', '阴影', '色彩', '颜色',
    // shape & motion
    '看见', '看到', '望向', '注视', '凝视', '目光', '眼前',
    '闪现', '浮现', '映入', '晃动', '飘动', '摇曳',
  ],
  [SensoryType.AUDITORY]: [
    '听见', '听到', '声音', '响声', '回响', '回荡',
    '嘈杂', '寂静', '沉默', '喧嚣', '轰鸣', '低语', '呢喃',
    '咳嗽', '叹息', '呼吸', '脚步', '敲门', '铃声',
    '尖叫', '怒吼', '哭泣', '笑声', '歌声', '音乐',
  ],
  [SensoryType.OLFACTORY]: [
    '闻到', '嗅到', '气味', '味道', '香气', '臭味',
    '芳香', '清香', '腥味', '霉味', '焦味', '烟味',
    '花香', '草香', '酒香', '饭香', '血腥味',
  ],
  [SensoryType.TACTILE]: [
    '触摸', '触碰', '抚摸', '握住', '抓住', '推开',
    '冰冷', '温暖', '炽热', '滚烫', '潮湿', '干燥',
    '光滑', '粗糙', '柔软', '坚硬', '刺痛', '酸痛',
    '颤抖', '战栗', '麻木', '疼痛', '舒适',
  ],
  [SensoryType.GUSTATORY]: [
    '尝到', '品尝', '咀嚼', '吞咽', '舔舐',
    '甜', '酸', '苦', '辣', '咸', '鲜',
    '美味', '可口', '恶心', '难吃', '入口', '回味',
  ],
};

// ---------------------------------------------------------------------------
// Data class
// ---------------------------------------------------------------------------

export class SensoryDetail {
  readonly type: SensoryType;
  readonly content: string;
  readonly keywords: string[];
  readonly position: number | null;
  readonly intensity: number;
  readonly context: string;

  constructor(
    type: SensoryType,
    content: string,
    keywords: string[] = [],
    position: number | null = null,
    intensity = 0.5,
    context = '',
  ) {
    this.type = type;
    this.content = content;
    this.keywords = keywords;
    this.position = position;
    this.intensity = intensity;
    this.context = context;
  }

  toDict(): Record<string, unknown> {
    return {
      type: this.type,
      content: this.content,
      keywords: this.keywords,
      position: this.position,
      intensity: this.intensity,
      context: this.context,
    };
  }
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class SensoryAnalyzer extends BaseAnalyzer<SensoryDetail> {
  get name(): string {
    return 'SensoryAnalyzer';
  }

  get analysisType(): AnalysisType {
    return AnalysisType.SENSORY;
  }

  get description(): string {
    return '分析文本中的五感描写（视觉、听觉、嗅觉、触觉、味觉）';
  }

  async analyze(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<AnalysisResult<SensoryDetail>> {
    if (this.llmClient) {
      return this._analyzeWithLLM(content, context);
    }
    return this.quickAnalyze(content);
  }

  // -- LLM path ---------------------------------------------------------------

  private async _analyzeWithLLM(
    content: string,
    _context?: Record<string, unknown>,
  ): Promise<AnalysisResult<SensoryDetail>> {
    const systemPrompt = `你是一位专业的叙事分析专家，擅长识别文本中的感官描写。
请分析文本中的五感描写：
- visual: 视觉描写
- auditory: 听觉描写
- olfactory: 嗅觉描写
- tactile: 触觉描写
- gustatory: 味觉描写

返回 JSON 格式，包含 sensory_details 数组，每个元素包含：
- type: 感官类型 (visual/auditory/olfactory/tactile/gustatory)
- content: 感官描写的原文片段
- intensity: 强度 0-1 之间的小数
- context: 该描写的叙事作用`;

    const prompt = `分析以下文本中的感官描写：\n\n${content.slice(0, 2000)}`;

    try {
      const result = await this.llmClient!.generateJson(prompt, {
        systemPrompt,
        temperature: 0.3,
      });

      const details: SensoryDetail[] = [];
      const llmDetails = (result as Record<string, unknown>).sensory_details as
        | Record<string, unknown>[]
        | undefined;

      if (llmDetails) {
        llmDetails.forEach((item, idx) => {
          try {
            const sensoryType = sensotyTypeFromValue(item.type as string);
            details.push(
              new SensoryDetail(
                sensoryType,
                (item.content as string) ?? '',
                [],
                idx,
                Number(item.intensity ?? 0.5),
                (item.context as string) ?? '',
              ),
            );
          } catch {
            // skip invalid entries
          }
        });
      }

      // merge rule-based results
      const ruleResult = this.quickAnalyze(content);
      const allDetails = details.concat(ruleResult.items);

      const typeCounts = initTypeCounts<SensoryType>(Object.values(SensoryType));
      for (const d of allDetails) typeCounts[d.type]++;

      return new AnalysisResult(
        this.name,
        this.analysisType,
        allDetails,
        {
          total_count: allDetails.length,
          llm_count: details.length,
          rule_count: ruleResult.items.length,
          type_distribution: mapCounts(typeCounts),
        },
        `发现 ${allDetails.length} 处感官描写（LLM: ${details.length}, 规则: ${ruleResult.items.length}）`,
      );
    } catch {
      return this.quickAnalyze(content);
    }
  }

  // -- Rule-based path --------------------------------------------------------

  quickAnalyze(content: string): AnalysisResult<SensoryDetail> {
    const details: SensoryDetail[] = [];
    const typeCounts = initTypeCounts<SensoryType>(Object.values(SensoryType));

    const sentences = content.split(/[。！？\n]/);

    sentences.forEach((raw, idx) => {
      const sentence = raw.trim();
      if (!sentence) return;

      for (const [sensoryType, keywords] of Object.entries(SENSORY_KEYWORDS)) {
        const st = sensoryType as SensoryType;
        const found = keywords.filter((kw) => sentence.includes(kw));

        if (found.length > 0) {
          typeCounts[st]++;
          details.push(
            new SensoryDetail(
              st,
              sentence,
              found,
              idx,
              Math.min(1.0, found.length * 0.3),
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
      details,
      {
        total_count: total,
        type_distribution: mapCounts(typeCounts),
        sentence_count: sentences.length,
        density: total / Math.max(1, sentences.length),
      },
      `发现 ${total} 处感官描写。分布: ${distribution || '无'}`,
    );
  }

  // -- Convenience helpers ----------------------------------------------------

  extractByType(content: string, sensoryType: SensoryType): SensoryDetail[] {
    const result = this.quickAnalyze(content);
    return result.items.filter((d) => d.type === sensoryType);
  }

  getSensoryDensity(content: string): Record<string, number> {
    const result = this.quickAnalyze(content);
    const charCount = content.length;
    if (charCount === 0) {
      const zero: Record<string, number> = {};
      for (const t of Object.values(SensoryType)) zero[t] = 0;
      return zero;
    }
    const dist = (result.metadata.type_distribution ?? {}) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [key, count] of Object.entries(dist)) {
      out[key] = (count / charCount) * 100;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sensotyTypeFromValue(v: string): SensoryType {
  const map: Record<string, SensoryType> = {
    visual: SensoryType.VISUAL,
    auditory: SensoryType.AUDITORY,
    olfactory: SensoryType.OLFACTORY,
    tactile: SensoryType.TACTILE,
    gustatory: SensoryType.GUSTATORY,
  };
  const result = map[v];
  if (!result) throw new Error(`Invalid SensoryType: ${v}`);
  return result;
}

function initTypeCounts<T extends string>(values: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const v of values) out[v] = 0;
  return out;
}

function mapCounts(counts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v;
  return out;
}
