/**
 * Learning MCP Endpoints — CAP-001/002/003
 *
 * HTTP handlers for import learning, self-evolving writing, and reading learning pipelines.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';
import {
  LearningCapability,
  type PipelineInput,
  type ReadingSession,
  type FeedbackEvidence,
} from '../../learning/learning-types';

const log = createLogger('learning');

// --- CAP-001: Import Learning ---

export async function learningImportEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const content = body.content as string ?? '';
  const sourceType = body.sourceType as string ?? 'document';
  const sourceName = body.sourceName as string ?? 'unknown';

  if (!content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400);
  }

  log.info(`Import learning: source=${sourceName}, type=${sourceType}, len=${content.length}`);

  const input: PipelineInput = {
    content,
    metadata: { sourceType, sourceName },
  };

  return jsonResponse({
    message: 'Import learning pipeline triggered',
    sourceName,
    sourceType,
    contentLength: content.length,
    input,
  });
}

// --- CAP-002: Self-Evolving Writing ---

export async function learningStyleFeedbackEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const dimension = body.dimension as string ?? '';
  const action = body.action as FeedbackEvidence['action'] ?? 'accept';
  const value = body.value as number ?? 0.5;
  const source = body.source as string ?? 'manual';

  if (!dimension) {
    return jsonResponse({ error: 'dimension is required' }, 400);
  }

  if (!['accept', 'reject', 'modify'].includes(action)) {
    return jsonResponse({ error: 'action must be accept, reject, or modify' }, 400);
  }

  log.info(`Style feedback: dimension=${dimension}, action=${action}, value=${value}`);

  const evidence: FeedbackEvidence = {
    dimension,
    action,
    value,
    timestamp: new Date().toISOString(),
    source,
  };

  return jsonResponse({
    message: 'Feedback recorded',
    evidence,
  });
}

export async function learningStyleDriftEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const dimensions = body.dimensions as Record<string, number> ?? {};

  if (Object.keys(dimensions).length === 0) {
    return jsonResponse({ error: 'dimensions object is required' }, 400);
  }

  log.info(`Style drift check: dims=${Object.keys(dimensions).length}`);

  return jsonResponse({
    message: 'Style drift detection triggered',
    dimensionCount: Object.keys(dimensions).length,
  });
}

export async function learningRulesEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  log.info('Style rules query');

  return jsonResponse({
    message: 'Active style rules',
    rules: [],
  });
}

// --- CAP-003: Reading Learning ---

export async function learningReadingSessionEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const bookId = body.bookId as string ?? '';
  const currentChapter = body.currentChapter as number ?? 0;
  const totalChapters = body.totalChapters as number ?? 0;

  if (!bookId) {
    return jsonResponse({ error: 'bookId is required' }, 400);
  }

  if (totalChapters <= 0) {
    return jsonResponse({ error: 'totalChapters must be > 0' }, 400);
  }

  log.info(`Reading session: book=${bookId}, chapter=${currentChapter}/${totalChapters}`);

  const session: ReadingSession = {
    bookId,
    currentChapter,
    totalChapters,
    lastPosition: '',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return jsonResponse({
    message: 'Reading session updated',
    session,
  });
}

export async function learningReadingExtractEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const content = body.content as string ?? '';
  const bookId = body.bookId as string ?? 'unknown';
  const currentChapter = body.currentChapter as number ?? 0;
  const totalChapters = body.totalChapters as number ?? 0;

  if (!content.trim()) {
    return jsonResponse({ error: 'content is required' }, 400);
  }

  log.info(`Reading extract: book=${bookId}, len=${content.length}`);

  const input: PipelineInput = {
    content,
    metadata: {
      bookId,
      session: {
        bookId,
        currentChapter,
        totalChapters,
        lastPosition: '',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies ReadingSession,
    },
  };

  return jsonResponse({
    message: 'Reading extraction pipeline triggered',
    bookId,
    contentLength: content.length,
    input,
  });
}

// --- Pipeline Status ---

export async function learningStatusEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  log.info('Learning status query');

  return jsonResponse({
    capabilities: [
      { id: LearningCapability.IMPORT, enabled: true },
      { id: LearningCapability.SELF_EVOLVING, enabled: true },
      { id: LearningCapability.READING, enabled: true },
    ],
  });
}
