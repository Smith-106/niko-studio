import { createHash } from 'node:crypto';

export const PROJECT_WIKI_SCHEMA_VERSION = '2026-04-10';

export const PROJECT_WIKI_ROOT_DIR = '.writing/wiki';
export const PROJECT_WIKI_PAGES_DIR = 'pages';
export const PROJECT_WIKI_RAW_DIR = 'raw';
export const PROJECT_WIKI_PROJECTIONS_DIR = 'projections';
export const PROJECT_WIKI_GRAPH_PROJECTIONS_DIR = 'graph';
export const PROJECT_WIKI_MEMORY_PROJECTIONS_DIR = 'memory';
export const PROJECT_WIKI_INDEX_FILENAME = 'index.json';
export const PROJECT_WIKI_LOG_FILENAME = 'events.ndjson';
export const PROJECT_WIKI_MARKDOWN_EXTENSION = '.md';
export const PROJECT_WIKI_JSON_EXTENSION = '.json';

export const PROJECT_WIKI_LAYOUT = {
  rootDir: PROJECT_WIKI_ROOT_DIR,
  pagesDir: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_PAGES_DIR}`,
  rawDir: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_RAW_DIR}`,
  projectionsDir: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_PROJECTIONS_DIR}`,
  graphProjectionDir: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_PROJECTIONS_DIR}/${PROJECT_WIKI_GRAPH_PROJECTIONS_DIR}`,
  memoryProjectionDir: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_PROJECTIONS_DIR}/${PROJECT_WIKI_MEMORY_PROJECTIONS_DIR}`,
  indexFile: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_INDEX_FILENAME}`,
  logFile: `${PROJECT_WIKI_ROOT_DIR}/${PROJECT_WIKI_LOG_FILENAME}`,
} as const;

export type ProjectWikiScopeAuthority = 'workspace';
export type ProjectWikiCanonAuthority = 'canon-page';
export type ProjectWikiProjectionAuthority = 'derived';
export type ProjectWikiProjectionKind = 'graph' | 'memory';
export type ProjectWikiPromotionMode = 'manual';
export type ProjectWikiPromotedFrom = 'story-bible' | 'chat' | 'research' | 'manual';
export type ProjectWikiPageStatus = 'curated' | 'draft';

export interface ProjectWikiAuthorityContract {
  scopeAuthority: ProjectWikiScopeAuthority;
  canonAuthority: ProjectWikiCanonAuthority;
  projectionAuthority: ProjectWikiProjectionAuthority;
  promotionMode: ProjectWikiPromotionMode;
  automaticIngest: false;
  automaticProjection: false;
}

export const PROJECT_WIKI_AUTHORITY_CONTRACT: ProjectWikiAuthorityContract = {
  scopeAuthority: 'workspace',
  canonAuthority: 'canon-page',
  projectionAuthority: 'derived',
  promotionMode: 'manual',
  automaticIngest: false,
  automaticProjection: false,
};

export interface ProjectWikiPageIdentity {
  pageId: string;
  slug: string;
  filePath: string;
}

export interface CreateProjectWikiPageIdentityInput {
  title?: string | null;
  slug?: string | null;
  pageId?: string | null;
  idSeed?: string | null;
}

export interface ProjectWikiPageFrontmatter {
  id: string;
  slug: string;
  title: string;
  workspaceId: string;
  status: ProjectWikiPageStatus;
  promotedFrom: ProjectWikiPromotedFrom;
  promotion: ProjectWikiPromotionMode;
  scopeAuthority: ProjectWikiScopeAuthority;
  canonAuthority: ProjectWikiCanonAuthority;
  projectionAuthority: ProjectWikiProjectionAuthority;
}

