import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  ProjectWikiCanonAuthority,
  ProjectWikiPageFrontmatter,
  ProjectWikiPageStatus,
  ProjectWikiProjectionAuthority,
  ProjectWikiPromotedFrom,
  ProjectWikiPromotionMode,
  ProjectWikiScopeAuthority,
} from './wiki-schema.js';
import {
  resolveProjectWikiStore,
  type ProjectWikiIndex,
  type ProjectWikiIndexEntry,
  type ProjectWikiUnavailableReason,
} from './wiki-store.js';
import type { ProjectWorkspaceContext } from './workspace-model.js';

const DEFAULT_QUERY_LIMIT = 5;
const DEFAULT_EXCERPT_LENGTH = 180;

export interface ProjectWikiQueryAuthorityMetadata {
  workspaceId: string;
  scopeAuthority: ProjectWikiScopeAuthority;
  canonAuthority: ProjectWikiCanonAuthority;
  projectionAuthority: ProjectWikiProjectionAuthority;
  promotion: ProjectWikiPromotionMode;
  promotedFrom: ProjectWikiPromotedFrom;
  status: ProjectWikiPageStatus;
}

export interface ProjectWikiQueryMatch {
  pageId: string;
  slug: string;
  title: string;
  filePath: string;
  score: number;
  excerpt: string;
  authority: ProjectWikiQueryAuthorityMetadata;
}

export interface ProjectWikiQueryOptions {
  limit?: number;
  excerptLength?: number;
}

export interface ProjectWikiQueryUnavailable {
  available: false;
  reason: ProjectWikiUnavailableReason;
  query: string;
  workspaceId: null;
  totalPages: 0;
  matches: [];
}

export interface ProjectWikiQueryAvailable {
  available: true;
  reason: null;
  query: string;
  workspaceId: string;
  totalPages: number;
  matches: ProjectWikiQueryMatch[];
}

export type ProjectWikiQueryResult = ProjectWikiQueryAvailable | ProjectWikiQueryUnavailable;

interface ParsedProjectWikiPage {
  frontmatter: ProjectWikiPageFrontmatter;
  body: string;
}

interface ScoredProjectWikiPage {
  entry: ProjectWikiIndexEntry;
  page: ParsedProjectWikiPage;
  score: number;
  excerpt: string;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokenizeQuery(value: string): string[] {
  return [...new Set(normalizeSearchText(value).split(/\s+/).filter(Boolean))];
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;

  let count = 0;
  let cursor = 0;
  while (cursor < haystack.length) {
    const matchIndex = haystack.indexOf(needle, cursor);
    if (matchIndex === -1) break;
    count += 1;
    cursor = matchIndex + needle.length;
  }

  return count;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function parseJsonString(rawValue: string | undefined): string | null {
  const value = readString(rawValue);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return readString(parsed);
  } catch {
    return value.replace(/^"|"$/g, '');
  }
}

function isProjectWikiPageStatus(value: string | null): value is ProjectWikiPageStatus {
  return value === 'curated' || value === 'draft';
}

function isProjectWikiPromotedFrom(value: string | null): value is ProjectWikiPromotedFrom {
  return value === 'story-bible' || value === 'chat' || value === 'research' || value === 'manual';
}

function isProjectWikiPromotionMode(value: string | null): value is ProjectWikiPromotionMode {
  return value === 'manual';
}

function isProjectWikiScopeAuthority(value: string | null): value is ProjectWikiScopeAuthority {
  return value === 'workspace';
}

function isProjectWikiCanonAuthority(value: string | null): value is ProjectWikiCanonAuthority {
  return value === 'canon-page';
}

function isProjectWikiProjectionAuthority(value: string | null): value is ProjectWikiProjectionAuthority {
  return value === 'derived';
}

function parseProjectWikiMarkdown(markdown: string): ParsedProjectWikiPage | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(markdown);
  if (!match) return null;

