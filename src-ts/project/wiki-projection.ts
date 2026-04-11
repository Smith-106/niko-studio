import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  PROJECT_WIKI_AUTHORITY_CONTRACT,
  PROJECT_WIKI_LAYOUT,
  PROJECT_WIKI_SCHEMA_VERSION,
  normalizeProjectWikiSlug,
  normalizeProjectWikiWorkspaceId,
  projectWikiProjectionFilePath,
  projectWikiSlugToFilePath,
  type ProjectWikiCanonAuthority,
  type ProjectWikiPageFrontmatter,
  type ProjectWikiProjectionAuthority,
  type ProjectWikiProjectionKind,
} from './wiki-schema.js';
import { ensureProjectWikiStore, type ProjectWikiStoreResolution } from './wiki-store.js';

export interface ProjectWikiProjectionSourcePage {
  id: string;
  slug: string;
  title: string;
  filePath: string;
  canonAuthority: ProjectWikiCanonAuthority;
}

export interface ProjectWikiProjectionRecord<TSnapshot = unknown> {
  schemaVersion: string;
  projectionId: string;
  kind: ProjectWikiProjectionKind;
  workspaceId: string;
  filePath: string;
  projectionAuthority: ProjectWikiProjectionAuthority;
  sourcePage: ProjectWikiProjectionSourcePage;
  snapshot: TSnapshot;
}

export interface CreateProjectWikiProjectionRecordInput<TSnapshot = unknown> {
  kind: ProjectWikiProjectionKind;
  page: Pick<
    ProjectWikiPageFrontmatter,
    'id' | 'slug' | 'title' | 'workspaceId' | 'canonAuthority' | 'projectionAuthority'
  >;
  snapshot: TSnapshot;
}

export interface WriteProjectWikiProjectionSnapshotResult<TSnapshot = unknown> {
  path: string;
  record: ProjectWikiProjectionRecord<TSnapshot>;
}

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

function readProjectionAuthority(value: unknown): ProjectWikiProjectionAuthority | null {
  return value === 'derived' ? value : null;
}

function readCanonAuthority(value: unknown): ProjectWikiCanonAuthority | null {
  return value === 'canon-page' ? value : null;
}

export function createProjectWikiProjectionId(
  kind: ProjectWikiProjectionKind,
  pageId: string,
): string {
  const resolvedPageId = readString(pageId) ?? 'projection';
  return `${kind}:${resolvedPageId}`;
}

export function projectWikiProjectionSnapshotPath(
  kind: ProjectWikiProjectionKind,
  pageId: string,
): string {
  return `${PROJECT_WIKI_LAYOUT.rootDir}/${projectWikiProjectionFilePath(kind, pageId)}`;
}

export function createProjectWikiProjectionRecord<TSnapshot>(
  input: CreateProjectWikiProjectionRecordInput<TSnapshot>,
): ProjectWikiProjectionRecord<TSnapshot> {
  const pageId = readString(input.page.id) ?? 'projection';
  const slug = normalizeProjectWikiSlug(input.page.slug);
  const workspaceId = normalizeProjectWikiWorkspaceId(input.page.workspaceId);
  const title = readString(input.page.title) ?? slug;

  return {
    schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
    projectionId: createProjectWikiProjectionId(input.kind, pageId),
    kind: input.kind,
    workspaceId,
    filePath: projectWikiProjectionSnapshotPath(input.kind, pageId),
    projectionAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.projectionAuthority,
    sourcePage: {
      id: pageId,
      slug,
      title,
      filePath: projectWikiSlugToFilePath(slug),
      canonAuthority: readCanonAuthority(input.page.canonAuthority)
        ?? PROJECT_WIKI_AUTHORITY_CONTRACT.canonAuthority,
    },
    snapshot: input.snapshot,
  };
}

function parseProjectWikiProjectionRecord<TSnapshot>(
  value: unknown,
): ProjectWikiProjectionRecord<TSnapshot> | null {
  const record = asRecord(value);
  if (!record) return null;

  const sourcePage = asRecord(record.sourcePage);
  if (!sourcePage) return null;

  const projectionAuthority = readProjectionAuthority(record.projectionAuthority);
  const canonAuthority = readCanonAuthority(sourcePage.canonAuthority);
  const projectionId = readString(record.projectionId);
  const kind = record.kind;

  if (!projectionAuthority || !canonAuthority || !projectionId) return null;
  if (kind !== 'graph' && kind !== 'memory') return null;

  const workspaceId = readString(record.workspaceId);
  const filePath = readString(record.filePath);
  const schemaVersion = readString(record.schemaVersion);
  const pageId = readString(sourcePage.id);
  const slug = readString(sourcePage.slug);
  const title = readString(sourcePage.title);
  const pageFilePath = readString(sourcePage.filePath);

  if (!workspaceId || !filePath || !schemaVersion || !pageId || !slug || !title || !pageFilePath) {
    return null;
  }

  return {
    schemaVersion,
    projectionId,
    kind,
    workspaceId,
    filePath,
    projectionAuthority,
    sourcePage: {
      id: pageId,
      slug,
      title,
      filePath: pageFilePath,
      canonAuthority,
    },
    snapshot: (record.snapshot ?? null) as TSnapshot,
  };
}

function resolveProjectionSnapshotAbsolutePath(
  store: ProjectWikiStoreResolution,
  kind: ProjectWikiProjectionKind,
  pageId: string,
): string | null {
  if (!store.available) return null;
  return path.join(store.workspaceRoot, projectWikiProjectionSnapshotPath(kind, pageId));
}

export async function writeProjectWikiProjectionSnapshot<TSnapshot>(
  store: ProjectWikiStoreResolution,
  input: CreateProjectWikiProjectionRecordInput<TSnapshot>,
): Promise<WriteProjectWikiProjectionSnapshotResult<TSnapshot> | null> {
  if (!store.available) return null;

  await ensureProjectWikiStore(store);

  const record = createProjectWikiProjectionRecord(input);
  const targetPath = resolveProjectionSnapshotAbsolutePath(store, input.kind, input.page.id);
  if (!targetPath) return null;

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  return {
    path: targetPath,
    record,
  };
}

export async function readProjectWikiProjectionSnapshot<TSnapshot>(
  store: ProjectWikiStoreResolution,
  kind: ProjectWikiProjectionKind,
  pageId: string,
): Promise<ProjectWikiProjectionRecord<TSnapshot> | null> {
  const targetPath = resolveProjectionSnapshotAbsolutePath(store, kind, pageId);
  if (!targetPath) return null;

  try {
    const raw = await readFile(targetPath, 'utf8');
    return parseProjectWikiProjectionRecord<TSnapshot>(JSON.parse(raw));
  } catch {
    return null;
  }
}
