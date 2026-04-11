/**
 * Chat REST Endpoints
 *
 * Chat-related HTTP endpoints for Desktop frontend, including SSE streaming.
 * Ported from src/mcp/endpoints/chat.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { WorkflowEngine as WorkflowEngineRuntime } from '../../workflow/workflow-engine.js';
import { toWorkflowLabel, toWorkflowSlug } from '../../workflow/types.js';
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
} from '../../project/workspace-model.js';
import {
  queryProjectWikiCanon,
  type ProjectWikiQueryAuthorityMetadata,
} from '../../project/wiki-query.js';

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const MAX_MESSAGES = 128;
const MAX_MESSAGE_CHARS = 24_000;
const MAX_TOTAL_CHARS = 120_000;

const DEFAULT_DIAGNOSTICS = {
  fallback_reason: null,
  failure_reason: null,
  error_type: null,
} as const;

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

    if (sentenceEndings.test(part)) {
      currentChunk += part;
      continue;
    }

    if (currentChunk.length + part.length > maxChunkSize) {
      if (currentChunk && currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else if (currentChunk) {
        currentChunk += part;
      } else {
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

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatBody {
  messages?: ChatMessage[];
  workflowLevel?: string | number;
  skills?: string[];
  context?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
  allowLlmFallback?: boolean;
  comparison?: {
    enabled?: boolean;
    controlModel?: string;
    primaryModel?: string;
  };
}

interface ChatCanonContextMatch {
  page_id: string;
  slug: string;
  title: string;
  score: number;
  excerpt: string;
  authority: ProjectWikiQueryAuthorityMetadata;
}

interface ChatCanonContextPayload {
  available: boolean;
  reason: string | null;
  total_pages: number;
  match_count: number;
  injected: boolean;
  matches: ChatCanonContextMatch[];
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function resolveWorkflowWorkspace(): string {
  const override = String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim();
  return override || process.cwd();
}

function createWorkflowEngine(sessionNamespace: string): WorkflowEngineRuntime {
  return new WorkflowEngineRuntime(resolveWorkflowWorkspace(), sessionNamespace);
}

function resolveWorkspaceContext(body: ChatBody) {
  return normalizeProjectWorkspaceContext(body as Record<string, unknown>, {
    workspaceRoot: resolveWorkflowWorkspace(),
  });
}

function getLatestUserMessage(messages: ChatMessage[]): string {
  return [...messages]
    .reverse()
    .find((m) => m.role === 'user')?.content ?? '';
}

function resolveWorkflowLevel(rawLevel: unknown, routedLevel?: unknown): string {
  const candidate = rawLevel ?? routedLevel ?? 'L3';
  try {
    return toWorkflowLabel(candidate as string | number);
  } catch {
    return 'L3';
  }
}

function serializeValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const serialized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      serialized[key] = serializeValue(entry);
    }
    return serialized;
  }
  return String(value);
}

function extractPrimaryContent(value: unknown): string {
  const record = asRecord(value);
  if (!record) return '';

  for (const key of ['final_output', 'draft_content', 'content', 'processed_text']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  for (const nestedKey of ['result', 'last_step', 'final_status']) {
    const nestedContent = extractPrimaryContent(record[nestedKey]);
    if (nestedContent) return nestedContent;
  }

  return '';
}

function extractEvaluation(value: unknown): { score: number; feedback: string } | null {
  const record = asRecord(value);
  if (!record) return null;

  const directScore = typeof record['score'] === 'number' ? Number(record['score']) : null;
  const directFeedback = ['feedback_context', 'decision_reason', 'feedback', 'actionable_feedback']
    .map((key) => record[key])
    .find((entry) => typeof entry === 'string' && entry.trim()) as string | undefined;

  if (directScore !== null || directFeedback) {
    return {
      score: directScore ?? 0,
      feedback: directFeedback ?? '',
    };
  }

  for (const nestedKey of ['evaluation', 'result', 'last_step', 'final_status']) {
    const nested = extractEvaluation(record[nestedKey]);
    if (nested) return nested;
  }

  return null;
}

function buildComparisonPayload(
  comparison: ChatBody['comparison'],
  responseContent: string
): Record<string, unknown> | null {
  if (!comparison?.enabled) return null;
  return {
    enabled: true,
    primary: {
      model: comparison.primaryModel ?? 'primary',
      content: responseContent,
    },
    control: {
      model: comparison.controlModel ?? 'control',
      content: responseContent,
    },
  };
}

function buildWriterMetadata(
  workspace: ReturnType<typeof resolveWorkspaceContext>,
  canonContext: ChatCanonContextPayload,
): Record<string, unknown> {
  return {
    workspace_context: workspace,
    canon_context: canonContext,
  };
}

function buildChatCanonPrompt(
  userMessage: string,
  matches: ChatCanonContextMatch[],
): string {
  if (matches.length === 0) return userMessage;

  return [
    '## Workspace Canon Context',
    'Use the following canon excerpts as authoritative workspace knowledge when relevant.',
    ...matches.map((match, index) => (
      `${index + 1}. ${match.title} [${match.slug}] score=${match.score}\n${match.excerpt}`
    )),
    '',
    '## User Request',
    userMessage,
  ].join('\n');
}

function buildChatCanonAppendix(matches: ChatCanonContextMatch[]): string {
  if (matches.length === 0) return '';

  return [
    '## Canon Context',
    ...matches.map((match, index) => (
      `${index + 1}. ${match.title} [${match.slug}]\n${match.excerpt}`
    )),
  ].join('\n');
}

async function resolveChatCanonContext(
  workspace: ReturnType<typeof resolveWorkspaceContext>,
  userMessage: string,
): Promise<{ prompt: string; metadata: ChatCanonContextPayload }> {
  try {
    const result = await queryProjectWikiCanon(workspace, userMessage, {
      limit: 3,
      excerptLength: 160,
    });
    const matches = result.available
      ? result.matches.map((match) => ({
          page_id: match.pageId,
          slug: match.slug,
          title: match.title,
          score: match.score,
          excerpt: match.excerpt,
          authority: match.authority,
        }))
      : [];
    const injected = matches.length > 0;

    return {
      prompt: injected ? buildChatCanonPrompt(userMessage, matches) : userMessage,
      metadata: {
        available: result.available,
        reason: result.available ? null : result.reason,
        total_pages: result.totalPages,
        match_count: matches.length,
        injected,
        matches,
      },
    };
  } catch {
    return {
      prompt: userMessage,
      metadata: {
        available: false,
        reason: 'query-error',
        total_pages: 0,
        match_count: 0,
        injected: false,
        matches: [],
      },
    };
  }
}

function formatSseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(serializeValue(data))}\n\n`;
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

    const userMessage = getLatestUserMessage(messages);
    if (!userMessage) {
      return jsonResponse({ error: 'No user message found' }, 400);
    }

    const skills = body.skills ?? [];
    const workspace = resolveWorkspaceContext(body);
    const canonContext = await resolveChatCanonContext(workspace, userMessage);
    const engine = createWorkflowEngine('mcp-chat');
    const routed = await engine.route(userMessage);
    const workflowLevel = resolveWorkflowLevel(body.workflowLevel, routed['level']);
    const workflowLevelSlug = toWorkflowSlug(workflowLevel);
    const runResult = await engine.runWithExecutionContext(
      userMessage,
      canonContext.metadata.injected ? { chat_canon_prompt: canonContext.prompt } : undefined,
      workflowLevel,
      undefined,
    );

    if ('error' in runResult) {
      return jsonResponse({ error: String(runResult['error']) }, 500);
    }

    const responseContent =
      extractPrimaryContent(runResult) ||
      `Workflow completed for: "${userMessage.slice(0, 50)}..."`;
    const canonAppendix = canonContext.metadata.injected ? buildChatCanonAppendix(canonContext.metadata.matches) : '';
    const finalContent = canonAppendix ? `${responseContent}\n\n${canonAppendix}` : responseContent;
    const evaluationResult = extractEvaluation(runResult) ?? { score: 0, feedback: '' };
    const comparisonPayload = buildComparisonPayload(body.comparison, finalContent);
    const planRecord = asRecord(runResult['plan']);
    const totalSteps =
      typeof planRecord?.['total_steps'] === 'number'
        ? Number(planRecord['total_steps'])
        : Array.isArray(planRecord?.['steps'])
          ? planRecord['steps'].length
          : 1;

    return jsonResponse(withContract({
      content: finalContent,
      skills_used: skills.slice(0, 5),
      comparison: comparisonPayload,
      writer_metadata: buildWriterMetadata(workspace, canonContext.metadata),
      workflow_info: {
        level: workflowLevel,
        level_slug: workflowLevelSlug,
        scene_type: 'general',
        steps_completed: totalSteps,
        total_steps: totalSteps,
      },
      workflow_level: workflowLevel,
      workflow_level_slug: workflowLevelSlug,
      evaluation: evaluationResult,
      context: projectWorkspaceToLegacyChatContext(workspace),
      workspace,
    }));
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
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

    const userMessage = getLatestUserMessage(messages);
    if (!userMessage) {
      return jsonResponse({ error: 'No user message found' }, 400);
    }

    const skills = body.skills ?? [];
    const workspace = resolveWorkspaceContext(body);
    const canonContext = await resolveChatCanonContext(workspace, userMessage);
    const engine = createWorkflowEngine('mcp-chat-stream');
    const routed = await engine.route(userMessage);
    const workflowLevel = resolveWorkflowLevel(body.workflowLevel, routed['level']);
    const workflowLevelSlug = toWorkflowSlug(workflowLevel);

    let totalSteps = 4;
    let progressStep = 1;
    let contentIndex = 0;
    let lastContent = '';
    const sseEvents: string[] = [];

    sseEvents.push(formatSseEvent('start', withContract({
      status: 'started',
      diagnostics: { ...DEFAULT_DIAGNOSTICS },
    })));
    sseEvents.push(formatSseEvent('routing', {
      level: workflowLevel,
      level_slug: workflowLevelSlug,
      scene_type: 'general',
      skills: skills.slice(0, 5),
    }));

    for await (const workflowEvent of engine.runStreamWithExecutionContext(
      userMessage,
      canonContext.metadata.injected ? { chat_canon_prompt: canonContext.prompt } : undefined,
      workflowLevel,
      undefined,
    )) {
      const eventRecord = asRecord(workflowEvent) ?? {};
      const eventType = String(eventRecord['type'] ?? 'unknown');

      if (eventType === 'plan_created') {
        const plan = asRecord(eventRecord['plan']);
        if (typeof plan?.['total_steps'] === 'number') {
          totalSteps = Math.max(Number(plan['total_steps']), 1);
        }
        sseEvents.push(formatSseEvent('progress', {
          step: Math.min(progressStep, totalSteps),
          total: totalSteps,
          message: 'Plan created',
        }));
        continue;
      }

      if (eventType === 'step_start') {
        sseEvents.push(formatSseEvent('progress', {
          step: Math.min(progressStep, totalSteps),
          total: totalSteps,
          message: `Starting step: ${String(eventRecord['step_name'] ?? 'unknown')}`,
        }));
        continue;
      }

      if (eventType === 'step_complete') {
        progressStep += 1;
        const content = extractPrimaryContent(eventRecord);
        if (content && content !== lastContent) {
          lastContent = content;
          for (const chunk of adaptiveChunkContent(content, 500, 50)) {
            sseEvents.push(formatSseEvent('content', { chunk, index: contentIndex++ }));
          }
        }

        const evaluation = extractEvaluation(eventRecord);
        if (evaluation) {
          sseEvents.push(formatSseEvent('evaluation', evaluation));
        }
        continue;
      }

      if (eventType === 'plan_blocked') {
        sseEvents.push(formatSseEvent('done', withTerminalContract({
          status: String(eventRecord['status'] ?? 'blocked'),
          terminal: 'done',
          decision: 'no_go',
          skills_used: skills.slice(0, 5),
          diagnostics: {
            ...DEFAULT_DIAGNOSTICS,
            failure_reason: String(eventRecord['status'] ?? 'blocked'),
          },
          workflow_level: workflowLevel,
          workflow_level_slug: workflowLevelSlug,
          writer_metadata: buildWriterMetadata(workspace, canonContext.metadata),
          workspace,
        })));
        return {
          statusCode: 200,
          body: sseEvents.join(''),
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        };
      }

      if (eventType === 'plan_error' || eventType === 'error') {
        sseEvents.push(formatSseEvent('error', withTerminalContract({
          status: 'failed',
          terminal: 'error',
          error: String(eventRecord['error'] ?? 'Stream error'),
          diagnostics: {
            ...DEFAULT_DIAGNOSTICS,
            failure_reason: String(eventRecord['error'] ?? 'Stream error'),
          },
          writer_metadata: buildWriterMetadata(workspace, canonContext.metadata),
          workspace,
        })));
        return {
          statusCode: 200,
          body: sseEvents.join(''),
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        };
      }

      if (eventType === 'plan_complete') {
        const content = extractPrimaryContent(eventRecord);
        if (content && content !== lastContent) {
          lastContent = content;
          for (const chunk of adaptiveChunkContent(content, 500, 50)) {
            sseEvents.push(formatSseEvent('content', { chunk, index: contentIndex++ }));
          }
        }

        if (contentIndex === 0) {
          const fallbackContent =
            `Workflow ${workflowLevel} completed for request: ${userMessage.slice(0, 200)}`;
          lastContent = fallbackContent;
          for (const chunk of adaptiveChunkContent(fallbackContent, 500, 50)) {
            sseEvents.push(formatSseEvent('content', { chunk, index: contentIndex++ }));
          }
        }

        if (canonContext.metadata.injected) {
          const canonAppendix = buildChatCanonAppendix(canonContext.metadata.matches);
          for (const chunk of adaptiveChunkContent(canonAppendix, 500, 50)) {
            sseEvents.push(formatSseEvent('content', { chunk, index: contentIndex++ }));
          }
        }

        const evaluation = extractEvaluation(eventRecord);
        if (evaluation) {
          sseEvents.push(formatSseEvent('evaluation', evaluation));
        }

        sseEvents.push(formatSseEvent('progress', {
          step: totalSteps,
          total: totalSteps,
          message: 'Complete',
        }));
        sseEvents.push(formatSseEvent('done', withTerminalContract({
          status: 'completed',
          terminal: 'done',
          decision: 'go',
          skills_used: skills.slice(0, 5),
          diagnostics: { ...DEFAULT_DIAGNOSTICS },
          workflow_level: workflowLevel,
          workflow_level_slug: workflowLevelSlug,
          writer_metadata: buildWriterMetadata(workspace, canonContext.metadata),
          workspace,
        })));
      }
    }

    return {
      statusCode: 200,
      body: sseEvents.join(''),
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    };
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
