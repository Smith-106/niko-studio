/**
 * M10 Revision Endpoint — Multi-pass revision with Critic-driven loop
 *
 * Activated: replaces the placeholder with full IRevisionService integration.
 * Backward-compatible: same route, same request shape, enriched response.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';
import { RevisionServiceImpl } from '../../services/revision-service.js';
import type { IRevisionService, RevisionCycleResult } from '../../protocols/revision.js';

const log = createLogger('m10-revision');

let revisionService: IRevisionService | null = null;

function getRevisionService(): IRevisionService {
  if (!revisionService) {
    revisionService = new RevisionServiceImpl();
  }
  return revisionService;
}

interface MultiPassRequest {
  text: string;
  target_score?: number;
  max_iterations?: number;
  chapter_id?: string;
  workspace?: Record<string, unknown>;
}

export async function reviseMultiPassEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as MultiPassRequest;
  const text = body.text ?? '';
  const targetScore = body.target_score ?? 8.0;
  const maxIterations = body.max_iterations ?? 5;
  const chapterId = body.chapter_id ?? '';

  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  log.info(`Multi-pass revision: target=${targetScore}, max_iter=${maxIterations}, text_len=${text.length}`);

  try {
    const service = getRevisionService();
    const result: RevisionCycleResult = await service.revise(text, {
      max_revisions: maxIterations,
      pass_score: targetScore,
    }, chapterId || undefined);

    return jsonResponse({
      completed: result.finalDecision === 'APPROVED' || result.finalDecision === 'HUMAN_REVIEW',
      revisedContent: result.finalDraft,
      iterations: result.totalIterations,
      initialScore: result.iterations.length > 0 ? result.iterations[0]!.weakPoints[0]?.baselineScore ?? 0 : 0,
      finalScore: result.finalScore,
      finalDecision: result.finalDecision,
      learningInsights: result.learningInsights,
      comparison: result.comparison,
      reason: result.finalDecision === 'APPROVED'
        ? 'quality_threshold_met'
        : result.finalDecision === 'HUMAN_REVIEW'
          ? 'human_review_required'
          : 'max_iterations_reached',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Multi-pass revision failed: ${message}`);
    return jsonResponse({
      error: `Revision failed: ${message}`,
    }, 500);
  }
}