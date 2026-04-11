import { type ApiResponse, callApi } from './core'
import { appendWorkspacePayload, type ProjectWorkspaceContext } from './workspace'

export interface ProjectWikiRawEvidencePayload {
  relativePath?: string
  content?: string
}

export interface PromoteProjectWikiCanonPayload {
  title: string
  body: string
  slug?: string
  idSeed?: string
  promotedFrom?: 'story-bible' | 'chat' | 'research' | 'manual'
  sourceId?: string
  sourceRef?: string
  status?: 'curated' | 'draft'
  rawEvidence?: ProjectWikiRawEvidencePayload
  metadata?: Record<string, unknown>
}

export interface ProjectWikiCanonPageSummary {
  id: string
  slug: string
  title: string
  status: string
  file_path: string
}

export interface ProjectWikiCanonPageRecord extends ProjectWikiCanonPageSummary {
  markdown: string
}

export interface PromoteProjectWikiCanonResponse {
  available: boolean
  reason: string | null
  workspace_id: string | null
  page: {
    id: string
    slug: string
    title: string
    status: string
    path: string
    markdown: string
    promoted_from: string
  } | null
  raw_evidence_path: string | null
  log_entry: Record<string, unknown> | null
  workspace?: ProjectWorkspaceContext
}

export interface ListProjectWikiCanonPagesResponse {
  available: boolean
  reason: string | null
  workspace_id: string | null
  total_pages: number
  pages: ProjectWikiCanonPageSummary[]
  workspace?: ProjectWorkspaceContext
}

export interface ReadProjectWikiCanonPageResponse {
  available: boolean
  reason: string | null
  workspace_id: string | null
  page: ProjectWikiCanonPageRecord | null
  workspace?: ProjectWorkspaceContext
}

export async function promoteProjectWikiCanonApi(
  payload: PromoteProjectWikiCanonPayload,
  workspace?: ProjectWorkspaceContext | null,
): Promise<ApiResponse<PromoteProjectWikiCanonResponse>> {
  return callApi(
    '/wiki/promote',
    'POST',
    appendWorkspacePayload({
      title: payload.title,
      body: payload.body,
      slug: payload.slug,
      id_seed: payload.idSeed,
      promoted_from: payload.promotedFrom,
      source_id: payload.sourceId,
      source_ref: payload.sourceRef,
      status: payload.status,
      raw_evidence: payload.rawEvidence
        ? {
            relative_path: payload.rawEvidence.relativePath,
            content: payload.rawEvidence.content,
          }
        : undefined,
      metadata: payload.metadata,
    }, workspace),
  )
}

export async function listProjectWikiCanonPagesApi(
  workspace?: ProjectWorkspaceContext | null,
  options: { status?: 'curated' | 'draft'; limit?: number } = {},
): Promise<ApiResponse<ListProjectWikiCanonPagesResponse>> {
  return callApi(
    '/wiki/list',
    'POST',
    appendWorkspacePayload({
      status: options.status,
      limit: options.limit,
    }, workspace),
  )
}

export async function readProjectWikiCanonPageApi(
  slug: string,
  workspace?: ProjectWorkspaceContext | null,
): Promise<ApiResponse<ReadProjectWikiCanonPageResponse>> {
  return callApi(
    '/wiki/page',
    'POST',
    appendWorkspacePayload({
      slug,
    }, workspace),
  )
}
