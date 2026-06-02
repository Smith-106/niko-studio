/**
 * Quality Control MCP Endpoints
 *
 * MCP endpoints for QC validation and creativity spectrum configuration.
 * Provides REST API for quality enforcement and creativity control.
 */

import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import { jsonResponse, parseBody } from '../../mcp/http-types';
import type {
  QCEnforcementResult,
  CreativitySpectrumConfig,
  CreativityPreset,
  HardConstraintViolation,
  QCEforcementMode,
  HardConstraintReport,
  HardConstraintResult,
  QualityDimension,
} from '../../quality/types';
import {
  ConstraintSeverity,
  createDefaultCreativityConfig,
  resolveCreativityConfig,
  CreativityPreset as CreativityPresetEnum,
  QCEforcementMode as QCEforcementModeEnum,
} from '../../quality/types';
import { createLogger } from '../../logger';

const _log = createLogger('qc-endpoint');

// ============================================================
// Validation result cache (for recent validations)
// ============================================================

interface ValidationCacheEntry {
  result: QCEnforcementResult;
  timestamp: number;
}

const validationCache = new Map<string, ValidationCacheEntry>();
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_SIZE = 100;

function getCacheKey(text: string, mode: string): string {
  // Simple hash for cache key
  const hash = text.length > 100 ? `${text.length}:${text.slice(0, 50)}:${text.slice(-50)}` : text;
  return `${mode}:${hash}`;
}

function pruneCache(): void {
  if (validationCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, entry] of validationCache) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        validationCache.delete(key);
      }
    }
    // If still over limit, remove oldest entries
    if (validationCache.size > MAX_CACHE_SIZE) {
      const entries = [...validationCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length - MAX_CACHE_SIZE / 2; i++) {
        validationCache.delete(entries[i][0]);
      }
    }
  }
}

// ============================================================
// Mode resolution
// ============================================================

function resolveEnforcementMode(mode: string): QCEforcementMode {
  switch (mode.toLowerCase()) {
    case 'auto':
    case 'guided':
      return QCEforcementModeEnum.BLOCKING;
    case 'directed':
      return QCEforcementModeEnum.ADVISORY;
    default:
      return QCEforcementModeEnum.BLOCKING;
  }
}

// ============================================================
// Validation logic
// ============================================================

interface ValidationInput {
  text: string;
  mode: string;
  creativityConfig?: CreativitySpectrumConfig;
}

function validateInput(input: ValidationInput): { valid: boolean; error?: string } {
  if (!input.text || typeof input.text !== 'string' || !input.text.trim()) {
    return { valid: false, error: 'text is required and must be a non-empty string' };
  }
  if (!input.mode || typeof input.mode !== 'string') {
    return { valid: false, error: 'mode is required and must be a string' };
  }
  return { valid: true };
}

/**
 * Run basic quality checks on text.
 * TODO: Integrate with actual CAS (Craft Analysis Services) for real constraint evaluation.
 * Currently provides a structural placeholder with basic heuristics.
 */
