/**
 * Heuristic novel quality evaluation for gateway quality-check endpoint.
 *
 * Migrated from src/workflow/novel_quality.py
 */

import { ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP } from './types.js';

// ============================================================
// Quality level / mode types
// ============================================================

export type QualityMode = 'auto' | 'manual';
export type QualityLevel = 'ultra' | 'high' | 'medium' | 'fluent';

/** Per-level dimension multipliers applied after raw scoring. */
export const LEVEL_DIMENSION_MULTIPLIER: Record<QualityLevel, Record<string, number>> = {
  ultra: {
    repetition: 1.08,
    tone: 1.0,
    clarity: 1.0,
    causality: 1.05,
    detail: 1.08,
    factuality: 1.0,
  },
  high: {
    repetition: 1.0,
    tone: 1.0,
    clarity: 1.0,
    causality: 1.0,
    detail: 1.0,
    factuality: 1.0,
  },
  medium: {
    repetition: 0.95,
    tone: 0.95,
    clarity: 0.95,
    causality: 0.95,
    detail: 0.9,
    factuality: 1.0,
  },
  fluent: {
    repetition: 0.88,
    tone: 0.9,
    clarity: 0.9,
    causality: 0.88,
    detail: 0.8,
    factuality: 1.0,
  },
};

// ============================================================
// Threshold constants (from novel-state.ts NOVEL_QUALITY_WEIGHTS / THRESHOLDS)
// These are duplicated here because novel-state.ts is part of this migration
// and we need the values at module load time.
// ============================================================

const NOVEL_QUALITY_WEIGHTS = {
  repetition: 0.20,
  tone: 0.13,
  clarity: 0.17,
  causality: 0.20,
  detail: 0.20,
  factuality: 0.10,
};

const NOVEL_QUALITY_THRESHOLDS = {
  pass: 99,
  block: 50.0,
  block_template_ratio: 0.80,
  repetition_issue: 0.45,
  repetition_issue_high: 0.70,
  min_conflict_points: 2,
  min_visual_details: 3,
  min_dialogue_ratio: 0.03,
  min_sentences_for_tone_issue: 4,
  low_quality: 55.0,
  low_clarity: 45.0,
};

const REPETITION_WEIGHT = NOVEL_QUALITY_WEIGHTS.repetition;
const TONE_WEIGHT = NOVEL_QUALITY_WEIGHTS.tone;
const CLARITY_WEIGHT = NOVEL_QUALITY_WEIGHTS.clarity;
const CAUSALITY_WEIGHT = NOVEL_QUALITY_WEIGHTS.causality;
const DETAIL_WEIGHT = NOVEL_QUALITY_WEIGHTS.detail;
const FACTUALITY_WEIGHT = NOVEL_QUALITY_WEIGHTS.factuality;

const PASS_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.pass;
const BLOCK_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.block;
const BLOCK_TEMPLATE_RATIO = NOVEL_QUALITY_THRESHOLDS.block_template_ratio;

const REPETITION_ISSUE_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.repetition_issue;
const REPETITION_ISSUE_HIGH_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.repetition_issue_high;
const MIN_CONFLICT_POINTS = NOVEL_QUALITY_THRESHOLDS.min_conflict_points;
const MIN_VISUAL_DETAILS = NOVEL_QUALITY_THRESHOLDS.min_visual_details;
const MIN_DIALOGUE_RATIO = NOVEL_QUALITY_THRESHOLDS.min_dialogue_ratio;
const MIN_SENTENCES_FOR_TONE_ISSUE = NOVEL_QUALITY_THRESHOLDS.min_sentences_for_tone_issue;
const LOW_QUALITY_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.low_quality;
const LOW_CLARITY_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.low_clarity;

/** Contract keys expected in a quality evaluation result. */
export const QUALITY_CONTRACT_KEYS: Set<string> = new Set([
  'analysis_schema_version',
  'quality_score',
  'issues',
  'metrics',
  'publish_recommendation',
]);

