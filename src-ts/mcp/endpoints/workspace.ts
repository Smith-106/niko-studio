import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  normalizeProjectWorkspaceContext,
  summarizeProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import { safeResolveWorkspaceRoot, tryResolveWorkspaceRoot } from '../input-validation.js';

function resolveWorkspaceRoot(): string | HttpResponse {
  const result = tryResolveWorkspaceRoot();
  return result.ok ? result.value : result.error;
}

export async function workspaceContextEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown> | null;
  const workspaceRoot = resolveWorkspaceRoot();
  if (typeof workspaceRoot !== 'string') return workspaceRoot;
  const workspace = normalizeProjectWorkspaceContext(body ?? {}, {
    workspaceRoot,
  });

  return jsonResponse({
    workspace,
    summary: summarizeProjectWorkspaceContext(workspace),
    compatibility: workspace.compatibility,
  });
}
