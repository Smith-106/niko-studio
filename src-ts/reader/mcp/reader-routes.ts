/**
 * Reader Simulation MCP Routes
 *
 * 8 endpoint handlers for Reader Simulation Engine (SME-02).
 *
 * Related: T-036, SME-02
 */

import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import { jsonResponse, parseBody } from '../../mcp/http-types';
import type { ReaderPersona } from '../PersonaDefinition';
import {
  createCustomPersona,
  listPresetPersonas,
  getPresetPersona,
} from '../PersonaDefinition';
import type { DimensionScore } from '../DimensionAnalyzer';
import { detectAIFlavor } from '../ai-flavor-detector';
import type { AIFlavorResult } from '../ai-flavor-detector';
import { createLogger } from '../../logger';
import {
  validateStringLength,
  MAX_NOVEL_ID_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PERSONA_ID_LENGTH,
  MAX_FEEDBACK_ID_LENGTH,
  MAX_DIMENSION_LENGTH,
  MAX_TARGET_STYLE_LENGTH,
  MAX_LABEL_LENGTH,
  validateWeight,
  validateStringArray,
} from '../../mcp/input-validation.js';
import type {
  AnalyzeRequest,
  CreatePersonaRequest,
  DeAIRequest,
  DeAIResponse,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackAggregate,
  CompareRequest,
  CompareResult,
  CompareVersionInput,
  OverlayMarker,
  FeedbackAction,
} from './reader-types';
import {
  getRevisionService,
  getConsensusEngine,
  getDualEngine,
  getDimensionAnalyzer,
  customPersonaStore,
  analysisResultCache,
  feedbackAggregateStore,
  FEEDBACK_THRESHOLD,
  saveCustomPersonas,
} from './reader-services';
import {
  resolvePersonas,
  buildOverlayMarkers,
  adjustPersonaWeights,
} from './reader-validation';

const _log = createLogger('reader-routes');

// ============================================================
// Endpoints
// ============================================================

/**
 * POST /reader/analyze — run reader simulation with specified personas
 *
 * Runs the Dual Engine (Reader + Editor) with the given personas
 * and returns dimension scores, reader reactions, and editorial analysis.
 */
export async function rsAnalyzeEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const personaIds = body.personaIds as string[] | undefined;

  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }

  const novelIdLengthError = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdLengthError) return novelIdLengthError;

  // Validate persona IDs if provided
  if (personaIds !== undefined) {
    if (!Array.isArray(personaIds)) {
      return jsonResponse({ error: 'personaIds must be an array of strings' }, 400);
    }
    for (const id of personaIds) {
      if (typeof id !== 'string') {
        return jsonResponse({ error: 'Each personaId must be a string' }, 400);
      }
      const idLengthError = validateStringLength(id, MAX_PERSONA_ID_LENGTH, 'personaId');
      if (idLengthError) return idLengthError;
    }
  }

  _log.info('Reader simulation analysis requested', { novelId, personaIds: personaIds ?? 'all' });

  try {
    const personas = resolvePersonas(personaIds);

    // Use provided text for analysis, otherwise fall back to empty placeholder
    // (production callers will fetch manuscript text from persistent storage).
    const manuscriptText = (body.text as string | undefined) ?? '';

    // Length guard for text field
    if (manuscriptText) {
      const textError = validateStringLength(manuscriptText, MAX_TEXT_LENGTH, 'text');
      if (textError) return textError;
    }

    // Handle empty text gracefully — return empty consensus report
    if (!manuscriptText || manuscriptText.trim().length === 0) {
      const emptyDimensionScores = personas.map((persona) => ({
        personaId: persona.id,
        personaName: persona.name,
        scores: [
          { dimension: 'plotCoherence', score: 0, weight: persona.parameters.plotWeight },
          { dimension: 'characterConsistency', score: 0, weight: persona.parameters.characterWeight },
          { dimension: 'styleConsistency', score: 0, weight: persona.parameters.styleWeight },
          { dimension: 'pacingTension', score: 0, weight: persona.parameters.pacingWeight },
        ],
      }));

      const emptyResult = {
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '',
          recommendations: [],
        },
        timestamp: new Date().toISOString(),
      };

      // Cache result for overlay endpoint
      analysisResultCache.set(novelId, emptyResult);

      _log.info('Reader simulation analysis complete (empty text)', {
        novelId,
        personaCount: personas.length,
        reactionCount: 0,
      });

      return jsonResponse({
        novelId,
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: emptyDimensionScores,
        timestamp: emptyResult.timestamp,
      });
    }

    const result = await getDualEngine().analyze(
      manuscriptText,
      personas,
    );

    // Build consensus report from reader reactions
    const consensusReport = getConsensusEngine().buildConsensus(result.readerReactions);

    // Run dimension analysis for each persona
    const dimensionScores: Array<{
      personaId: string;
      personaName: string;
      scores: DimensionScore[];
    }> = [];

    const analyzer = getDimensionAnalyzer();
    for (const persona of personas) {
      const scores = analyzer.analyzeAllDimensions(manuscriptText, persona);
      dimensionScores.push({
        personaId: persona.id,
        personaName: persona.name,
        scores,
      });
    }

    // Cache result for overlay endpoint
    analysisResultCache.set(novelId, result);

    _log.info('Reader simulation analysis complete', {
      novelId,
      personaCount: personas.length,
      reactionCount: result.readerReactions.length,
    });

    return jsonResponse({
      novelId,
      readerReactions: result.readerReactions,
      editorialAnalysis: result.editorialAnalysis,
      consensus: consensusReport,
      dimensionScores,
      timestamp: result.timestamp,
    });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Reader simulation analysis failed', { error: message, novelId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * GET /reader/personas — return available preset personas
 *
 * Returns all preset persona definitions with their parameters.
 */
