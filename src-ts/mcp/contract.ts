/**
 * MCP Gateway Contract Normalization
 *
 * Payload normalization, quality defaulting, and detection evasion guards
 * for the MCP gateway.
 *
 * Migrated from src/mcp/contract.py
 */

import { getConfigValue, isTruthyString } from './config';
import {
  ANALYSIS_SCHEMA_VERSION,
  LEGACY_DECISION_MAP,
  ensureContractPayload,
} from '../workflow/types';

// ============================================================
// Canonical workflow contract definitions (re-exported from workflow/types)
// ============================================================

export { ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP, ensureContractPayload };

// ============================================================
// JSONResponse replacement type
// ============================================================

export interface JsonResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

// ============================================================
// Contract Wrappers
// ============================================================

/**
 * Ensure payload has contract fields.
 */
export function withContract(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return ensureContractPayload(payload);
}

/**
 * Ensure payload has terminal contract fields.
 */
export function withTerminalContract(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  let normalized = withContract(payload);

  if (normalized.decision === undefined) normalized.decision = 'go';
  if (normalized.terminal === undefined) normalized.terminal = 'done';

  const terminal = normalized.terminal as string;
  let legacyTerminal = terminal;
  if (terminal === 'interrupted') legacyTerminal = 'aborted';
  else if (terminal === 'recovered') legacyTerminal = 'done';

  let legacyFields = normalized.legacy_contract_fields;
  if (typeof legacyFields !== 'object' || legacyFields === null) {
    legacyFields = {};
  }
  const lf = legacyFields as Record<string, unknown>;
  if (lf.decision === undefined) lf.decision = normalized.decision;
  if (lf.terminal === undefined) lf.terminal = legacyTerminal;
  if (lf.terminal_state === undefined) lf.terminal_state = legacyTerminal;

  normalized = { ...normalized, legacy_contract_fields: lf };
  if (normalized.terminal_state === undefined) {
    normalized.terminal_state = legacyTerminal;
  }
  return normalized;
}

// ============================================================
// Detection Evasion Guard
// ============================================================

export const PROHIBITED_DETECTION_KEYS: ReadonlySet<string> = new Set([
  'anti_detection',
  'bypass_detector',
  'pass_gptzero',
  'detector_bypass',
  'humanize_for_detector',
]);

export const PROHIBITED_DETECTION_TERMS: ReadonlyArray<string> = [
  'ai detection',
  'ai detector',
  'bypass detector',
  'bypass ai detector',
  'evade detector',
  'avoid detection',
  'pass gptzero',
  '\u68C0\u6D4B\u5BF9\u6297',
  '\u53CD\u68C0\u6D4B',
  '\u89C4\u907F\u68C0\u6D4B',
];

/**
 * Recursively check for detection evasion intent in payload.
 */
export function containsDetectionEvasionIntent(value: unknown): boolean {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const [key, nested] of Object.entries(obj)) {
      const keyStr = key.toLowerCase();
      if (PROHIBITED_DETECTION_KEYS.has(keyStr)) return true;
      if (containsDetectionEvasionIntent(nested)) return true;
    }
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsDetectionEvasionIntent(item));
  }

  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return PROHIBITED_DETECTION_TERMS.some((term) => lowered.includes(term));
  }

  return false;
}

/**
 * Check if detection evasion guard is enabled.
 */
export function resolveDetectionEvasionGuardEnabled(): boolean {
  const raw = process.env.NIKO_DETECTION_EVASION_GUARD;
  if (raw !== undefined) return isTruthyString(raw);
  return Boolean(getConfigValue('gateway.detection_evasion_guard', true));
}

/**
 * Guard against detection evasion requests.
 * Returns a JsonResponse if blocked, null if allowed.
 */
export function guardDetectionEvasionPayload(
  payload: Record<string, unknown>,
  enabledOverride?: boolean,
): JsonResponse | null {
  const guardEnabled =
    enabledOverride !== undefined
      ? Boolean(enabledOverride)
      : resolveDetectionEvasionGuardEnabled();

  if (!guardEnabled) return null;

  if (containsDetectionEvasionIntent(payload)) {
    return {
      statusCode: 400,
      body: {
        error: 'DETECTION_EVASION_BLOCKED',
        code: 'COMPLIANCE_DETECTION_EVASION_BLOCKED',
        message:
          '\u68C0\u6D4B\u89C4\u907F\u76F8\u5173\u8BF7\u6C42\u5DF2\u88AB\u62E6\u622A\u3002' +
          '\u8BF7\u6539\u7528\u8D28\u91CF\u589E\u5F3A\u76EE\u6807' +
          '\uFF08\u81EA\u7136\u8868\u8FBE\u3001\u53EF\u8BFB\u6027\u3001\u98CE\u683C\u4E00\u81F4\u6027\u3001' +
          '\u903B\u8F91\u8FDE\u8D2F\u4E0E\u53EF\u6267\u884C\u7F16\u8F91\u5EFA\u8BAE\uFF09\u3002',
      },
    };
  }

  return null;
}

