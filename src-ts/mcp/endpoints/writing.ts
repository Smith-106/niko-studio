/**
 * Writing REST Endpoints
 *
 * Writing-related HTTP endpoints for novel quality check and writing helper.
 * Includes SSE streaming support for real-time AI generation.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { processWritingHelper as processLocalWritingHelper } from '../../services/writing-helper';
import { evaluateContent, type EvaluateContentResult } from '../services/critic';
import { skillsLoad } from '../services/skills';
import { createLogger } from '../../logger';

const _log = createLogger('writing-endpoint');

/**
 * Scrub potential credentials (API keys, tokens) from error messages
 * before returning to clients.
 */
function scrubErrorMessage(message: string): string {
  // Remove common API key patterns: sk-..., key-...,Bearer ..., long hex/base64 tokens
  return message
    .replace(/[Aa]uthorization:\s*Bearer\s+\S+/g, 'Authorization: [REDACTED]')
    .replace(/[Aa]pi[_-]?[Kk]ey[:=]\s*\S+/g, 'api_key=[REDACTED]')
    .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, 'sk-[REDACTED]')
    .replace(/\bkey-[a-zA-Z0-9]{20,}\b/g, 'key-[REDACTED]')
    .replace(/\b[Aa]ccess[_-]?[Tt]oken[:=]\s*\S+/g, 'access_token=[REDACTED]')
    .replace(/\b[Aa]uth[_-]?[Tt]oken[:=]\s*\S+/g, 'auth_token=[REDACTED]');
}

// ---------------------------------------------------------------
// Mode-specific prompt builders
// ---------------------------------------------------------------

function buildModePrompt(mode: string, content: string, instruction: string): string {
  const styleSection = instruction ? `\n\n风格要求：\n${instruction}` : ''

  switch (mode) {
    case 'polish':
      return `请对以下文本进行润色优化，使其更加流畅自然。保持原文的核心含义不变。${styleSection}\n\n原文：\n${content}`
    case 'rewrite':
      return `请改写以下文本，使其表达更好。${styleSection}\n\n原文：\n${content}`
    case 'expand':
      return `请扩写以下文本，增加细节和深度。${styleSection}\n\n原文：\n${content}`
    case 'summarize':
      return `请总结以下文本的核心要点。${styleSection}\n\n原文：\n${content}`
    case 'outline':
      return `请为以下内容生成一个大纲。${styleSection}\n\n内容：\n${content}`
    case 'generate':
      return content
    default:
      return `请处理以下文本：\n\n${content}${styleSection}`
  }
}

// ---------------------------------------------------------------
// LLM call helpers
// ---------------------------------------------------------------

interface ProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
  provider: string
}

function resolveProviderConfig(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): ProviderConfig | null {
  // Prefer header-based API key transmission (X-LLM-API-Key) over body field.
  // Body field is still accepted for backward compatibility but deprecated.
  const apiKey =
    headers?.['x-llm-api-key']?.trim()
    ?? headers?.['X-LLM-API-Key']?.trim()
    ?? (body.api_key as string | undefined)?.trim()
    ?? undefined
  const baseUrl =
    headers?.['x-llm-base-url']?.trim()
    ?? headers?.['X-LLM-Base-Url']?.trim()
    ?? (body.base_url as string | undefined)?.trim()
    ?? undefined
  const model = body.model as string | undefined
  const provider = body.provider as string | undefined

  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    baseUrl: baseUrl ?? 'https://api.openai.com/v1',
    model: model ?? 'gpt-4o',
    provider: provider ?? 'openai',
  }
}

function buildOpenAIMessages(prompt: string, systemPrompt?: string): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })
  return messages
}

async function callLLM(
  config: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const messages = buildOpenAIMessages(prompt, systemPrompt)

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as Record<string, unknown>
  const choices = data.choices as Array<{ message: { content: string } }>
  return choices?.[0]?.message?.content ?? ''
}

async function* streamLLM(
  config: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
): AsyncGenerator<string, void, undefined> {
  const messages = buildOpenAIMessages(prompt, systemPrompt)

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error: ${response.status} - ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // skip malformed JSON
        }
      }
    }
  }
}

async function resolveSkillInstruction(skillIds: unknown): Promise<{ skillIds: string[]; instruction: string }> {
  if (!Array.isArray(skillIds)) {
    return { skillIds: [], instruction: '' };
  }

  const normalizedIds = skillIds
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalizedIds.length === 0) {
    return { skillIds: [], instruction: '' };
  }

  const uniqueIds = [...new Set(normalizedIds)];
  const sections: string[] = [];

  for (const skillId of uniqueIds) {
    const loaded = await skillsLoad(skillId);
    if ('content' in loaded && loaded.content.trim()) {
      sections.push(`## Skill Pack: ${skillId}\n${loaded.content.trim()}`);
    }
  }

  return {
    skillIds: uniqueIds,
    instruction: sections.join('\n\n'),
  };
}