// ============================================================
// Keyword sets (bilingual: English + Chinese)
// ============================================================

const _CONFLICT_KEYWORDS: Set<string> = new Set([
  'conflict', 'struggle', 'risk', 'threat', 'danger', 'betray', 'argue', 'tension', 'crisis', 'oppose',
  '\u51b2\u7a81', '\u77db\u76fe', '\u5371\u673a', '\u4e89\u6267', '\u5bf9\u6297', '\u5a01\u80c1', '\u80cc\u53db', '\u5371\u9669',
]);

const _VISUAL_KEYWORDS: Set<string> = new Set([
  'light', 'shadow', 'color', 'glow', 'shape', 'eyes', 'face', 'window', 'street', 'rain', 'fog', 'sun', 'moon',
  '\u661f', '\u5149', '\u5f71', '\u8272', '\u773c', '\u8138', '\u7a97', '\u8857', '\u96e8', '\u96fe', '\u6708', '\u5929',
]);

const _CAUSAL_MARKERS: Set<string> = new Set([
  'because', 'therefore', 'so', 'thus', 'hence', 'since', 'as a result',
  '\u56e0\u4e3a', '\u6240\u4ee5', '\u56e0\u6b64', '\u4e8e\u662f', '\u5bfc\u81f4', '\u7ed3\u679c', '\u968f\u540e',
]);

const _TEMPLATE_PREFIXES: string[] = [
  'then', 'next', 'suddenly', 'after that', 'he ', 'she ', 'it ',
  '\u7136\u540e', '\u63a5\u7740', '\u7a81\u7136', '\u4ed6', '\u5979', '\u4ed6\u4eec', '\u5979\u4eec',
];

const _UNCERTAIN_MARKERS: Set<string> = new Set([
  'maybe', 'perhaps', 'probably', 'seems', 'I guess',
  '\u53ef\u80fd', '\u4e5f\u8bb8', '\u5927\u6982', '\u4f3c\u4e4e', '\u597d\u50cf',
]);

// ============================================================
// Regex patterns
// ============================================================