// ============================================================
// Quality Payload Defaults
// ============================================================

/**
 * Get default quality payload structure.
 */
export function qualityDefaultPayload(): Record<string, unknown> {
  return {
    analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
    quality_score: 0.0,
    issues: [],
    metrics: {
      dialogue_ratio: 0.0,
      conflict_points: 0,
      visual_details: 0,
      template_sentence_ratio: 0.0,
      dimension_scores: {
        repetition: 0.0,
        tone: 0.0,
        clarity: 0.0,
        causality: 0.0,
        detail: 0.0,
        factuality: 0.0,
      },
      retrieval: {
        stage1_candidates: 0,
        stage2_selected: 0,
        cited_count: 0,
        effective_hit_rate: 0.0,
      },
      context_budget: {
        token_total: 0,
        token_effective: 0,
        utilization: 0.0,
      },
      self_learning: {
        strategy_adoption_rate: 0.0,
        reflector_triggered: false,
        curator_applied: false,
      },
    },
    publish_recommendation: 'revise',
  };
}

// ============================================================
// Normalization Helpers
// ============================================================

/**
 * Clamp float value to range.
 */
export function clampFloat(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Safely convert value to float.
 */
export function safeFloat(value: unknown, fallback: number): number {
  if (typeof value === 'boolean') return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return fallback;
  return parsed;
}

/**
 * Safely convert value to int.
 */
export function safeInt(value: unknown, fallback: number): number {
  if (typeof value === 'boolean') return fallback;
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

/**
 * Normalize quality score to 0-100 range.
 */
export function normalizeQualityScore(value: unknown, fallback: number): number {
  return clampFloat(safeFloat(value, fallback), 0.0, 100.0);
}

/**
 * Normalize ratio to 0-1 range.
 */
export function normalizeRatio(value: unknown, fallback: number): number {
  return clampFloat(safeFloat(value, fallback), 0.0, 1.0);
}

/**
 * Normalize count to non-negative integer.
 */
export function normalizeCount(value: unknown, fallback: number): number {
  return Math.max(0, safeInt(value, fallback));
}

/**
 * Normalize issue text field.
 */
export function normalizeIssueText(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

/**
 * Normalize issue severity to valid values.
 */
export function normalizeIssueSeverity(value: unknown): string {
  const normalized = normalizeIssueText(value, 'medium').toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') return normalized;
  return 'medium';
}

/**
 * Normalize issue item structure.
 */
export function normalizeIssueItem(issue: Record<string, unknown>): Record<string, string> {
  return {
    severity: normalizeIssueSeverity(issue.severity),
    type: normalizeIssueText(issue.type, 'unknown'),
    evidence: normalizeIssueText(issue.evidence, ''),
    suggestion: normalizeIssueText(issue.suggestion, ''),
  };
}

/**
 * Normalize retrieval metrics structure.
 */
export function normalizeRetrievalMetrics(
  value: unknown,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const v = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    stage1_candidates: normalizeCount(v.stage1_candidates, Number(fallback.stage1_candidates ?? 0)),
    stage2_selected: normalizeCount(v.stage2_selected, Number(fallback.stage2_selected ?? 0)),
    cited_count: normalizeCount(v.cited_count, Number(fallback.cited_count ?? 0)),
    effective_hit_rate: normalizeRatio(v.effective_hit_rate, Number(fallback.effective_hit_rate ?? 0.0)),
  };
}

/**
 * Normalize context budget metrics structure.
 */
export function normalizeContextBudgetMetrics(
  value: unknown,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const v = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    token_total: normalizeCount(v.token_total, Number(fallback.token_total ?? 0)),
    token_effective: normalizeCount(v.token_effective, Number(fallback.token_effective ?? 0)),
    utilization: normalizeRatio(v.utilization, Number(fallback.utilization ?? 0.0)),
  };
}

/**
 * Normalize self-learning metrics structure.
 */
export function normalizeSelfLearningMetrics(
  value: unknown,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const v = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    strategy_adoption_rate: normalizeRatio(
      v.strategy_adoption_rate,
      Number(fallback.strategy_adoption_rate ?? 0.0),
    ),
    reflector_triggered: Boolean(v.reflector_triggered ?? fallback.reflector_triggered ?? false),
    curator_applied: Boolean(v.curator_applied ?? fallback.curator_applied ?? false),
  };
}

/**
 * Normalize schema version from multiple sources.
 */
export function normalizeSchemaVersion(
  payload: Record<string, unknown>,
  contractPayload: Record<string, unknown>,
): string {
  const candidates = [
    payload.analysis_schema_version,
    payload.contract_version,
    contractPayload.analysis_schema_version,
    ANALYSIS_SCHEMA_VERSION,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const normalized = String(candidate).trim();
    if (normalized) return normalized;
  }
  return ANALYSIS_SCHEMA_VERSION;
}

