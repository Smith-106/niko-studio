/**
 * Character state analyzer
 *
 * Extracts character state trajectories from text:
 * - Emotions (positive / negative / neutral)
 * - Goals
 * - Conflicts
 * - Agency score
 */

import { BaseAnalyzer, AnalysisResult, AnalysisType } from './base';

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const EMOTION_KEYWORDS: Record<string, string[]> = {
  positive: ['开心', '喜悦', '兴奋', '轻松', '期待', '安心', '满足'],
  negative: ['害怕', '恐惧', '担忧', '焦虑', '痛苦', '绝望', '愤怒', '悲伤'],
  neutral: ['平静', '冷静', '沉默', '思考', '观察'],
};

const GOAL_MARKERS = [
  '要', '必须', '决定', '目标', '想要', '打算', '计划', '希望', '准备',
];

const CONFLICT_MARKERS = [
  '但是', '然而', '却', '矛盾', '挣扎', '犹豫', '两难', '冲突', '对抗',
];

const ACTION_MARKERS = [
  '冲', '跑', '追', '抓', '推', '拉', '喊', '说', '做', '行动', '决定',
];

// ---------------------------------------------------------------------------
// Data class
// ---------------------------------------------------------------------------

export class CharacterState {
  readonly position: number;
  readonly content: string;
  readonly emotions: string[];
  readonly goals: string[];
  readonly conflicts: string[];
  readonly agencyScore: number;

  constructor(
    position: number,
    content: string,
    emotions: string[] = [],
    goals: string[] = [],
    conflicts: string[] = [],
    agencyScore = 0.0,
  ) {
    this.position = position;
    this.content = content;
    this.emotions = emotions;
    this.goals = goals;
    this.conflicts = conflicts;
    this.agencyScore = agencyScore;
  }

  toDict(): Record<string, unknown> {
    return {
      position: this.position,
      content: this.content.slice(0, 120),
      emotions: this.emotions,
      goals: this.goals,
      conflicts: this.conflicts,
      agency_score: this.agencyScore,
    };
  }
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class CharacterStateAnalyzer extends BaseAnalyzer<CharacterState> {
  get name(): string {
    return 'CharacterStateAnalyzer';
  }

  get analysisType(): AnalysisType {
    return AnalysisType.CHARACTER_STATE;
  }

  get description(): string {
    return '分析角色在叙事中的情绪、目标、冲突与能动性变化';
  }

  async analyze(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<AnalysisResult<CharacterState>> {
    if (this.llmClient) {
      return this._analyzeWithLLM(content, context);
    }
    return this.quickAnalyze(content);
  }

  // -- LLM path ---------------------------------------------------------------

  private async _analyzeWithLLM(
    content: string,
    _context?: Record<string, unknown>,
  ): Promise<AnalysisResult<CharacterState>> {
    const systemPrompt = `你是叙事分析专家。请抽取角色状态轨迹并返回 JSON：
{
  "states": [
    {
      "position": 0,
      "content": "...",
      "emotions": ["..."],
      "goals": ["..."],
      "conflicts": ["..."],
      "agency_score": 0.6
    }
  ],
  "summary": "..."
}`;

    const prompt = `分析以下文本中的角色状态变化：\n\n${content.slice(0, 2000)}`;

    try {
      const result = await this.llmClient!.generateJson(prompt, {
        systemPrompt,
        temperature: 0.3,
      });

      const raw = result as Record<string, unknown>;
      const states: CharacterState[] = [];
      const rawStates = (raw.states ?? []) as Record<string, unknown>[];

      for (const item of rawStates) {
        states.push(
          new CharacterState(
            Number(item.position ?? states.length),
            String(item.content ?? ''),
            ((item.emotions as string[]) ?? []).map(String),
            ((item.goals as string[]) ?? []).map(String),
            ((item.conflicts as string[]) ?? []).map(String),
            Number(item.agency_score ?? 0),
          ),
        );
      }

      if (states.length === 0) {
        return this.quickAnalyze(content);
      }

      const avgAgency = round3(
        states.reduce((s, st) => s + st.agencyScore, 0) / states.length,
      );

      return new AnalysisResult(
        this.name,
        this.analysisType,
        states,
        {
          total_count: states.length,
          average_agency: avgAgency,
          analysis_source: 'llm',
        },
        (raw.summary as string) ?? this._buildSummary(states),
      );
    } catch {
      return this.quickAnalyze(content);
    }
  }

  // -- Rule-based path --------------------------------------------------------

  quickAnalyze(content: string): AnalysisResult<CharacterState> {
    const segments = this._segmentText(content);
    const states: CharacterState[] = [];

    for (let idx = 0; idx < segments.length; idx++) {
      const segment = segments[idx];
      const emotions = this._extractEmotions(segment);
      const goals = this._extractKeywords(segment, GOAL_MARKERS);
      const conflicts = this._extractKeywords(segment, CONFLICT_MARKERS);
      const agency = this._estimateAgency(segment, goals);

      if (!(emotions.length || goals.length || conflicts.length)) continue;

      states.push(
        new CharacterState(idx, segment.trim(), emotions, goals, conflicts, agency),
      );
    }

    const averageAgency =
      states.length > 0
        ? round3(states.reduce((s, st) => s + st.agencyScore, 0) / states.length)
        : 0;

    return new AnalysisResult(
      this.name,
      this.analysisType,
      states,
      {
        segment_count: segments.length,
        total_count: states.length,
        average_agency: averageAgency,
        emotion_distribution: this._emotionDistribution(states),
      },
      this._buildSummary(states),
    );
  }

  // -- Convenience helpers ----------------------------------------------------

  getDominantEmotions(content: string): string[] {
    const result = this.quickAnalyze(content);
    const distribution = result.metadata.emotion_distribution as
      | Record<string, number>
      | undefined;
    if (!distribution) return [];

    const values = Object.values(distribution);
    const maxCount = Math.max(...values);
    if (maxCount === 0) return [];

    return Object.entries(distribution)
      .filter(([, count]) => count === maxCount)
      .map(([emotion]) => emotion);
  }

  // -- Private helpers --------------------------------------------------------

  private _segmentText(content: string): string[] {
    const paragraphs = content.split('\n\n').map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) return paragraphs;

    return content.split(/[。！？]/).map((s) => s.trim()).filter(Boolean);
  }

  private _extractEmotions(text: string): string[] {
    const found: string[] = [];
    for (const [emotionType, words] of Object.entries(EMOTION_KEYWORDS)) {
      if (words.some((w) => text.includes(w))) {
        found.push(emotionType);
      }
    }
    return found;
  }

  private _extractKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter((kw) => text.includes(kw));
  }

  private _estimateAgency(text: string, goals: string[]): number {
    const actionHits = ACTION_MARKERS.filter((m) => text.includes(m)).length;
    const goalBonus = Math.min(2, goals.length);
    const raw = actionHits + goalBonus;
    return Math.min(1.0, round3(raw * 0.2));
  }

  private _emotionDistribution(states: CharacterState[]): Record<string, number> {
    const dist: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
    for (const state of states) {
      for (const emotion of state.emotions) {
        if (emotion in dist) dist[emotion]++;
      }
    }
    return dist;
  }

  private _buildSummary(states: CharacterState[]): string {
    if (states.length === 0) return '未检测到明显角色状态信号';
    const avgAgency = states.reduce((s, st) => s + st.agencyScore, 0) / states.length;
    return `检测到 ${states.length} 段角色状态，平均能动性 ${avgAgency.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
