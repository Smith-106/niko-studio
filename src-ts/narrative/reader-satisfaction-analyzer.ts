/**
 * Reader Satisfaction Analyzer
 *
 * Analyzes fiction text for reader satisfaction mechanics based on
 * Chinese web novel research (中国网络文学阅读潮流研究):
 *   - 爽点密度: satisfaction points per chapter/segment
 *   - 章节钩子: chapter-end hooks that drive continued reading
 *   - 期待节奏: expectation → delay → release rhythm
 *   - 爽点分类: 4-layer model (physical/psychological/social/achievement)
 */

import type { INarrativeLLMClient } from './types.js';
import { UpgradeSystem, UPGRADE_SYSTEMS, GoldenFingerType, GOLDEN_FINGERS } from './writing-craft/craft-catalog';

// ============================================================
// Enums
// ============================================================

export enum SatisfactionLayer {
  PHYSICAL = 'physical',       // 生理爽 — 力量碾压、速度感
  PSYCHOLOGICAL = 'psychological', // 心理爽 — 智商碾压、反转
  SOCIAL = 'social',           // 社交爽 — 被认可、被尊重
  ACHIEVEMENT = 'achievement', // 成就爽 — 突破、升级、获得
}

export enum HookType {
  CLIFFHANGER = 'cliffhanger',     // 悬念式 — 在最紧张处断章
  QUESTION = 'question',           // 问题式 — 抛出新问题
  REVELATION_HINT = 'revelation_hint', // 预告式 — 暗示即将揭示
  THREAT = 'threat',               // 威胁式 — 新危险出现
  PROMISE = 'promise',             // 承诺式 — 暗示即将到来的满足
}

export enum ExpectPhase {
  EXPECTATION = 'expectation',   // 期待 — 建立读者预期
  DELAY = 'delay',               // 延迟 — 挫折、困难、等待
  RELEASE = 'release',           // 释放 — 满足兑现
}

// ============================================================
// Data Types
// ============================================================

export interface SatisfactionPoint {
  layer: SatisfactionLayer;
  description: string;
  intensity: number;
  charPosition: number;
  chapterIndex: number;
}

export interface ChapterHook {
  chapterIndex: number;
  hookType: HookType;
  content: string;
  strength: number;
}

export interface ExpectationCycle {
  id: string;
  phase: ExpectPhase;
  description: string;
  chapterIndex: number;
  intensity: number;
  linkedCycleId: string | null;
}

