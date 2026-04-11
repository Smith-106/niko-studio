import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  PROJECT_WIKI_GRAPH_PROJECTIONS_DIR,
  PROJECT_WIKI_INDEX_FILENAME,
  PROJECT_WIKI_MEMORY_PROJECTIONS_DIR,
  PROJECT_WIKI_LOG_FILENAME,
  PROJECT_WIKI_PAGES_DIR,
  PROJECT_WIKI_PROJECTIONS_DIR,
  PROJECT_WIKI_RAW_DIR,
  PROJECT_WIKI_ROOT_DIR,
  PROJECT_WIKI_SCHEMA_VERSION,
  createProjectWikiPageFrontmatter,
  normalizeProjectWikiSlug,
  normalizeProjectWikiWorkspaceId,
  projectWikiPageFrontmatterToMarkdown,
  projectWikiSlugToFilePath,
  type CreateProjectWikiPageFrontmatterInput,
  type ProjectWikiPageFrontmatter,
} from './wiki-schema.js';

export type ProjectWikiUnavailableReason = 'missing-workspace-root';

export interface ProjectWikiStorePaths {
  rootDir: string;
  pagesDir: string;
  rawDir: string;
  projectionsDir: string;
  graphProjectionDir: string;
  memoryProjectionDir: string;
  indexFile: string;
  logFile: string;
}

export interface ProjectWikiStoreAvailable {
  available: true;
  reason: null;
  workspaceRoot: string;
  workspaceId: string;
  paths: ProjectWikiStorePaths;
}

export interface ProjectWikiStoreUnavailable {
  available: false;
  reason: ProjectWikiUnavailableReason;
  workspaceRoot: null;
  workspaceId: null;
  paths: null;
}

export type ProjectWikiStoreResolution = ProjectWikiStoreAvailable | ProjectWikiStoreUnavailable;

export interface ProjectWikiIndexEntry {
  id: string;
  slug: string;
  title: string;
  filePath: string;
  status: string;
}

export interface ProjectWikiIndex {
  schemaVersion: string;
  workspaceId: string;
  pages: ProjectWikiIndexEntry[];
}

export interface WriteProjectWikiPageInput extends CreateProjectWikiPageFrontmatterInput {
  body: string;
}

export interface WriteProjectWikiPageResult {
  frontmatter: ProjectWikiPageFrontmatter;
  markdown: string;
  path: string;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildPaths(workspaceRoot: string): ProjectWikiStorePaths {
  const rootDir = path.join(workspaceRoot, PROJECT_WIKI_ROOT_DIR);
  const projectionsDir = path.join(rootDir, PROJECT_WIKI_PROJECTIONS_DIR);
  return {
    rootDir,
    pagesDir: path.join(workspaceRoot, PROJECT_WIKI_ROOT_DIR, PROJECT_WIKI_PAGES_DIR),
    rawDir: path.join(workspaceRoot, PROJECT_WIKI_ROOT_DIR, PROJECT_WIKI_RAW_DIR),
    projectionsDir,
    graphProjectionDir: path.join(projectionsDir, PROJECT_WIKI_GRAPH_PROJECTIONS_DIR),
    memoryProjectionDir: path.join(projectionsDir, PROJECT_WIKI_MEMORY_PROJECTIONS_DIR),
    indexFile: path.join(rootDir, PROJECT_WIKI_INDEX_FILENAME),
    logFile: path.join(rootDir, PROJECT_WIKI_LOG_FILENAME),
  };
}

function buildDefaultIndex(workspaceId: string): ProjectWikiIndex {
  return {
    schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
    workspaceId,
    pages: [],
  };
}

async function ensureFileExists(filePath: string, content: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    await writeFile(filePath, content, 'utf8');
  }
}