function mergeSkillInstruction(instruction: string, skillInstruction: string): string {
  const parts = [instruction.trim(), skillInstruction.trim()].filter(Boolean);
  return parts.join('\n\n');
}

/**
 * Evaluate novel quality using the real CriticEngine.
 * Wraps the MCP critic service evaluateContent for use in the
 * writing quality check endpoint.
 */
async function evaluateNovelQuality(
  content: string,
  _options?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result: EvaluateContentResult = await evaluateContent(
    content,
    undefined,
    undefined,
    undefined,
  );

  return {
    status: 'ok',
    total_score: result.total_score,
    lock_score: result.lock_score,
    style_score: result.style_score,
    logic_score: result.logic_score,
    actionable_feedback: result.actionable_feedback,
    suggestions: result.suggestions,
  };
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
  }
}

// ---------------------------------------------------------------
// SSE helper
// ---------------------------------------------------------------

function formatSseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

export async function novelQualityCheckEndpoint(
  request: HttpRequest
): Promise<HttpResponse> {
  let body: Record<string, unknown>
  try {
    body = (parseBody(request) ?? {}) as Record<string, unknown>
  } catch {
    body = {}
  }

  if (typeof body !== 'object') body = {}

  const content = body.content as string
  if (typeof content !== 'string' || !content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400)
  }

  const normalizedContent = content.trim()
  const retrievalMetadata = body.retrieval_metadata
  const contextBudget = body.context_budget
  const selfLearning = body.self_learning

  const qualityOptions: Record<string, unknown> = {}
  if ('quality_level' in body) qualityOptions.qualityLevel = String(body.quality_level ?? 'high')
  if ('quality_mode' in body) qualityOptions.qualityMode = String(body.quality_mode ?? 'auto')
  if ('critical_gate_always_on' in body) qualityOptions.criticalGateAlwaysOn = Boolean(body.critical_gate_always_on ?? true)
  if ('degrade_reason' in body) qualityOptions.degradeReason = String(body.degrade_reason ?? '')

  let result: Record<string, unknown>
  try {
    result = await evaluateNovelQuality(normalizedContent, qualityOptions)
  } catch {
    return jsonResponse({ error: 'Quality evaluation failed' }, 500)
  }

  // Derive decision from total_score (aligned with critic.ts thresholds)
  const totalScore = Number.isFinite(result.total_score) ? (result.total_score as number) : 0
  const decision = totalScore >= 80 ? 'APPROVED'
    : totalScore >= 60 ? 'REVISE'
    : 'REWRITE'

  result = mergeQualitySidecar({ ...result, decision }, retrievalMetadata, contextBudget, selfLearning)

  return jsonResponse(result)
}

export async function writingHelperProcessEndpoint(
  request: HttpRequest
): Promise<HttpResponse> {
  let body: Record<string, unknown>
  try {
    body = (parseBody(request) ?? {}) as Record<string, unknown>
  } catch {
    body = {}
  }

  if (typeof body !== 'object') body = {}

  const content = body.content as string
  if (typeof content !== 'string' || !content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400)
  }

  const mode = (body.mode as string) ?? 'polish'
  const instruction = typeof body.instruction === 'string' ? body.instruction : ''
  const { skillIds, instruction: skillInstruction } = await resolveSkillInstruction(body.skill_ids)
  const combinedInstruction = mergeSkillInstruction(instruction, skillInstruction)
  const detectionEvasion = body.detection_evasion_guard_enabled === true
  const maxSentences = typeof body.max_sentences === 'number'
    ? body.max_sentences
    : typeof body.maxSentences === 'number'
      ? body.maxSentences
      : undefined
  const maxItems = typeof body.max_items === 'number'
    ? body.max_items
    : typeof body.maxItems === 'number'
      ? body.maxItems
      : undefined

  const config = resolveProviderConfig(body, request.headers)
  if (!config) {
    const normalizedMode = mode.trim().toLowerCase()
    if (normalizedMode === 'generate') {
      return jsonResponse({ error: 'No LLM provider configured' }, 400)
    }

    try {
      const localResult = processLocalWritingHelper({
        content,
        mode: normalizedMode,
        instruction: combinedInstruction,
        maxSentences,
        maxItems,
      })

      const normalizedLocalResult = { ...localResult } as Record<string, unknown>
      if (!('processed_text' in normalizedLocalResult) && Array.isArray(normalizedLocalResult.outline)) {
        normalizedLocalResult.processed_text = normalizedLocalResult.outline.join('\n')
      }

      return jsonResponse({
        ...normalizedLocalResult,
        status: 'ok',
        provider: 'local',
        skills_used: skillIds,
      })
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : String(exc)
      return jsonResponse({ error: message }, 400)
    }
  }

  try {
    const prompt = buildModePrompt(mode, content, combinedInstruction)
    const systemPrompt = detectionEvasion
      ? '你是一位专业的写作助手。请确保输出文本具有人类写作的自然特征，避免AI生成的典型模式。'
      : '你是一位专业的写作助手。'

    const result = await callLLM(config, prompt, systemPrompt)

    if (mode === 'outline') {
      const outline = result.split('\n').filter((l) => l.trim())
      return jsonResponse({ mode, outline, processed_text: result, status: 'ok', skills_used: skillIds })
    }

    return jsonResponse({ mode, processed_text: result, status: 'ok', skills_used: skillIds })
  } catch (exc) {
    const rawMessage = exc instanceof Error ? exc.message : String(exc)
    const safeMessage = scrubErrorMessage(rawMessage)
    _log.error('LLM call failed', { error: safeMessage })
    return jsonResponse({ error: safeMessage }, 500)
  }
}

