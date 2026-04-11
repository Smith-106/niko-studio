import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('project wiki store', () => {
  it('returns an explicit unavailable result when workspaceRoot is missing', () => {
    expect(resolveProjectWikiStore(null)).toEqual({
      available: false,
      reason: 'missing-workspace-root',
      workspaceRoot: null,
      workspaceId: null,
      paths: null,
    });
  });

  it('creates the minimal canon layout for an available workspace root', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-store-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      await ensureProjectWikiStore(store);

      const indexContent = await readFile(store.paths.indexFile, 'utf8');
      const logContent = await readFile(store.paths.logFile, 'utf8');
      const graphProjectionDir = await stat(store.paths.graphProjectionDir);
      const memoryProjectionDir = await stat(store.paths.memoryProjectionDir);

      expect(store.workspaceId).toBe('atlas-project');
      expect(indexContent).toContain('"workspaceId": "atlas-project"');
      expect(logContent).toBe('');
      expect(graphProjectionDir.isDirectory()).toBe(true);
      expect(memoryProjectionDir.isDirectory()).toBe(true);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('writes canon pages, raw evidence, and append-only log entries', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-page-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      const pageResult = await writeProjectWikiPage(store, {
        workspaceId: 'Atlas Project',
        title: 'Atlas Hero Profile',
        slug: 'characters/atlas-hero-profile',
        idSeed: 'story-bible:hero-7',
        promotedFrom: 'story-bible',
        body: 'Atlas is the primary protagonist.',
      });

      expect(pageResult?.frontmatter.slug).toBe('characters/atlas-hero-profile');
      const markdown = await readProjectWikiPage(store, 'characters/atlas-hero-profile');
      expect(markdown).toContain('Atlas is the primary protagonist.');
      expect(markdown).toContain('promotion: "manual"');

      const rawPath = await writeProjectWikiRawEvidence(
        store,
        'imports/story-bible/hero-7.md',
        'Hero source note',
      );
      expect(rawPath).toContain('.writing');
      expect(await readFile(rawPath!, 'utf8')).toBe('Hero source note');

      await appendProjectWikiLog(store, {
        type: 'promotion',
        pageId: pageResult?.frontmatter.id,
        source: 'story-bible',
      });

      const index = await readProjectWikiIndex(store);
      const indexContent = await readFile(store.paths.indexFile, 'utf8');
      const logContent = await readFile(store.paths.logFile, 'utf8');

      expect(index?.pages).toEqual([
        {
          id: pageResult?.frontmatter.id,
          slug: 'characters/atlas-hero-profile',
          title: 'Atlas Hero Profile',
          filePath: 'characters/atlas-hero-profile.md',
          status: 'curated',
        },
      ]);
      expect(indexContent).toContain('"slug": "characters/atlas-hero-profile"');
      expect(logContent).toContain('"type":"promotion"');
      expect(logContent).toContain('"workspaceId":"atlas-project"');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
