import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readProjectWikiProjectionSnapshot,
} from './wiki-projection.js';
import { resolveProjectWikiStore } from './wiki-store.js';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('node:path');
});

describe('project wiki projection branch gaps', () => {
  it('covers parser fallbacks for non-string fields, missing source pages, invalid kinds, and nullish snapshots', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-projection-branch-gaps-'));
    try {
      const store = resolveProjectWikiStore(workspaceRoot, 'atlas');
      if (!store.available) {
        throw new Error('expected available store');
      }

      const wikiRoot = join(workspaceRoot, '.writing', 'wiki');
      await mkdir(join(wikiRoot, 'projections', 'graph'), { recursive: true });

      const invalidProjectionPath = join(wikiRoot, 'projections', 'graph', 'page-invalid-projection.json');
      await writeFile(invalidProjectionPath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 42,
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-invalid-projection.json',
        projectionAuthority: 'source',
        sourcePage: {
          id: 'page-invalid-projection',
          slug: 'characters/invalid-projection',
          title: 'Invalid Projection',
          filePath: 'characters/invalid-projection.md',
          canonAuthority: 'canon-page',
        },
        snapshot: {},
      })}\n`, 'utf8');
      expect(
        await readProjectWikiProjectionSnapshot(store, 'graph', 'page-invalid-projection'),
      ).toBeNull();

      const missingSourcePath = join(wikiRoot, 'projections', 'graph', 'page-missing-source.json');
      await writeFile(missingSourcePath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-missing-source',
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-missing-source.json',
        projectionAuthority: 'derived',
        sourcePage: 'not-an-object',
        snapshot: {},
      })}\n`, 'utf8');
      expect(
        await readProjectWikiProjectionSnapshot(store, 'graph', 'page-missing-source'),
      ).toBeNull();

      const invalidKindPath = join(wikiRoot, 'projections', 'graph', 'page-invalid-kind.json');
      await writeFile(invalidKindPath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-invalid-kind',
        kind: 'note',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-invalid-kind.json',
        projectionAuthority: 'derived',
        sourcePage: {
          id: 'page-invalid-kind',
          slug: 'characters/invalid-kind',
          title: 'Invalid Kind',
          filePath: 'characters/invalid-kind.md',
          canonAuthority: 'canon-page',
        },
        snapshot: {},
      })}\n`, 'utf8');
      expect(
        await readProjectWikiProjectionSnapshot(store, 'graph', 'page-invalid-kind'),
      ).toBeNull();

      const missingSnapshotPath = join(wikiRoot, 'projections', 'graph', 'page-missing-snapshot.json');
      await writeFile(missingSnapshotPath, `${JSON.stringify({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-missing-snapshot',
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-missing-snapshot.json',
        projectionAuthority: 'derived',
        sourcePage: {
          id: 'page-missing-snapshot',
          slug: 'characters/missing-snapshot',
          title: 'Missing Snapshot',
          filePath: 'characters/missing-snapshot.md',
          canonAuthority: 'canon-page',
        },
      })}\n`, 'utf8');

      expect(
        await readProjectWikiProjectionSnapshot<{ marker: string }>(
          store,
          'graph',
          'page-missing-snapshot',
        ),
      ).toEqual({
        schemaVersion: '2026-04-10',
        projectionId: 'graph:page-missing-snapshot',
        kind: 'graph',
        workspaceId: 'atlas',
        filePath: '.writing/wiki/projections/graph/page-missing-snapshot.json',
        projectionAuthority: 'derived',
        sourcePage: {
          id: 'page-missing-snapshot',
          slug: 'characters/missing-snapshot',
          title: 'Missing Snapshot',
          filePath: 'characters/missing-snapshot.md',
          canonAuthority: 'canon-page',
        },
        snapshot: null,
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns null when the resolved projection snapshot path is empty', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-projection-empty-target-'));
    try {
      const availableStore = resolveProjectWikiStore(workspaceRoot, 'atlas');
      if (!availableStore.available) {
        throw new Error('expected available store');
      }

      vi.resetModules();
      vi.doMock('node:path', async () => {
        const actual = await vi.importActual<typeof import('node:path')>('node:path');
        const mockedJoin = (...parts: string[]) => (
          parts[0] === 'force-empty-root' ? '' : actual.join(...parts)
        );
        return {
          ...actual,
          join: mockedJoin,
          default: {
            ...actual,
            join: mockedJoin,
          },
        };
      });

      const { writeProjectWikiProjectionSnapshot } = await import('./wiki-projection.js');

      const store = {
        ...availableStore,
        workspaceRoot: 'force-empty-root',
      };

      await expect(
        writeProjectWikiProjectionSnapshot(store, {
          kind: 'graph',
          page: {
            id: 'page-empty-target',
            slug: 'characters/page-empty-target',
            title: 'Page Empty Target',
            workspaceId: 'atlas',
            canonAuthority: 'canon-page',
            projectionAuthority: 'derived',
          },
          snapshot: { marker: true },
        }),
      ).resolves.toBeNull();
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
