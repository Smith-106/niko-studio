/**
 * Tension curve analyzer
 *
 * Analyzes plot tension changes in text, identifying:
 * - Peaks, Valleys, Turning points
 * - Overall tension curve
 */

import { BaseAnalyzer, AnalysisResult, AnalysisType } from './base';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TensionLevel {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
}

export enum PointType {
  NORMAL = 'normal',
  PEAK = 'peak',
  VALLEY = 'valley',
  TURNING_POINT = 'turning',
  CLIMAX = 'climax',
}

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const TENSION_INDICATORS: Record<number, string[]> = {
  [TensionLevel.VERY_HIGH]: [
    '绝望', '崩溃', '爆发', '冲突', '决战', '生死',
    '高潮', '巅峰', '极限', '临界', '爆炸', '毁灭',
    '惊恐', '震惊', '不敢相信', '天崩地裂',
  ],
  [TensionLevel.HIGH]: [
    '紧张', '危机', '威胁', '冲突', '对抗', '激烈',
    '焦虑', '恐惧', '害怕', '担忧', '不安', '慌乱',
    '追逐', '逃跑', '战斗', '争吵',
  ],
  [TensionLevel.MEDIUM]: [
    '疑惑', '困惑', '好奇', '期待', '等待', '观察',
    '思考', '犹豫', '踌躇', '权衡', '考虑',
  ],
  [TensionLevel.LOW]: [
    '平静', '安宁', '祥和', '轻松', '舒适', '惬意',
    '日常', '普通', '平常', '正常', '如常',
  ],
  [TensionLevel.VERY_LOW]: [
    '沉睡', '休息', '回忆', '梦境', '宁静', '沉默',
    '静谧', '安详', '悠闲', '闲适', '恬静',
  ],
};

const TURNING_INDICATORS = [
  '突然', '忽然', '猛然', '骤然', '陡然',
  '但是', '然而', '可是', '却', '不料',
  '转折', '变化', '改变', '发现', '揭示',
  '原来', '竟然', '居然', '没想到',
];

// ---------------------------------------------------------------------------
// Data classes
// ---------------------------------------------------------------------------

export class TensionPoint {
  position: number;
  level: TensionLevel;
  pointType: PointType;
  content: string;
  indicators: string[];
  score: number;

  constructor(
    position: number,
    level: TensionLevel,
    pointType = PointType.NORMAL,
    content = '',
    indicators: string[] = [],
    score = 0.5,
  ) {
    this.position = position;
    this.level = level;
    this.pointType = pointType;
    this.content = content;
    this.indicators = indicators;
    this.score = score;
  }

  toDict(): Record<string, unknown> {
    return {
      position: this.position,
      level: this.level,
      point_type: this.pointType,
      content: this.content ? this.content.slice(0, 100) : '',
      indicators: this.indicators,
      score: this.score,
    };
  }
}

export class TensionCurve {
  points: TensionPoint[];
  peaks: number[];
  valleys: number[];
  turningPoints: number[];
  climaxPosition: number | null;
  averageTension: number;
  variance: number;

  constructor(
    points: TensionPoint[] = [],
    peaks: number[] = [],
    valleys: number[] = [],
    turningPoints: number[] = [],
    climaxPosition: number | null = null,
    averageTension = 0.5,
    variance = 0.0,
  ) {
    this.points = points;
    this.peaks = peaks;
    this.valleys = valleys;
    this.turningPoints = turningPoints;
    this.climaxPosition = climaxPosition;
    this.averageTension = averageTension;
    this.variance = variance;
  }

