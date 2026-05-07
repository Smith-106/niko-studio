/**
 * Suspense Analyzer
 *
 * Multi-model suspense analysis combining:
 * 1. Frey's three pillars (Story Questions, Threat Situations, Lit Fuses)
 * 2. Bell's three-act structure (Disturbance → Midpoint → All-Is-Lost)
 * 3. 蔡骏 setup-payoff cycle (设局-解局)
 * 4. 爽点密度 scoring (reader satisfaction density)
 */

import type { INarrativeLLMClient } from './types.js';
import { SuspenseSubgenre, SUBGENRE_RULES } from './writing-craft/craft-catalog';

// ============================================================
// Enums
// ============================================================

export enum SuspensePillar {
  STORY_QUESTION = 'story_question',
  THREAT_SITUATION = 'threat_situation',
  LIT_FUSE = 'lit_fuse',
}

// ============================================================
// Data Types
// ============================================================

export interface StoryQuestion {
  question: string;
  location: string;
  intensity: number;
  isAnswered: boolean;
  answerLocation: string | null;
}

export interface ThreatSituation {
  threatType: string;
  description: string;
  targetCharacter: string;
  intensity: number;
  isResolved: boolean;
}

export interface LitFuse {
  crisis: string;
  deadline: string;
  consequence: string;
  intensity: number;
  isDefused: boolean;
}

export interface SuspenseScore {
  pillar: SuspensePillar;
  score: number;
  elements: (StoryQuestion | ThreatSituation | LitFuse)[];
  issues: string[];
  suggestions: string[];
}

export interface SuspenseAnalysisResult {
  storyQuestions: SuspenseScore;
  threatSituations: SuspenseScore;
  litFuses: SuspenseScore;
  overallScore: number;
  suspenseLevel: string;
  suspenseCurve: [string, number][];
  threeAct?: ThreeActAnalysis;
  setupPayoffs?: SetupPayoffResult;
  satisfactionDensity?: SatisfactionDensityResult;
}

// ============================================================
// Bell三幕结构 (Three-Act Structure)
// ============================================================

export enum ActBeat {
  OPENING_IMAGE = 'opening_image',
  SETUP = 'setup',
  DISTURBANCE = 'disturbance',       // 15% — 打破日常
  DEBATE = 'debate',
  BREAK_INTO_TWO = 'break_into_two', // 25% — 进入第二幕
  B_STORY = 'b_story',
  FUN_AND_GAMES = 'fun_and_games',
  MIDPOINT = 'midpoint',             // 50% — 转折/虚假胜利
  BAD_GUYS_CLOSE_IN = 'bad_guys_close_in',
  ALL_IS_LOST = 'all_is_lost',       // 75% — 失去一切
  DARK_NIGHT = 'dark_night',
  BREAK_INTO_THREE = 'break_into_three',
  CLIMAX = 'climax',
  FINAL_IMAGE = 'final_image',
}

export interface ActBeatDetection {
  beat: ActBeat;
  position: number;         // 0-1, relative position in text
  detected: boolean;
  evidence: string;
  intensity: number;
}

export interface ThreeActAnalysis {
  beats: ActBeatDetection[];
  act1Score: number;        // 0-10: How well Act 1 is structured
  act2Score: number;
  act3Score: number;
  overallStructureScore: number;
  missingBeats: ActBeat[];
  suggestions: string[];
}

// ============================================================
// 蔡骏 设局-解局循环 (Setup-Payoff Cycle)
// ============================================================

export enum SetupPayoffState {
  SETUP = 'setup',          // 设局 — 制造悬念/困境
  ESCALATION = 'escalation', // 加码 — 提高风险
  PAYOFF = 'payoff',        // 解局 — 揭示/解决
  AFTERMATH = 'aftermath',  // 余波 — 后果和新悬念
}

export interface SetupPayoffCycle {
  id: string;
  state: SetupPayoffState;
  description: string;
  intensity: number;
  position: number;
  isResolved: boolean;
  linkedCycleId: string | null;
}

export interface SetupPayoffResult {
  cycles: SetupPayoffCycle[];
  unresolvedCount: number;
  averageSetupToPayoff: number;
  cycleScore: number;
  suggestions: string[];
}

// ============================================================
// 爽点密度 (Satisfaction Density)
// ============================================================

