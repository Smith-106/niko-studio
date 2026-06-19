/**
 * Co-Writing Engine MCP Endpoints
 *
 * MCP endpoints for the Co-Writing Engine.
 * Provides REST API for auto/guided generation, mode listing, and creativity presets.
 */

import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import { jsonResponse, parseBody } from '../../mcp/http-types';
import { AutoMode, createAutoMode } from '../AutoMode';
import type { AutoModeInput, CowritingResult } from '../AutoMode';
import { GuidedMode, createGuidedMode } from '../GuidedMode';
import type { GuidedModeInput, GuidedCowritingResult } from '../GuidedMode';
import type {
  CreativitySpectrumConfig,
  CreativityPreset,
} from '../../quality/types';
import {
  CreativityPreset as CreativityPresetEnum,
  CREATIVITY_PRESET_VALUES,
  MODE_BALANCED_DEFAULTS,
  resolveCreativityConfig,
  createDefaultCreativityConfig,
} from '../../quality/types';
import type { CompletenessReport } from '../../knowledge/StoryBibleCompleteness';
import { createLogger } from '../../logger';

const _log = createLogger('cowriting-endpoint');

// ============================================================
// Request Types
// ============================================================

export interface GenerateAutoRequest {
  novelId: string;
  chapterId: string;
  creativityPreset?: CreativityPreset;
}

export interface GenerateGuidedRequest {
  novelId: string;
  chapterId: string;
  creativityPreset?: CreativityPreset;
}

// ============================================================
// Mode singleton instances
// ============================================================

let autoModeInstance: AutoMode | null = null;
let guidedModeInstance: GuidedMode | null = null;

function getAutoMode(): AutoMode {
  if (!autoModeInstance) {
    autoModeInstance = createAutoMode();
  }
  return autoModeInstance;
}

function getGuidedMode(): GuidedMode {
  if (!guidedModeInstance) {
    guidedModeInstance = createGuidedMode();
  }
  return guidedModeInstance;
}

// ============================================================
// Placeholder context builder
// ============================================================

/**
 * Build a minimal AutoModeInput from request parameters.
 * Real implementation will fetch manuscript text and story bible from storage.
 * See ISS-20260620-016: Wire to persistent storage once available.
 */
function buildAutoModeInput(
  _novelId: string,
  _chapterId: string,
  creativityConfig?: CreativitySpectrumConfig,
): AutoModeInput {
  const completeness: CompletenessReport = {
    overallScore: 0,
    level: 'critical',
    entityScores: new Map(),
    missingFields: [],
    recommendations: [],
    timestamp: new Date().toISOString(),
  };

  return {
    manuscriptText: '',
    chapterContext: {
      precedingText: '',
      succeedingText: '',
      chapterSummary: '',
    },
    storyBible: {
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [],
      completeness,
    },
    sessionContext: {
      recentEdits: [],
      writingStyle: '',
      currentChapter: _chapterId,
      cursorPosition: 0,
    },
    creativityConfig,
  };
}

/**
 * Build a minimal GuidedModeInput from request parameters.
 * See ISS-20260620-016: Wire to persistent storage once available.
 */
function buildGuidedModeInput(
  _novelId: string,
  _chapterId: string,
  creativityConfig?: CreativitySpectrumConfig,
): GuidedModeInput {
  return {
    manuscriptText: '',
    chapterContext: {
      precedingText: '',
      succeedingText: '',
      chapterSummary: '',
    },
    storyBible: {
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [],
    },
    sessionContext: {
      recentEdits: [],
      writingStyle: '',
      currentChapter: _chapterId,
      cursorPosition: 0,
    },
    creativityConfig,
  };
}

// ============================================================
// Validation
// ============================================================

function validateGenerateRequest(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const novelId = body.novelId;
  const chapterId = body.chapterId;

  if (!novelId || typeof novelId !== 'string') {
    return { valid: false, error: 'novelId is required and must be a string' };
  }
  if (!chapterId || typeof chapterId !== 'string') {
    return { valid: false, error: 'chapterId is required and must be a string' };
  }

  const preset = body.creativityPreset;
  if (preset !== undefined && !Object.values(CreativityPresetEnum).includes(preset as CreativityPreset)) {
    return {
      valid: false,
      error: `Invalid creativityPreset: ${preset}. Valid values: ${Object.values(CreativityPresetEnum).join(', ')}`,
    };
  }

  return { valid: true };
}

// ============================================================
// Endpoints
// ============================================================

/**
 * POST /cowriting/generate/auto — runs Auto mode generation pipeline
 */