  const rawFrontmatter = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/u)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;
    rawFrontmatter.set(key, value);
  }

  const id = parseJsonString(rawFrontmatter.get('id'));
  const slug = parseJsonString(rawFrontmatter.get('slug'));
  const title = parseJsonString(rawFrontmatter.get('title'));
  const workspaceId = parseJsonString(rawFrontmatter.get('workspaceId'));
  const status = parseJsonString(rawFrontmatter.get('status'));
  const promotedFrom = parseJsonString(rawFrontmatter.get('promotedFrom'));
  const promotion = parseJsonString(rawFrontmatter.get('promotion'));
  const scopeAuthority = parseJsonString(rawFrontmatter.get('scopeAuthority'));
  const canonAuthority = parseJsonString(rawFrontmatter.get('canonAuthority'));
  const projectionAuthority = parseJsonString(rawFrontmatter.get('projectionAuthority'));

  if (!id || !slug || !title || !workspaceId) return null;
  if (!isProjectWikiPageStatus(status)) return null;
  if (!isProjectWikiPromotedFrom(promotedFrom)) return null;
  if (!isProjectWikiPromotionMode(promotion)) return null;
  if (!isProjectWikiScopeAuthority(scopeAuthority)) return null;
  if (!isProjectWikiCanonAuthority(canonAuthority)) return null;
  if (!isProjectWikiProjectionAuthority(projectionAuthority)) return null;

  return {
    frontmatter: {
      id,
      slug,
      title,
      workspaceId,
      status,
      promotedFrom,
      promotion,
      scopeAuthority,
      canonAuthority,
      projectionAuthority,
    },
    body: markdown.slice(match[0].length).trim(),
  };
}

function normalizeProjectWikiIndexPages(parsed: Partial<ProjectWikiIndex> | null): ProjectWikiIndexEntry[] {
  if (!parsed || !Array.isArray(parsed.pages)) return [];

  return parsed.pages
    .map((entry) => entry as Partial<ProjectWikiIndexEntry>)
    .filter((entry) => readString(entry.id) && readString(entry.slug) && readString(entry.filePath))
    .map((entry) => ({
      id: readString(entry.id)!,
      slug: readString(entry.slug)!,
      title: readString(entry.title) ?? readString(entry.slug)!,
      filePath: readString(entry.filePath)!,
      status: readString(entry.status) ?? 'curated',
    }));
}