export interface CreateProjectWikiPageFrontmatterInput extends CreateProjectWikiPageIdentityInput {
  workspaceId: string;
  title: string;
  promotedFrom?: ProjectWikiPromotedFrom;
  status?: ProjectWikiPageStatus;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeAscii(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizeIdentifier(value: string): string {
  return normalizeAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workspace';
}

function sanitizeSlugSegment(value: string): string {
  return normalizeAscii(value)
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled';
}

function lastSlugSegment(value: string): string {
  const segments = value.split('/');
  return segments[segments.length - 1] ?? value;
}

export function normalizeProjectWikiWorkspaceId(value: string): string {
  return sanitizeIdentifier(value);
}

export function normalizeProjectWikiSlug(value: string): string {
  const raw = readString(value);
  if (!raw) return 'untitled';

  const segments = raw
    .split(/[\\/]+/g)
    .map((segment) => sanitizeSlugSegment(segment))
    .filter(Boolean);

  return segments.length ? segments.join('/') : 'untitled';
}

export function projectWikiSlugToFilePath(slug: string): string {
  return `${normalizeProjectWikiSlug(slug)}${PROJECT_WIKI_MARKDOWN_EXTENSION}`;
}

export function projectWikiProjectionDirectory(kind: ProjectWikiProjectionKind): string {
  return kind === 'graph'
    ? PROJECT_WIKI_GRAPH_PROJECTIONS_DIR
    : PROJECT_WIKI_MEMORY_PROJECTIONS_DIR;
}

export function projectWikiProjectionSnapshotFilename(pageId: string): string {
  const normalizedId = readString(pageId)?.replace(/[\\/]+/g, '-').trim() ?? 'projection';
  return `${normalizedId || 'projection'}${PROJECT_WIKI_JSON_EXTENSION}`;
}

export function projectWikiProjectionFilePath(
  kind: ProjectWikiProjectionKind,
  pageId: string,
): string {
  return `${PROJECT_WIKI_PROJECTIONS_DIR}/${projectWikiProjectionDirectory(kind)}/${projectWikiProjectionSnapshotFilename(pageId)}`;
}

export function createProjectWikiPageId(seed: string): string {
  const normalizedSeed = readString(seed)?.normalize('NFKC').trim().toLowerCase() ?? 'untitled';
  const digest = createHash('sha1').update(normalizedSeed).digest('hex').slice(0, 12);
  return `wpg_${digest}`;
}

export function createProjectWikiPageIdentity(
  input: CreateProjectWikiPageIdentityInput,
): ProjectWikiPageIdentity {
  const slug = normalizeProjectWikiSlug(
    input.slug ?? input.title ?? input.idSeed ?? input.pageId ?? 'untitled',
  );
  const pageId = readString(input.pageId) ?? createProjectWikiPageId(readString(input.idSeed) ?? slug);

  return {
    pageId,
    slug,
    filePath: projectWikiSlugToFilePath(slug),
  };
}

export function isProjectWikiManualPromotionContract(
  contract: ProjectWikiAuthorityContract,
): boolean {
  return contract.scopeAuthority === 'workspace'
    && contract.canonAuthority === 'canon-page'
    && contract.projectionAuthority === 'derived'
    && contract.promotionMode === 'manual'
    && contract.automaticIngest === false
    && contract.automaticProjection === false;
}

export function createProjectWikiPageFrontmatter(
  input: CreateProjectWikiPageFrontmatterInput,
): ProjectWikiPageFrontmatter {
  const identity = createProjectWikiPageIdentity(input);

  return {
    id: identity.pageId,
    slug: identity.slug,
    title: readString(input.title) ?? lastSlugSegment(identity.slug),
    workspaceId: normalizeProjectWikiWorkspaceId(input.workspaceId),
    status: input.status ?? 'curated',
    promotedFrom: input.promotedFrom ?? 'manual',
    promotion: PROJECT_WIKI_AUTHORITY_CONTRACT.promotionMode,
    scopeAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.scopeAuthority,
    canonAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.canonAuthority,
    projectionAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.projectionAuthority,
  };
}

export function projectWikiPageFrontmatterToMarkdown(
  frontmatter: ProjectWikiPageFrontmatter,
): string {
  return [
    '---',
    `id: ${JSON.stringify(frontmatter.id)}`,
    `slug: ${JSON.stringify(frontmatter.slug)}`,
    `title: ${JSON.stringify(frontmatter.title)}`,
    `workspaceId: ${JSON.stringify(frontmatter.workspaceId)}`,
    `status: ${JSON.stringify(frontmatter.status)}`,
    `promotedFrom: ${JSON.stringify(frontmatter.promotedFrom)}`,
    `promotion: ${JSON.stringify(frontmatter.promotion)}`,
    `scopeAuthority: ${JSON.stringify(frontmatter.scopeAuthority)}`,
    `canonAuthority: ${JSON.stringify(frontmatter.canonAuthority)}`,
    `projectionAuthority: ${JSON.stringify(frontmatter.projectionAuthority)}`,
    '---',
  ].join('\n');
}
