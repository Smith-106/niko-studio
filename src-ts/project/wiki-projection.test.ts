import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectWikiProjectionRecord,
  projectWikiProjectionSnapshotPath,
  readProjectWikiProjectionSnapshot,
  writeProjectWikiProjectionSnapshot,
} from './wiki-projection.js';
import { createProjectWikiPageFrontmatter } from './wiki-schema.js';
import { resolveProjectWikiStore } from './wiki-store.js';

describe('project wiki projection helpers', () => {
  it('creates inspectable graph and memory projection records from canon pages', () => {
    const page = createProjectWikiPageFrontmatter({
      workspaceId: 'Atlas Project',
      title: 'Atlas Hero Profile',
      slug: 'characters/atlas-hero-profile',
      idSeed: 'story-bible:hero-7',
      promotedFrom: 'story-bible',
    });

    const graphRecord = createProjectWikiProjectionRecord({
      kind: 'graph',
      page,
      snapshot: {
        entityIds: ['hero-7'],
      },
    });
    const memoryRecord = createProjectWikiProjectionRecord({
      kind: 'memory',
      page,
      snapshot: {
        memoryIds: ['memory-7'],
      },
    });

    expect(graphRecord).toEqual({
      schemaVersion: '2026-04-10',
      projectionId: `graph:${page.id}`,
      kind: 'graph',
      workspaceId: 'atlas-project',
      filePath: `.writing/wiki/projections/graph/${page.id}.json`,
      projectionAuthority: 'derived',
      sourcePage: {
        id: page.id,
        slug: 'characters/atlas-hero-profile',
        title: 'Atlas Hero Profile',
        filePath: 'characters/atlas-hero-profile.md',
        canonAuthority: 'canon-page',
      },
      snapshot: {
        entityIds: ['hero-7'],
      },
    });
    expect(memoryRecord.projectionId).toBe(`memory:${page.id}`);
    expect(memoryRecord.filePath).toBe(`.writing/wiki/projections/memory/${page.id}.json`);
    expect(memoryRecord.projectionAuthority).toBe('derived');
  });

  it('computes deterministic projection snapshot paths from stable page identifiers', () => {
    expect(projectWikiProjectionSnapshotPath('graph', ' wpg_hero-7 ')).toBe(
      '.writing/wiki/projections/graph/wpg_hero-7.json',
    );
    expect(projectWikiProjectionSnapshotPath('memory', 'wpg_hero-7')).toBe(
      '.writing/wiki/projections/memory/wpg_hero-7.json',
    );
  });

  it('writes and reads inspectable projection snapshots under the wiki store', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-projection-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      const page = createProjectWikiPageFrontmatter({
        workspaceId: 'Atlas Project',
        title: 'Atlas Hero Profile',
        slug: 'characters/atlas-hero-profile',
        idSeed: 'story-bible:hero-7',
        promotedFrom: 'story-bible',
      });

      const graphResult = await writeProjectWikiProjectionSnapshot(store, {
        kind: 'graph',
        page,
        snapshot: {
          nodes: [{ id: 'hero-7' }],
          edges: [],
        },
      });
      const memoryResult = await writeProjectWikiProjectionSnapshot(store, {
        kind: 'memory',
        page,
        snapshot: {
          memoryIds: ['memory-7'],
        },
      });

      expect(graphResult?.path).toBe(
        join(workspaceRoot, projectWikiProjectionSnapshotPath('graph', page.id)),
      );
      expect(memoryResult?.path).toBe(
        join(workspaceRoot, projectWikiProjectionSnapshotPath('memory', page.id)),
      );

      const serializedGraph = await readFile(graphResult!.path, 'utf8');
      expect(serializedGraph).toContain('"projectionAuthority": "derived"');
      expect(serializedGraph).toContain('"canonAuthority": "canon-page"');

      expect(
        await readProjectWikiProjectionSnapshot<{
          nodes: Array<{ id: string }>;
          edges: unknown[];
        }>(store, 'graph', page.id),
      ).toEqual(graphResult?.record);
      expect(
        await readProjectWikiProjectionSnapshot<{ memoryIds: string[] }>(store, 'memory', page.id),
      ).toEqual(memoryResult?.record);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
