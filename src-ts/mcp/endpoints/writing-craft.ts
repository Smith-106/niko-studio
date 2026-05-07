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
  | 'webnovel';

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
    return jsonResponse({ success: false, error: 'text is required' }, 400);
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
    success: true,
    data: {
      overallScore,
      dimensions: results,
      textLength: text.length,
    },
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
  if (edsonResult.overallAlignmentScore > 0) scores.push(edsonResult.overallAlignmentScore);
  if (threeAct.overallStructureScore > 0) scores.push(threeAct.overallStructureScore);
  scores.push(antiResult.overallHealthScore);

  const score = scores.length > 0
    ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
    : 0;

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

  const scores: number[] = [techniqueResult.overallScore, trickResult.overallTrickScore];
  if (deductionResult.chainScore > 0) scores.push(deductionResult.chainScore);

  const score = scores.length > 0
    ? Math.min(10, Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10)
    : 0;

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

  const scores: number[] = [craftResult.score, layerResult.layerDiversityScore, descriptionResult.overallScore];
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
    scores.push(avgHook);
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
