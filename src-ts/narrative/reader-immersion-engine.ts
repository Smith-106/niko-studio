/**
 * Reader Immersion Engine
 *
 * Models reader state across chapters with curiosity, emotional investment,
 * cognitive load, suspense tension, and immersion metrics.
 * Generates per-chapter reader dropout risk scores.
 */

// ============================================================
// Types
// ============================================================

export interface ReaderState {
  curiosity: number;
  emotionalInvestment: number;
  cognitiveLoad: number;
  suspenseTension: number;
  immersion: number;
}

export interface ChapterReaderState {
  chapterIndex: number;
  state: ReaderState;
  dropoutRisk: number;
}

export interface ImmersionResult {
  chapterStates: ChapterReaderState[];
  averageImmersion: number;
  averageDropoutRisk: number;
  highRiskChapters: number[];
  trajectory: 'rising' | 'stable' | 'declining' | 'volatile';
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const CURIOSITY_TRIGGERS = [
  '秘密', '谜团', '真相', '疑惑', '不解', '为什么', '难道', '究竟',
  '奇怪', '诡异', '不为人知', '隐藏', '背后', '未知',
];

const INVESTMENT_TRIGGERS = [
  '誓言', '承诺', '牺牲', '守护', '保护', '信念', '在乎', '珍惜',
  '不甘', '执着', '决心', '坚持', '放弃', '挣扎', '代价',
];

const COGNITIVE_LOAD_TRIGGERS = [
  '也就是说', '换句话说', '众所周知', '简单来说', '总的来说',
  '具体来说', '一方面', '另一方面', '首先', '其次', '然后', '最后',
];

const SUSPENSE_TRIGGERS = [
  '危险', '威胁', '追杀', '陷阱', '阴谋', '暗算', '背叛',
  '倒计时', '最后', '只剩', '一旦', '如果不', '来不及',
];

const IMMERSION_BREAKERS = [
  '作者说', '笔者', '读者', '以上', '综上所述',
  '下一章', '敬请期待', '本章完', '未完待续',
];

// ============================================================
// State Transitions
// ============================================================

function computeChapterSignals(text: string): {
  curiositySignal: number;
  investmentSignal: number;
  loadSignal: number;
  suspenseSignal: number;
  immersionBreakerCount: number;
} {
  const count = (patterns: string[]) => patterns.filter((p) => text.includes(p)).length;

  return {
    curiositySignal: Math.min(1, count(CURIOSITY_TRIGGERS) / 5),
    investmentSignal: Math.min(1, count(INVESTMENT_TRIGGERS) / 5),
    loadSignal: Math.min(1, count(COGNITIVE_LOAD_TRIGGERS) / 4),
    suspenseSignal: Math.min(1, count(SUSPENSE_TRIGGERS) / 5),
    immersionBreakerCount: count(IMMERSION_BREAKERS),
  };
}

function transitionState(prev: ReaderState, signals: ReturnType<typeof computeChapterSignals>): ReaderState {
  const decay = 0.85;
  const boost = 0.15;

  const curiosity = prev.curiosity * decay + signals.curiositySignal * boost;
  const emotionalInvestment = Math.min(1, prev.emotionalInvestment * 0.9 + signals.investmentSignal * 0.2);
  const cognitiveLoad = Math.min(1, prev.cognitiveLoad * 0.7 + signals.loadSignal * 0.3);
  const suspenseTension = prev.suspenseTension * decay + signals.suspenseSignal * boost;

  const immersionBreakerPenalty = signals.immersionBreakerCount * 0.1;
  const immersion = Math.max(0, Math.min(1,
    (curiosity * 0.25 + emotionalInvestment * 0.3 + suspenseTension * 0.25 + (1 - cognitiveLoad) * 0.2) - immersionBreakerPenalty,
  ));

  return {
    curiosity: Math.round(curiosity * 100) / 100,
    emotionalInvestment: Math.round(emotionalInvestment * 100) / 100,
    cognitiveLoad: Math.round(cognitiveLoad * 100) / 100,
    suspenseTension: Math.round(suspenseTension * 100) / 100,
    immersion: Math.round(immersion * 100) / 100,
  };
}

function computeDropoutRisk(state: ReaderState): number {
  const { curiosity, emotionalInvestment, immersion, suspenseTension } = state;
  const engagement = (curiosity + emotionalInvestment + immersion + suspenseTension) / 4;
  const risk = Math.max(0, Math.min(1, 1 - engagement));
  return Math.round(risk * 100) / 100;
}

function inferTrajectory(states: ChapterReaderState[]): ImmersionResult['trajectory'] {
  if (states.length < 3) return 'stable';

  const lastThird = states.slice(-Math.ceil(states.length / 3));
  const firstThird = states.slice(0, Math.ceil(states.length / 3));

  const avgLast = lastThird.reduce((s, c) => s + c.state.immersion, 0) / lastThird.length;
  const avgFirst = firstThird.reduce((s, c) => s + c.state.immersion, 0) / firstThird.length;

  const diffs: number[] = [];
  for (let i = 1; i < states.length; i++) {
    diffs.push(states[i].state.immersion - states[i - 1].state.immersion);
  }
  const volatility = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length);

