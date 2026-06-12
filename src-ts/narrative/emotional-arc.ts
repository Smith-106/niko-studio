/**
 * Emotional Arc Timeline
 *
 * Aggregates emotion dimension scores across chapters,
 * renders as interactive timeline data, detects tension deserts,
 * and compares against classic narrative curves.
 */

import { analyzeEmotionCraft, type EmotionCraftResult } from './writing-craft/emotion-craft';
import { analyzeEmotionLayers, type EmotionLayerResult } from './writing-craft/emotion-craft';

// ============================================================
// Types
// ============================================================

export interface EmotionalArcPoint {
  chapterIndex: number;
  emotionScore: number;
  showTellRatio: number;
  layerRichness: number;
  dominantEmotion: string;
  emotionalIntensity: number;
}

export interface TensionDesert {
  startChapter: number;
  endChapter: number;
  length: number;
  severity: 'low' | 'medium' | 'high';
}

export type NarrativeCurveType = 'hero_journey' | 'three_act' | 'freytag' | 'kishotenketsu';

export interface NarrativeCurve {
  type: NarrativeCurveType;
  label: string;
  points: number[];
}

export interface CurveMatch {
  curveType: NarrativeCurveType;
  label: string;
  similarity: number;
}

export interface EmotionalArcResult {
  timeline: EmotionalArcPoint[];
  tensionDeserts: TensionDesert[];
  curveMatches: CurveMatch[];
  overallArcScore: number;
  suggestions: string[];
}

// ============================================================
// Classic Curves (normalized 0-1)
// ============================================================

const NARRATIVE_CURVES: Record<NarrativeCurveType, NarrativeCurve> = {
  hero_journey: {
    type: 'hero_journey',
    label: '英雄之旅',
    points: [0.2, 0.3, 0.5, 0.4, 0.6, 0.7, 0.5, 0.8, 0.9, 0.7, 0.85, 0.95],
  },
  three_act: {
    type: 'three_act',
    label: '三幕结构',
    points: [0.3, 0.4, 0.5, 0.3, 0.6, 0.7, 0.8, 0.5, 0.7, 0.9, 0.95, 0.6],
  },
  freytag: {
    type: 'freytag',
    label: '弗雷塔格金字塔',
    points: [0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 0.8, 0.6, 0.45, 0.3, 0.2, 0.15],
  },
  kishotenketsu: {
    type: 'kishotenketsu',
    label: '起承转结',
    points: [0.3, 0.35, 0.4, 0.45, 0.5, 0.75, 0.9, 0.6, 0.5, 0.55, 0.5, 0.45],
  },
};

// ============================================================
// Analysis
// ============================================================

function computeEmotionalIntensity(craftResult: EmotionCraftResult): number {
  const { totalDetections, showRatio } = craftResult;
  if (totalDetections === 0) return 0;
  return Math.min(1, (totalDetections * (0.5 + showRatio * 0.5)) / 20);
}

function inferDominantEmotion(craftResult: EmotionCraftResult): string {
  if (craftResult.detections.length === 0) return '中性';
  const counts: Record<string, number> = {};
  for (const d of craftResult.detections) {
    counts[d.emotion] = (counts[d.emotion] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? '中性';
}

function normalizePoints(points: number[]): number[] {
  if (points.length === 0) return [];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min;
  if (range === 0) return points.map(() => 0.5);
  return points.map((p) => (p - min) / range);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function matchCurves(arcPoints: number[]): CurveMatch[] {
  const normalized = normalizePoints(arcPoints);
  const matches: CurveMatch[] = [];

  for (const curve of Object.values(NARRATIVE_CURVES)) {
    const curvePoints = normalizePoints(
      curve.points.length >= normalized.length
        ? curve.points.slice(0, normalized.length || 1)
        : [...curve.points, ...Array(normalized.length - curve.points.length).fill(curve.points[curve.points.length - 1] ?? 0.5)],
    );
    const similarity = cosineSimilarity(normalized, curvePoints);
    matches.push({ curveType: curve.type, label: curve.label, similarity: Math.round(similarity * 100) / 100 });
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

function detectTensionDeserts(timeline: EmotionalArcPoint[], threshold = 0.2): TensionDesert[] {
  const deserts: TensionDesert[] = [];
  let start = -1;

  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].emotionalIntensity < threshold) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        const length = i - start;
        if (length >= 2) {
          deserts.push({
            startChapter: timeline[start].chapterIndex,
            endChapter: timeline[i - 1].chapterIndex,
            length,
            severity: length >= 5 ? 'high' : length >= 3 ? 'medium' : 'low',
          });
        }
        start = -1;
      }
    }
  }

  if (start !== -1) {
    const length = timeline.length - start;
    if (length >= 2) {
      deserts.push({
        startChapter: timeline[start].chapterIndex,
        endChapter: timeline[timeline.length - 1].chapterIndex,
        length,
        severity: length >= 5 ? 'high' : length >= 3 ? 'medium' : 'low',
      });
    }
  }

  return deserts;
}