  toDict(): Record<string, unknown> {
    return {
      point_count: this.points.length,
      peaks: this.peaks,
      valleys: this.valleys,
      turning_points: this.turningPoints,
      climax_position: this.climaxPosition,
      average_tension: this.averageTension,
      variance: this.variance,
      points: this.points.map((p) => p.toDict()),
    };
  }
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class TensionCurveAnalyzer extends BaseAnalyzer<TensionCurve> {
  get name(): string {
    return 'TensionCurveAnalyzer';
  }

  get analysisType(): AnalysisType {
    return AnalysisType.TENSION;
  }

  get description(): string {
    return '分析文本的情节张力变化曲线';
  }

  async analyze(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<AnalysisResult<TensionCurve>> {
    if (this.llmClient) {
      return this._analyzeWithLLM(content, context);
    }
    return this.quickAnalyze(content);
  }

  // -- LLM path ---------------------------------------------------------------

  private async _analyzeWithLLM(
    content: string,
    _context?: Record<string, unknown>,
  ): Promise<AnalysisResult<TensionCurve>> {
    const systemPrompt = `你是一位专业的叙事分析专家，擅长分析文本的情节张力变化。
请分析文本的张力曲线，识别：
- 张力水平 (1-5): 1=非常低, 2=低, 3=中等, 4=高, 5=非常高
- 关键点类型: normal(普通), peak(高点), valley(低点), turning(转折点), climax(高潮)

返回 JSON 格式：
{
  "points": [{"position": 0, "level": 3, "point_type": "normal", "description": "..."}],
  "climax_position": 5,
  "overall_pattern": "rising/falling/oscillating/building/flat",
  "summary": "整体张力分析摘要"
}`;

    const prompt = `分析以下文本的情节张力变化：\n\n${content.slice(0, 2000)}`;

    try {
      const result = await this.llmClient!.generateJson(prompt, {
        systemPrompt,
        temperature: 0.3,
      });

      const raw = result as Record<string, unknown>;
      const llmPoints = (raw.points ?? []) as Record<string, unknown>[];
      const points: TensionPoint[] = [];

      for (const item of llmPoints) {
        try {
          const levelValue = Number(item.level ?? 3);
          const level = tensionLevelFromValue(levelValue);
          const pointTypeStr = (item.point_type as string) ?? 'normal';
          const pointType = pointTypeFromValue(pointTypeStr);

          points.push(
            new TensionPoint(
              Number(item.position ?? points.length),
              level,
              pointType,
              ((item.description as string) ?? '').slice(0, 100),
              [],
              levelValue / 5.0,
            ),
          );
        } catch {
          continue;
        }
      }

      // if LLM returns too few points, fall back to rule-based
      if (points.length < 3) {
        const ruleResult = this.quickAnalyze(content);
        if (ruleResult.items.length > 0) {
          // use the rule-based curve's points
          points.push(...ruleResult.items[0].points);
        }
      }

      const curve = points.length > 0 ? this._buildCurve(points) : new TensionCurve();

      // use LLM-provided climax position if available
      if (raw.climax_position != null) {
        curve.climaxPosition = raw.climax_position as number;
      }

      const summary = (raw.summary as string) ?? this._generateSummary(curve);

      return new AnalysisResult(
        this.name,
        this.analysisType,
        [curve],
        {
          point_count: curve.points.length,
          peak_count: curve.peaks.length,
          valley_count: curve.valleys.length,
          turning_point_count: curve.turningPoints.length,
          overall_pattern: (raw.overall_pattern as string) ?? 'unknown',
          analysis_source: 'llm',
        },
        summary,
      );
    } catch {
      return this.quickAnalyze(content);
    }
  }

  // -- Rule-based path --------------------------------------------------------

  quickAnalyze(content: string): AnalysisResult<TensionCurve> {
    const segments = this._segmentText(content);
    const points: TensionPoint[] = [];

    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx].trim();

      const [level, indicators] = this._detectTensionLevel(segment);
      const isTurning = this._detectTurningPoint(segment);

      points.push(
        new TensionPoint(
          idx,
          level,
          isTurning ? PointType.TURNING_POINT : PointType.NORMAL,
          segment.slice(0, 100),
          indicators,
          level / 5.0,
        ),
      );
    }

    const curve = this._buildCurve(points);
    const summary = this._generateSummary(curve);

    return new AnalysisResult(
      this.name,
      this.analysisType,
      [curve],
      {
        segment_count: segments.length,
        point_count: points.length,
        peak_count: curve.peaks.length,
        valley_count: curve.valleys.length,
        turning_point_count: curve.turningPoints.length,
      },
      summary,
    );
  }

  // -- Convenience helpers ----------------------------------------------------

  getTensionPattern(content: string): string {
    const result = this.quickAnalyze(content);
    if (result.items.length === 0) return 'unknown';

    const curve = result.items[0];

    if (curve.variance < 0.1) return 'flat';
    if (curve.peaks.length > curve.valleys.length + 2) return 'rising';
    if (curve.valleys.length > curve.peaks.length + 2) return 'falling';
    if (curve.climaxPosition != null && curve.climaxPosition > curve.points.length * 0.6) {
      return 'building';
    }
    return 'oscillating';
  }

