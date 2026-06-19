/**
 * Show vs Tell Analyzer
 *
 * Extends style profile with showTellRatio and sensoryCoverage metrics.
 * Analyzes sensory description density, abstract vs concrete statement ratio,
 * emotional expression method, and generates paragraph-level heat map data.
 */

import type { INarrativeLLMClient } from './types';

// ============================================================
// Types
// ============================================================

export interface SensoryCoverage {
  visual: number;
  auditory: number;
  tactile: number;
  olfactory: number;
  gustatory: number;
  overall: number;
}

export interface ParagraphHeatMapEntry {
  paragraphIndex: number;
  showCount: number;
  tellCount: number;
  ratio: number;
  dominantSense: string;
}

export interface ShowTellResult {
  showTellRatio: number;
  showCount: number;
  tellCount: number;
  sensoryCoverage: SensoryCoverage;
  abstractVsConcrete: number;
  heatMap: ParagraphHeatMapEntry[];
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const TELL_INDICATORS = [
  '很生气', '很愤怒', '很难过', '很伤心', '很开心', '很高兴', '很害怕', '很恐惧',
  '很紧张', '很焦虑', '很感动', '很失望', '很尴尬', '很委屈',
  '感到愤怒', '感到悲伤', '感到恐惧', '感到温暖', '感到绝望',
  '觉得害怕', '觉得委屈', '心里很难受', '心里很难过', '心里很高兴',
  '他害怕', '她害怕', '他很伤心', '她很伤心',
  '心情沉重', '心如刀割', '心情复杂', '心情低落',
  '是一个', '有一种', '有一种感觉', '让人觉得', '令人感到',
  '非常', '特别', '十分', '极其', '无比', '异常',
];

const SHOW_INDICATORS = [
  '攥紧', '咬紧', '后退', '转头', '握拳', '砸', '摔', '拍案', '踱步',
  '哽咽', '盯着', '避开目光', '颤抖', '发抖', '瞳孔骤缩',
  '呼吸急促', '深吸一口气', '沉默不语', '久久没有说话',
  '猛地站起', '一拳砸在', '眼眶泛红', '眼眶湿润', '眼圈红了',
  '转过头去', '别过脸', '低下头', '垂下眼睛', '嘴角抽搐',
  '指甲掐入', '攥紧了衣角', '攥紧了拳头', '把杯子摔在地上',
  '紧抿着唇', '攥紧了手', '呼吸一滞', '手脚冰凉',
];

const SENSORY_PATTERNS: Record<keyof SensoryCoverage, string[]> = {
  visual: ['看到', '映入眼帘', '闪烁', '闪耀', '黑暗', '光明', '颜色', '明亮', '昏暗', '阴影', '轮廓', '光芒', '刺眼', '模糊', '清晰', '闪烁', '摇曳', '光亮'],
  auditory: ['听到', '响起', '回荡', '回响', '刺耳', '清脆', '沉闷', '轰鸣', '嘶吼', '低语', '呢喃', '嘀嗒', '呼啸', '噼啪', '嗡嗡', '啪', '咔嚓'],
  tactile: ['触摸', '冰凉', '滚烫', '粗糙', '光滑', '柔软', '坚硬', '刺痛', '温热', '湿润', '干燥', '麻木', '刺骨', '灼烧', '冰凉', '发麻', '颤抖'],
  olfactory: ['闻到', '刺鼻', '芬芳', '恶臭', '腥味', '甜腻', '清香', '焦味', '霉味', '泥土气息', '血腥味', '烟味', '香气'],
  gustatory: ['尝到', '苦涩', '甜蜜', '酸楚', '咸涩', '辛辣', '鲜美', '寡淡', '苦涩的滋味', '甜到', '发苦'],
  overall: [],
};

const SENSORY_KEYS: Array<Exclude<keyof SensoryCoverage, 'overall'>> = [
  'visual',
  'auditory',
  'tactile',
  'olfactory',
  'gustatory',
];

function getSensePatterns(key: Exclude<keyof SensoryCoverage, 'overall'>): string[] {
  return SENSORY_PATTERNS[key];
}

function entriesOfSensoryPatterns(): Array<[Exclude<keyof SensoryCoverage, 'overall'>, string[]]> {
  return SENSORY_KEYS.map((k) => [k, getSensePatterns(k)]);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function senseValue(sensory: SensoryCoverage, key: Exclude<keyof SensoryCoverage, 'overall'>): number {
  return sensory[key];
}

const ABSTRACT_MARKERS = [
  '美丽', '丑陋', '善良', '邪恶', '聪明', '愚蠢', '勇敢', '胆小',
  '温柔', '粗暴', '优雅', '粗俗', '高贵', '卑贱', '伟大', '渺小',
  '幸福', '痛苦', '快乐', '悲伤', '孤独', '寂寞', '自由', '束缚',
];

const CONCRETE_MARKERS = [
  '那把', '那个', '这个', '这种', '这把', '这块', '这条', '那件',
  '一巴掌', '一步', '一眼', '一声', '一滴', '一刀', '一拳', '一脚',
  '三步', '两次', '五分钟', '门口', '窗边', '桌角', '墙根',
];

// ============================================================
// Analysis
// ============================================================

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter((p) => p.length > 0);
}

function countPatterns(text: string, patterns: string[]): number {
  let count = 0;
  for (const p of patterns) {
    const occurrences = text.split(p).length - 1;
    count += occurrences;
  }
  return count;
}

function analyzeSensory(text: string): SensoryCoverage {
  const scores: Record<string, number> = {};
  let total = 0;

  for (const [sense, patterns] of entriesOfSensoryPatterns()) {
    const hits = patterns.filter((p) => text.includes(p)).length;
    const density = clamp01(hits / Math.max(patterns.length * 0.3, 1));
    scores[sense] = round2(density);
    total += hits;
  }

  const overall = SENSORY_KEYS.reduce((s, k) => s + (scores[k] ?? 0), 0) / SENSORY_KEYS.length;

  return {
    visual: scores.visual ?? 0,
    auditory: scores.auditory ?? 0,
    tactile: scores.tactile ?? 0,
    olfactory: scores.olfactory ?? 0,
    gustatory: scores.gustatory ?? 0,
    overall: round2(overall),
  };
}

function generateHeatMap(paragraphs: string[]): ParagraphHeatMapEntry[] {
  return paragraphs.map((para, idx) => {
    const showCount = countPatterns(para, SHOW_INDICATORS);
    const tellCount = countPatterns(para, TELL_INDICATORS);
    const total = showCount + tellCount;
    const ratio = total > 0 ? showCount / total : 0.5;

    let dominantSense = 'none';
    let maxHits = 0;
    for (const [sense, patterns] of Object.entries(SENSORY_PATTERNS)) {
      const hits = patterns.filter((p) => para.includes(p)).length;
      if (hits > maxHits) {
        maxHits = hits;
        dominantSense = sense;
      }
    }

    return {
      paragraphIndex: idx,
      showCount,
      tellCount,
      ratio: Math.round(ratio * 100) / 100,
      dominantSense,
    };
  });
}

// ============================================================
// Public API
// ============================================================

export function analyzeShowTell(text: string): ShowTellResult {
  if (!text.trim()) {
    return {
      showTellRatio: 0,
      showCount: 0,
      tellCount: 0,
      sensoryCoverage: { visual: 0, auditory: 0, tactile: 0, olfactory: 0, gustatory: 0, overall: 0 },
      abstractVsConcrete: 0.5,
      heatMap: [],
      suggestions: ['没有文本数据'],
    };
  }

  const showCount = countPatterns(text, SHOW_INDICATORS);
  const tellCount = countPatterns(text, TELL_INDICATORS);
  const total = showCount + tellCount;
  const showTellRatio = total > 0 ? Math.round((showCount / total) * 100) / 100 : 0.5;

  const sensoryCoverage = analyzeSensory(text);

  const abstractCount = countPatterns(text, ABSTRACT_MARKERS);
  const concreteCount = countPatterns(text, CONCRETE_MARKERS);
  const abstractConcreteTotal = abstractCount + concreteCount;
  const abstractVsConcrete = abstractConcreteTotal > 0
    ? Math.round((concreteCount / abstractConcreteTotal) * 100) / 100
    : 0.5;

  const paragraphs = splitParagraphs(text);
  const heatMap = generateHeatMap(paragraphs);

  const suggestions: string[] = [];
  if (showTellRatio < 0.3) {
    suggestions.push('展示(show)严重不足，大量使用直接叙述(tell)，建议用行为和细节替代直接情感陈述');
  } else if (showTellRatio < 0.5) {
    suggestions.push('展示比例偏低，参考"攥紧拳头"替代"很生气"的写法');
  }
  if (sensoryCoverage.overall < 0.2) {
    suggestions.push('感官描写覆盖度低，建议加入视觉、听觉、触觉等五感描写');
  }
  const weakSenses = entriesOfSensoryPatterns()
    .filter(([sense]) => senseValue(sensoryCoverage, sense) < 0.1)
    .map(([_, patterns]) => patterns[0]);

  const coveredSenses = entriesOfSensoryPatterns()
    .filter(([sense]) => senseValue(sensoryCoverage, sense) > 0.1)
    .map(([sense]) => sense);

  void coveredSenses;
  if (weakSenses.length >= 3) {
    suggestions.push(`超过3种感官描写缺失，当前主要覆盖：${coveredSenses.join('、') || '无'}`);
  }
  if (abstractVsConcrete < 0.4) {
    suggestions.push('抽象表述过多，建议使用具体的数量、位置、物品来替代模糊描述');
  }
  if (suggestions.length === 0) {
    suggestions.push('展示与叙述比例合理，感官描写覆盖良好');
  }

  return {
    showTellRatio,
    showCount,
    tellCount,
    sensoryCoverage,
    abstractVsConcrete,
    heatMap,
    suggestions,
  };
}