// ============================================================
// Public API
// ============================================================

export function analyzeEmotionalArc(
  chapters: Array<{ content: string; chapterIndex: number }>,
): EmotionalArcResult {
  if (chapters.length === 0) {
    return { timeline: [], tensionDeserts: [], curveMatches: [], overallArcScore: 0, suggestions: ['没有章节数据'] };
  }

  const timeline: EmotionalArcPoint[] = chapters.map((ch) => {
    const craftResult = analyzeEmotionCraft(ch.content);
    const layerResult = analyzeEmotionLayers(ch.content);

    return {
      chapterIndex: ch.chapterIndex,
      emotionScore: craftResult.score,
      showTellRatio: craftResult.showRatio,
      layerRichness: layerResult.overallRichness,
      dominantEmotion: inferDominantEmotion(craftResult),
      emotionalIntensity: computeEmotionalIntensity(craftResult),
    };
  });

  const tensionDeserts = detectTensionDeserts(timeline);
  const arcPoints = timeline.map((p) => p.emotionalIntensity);
  const curveMatches = matchCurves(arcPoints);

  const avgIntensity = timeline.reduce((s, p) => s + p.emotionalIntensity, 0) / timeline.length;
  const variance = timeline.reduce((s, p) => s + (p.emotionalIntensity - avgIntensity) ** 2, 0) / timeline.length;
  const dynamicRange = Math.sqrt(variance);
  const bestCurveMatch = curveMatches[0]?.similarity ?? 0;

  const desertPenalty = tensionDeserts
    .filter((d) => d.severity === 'high')
    .reduce((s, d) => s + d.length * 0.05, 0);

  const overallArcScore = Math.round(
    Math.min(100, (avgIntensity * 30 + dynamicRange * 40 + bestCurveMatch * 30 - desertPenalty * 100)),
  );

  const suggestions: string[] = [];
  if (tensionDeserts.length > 0) {
    const highDeserts = tensionDeserts.filter((d) => d.severity === 'high');
    if (highDeserts.length > 0) {
      suggestions.push(`存在 ${highDeserts.length} 处严重的情感沙漠（连续 ${highDeserts[0].length}+ 章缺乏情感变化），建议在章节 ${highDeserts[0].startChapter}-${highDeserts[0].endChapter} 加入情感冲突`);
    }
  }
  if (curveMatches.length > 0 && curveMatches[0].similarity < 0.5) {
    suggestions.push(`情感弧线与经典叙事曲线匹配度较低，参考"${curveMatches[0].label}"曲线调整情感起伏`);
  }
  if (dynamicRange < 0.1) {
    suggestions.push('情感弧线过于平坦，建议增加情感起伏，在高低谷之间制造对比');
  }
  if (suggestions.length === 0) {
    suggestions.push('情感弧线结构良好，起伏合理且无长时间情感沙漠');
  }

  return { timeline, tensionDeserts, curveMatches, overallArcScore, suggestions };
}

export const __test__ = {
  NARRATIVE_CURVES,
  inferDominantEmotion,
  normalizePoints,
  cosineSimilarity,
  matchCurves,
  detectTensionDeserts,
};