const _SENTENCE_SPLIT_RE = /[。！？!?\.]+|\n+/;
const _QUOTE_RE = /["""''「」『』]/g;
const _WORD_RE = /[A-Za-z]+|[\u4e00-\u9fff]/g;

// ============================================================
// Internal helpers
// ============================================================

function _clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function _normalizeSentence(sentence: string): string {
  return sentence.trim().toLowerCase().replace(/\s+/g, ' ');
}

function _normalizeQualityLevel(level: string): QualityLevel {
  const lower = (level ?? '').trim().toLowerCase();
  if (lower in LEVEL_DIMENSION_MULTIPLIER) return lower as QualityLevel;
  return 'high';
}

function _normalizeQualityMode(mode: string): QualityMode {
  const lower = (mode ?? '').trim().toLowerCase();
  if (lower === 'auto' || lower === 'manual') return lower;
  return 'auto';
}

function _buildDefaultDimensionScores(): Record<string, number> {
  return {
    repetition: 0.0,
    tone: 0.0,
    clarity: 0.0,
    causality: 0.0,
    detail: 0.0,
    factuality: 0.0,
  };
}

interface InternalMetrics {
  length: number;
  sentences: string[];
  word_count: number;
  dialogue_ratio: number;
  conflict_points: number;
  visual_details: number;
  template_sentence_ratio: number;
  duplicate_ratio: number;
}

function _buildDefaultMetrics(templateSentenceRatio = 0.0): Record<string, unknown> {
  return {
    dialogue_ratio: 0.0,
    conflict_points: 0,
    visual_details: 0,
    template_sentence_ratio: templateSentenceRatio,
    dimension_scores: _buildDefaultDimensionScores(),
  };
}

function _emptyResult(
  qualityLevel: string,
  qualityMode: string,
  degradeReason: string,
): Record<string, unknown> {
  const resolvedLevel = _normalizeQualityLevel(qualityLevel);
  const resolvedMode = _normalizeQualityMode(qualityMode);
  return {
    analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
    quality_score: 0.0,
    issues: [
      {
        severity: 'high',
        type: 'content',
        evidence: 'content is empty',
        suggestion: 'Provide non-empty novel content before quality check.',
      },
    ],
    metrics: {
      ..._buildDefaultMetrics(1.0),
      quality_level_used: resolvedLevel,
      quality_mode_used: resolvedMode,
      critical_gate_applied: true,
      critical_issue_count: 0,
      degraded: !!degradeReason,
      degrade_reason: degradeReason,
    },
    publish_recommendation: 'block',
  };
}

function _countKeywordHits(text: string, keywords: Set<string>): number {
  let total = 0;
  for (const kw of keywords) {
    let pos = -1;
    while ((pos = text.indexOf(kw, pos + 1)) !== -1) {
      total++;
    }
  }
  return total;
}

function _countOccurrences(text: string, substr: string): number {
  let count = 0;
  let pos = -1;
  while ((pos = text.indexOf(substr, pos + 1)) !== -1) {
    count++;
  }
  return count;
}

function _computeMetrics(text: string): InternalMetrics {
  const length = Math.max(text.length, 1);
  let sentences = text.split(_SENTENCE_SPLIT_RE).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length === 0) sentences = [text];

  // Count quotes using global regex
  const quoteMatches = text.match(_QUOTE_RE);
  const quoteCount = quoteMatches ? quoteMatches.length : 0;
  const dialogueRatio = _clamp(
    Math.round(Math.min(quoteCount * 6, length) / length * 10000) / 10000,
    0.0, 1.0,
  );

  const lowered = text.toLowerCase();
  const conflictPoints = _countKeywordHits(lowered, _CONFLICT_KEYWORDS);
  const visualDetails = _countKeywordHits(lowered, _VISUAL_KEYWORDS);

  // Duplicate detection
  const normalized = sentences.map(s => _normalizeSentence(s));
  const freq = new Map<string, number>();
  for (const ns of normalized) {
    freq.set(ns, (freq.get(ns) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of freq.values()) {
    if (count > 1) duplicates += count - 1;
  }
  const duplicateRatio = duplicates / Math.max(sentences.length, 1);

  // Template sentence ratio
  let templateHits = 0;
  for (const sentence of sentences) {
    const sentenceLower = sentence.trim().toLowerCase();
    if (_TEMPLATE_PREFIXES.some(prefix => sentenceLower.startsWith(prefix))) {
      templateHits++;
    }
  }
  const templateSentenceRatio = _clamp(
    Math.round(((templateHits / sentences.length) * 0.6 + duplicateRatio * 0.4) * 10000) / 10000,
    0.0, 1.0,
  );

  // Word count
  const wordMatches = text.match(_WORD_RE);
  const wordCount = wordMatches ? wordMatches.length : 0;

  return {
    length,
    sentences,
    word_count: wordCount,
    dialogue_ratio: dialogueRatio,
    conflict_points: conflictPoints,
    visual_details: visualDetails,
    template_sentence_ratio: templateSentenceRatio,
    duplicate_ratio: duplicateRatio,
  };
}

function _computeDimensionScores(
  text: string,
  metrics: InternalMetrics,
): Record<string, number> {
  const avgSentenceLength = metrics.word_count / Math.max(metrics.sentences.length, 1);

  const repetition = _clamp(100.0 - metrics.template_sentence_ratio * 110.0, 0.0, 100.0);
  const tone = _clamp(
    45.0 + metrics.dialogue_ratio * 70.0 + Math.min(metrics.conflict_points, 4) * 5.0,
    0.0, 100.0,
  );

  const clarityPenalty = Math.abs(avgSentenceLength - 16.0) * 2.2;
  const clarity = _clamp(92.0 - clarityPenalty, 0.0, 100.0);

  const causalHits = _countKeywordHits(text.toLowerCase(), _CAUSAL_MARKERS);
  const causality = _clamp(
    35.0 + Math.min(causalHits, 8) * 8.0 + Math.min(metrics.conflict_points, 5) * 5.0,
    0.0, 100.0,
  );

  const detail = _clamp(30.0 + Math.min(metrics.visual_details, 12) * 5.0, 0.0, 100.0);

  const uncertainHits = _countKeywordHits(text.toLowerCase(), _UNCERTAIN_MARKERS);
  const factuality = _clamp(88.0 - uncertainHits * 8.0, 0.0, 100.0);

  return {
    repetition: Math.round(repetition * 10) / 10,
    tone: Math.round(tone * 10) / 10,
    clarity: Math.round(clarity * 10) / 10,
    causality: Math.round(causality * 10) / 10,
    detail: Math.round(detail * 10) / 10,
    factuality: Math.round(factuality * 10) / 10,
  };
}

function _applyQualityLevelToScores(
  scores: Record<string, number>,
  qualityLevel: QualityLevel,
): Record<string, number> {
  const multipliers = LEVEL_DIMENSION_MULTIPLIER[qualityLevel];
  const adjusted: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    const factor = multipliers[key] ?? 1.0;
    adjusted[key] = Math.round(_clamp(value * factor, 0.0, 100.0) * 10) / 10;
  }
  return adjusted;
}

function _extractCriticalIssues(issues: Array<Record<string, string>>): Array<Record<string, string>> {
  return issues.filter(
    issue => String(issue.severity ?? '').toLowerCase() === 'critical',
  );
}

function _buildIssues(
  _text: string,
  metrics: InternalMetrics,
  dimensionScores: Record<string, number>,
  qualityScore: number,
): Array<Record<string, string>> {
  const issues: Array<Record<string, string>> = [];

  if (metrics.template_sentence_ratio >= REPETITION_ISSUE_THRESHOLD) {
    let severity: string = 'medium';
    if (metrics.template_sentence_ratio >= REPETITION_ISSUE_HIGH_THRESHOLD) severity = 'high';
    if (metrics.template_sentence_ratio >= 0.9) severity = 'critical';
    issues.push({
      severity,
      type: 'repetition',
      evidence: `template_sentence_ratio=${metrics.template_sentence_ratio}`,
      suggestion: 'Vary sentence openings and rewrite repeated lines with fresh actions.',
    });
  }

  if (metrics.conflict_points < MIN_CONFLICT_POINTS) {
    issues.push({
      severity: 'medium',
      type: 'causality',
      evidence: `conflict_points=${metrics.conflict_points}`,
      suggestion: 'Add explicit stakes and causal links between character actions and outcomes.',
    });
  }

  if (metrics.visual_details < MIN_VISUAL_DETAILS) {
    issues.push({
      severity: 'medium',
      type: 'detail',
      evidence: `visual_details=${metrics.visual_details}`,
      suggestion: 'Add concrete visual cues (light, color, movement, setting anchors).',
    });
  }

  if (metrics.dialogue_ratio < MIN_DIALOGUE_RATIO && metrics.sentences.length >= MIN_SENTENCES_FOR_TONE_ISSUE) {
    issues.push({
      severity: 'low',
      type: 'tone',
      evidence: `dialogue_ratio=${metrics.dialogue_ratio}`,
      suggestion: 'Consider adding dialogue beats to improve voice rhythm.',
    });
  }

  if (qualityScore < LOW_QUALITY_THRESHOLD || dimensionScores['clarity'] < LOW_CLARITY_THRESHOLD) {
    issues.push({
      severity: 'high',
      type: 'overall_quality',
      evidence: `quality_score=${qualityScore}`,
      suggestion: 'Revise structure first: clarify sequence, sharpen conflict, then enrich details.',
    });
  }

  return issues;
}

function _recommendation(
  metrics: InternalMetrics,
  qualityScore: number,
  issues: Array<Record<string, string>>,
  criticalIssues: Array<Record<string, string>>,
  criticalGateAlwaysOn: boolean,
): string {
  if (criticalGateAlwaysOn && criticalIssues.length > 0) {
    return 'block';
  }

  const highIssues = issues.filter(i => i.severity === 'high').length;

  if (metrics.template_sentence_ratio >= BLOCK_TEMPLATE_RATIO) {
    return 'block';
  }
  if (qualityScore >= PASS_THRESHOLD && highIssues === 0) {
    return 'pass';
  }
  if (qualityScore < BLOCK_THRESHOLD || highIssues >= 2) {
    return 'block';
  }
  return 'revise';
}

// ============================================================
// Public API
// ============================================================

export interface NovelQualityResult {
  analysis_schema_version: string;
  quality_score: number;
  issues: Array<Record<string, string>>;
  metrics: Record<string, unknown>;
  publish_recommendation: string;
}

/**
 * Evaluate novel content quality using heuristic metrics.
 *
 * @param content - The novel text to evaluate
 * @param options - Optional configuration
 * @returns Quality evaluation result
 */
export function evaluateNovelQuality(
  content: string,
  options?: {
    qualityLevel?: string;
    qualityMode?: string;
    criticalGateAlwaysOn?: boolean;
    degradeReason?: string;
  },
): NovelQualityResult {
  const qualityLevel = options?.qualityLevel ?? 'high';
  const qualityMode = options?.qualityMode ?? 'auto';
  const criticalGateAlwaysOn = options?.criticalGateAlwaysOn ?? true;
  const degradeReason = options?.degradeReason ?? '';

  const text = (content ?? '').trim();
  const resolvedLevel = _normalizeQualityLevel(qualityLevel);
  const resolvedMode = _normalizeQualityMode(qualityMode);

  if (!text) {
    return _emptyResult(qualityLevel, qualityMode, degradeReason) as unknown as NovelQualityResult;
  }

  const metrics = _computeMetrics(text);
  const dimensionScores = _computeDimensionScores(text, metrics);
  const adjustedDimensionScores = _applyQualityLevelToScores(dimensionScores, resolvedLevel);

  const qualityScore = _clamp(
    Math.round(
      (
        adjustedDimensionScores['repetition'] * REPETITION_WEIGHT
        + adjustedDimensionScores['tone'] * TONE_WEIGHT
        + adjustedDimensionScores['clarity'] * CLARITY_WEIGHT
        + adjustedDimensionScores['causality'] * CAUSALITY_WEIGHT
        + adjustedDimensionScores['detail'] * DETAIL_WEIGHT
        + adjustedDimensionScores['factuality'] * FACTUALITY_WEIGHT
      ) * 10,
    ) / 10,
    0.0, 100.0,
  );

  const issues = _buildIssues(text, metrics, adjustedDimensionScores, qualityScore);
  const criticalIssues = _extractCriticalIssues(issues);
  const publishRecommendation = _recommendation(
    metrics, qualityScore, issues, criticalIssues, criticalGateAlwaysOn,
  );

  // Legacy decision mapping (result consumed by contract helpers)
  LEGACY_DECISION_MAP[publishRecommendation];

  const degraded = !!degradeReason;
  return {
    analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
    quality_score: qualityScore,
    issues,
    metrics: {
      dialogue_ratio: metrics.dialogue_ratio,
      conflict_points: metrics.conflict_points,
      visual_details: metrics.visual_details,
      template_sentence_ratio: metrics.template_sentence_ratio,
      dimension_scores: adjustedDimensionScores,
      quality_level_used: resolvedLevel,
      quality_mode_used: resolvedMode,
      critical_gate_applied: criticalGateAlwaysOn,
      critical_issue_count: criticalIssues.length,
      degraded,
      degrade_reason: degradeReason,
    },
    publish_recommendation: publishRecommendation,
  };
}