export interface ReaderSatisfactionResult {
  satisfactionPoints: SatisfactionPoint[];
  hooks: ChapterHook[];
  expectationCycles: ExpectationCycle[];
  densityPerChapter: number[];
  averageHookStrength: number;
  rhythmScore: number;
  overallScore: number;
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const SATISFACTION_PATTERNS: Array<{
  layer: SatisfactionLayer;
  keywords: string[];
  baseIntensity: number;
}> = [
  { layer: SatisfactionLayer.PHYSICAL, keywords: ['碾压', '一击', '秒杀', '震撼', '恐怖如斯', '不费吹灰之力'], baseIntensity: 8 },
  { layer: SatisfactionLayer.PHYSICAL, keywords: ['速度', '力量', '突破极限', '爆发'], baseIntensity: 6 },
  { layer: SatisfactionLayer.PSYCHOLOGICAL, keywords: ['智商碾压', '算计', '早已看穿', '尽在掌握', '原来如此'], baseIntensity: 7 },
  { layer: SatisfactionLayer.PSYCHOLOGICAL, keywords: ['反转', '真相大白', '原来', '出乎意料'], baseIntensity: 8 },
  { layer: SatisfactionLayer.SOCIAL, keywords: ['刮目相看', '震惊全场', '目瞪口呆', '不敢相信', '跪了'], baseIntensity: 7 },
  { layer: SatisfactionLayer.SOCIAL, keywords: ['尊敬', '崇拜', '认可', '敬畏', '佩服'], baseIntensity: 6 },
  { layer: SatisfactionLayer.ACHIEVEMENT, keywords: ['突破', '升级', '进化', '觉醒', '获得'], baseIntensity: 7 },
  { layer: SatisfactionLayer.ACHIEVEMENT, keywords: ['成功', '征服', '掌握', '领悟', '达到了'], baseIntensity: 6 },
];

const HOOK_PATTERNS: Array<{
  type: HookType;
  keywords: string[];
}> = [
  { type: HookType.CLIFFHANGER, keywords: ['但就在这时', '突然', '然而下一刻', '就在此时', '一声'] },
  { type: HookType.QUESTION, keywords: ['究竟', '到底是谁', '为什么', '难道', '是否'] },
  { type: HookType.REVELATION_HINT, keywords: ['即将', '马上就要', '等到了', '秘密即将', '真相'] },
  { type: HookType.THREAT, keywords: ['危险', '来袭', '逼近', '危机', '敌人'] },
  { type: HookType.PROMISE, keywords: ['终于要', '就要', '即将迎来', '准备好了'] },
];

// ============================================================
// ReaderSatisfactionAnalyzer
// ============================================================

export class ReaderSatisfactionAnalyzer {
  private llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  analyzeSatisfaction(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): ReaderSatisfactionResult {
    const allPoints: SatisfactionPoint[] = [];
    const hooks: ChapterHook[] = [];
    const densityPerChapter: number[] = [];

    for (const chapter of chapters) {
      const text = chapter.content;
      const chapterPoints: SatisfactionPoint[] = [];

      for (const pattern of SATISFACTION_PATTERNS) {
        for (const keyword of pattern.keywords) {
          let idx = 0;
          while ((idx = text.indexOf(keyword, idx)) !== -1) {
            const nearby = text.slice(
              Math.max(0, idx - 20),
              Math.min(text.length, idx + keyword.length + 20),
            );
            chapterPoints.push({
              layer: pattern.layer,
              description: nearby.trim(),
              intensity: pattern.baseIntensity,
              charPosition: idx,
              chapterIndex: chapter.chapterIndex,
            });
            idx += keyword.length;
          }
        }
      }

      allPoints.push(...chapterPoints);
      densityPerChapter.push(
        text.length > 0 ? (chapterPoints.length / text.length) * 1000 : 0,
      );

      const hook = this.detectChapterHook(text, chapter.chapterIndex);
      if (hook) hooks.push(hook);
    }

    const expectationCycles = this.detectExpectationCycles(chapters);

    const averageHookStrength = hooks.length > 0
      ? hooks.reduce((s, h) => s + h.strength, 0) / hooks.length
      : 0;

    const payoffRatio = allPoints.length > 0
      ? allPoints.filter(p => p.intensity >= 7).length / allPoints.length
      : 0;

    const rhythmScore = Math.min(10, payoffRatio * 10 + averageHookStrength * 0.5);
    const overallScore = Math.min(10, (rhythmScore * 0.4 + averageHookStrength * 0.3 + (densityPerChapter.length > 0 ? densityPerChapter.reduce((s, d) => s + d, 0) / densityPerChapter.length * 2 : 0) * 0.3));

    const suggestions = this.generateSuggestions(
      allPoints,
      hooks,
      expectationCycles,
      densityPerChapter,
      chapters.length,
    );

    return {
      satisfactionPoints: allPoints,
      hooks,
      expectationCycles,
      densityPerChapter,
      averageHookStrength,
      rhythmScore,
      overallScore,
      suggestions,
    };
  }

  // ── Chapter Hook Detection ────────────────────────────────

