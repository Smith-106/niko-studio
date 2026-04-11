import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  listProjectWikiCanonPages,
  promoteProjectWikiCanon,
  readProjectWikiCanonPage,
} from '../services/wiki.js';
import {
  normalizeProjectWorkspaceContext,
} from '../../project/workspace-model.js';

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

function resolveWorkspaceRoot(): string {
  return String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim() || process.cwd();
}

function resolveWorkspace(body: Record<string, unknown>) {
  return normalizeProjectWorkspaceContext(body, {
    workspaceRoot: resolveWorkspaceRoot(),
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
  const result = await promoteProjectWikiCanon({
    workspace,
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
  const result = await listProjectWikiCanonPages({
    workspace,
    status: (readString(body.status) as 'curated' | 'draft' | null) ?? undefined,
    limit: typeof body.limit === 'number' ? body.limit : undefined,
  });
  return jsonResponse({ ...result, workspace });
}

export async function wikiReadPageEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  const result = await readProjectWikiCanonPage({
    workspace,
    slug: (body.slug as string) ?? '',
  });
  return jsonResponse({ ...result, workspace });
}
