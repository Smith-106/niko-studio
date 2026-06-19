/**
 * Writing Craft Analysis Endpoints
 *
 * Bridges M13-M16 writing knowledge engine to HTTP API.
 * Provides multi-dimensional writing quality analysis.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { SuspenseAnalyzer } from '../../narrative/suspense-analyzer';
import { CharacterDepthSystem } from '../../narrative/character-depth';
import { ReaderSatisfactionAnalyzer } from '../../narrative/reader-satisfaction-analyzer';
import { DialogueAnalyzer } from '../../narrative/dialogue-analyzer';
import { analyzeEmotionCraft, analyzeEmotionLayers, assessDescriptionQuality } from '../../narrative/writing-craft/emotion-craft';
import { analyzeHookCliffhanger, scoreHook, scoreCliffhanger } from '../../narrative/writing-craft/hook-cliffhanger-scorer';
import { extractVoiceFingerprints, checkVoiceConsistency } from '../../narrative/character-voice-fingerprint';
import { analyzeShowTell } from '../../narrative/show-tell-analyzer';
import { analyzeEmotionalArc } from '../../narrative/emotional-arc';
import { analyzeReaderImmersion } from '../../narrative/reader-immersion-engine';
import { navigatePacing } from '../../narrative/pacing-navigator';
import { assessOutlineQuality } from '../../narrative/premise-validator';
import { SceneCoherenceDetector } from '../../narrative/scene-coherence';

// ============================================================
// Types
// ============================================================

export type WritingCraftDimension =
  | 'structure'
  | 'character'
  | 'suspense'
  | 'emotion'
  | 'dialogue'
  | 'webnovel'
  | 'hook'
  | 'cliffhanger'
  | 'show_tell';

export interface DimensionResult {
  dimension: WritingCraftDimension;
  label: string;
  score: number;
  maxScore: number;
  evidence: string[];
  suggestions: string[];
  details: Record<string, unknown>;
}

const DIMENSION_LABELS: Record<WritingCraftDimension, string> = {
  structure: '结构分析',
  character: '角色分析',
  suspense: '悬疑/叙事',
  emotion: '情感/描写',
  dialogue: '对话分析',
  webnovel: '网文专项',
  hook: '钩子分析',
  cliffhanger: '悬念分析',
  show_tell: '展示/叙述',
};

// ============================================================
// Endpoint
// ============================================================

export async function writingCraftAnalyzeEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as {
    text?: string;
    dimensions?: WritingCraftDimension[];
  };

  const text = body.text ?? '';
  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  const requestedDimensions = body.dimensions ?? [
    'structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel',
  ];

  const results: DimensionResult[] = [];

  const chapters = [{ content: text, chapterIndex: 0 }];
  const positionedChapters = [{ content: text, position: 0.5 }];

  for (const dim of requestedDimensions) {
    const result = analyzeDimension(dim, text, chapters, positionedChapters);
    results.push(result);
  }

  const overallScore = results.length > 0
    ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
    : 0;

  return jsonResponse({
    overallScore,
    dimensions: results,
    textLength: text.length,
  });
}

// ============================================================
// Dimension Analyzers
// ============================================================

function analyzeDimension(
  dim: WritingCraftDimension,
  text: string,
  chapters: Array<{ content: string; chapterIndex: number }>,
  positionedChapters: Array<{ content: string; position: number }>,
): DimensionResult {
  switch (dim) {
    case 'structure':
      return analyzeStructure(text, positionedChapters);
    case 'character':
      return analyzeCharacter(text);
    case 'suspense':
      return analyzeSuspense(text, chapters);
    case 'emotion':
      return analyzeEmotion(text);
    case 'dialogue':
      return analyzeDialogue(text);
    case 'webnovel':
      return analyzeWebNovel(text, chapters);
    case 'hook':
      return analyzeHookDimension(text);
    case 'cliffhanger':
      return analyzeCliffhangerDimension(text);
    case 'show_tell':
      return analyzeShowTellDimension(text);
    default:
      return emptyResult(dim);
  }
}

function analyzeStructure(
  text: string,
  positionedChapters: Array<{ content: string; position: number }>,
): DimensionResult {
  const analyzer = new SuspenseAnalyzer();
  const edsonResult = analyzer.analyzeEdsonSequence(positionedChapters);
  const antiResult = analyzer.detectAntiPatterns([{ content: text, chapterIndex: 0 }]);
  const threeAct = analyzer.analyzeThreeActStructure(positionedChapters);

  const scores: number[] = [];
  if (edsonResult.overallAlignmentScore > 0) scores.push(edsonResult.overallAlignmentScore * 10);
  if (threeAct.overallStructureScore > 0) scores.push(threeAct.overallStructureScore);
  scores.push(antiResult.overallHealthScore);

  const score = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;

  const evidence: string[] = [
    ...edsonResult.missingBeats.slice(0, 3).map((b) => `缺少段落: ${b}`),
    ...antiResult.detections.filter((d) => d.detected).map((d) => d.label),
    ...threeAct.missingBeats.map((b) => `缺少节拍: ${b}`),
  ];

  const suggestions: string[] = [
    ...edsonResult.suggestions,
    ...antiResult.suggestions.slice(0, 3),
    ...threeAct.suggestions,
  ];

  return {
    dimension: 'structure',
    label: DIMENSION_LABELS.structure,
    score,
    maxScore: 10,
    evidence,
    suggestions,
    details: {
      edsonAlignment: edsonResult.overallAlignmentScore,
      threeActScore: threeAct.overallStructureScore,
      antiPatternHealth: antiResult.overallHealthScore,
      criticalAntiPatterns: antiResult.criticalCount,
    },
  };
}

function analyzeCharacter(text: string): DimensionResult {
  const system = new CharacterDepthSystem();
  const arcResult = system.assessCharacterCreation({}, text);
  const balanceResult = system.evaluatePlotCharacterBalance(
    text.split(/[。！？]/).filter((s) => s.length > 10),
    text.split(/[。！？]/).filter((s) => s.length > 10),
  );

  return {
    dimension: 'character',
    label: DIMENSION_LABELS.character,
    score: arcResult.overallScore,
    maxScore: 10,
    evidence: arcResult.dimensions.flatMap((d) => d.evidence),
    suggestions: arcResult.suggestions,
    details: {
      creationDimensions: arcResult.dimensions.map((d) => ({
        dimension: d.dimension,
        label: d.label,
        score: d.score,
      })),
      plotCharacterBalance: balanceResult.balanceScore,
    },
  };
}

function analyzeSuspense(
  text: string,
  chapters: Array<{ content: string; chapterIndex: number }>,
): DimensionResult {
  const analyzer = new SuspenseAnalyzer();
  const techniqueResult = analyzer.detectNarrativeTechniques(chapters);
  const trickResult = analyzer.detectNarrativeTricks(chapters);
  const mysteryResult = analyzer.detectMysterySubtype(chapters);
  const deductionResult = analyzer.analyzeDeductionChain(chapters);

  const scores: number[] = [techniqueResult.overallScore * 10, trickResult.overallTrickScore];
  if (deductionResult.chainScore > 0) scores.push(deductionResult.chainScore);

  const score = Math.min(10, Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10);

  const detectedTechniques = techniqueResult.detections.filter((d) => d.detected);
  const detectedTricks = trickResult.tricks.filter((t) => t.detected);

  return {
    dimension: 'suspense',
    label: DIMENSION_LABELS.suspense,
    score,
    maxScore: 10,
    evidence: [
      ...detectedTechniques.map((d) => d.label),
      ...detectedTricks.map((t) => t.name),
      ...mysteryResult.slice(0, 2).map((m) => m.label),
    ],
    suggestions: [
      ...techniqueResult.recommendations.slice(0, 3),
      ...trickResult.suggestions.slice(0, 3),
      ...deductionResult.suggestions,
    ],
    details: {
      techniqueScore: techniqueResult.overallScore,
      techniqueDensity: techniqueResult.techniqueDensity,
      trickScore: trickResult.overallTrickScore,
      mysterySubtypes: mysteryResult.map((m) => ({ label: m.label, confidence: m.confidence })),
      deductionChainScore: deductionResult.chainScore,
    },
  };
}

function analyzeEmotion(text: string): DimensionResult {
  const craftResult = analyzeEmotionCraft(text);
  const layerResult = analyzeEmotionLayers(text);
  const descriptionResult = assessDescriptionQuality(text);

  const scores: number[] = [craftResult.score / 10, layerResult.layerDiversityScore, descriptionResult.overallScore];
  const score = Math.min(10, Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10);

  return {
    dimension: 'emotion',
    label: DIMENSION_LABELS.emotion,
    score,
    maxScore: 10,
    evidence: [
      ...craftResult.detections.slice(0, 5).map((d) => `${d.mode}: ${d.emotion}`),
      ...layerResult.detections.filter((d) => d.hitCount > 0).map((d) => d.label),
      ...descriptionResult.dimensions.filter((d) => d.score > 0).map((d) => d.label),
    ],
    suggestions: [
      ...craftResult.suggestions.slice(0, 3),
      ...layerResult.suggestions.slice(0, 3),
      ...descriptionResult.suggestions.slice(0, 3),
    ],
    details: {
      showTellRatio: craftResult.showRatio,
      emotionScore: craftResult.score,
      layerRichness: layerResult.overallRichness,
      layerDepth: layerResult.depthLevel,
      descriptionScore: descriptionResult.overallScore,
    },
  };
}

function analyzeDialogue(text: string): DimensionResult {
  const analyzer = new DialogueAnalyzer();
  const result = analyzer.analyzeDialogue(text);

  return {
    dimension: 'dialogue',
    label: DIMENSION_LABELS.dialogue,
    score: result.overallScore,
    maxScore: 10,
    evidence: result.qualityScores.flatMap((s) => s.evidence),
    suggestions: result.suggestions,
    details: {
      overallScore: result.overallScore,
      subtextRatio: result.subtextRatio,
      voiceDistinctness: result.voiceDistinctness,
      dimensionScores: result.qualityScores.map((s) => ({
        dimension: s.dimension,
        label: s.label,
        score: s.score,
      })),
    },
  };
}

function analyzeWebNovel(
  text: string,
  chapters: Array<{ content: string; chapterIndex: number }>,
): DimensionResult {
  const analyzer = new ReaderSatisfactionAnalyzer();
  const upgradeResult = analyzer.detectUpgradePattern(chapters);
  const goldenFingerResult = analyzer.analyzeGoldenFinger(chapters);
  const curveResult = analyzer.analyzeWebNovelCurve(chapters);
  const outlineResult = assessOutlineQuality(text);

  const scores: number[] = [];
  if (outlineResult.overallQualityScore > 0) scores.push(outlineResult.overallQualityScore);
  if (curveResult.curveData.length > 0) {
    const avgHook = curveResult.curveData.reduce((s, c) => s + c.hookStrength, 0) / curveResult.curveData.length;
    scores.push(avgHook / 10);
  }
  const score = scores.length > 0
    ? Math.min(10, Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10)
    : 0;

  return {
    dimension: 'webnovel',
    label: DIMENSION_LABELS.webnovel,
    score,
    maxScore: 10,
    evidence: [
      ...upgradeResult.slice(0, 2).map((u) => u.label),
      ...goldenFingerResult.slice(0, 2).map((g) => g.label),
    ],
    suggestions: [
      ...curveResult.suggestions,
      ...outlineResult.actionableSuggestions.slice(0, 3).map((s) => s.suggestion),
    ],
    details: {
      upgradeSystems: upgradeResult.map((u) => ({ label: u.label, confidence: u.confidence })),
      goldenFingers: goldenFingerResult.map((g) => ({ label: g.label, confidence: g.confidence })),
      outlineQualityScore: outlineResult.overallQualityScore,
      outlineQualityLevel: outlineResult.qualityLevel,
    },
  };
}

function analyzeHookDimension(text: string): DimensionResult {
  const hookResult = scoreHook(text);
  const voiceResult = extractVoiceFingerprints(text);

  const score = Math.min(10, Math.round(hookResult.overall / 10 * 10) / 10);

  return {
    dimension: 'hook',
    label: DIMENSION_LABELS.hook,
    score,
    maxScore: 10,
    evidence: hookResult.evidence,
    suggestions: [
      ...(hookResult.overall < 30 ? ['开头钩子强度不足，建议在前 200 字内加入冲突或悬念'] : []),
      ...voiceResult.suggestions.slice(0, 2),
    ],
    details: {
      hookScore: hookResult.overall,
      dimensions: hookResult.dimensions,
      voiceFingerprintCount: voiceResult.fingerprints.length,
    },
  };
}

function analyzeCliffhangerDimension(text: string): DimensionResult {
  const cliffResult = scoreCliffhanger(text);
  const hcResult = analyzeHookCliffhanger([{ content: text, chapterIndex: 0 }]);

  const score = Math.min(10, Math.round(cliffResult.overall / 10 * 10) / 10);

  return {
    dimension: 'cliffhanger',
    label: DIMENSION_LABELS.cliffhanger,
    score,
    maxScore: 10,
    evidence: cliffResult.evidence,
    suggestions: [
      ...(cliffResult.overall < 30 ? ['结尾悬念不足，建议在末尾 200 字留下未解问题或情感高峰'] : []),
      ...hcResult.suggestions.slice(0, 2),
    ],
    details: {
      cliffhangerScore: cliffResult.overall,
      dimensions: cliffResult.dimensions,
    },
  };
}

function emptyResult(dim: WritingCraftDimension): DimensionResult {
  return {
    dimension: dim,
    label: DIMENSION_LABELS[dim] ?? dim,
    score: 0,
    maxScore: 10,
    evidence: [],
    suggestions: [],
    details: {},
  };
}

function analyzeShowTellDimension(text: string): DimensionResult {
  const result = analyzeShowTell(text);
  const score = Math.min(10, Math.round(result.showTellRatio * 10 * 10) / 10);

  return {
    dimension: 'show_tell',
    label: DIMENSION_LABELS.show_tell,
    score,
    maxScore: 10,
    evidence: [
      `展示: ${result.showCount} 处`,
      `叙述: ${result.tellCount} 处`,
      `感官覆盖: ${Math.round(result.sensoryCoverage.overall * 100)}%`,
    ],
    suggestions: result.suggestions.slice(0, 3),
    details: {
      showTellRatio: result.showTellRatio,
      showCount: result.showCount,
      tellCount: result.tellCount,
      sensoryCoverage: result.sensoryCoverage,
      abstractVsConcrete: result.abstractVsConcrete,
      heatMap: result.heatMap,
    },
  };
}

// ============================================================
// Dedicated Endpoints (multi-chapter analysis)
// ============================================================

export async function writingCraftEmotionalArcEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as {
    chapters?: Array<{ content: string; chapterIndex: number }>;
  };

  const chapters = body.chapters ?? [];
  if (chapters.length === 0) {
    return jsonResponse({ error: 'chapters are required' }, 400);
  }

  const result = analyzeEmotionalArc(chapters);
  return jsonResponse(result);
}

export async function writingCraftVoiceConsistencyEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as { text?: string };
  const text = body.text ?? '';
  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  const fpResult = extractVoiceFingerprints(text);
  const warnings: Array<{ character: string; line: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];
  for (const fp of fpResult.fingerprints) {
    for (const sample of fp.sampleDialogues) {
      const warning = checkVoiceConsistency(fp, sample);
      if (warning) warnings.push(warning);
    }
  }

  return jsonResponse({
    fingerprints: fpResult.fingerprints,
    voiceDistinctness: fpResult.voiceDistinctness,
    warnings,
    suggestions: fpResult.suggestions,
  });
}

export async function writingCraftReaderImmersionEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as {
    chapters?: Array<{ content: string; chapterIndex: number }>;
  };

  const chapters = body.chapters ?? [];
  if (chapters.length === 0) {
    return jsonResponse({ error: 'chapters are required' }, 400);
  }

  const result = analyzeReaderImmersion(chapters);
  return jsonResponse(result);
}

export async function writingCraftPacingNavigatorEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as {
    chapters?: Array<{ content: string; chapterIndex: number }>;
  };

  const chapters = body.chapters ?? [];
  if (chapters.length === 0) {
    return jsonResponse({ error: 'chapters are required' }, 400);
  }

  const result = navigatePacing(chapters);
  return jsonResponse(result);
}
