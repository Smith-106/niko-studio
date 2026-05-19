import { CharacterDepthSystem } from '../narrative/character-depth.js';
import { DialogueAnalyzer } from '../narrative/dialogue-analyzer.js';
import { ReaderSatisfactionAnalyzer } from '../narrative/reader-satisfaction-analyzer.js';
import { analyzeReaderImmersion } from '../narrative/reader-immersion-engine.js';
import { SuspenseAnalyzer } from '../narrative/suspense-analyzer.js';
import {
  analyzeEmotionCraft,
  analyzeEmotionLayers,
  assessDescriptionQuality,
} from '../narrative/writing-craft/emotion-craft.js';
import {
  scoreCliffhanger,
  scoreHook,
} from '../narrative/writing-craft/hook-cliffhanger-scorer.js';
import { analyzeShowTell } from '../narrative/show-tell-analyzer.js';
import { assessOutlineQuality } from '../narrative/premise-validator.js';
import {
  getDialogueRules,
  getGenreBeats,
  getNarrativePrinciples,
  getNarrativeTechniques,
  getStoryStructures,
  getWebNovelPsychology,
} from '../narrative/writing-craft/catalog-loader.js';

export type RevisionDimension =
  | 'structure'
  | 'character'
  | 'suspense'
  | 'emotion'
  | 'dialogue'
  | 'webnovel'
  | 'hook'
  | 'cliffhanger'
  | 'show_tell';

export type RevisionSessionState =
  | 'IDLE'
  | 'ANALYZED'
  | 'SUGGESTED'
  | 'REVISED'
  | 'COMPARED';

export interface TextRange {
  start: number;
  end: number;
  excerpt: string;
}

export interface RevisionSessionAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

export interface RevisionDimensionReport {
  dimensionId: RevisionDimension;
  label: string;
  score: number;
  evidence: string[];
  suggestions: string[];
  readerImpact: string;
  catalogReference: string;
  details: Record<string, unknown>;
}

export interface WeakPoint {
  id: string;
  dimensionId: RevisionDimension;
  location: TextRange;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  readerImpact: string;
  baselineScore: number;
  evidence: string[];
  catalogReference: string;
}

export interface RevisionSuggestion {
  id: string;
  weakPointId: string;
  strategy: string;
  rationale: string;
  expectedOutcome: string;
  example?: string;
  catalogReference: string;
  sourceDimensionId: RevisionDimension;
  priority: 'high' | 'medium' | 'low';
}

export interface RevisionComparison {
  sessionId: string;
  iterationNumber: number;
  baselineScores: Partial<Record<RevisionDimension, number>>;
  resultScores: Partial<Record<RevisionDimension, number>>;
  delta: Partial<Record<RevisionDimension, number>>;
  improvedDimensions: RevisionDimension[];
  regressedDimensions: RevisionDimension[];
  unchangedDimensions: RevisionDimension[];
  summary: string;
}

export interface RevisionIteration {
  iterationNumber: number;
  analyzedAt: string;
  weakPoints: WeakPoint[];
  suggestions: RevisionSuggestion[];
  revisedText?: string;
  appliedAt?: string;
  resultScores?: Partial<Record<RevisionDimension, number>>;
  comparison?: RevisionComparison;
}

export interface RevisionSession {
  schemaVersion: string;
  id: string;
  chapterId: string;
  createdAt: string;
  updatedAt: string;
  state: RevisionSessionState;
  baselineText: string;
  currentText: string;
  baselineScores: Partial<Record<RevisionDimension, number>>;
  iterations: RevisionIteration[];
  lastComparison?: RevisionComparison;
  authority: RevisionSessionAuthority | null;
}

export interface RevisionAnalysisResult {
  reports: RevisionDimensionReport[];
  scores: Partial<Record<RevisionDimension, number>>;
}

const DEFAULT_REVISION_DIMENSIONS: RevisionDimension[] = [
  'structure',
  'character',
  'suspense',
  'emotion',
  'dialogue',
  'webnovel',
  'hook',
  'cliffhanger',
  'show_tell',
];