export enum SatisfactionType {
  POWER_FANTASY = 'power_fantasy',     // 力量幻想 — 主角展示实力
  FACE_SLAPPING = 'face_slapping',     // 打脸 — 反转碾压
  REVELATION = 'revelation',           // 揭秘 — 真相大白
  VICTORY = 'victory',                 // 胜利 — 克服困难
  EMOTIONAL_PAYOFF = 'emotional_payoff', // 情感回报
  WORLD_EXPANSION = 'world_expansion',   // 世界观扩展
}

export interface SatisfactionPoint {
  type: SatisfactionType;
  description: string;
  intensity: number;
  position: number;
  isPayoff: boolean;
}

export interface SatisfactionDensityResult {
  points: SatisfactionPoint[];
  density: number;           // satisfaction points per 1000 chars
  averageInterval: number;   // chars between satisfaction points
  balanceScore: number;      // how evenly distributed (0-10)
  suggestions: string[];
}

export function computeSuspenseResult(
  storyQuestions: SuspenseScore,
  threatSituations: SuspenseScore,
  litFuses: SuspenseScore,
): SuspenseAnalysisResult {
  const overallScore =
    (storyQuestions.score * 0.3 +
      threatSituations.score * 0.4 +
      litFuses.score * 0.3) *
    10;

  let suspenseLevel: string;
  if (overallScore >= 85) suspenseLevel = 'GRIPPING';
  else if (overallScore >= 70) suspenseLevel = 'HIGH';
  else if (overallScore >= 50) suspenseLevel = 'MODERATE';
  else suspenseLevel = 'LOW';

  return {
    storyQuestions,
    threatSituations,
    litFuses,
    overallScore,
    suspenseLevel,
    suspenseCurve: [],
  };
}

// ============================================================
// LLM Prompts
// ============================================================

const STORY_QUESTION_PROMPT = `
## 故事问题检测 (Story Question Detection)

分析以下内容，找出所有能激发读者好奇心的"故事问题"。

**待分析内容**:
{content}

请输出JSON格式:
`;

const THREAT_SITUATION_PROMPT = `
## 威胁情境分析 (Threat Situation Analysis)

分析以下内容，找出所有让读者为角色担忧的威胁情境。

**待分析内容**:
{content}

**角色信息**:
{character_info}

请输出JSON格式:
`;

const LIT_FUSE_PROMPT = `
## 导火索检测 (Lit Fuse Detection)

分析以下内容，找出所有"点燃的导火索"——有明确时限的危机。

**待分析内容**:
{content}

请输出JSON格式:
`;

// ============================================================
// SuspenseAnalyzer
// ============================================================

export class SuspenseAnalyzer {
  private llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  async detectStoryQuestions(content: string): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockStoryQuestions();

