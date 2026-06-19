import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectWikiProjectionId,
  createProjectWikiProjectionRecord,
  readProjectWikiProjectionSnapshot,
  writeProjectWikiProjectionSnapshot,
} from './wiki-projection.js';
import {
  projectWikiProjectionFilePath,
  projectWikiSlugToFilePath,
} from './wiki-schema.js';
import { resolveProjectWikiStore } from './wiki-store.js';

describe('project wiki projection additional coverage', () => {
  it('falls back to projection defaults when page identifiers and titles are blank', () => {
    const record = createProjectWikiProjectionRecord({
      kind: 'graph',
      page: {
        id: '   ',
        slug: '  Characters/Hero  ',
        title: '   ',
        workspaceId: ' Atlas Workspace ',
        canonAuthority: 'invalid-authority' as never,
        projectionAuthority: 'invalid-authority' as never,
      },
      snapshot: {
        nodes: 1,
      },
    });

    expect(createProjectWikiProjectionId('memory', '   ')).toBe('memory:projection');
    expect(record.projectionId).toBe('graph:projection');
    expect(record.workspaceId).toBe('atlas-workspace');
    expect(record.projectionAuthority).toBe('derived');
    expect(record.sourcePage).toEqual({
      id: 'projection',
      slug: 'characters/hero',
      title: 'characters/hero',
      filePath: projectWikiSlugToFilePath('characters/hero'),
      canonAuthority: 'canon-page',
    });
  });

  it('returns null when projection snapshots are unavailable or missing', async () => {
    const unavailableStore = resolveProjectWikiStore(null, 'atlas');
    expect(await writeProjectWikiProjectionSnapshot(unavailableStore, {
      kind: 'graph',
      page: {
        id: 'page-1',
        slug: 'characters/page-1',
        title: 'Page 1',
        workspaceId: 'atlas',
        canonAuthority: 'canon-page',
        projectionAuthority: 'derived',
      },
      snapshot: {},
    })).toBeNull();
    expect(await readProjectWikiProjectionSnapshot(unavailableStore, 'graph', 'page-1')).toBeNull();

    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-projection-missing-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'atlas');
      expect(await readProjectWikiProjectionSnapshot(store, 'memory', 'missing-page')).toBeNull();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns null for malformed or invalid projection snapshot payloads', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-projection-invalid-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'atlas');
      if (!store.available) {
        throw new Error('expected available store');
      }

      const wikiRoot = join(workspaceRoot, '.writing', 'wiki');
      await mkdir(join(wikiRoot, 'projections', 'graph'), { recursive: true });

      const malformedPath = join(wikiRoot, projectWikiProjectionFilePath('graph', 'page-bad-json'));
      await writeFile(malformedPath, '{bad json', 'utf8');
      expect(await readProjectWikiProjectionSnapshot(store, 'graph', 'page-bad-json')).toBeNull();

      const invalidRecordPath = join(wikiRoot, projectWikiProjectionFilePath('graph', 'page-invalid'));
      await writeFile(invalidRecordPath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-invalid',
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-invalid.json',
        projectionAuthority: 'derived',
        sourcePage: {
          id: 'page-invalid',
          slug: 'characters/invalid',
          title: 'Invalid',
          filePath: 'characters/invalid.md',
          canonAuthority: 'not-canon',
        },
        snapshot: {},
      })}\n`, 'utf8');

      expect(await readProjectWikiProjectionSnapshot(store, 'graph', 'page-invalid')).toBeNull();

      const nonRecordPath = join(wikiRoot, projectWikiProjectionFilePath('graph', 'page-non-record'));
      await writeFile(nonRecordPath, '42\n', 'utf8');
      expect(await readProjectWikiProjectionSnapshot(store, 'graph', 'page-non-record')).toBeNull();

      const missingFieldPath = join(wikiRoot, projectWikiProjectionFilePath('graph', 'page-missing-field'));
      await writeFile(missingFieldPath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-missing-field',
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-missing-field.json',
        projectionAuthority: 'derived',
        sourcePage: {
          id: 'page-missing-field',
          slug: 'characters/missing-field',
          title: 'Missing Field',
          filePath: '   ',
          canonAuthority: 'canon-page',
        },
        snapshot: {},
      })}\n`, 'utf8');

      expect(await readProjectWikiProjectionSnapshot(store, 'graph', 'page-missing-field')).toBeNull();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
