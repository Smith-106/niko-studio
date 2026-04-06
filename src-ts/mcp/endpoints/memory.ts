/**
 * Memory REST Endpoints
 *
 * Memory-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/memory.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { memorySearch, memoryAdd, memoryGetTemporal } from '../services/memory';
import { DocumentLoader } from '../../services/document-loader';
import { recursiveCharacterSplit } from '../../ui/file-utils';

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