export async function cwGenerateAutoEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const validation = validateGenerateRequest(body);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const novelId = body.novelId as string;
  const chapterId = body.chapterId as string;
  const preset = body.creativityPreset as CreativityPreset | undefined;

  const creativityConfig = preset
    ? resolveCreativityConfig(preset, 'auto')
    : undefined;

  _log.info('Auto mode generation requested', { novelId, chapterId, preset: preset ?? 'default' });

  try {
    const input = buildAutoModeInput(novelId, chapterId, creativityConfig);
    const result: CowritingResult = await getAutoMode().generate(input);

    _log.info('Auto mode generation complete', {
      novelId,
      chapterId,
      textLength: result.text.length,
      model: result.metadata.model,
      confidence: result.metadata.confidence,
    });

    return jsonResponse({ result }, 200);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Auto mode generation failed', { error: message, novelId, chapterId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /cowriting/generate/guided — runs Guided mode generation pipeline
 */
export async function cwGenerateGuidedEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const validation = validateGenerateRequest(body);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const novelId = body.novelId as string;
  const chapterId = body.chapterId as string;
  const preset = body.creativityPreset as CreativityPreset | undefined;

  const creativityConfig = preset
    ? resolveCreativityConfig(preset, 'guided')
    : undefined;

  _log.info('Guided mode generation requested', { novelId, chapterId, preset: preset ?? 'default' });

  try {
    const input = buildGuidedModeInput(novelId, chapterId, creativityConfig);
    const result: GuidedCowritingResult = await getGuidedMode().generate(input);

    _log.info('Guided mode generation complete', {
      novelId,
      chapterId,
      optionCount: result.options.length,
      model: result.metadata.model,
      tokenCount: result.metadata.tokenCount,
    });

    return jsonResponse({ result }, 200);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Guided mode generation failed', { error: message, novelId, chapterId });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * GET /cowriting/modes — returns available co-writing modes and their configs
 */
export async function cwGetModesEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  const modes = [
    {
      id: 'auto',
      name: 'Auto Mode',
      description: 'Full auto-continuation pipeline. Generates a single continuation text automatically.',
      defaultCreativityPreset: CreativityPresetEnum.BALANCED,
      defaultCreativityValue: MODE_BALANCED_DEFAULTS['auto'],
      enforcementMode: 'blocking',
    },
    {
      id: 'guided',
      name: 'Guided Mode',
      description: 'Generates 3 scored continuation options for user selection.',
      defaultCreativityPreset: CreativityPresetEnum.BALANCED,
      defaultCreativityValue: MODE_BALANCED_DEFAULTS['guided'],
      enforcementMode: 'blocking',
    },
    {
      id: 'directed',
      name: 'Directed Mode',
      description: 'User-directed writing with advisory quality feedback. (Not yet implemented.)',
      defaultCreativityPreset: CreativityPresetEnum.BALANCED,
      defaultCreativityValue: MODE_BALANCED_DEFAULTS['directed'],
      enforcementMode: 'advisory',
    },
  ];

  return jsonResponse({ modes });
}

/**
 * GET /cowriting/creativity-presets — returns available creativity presets
 */
export async function cwGetCreativityPresetsEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  const presets = Object.values(CreativityPresetEnum).map((preset) => {
    const config = createDefaultCreativityConfig('auto');
    const resolved = resolveCreativityConfig(preset, 'auto');
    return {
      id: preset,
      value: CREATIVITY_PRESET_VALUES[preset],
      label: preset.charAt(0).toUpperCase() + preset.slice(1),
      description: getCreativityPresetDescription(preset),
      constraints: resolved.constraints,
      modeDefaults: {
        auto: resolveCreativityConfig(preset, 'auto').value,
        guided: resolveCreativityConfig(preset, 'guided').value,
        directed: resolveCreativityConfig(preset, 'directed').value,
      },
    };
  });

  return jsonResponse({ presets });
}

function getCreativityPresetDescription(preset: CreativityPreset): string {
  switch (preset) {
    case CreativityPresetEnum.CONSERVATIVE:
      return 'Low creativity, high coherence. Stays close to established patterns and vocabulary.';
    case CreativityPresetEnum.BALANCED:
      return 'Mode-calibrated default. Balances creativity with coherence based on the selected mode.';
    case CreativityPresetEnum.CREATIVE:
      return 'Higher creativity with more stylistic variation. May introduce novel expressions and structures.';
    case CreativityPresetEnum.EXPERIMENTAL:
      return 'Maximum creativity. Allows nonlinear structures, unreliable narration, and high metaphor density.';
    default:
      return 'Unknown preset.';
  }
}

// ============================================================
// Export for testing
// ============================================================

export function resetModeInstances(): void {
  autoModeInstance = null;
  guidedModeInstance = null;
}
