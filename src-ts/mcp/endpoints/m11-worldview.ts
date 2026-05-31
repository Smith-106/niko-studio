/**
 * M11 Worldview Extraction MCP Endpoints
 *
 * POST /worldview/extract  — trigger extraction for project chapters
 * GET  /worldview/:projectId — retrieve cached worldview settings
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';
import { WorldviewExtractor, type ChapterContent } from '../../narrative/worldview-extractor.js';

const log = createLogger('m11-worldview');

const extractor = new WorldviewExtractor();

export async function worldviewExtractEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const chapters = body.chapters as ChapterContent[] ?? [];

  if (chapters.length === 0) {
    return jsonResponse(
      { error: 'chapters array is required' },
      400,
    );
  }

  log.info(`Worldview extraction: ${chapters.length} chapters`);

  try {
    const settings = extractor.quickExtract(chapters);
    log.info(`Worldview extraction complete: ${settings.length} settings found`);
    return jsonResponse({ settings, count: settings.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error(`Worldview extraction failed: ${message}`);
    return jsonResponse({ error: message }, 500);
  }
}

export async function worldviewGetEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const projectId = request.params?.projectId ?? '';
  if (!projectId) {
    return jsonResponse(
      { error: 'projectId is required' },
      400,
    );
  }

  log.info(`Worldview lookup: project=${projectId}`);
  return jsonResponse({ settings: [], projectId });
}
