/**
 * Chat REST Endpoints
 *
 * Chat-related HTTP endpoints for Desktop frontend, including SSE streaming.
 * Ported from src/mcp/endpoints/chat.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const MAX_MESSAGES = 128;
const MAX_MESSAGE_CHARS = 24_000;
const MAX_TOTAL_CHARS = 120_000;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function countTotalChars(messages: unknown[]): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m === 'object' && m !== null) {
      const content = (m as Record<string, unknown>).content;
      if (typeof content === 'string') {
        total += content.length;
      }
    }
  }
  return total;
}

function validateChatMessagesLimits(messages: unknown[]): HttpResponse | null {
  if (!Array.isArray(messages)) {
    return jsonResponse({ error: 'Invalid messages. Expected array' }, 400);
  }

  if (messages.length > MAX_MESSAGES) {
    return jsonResponse({ error: `Too many messages. Max ${MAX_MESSAGES}` }, 400);
  }

  for (let idx = 0; idx < messages.length; idx++) {
    const m = messages[idx];
    if (typeof m !== 'object' || m === null) {
      return jsonResponse({ error: `Invalid message at index ${idx}. Expected object` }, 400);
    }

    const record = m as Record<string, unknown>;
    const role = record.role;
    const content = record.content;

    if (!['system', 'user', 'assistant'].includes(role as string)) {
      return jsonResponse({ error: `Invalid message.role at index ${idx}` }, 400);
    }
    if (typeof content !== 'string') {
      return jsonResponse({ error: `Invalid message.content at index ${idx}. Expected string` }, 400);
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return jsonResponse({ error: `Message too long at index ${idx}. Max ${MAX_MESSAGE_CHARS} chars` }, 400);
    }
  }

  if (countTotalChars(messages) > MAX_TOTAL_CHARS) {
    return jsonResponse({ error: `Context too long. Max ${MAX_TOTAL_CHARS} chars` }, 400);
  }

  return null;
}

/**
 * Split content into chunks at sentence boundaries.
 * Used for SSE streaming output.
 */
export function adaptiveChunkContent(
  content: string,
  maxChunkSize = 500,
  minChunkSize = 50
): string[] {
  if (!content) return [];

  const sentenceEndings = /([.!??\n])/;
  const chunks: string[] = [];
  let currentChunk = '';

  const parts = content.split(sentenceEndings);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // If it's a punctuation mark, append to current chunk
    if (sentenceEndings.test(part)) {
      currentChunk += part;
      continue;
    }

    // Check if adding would exceed max size
    if (currentChunk.length + part.length > maxChunkSize) {
      if (currentChunk && currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else if (currentChunk) {
        currentChunk += part;
      } else {
        // Single part exceeds max size, force split
        let remaining = part;
        while (remaining.length > maxChunkSize) {
          chunks.push(remaining.slice(0, maxChunkSize));
          remaining = remaining.slice(maxChunkSize);
        }
        currentChunk = remaining;
      }
    } else {
      currentChunk += part;
    }

    // If current chunk ends at sentence boundary and meets minimum size
    if (
      /[.!??\n]$/.test(currentChunk) &&
      currentChunk.length >= minChunkSize
    ) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatBody {
  messages?: ChatMessage[];
  workflowLevel?: string | number;
  skills?: string[];
  context?: Record<string, unknown>;
  allowLlmFallback?: boolean;
  comparison?: {
    enabled?: boolean;
    controlModel?: string;
    primaryModel?: string;
  };
}

function withContract(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    _contract: { version: '1.0', timestamp: Date.now() },
  };
}

function withTerminalContract(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    _contract: { version: '1.0', terminal: true, timestamp: Date.now() },
  };
}

export async function chatEndpoint(request: HttpRequest): Promise<HttpResponse> {
  try {
    const body = (parseBody(request) ?? {}) as ChatBody;
    const messages = body.messages ?? [];

    const limitError = validateChatMessagesLimits(messages);
    if (limitError) return limitError;

    if (!messages.length) {
      return jsonResponse({ error: 'No messages provided' }, 400);
    }

    const userMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user')?.content ?? '';

    if (!userMessage) {
      return jsonResponse({ error: 'No user message found' }, 400);
    }

    const allowLlmFallback = body.allowLlmFallback !== false;
    const skills = body.skills ?? [];
    const context = body.context ?? {};
    const comparison = typeof body.comparison === 'object' && body.comparison !== null
      ? body.comparison
      : {};
    const comparisonEnabled = !!comparison.enabled;

    // Placeholder response -- full implementation requires Commander/Writer agents
    const responseContent = `Workflow routed for: "${userMessage.slice(0, 50)}..."`;
    const evaluationResult = { score: 0, feedback: '' };
    const allSkills = [...new Set(skills)];
    const workflowLevel = typeof body.workflowLevel === 'string'
      ? body.workflowLevel
      : 'L3';

    const comparisonPayload = comparisonEnabled
      ? {
          enabled: true,
          primary: {
            model: comparison.primaryModel ?? 'primary',
            content: responseContent,
          },
          control: {
            model: comparison.controlModel ?? 'control',
            content: responseContent,
          },
        }
      : null;

    return jsonResponse(withContract({
      content: responseContent,
      skills_used: allSkills.slice(0, 5),
      comparison: comparisonPayload,
      writer_metadata: null,
      workflow_info: {
        level: workflowLevel,
        level_slug: 'standard',
        scene_type: 'general',
        steps_completed: 1,
        total_steps: 1,
      },
      workflow_level: workflowLevel,
      workflow_level_slug: 'standard',
      evaluation: evaluationResult,
    }));
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

export async function chatStreamEndpoint(request: HttpRequest): Promise<HttpResponse> {
  try {
    const body = (parseBody(request) ?? {}) as ChatBody;
    const messages = body.messages ?? [];

    const limitError = validateChatMessagesLimits(messages);
    if (limitError) return limitError;

    if (!messages.length) {
      return jsonResponse({ error: 'No messages provided' }, 400);
    }

    const userMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user')?.content ?? '';

    if (!userMessage) {
      return jsonResponse({ error: 'No user message found' }, 400);
    }

    // SSE streaming: return events array for caller to iterate
    // In real usage, caller will use the event generator pattern
    const events: StreamEvent[] = [
      {
        event: 'start',
        data: withContract({
          status: 'started',
          diagnostics: { fallback_reason: null, failure_reason: null, error_type: null },
        }),
      },
      {
        event: 'routing',
        data: { level: 'L3', level_slug: 'standard', scene_type: 'general', skills: [] },
      },
      {
        event: 'progress',
        data: { step: 1, total: 4, message: 'Preparing writing environment...' },
      },
      {
        event: 'content',
        data: { chunk: `[Streaming placeholder for: "${userMessage.slice(0, 50)}..."]`, index: 0 },
      },
      {
        event: 'progress',
        data: { step: 4, total: 4, message: 'Complete' },
      },
      {
        event: 'done',
        data: withTerminalContract({
          status: 'completed',
          terminal: 'done',
          decision: 'go',
          skills_used: [],
          diagnostics: { fallback_reason: null, failure_reason: null, error_type: null },
          workflow_level: 'L3',
          workflow_level_slug: 'standard',
        }),
      },
    ];

    return jsonResponse({
      streaming: true,
      events,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