  private detectChapterHook(
    chapterEnd: string,
    chapterIndex: number,
  ): ChapterHook | null {
    const tail = chapterEnd.slice(-200);
    if (tail.length < 20) return null;

    let bestType = HookType.CLIFFHANGER;
    let bestScore = 0;
    let bestContent = '';

    for (const pattern of HOOK_PATTERNS) {
      for (const keyword of pattern.keywords) {
        const idx = tail.lastIndexOf(keyword);
        if (idx !== -1) {
          const score = 3 + (idx / tail.length) * 7;
          if (score > bestScore) {
            bestScore = score;
            bestType = pattern.type;
            bestContent = tail.slice(idx, Math.min(tail.length, idx + 40)).trim();
          }
        }
      }
    }

    return bestScore > 3
      ? { chapterIndex, hookType: bestType, content: bestContent, strength: bestScore }
      : null;
  }

  // ── Expectation Cycle Detection ───────────────────────────

  private detectExpectationCycles(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): ExpectationCycle[] {
    const cycles: ExpectationCycle[] = [];
    let cycleId = 0;

    const phasePatterns: Array<{
      phase: ExpectPhase;
      keywords: string[];
    }> = [
      { phase: ExpectPhase.EXPECTATION, keywords: ['期待', '即将', '渴望', '目标是', '决心'] },
      { phase: ExpectPhase.DELAY, keywords: ['困难', '挫折', '失败', '不如意', '阻碍', '等待'] },
      { phase: ExpectPhase.RELEASE, keywords: ['终于', '成功了', '实现了', '突破', '如愿'] },
    ];

    for (const chapter of chapters) {
      for (const pattern of phasePatterns) {
        const matches = pattern.keywords.filter(kw => chapter.content.includes(kw));
        if (matches.length > 0) {
          cycles.push({
            id: `exp-${cycleId++}`,
            phase: pattern.phase,
            description: matches.join(', '),
            chapterIndex: chapter.chapterIndex,
            intensity: matches.length / pattern.keywords.length * 10,
            linkedCycleId: null,
          });
        }
      }
    }

    return cycles;
  }

  // ── Suggestions ───────────────────────────────────────────

  private generateSuggestions(
    points: SatisfactionPoint[],
    hooks: ChapterHook[],
    cycles: ExpectationCycle[],
    density: number[],
    chapterCount: number,
  ): string[] {
    const suggestions: string[] = [];

    const avgDensity = density.length > 0
      ? density.reduce((s, d) => s + d, 0) / density.length
      : 0;

    if (avgDensity < 1.0 && chapterCount > 0) {
      suggestions.push('平均爽点密度低于1/千字，读者可能感到节奏缓慢');
    }

    const weakHookChapters = chapterCount - hooks.length;
    if (weakHookChapters > chapterCount * 0.5) {
      suggestions.push(`超过一半章节(${weakHookChapters}/${chapterCount})缺少结尾钩子，追读率可能下降`);
    }

    const hasExpectation = cycles.some(c => c.phase === ExpectPhase.EXPECTATION);
    const hasRelease = cycles.some(c => c.phase === ExpectPhase.RELEASE);
    if (hasExpectation && !hasRelease) {
      suggestions.push('有期待铺垫但缺少释放/兑现，读者满足感不足');
    }

    const layerCoverage = new Set(points.map(p => p.layer)).size;
    if (layerCoverage < 3) {
      suggestions.push(`爽点层次单一(仅${layerCoverage}种)，建议覆盖生理/心理/社交/成就四个层次`);
    }

    return suggestions;
  }

  // ============================================================
  // M15: Upgrade System & Golden Finger Detection
  // Source: 《网络文学创作原理》+ 中国网络文学阅读潮流研究
  // ============================================================