  // -- Private helpers --------------------------------------------------------

  private _segmentText(content: string): string[] {
    const paragraphs = content.split('\n\n');
    if (paragraphs.length > 3) {
      return paragraphs.map((p) => p.trim()).filter(Boolean);
    }
    return content.split(/[。！？]/).map((s) => s.trim()).filter(Boolean);
  }

  private _detectTensionLevel(text: string): [TensionLevel, string[]] {
    const foundIndicators: string[] = [];
    let maxLevel = TensionLevel.MEDIUM;

    const priorityLevels = [
      TensionLevel.VERY_HIGH,
      TensionLevel.HIGH,
      TensionLevel.LOW,
      TensionLevel.VERY_LOW,
    ];

    for (const level of priorityLevels) {
      for (const indicator of TENSION_INDICATORS[level]) {
        if (text.includes(indicator)) {
          foundIndicators.push(indicator);
          if (level > maxLevel) {
            maxLevel = level;
          } else if (level < maxLevel && maxLevel === TensionLevel.MEDIUM) {
            maxLevel = level;
          }
        }
      }
    }

    return [maxLevel, foundIndicators];
  }

  private _detectTurningPoint(text: string): boolean {
    return TURNING_INDICATORS.some((ind) => text.includes(ind));
  }

  private _buildCurve(points: TensionPoint[]): TensionCurve {
    if (points.length === 0) return new TensionCurve();

    const peaks: number[] = [];
    const valleys: number[] = [];
    const turningPoints: number[] = [];
    let climaxPosition: number | null = null;
    let maxScore = 0;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // local peak
      if (i > 0 && i < points.length - 1) {
        if (point.score > points[i - 1].score && point.score > points[i + 1].score) {
          peaks.push(i);
          point.pointType = PointType.PEAK;
        }
        // local valley
        if (point.score < points[i - 1].score && point.score < points[i + 1].score) {
          valleys.push(i);
          point.pointType = PointType.VALLEY;
        }
      }

      // turning points
      if (point.pointType === PointType.TURNING_POINT) {
        turningPoints.push(i);
      }

      // highest point
      if (point.score > maxScore) {
        maxScore = point.score;
        climaxPosition = i;
      }
    }

    // mark climax
    if (climaxPosition != null && climaxPosition < points.length) {
      points[climaxPosition].pointType = PointType.CLIMAX;
    }

    // statistics
    const scores = points.map((p) => p.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length;

    return new TensionCurve(
      points,
      peaks,
      valleys,
      turningPoints,
      climaxPosition,
      round3(avg),
      round3(variance),
    );
  }

  private _generateSummary(curve: TensionCurve): string {
    if (curve.points.length === 0) return '未检测到有效的张力变化';

    const parts: string[] = [
      `分析了 ${curve.points.length} 个文本段落`,
      `平均张力 ${curve.averageTension.toFixed(2)}`,
      `变化幅度 ${curve.variance.toFixed(2)}`,
    ];

    if (curve.peaks.length > 0) parts.push(`${curve.peaks.length} 个高点`);
    if (curve.valleys.length > 0) parts.push(`${curve.valleys.length} 个低点`);
    if (curve.turningPoints.length > 0) parts.push(`${curve.turningPoints.length} 个转折`);
    if (curve.climaxPosition != null) parts.push(`高潮在位置 ${curve.climaxPosition}`);

    return parts.join('。') + '。';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function tensionLevelFromValue(v: number): TensionLevel {
  const map: Record<number, TensionLevel> = {
    1: TensionLevel.VERY_LOW,
    2: TensionLevel.LOW,
    3: TensionLevel.MEDIUM,
    4: TensionLevel.HIGH,
    5: TensionLevel.VERY_HIGH,
  };
  const result = map[v];
  if (!result) throw new Error(`Invalid TensionLevel: ${v}`);
  return result;
}

function pointTypeFromValue(v: string): PointType {
  const map: Record<string, PointType> = {
    normal: PointType.NORMAL,
    peak: PointType.PEAK,
    valley: PointType.VALLEY,
    turning: PointType.TURNING_POINT,
    climax: PointType.CLIMAX,
  };
  const result = map[v];
  if (!result) throw new Error(`Invalid PointType: ${v}`);
  return result;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