export async function rsGetPersonasEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  const presetIds = listPresetPersonas();
  const presets = presetIds.map((id) => getPresetPersona(id));

  // Also include custom personas
  const customs = Array.from(customPersonaStore.values());

  return jsonResponse({
    presets,
    custom: customs,
    totalPresetCount: presets.length,
    totalCustomCount: customs.length,
  });
}

/**
 * POST /reader/personas/custom — create custom persona
 *
 * Creates a new custom reader persona with user-defined parameters.
 */
export async function rsCreateCustomPersonaEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const name = body.name as string | undefined;
  const parameters = body.parameters as Record<string, any> | undefined;

  if (!name || typeof name !== 'string') {
    return jsonResponse({ error: 'name is required and must be a string' }, 400);
  }

  const nameLengthError = validateStringLength(name, MAX_NAME_LENGTH, 'name');
  if (nameLengthError) return nameLengthError;

  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return jsonResponse({ error: 'parameters is required and must be an object' }, 400);
  }

  // Validate that required numeric parameters are present and valid
  const numericFields = ['plotWeight', 'characterWeight', 'styleWeight', 'pacingWeight', 'toleranceThreshold'];
  for (const field of numericFields) {
    const value = parameters[field];
    if (value !== undefined && typeof value !== 'number') {
      return jsonResponse({ error: `parameters.${field} must be a number` }, 400);
    }
    if (value !== undefined) {
      const weightErr = validateWeight(value, 0, 1, `parameters.${field}`);
      if (weightErr) return weightErr;
    }
  }

  // Validate array fields
  const arrayFields = ['focusAreas', 'biases'];
  for (const field of arrayFields) {
    const value = parameters[field];
    if (value !== undefined) {
      const arrayError = validateStringArray(value, { label: `parameters.${field}` });
      if (arrayError) return arrayError;
    }
  }

  try {
    const persona = createCustomPersona({
      name,
      parameters: {
        plotWeight: parameters.plotWeight ?? 0.5,
        characterWeight: parameters.characterWeight ?? 0.5,
        styleWeight: parameters.styleWeight ?? 0.5,
        pacingWeight: parameters.pacingWeight ?? 0.5,
        toleranceThreshold: parameters.toleranceThreshold ?? 0.5,
        focusAreas: Array.isArray(parameters.focusAreas) ? parameters.focusAreas : [],
        biases: Array.isArray(parameters.biases) ? parameters.biases : [],
      },
    });

    customPersonaStore.set(persona.id, persona);

    // Persist to file
    await saveCustomPersonas(customPersonaStore);

    _log.info('Created custom reader persona', { personaId: persona.id, name });

    return jsonResponse({ persona }, 201);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Failed to create custom persona', { error: message, name });
    return jsonResponse({ error: message }, 400);
  }
}