async function readProjectWikiIndexEntries(indexFile: string): Promise<ProjectWikiIndexEntry[]> {
  try {
    const raw = await readFile(indexFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ProjectWikiIndex>;
    return normalizeProjectWikiIndexPages(parsed);
  } catch {
    return [];
  }
}

async function readIndexedProjectWikiPage(
  pagesDir: string,
  entry: ProjectWikiIndexEntry,
): Promise<ParsedProjectWikiPage | null> {
  const pagePath = path.join(pagesDir, entry.filePath);

  try {
    const markdown = await readFile(pagePath, 'utf8');
    return parseProjectWikiMarkdown(markdown);
  } catch {
    return null;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function findExcerptStart(haystack: string, query: string, tokens: string[]): number {
  const normalizedHaystack = haystack.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery) {
    const phraseIndex = normalizedHaystack.indexOf(normalizedQuery);
    if (phraseIndex !== -1) return phraseIndex;
  }

  for (const token of tokens) {
    const tokenIndex = normalizedHaystack.indexOf(token.toLowerCase());
    if (tokenIndex !== -1) return tokenIndex;
  }

  return 0;
}

function buildExcerpt(body: string, query: string, tokens: string[], maxLength: number): string {
  const collapsed = collapseWhitespace(body);
  if (!collapsed) return '';
  if (collapsed.length <= maxLength) return collapsed;

  const matchIndex = findExcerptStart(collapsed, query, tokens);
  const halfLength = Math.floor(maxLength / 2);

  let start = Math.max(0, matchIndex - halfLength);
  let end = Math.min(collapsed.length, start + maxLength);

  if (end === collapsed.length) {
    start = Math.max(0, end - maxLength);
  }

  if (start > 0) {
    const previousSpace = collapsed.lastIndexOf(' ', start);
    if (previousSpace !== -1) {
      start = previousSpace + 1;
    }
  }

  if (end < collapsed.length) {
    const nextSpace = collapsed.indexOf(' ', end);
    if (nextSpace !== -1) {
      end = nextSpace;
    }
  }

  const excerpt = collapsed.slice(start, end).trim();
  const prefix = start > 0 ? '... ' : '';
  const suffix = end < collapsed.length ? ' ...' : '';
  return `${prefix}${excerpt}${suffix}`;
}

function scoreProjectWikiPage(
  page: ParsedProjectWikiPage,
  entry: ProjectWikiIndexEntry,
  query: string,
  tokens: string[],
  excerptLength: number,
): ScoredProjectWikiPage | null {
  if (page.frontmatter.canonAuthority !== 'canon-page') return null;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || tokens.length === 0) return null;

  const titleText = normalizeSearchText(page.frontmatter.title);
  const slugText = normalizeSearchText(page.frontmatter.slug.replace(/\//gu, ' '));
  const bodyText = normalizeSearchText(page.body);

  const matchedTokens = tokens.filter((token) => (
    titleText.includes(token) || slugText.includes(token) || bodyText.includes(token)
  ));

  let score = 0;

  if (titleText.includes(normalizedQuery)) score += 60;
  if (slugText.includes(normalizedQuery)) score += 45;
  if (bodyText.includes(normalizedQuery)) score += 25;

  for (const token of tokens) {
    score += Math.min(1, countOccurrences(titleText, token)) * 14;
    score += Math.min(1, countOccurrences(slugText, token)) * 10;
    score += Math.min(3, countOccurrences(bodyText, token)) * 4;
  }

  if (matchedTokens.length === tokens.length) score += 18;
  if (page.frontmatter.status === 'curated') score += 8;

  if (score === 0) return null;

  return {
    entry,
    page,
    score,
    excerpt: buildExcerpt(page.body, query, tokens, excerptLength),
  };
}

function sortScoredPages(left: ScoredProjectWikiPage, right: ScoredProjectWikiPage): number {
  if (right.score !== left.score) return right.score - left.score;

  const statusRank = (status: ProjectWikiPageStatus): number => (status === 'curated' ? 0 : 1);
  const statusOrder = statusRank(left.page.frontmatter.status) - statusRank(right.page.frontmatter.status);
  if (statusOrder !== 0) return statusOrder;

  return left.page.frontmatter.slug.localeCompare(right.page.frontmatter.slug);
}

export async function queryProjectWikiCanon(
  workspace: ProjectWorkspaceContext,
  query: string,
  options: ProjectWikiQueryOptions = {},
): Promise<ProjectWikiQueryResult> {
  const store = resolveProjectWikiStore(
    workspace.identity.workspaceRoot,
    workspace.identity.workspaceId,
  );

  if (!store.available) {
    return {
      available: false,
      reason: store.reason,
      query,
      workspaceId: null,
      totalPages: 0,
      matches: [],
    };
  }

  const limit = clampPositiveInteger(options.limit, DEFAULT_QUERY_LIMIT);
  const excerptLength = clampPositiveInteger(options.excerptLength, DEFAULT_EXCERPT_LENGTH);
  const tokens = tokenizeQuery(query);
  const indexEntries = await readProjectWikiIndexEntries(store.paths.indexFile);

  const pages = await Promise.all(
    indexEntries.map(async (entry) => ({
      entry,
      page: await readIndexedProjectWikiPage(store.paths.pagesDir, entry),
    })),
  );

  const scoredPages = pages
    .filter((candidate): candidate is { entry: ProjectWikiIndexEntry; page: ParsedProjectWikiPage } => (
      candidate.page !== null
    ))
    .map(({ entry, page }) => scoreProjectWikiPage(page, entry, query, tokens, excerptLength))
    .filter((candidate): candidate is ScoredProjectWikiPage => candidate !== null)
    .sort(sortScoredPages)
    .slice(0, limit);

  return {
    available: true,
    reason: null,
    query,
    workspaceId: store.workspaceId,
    totalPages: indexEntries.length,
    matches: scoredPages.map(({ entry, page, score, excerpt }) => ({
      pageId: entry.id,
      slug: page.frontmatter.slug,
      title: page.frontmatter.title,
      filePath: entry.filePath,
      score,
      excerpt,
      authority: {
        workspaceId: page.frontmatter.workspaceId,
        scopeAuthority: page.frontmatter.scopeAuthority,
        canonAuthority: page.frontmatter.canonAuthority,
        projectionAuthority: page.frontmatter.projectionAuthority,
        promotion: page.frontmatter.promotion,
        promotedFrom: page.frontmatter.promotedFrom,
        status: page.frontmatter.status,
      },
    })),
  };
}
