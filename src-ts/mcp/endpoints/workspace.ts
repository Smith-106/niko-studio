import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  normalizeProjectWorkspaceContext,
  summarizeProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import { safeResolveWorkspaceRoot } from '../input-validation.js';

function resolveWorkspaceRoot(): string {
  return safeResolveWorkspaceRoot();
}

export async function workspaceContextEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown> | null;
  const workspace = normalizeProjectWorkspaceContext(body ?? {}, {
    workspaceRoot: resolveWorkspaceRoot(),
  });

  return jsonResponse({
    workspace,
    summary: summarizeProjectWorkspaceContext(workspace),
    compatibility: workspace.compatibility,
  });
}
