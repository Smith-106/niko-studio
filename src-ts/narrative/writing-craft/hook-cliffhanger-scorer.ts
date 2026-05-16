/**
 * Hook & Cliffhanger Scorer
 *
 * Scores chapter openings (hooks) and endings (cliffhangers)
 * across multiple dimensions with Chinese web-novel optimized patterns.
 */

// ============================================================
// Types
// ============================================================

export enum HookDimension {
  CONFLICT_HINT = 'conflict_hint',
  INFO_GAP = 'info_gap',
  SENSORY_IMPACT = 'sensory_impact',
  PACING_ENTRY = 'pacing_entry',
}

export enum CliffhangerDimension {
  UNRESOLVED_QUESTIONS = 'unresolved_questions',
  EMOTIONAL_PEAK = 'emotional_peak',
  TWIST_IMPACT = 'twist_impact',
  ANTICIPATION = 'anticipation',
}

export interface HookScore {
  overall: number;
  dimensions: Record<HookDimension, number>;
  evidence: string[];
}

export interface CliffhangerScore {
  overall: number;
  dimensions: Record<CliffhangerDimension, number>;
  evidence: string[];
}

export interface ChapterBoundaryScore {
  hook: HookScore;
  cliffhanger: CliffhangerScore;
}

export interface HookCliffhangerResult {
  chapters: ChapterBoundaryScore[];
  averageHookScore: number;
  averageCliffhangerScore: number;
  weakChapters: number[];
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const HOOK_PATTERNS: Record<HookDimension, { keywords: string[]; weight: number }> = {
  [HookDimension.CONFLICT_HINT]: {
    keywords: ['冲突', '对峙', '威胁', '危险', '敌人', '对手', '矛盾', '争斗', '不安', '紧张', '危机', '追杀', '围困', '陷阱'],
    weight: 0.3,
  },
  [HookDimension.INFO_GAP]: {
    keywords: ['秘密', '真相', '谜团', '疑惑', '不解', '奇怪', '诡异', '竟然', '殊不知', '没想到', '不为人知', '背后', '隐藏'],
    weight: 0.3,
  },
  [HookDimension.SENSORY_IMPACT]: {
    keywords: ['突然', '猛地', '刹那', '一瞬间', '眼前一亮', '刺耳', '冰冷', '灼热', '黑暗', '光芒', '血腥', '恶臭', '寂静', '震耳欲聋'],
    weight: 0.2,
  },
  [HookDimension.PACING_ENTRY]: {
    keywords: ['然而', '可是', '不过', '就在这时', '此时', '话音刚落', '话音未落', '还没来得及', '正当', '忽然', '蓦然', '霎时'],
    weight: 0.2,
  },
};

const CLIFFHANGER_PATTERNS: Record<CliffhangerDimension, { keywords: string[]; weight: number }> = {
  [CliffhangerDimension.UNRESOLVED_QUESTIONS]: {
    keywords: ['到底', '为什么', '难道', '究竟是', '谁', '什么', '如何', '是否', '难道说', '不会是', '难不成'],
    weight: 0.3,
  },
  [CliffhangerDimension.EMOTIONAL_PEAK]: {
    keywords: ['颤抖', '不敢相信', '震惊', '瞳孔骤缩', '血液凝固', '呆住了', '愣住', '窒息', '心如刀绞', '崩溃', '绝望', '恐惧', '愤怒'],
    weight: 0.25,
  },
  [CliffhangerDimension.TWIST_IMPACT]: {
    keywords: ['竟然是', '原来', '出乎意料', '反转', '意想不到', '万万没想到', '谁能想到', '事实却是', '结果', '真相竟然'],
    weight: 0.25,
  },
  [CliffhangerDimension.ANTICIPATION]: {
    keywords: ['接下来', '即将', '将要', '就要', '等着', '还没有', '未完', '故事才', '序幕', '才刚刚开始', '更大的', '更恐怖的'],
    weight: 0.2,
  },
};

// ============================================================
// Scoring
// ============================================================

function scoreTextSegment(
  text: string,
  patterns: Record<string, { keywords: string[]; weight: number }>,
): { scores: Record<string, number>; evidence: string[] } {
  const scores: Record<string, number> = {};
  const allEvidence: string[] = [];

  for (const [dim, config] of Object.entries(patterns)) {
    const hits: string[] = [];
    for (const kw of config.keywords) {
      if (text.includes(kw)) {
        hits.push(kw);
        if (!allEvidence.includes(kw)) allEvidence.push(kw);
      }
    }
    const rawScore = Math.min(100, hits.length * 20);
    scores[dim] = rawScore;
  }

  return { scores, evidence: allEvidence };
}

function weightedOverall(
  scores: Record<string, number>,
  patterns: Record<string, { keywords: string[]; weight: number }>,
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [dim, config] of Object.entries(patterns)) {
    weightedSum += (scores[dim] ?? 0) * config.weight;
    totalWeight += config.weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function extractBoundary(text: string, position: 'opening' | 'ending', charCount: number): string {
  if (position === 'opening') {
    return text.slice(0, Math.min(charCount, text.length));
  }
  return text.slice(Math.max(0, text.length - charCount));
}

// ============================================================
// Public API
// ============================================================

export function scoreHook(openingText: string): HookScore {
  const boundaryChars = 200;
  const segment = extractBoundary(openingText, 'opening', boundaryChars);
  const { scores, evidence } = scoreTextSegment(segment, HOOK_PATTERNS);

  return {
    overall: weightedOverall(scores, HOOK_PATTERNS),
    dimensions: {
      [HookDimension.CONFLICT_HINT]: scores[HookDimension.CONFLICT_HINT] ?? 0,
      [HookDimension.INFO_GAP]: scores[HookDimension.INFO_GAP] ?? 0,
      [HookDimension.SENSORY_IMPACT]: scores[HookDimension.SENSORY_IMPACT] ?? 0,
      [HookDimension.PACING_ENTRY]: scores[HookDimension.PACING_ENTRY] ?? 0,
    },
    evidence,
  };
}

export function scoreCliffhanger(endingText: string): CliffhangerScore {
  const boundaryChars = 200;
  const segment = extractBoundary(endingText, 'ending', boundaryChars);
  const { scores, evidence } = scoreTextSegment(segment, CLIFFHANGER_PATTERNS);

  return {
    overall: weightedOverall(scores, CLIFFHANGER_PATTERNS),
    dimensions: {
      [CliffhangerDimension.UNRESOLVED_QUESTIONS]: scores[CliffhangerDimension.UNRESOLVED_QUESTIONS] ?? 0,
      [CliffhangerDimension.EMOTIONAL_PEAK]: scores[CliffhangerDimension.EMOTIONAL_PEAK] ?? 0,
      [CliffhangerDimension.TWIST_IMPACT]: scores[CliffhangerDimension.TWIST_IMPACT] ?? 0,
      [CliffhangerDimension.ANTICIPATION]: scores[CliffhangerDimension.ANTICIPATION] ?? 0,
    },
    evidence,
  };
}

export function analyzeHookCliffhanger(
  chapters: Array<{ content: string; chapterIndex: number }>,
): HookCliffhangerResult {
  if (chapters.length === 0) {
    return {
      chapters: [],
      averageHookScore: 0,
      averageCliffhangerScore: 0,
      weakChapters: [],
      suggestions: ['没有章节数据'],
    };
  }

  const chapterScores: ChapterBoundaryScore[] = chapters.map((ch) => ({
    hook: scoreHook(ch.content),
    cliffhanger: scoreCliffhanger(ch.content),
  }));

  const avgHook = Math.round(
    chapterScores.reduce((s, c) => s + c.hook.overall, 0) / chapterScores.length,
  );
  const avgCliff = Math.round(
    chapterScores.reduce((s, c) => s + c.cliffhanger.overall, 0) / chapterScores.length,
  );

  const weakChapters = chapters
    .filter((_, i) => chapterScores[i].hook.overall < 20 && chapterScores[i].cliffhanger.overall < 20)
    .map((ch) => ch.chapterIndex);

  const suggestions: string[] = [];
  if (avgHook < 30) suggestions.push('章节开头钩子强度不足，建议在每章前 200 字内加入冲突暗示或信息悬念');
  if (avgCliff < 30) suggestions.push('章节结尾悬念不足，建议在每章末尾 200 字留下未解问题或情感高峰');
  if (weakChapters.length > chapters.length * 0.5) suggestions.push('超过半数章节的开头和结尾都缺乏吸引力，建议系统性增强断章技巧');
  if (suggestions.length === 0) suggestions.push('钩子和悬念分布合理，读者留存基础良好');

  return {
    chapters: chapterScores,
    averageHookScore: avgHook,
    averageCliffhangerScore: avgCliff,
    weakChapters,
    suggestions,
  };
}