    try {
      const prompt = STORY_QUESTION_PROMPT.replace('{content}', content);
      const result = await this.llmClient.generateJson<{
        questions: Array<{
          question: string;
          location: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const questions: StoryQuestion[] = (result.questions ?? []).map((q) => ({
        question: q.question,
        location: q.location,
        intensity: q.intensity,
        isAnswered: false,
        answerLocation: null,
      }));

      return {
        pillar: SuspensePillar.STORY_QUESTION,
        score: result.score,
        elements: questions,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockStoryQuestions();
    }
  }

  async analyzeThreatSituations(
    content: string,
    characterInfo: Record<string, unknown>,
  ): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockThreatSituations();

    try {
      const prompt = THREAT_SITUATION_PROMPT.replace(
        '{content}',
        content,
      ).replace('{character_info}', JSON.stringify(characterInfo));

      const result = await this.llmClient.generateJson<{
        threats: Array<{
          threat_type: string;
          description: string;
          target_character: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const threats: ThreatSituation[] = (result.threats ?? []).map((t) => ({
        threatType: t.threat_type,
        description: t.description,
        targetCharacter: t.target_character,
        intensity: t.intensity,
        isResolved: false,
      }));

      return {
        pillar: SuspensePillar.THREAT_SITUATION,
        score: result.score,
        elements: threats,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockThreatSituations();
    }
  }

  async findLitFuses(content: string): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockLitFuses();

    try {
      const prompt = LIT_FUSE_PROMPT.replace('{content}', content);
      const result = await this.llmClient.generateJson<{
        fuses: Array<{
          crisis: string;
          deadline: string;
          consequence: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const fuses: LitFuse[] = (result.fuses ?? []).map((f) => ({
        crisis: f.crisis,
        deadline: f.deadline,
        consequence: f.consequence,
        intensity: f.intensity,
        isDefused: false,
      }));

      return {
        pillar: SuspensePillar.LIT_FUSE,
        score: result.score,
        elements: fuses,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockLitFuses();
    }
  }

  async analyzeFull(
    content: string,
    characterInfo: Record<string, unknown>,
  ): Promise<SuspenseAnalysisResult> {
    const storyQuestions = await this.detectStoryQuestions(content);
    const threatSituations = await this.analyzeThreatSituations(
      content,
      characterInfo,
    );
    const litFuses = await this.findLitFuses(content);

    return computeSuspenseResult(
      storyQuestions,
      threatSituations,
      litFuses,
    );
  }

  calculateSuspenseCurve(
    scenes: Array<{ scene_id?: string; suspense_intensity?: number }>,
  ): [string, number][] {
    return scenes.map((scene) => [
      scene.scene_id ?? 'unknown',
      scene.suspense_intensity ?? 5.0,
    ]);
  }

  suggestSuspenseEnhancement(result: SuspenseAnalysisResult): string[] {
    const suggestions: string[] = [];

    if (result.storyQuestions.score < 6) {
      suggestions.push(
        '开篇需要更强的故事问题来抓住读者',
      );
      suggestions.push(...result.storyQuestions.suggestions);
    }

    if (result.threatSituations.score < 6) {
      suggestions.push(
        '威胁情境不够明确，读者难以为角色担忧',
      );
      suggestions.push(...result.threatSituations.suggestions);
    }

    if (result.litFuses.score < 6) {
      suggestions.push(
        '缺少时限压力，考虑增加导火索元素',
      );
      suggestions.push(...result.litFuses.suggestions);
    }

    if (result.threeAct) {
      suggestions.push(...result.threeAct.suggestions);
    }

    if (result.satisfactionDensity && result.satisfactionDensity.density < 1.5) {
      suggestions.push('爽点密度偏低，建议每1000字至少1个满足感点');
    }

    return suggestions;
  }

  // ============================================================
  // Bell三幕结构分析
  // ============================================================

  analyzeThreeActStructure(
    scenes: Array<{ content: string; position: number }>,
  ): ThreeActAnalysis {
    const beats: ActBeatDetection[] = [];
    const totalScenes = scenes.length;

    const requiredBeats: Array<{
      beat: ActBeat;
      posRange: [number, number];
      keywords: string[];
    }> = [
      { beat: ActBeat.DISTURBANCE, posRange: [0.1, 0.2], keywords: ['突然', '意外', '发现', '不料', '然而', '但'] },
      { beat: ActBeat.BREAK_INTO_TWO, posRange: [0.2, 0.3], keywords: ['决定', '踏上', '开始', '必须', '出发'] },
      { beat: ActBeat.MIDPOINT, posRange: [0.45, 0.55], keywords: ['转折', '真相', '原来', '竟然', '出人意料'] },
      { beat: ActBeat.ALL_IS_LOST, posRange: [0.7, 0.8], keywords: ['失去', '失败', '绝望', '不可能', '完了', '坠入'] },
      { beat: ActBeat.CLIMAX, posRange: [0.85, 0.95], keywords: ['决战', '最终', '对抗', '真相大白', '最后一'] },
    ];

    const detectedBeats = new Set<ActBeat>();

    for (const required of requiredBeats) {
      let best: ActBeatDetection | null = null;
      let bestIntensity = 0;

      for (const scene of scenes) {
        const normalizedPos = scene.position;
        if (normalizedPos < required.posRange[0] || normalizedPos > required.posRange[1]) continue;

        const matchCount = required.keywords.filter(kw => scene.content.includes(kw)).length;
        const intensity = matchCount / required.keywords.length;

        if (intensity > bestIntensity) {
          bestIntensity = intensity;
          best = {
            beat: required.beat,
            position: normalizedPos,
            detected: intensity > 0,
            evidence: required.keywords.filter(kw => scene.content.includes(kw)).join(', '),
            intensity: intensity * 10,
          };
        }
      }

      if (best && best.detected) {
        beats.push(best);
        detectedBeats.add(required.beat);
      } else {
        beats.push({
          beat: required.beat,
          position: (required.posRange[0] + required.posRange[1]) / 2,
          detected: false,
          evidence: '',
          intensity: 0,
        });
      }
    }

    const missingBeats = requiredBeats
      .filter(r => !detectedBeats.has(r.beat))
      .map(r => r.beat);

    const act1Score = detectedBeats.has(ActBeat.DISTURBANCE) ? 7 : 3;
    const act2Score = (detectedBeats.has(ActBeat.MIDPOINT) ? 4 : 0) +
                      (detectedBeats.has(ActBeat.ALL_IS_LOST) ? 4 : 0) + 2;
    const act3Score = detectedBeats.has(ActBeat.CLIMAX) ? 8 : 3;

    const overallStructureScore = (act1Score + act2Score + act3Score) / 3;

    const suggestions: string[] = [];
    if (!detectedBeats.has(ActBeat.DISTURBANCE)) {
      suggestions.push('前15%缺少扰动事件(disturbance)打破日常平衡');
    }
    if (!detectedBeats.has(ActBeat.MIDPOINT)) {
      suggestions.push('中间50%缺少中点转折，考虑加入虚假胜利或虚假失败');
    }
    if (!detectedBeats.has(ActBeat.ALL_IS_LOST)) {
      suggestions.push('75%位置缺少"失去一切"时刻，这是进入高潮前的必要低谷');
    }
    if (!detectedBeats.has(ActBeat.CLIMAX)) {
      suggestions.push('缺少明确的高潮决战场景');
    }

    return {
      beats,
      act1Score,
      act2Score,
      act3Score,
      overallStructureScore,
      missingBeats,
      suggestions,
    };
  }

  // ============================================================
  // 蔡骏 设局-解局循环检测
  // ============================================================

  detectSetupPayoffCycles(
    scenes: Array<{ content: string; position: number }>,
  ): SetupPayoffResult {
    const cycles: SetupPayoffCycle[] = [];
    let cycleId = 0;

    const setupPatterns = [
      { keywords: ['秘密', '谜团', '奇怪', '不寻常', '疑点'], state: SetupPayoffState.SETUP },
      { keywords: ['危险', '逼近', '更加', '升级', '加剧'], state: SetupPayoffState.ESCALATION },
      { keywords: ['真相', '揭露', '原来', '解开了', '终于明白'], state: SetupPayoffState.PAYOFF },
    ];

    for (const scene of scenes) {
      for (const pattern of setupPatterns) {
        const matches = pattern.keywords.filter(kw => scene.content.includes(kw));
        if (matches.length > 0) {
          cycles.push({
            id: `cycle-${cycleId++}`,
            state: pattern.state,
            description: matches.join(', '),
            intensity: Math.min(matches.length / pattern.keywords.length * 10, 10),
            position: scene.position,
            isResolved: pattern.state === SetupPayoffState.PAYOFF,
            linkedCycleId: null,
          });
        }
      }
    }

    const unresolved = cycles.filter(c => !c.isResolved);
    const resolved = cycles.filter(c => c.isResolved);

    const averageSetupToPayoff = resolved.length > 0 && unresolved.length > 0
      ? Math.abs(
          resolved.reduce((s, c) => s + c.position, 0) / resolved.length -
          unresolved.reduce((s, c) => s + c.position, 0) / unresolved.length,
        ) * 100
      : 0;

    const cycleScore = resolved.length > 0
      ? Math.min((resolved.length / Math.max(cycles.length, 1)) * 10, 10)
      : 0;

    const suggestions: string[] = [];
    if (unresolved.length > resolved.length + 2) {
      suggestions.push(`有${unresolved.length - resolved.length}个设局未解局，读者可能感到困惑`);
    }
    if (resolved.length === 0 && unresolved.length > 0) {
      suggestions.push('所有悬念都在设局阶段，缺少解局/payoff');
    }
    if (averageSetupToPayoff > 30) {
      suggestions.push('设局到解局间隔过大，考虑缩短或中间增加小解局');
    }

    return {
      cycles,
      unresolvedCount: unresolved.length,
      averageSetupToPayoff,
      cycleScore,
      suggestions,
    };
  }

  // ============================================================
  // 爽点密度分析
  // ============================================================

  analyzeSatisfactionDensity(
    text: string,
  ): SatisfactionDensityResult {
    const points: SatisfactionPoint[] = [];
    const totalLength = text.length;

    const patterns: Array<{
      type: SatisfactionType;
      keywords: string[];
      payoff: boolean;
    }> = [
      { type: SatisfactionType.POWER_FANTASY, keywords: ['碾压', '震惊', '不可思议', '不可能', '怎么可能'], payoff: true },
      { type: SatisfactionType.FACE_SLAPPING, keywords: ['啪啪', '打脸', '目瞪口呆', '哑口无言', '脸色大变'], payoff: true },
      { type: SatisfactionType.REVELATION, keywords: ['真相', '原来是', '终于明白了', '一切都说通了'], payoff: true },
      { type: SatisfactionType.VICTORY, keywords: ['胜利', '赢了', '成功', '突破了', '打败'], payoff: true },
      { type: SatisfactionType.EMOTIONAL_PAYOFF, keywords: ['终于', '等到', '泪流满面', '激动', '感动'], payoff: true },
      { type: SatisfactionType.WORLD_EXPANSION, keywords: ['新大陆', '秘密', '隐藏', '传说', '禁忌'], payoff: false },
    ];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        let searchFrom = 0;
        while (searchFrom < totalLength) {
          const idx = text.indexOf(keyword, searchFrom);
          if (idx === -1) break;

          const nearby = text.slice(Math.max(0, idx - 30), Math.min(totalLength, idx + keyword.length + 30));
          points.push({
            type: pattern.type,
            description: nearby.trim(),
            intensity: pattern.payoff ? 7 : 4,
            position: idx / totalLength,
            isPayoff: pattern.payoff,
          });

          searchFrom = idx + keyword.length;
        }
      }
    }

    points.sort((a, b) => a.position - b.position);

    const density = totalLength > 0 ? (points.length / totalLength) * 1000 : 0;

    const intervals: number[] = [];
    for (let i = 1; i < points.length; i++) {
      intervals.push((points[i].position - points[i - 1].position) * totalLength);
    }
    const averageInterval = intervals.length > 0
      ? intervals.reduce((s, v) => s + v, 0) / intervals.length
      : totalLength;

    const payoffCount = points.filter(p => p.isPayoff).length;
    const nonPayoffCount = points.length - payoffCount;
    const balanceScore = points.length > 0
      ? Math.min(10, 10 - Math.abs(payoffCount - nonPayoffCount * 0.6) / Math.max(points.length, 1) * 10)
      : 0;

    const suggestions: string[] = [];
    if (density < 1.0) {
      suggestions.push('爽点密度极低，读者可能感到平淡。建议每1000字至少1个满足感点');
    } else if (density < 2.0) {
      suggestions.push('爽点密度适中，可适当增加力量幻想或打脸场景');
    }
    if (nonPayoffCount > payoffCount * 2) {
      suggestions.push('铺垫过多，缺少回报/兑现场景');
    }

    return { points, density, averageInterval, balanceScore, suggestions };
  }

  // ============================================================
  // Mock methods
  // ============================================================

  private mockStoryQuestions(): SuspenseScore {
    return {
      pillar: SuspensePillar.STORY_QUESTION,
      score: 7.0,
      elements: [
        {
          question: '主角接下来会怎么做？',
          location: '开篇',
          intensity: 7.0,
          isAnswered: false,
          answerLocation: null,
        },
      ],
      issues: [],
      suggestions: ['可以在开篇增加更直接的问题'],
    };
  }

  private mockThreatSituations(): SuspenseScore {
    return {
      pillar: SuspensePillar.THREAT_SITUATION,
      score: 6.0,
      elements: [],
      issues: ['威胁不够具体'],
      suggestions: ['增加更明确的威胁描写'],
    };
  }

  private mockLitFuses(): SuspenseScore {
    return {
      pillar: SuspensePillar.LIT_FUSE,
      score: 5.0,
      elements: [],
      issues: ['缺少时限压力'],
      suggestions: ['考虑增加deadline元素'],
    };
  }

  // ============================================================
  // Suspense Subgenre Detection
  // Source: H:\写作\悬疑 — 4条学习路径
  // ============================================================

  detectSubgenre(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): { subgenre: SuspenseSubgenre; label: string; confidence: number; evidence: string[] }[] {
    const allText = chapters.map((c) => c.content).join('\n');
    const results: Array<{ subgenre: SuspenseSubgenre; label: string; confidence: number; evidence: string[] }> = [];

    for (const def of Object.values(SUBGENRE_RULES)) {
      const typicalHits = def.keywords.typical.filter((kw) => allText.includes(kw));
      const atypicalHits = def.keywords.atypical.filter((kw) => allText.includes(kw));
      const requiredHits = def.requiredElements.filter((el) => allText.includes(el));

      const typicalScore = typicalHits.length / Math.max(def.keywords.typical.length, 1);
      const requiredScore = requiredHits.length / def.requiredElements.length;
      const atypicalPenalty = atypicalHits.length * 0.15;

      const confidence = Math.max(0, (typicalScore * 0.5 + requiredScore * 0.5) - atypicalPenalty);

      if (confidence > 0.1) {
        results.push({
          subgenre: def.subgenre,
          label: def.label,
          confidence: Math.round(confidence * 100) / 100,
          evidence: [...typicalHits],
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  checkSubgenreRules(
    chapters: Array<{ content: string; chapterIndex: number }>,
    subgenre: SuspenseSubgenre,
  ): { violations: string[]; suggestions: string[]; ruleScore: number } {
    const rules = SUBGENRE_RULES[subgenre];
    if (!rules) return { violations: [], suggestions: ['未知流派'], ruleScore: 0 };

    const allText = chapters.map((c) => c.content).join('\n');
    const violations: string[] = [];
    const suggestions: string[] = [];

    for (const rule of rules.coreRules) {
      const ruleKeywords = rule.split(/[、，,：:]/).filter((w) => w.length >= 2);
      const matched = ruleKeywords.some((kw) => allText.includes(kw));
      if (!matched && ruleKeywords.length > 0) {
        violations.push(`可能未遵守规则: ${rule}`);
      }
    }

    for (const forbidden of rules.forbiddenElements) {
      if (allText.includes(forbidden)) {
        violations.push(`包含禁止元素: ${forbidden}`);
      }
    }

    if (violations.length === 0) {
      suggestions.push(`${rules.label}的核心规则遵守良好`);
    }

    const ruleScore = Math.max(0, Math.round((1 - violations.length / (rules.coreRules.length + rules.forbiddenElements.length)) * 100));

    return { violations, suggestions, ruleScore };
  }

  // ============================================================
  // Closed-Circle (暴风雪山庄) Detection
  // ============================================================

  detectClosedCircle(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): { detected: boolean; confidence: number; elements: string[]; missing: string[] } {
    const allText = chapters.map((c) => c.content).join('\n');
    const elements: string[] = [];
    const missing: string[] = [];

    const requiredPatterns: Array<{ pattern: string; label: string }> = [
      { pattern: '孤岛', label: '孤岛/封闭地点' },
      { pattern: '暴风雪', label: '暴风雪/天气封锁' },
      { pattern: '大雪封山', label: '大雪封山' },
      { pattern: '别墅', label: '别墅/庄园' },
      { pattern: '庄园', label: '封闭场所' },
      { pattern: '无法离开', label: '无法离开' },
      { pattern: '出不去了', label: '封锁状态' },
      { pattern: '断桥', label: '断桥/通道阻断' },
      { pattern: '通讯中断', label: '通讯中断' },
      { pattern: '信号', label: '信号问题' },
      { pattern: '电话打不通', label: '通讯隔绝' },
      { pattern: '与世隔绝', label: '与世隔绝' },
      { pattern: '没有人能来', label: '外部援助不可达' },
    ];

    const characterPatterns = [
      '嫌疑人', '在场的', '在场', '一共', '所有人', '剩下的', '每个人',
    ];

    const eliminationPatterns = [
      '死了', '被杀', '尸体', '失踪', '消失', '不在了', '又死了一个',
    ];

    let closedLocationHits = 0;
    for (const { pattern, label } of requiredPatterns) {
      if (allText.includes(pattern)) {
        elements.push(label);
        closedLocationHits++;
      }
    }

    const charHits = characterPatterns.filter((p) => allText.includes(p));
    if (charHits.length >= 2) elements.push('有限角色群');

    const elimHits = eliminationPatterns.filter((p) => allText.includes(p));
    if (elimHits.length >= 2) elements.push('角色逐步消除');

    if (closedLocationHits === 0) missing.push('封闭地点（孤岛/别墅/暴风雪封锁等）');
    if (charHits.length < 2) missing.push('明确的有限嫌疑人群体');
    if (elimHits.length < 2) missing.push('角色逐步被消除');

    const confidence = Math.min(1, (closedLocationHits * 0.25 + charHits.length * 0.15 + elimHits.length * 0.15));
    const detected = confidence >= 0.3;

    return { detected, confidence: Math.round(confidence * 100) / 100, elements, missing };
  }
}
