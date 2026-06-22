import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  listProjectWikiCanonPages,
  promoteProjectWikiCanon,
  readProjectWikiCanonPage,
} from '../services/wiki.js';
import {
  normalizeProjectWorkspaceContext,
  type ProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import { safeResolveWorkspaceRoot, tryResolveWorkspaceRoot } from '../input-validation.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveWorkspaceRoot(): string | HttpResponse {
  const result = tryResolveWorkspaceRoot();
  return result.ok ? result.value : result.error;
}

function resolveWorkspace(body: Record<string, unknown>): ProjectWorkspaceContext | HttpResponse {
  const workspaceRoot = resolveWorkspaceRoot();
  if (typeof workspaceRoot !== 'string') return workspaceRoot;
  return normalizeProjectWorkspaceContext(body, {
    workspaceRoot,
  });
}

function resolveRawEvidence(body: Record<string, unknown>) {
  const rawEvidence = asRecord(body.raw_evidence ?? body.rawEvidence);
  if (!rawEvidence) return undefined;

  return {
    relativePath: readString(rawEvidence.relative_path) ?? readString(rawEvidence.relativePath) ?? undefined,
    content: readString(rawEvidence.content) ?? undefined,
  };
}

export async function wikiPromoteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in (workspace as unknown as Record<string, unknown>)) return workspace as HttpResponse;
  const result = await promoteProjectWikiCanon({
    workspace: workspace as ProjectWorkspaceContext,
    title: (body.title as string) ?? '',
    body: (body.body as string) ?? '',
    slug: readString(body.slug) ?? undefined,
    idSeed: readString(body.id_seed) ?? readString(body.idSeed) ?? undefined,
    promotedFrom:
      (readString(body.promoted_from) ?? readString(body.promotedFrom)) as
        | 'story-bible'
        | 'chat'
        | 'research'
        | 'manual'
        | undefined,
    sourceId: readString(body.source_id) ?? readString(body.sourceId) ?? undefined,
    sourceRef: readString(body.source_ref) ?? readString(body.sourceRef) ?? undefined,
    status: (readString(body.status) as 'curated' | 'draft' | null) ?? undefined,
    rawEvidence: resolveRawEvidence(body),
    metadata: asRecord(body.metadata) ?? undefined,
  });
  return jsonResponse({ ...result, workspace });
}

export async function wikiListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in (workspace as unknown as Record<string, unknown>)) return workspace as HttpResponse;
  const result = await listProjectWikiCanonPages({
    workspace: workspace as ProjectWorkspaceContext,
    status: (readString(body.status) as 'curated' | 'draft' | null) ?? undefined,
    limit: typeof body.limit === 'number' ? body.limit : undefined,
  });
  return jsonResponse({ ...result, workspace });
}

export async function wikiReadPageEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in (workspace as unknown as Record<string, unknown>)) return workspace as HttpResponse;
  const result = await readProjectWikiCanonPage({
    workspace: workspace as ProjectWorkspaceContext,
    slug: (body.slug as string) ?? '',
  });
  return jsonResponse({ ...result, workspace });
}