/**
 * Normalize publish recommendation from decision fields.
 */
export function normalizePublishRecommendation(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  const decisionToPublish: Record<string, string> = {
    go: 'pass',
    soft_go: 'revise',
    no_go: 'block',
  };

  const candidates = [
    payload.publish_recommendation,
    payload.decision,
    payload.decision_result,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase();
    if (normalized === 'pass' || normalized === 'revise' || normalized === 'block') {
      return normalized;
    }
    const mappedDecision = LEGACY_DECISION_MAP[normalized];
    if (mappedDecision !== undefined && mappedDecision in decisionToPublish) {
      return decisionToPublish[mappedDecision];
    }
  }

  return fallback;
}

/**
 * Normalize quality payload to standard structure.
 */
export function normalizeQualityPayload(
  payload: unknown,
): Record<string, unknown> {
  const fb = qualityDefaultPayload();
  const p: Record<string, unknown> =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};

  const rawMetrics = typeof p.metrics === 'object' && p.metrics !== null && !Array.isArray(p.metrics)
    ? p.metrics as Record<string, unknown>
    : {};

  const rawDimScores = typeof rawMetrics.dimension_scores === 'object' &&
    rawMetrics.dimension_scores !== null && !Array.isArray(rawMetrics.dimension_scores)
    ? rawMetrics.dimension_scores as Record<string, unknown>
    : {};

  const fallbackMetrics = fb.metrics as Record<string, unknown>;
  const fallbackDimScores = fallbackMetrics.dimension_scores as Record<string, number>;

  const normalizedDimScores: Record<string, number> = {};
  for (const [key, defaultVal] of Object.entries(fallbackDimScores)) {
    normalizedDimScores[key] = normalizeQualityScore(rawDimScores[key], defaultVal);
  }

  const normalizedMetrics: Record<string, unknown> = {
    dialogue_ratio: normalizeRatio(rawMetrics.dialogue_ratio, Number(fallbackMetrics.dialogue_ratio)),
    conflict_points: normalizeCount(rawMetrics.conflict_points, Number(fallbackMetrics.conflict_points)),
    visual_details: normalizeCount(rawMetrics.visual_details, Number(fallbackMetrics.visual_details)),
    template_sentence_ratio: normalizeRatio(
      rawMetrics.template_sentence_ratio,
      Number(fallbackMetrics.template_sentence_ratio),
    ),
    dimension_scores: normalizedDimScores,
    retrieval: normalizeRetrievalMetrics(
      rawMetrics.retrieval,
      fallbackMetrics.retrieval as Record<string, unknown>,
    ),
    context_budget: normalizeContextBudgetMetrics(
      rawMetrics.context_budget,
      fallbackMetrics.context_budget as Record<string, unknown>,
    ),
    self_learning: normalizeSelfLearningMetrics(
      rawMetrics.self_learning,
      fallbackMetrics.self_learning as Record<string, unknown>,
    ),
  };

  const rawIssues = Array.isArray(p.issues) ? p.issues : [];
  const normalizedIssues = rawIssues
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item))
    .map(normalizeIssueItem);

  let contractPayload = ensureContractPayload(p);
  if (typeof contractPayload !== 'object' || contractPayload === null) {
    contractPayload = {};
  }
  const schemaVersion = normalizeSchemaVersion(p, contractPayload);

  return {
    analysis_schema_version: schemaVersion,
    quality_score: normalizeQualityScore(p.quality_score, Number(fb.quality_score)),
    issues: normalizedIssues,
    metrics: normalizedMetrics,
    publish_recommendation: normalizePublishRecommendation(p, String(fb.publish_recommendation)),
  };
}

/**
 * Merge quality sidecar metadata into result payload.
 */
export function mergeQualitySidecar(
  result: unknown,
  retrievalMetadata: unknown,
  contextBudget: unknown,
  selfLearning?: unknown,
): Record<string, unknown> {
  const payload: Record<string, unknown> =
    typeof result === 'object' && result !== null && !Array.isArray(result)
      ? { ...(result as Record<string, unknown>) }
      : {};

  let metrics: Record<string, unknown> =
    typeof payload.metrics === 'object' && payload.metrics !== null && !Array.isArray(payload.metrics)
      ? { ...(payload.metrics as Record<string, unknown>) }
      : {};

  if (typeof retrievalMetadata === 'object' && retrievalMetadata !== null && !Array.isArray(retrievalMetadata)) {
    metrics = { ...metrics, retrieval: retrievalMetadata };
  }
  if (typeof contextBudget === 'object' && contextBudget !== null && !Array.isArray(contextBudget)) {
    metrics = { ...metrics, context_budget: contextBudget };
  }
  if (typeof selfLearning === 'object' && selfLearning !== null && !Array.isArray(selfLearning)) {
    metrics = { ...metrics, self_learning: selfLearning };
  }

  return { ...payload, metrics };
}