/**
 * SSE Streaming endpoint for writing AI.
 * Returns Server-Sent Events for real-time text generation.
 */
export async function writingStreamEndpoint(
  request: HttpRequest
): Promise<HttpResponse> {
  let body: Record<string, unknown>
  try {
    body = (parseBody(request) ?? {}) as Record<string, unknown>
  } catch {
    body = {}
  }

  if (typeof body !== 'object') body = {}

  const content = body.content as string
  if (typeof content !== 'string' || !content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400)
  }

  const mode = (body.mode as string) ?? 'generate'
  const instruction = typeof body.instruction === 'string' ? body.instruction : ''
  const { skillIds, instruction: skillInstruction } = await resolveSkillInstruction(body.skill_ids)
  const combinedInstruction = mergeSkillInstruction(instruction, skillInstruction)

  const config = resolveProviderConfig(body, request.headers)
  if (!config) {
    return jsonResponse({ error: 'No LLM provider configured' }, 400)
  }

  try {
    const prompt = buildModePrompt(mode, content, combinedInstruction)
    const systemPrompt = '你是一位专业的写作助手。请确保输出文本具有人类写作的自然特征。'

    const sseEvents: string[] = []
    let index = 0
    let bufferSize = 0
    // Prevent OOM: cap SSE buffer at 5MB
    const MAX_SSE_BUFFER = 5 * 1024 * 1024
    const WARN_SSE_BUFFER = 1 * 1024 * 1024
    let warnedLargeBuffer = false

    const startEvent = formatSseEvent('start', { status: 'started' })
    sseEvents.push(startEvent)
    bufferSize += startEvent.length

    for await (const chunk of streamLLM(config, prompt, systemPrompt)) {
      const event = formatSseEvent('content', { chunk, index })
      bufferSize += event.length

      if (bufferSize > MAX_SSE_BUFFER) {
        _log.error('SSE buffer exceeded 5MB cap, truncating stream', { chunks: index, bufferSize })
        const truncEvent = formatSseEvent('done', { status: 'truncated', reason: 'buffer_size_exceeded', chunks: index, skills_used: skillIds })
        sseEvents.push(truncEvent)
        break
      }

      if (!warnedLargeBuffer && bufferSize > WARN_SSE_BUFFER) {
        _log.warn('SSE buffer exceeds 1MB — consider streaming refactor', { chunks: index, bufferSize })
        warnedLargeBuffer = true
      }

      sseEvents.push(event)
      index++
    }

    // Only append 'done' if we didn't truncate
    if (bufferSize <= MAX_SSE_BUFFER) {
      const doneEvent = formatSseEvent('done', { status: 'completed', chunks: index, skills_used: skillIds })
      sseEvents.push(doneEvent)
    }

    return {
      statusCode: 200,
      body: sseEvents.join(''),
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    }
  } catch (exc) {
    const rawMessage = exc instanceof Error ? exc.message : String(exc)
    const safeMessage = scrubErrorMessage(rawMessage)
    _log.error('LLM stream failed', { error: safeMessage })
    return jsonResponse({ error: safeMessage }, 500)
  }
}