function runQualityCheck(text: string, _mode: string): HardConstraintReport {
  const violations: HardConstraintViolation[] = [];
  const dimensionResults: HardConstraintResult[] = [];

  // Basic heuristics for structural quality checks
  const sentences = text.split(/[.!?。！？]+/).filter(Boolean);
  const avgSentenceLength = text.length / Math.max(sentences.length, 1);

  // Plot coherence check (basic: text length heuristic)
  const plotScore = Math.min(1, text.length / 500);
  if (avgSentenceLength > 80) {
    violations.push({
      dimension: 'plot-coherence' as QualityDimension,
      severity: ConstraintSeverity.MEDIUM,
      message: 'Sentences are too long, may affect readability',
      location: {},
      evidence: `Average sentence length: ${Math.round(avgSentenceLength)} characters`,
      suggestedFix: 'Break long sentences into shorter ones',
    });
  }
  dimensionResults.push({
    dimension: 'plot-coherence' as QualityDimension,
    score: plotScore,
    violations: violations.filter((v) => v.dimension === 'plot-coherence'),
    passed: plotScore > 0.5,
  });

  // Character consistency check (placeholder)
  const charScore = 0.8;
  dimensionResults.push({
    dimension: 'character-consistency' as QualityDimension,
    score: charScore,
    violations: [],
    passed: true,
  });

  // Style consistency check (basic)
  const styleScore = 0.7;
  dimensionResults.push({
    dimension: 'style-consistency' as QualityDimension,
    score: styleScore,
    violations: [],
    passed: true,
  });

  // Pacing and tension check (placeholder)
  const pacingScore = 0.6;
  dimensionResults.push({
    dimension: 'pacing-tension' as QualityDimension,
    score: pacingScore,
    violations: [],
    passed: true,
  });

  const blockingViolations = violations.filter(
    (v) => v.severity === ConstraintSeverity.CRITICAL || v.severity === ConstraintSeverity.HIGH,
  );

  return {
    overallScore: dimensionResults.reduce((sum, r) => sum + r.score, 0) / dimensionResults.length,
    dimensionResults,
    allViolations: violations,
    blockingViolations,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Endpoints
// ============================================================

/**
 * POST /qc/validate - Validate text output against quality constraints
 */
export async function qcValidateOutputEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const text = body.text as string | undefined;
  const mode = body.mode as string | undefined;
  const creativityConfig = body.creativityConfig as CreativitySpectrumConfig | undefined;

  const input: ValidationInput = {
    text: text ?? '',
    mode: mode ?? '',
    creativityConfig,
  };

  const validation = validateInput(input);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400);
  }

  // Check cache
  const cacheKey = getCacheKey(input.text, input.mode);
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return jsonResponse({ result: cached.result, cached: true });
  }

  try {
    const enforcementMode = resolveEnforcementMode(input.mode);
    const config = input.creativityConfig ?? createDefaultCreativityConfig(input.mode);

    // Run quality checks
    const report = runQualityCheck(input.text, input.mode);

    const isBlocking = enforcementMode === QCEforcementModeEnum.BLOCKING;
    const hasBlockingViolations = report.blockingViolations.length > 0;

    const result: QCEnforcementResult = {
      mode: enforcementMode,
      allowed: isBlocking ? !hasBlockingViolations : true,
      warnings: enforcementMode === QCEforcementModeEnum.ADVISORY
        ? report.allViolations
        : report.allViolations.filter((v) => v.severity !== ConstraintSeverity.CRITICAL && v.severity !== ConstraintSeverity.HIGH),
      blocked: isBlocking ? report.blockingViolations : [],
      creativityConfig: config,
    };

    // Cache result
    validationCache.set(cacheKey, { result, timestamp: Date.now() });
    pruneCache();

    _log.info('QC validation completed', {
      mode: input.mode,
      enforcementMode,
      allowed: result.allowed,
      violationCount: report.allViolations.length,
    });

    return jsonResponse({ result });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('QC validation failed', { error: message, mode: input.mode });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /qc/creativity-config - Get creativity spectrum configuration
 */
export async function qcGetCreativityConfigEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const mode = body.mode as string | undefined;
  if (!mode || typeof mode !== 'string') {
    return jsonResponse({ error: 'mode is required and must be a string' }, 400);
  }

  const presetValue = body.preset as string | undefined;
  const customValue = body.customValue as number | undefined;

  let config: CreativitySpectrumConfig;

  if (presetValue && Object.values(CreativityPresetEnum).includes(presetValue as CreativityPreset)) {
    config = resolveCreativityConfig(
      presetValue as CreativityPreset,
      mode,
      customValue,
    );
  } else {
    config = createDefaultCreativityConfig(mode);
  }

  _log.info('Creativity config requested', { mode, preset: presetValue || 'default' });

  return jsonResponse({ config });
}

// ============================================================
// Export for testing
// ============================================================

export function clearValidationCache(): void {
  validationCache.clear();
}
