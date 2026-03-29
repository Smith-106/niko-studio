/**
 * Writing REST Endpoints
 *
 * Writing-related HTTP endpoints for novel quality check and writing helper.
 * Ported from src/mcp/endpoints/writing.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

// ---------------------------------------------------------------
// Placeholder functions for gateway dependencies
// ---------------------------------------------------------------

function qualityDefaultPayload(): Record<string, unknown> {
  return {
    status: 'ok',
    total_score: 0,
    lock_score: 0,
    style_score: 0,
    logic_score: 0,
    actionable_feedback: '',
    suggestions: [],
  };
}

function normalizeQualityPayload(
  result: Record<string, unknown>
): Record<string, unknown> {
  return result;
}

function mergeQualitySidecar(
  result: Record<string, unknown>,
  retrievalMetadata: unknown,
  contextBudget: unknown,
  selfLearning: unknown
): Record<string, unknown> {
  return {
    ...result,
    ...(retrievalMetadata != null ? { retrieval_metadata: retrievalMetadata } : {}),
    ...(contextBudget != null ? { context_budget: contextBudget } : {}),
    ...(selfLearning != null ? { self_learning: selfLearning } : {}),
  };
}

async function evaluateNovelQuality(
  content: string,
  options?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Placeholder: full implementation requires quality evaluator
  return qualityDefaultPayload();
}

async function processWritingHelper(params: {
  content: string;
  mode: string;
  maxSentences: number;
  maxItems: number;
  instruction: string;
}): Promise<Record<string, unknown>> {
  // Placeholder: full implementation requires writing helper processor
  return {
    status: 'ok',
    mode: params.mode,
    result: null,
  };
}

function guardDetectionEvasionPayload(
  body: Record<string, unknown>,
  options?: { enabledOverride?: boolean }
): HttpResponse | null {
  return null;
}

function resolveDetectionEvasionGuardEnabled(): boolean {
  return false;
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

export async function novelQualityCheckEndpoint(
  request: HttpRequest
): Promise<HttpResponse> {
  let body: Record<string, unknown>;
  try {
    body = (parseBody(request) ?? {}) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (typeof body !== 'object' || body === null) {
    body = {};
  }

  const content = body.content as string;
  if (typeof content !== 'string' || !content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400);
  }

  const normalizedContent = content.trim();
  const retrievalMetadata = body.retrieval_metadata;
  const contextBudget = body.context_budget;
  const selfLearning = body.self_learning;

  const qualityKwargs: Record<string, unknown> = {};
  if ('quality_level' in body) {
    qualityKwargs.quality_level = String(body.quality_level ?? 'high');
  }
  if ('quality_mode' in body) {
    qualityKwargs.quality_mode = String(body.quality_mode ?? 'auto');
  }
  if ('critical_gate_always_on' in body) {
    qualityKwargs.critical_gate_always_on = Boolean(body.critical_gate_always_on ?? true);
  }
  if ('degrade_reason' in body) {
    qualityKwargs.degrade_reason = String(body.degrade_reason ?? '');
  }

  let result: Record<string, unknown>;
  try {
    result = await evaluateNovelQuality(normalizedContent, qualityKwargs);
  } catch {
    result = qualityDefaultPayload();
  }

  result = mergeQualitySidecar(result, retrievalMetadata, contextBudget, selfLearning);

  let normalizedResult: Record<string, unknown>;
  try {
    normalizedResult = normalizeQualityPayload(result);
  } catch {
    normalizedResult = qualityDefaultPayload();
  }

  return jsonResponse(normalizedResult);
}

export async function writingHelperProcessEndpoint(
  request: HttpRequest
): Promise<HttpResponse> {
  let body: Record<string, unknown>;
  try {
    body = (parseBody(request) ?? {}) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (typeof body !== 'object' || body === null) {
    body = {};
  }

  const content = body.content as string;
  if (typeof content !== 'string' || !content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400);
  }

  const guardResponse = guardDetectionEvasionPayload(body);
  if (guardResponse) return guardResponse;

  const mode = (body.mode as string) ?? (body.action as string) ?? 'polish';
  const maxSentences = Number(body.max_sentences ?? 3);
  const maxItems = Number(body.max_items ?? 6);
  const instruction = typeof body.instruction === 'string' ? body.instruction : '';

  try {
    const result = await processWritingHelper({
      content,
      mode,
      maxSentences,
      maxItems,
      instruction,
    });
    return jsonResponse(result);
  } catch (exc) {
    if (exc instanceof Error && exc.message.includes('ValueError')) {
      return jsonResponse({ error: exc.message }, 400);
    }
    return jsonResponse({ error: String(exc) }, 500);
  }
}
