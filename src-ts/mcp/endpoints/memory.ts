/**
 * Memory REST Endpoints
 *
 * Memory-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/memory.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { memorySearch, memoryAdd, memoryGetTemporal } from '../services/memory';
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToMemoryScope,
} from '../../project/workspace-model.js';
import { DocumentLoadError, DocumentLoader } from '../../services/document-loader';
import { recursiveCharacterSplit } from '../../ui/file-utils';
import { safeResolveWorkspaceRoot } from '../input-validation.js';

function resolveWorkspaceRoot(): string {
  return safeResolveWorkspaceRoot();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function shouldUseFocusEntity(body: Record<string, unknown>): boolean {
  return body.use_focus_entity === true;
}

function resolveMemoryScope(
  body: Record<string, unknown>,
  options: { includeFocusEntity?: boolean } = {},
) {
  const workspace = normalizeProjectWorkspaceContext(body, {
    workspaceRoot: resolveWorkspaceRoot(),
  });
  return projectWorkspaceToMemoryScope(workspace, {
    includeFocusEntity: options.includeFocusEntity,
  });
}

/** POST /memory/search */
export async function memorySearchEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const explicitEntityId = readOptionalString(body.entity_id);
  const scope = resolveMemoryScope(body, {
    includeFocusEntity: explicitEntityId === undefined && shouldUseFocusEntity(body),
  });
  const result = await memorySearch({
    query: (body.query as string) ?? '',
    layer: body.layer as string | undefined,
    dimensions: body.dimensions as string[] | undefined,
    entityId: explicitEntityId ?? scope.entityId,
    userId: readOptionalString(body.user_id),
    projectId: readOptionalString(body.project_id) ?? scope.projectId,
    sessionId: readOptionalString(body.session_id) ?? scope.sessionId,
    atTime: readOptionalString(body.at_time),
    limit: (body.limit as number) ?? 10,
  });
  return jsonResponse(result);
}

/** POST /memory/add */
export async function memoryAddEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const explicitEntityId = readOptionalString(body.entity_id);
  const scope = resolveMemoryScope(body, {
    includeFocusEntity: explicitEntityId === undefined && shouldUseFocusEntity(body),
  });
  const result = await memoryAdd({
    content: (body.content as string) ?? '',
    layer: (body.layer as string) ?? 'session',
    dimension: body.dimension as string | undefined,
    entityId: explicitEntityId ?? scope.entityId,
    validFrom: readOptionalString(body.valid_from),
    validUntil: readOptionalString(body.valid_until),
    userId: readOptionalString(body.user_id),
    projectId: readOptionalString(body.project_id) ?? scope.projectId,
    sessionId: readOptionalString(body.session_id) ?? scope.sessionId,
    importance: (body.importance as number) ?? 0.5,
    tags: (body.tags as string[]) ?? [],
    source: readOptionalString(body.source),
    confidence: body.confidence as number | undefined,
  });
  return jsonResponse(result);
}

/** POST /memory/upload - uploads and chunks file content */
export async function memoryUploadEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveMemoryScope(body);

  const fileName = readOptionalString(body.file_name);
  const fileContentBase64 = readOptionalString(body.file_content_base64);
  const sessionId = readOptionalString(body.session_id) ?? scope.sessionId;
  const chunkSizeRaw = body.chunk_size as number | undefined;
  const chunkOverlapRaw = body.chunk_overlap as number | undefined;

  if (!fileName || !fileName.trim()) {
    return jsonResponse({ error: 'file_name is required' }, 400);
  }
  if (!fileContentBase64 || !fileContentBase64.trim()) {
    return jsonResponse({ error: 'file_content_base64 is required' }, 400);
  }
  if (!sessionId || !sessionId.trim()) {
    return jsonResponse({ error: 'session_id is required' }, 400);
  }

  let fileBuffer: Buffer;
  try {
    const normalized = fileContentBase64.includes(',')
      ? fileContentBase64.split(',', 2)[1]
      : fileContentBase64;
    const compact = normalized.replace(/\s+/g, '');
    const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (!compact || compact.length % 4 !== 0 || !base64Pattern.test(compact)) {
      return jsonResponse({ error: 'invalid file_content_base64' }, 400);
    }
    fileBuffer = Buffer.from(normalized, 'base64');
    if (fileBuffer.length === 0) {
      return jsonResponse({ error: 'invalid file_content_base64' }, 400);
    }
    if (Buffer.from(fileBuffer.toString('base64'), 'base64').length !== fileBuffer.length) {
      return jsonResponse({ error: 'invalid file_content_base64' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'invalid file_content_base64' }, 400);
  }

  let text: string;
  try {
    text = await DocumentLoader.loadFileAsync(fileBuffer, fileName);
  } catch (error) {
    if (error instanceof DocumentLoadError) {
      return jsonResponse(error.toResponseBody(fileName), 400);
    }
    return jsonResponse({ error: `failed to parse file: ${String(error)}` }, 400);
  }

  if (!text.trim()) {
    return jsonResponse({ error: 'file contains no readable text' }, 400);
  }

  let chunkSize = Number.isFinite(chunkSizeRaw) ? Math.trunc(chunkSizeRaw as number) : 1000;
  let chunkOverlap = Number.isFinite(chunkOverlapRaw) ? Math.trunc(chunkOverlapRaw as number) : 200;
  if (chunkSize <= 0) chunkSize = 1000;
  if (chunkOverlap < 0) chunkOverlap = 0;
  if (chunkOverlap >= chunkSize) {
    chunkOverlap = Math.floor(chunkSize / 5);
  }

  const chunks = recursiveCharacterSplit(text, chunkSize, chunkOverlap);
  if (!chunks.length) {
    return jsonResponse({ error: 'file contains no indexable chunks' }, 400);
  }

  const safeFilename = fileName
    .split('')
    .filter((char) => /[a-zA-Z0-9._ -]/.test(char))
    .join('')
    .trim()
    .replace(/\s+/g, '_') || 'uploaded_file';

  const memoryIds: string[] = [];
  const source = body.source as string | undefined;
  const confidence = body.confidence as number | undefined;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunkContent = chunks[index].trim();
    if (!chunkContent) continue;
    const chunkId = `${sessionId}_${safeFilename}_part_${index}`;
    const result = await memoryAdd({
      content: chunkContent,
      layer: 'session',
      dimension: 'context',
      entityId: sessionId,
      importance: 0.6,
      tags: ['uploaded_material', `filename:${safeFilename}`, `session:${sessionId}`, `chunk:${index}`, `chunk_id:${chunkId}`],
      source,
      confidence,
    });

    if (result && typeof result === 'object' && typeof result['id'] === 'string') {
      memoryIds.push(result['id']);
    }
  }

  if (!memoryIds.length) {
    return jsonResponse({ error: 'failed to inject any file chunks' }, 500);
  }

  return jsonResponse({
    status: 'created',
    file_name: fileName,
    session_id: sessionId,
    chunks: memoryIds.length,
    memory_ids: memoryIds,
  });
}

/** POST /memory/temporal */
export async function memoryTemporalEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveMemoryScope(body);
  const entityId = readOptionalString(body.entity_id) ?? '';
  const result = await memoryGetTemporal(
    entityId,
    readOptionalString(body.at_time),
    {
      userId: readOptionalString(body.user_id),
      projectId: readOptionalString(body.project_id) ?? scope.projectId,
      sessionId: readOptionalString(body.session_id) ?? scope.sessionId,
    }
  );
  return jsonResponse(result);
}