async function readIndex(store: ProjectWikiStoreAvailable): Promise<ProjectWikiIndex> {
  try {
    const raw = await readFile(store.paths.indexFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ProjectWikiIndex>;
    return {
      schemaVersion: readString(parsed.schemaVersion) ?? PROJECT_WIKI_SCHEMA_VERSION,
      workspaceId: readString(parsed.workspaceId) ?? store.workspaceId,
      pages: Array.isArray(parsed.pages)
        ? parsed.pages
            .map((entry) => entry as Partial<ProjectWikiIndexEntry>)
            .filter((entry) => readString(entry.id) && readString(entry.slug) && readString(entry.filePath))
            .map((entry) => ({
              id: readString(entry.id)!,
              slug: readString(entry.slug)!,
              title: readString(entry.title) ?? readString(entry.slug)!,
              filePath: readString(entry.filePath)!,
              status: readString(entry.status) ?? 'curated',
            }))
        : [],
    };
  } catch {
    return buildDefaultIndex(store.workspaceId);
  }
}

function normalizeRawRelativePath(relativePath: string): string {
  const normalized = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..');

  return normalized.length > 0 ? normalized.join('/') : 'unclassified.md';
}

export function resolveProjectWikiStore(
  workspaceRoot?: string | null,
  workspaceId?: string | null,
): ProjectWikiStoreResolution {
  const resolvedRoot = readString(workspaceRoot);
  if (!resolvedRoot) {
    return {
      available: false,
      reason: 'missing-workspace-root',
      workspaceRoot: null,
      workspaceId: null,
      paths: null,
    };
  }

  const resolvedWorkspaceId = normalizeProjectWikiWorkspaceId(
    readString(workspaceId) ?? path.basename(resolvedRoot),
  );

  return {
    available: true,
    reason: null,
    workspaceRoot: resolvedRoot,
    workspaceId: resolvedWorkspaceId,
    paths: buildPaths(resolvedRoot),
  };
}

export async function ensureProjectWikiStore(
  store: ProjectWikiStoreResolution,
): Promise<ProjectWikiStoreResolution> {
  if (!store.available) return store;

  await mkdir(store.paths.rootDir, { recursive: true });
  await mkdir(store.paths.pagesDir, { recursive: true });
  await mkdir(store.paths.rawDir, { recursive: true });
  await mkdir(store.paths.projectionsDir, { recursive: true });
  await mkdir(store.paths.graphProjectionDir, { recursive: true });
  await mkdir(store.paths.memoryProjectionDir, { recursive: true });
  await ensureFileExists(
    store.paths.indexFile,
    `${JSON.stringify(buildDefaultIndex(store.workspaceId), null, 2)}\n`,
  );
  await ensureFileExists(store.paths.logFile, '');

  return store;
}

export async function writeProjectWikiPage(
  store: ProjectWikiStoreResolution,
  input: WriteProjectWikiPageInput,
): Promise<WriteProjectWikiPageResult | null> {
  if (!store.available) return null;

  await ensureProjectWikiStore(store);

  const frontmatter = createProjectWikiPageFrontmatter({
    ...input,
    workspaceId: input.workspaceId || store.workspaceId,
  });
  const markdown = `${projectWikiPageFrontmatterToMarkdown(frontmatter)}\n\n${input.body.trim()}\n`;
  const filePath = projectWikiSlugToFilePath(frontmatter.slug);
  const targetPath = path.join(store.paths.pagesDir, filePath);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, markdown, 'utf8');

  const index = await readIndex(store);
  const nextEntry: ProjectWikiIndexEntry = {
    id: frontmatter.id,
    slug: frontmatter.slug,
    title: frontmatter.title,
    filePath,
    status: frontmatter.status,
  };
  const remaining = index.pages.filter((entry) => entry.id !== nextEntry.id);
  remaining.push(nextEntry);
  remaining.sort((left, right) => left.slug.localeCompare(right.slug));
  await writeFile(
    store.paths.indexFile,
    `${JSON.stringify({ ...index, schemaVersion: PROJECT_WIKI_SCHEMA_VERSION, pages: remaining }, null, 2)}\n`,
    'utf8',
  );

  return {
    frontmatter,
    markdown,
    path: targetPath,
  };
}

export async function readProjectWikiIndex(
  store: ProjectWikiStoreResolution,
): Promise<ProjectWikiIndex | null> {
  if (!store.available) return null;

  await ensureProjectWikiStore(store);
  return readIndex(store);
}

export async function readProjectWikiPage(
  store: ProjectWikiStoreResolution,
  slug: string,
): Promise<string | null> {
  if (!store.available) return null;

  const targetPath = path.join(store.paths.pagesDir, `${normalizeProjectWikiSlug(slug)}.md`);
  try {
    return await readFile(targetPath, 'utf8');
  } catch {
    return null;
  }
}

export async function writeProjectWikiRawEvidence(
  store: ProjectWikiStoreResolution,
  relativePath: string,
  content: string,
): Promise<string | null> {
  if (!store.available) return null;

  await ensureProjectWikiStore(store);

  const normalizedPath = normalizeRawRelativePath(relativePath);
  const targetPath = path.join(store.paths.rawDir, normalizedPath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, 'utf8');
  return targetPath;
}

export async function appendProjectWikiLog(
  store: ProjectWikiStoreResolution,
  entry: Record<string, unknown>,
): Promise<string | null> {
  if (!store.available) return null;

  await ensureProjectWikiStore(store);

  const serialized = `${JSON.stringify({
    ts: new Date().toISOString(),
    workspaceId: store.workspaceId,
    ...entry,
  })}\n`;
  const current = await readFile(store.paths.logFile, 'utf8').catch(() => '');
  await writeFile(store.paths.logFile, `${current}${serialized}`, 'utf8');
  return serialized;
}
