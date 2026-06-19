/**
 * Writing Craft — Retention Rhythm Analysis (网文留存节奏分析)
 *
 * Chapter-level retention analysis based on:
 * - 爽文5季: Golden 3 chapters, pay wall density, hook escalation
 * - Web novel retention rules: 3-chapter micro-cycle, 10-chapter macro-cycle
 */

export interface ChapterRetentionProfile {
  chapterIndex: number;
  hookStrength: number;
  satisfactionDensity: number;
  cliffhanger: boolean;
  payWallProximity: 'before' | 'at' | 'after' | 'none';
}

export interface RetentionRhythmResult {
  profiles: ChapterRetentionProfile[];
  goldenThreeScore: number;
  payWallDensity: number;
  rhythmScore: number;
  microCycles: { start: number; end: number; satisfactionPresent: boolean }[];
  suggestions: string[];
}

const HOOK_PATTERNS: Array<{ pattern: string; weight: number }> = [
  { pattern: '突然', weight: 8 },
  { pattern: '就在这时', weight: 9 },
  { pattern: '却不知道', weight: 8 },
  { pattern: '就在此时', weight: 8 },
  { pattern: '一道声音', weight: 7 },
  { pattern: '一道黑影', weight: 7 },
  { pattern: '门被推开', weight: 6 },
  { pattern: '还没来得及', weight: 7 },
  { pattern: '然而', weight: 5 },
  { pattern: '不料', weight: 6 },
  { pattern: '竟然', weight: 6 },
  { pattern: '一个惊人的', weight: 7 },
  { pattern: '不敢相信', weight: 5 },
  { pattern: '看到了一个', weight: 4 },
  { pattern: '发生了什么', weight: 5 },
];

const SATISFACTION_PATTERNS = [
  '震惊', '碾压', '秒杀', '突破', '晋级', '打脸', '复仇', '逆袭',
  '真相', '原来', '终于', '获得', '成功', '战胜', '征服', '认可',
];

const CLIFFHANGER_PATTERNS = [
  '还没来得及', '就在这时', '却不知道', '却没注意到', '他不知道的是',
  '殊不知', '谁也没想到', '并没有意识到', '身后传来', '黑暗中',
];

export function analyzeRetentionRhythm(
  chapters: Array<{ content: string; chapterIndex: number }>,
  payWallChapter?: number,
): RetentionRhythmResult {
  if (chapters.length === 0) {
    return { profiles: [], goldenThreeScore: 0, payWallDensity: 0, rhythmScore: 0, microCycles: [], suggestions: ['没有章节数据'] };
  }

  const profiles: ChapterRetentionProfile[] = chapters.map((ch) => {
    const hookStrength = calculateHookStrength(ch.content);
    const satisfactionDensity = calculateSatisfactionDensity(ch.content);
    const cliffhanger = CLIFFHANGER_PATTERNS.some((p) => ch.content.includes(p));

    let payWallProximity: ChapterRetentionProfile['payWallProximity'] = 'none';
    if (payWallChapter) {
      if (ch.chapterIndex === payWallChapter) payWallProximity = 'at';
      else if (ch.chapterIndex === payWallChapter - 1) payWallProximity = 'before';
      else if (ch.chapterIndex === payWallChapter + 1) payWallProximity = 'after';
    }

    return { chapterIndex: ch.chapterIndex, hookStrength, satisfactionDensity, cliffhanger, payWallProximity };
  });

  // Golden 3 chapters score
  const first3 = profiles.slice(0, Math.min(3, profiles.length));
  const goldenThreeScore = Math.round(first3.reduce((sum, p) => sum + p.hookStrength + p.satisfactionDensity * 2, 0) / first3.length);

  // Pay wall density
  const payWallCh = profiles.find((p) => p.payWallProximity === 'before' || p.payWallProximity === 'at');
  const payWallDensity = payWallCh ? payWallCh.satisfactionDensity * 2 + payWallCh.hookStrength : 0;

  // Micro cycles (every 3 chapters should have satisfaction)
  const microCycles: RetentionRhythmResult['microCycles'] = [];
  for (let i = 0; i < chapters.length; i += 3) {
    const end = Math.min(i + 2, chapters.length - 1);
    const cycleProfiles = profiles.slice(i, end + 1);
    const hasSatisfaction = cycleProfiles.some((p) => p.satisfactionDensity > 0);
    microCycles.push({ start: chapters[i].chapterIndex, end: chapters[end].chapterIndex, satisfactionPresent: hasSatisfaction });
  }

  // Overall rhythm score
  const avgHook = profiles.reduce((s, p) => s + p.hookStrength, 0) / profiles.length;
  const avgSatisfaction = profiles.reduce((s, p) => s + p.satisfactionDensity, 0) / profiles.length;
  const cyclesWithSatisfaction = microCycles.filter((c) => c.satisfactionPresent).length;
  const cycleRatio = cyclesWithSatisfaction / microCycles.length;
  const rhythmScore = Math.round(avgHook * 0.3 + Math.min(avgSatisfaction * 10, 40) + cycleRatio * 30);

  // Suggestions
  const suggestions: string[] = [];
  if (goldenThreeScore < 15) suggestions.push('黄金三章钩子和爽点不足，建议前3章加强冲突和满足感');
  if (cycleRatio < 0.5) suggestions.push('部分3章微周期缺少爽点，建议每3章至少安排一个小满足');
  if (payWallChapter && payWallDensity < 10) suggestions.push('付费卡点前的爽点密度不足，建议在卡点前堆叠最强钩子');
  if (profiles.filter((p) => p.cliffhanger).length < profiles.length * 0.3) suggestions.push('章节末尾钩子不足30%，建议增加断章悬念');
  if (suggestions.length === 0) suggestions.push('留存节奏良好，钩子和爽点分布合理');

  return { profiles, goldenThreeScore, payWallDensity, rhythmScore, microCycles, suggestions };
}

function calculateHookStrength(text: string): number {
  let strength = 0;
  for (const { pattern, weight } of HOOK_PATTERNS) {
    if (text.includes(pattern)) strength += weight;
  }
  return Math.min(100, strength);
}

function calculateSatisfactionDensity(text: string): number {
  let count = 0;
  for (const pattern of SATISFACTION_PATTERNS) {
    const occurrences = text.split(pattern).length - 1;
    count += occurrences;
  }
  return count;
}