/**
 * POST /reader/overlay — get overlay markers for visualization
 *
 * Returns overlay markers derived from the most recent analysis result
 * for the given novel. If no analysis has been run, returns empty markers.
 */
export async function rsGetOverlayEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;

  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }

  const novelIdLengthError = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdLengthError) return novelIdLengthError;

  const cachedResult = analysisResultCache.get(novelId);

  if (!cachedResult) {
    return jsonResponse({
      novelId,
      markers: [],
      markerCount: 0,
      message: 'No analysis result found. Run /reader/analyze first.',
    });
  }

  const markers = buildOverlayMarkers(cachedResult.readerReactions);

  _log.info('Overlay markers retrieved', { novelId, markerCount: markers.length });

  return jsonResponse({
    novelId,
    markers,
    markerCount: markers.length,
    analysisTimestamp: cachedResult.timestamp,
  });
}

/**
 * POST /reader/ai-flavor — detect AI-generated prose patterns in text
 *
 * Runs rule-based AI flavor detection on provided text.
 * Returns score, indicators, confidence, evidence, and suggestions.
 */
export async function rsAIFlavorEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const text = body.text as string | undefined;

  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }

  const novelIdLengthError = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdLengthError) return novelIdLengthError;

  // Length guard for text field
  if (text !== undefined && typeof text === 'string') {
    const textError = validateStringLength(text, MAX_TEXT_LENGTH, 'text');
    if (textError) return textError;
  }

  // Use provided text or fall back to empty string
  const analysisText = text ?? '';

  _log.info('AI flavor detection requested', { novelId, textLength: analysisText.length });

  try {
    const result: AIFlavorResult = detectAIFlavor(analysisText);

    _log.info('AI flavor detection complete', {
      novelId,
      aiFlavorScore: result.aiFlavorScore,
      indicatorCount: result.indicators.length,
      confidence: result.confidence,
    });

    return jsonResponse({
      novelId,
      score: result.aiFlavorScore,
      indicators: result.indicators,
      confidence: result.confidence,
      evidence: result.evidence,
      suggestions: result.suggestions,
    });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('AI flavor detection failed', { error: message, novelId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /reader/feedback — submit feedback on a reader simulation result
 *
 * Accepts user feedback on a specific analysis result (helpful / not_helpful / ignore).
 * Aggregates feedback per persona per dimension, and when the threshold is reached,
 * adjusts the persona's dimension weights accordingly.
 *
 * Request: { novelId, personaId, feedbackId, action: 'helpful'|'not_helpful'|'ignore', dimension? }
 * Response: { novelId, personaId, feedbackId, action, dimension?, updatedWeights?, weightsChanged }
 */
export async function rsFeedbackEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const personaId = body.personaId as string | undefined;
  const feedbackId = body.feedbackId as string | undefined;
  const action = body.action as FeedbackAction | undefined;
  const dimension = body.dimension as string | undefined;

  // Validate required fields
  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }
  if (!personaId || typeof personaId !== 'string') {
    return jsonResponse({ error: 'personaId is required and must be a string' }, 400);
  }
  if (!feedbackId || typeof feedbackId !== 'string') {
    return jsonResponse({ error: 'feedbackId is required and must be a string' }, 400);
  }
  if (!action || !['helpful', 'not_helpful', 'ignore'].includes(action)) {
    return jsonResponse({ error: "action must be 'helpful', 'not_helpful', or 'ignore'" }, 400);
  }

  const novelIdLengthError = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdLengthError) return novelIdLengthError;

  const feedbackIdLengthError = validateStringLength(feedbackId, MAX_FEEDBACK_ID_LENGTH, 'feedbackId');
  if (feedbackIdLengthError) return feedbackIdLengthError;

  _log.info('Reader feedback received', { novelId, personaId, feedbackId, action, dimension });

  try {
    // Resolve the persona (preset or custom)
    let persona: ReaderPersona;
    try {
      persona = resolvePersonas([personaId])[0]!;
    } catch {
      return jsonResponse({ error: `Persona not found: ${personaId}` }, 400);
    }

    // Determine effective dimension (fallback to 'general' if not provided)
    const effectiveDimension = dimension && typeof dimension === 'string' ? dimension : 'general';
    const dimensionLengthError = validateStringLength(effectiveDimension, MAX_DIMENSION_LENGTH, 'dimension');
    if (dimensionLengthError) return dimensionLengthError;

    // Get or create aggregate for this persona + dimension
    let personaAggregates = feedbackAggregateStore.get(personaId);
    if (!personaAggregates) {
      personaAggregates = new Map<string, FeedbackAggregate>();
      feedbackAggregateStore.set(personaId, personaAggregates);
    }

    let aggregate = personaAggregates.get(effectiveDimension);
    if (!aggregate) {
      aggregate = { accept: 0, reject: 0, modify: 0, lastUpdated: new Date().toISOString() };
      personaAggregates.set(effectiveDimension, aggregate);
    }

    // Update aggregate based on action
    if (action === 'helpful') {
      aggregate.accept += 1;
    } else if (action === 'not_helpful') {
      aggregate.reject += 1;
    } else if (action === 'ignore') {
      aggregate.modify += 1;
    }
    aggregate.lastUpdated = new Date().toISOString();

    // Check if we should write back weights
    const totalFeedback = aggregate.accept + aggregate.reject + aggregate.modify;
    let weightsChanged = false;
    let updatedWeights: Record<string, number> | undefined;

    if (totalFeedback >= FEEDBACK_THRESHOLD) {
      const result = adjustPersonaWeights(persona, effectiveDimension, aggregate);
      weightsChanged = result.changed;
      updatedWeights = result.weights;

      if (weightsChanged) {
        // Update the persona in store if it's a custom persona
        if (persona.type === 'custom' && customPersonaStore.has(personaId)) {
          const updatedPersona = customPersonaStore.get(personaId)!;
          updatedPersona.parameters = { ...updatedPersona.parameters, ...result.paramUpdates };
          customPersonaStore.set(personaId, updatedPersona);
          // Persist updated weights to file
          await saveCustomPersonas(customPersonaStore);
        }
        // Note: preset personas cannot be modified in-place; their weights are returned
        // but not persisted. For custom personas, the store is updated and saved.
      }

      _log.info('Feedback triggered weight adjustment', {
        novelId,
        personaId,
        dimension: effectiveDimension,
        totalFeedback,
        weightsChanged,
      });
    }

    return jsonResponse({
      novelId,
      personaId,
      feedbackId,
      action,
      dimension: effectiveDimension,
      updatedWeights,
      weightsChanged,
    });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Feedback processing failed', { error: message, novelId, personaId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /reader/compare — A/B comparison endpoint
 *
 * Accepts two versions of text (A and B), runs reader simulation
 * with the specified personas on both versions, builds consensus
 * reports for each, and returns a side-by-side comparison.
 *
 * Request: { novelId, versionA: { text, label? }, versionB: { text, label? }, personaIds? }
 * Response: { novelId, versionAConsensus, versionBConsensus, comparison, overallWinner, versionALabel?, versionBLabel? }
 */
export async function rsCompareEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const versionA = body.versionA as Record<string, unknown> | undefined;
  const versionB = body.versionB as Record<string, unknown> | undefined;
  const personaIds = body.personaIds as string[] | undefined;

  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }

  const novelIdOverflow = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdOverflow) return novelIdOverflow;

  if (!versionA || typeof versionA !== 'object' || Array.isArray(versionA)) {
    return jsonResponse({ error: 'versionA is required and must be an object with a text field' }, 400);
  }

  if (!versionB || typeof versionB !== 'object' || Array.isArray(versionB)) {
    return jsonResponse({ error: 'versionB is required and must be an object with a text field' }, 400);
  }

  const textA = versionA.text as string | undefined;
  const textB = versionB.text as string | undefined;

  if (!textA || typeof textA !== 'string') {
    return jsonResponse({ error: 'versionA.text is required and must be a string' }, 400);
  }

  const textAOverflow = validateStringLength(textA, MAX_TEXT_LENGTH, 'versionA.text');
  if (textAOverflow) return textAOverflow;

  if (!textB || typeof textB !== 'string') {
    return jsonResponse({ error: 'versionB.text is required and must be a string' }, 400);
  }

  const textBOverflow = validateStringLength(textB, MAX_TEXT_LENGTH, 'versionB.text');
  if (textBOverflow) return textBOverflow;

  // Validate version labels if provided
  const labelA = versionA.label as string | undefined;
  if (labelA !== undefined && typeof labelA === 'string') {
    const labelAOverflow = validateStringLength(labelA, MAX_LABEL_LENGTH, 'versionA.label');
    if (labelAOverflow) return labelAOverflow;
  }

  const labelB = versionB.label as string | undefined;
  if (labelB !== undefined && typeof labelB === 'string') {
    const labelBOverflow = validateStringLength(labelB, MAX_LABEL_LENGTH, 'versionB.label');
    if (labelBOverflow) return labelBOverflow;
  }

  // Validate persona IDs if provided
  if (personaIds !== undefined) {
    if (!Array.isArray(personaIds)) {
      return jsonResponse({ error: 'personaIds must be an array of strings' }, 400);
    }
    for (const id of personaIds) {
      if (typeof id !== 'string') {
        return jsonResponse({ error: 'Each personaId must be a string' }, 400);
      }
      const idLengthError = validateStringLength(id, MAX_PERSONA_ID_LENGTH, 'personaId');
      if (idLengthError) return idLengthError;
    }
  }

  _log.info('A/B comparison requested', {
    novelId,
    textALength: textA.length,
    textBLength: textB.length,
    personaIds: personaIds ?? 'all',
  });

  try {
    const personas = resolvePersonas(personaIds);
    const engine = getDualEngine();
    const consensus = getConsensusEngine();

    // Analyze both versions concurrently
    const [resultA, resultB] = await Promise.all([
      engine.analyze(textA, personas),
      engine.analyze(textB, personas),
    ]);

    // Build consensus reports for each version
    const consensusA = consensus.buildConsensus(resultA.readerReactions);
    const consensusB = consensus.buildConsensus(resultB.readerReactions);

    // Compare the two consensus reports
    const comparison = consensus.compareConsensus(consensusA, consensusB);

    // Determine overall winner based on average score across all dimensions
    let overallWinner: 'A' | 'B' | 'tie';
    if (comparison.length === 0) {
      overallWinner = 'tie';
    } else {
      const aWins = comparison.filter((c) => c.winner === 'A').length;
      const bWins = comparison.filter((c) => c.winner === 'B').length;
      if (aWins > bWins) {
        overallWinner = 'A';
      } else if (bWins > aWins) {
        overallWinner = 'B';
      } else {
        overallWinner = 'tie';
      }
    }

    _log.info('A/B comparison complete', {
      novelId,
      overallWinner,
      comparisonCount: comparison.length,
    });

    return jsonResponse({
      novelId,
      versionAConsensus: consensusA,
      versionBConsensus: consensusB,
      comparison,
      overallWinner,
      versionALabel: (versionA.label as string | undefined) ?? undefined,
      versionBLabel: (versionB.label as string | undefined) ?? undefined,
    });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('A/B comparison failed', { error: message, novelId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /reader/de-ai — de-AI rewrite endpoint
 *
 * Detects AI-generated prose patterns in the provided text and rewrites
 * it to sound more natural and human-written. Uses the RevisionService
 * with AI-flavor detection results injected as quality goals.
 *
 * Request: { novelId, text?, mode: 'de-ai'|'style-shift', targetStyle? }
 * Response: { novelId, originalText, revisedText, aiFlavorScore, improvements?, suggestions, mode }
 */
export async function rsDeAIEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const text = body.text as string | undefined;
  const mode = (body.mode as 'de-ai' | 'style-shift' | undefined) ?? 'de-ai';
  const targetStyle = body.targetStyle as string | undefined;

  if (!novelId || typeof novelId !== 'string') {
    return jsonResponse({ error: 'novelId is required and must be a string' }, 400);
  }

  const novelIdOverflow = validateStringLength(novelId, MAX_NOVEL_ID_LENGTH, 'novelId');
  if (novelIdOverflow) return novelIdOverflow;

  // Validate targetStyle if provided
  if (targetStyle !== undefined && typeof targetStyle === 'string') {
    const targetStyleOverflow = validateStringLength(targetStyle, MAX_TARGET_STYLE_LENGTH, 'targetStyle');
    if (targetStyleOverflow) return targetStyleOverflow;
  }

  const analysisText = text ?? '';

  _log.info('De-AI rewrite requested', { novelId, textLength: analysisText.length, mode, hasTargetStyle: !!targetStyle });

  // Handle empty text gracefully
  if (!analysisText.trim()) {
    return jsonResponse({
      novelId,
      originalText: analysisText,
      revisedText: analysisText,
      aiFlavorScore: 0,
      suggestions: ['文本为空，无法检测 AI 味或进行重写'],
      mode,
    });
  }

  // SEC-001: cap text length before detection/rewrite to prevent DoS
  const textOverflow = validateStringLength(analysisText, MAX_TEXT_LENGTH, 'text');
  if (textOverflow) return textOverflow;

  try {
    // Step 1: Detect AI flavor
    const aiFlavorResult: AIFlavorResult = detectAIFlavor(analysisText);

    // Step 2: Build quality goals from detection results
    const qualityGoals: string[] = [
      ...aiFlavorResult.suggestions,
      `AI flavor score: ${aiFlavorResult.aiFlavorScore} (confidence: ${aiFlavorResult.confidence})`,
    ];

    // Add mode-specific instructions
    if (mode === 'style-shift' && targetStyle) {
      qualityGoals.push(`Shift writing style to: ${targetStyle}`);
    } else {
      qualityGoals.push('Remove AI-generated template expressions and make prose sound natural and human-written');
    }

    // Step 3: Call RevisionService with de-AI quality goals
    const revisionService = getRevisionService();
    await revisionService.initialize();

    const revisionResult = await revisionService.revise(analysisText, {
      quality_goals: qualityGoals,
      target_style: targetStyle,
      revision_mode: mode,
      max_revisions: 2, // De-AI typically needs fewer iterations
      pass_score: 7.0,
    });

    // Step 4: Build response
    const improvements = revisionResult.comparison
      ? {
          delta: revisionResult.comparison.delta,
          improvedDimensions: revisionResult.comparison.improvedDimensions,
          regressedDimensions: revisionResult.comparison.regressedDimensions,
          unchangedDimensions: revisionResult.comparison.unchangedDimensions,
        }
      : undefined;

    _log.info('De-AI rewrite complete', {
      novelId,
      aiFlavorScore: aiFlavorResult.aiFlavorScore,
      finalScore: revisionResult.finalScore,
      totalIterations: revisionResult.totalIterations,
      textChanged: revisionResult.finalDraft !== analysisText,
    });

    return jsonResponse({
      novelId,
      originalText: analysisText,
      revisedText: revisionResult.finalDraft,
      aiFlavorScore: aiFlavorResult.aiFlavorScore,
      improvements,
      suggestions: aiFlavorResult.suggestions,
      mode,
    });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('De-AI rewrite failed', { error: message, novelId });
    return jsonResponse({ error: message }, 500);
  }
}
