/**
 * Reader Simulation MCP Endpoints
 *
 * MCP endpoints for Reader Simulation Engine (SME-02).
 * Provides REST API for persona-based reading simulation, persona management, and overlay markers.
 *
 * Related: T-036, SME-02
 */

import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import { jsonResponse, parseBody } from '../../mcp/http-types';
import type { ReaderPersona, PresetPersonaId } from '../PersonaDefinition';
import {
  createCustomPersona,
  PRESET_PERSONAS,
  getPresetPersona,
  listPresetPersonas,
} from '../PersonaDefinition';
import { DualEngine } from '../DualEngine';
import type { DualEngineResult, ReaderReaction } from '../DualEngine';
import { DimensionAnalyzer, createDimensionAnalyzer } from '../DimensionAnalyzer';
import type { DimensionScore } from '../DimensionAnalyzer';
import { ConsensusEngine } from '../ConsensusEngine';
import { detectAIFlavor } from '../ai-flavor-detector';
import type { AIFlavorResult } from '../ai-flavor-detector';
import { createLogger } from '../../logger';
import { RevisionServiceImpl } from '../../services/revision-service';

const _log = createLogger('reader-endpoint');

// RevisionService singleton for de-AI endpoint
let revisionServiceInstance: RevisionServiceImpl | null = null;

function getRevisionService(): RevisionServiceImpl {
  if (!revisionServiceInstance) {
    revisionServiceInstance = new RevisionServiceImpl();
  }
  return revisionServiceInstance;
}

// ConsensusEngine singleton
let consensusEngineInstance: ConsensusEngine | null = null;

function getConsensusEngine(): ConsensusEngine {
  if (!consensusEngineInstance) {
    consensusEngineInstance = new ConsensusEngine();
  }
  return consensusEngineInstance;
}

// ============================================================
// Request Types
// ============================================================

export interface AnalyzeRequest {
  novelId: string;
  personaIds?: string[]; // defaults to all presets
}

export interface CreatePersonaRequest {
  name: string;
  parameters: Record<string, any>;
}

export interface DeAIRequest {
  novelId: string;
  text?: string;
  mode?: 'de-ai' | 'style-shift';
  targetStyle?: string;
}

export interface DeAIResponse {
  novelId: string;
  originalText: string;
  revisedText: string;
  aiFlavorScore: number;
  improvements?: {
    delta: Record<string, number>;
    improvedDimensions: string[];
    regressedDimensions: string[];
    unchangedDimensions: string[];
  };
  suggestions: string[];
  mode: string;
}

// ============================================================
// In-memory storage
// ============================================================

const customPersonaStore = new Map<string, ReaderPersona>();
const analysisResultCache = new Map<string, DualEngineResult>();

// DualEngine singleton
let dualEngineInstance: DualEngine | null = null;
let dimensionAnalyzerInstance: DimensionAnalyzer | null = null;

function getDualEngine(): DualEngine {
  if (!dualEngineInstance) {
    dualEngineInstance = new DualEngine();
  }
  return dualEngineInstance;
}

function getDimensionAnalyzer(): DimensionAnalyzer {
  if (!dimensionAnalyzerInstance) {
    dimensionAnalyzerInstance = createDimensionAnalyzer();
  }
  return dimensionAnalyzerInstance;
}

// ============================================================
// Helpers
// ============================================================

function resolvePersonas(personaIds?: string[]): ReaderPersona[] {
  if (!personaIds || personaIds.length === 0) {
    // Default: use all preset personas
    return listPresetPersonas().map((id) => getPresetPersona(id));
  }

  return personaIds.map((id) => {
    // Check preset first
    if (id in PRESET_PERSONAS) {
      return getPresetPersona(id as PresetPersonaId);
    }
    // Then check custom store
    const custom = customPersonaStore.get(id);
    if (custom) {
      return custom;
    }
    throw new Error(`Persona not found: ${id}`);
  });
}

function buildOverlayMarkers(reactions: ReaderReaction[]): OverlayMarker[] {
  const markers: OverlayMarker[] = [];

  for (const reaction of reactions) {
    for (const highlight of reaction.highlights) {
      markers.push({
        personaId: reaction.personaId,
        personaName: reaction.personaName,
        position: highlight.position,
        reaction: highlight.reaction,
        comment: highlight.comment,
        dimension: highlight.dimension,
        text: highlight.text,
      });
    }
  }

  return markers;
}

// ============================================================
// Response Types
// ============================================================

export interface OverlayMarker {
  personaId: string;
  personaName: string;
  position: { chapter: string; paragraph: number };
  reaction: 'positive' | 'negative' | 'neutral';
  comment: string;
  dimension: string;
  text: string;
}

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

  // Validate persona IDs if provided
  if (personaIds !== undefined) {
    if (!Array.isArray(personaIds)) {
      return jsonResponse({ error: 'personaIds must be an array of strings' }, 400);
    }
    for (const id of personaIds) {
      if (typeof id !== 'string') {
        return jsonResponse({ error: 'Each personaId must be a string' }, 400);
      }
    }
  }

  _log.info('Reader simulation analysis requested', { novelId, personaIds: personaIds ?? 'all' });

  try {
    const personas = resolvePersonas(personaIds);

    // TODO: Fetch manuscript text from persistent storage
    // For now, use empty placeholder text
    const manuscriptText = '';

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

      const emptyResult: DualEngineResult = {
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

    const result: DualEngineResult = await getDualEngine().analyze(
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
  }

  // Validate array fields
  const arrayFields = ['focusAreas', 'biases'];
  for (const field of arrayFields) {
    const value = parameters[field];
    if (value !== undefined && !Array.isArray(value)) {
      return jsonResponse({ error: `parameters.${field} must be an array` }, 400);
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

export function clearReaderStores(): void {
  customPersonaStore.clear();
  analysisResultCache.clear();
}

export function getCustomPersonaStore(): Map<string, ReaderPersona> {
  return customPersonaStore;
}

export function getAnalysisResultCache(): Map<string, DualEngineResult> {
  return analysisResultCache;
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