  if (volatility > 0.2) return 'volatile';
  if (avgLast - avgFirst > 0.1) return 'rising';
  if (avgFirst - avgLast > 0.1) return 'declining';
  return 'stable';
}

// ============================================================
// Public API
// ============================================================

export function analyzeReaderImmersion(
  chapters: Array<{ content: string; chapterIndex: number }>,
): ImmersionResult {
  if (chapters.length === 0) {
    return {
      chapterStates: [],
      averageImmersion: 0,
      averageDropoutRisk: 0,
      highRiskChapters: [],
      trajectory: 'stable',
      suggestions: ['没有章节数据'],
    };
  }

  const initialState: ReaderState = {
    curiosity: 0.5,
    emotionalInvestment: 0.3,
    cognitiveLoad: 0.2,
    suspenseTension: 0.3,
    immersion: 0.4,
  };

  const chapterStates: ChapterReaderState[] = [];
  let currentState = initialState;

  for (const chapter of chapters) {
    const signals = computeChapterSignals(chapter.content);
    currentState = transitionState(currentState, signals);
    const dropoutRisk = computeDropoutRisk(currentState);

    chapterStates.push({
      chapterIndex: chapter.chapterIndex,
      state: { ...currentState },
      dropoutRisk,
    });
  }

  const avgImmersion = Math.round(
    (chapterStates.reduce((s, c) => s + c.state.immersion, 0) / chapterStates.length) * 100,
  ) / 100;

  const avgDropout = Math.round(
    (chapterStates.reduce((s, c) => s + c.dropoutRisk, 0) / chapterStates.length) * 100,
  ) / 100;

  const highRiskChapters = chapterStates
    .filter((c) => c.dropoutRisk > 0.6)
    .map((c) => c.chapterIndex);

  const trajectory = inferTrajectory(chapterStates);

  const suggestions: string[] = [];
  if (highRiskChapters.length > 0) {
    suggestions.push(`${highRiskChapters.length} 个章节读者流失风险较高（章节：${highRiskChapters.slice(0, 5).join('、')}），建议增强悬念或情感投入`);
  }
  if (trajectory === 'declining') {
    suggestions.push('读者沉浸度呈下降趋势，建议在后续章节加入高潮或转折');
  }
  if (trajectory === 'volatile') {
    suggestions.push('读者沉浸度波动过大，建议保持稳定的情感递进');
  }
  if (avgImmersion < 0.3) {
    suggestions.push('整体沉浸度偏低，建议增加好奇心触发点和情感投入点');
  }
  if (suggestions.length === 0) {
    suggestions.push('读者沉浸度良好，跨章节状态递进合理');
  }

  return {
    chapterStates,
    averageImmersion: avgImmersion,
    averageDropoutRisk: avgDropout,
    highRiskChapters,
    trajectory,
    suggestions,
  };
}
