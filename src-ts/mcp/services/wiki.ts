import path from 'node:path';

import type {
  ProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import {
  normalizeProjectWikiSlug,
  type ProjectWikiPageStatus,
  type ProjectWikiPromotedFrom,
} from '../../project/wiki-schema.js';
import {
  appendProjectWikiLog,
  readProjectWikiIndex,
  readProjectWikiPage,
  resolveProjectWikiStore,
  writeProjectWikiPage,
  writeProjectWikiRawEvidence,
} from '../../project/wiki-store.js';

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

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function resolveWikiStore(workspace: ProjectWorkspaceContext) {
  return resolveProjectWikiStore(
    workspace.identity.workspaceRoot,
    workspace.identity.workspaceId,
  );
}

function resolvePromotedFrom(value: ProjectWikiPromotedFrom | null | undefined): ProjectWikiPromotedFrom {
  return value === 'story-bible' || value === 'chat' || value === 'research' || value === 'manual'
    ? value
    : 'manual';
}

function resolvePageStatus(value: ProjectWikiPageStatus | null | undefined): ProjectWikiPageStatus {
  return value === 'draft' ? 'draft' : 'curated';
}

function defaultRawEvidencePath(params: {
  promotedFrom: ProjectWikiPromotedFrom;
  sourceId?: string | null;
  slug?: string | null;
  title: string;
}): string {
  const seed = normalizeProjectWikiSlug(
    readString(params.sourceId)
    ?? readString(params.slug)
    ?? params.title,
  ).replace(/\//g, '-');

  return path.posix.join('promotions', params.promotedFrom, `${seed || 'entry'}.md`);
}

function parseLogEntry(serialized: string | null): Record<string, unknown> | null {
  const raw = readString(serialized);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface PromoteProjectWikiCanonParams {
  workspace: ProjectWorkspaceContext;
  title: string;
  body: string;
  slug?: string | null;
  idSeed?: string | null;
  promotedFrom?: ProjectWikiPromotedFrom | null;
  sourceId?: string | null;
  sourceRef?: string | null;
  status?: ProjectWikiPageStatus | null;
  rawEvidence?: {
    relativePath?: string | null;
    content?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProjectWikiCanonPageSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  file_path: string;
}

export interface ProjectWikiCanonPageRecord extends ProjectWikiCanonPageSummary {
  markdown: string;
}

export interface PromoteProjectWikiCanonResult {
  available: boolean;
  reason: string | null;
  workspace_id: string | null;
  page: {
    id: string;
    slug: string;
    title: string;
    status: string;
    path: string;
    markdown: string;
    promoted_from: ProjectWikiPromotedFrom;
  } | null;
  raw_evidence_path: string | null;
  log_entry: Record<string, unknown> | null;
}

export interface ListProjectWikiCanonPagesParams {
  workspace: ProjectWorkspaceContext;
  status?: ProjectWikiPageStatus | null;
  limit?: number;
}

export interface ListProjectWikiCanonPagesResult {
  available: boolean;
  reason: string | null;
  workspace_id: string | null;
  total_pages: number;
  pages: ProjectWikiCanonPageSummary[];
}

export interface ReadProjectWikiCanonPageParams {
  workspace: ProjectWorkspaceContext;
  slug: string;
}

export interface ReadProjectWikiCanonPageResult {
  available: boolean;
  reason: string | null;
  workspace_id: string | null;
  page: ProjectWikiCanonPageRecord | null;
}

export async function promoteProjectWikiCanon(
  params: PromoteProjectWikiCanonParams,
): Promise<PromoteProjectWikiCanonResult> {
  const store = resolveWikiStore(params.workspace);
  if (!store.available) {
    return {
      available: false,
      reason: store.reason,
      workspace_id: null,
      page: null,
      raw_evidence_path: null,
      log_entry: null,
    };
  }

  const promotedFrom = resolvePromotedFrom(params.promotedFrom);
  const pageResult = await writeProjectWikiPage(store, {
    workspaceId: store.workspaceId,
    title: params.title,
    slug: params.slug ?? undefined,
    idSeed: params.idSeed ?? params.sourceId ?? undefined,
    promotedFrom,
    status: resolvePageStatus(params.status),
    body: params.body,
  });
  if (!pageResult) {
    return {
      available: true,
      reason: 'page-write-failed',
      workspace_id: store.workspaceId,
      page: null,
      raw_evidence_path: null,
      log_entry: null,
    };
  }

  const rawEvidenceContent = readString(params.rawEvidence?.content);
  const rawEvidencePath = rawEvidenceContent
    ? await writeProjectWikiRawEvidence(
        store,
        params.rawEvidence?.relativePath
        ?? defaultRawEvidencePath({
          promotedFrom,
          sourceId: params.sourceId,
          slug: pageResult.frontmatter.slug,
          title: params.title,
        }),
        rawEvidenceContent,
      )
    : null;

  const logEntry = parseLogEntry(await appendProjectWikiLog(store, {
    type: 'promotion',
    promotion_mode: 'manual',
    promoted_from: promotedFrom,
    page_id: pageResult.frontmatter.id,
    slug: pageResult.frontmatter.slug,
    title: pageResult.frontmatter.title,
    status: pageResult.frontmatter.status,
    source_id: readString(params.sourceId),
    source_ref: readString(params.sourceRef),
    raw_evidence_path: rawEvidencePath,
    metadata: asRecord(params.metadata) ?? undefined,
  }));

  return {
    available: true,
    reason: null,
    workspace_id: store.workspaceId,
    page: {
      id: pageResult.frontmatter.id,
      slug: pageResult.frontmatter.slug,
      title: pageResult.frontmatter.title,
      status: pageResult.frontmatter.status,
      path: pageResult.path,
      markdown: pageResult.markdown,
      promoted_from: pageResult.frontmatter.promotedFrom,
    },
    raw_evidence_path: rawEvidencePath,
    log_entry: logEntry,
  };
}

export async function listProjectWikiCanonPages(
  params: ListProjectWikiCanonPagesParams,
): Promise<ListProjectWikiCanonPagesResult> {
  const store = resolveWikiStore(params.workspace);
  if (!store.available) {
    return {
      available: false,
      reason: store.reason,
      workspace_id: null,
      total_pages: 0,
      pages: [],
    };
  }

  const index = await readProjectWikiIndex(store);
  const pages = index?.pages ?? [];
  const targetStatus = params.status ? resolvePageStatus(params.status) : null;
  const filtered = targetStatus
    ? pages.filter((page) => page.status === targetStatus)
    : pages;
  const limit = clampPositiveInteger(params.limit, filtered.length || 1);

  return {
    available: true,
    reason: null,
    workspace_id: store.workspaceId,
    total_pages: pages.length,
    pages: filtered.slice(0, limit).map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      status: page.status,
      file_path: page.filePath,
    })),
  };
}

export async function readProjectWikiCanonPage(
  params: ReadProjectWikiCanonPageParams,
): Promise<ReadProjectWikiCanonPageResult> {
  const store = resolveWikiStore(params.workspace);
  if (!store.available) {
    return {
      available: false,
      reason: store.reason,
      workspace_id: null,
      page: null,
    };
  }

  const slug = readString(params.slug);
  if (!slug) {
    return {
      available: true,
      reason: 'missing-slug',
      workspace_id: store.workspaceId,
      page: null,
    };
  }

  const normalizedSlug = normalizeProjectWikiSlug(slug);
  const index = await readProjectWikiIndex(store);
  const entry = index?.pages.find((page) => page.slug === normalizedSlug) ?? null;
  if (!entry) {
    return {
      available: true,
      reason: 'page-not-found',
      workspace_id: store.workspaceId,
      page: null,
    };
  }

  const markdown = await readProjectWikiPage(store, normalizedSlug);
  if (!markdown) {
    return {
      available: true,
      reason: 'page-not-found',
      workspace_id: store.workspaceId,
      page: null,
    };
  }

  return {
    available: true,
    reason: null,
    workspace_id: store.workspaceId,
    page: {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      status: entry.status,
      file_path: entry.filePath,
      markdown,
    },
  };
}
