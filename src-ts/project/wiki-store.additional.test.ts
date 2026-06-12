import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { basename, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendProjectWikiLog,
  ensureProjectWikiStore,
  readProjectWikiIndex,
  readProjectWikiPage,
  resolveProjectWikiStore,
  writeProjectWikiPage,
  writeProjectWikiRawEvidence,
} from './wiki-store.js';
import {
  PROJECT_WIKI_SCHEMA_VERSION,
  normalizeProjectWikiWorkspaceId,
} from './wiki-schema.js';

describe('project wiki store additional coverage', () => {
  it('uses the workspace basename when workspaceId is blank', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-root-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, '   ');
      expect(store.available).toBe(true);
      if (!store.available) return;

      expect(store.workspaceId).toBe(
        normalizeProjectWikiWorkspaceId(basename(workspaceRoot)),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns early for unavailable stores across all public helpers', async () => {
    const unavailable = resolveProjectWikiStore(null);

    expect(await ensureProjectWikiStore(unavailable)).toBe(unavailable);
    expect(await readProjectWikiIndex(unavailable)).toBeNull();
    expect(await readProjectWikiPage(unavailable, 'characters/hero')).toBeNull();
    expect(
      await writeProjectWikiPage(unavailable, {
        workspaceId: '',
        title: 'Ignored',
        slug: 'ignored',
        body: 'ignored',
      }),
    ).toBeNull();
    expect(await writeProjectWikiRawEvidence(unavailable, './note.md', 'ignored')).toBeNull();
    expect(await appendProjectWikiLog(unavailable, { type: 'ignored' })).toBeNull();
  });

  it('normalizes malformed index data and blank page workspace ids', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-index-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      await ensureProjectWikiStore(store);
      await writeFile(
        store.paths.indexFile,
        `${JSON.stringify({
          schemaVersion: '   ',
          workspaceId: '   ',
          pages: [
            {
              id: 'page-1',
              slug: 'characters/hero',
              title: '   ',
              filePath: 'characters/hero.md',
              status: '   ',
            },
            {
              id: '   ',
              slug: 'broken-entry',
              filePath: 'broken-entry.md',
            },
          ],
        }, null, 2)}\n`,
        'utf8',
      );

      const index = await readProjectWikiIndex(store);
      expect(index).toEqual({
        schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
        workspaceId: 'atlas-project',
        pages: [
          {
            id: 'page-1',
            slug: 'characters/hero',
            title: 'characters/hero',
            filePath: 'characters/hero.md',
            status: 'curated',
          },
        ],
      });

      const pageResult = await writeProjectWikiPage(store, {
        workspaceId: '',
        title: '   ',
        slug: 'fallback/page',
        idSeed: 'fallback-seed',
        body: '  trimmed body  ',
      });

      expect(pageResult?.frontmatter.workspaceId).toBe('atlas-project');
      expect(pageResult?.frontmatter.title).toBe('page');
      expect(pageResult?.frontmatter.slug).toBe('fallback/page');
      expect(pageResult?.markdown).toContain('\n\ntrimmed body\n');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('falls back to an empty page list when persisted pages are not an array', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-pages-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      await ensureProjectWikiStore(store);
      await writeFile(
        store.paths.indexFile,
        `${JSON.stringify({
          schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
          workspaceId: 'atlas-project',
          pages: { broken: true },
        }, null, 2)}\n`,
        'utf8',
      );

      const index = await readProjectWikiIndex(store);
      expect(index).toEqual({
        schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
        workspaceId: 'atlas-project',
        pages: [],
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('falls back to the default index when the persisted index is unreadable', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-bad-index-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      await ensureProjectWikiStore(store);
      await writeFile(store.paths.indexFile, '{not-valid-json', 'utf8');

      await rm(store.paths.logFile, { force: true });
      const logEntry = await appendProjectWikiLog(store, { type: 'recreated-log' });

      expect(logEntry).toContain('"type":"recreated-log"');

      const index = await readProjectWikiIndex(store);
      expect(index).toEqual({
        schemaVersion: PROJECT_WIKI_SCHEMA_VERSION,
        workspaceId: 'atlas-project',
        pages: [],
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns null for missing pages and normalizes orphan raw evidence paths', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-raw-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      await ensureProjectWikiStore(store);

      expect(await readProjectWikiPage(store, 'missing/page')).toBeNull();

      const rawPath = await writeProjectWikiRawEvidence(store, './../', 'Detached note');
      expect(rawPath).toBe(path.join(store.paths.rawDir, 'unclassified.md'));
      expect(await readFile(rawPath!, 'utf8')).toBe('Detached note');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