  detectUpgradePattern(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): { system: UpgradeSystem; label: string; confidence: number; evidence: string[] }[] {
    const allText = chapters.map((c) => c.content).join('\n');
    const results: Array<{ system: UpgradeSystem; label: string; confidence: number; evidence: string[] }> = [];

    for (const def of Object.values(UPGRADE_SYSTEMS)) {
      const keywordHits = def.detectionKeywords.filter((kw) => allText.includes(kw));
      const markerHits = def.progressionMarkers.filter((kw) => allText.includes(kw));
      const triggerHits = def.satisfactionTriggers.filter((kw) => allText.includes(kw));

      const keywordScore = keywordHits.length / Math.max(def.detectionKeywords.length, 1);
      const markerScore = markerHits.length / Math.max(def.progressionMarkers.length, 1);
      const triggerScore = triggerHits.length / Math.max(def.satisfactionTriggers.length, 1);

      const confidence = keywordScore * 0.5 + markerScore * 0.3 + triggerScore * 0.2;

      if (confidence > 0.1) {
        results.push({
          system: def.system,
          label: def.label,
          confidence: Math.round(confidence * 100) / 100,
          evidence: [...keywordHits, ...markerHits.slice(0, 3)],
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  analyzeGoldenFinger(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): { type: GoldenFingerType; label: string; confidence: number; evidence: string[]; growthPattern: string }[] {
    const allText = chapters.map((c) => c.content).join('\n');
    const results: Array<{ type: GoldenFingerType; label: string; confidence: number; evidence: string[]; growthPattern: string }> = [];

    for (const def of Object.values(GOLDEN_FINGERS)) {
      const keywordHits = def.detectionKeywords.filter((kw) => allText.includes(kw));
      const manifestationHits = def.typicalManifestations.filter((kw) => allText.includes(kw));

      const keywordScore = keywordHits.length / Math.max(def.detectionKeywords.length, 1);
      const manifestationScore = manifestationHits.length / Math.max(def.typicalManifestations.length, 1);

      const confidence = keywordScore * 0.6 + manifestationScore * 0.4;

      if (confidence > 0.1) {
        results.push({
          type: def.type,
          label: def.label,
          confidence: Math.round(confidence * 100) / 100,
          evidence: [...keywordHits],
          growthPattern: def.powerGrowthPattern,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  analyzeWebNovelCurve(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): {
    upgradeDetections: ReturnType<ReaderSatisfactionAnalyzer['detectUpgradePattern']>;
    goldenFingerDetections: ReturnType<ReaderSatisfactionAnalyzer['analyzeGoldenFinger']>;
    upgradeNodes: { chapterIndex: number; keyword: string }[];
    curveData: { chapterIndex: number; hookStrength: number; upgradePresent: boolean; density: number }[];
    suggestions: string[];
  } {
    const upgradeDetections = this.detectUpgradePattern(chapters);
    const goldenFingerDetections = this.analyzeGoldenFinger(chapters);

    const upgradeNodes: { chapterIndex: number; keyword: string }[] = [];
    const upgradeKeywords = Object.values(UPGRADE_SYSTEMS).flatMap((d) => d.satisfactionTriggers);

    for (const chapter of chapters) {
      for (const kw of upgradeKeywords) {
        if (chapter.content.includes(kw)) {
          upgradeNodes.push({ chapterIndex: chapter.chapterIndex, keyword: kw });
          break;
        }
      }
    }

    const satisfactionResult = this.analyzeSatisfaction(chapters);

    const curveData = chapters.map((ch, i) => {
      const hook = satisfactionResult.hooks.find((h) => h.chapterIndex === ch.chapterIndex);
      const hasUpgrade = upgradeNodes.some((u) => u.chapterIndex === ch.chapterIndex);
      return {
        chapterIndex: ch.chapterIndex,
        hookStrength: hook?.strength ?? 0,
        upgradePresent: hasUpgrade,
        density: satisfactionResult.densityPerChapter[i] ?? 0,
      };
    });

    const suggestions: string[] = [];
    if (upgradeDetections.length === 0) {
      suggestions.push('未检测到明确的升级体系，网文读者通常期望清晰的成长路径');
    }
    if (goldenFingerDetections.length === 0) {
      suggestions.push('未检测到金手指设定，考虑给主角一个独特优势');
    }
    const lowHookChapters = curveData.filter((c) => c.hookStrength < 3).length;
    if (lowHookChapters > chapters.length * 0.5) {
      suggestions.push(`${lowHookChapters}章缺少有效的章末钩子，影响追读率`);
    }

    return { upgradeDetections, goldenFingerDetections, upgradeNodes, curveData, suggestions };
  }
}