const DIMENSION_LABELS: Record<RevisionDimension, string> = {
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

const DIMENSION_READER_IMPACT: Record<RevisionDimension, string> = {
  structure: '结构节拍不稳会降低读者对推进感和因果清晰度的信任。',
  character: '角色塑造不足会削弱读者的情感投入和记忆点。',
  suspense: '悬念和叙事张力不足会直接削弱持续阅读欲望。',
  emotion: '情绪表达薄弱会降低读者共鸣和场景感染力。',
  dialogue: '对话缺少区分度或潜台词会让角色关系显得平淡。',
  webnovel: '网文节奏与满足机制不足会提升读者流失风险。',
  hook: '开头钩子不足会削弱读者继续读下去的驱动力。',
  cliffhanger: '结尾悬念不足会削弱章节后的继续阅读冲动。',
  show_tell: '展示不足会让关键情绪和动作显得概念化、缺少现场感。',
};

interface CatalogContext {
  reference: string;
  hints: string[];
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, roundScore(value)));
}

function sanitizeExcerpt(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveCatalogContext(dimension: RevisionDimension): CatalogContext {
  switch (dimension) {
    case 'structure': {
      const storyStructures = getStoryStructures();
      const structure = Object.values(storyStructures)[0];
      const beats = structure?.beats.slice(0, 3).map((beat) => `${beat.name}:${beat.description}`) ?? [];
      return {
        reference: 'catalog:genre-structures.storyStructures',
        hints: beats.length > 0 ? beats : ['补齐关键节拍并明确章节推进目标。'],
      };
    }
    case 'character': {
      const principles = Object.values(getNarrativePrinciples());
      const principleHints = principles
        .slice(0, 3)
        .map((item) => `${String(item.label ?? '角色原则')}: ${String(item.description ?? '')}`.trim());
      return {
        reference: 'catalog:writing-quality.narrativePrinciples',
        hints: principleHints.length > 0 ? principleHints : ['增强角色动机、冲突和可见选择。'],
      };
    }
    case 'suspense': {
      const techniques = Object.values(getNarrativeTechniques());
      const techniqueHints = techniques
        .slice(0, 3)
        .map((item) => `${String(item.label ?? '叙事技巧')}: ${String(item.description ?? '')}`.trim());
      return {
        reference: 'catalog:narrative-techniques.narrativeTechniques',
        hints: techniqueHints.length > 0 ? techniqueHints : ['增加悬念铺垫、信息延迟和转折释放。'],
      };
    }
    case 'emotion': {
      const principles = Object.values(getNarrativePrinciples());
      const principleHints = principles
        .slice(0, 2)
        .map((item) => `${String(item.label ?? '叙事原则')}: ${String(item.description ?? '')}`.trim());
      return {
        reference: 'catalog:writing-quality.narrativePrinciples',
        hints: principleHints.length > 0 ? principleHints : ['用动作、感官和具体反应承载情绪，而不是直接说明。'],
      };
    }
    case 'dialogue': {
      const dialogueRules = getDialogueRules();
      const hints = [
        ...dialogueRules.mckeeThreeFunctions.functions.slice(0, 2),
        ...dialogueRules.characterVoiceDifferentiation.dimensions.slice(0, 2),
      ];
      return {
        reference: 'catalog:genre-structures.dialogueRules',
        hints: hints.length > 0 ? hints : ['让对话同时承担推进、冲突和角色辨识功能。'],
      };
    }
    case 'webnovel': {
      const psychology = getWebNovelPsychology();
      const hints = [
        ...psychology.retentionRules.slice(0, 2),
        ...Object.values(psychology.chapterHooks).slice(0, 2),
      ];
      return {
        reference: 'catalog:web-novel-data.webNovelPsychology',
        hints: hints.length > 0 ? hints : ['增强期待-延迟-释放节奏和章节 hook。'],
      };
    }
    case 'hook': {
      const genreBeats = Object.values(getGenreBeats());
      const hints = genreBeats
        .slice(0, 1)
        .flatMap((item) => (item.beatSequence ?? []).slice(0, 2).map((beat) => `${beat.name}:${beat.description}`));
      return {
        reference: 'catalog:genre-structures.genreBeats',
        hints: hints.length > 0 ? hints : ['在前 200 字内给出冲突、未知或代价感。'],
      };
    }
    case 'cliffhanger': {
      const psychology = getWebNovelPsychology();
      return {
        reference: 'catalog:web-novel-data.webNovelPsychology.chapterHooks',
        hints: Object.values(psychology.chapterHooks).slice(0, 3),
      };
    }
    case 'show_tell': {
      const dialogueRules = getDialogueRules();
      return {
        reference: 'catalog:genre-structures.dialogueRules.showDontTell',
        hints: [
          ...dialogueRules.showDontTell.goodPatterns.slice(0, 2),
          ...dialogueRules.showDontTell.badPatterns.slice(0, 1).map((item) => `避免: ${item}`),
        ],
      };
    }
  }
}

function findLocation(text: string, fragments: string[]): TextRange {
  for (const fragment of fragments) {
    const needle = sanitizeExcerpt(fragment);
    if (!needle) continue;
    const directIndex = text.indexOf(needle);
    if (directIndex >= 0) {
      return {
        start: directIndex,
        end: Math.min(text.length, directIndex + needle.length),
        excerpt: text.slice(directIndex, Math.min(text.length, directIndex + Math.max(needle.length, 80))),
      };
    }

    const compactNeedle = needle.replace(/[：:，。,.;；]/g, '').trim();
    if (!compactNeedle) continue;
    const compactIndex = text.indexOf(compactNeedle);
    if (compactIndex >= 0) {
      return {
        start: compactIndex,
        end: Math.min(text.length, compactIndex + compactNeedle.length),
        excerpt: text.slice(compactIndex, Math.min(text.length, compactIndex + Math.max(compactNeedle.length, 80))),
      };
    }
  }

  return {
    start: 0,
    end: Math.min(text.length, 120),
    excerpt: text.slice(0, Math.min(text.length, 120)),
  };
}

function createReport(
  dimensionId: RevisionDimension,
  score: number,
  evidence: string[],
  suggestions: string[],
  details: Record<string, unknown>,
): RevisionDimensionReport {
  const catalog = resolveCatalogContext(dimensionId);
  return {
    dimensionId,
    label: DIMENSION_LABELS[dimensionId],
    score: clampScore(score),
    evidence: evidence.filter((item) => item && item.trim().length > 0).slice(0, 6),
    suggestions: suggestions.filter((item) => item && item.trim().length > 0).slice(0, 6),
    details,
    readerImpact: DIMENSION_READER_IMPACT[dimensionId],
    catalogReference: catalog.reference,
  };
}

function analyzeStructure(text: string): RevisionDimensionReport {
  const analyzer = new SuspenseAnalyzer();
  const positionedChapters = [{ content: text, position: 0.5 }];
  const chapters = [{ content: text, chapterIndex: 0 }];
  const edsonResult = analyzer.analyzeEdsonSequence(positionedChapters);
  const antiResult = analyzer.detectAntiPatterns(chapters);
  const threeAct = analyzer.analyzeThreeActStructure(positionedChapters);
  const outlineResult = assessOutlineQuality(text);
  const scores = [
    edsonResult.overallAlignmentScore * 10,
    threeAct.overallStructureScore,
    antiResult.overallHealthScore,
    outlineResult.overallQualityScore,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const score = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  return createReport(
    'structure',
    score,
    [
      ...edsonResult.missingBeats.slice(0, 3).map((beat) => `缺少段落: ${beat}`),
      ...threeAct.missingBeats.slice(0, 3).map((beat) => `缺少节拍: ${beat}`),
      ...antiResult.detections.filter((item) => item.detected).slice(0, 3).map((item) => item.label),
    ],
    [
      ...outlineResult.actionableSuggestions.slice(0, 3).map((item) => item.suggestion),
      ...resolveCatalogContext('structure').hints.slice(0, 2),
    ],
    {
      edsonAlignment: edsonResult.overallAlignmentScore,
      threeActScore: threeAct.overallStructureScore,
      antiPatternHealth: antiResult.overallHealthScore,
      outlineQualityScore: outlineResult.overallQualityScore,
    },
  );
}

function analyzeCharacter(text: string): RevisionDimensionReport {
  const system = new CharacterDepthSystem();
  const arcResult = system.assessCharacterCreation({}, text);
  const balanceResult = system.evaluatePlotCharacterBalance(
    text.split(/[。！？]/).filter((item) => item.length > 10),
    text.split(/[。！？]/).filter((item) => item.length > 10),
  );

  return createReport(
    'character',
    arcResult.overallScore,
    arcResult.dimensions.flatMap((item) => item.evidence).slice(0, 6),
    [
      ...arcResult.suggestions.slice(0, 3),
      ...resolveCatalogContext('character').hints.slice(0, 2),
    ],
    {
      plotCharacterBalance: balanceResult.balanceScore,
      dimensionScores: arcResult.dimensions.map((item) => ({
        dimension: item.dimension,
        score: item.score,
      })),
    },
  );
}

function analyzeSuspense(text: string): RevisionDimensionReport {
  const analyzer = new SuspenseAnalyzer();
  const chapters = [{ content: text, chapterIndex: 0 }];
  const techniqueResult = analyzer.detectNarrativeTechniques(chapters);
  const trickResult = analyzer.detectNarrativeTricks(chapters);
  const deductionResult = analyzer.analyzeDeductionChain(chapters);

  const scores = [
    techniqueResult.overallScore * 10,
    trickResult.overallTrickScore,
    deductionResult.chainScore,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const score = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  return createReport(
    'suspense',
    score,
    [
      ...techniqueResult.detections.filter((item) => item.detected).slice(0, 3).map((item) => item.label),
      ...trickResult.tricks.filter((item) => item.detected).slice(0, 3).map((item) => item.name),
    ],
    [
      ...techniqueResult.recommendations.slice(0, 3),
      ...deductionResult.suggestions.slice(0, 2),
      ...resolveCatalogContext('suspense').hints.slice(0, 2),
    ],
    {
      techniqueScore: techniqueResult.overallScore,
      trickScore: trickResult.overallTrickScore,
      deductionChainScore: deductionResult.chainScore,
    },
  );
}

function analyzeEmotion(text: string): RevisionDimensionReport {
  const craftResult = analyzeEmotionCraft(text);
  const layerResult = analyzeEmotionLayers(text);
  const descriptionResult = assessDescriptionQuality(text);
  const scores = [
    craftResult.score / 10,
    layerResult.layerDiversityScore,
    descriptionResult.overallScore,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const score = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  return createReport(
    'emotion',
    score,
    [
      ...craftResult.detections.slice(0, 3).map((item) => `${item.mode}: ${item.emotion}`),
      ...descriptionResult.dimensions.filter((item) => item.score > 0).slice(0, 3).map((item) => item.label),
    ],
    [
      ...craftResult.suggestions.slice(0, 3),
      ...descriptionResult.suggestions.slice(0, 2),
      ...resolveCatalogContext('emotion').hints.slice(0, 2),
    ],
    {
      showTellRatio: craftResult.showRatio,
      emotionScore: craftResult.score,
      layerRichness: layerResult.overallRichness,
      descriptionScore: descriptionResult.overallScore,
    },
  );
}

function analyzeDialogue(text: string): RevisionDimensionReport {
  const analyzer = new DialogueAnalyzer();
  const result = analyzer.analyzeDialogue(text);

  return createReport(
    'dialogue',
    result.overallScore,
    result.qualityScores.flatMap((item) => item.evidence).slice(0, 6),
    [
      ...result.suggestions.slice(0, 3),
      ...resolveCatalogContext('dialogue').hints.slice(0, 2),
    ],
    {
      subtextRatio: result.subtextRatio,
      voiceDistinctness: result.voiceDistinctness,
      dimensionScores: result.qualityScores.map((item) => ({
        dimension: item.dimension,
        score: item.score,
      })),
    },
  );
}

function analyzeWebNovel(text: string): RevisionDimensionReport {
  const analyzer = new ReaderSatisfactionAnalyzer();
  const chapters = [{ content: text, chapterIndex: 0 }];
  const upgradeResult = analyzer.detectUpgradePattern(chapters);
  const goldenFingerResult = analyzer.analyzeGoldenFinger(chapters);
  const curveResult = analyzer.analyzeWebNovelCurve(chapters);
  const immersionResult = analyzeReaderImmersion(chapters);
  const scores = [
    curveResult.curveData.length > 0
      ? curveResult.curveData.reduce((sum, item) => sum + item.hookStrength, 0) / curveResult.curveData.length / 10
      : 0,
    immersionResult.averageImmersion * 10,
    (1 - immersionResult.averageDropoutRisk) * 10,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const score = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  return createReport(
    'webnovel',
    score,
    [
      ...upgradeResult.slice(0, 2).map((item) => item.label),
      ...goldenFingerResult.slice(0, 2).map((item) => item.label),
      ...immersionResult.highRiskChapters.slice(0, 2).map((item) => `高流失风险章节: ${item}`),
    ],
    [
      ...curveResult.suggestions.slice(0, 3),
      ...immersionResult.suggestions.slice(0, 2),
      ...resolveCatalogContext('webnovel').hints.slice(0, 2),
    ],
    {
      averageImmersion: immersionResult.averageImmersion,
      averageDropoutRisk: immersionResult.averageDropoutRisk,
      trajectory: immersionResult.trajectory,
      highRiskChapters: immersionResult.highRiskChapters,
    },
  );
}

function analyzeHook(text: string): RevisionDimensionReport {
  const hookResult = scoreHook(text);
  return createReport(
    'hook',
    hookResult.overall / 10,
    hookResult.evidence.slice(0, 5),
    [
      ...(hookResult.overall < 30 ? ['开头钩子不足，建议在前 200 字内给出明确冲突、未知或代价感。'] : []),
      ...resolveCatalogContext('hook').hints.slice(0, 2),
    ],
    {
      hookScore: hookResult.overall,
      dimensions: hookResult.dimensions,
    },
  );
}

function analyzeCliffhanger(text: string): RevisionDimensionReport {
  const cliffResult = scoreCliffhanger(text);
  return createReport(
    'cliffhanger',
    cliffResult.overall / 10,
    cliffResult.evidence.slice(0, 5),
    [
      ...(cliffResult.overall < 30 ? ['结尾悬念不足，建议在末尾留下未解问题、威胁或情绪峰值。'] : []),
      ...resolveCatalogContext('cliffhanger').hints.slice(0, 2),
    ],
    {
      cliffhangerScore: cliffResult.overall,
      dimensions: cliffResult.dimensions,
    },
  );
}

function analyzeShowTellDimension(text: string): RevisionDimensionReport {
  const result = analyzeShowTell(text);
  return createReport(
    'show_tell',
    result.showTellRatio * 10,
    [
      `展示: ${result.showCount} 处`,
      `叙述: ${result.tellCount} 处`,
      `感官覆盖: ${Math.round(result.sensoryCoverage.overall * 100)}%`,
    ],
    [
      ...result.suggestions.slice(0, 3),
      ...resolveCatalogContext('show_tell').hints.slice(0, 2),
    ],
    {
      showTellRatio: result.showTellRatio,
      showCount: result.showCount,
      tellCount: result.tellCount,
      sensoryCoverage: result.sensoryCoverage,
    },
  );
}

function analyzeDimension(text: string, dimensionId: RevisionDimension): RevisionDimensionReport {
  switch (dimensionId) {
    case 'structure':
      return analyzeStructure(text);
    case 'character':
      return analyzeCharacter(text);
    case 'suspense':
      return analyzeSuspense(text);
    case 'emotion':
      return analyzeEmotion(text);
    case 'dialogue':
      return analyzeDialogue(text);
    case 'webnovel':
      return analyzeWebNovel(text);
    case 'hook':
      return analyzeHook(text);
    case 'cliffhanger':
      return analyzeCliffhanger(text);
    case 'show_tell':
      return analyzeShowTellDimension(text);
  }
}

function resolveWeakPointSeverity(score: number): WeakPoint['severity'] {
  if (score < 4) return 'critical';
  if (score < 6) return 'major';
  return 'minor';
}

export function analyzeRevisionText(
  text: string,
  dimensions: RevisionDimension[] = DEFAULT_REVISION_DIMENSIONS,
): RevisionAnalysisResult {
  const reports = dimensions.map((dimensionId) => analyzeDimension(text, dimensionId));
  const scores = reports.reduce<Partial<Record<RevisionDimension, number>>>((acc, report) => {
    acc[report.dimensionId] = report.score;
    return acc;
  }, {});
  return { reports, scores };
}

export function deriveWeakPoints(
  text: string,
  analysis: RevisionAnalysisResult,
  threshold = 7,
): WeakPoint[] {
  return analysis.reports
    .filter((report) => report.score < threshold)
    .map((report, index) => {
      const location = findLocation(text, [...report.evidence, ...report.suggestions]);
      const description =
        report.suggestions[0]
        ?? report.evidence[0]
        ?? `${report.label} 得分偏低，需要优先修订。`;
      return {
        id: `weak-point-${index + 1}-${report.dimensionId}`,
        dimensionId: report.dimensionId,
        location: {
          ...location,
          excerpt: sanitizeExcerpt(location.excerpt),
        },
        severity: resolveWeakPointSeverity(report.score),
        description,
        readerImpact: report.readerImpact,
        baselineScore: report.score,
        evidence: report.evidence.slice(0, 4),
        catalogReference: report.catalogReference,
      };
    });
}

export function generateRevisionSuggestions(
  weakPoints: WeakPoint[],
  analysis: RevisionAnalysisResult,
): RevisionSuggestion[] {
  const reportMap = new Map<RevisionDimension, RevisionDimensionReport>(
    analysis.reports.map((report) => [report.dimensionId, report]),
  );

  return weakPoints.map((weakPoint, index) => {
    const report = reportMap.get(weakPoint.dimensionId);
    const catalog = resolveCatalogContext(weakPoint.dimensionId);
    const strategy = report?.suggestions[0]
      ?? catalog.hints[0]
      ?? `${report?.label ?? weakPoint.dimensionId} 需要更明确的修订策略。`;
    const example = catalog.hints[1];
    return {
      id: `revision-suggestion-${index + 1}-${weakPoint.dimensionId}`,
      weakPointId: weakPoint.id,
      strategy,
      rationale: weakPoint.readerImpact,
      expectedOutcome: `${DIMENSION_LABELS[weakPoint.dimensionId]} 分值提升，并减少对应的读者体验损耗。`,
      example,
      catalogReference: weakPoint.catalogReference || catalog.reference,
      sourceDimensionId: weakPoint.dimensionId,
      priority: weakPoint.severity === 'critical' ? 'high' : weakPoint.severity === 'major' ? 'medium' : 'low',
    };
  });
}

export function compareRevisionAnalyses(params: {
  sessionId: string;
  iterationNumber: number;
  baseline: RevisionAnalysisResult;
  revised: RevisionAnalysisResult;
}): RevisionComparison {
  const delta: Partial<Record<RevisionDimension, number>> = {};
  const improvedDimensions: RevisionDimension[] = [];
  const regressedDimensions: RevisionDimension[] = [];
  const unchangedDimensions: RevisionDimension[] = [];

  for (const dimension of DEFAULT_REVISION_DIMENSIONS) {
    const before = params.baseline.scores[dimension];
    const after = params.revised.scores[dimension];
    if (typeof before !== 'number' || typeof after !== 'number') continue;
    const diff = roundScore(after - before);
    delta[dimension] = diff;
    if (diff > 0.2) {
      improvedDimensions.push(dimension);
    } else if (diff < -0.2) {
      regressedDimensions.push(dimension);
    } else {
      unchangedDimensions.push(dimension);
    }
  }

  const summaryParts: string[] = [];
  if (improvedDimensions.length > 0) {
    summaryParts.push(`改善维度：${improvedDimensions.join('、')}`);
  }
  if (regressedDimensions.length > 0) {
    summaryParts.push(`回退维度：${regressedDimensions.join('、')}`);
  }
  if (summaryParts.length === 0) {
    summaryParts.push('修订前后整体评分变化不大，建议继续针对 weak points 迭代。');
  }

  return {
    sessionId: params.sessionId,
    iterationNumber: params.iterationNumber,
    baselineScores: params.baseline.scores,
    resultScores: params.revised.scores,
    delta,
    improvedDimensions,
    regressedDimensions,
    unchangedDimensions,
    summary: summaryParts.join('；'),
  };
}
