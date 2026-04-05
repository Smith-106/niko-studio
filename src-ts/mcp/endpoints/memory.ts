/**
 * Memory REST Endpoints
 *
 * Memory-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/memory.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { memorySearch, memoryAdd, memoryGetTemporal } from '../services/memory';

/** POST /memory/search */
export async function memorySearchEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await memorySearch({
    query: (body.query as string) ?? '',
    layer: body.layer as string | undefined,
    dimensions: body.dimensions as string[] | undefined,
    entityId: body.entity_id as string | undefined,
    userId: body.user_id as string | undefined,
    projectId: body.project_id as string | undefined,
    sessionId: body.session_id as string | undefined,
    atTime: body.at_time as string | undefined,
    limit: (body.limit as number) ?? 10,
  });
  return jsonResponse(result);
}

/** POST /memory/add */
export async function memoryAddEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await memoryAdd({
    content: (body.content as string) ?? '',
    layer: (body.layer as string) ?? 'session',
    dimension: body.dimension as string | undefined,
    entityId: body.entity_id as string | undefined,
    validFrom: body.valid_from as string | undefined,
    validUntil: body.valid_until as string | undefined,
    userId: body.user_id as string | undefined,
    projectId: body.project_id as string | undefined,
    sessionId: body.session_id as string | undefined,
    importance: (body.importance as number) ?? 0.5,
    tags: (body.tags as string[]) ?? [],
    source: body.source as string | undefined,
    confidence: body.confidence as number | undefined,
  });
  return jsonResponse(result);
}

/** POST /memory/upload - uploads and chunks file content */
export async function memoryUploadEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const fileName = body.file_name as string | undefined;
  const fileContentBase64 = body.file_content_base64 as string | undefined;
  const sessionId = body.session_id as string | undefined;

  if (!fileName || !fileName.trim()) {
    return jsonResponse({ error: 'file_name is required' }, 400);
  }
  if (!fileContentBase64 || !fileContentBase64.trim()) {
    return jsonResponse({ error: 'file_content_base64 is required' }, 400);
  }
  if (!sessionId || !sessionId.trim()) {
    return jsonResponse({ error: 'session_id is required' }, 400);
  }

  // Placeholder: full implementation requires DocumentLoader + text splitter
  // For now, return a stub response indicating the upload endpoint is available
  return jsonResponse({
    status: 'created',
    file_name: fileName,
    session_id: sessionId,
    chunks: 0,
    memory_ids: [],
    note: 'Upload endpoint wired; document parsing not yet implemented',
  });
}

/** POST /memory/temporal */
export async function memoryTemporalEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await memoryGetTemporal(
    (body.entity_id as string) ?? '',
    body.at_time as string | undefined,
    {
      userId: body.user_id as string | undefined,
      projectId: body.project_id as string | undefined,
      sessionId: body.session_id as string | undefined,
    }
  );
  return jsonResponse(result);
}
