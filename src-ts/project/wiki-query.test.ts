import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createProjectWikiPageId } from './wiki-schema.js';
import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import { queryProjectWikiCanon } from './wiki-query.js';
import { resolveProjectWikiStore, writeProjectWikiPage } from './wiki-store.js';

describe('project wiki query', () => {
  it('returns an explicit unavailable result when the workspace has no wiki root', async () => {
    const workspace = createDefaultProjectWorkspaceContext();

    await expect(queryProjectWikiCanon(workspace, 'Atlas')).resolves.toEqual({
      available: false,
      reason: 'missing-workspace-root',
      query: 'Atlas',
      workspaceId: null,
      totalPages: 0,
      matches: [],
    });
  });

  it('ranks relevant canon pages and returns excerpts with authority metadata', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-query-'));

    try {
      const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
      const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
      expect(store.available).toBe(true);
      if (!store.available) return;

      await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Hero Profile',
        slug: 'characters/atlas-hero-profile',
        idSeed: 'story-bible:hero-7',
        promotedFrom: 'story-bible',
        body: [
          'Atlas is the primary protagonist of the project canon.',
          'He protects the city archives and carries the atlas sigil.',
        ].join(' '),
      });

      await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Crew Manifest',
        slug: 'teams/atlas-crew-manifest',
        idSeed: 'story-bible:crew-1',
        promotedFrom: 'manual',
        body: 'The Atlas crew supports supply runs and city logistics.',
      });

      await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Draft Notes',
        slug: 'drafts/atlas-draft-notes',
        idSeed: 'chat:atlas-draft-1',
        promotedFrom: 'chat',
        status: 'draft',
        body: 'Atlas notes mention the hero in passing but do not define the protagonist arc.',
      });

      const result = await queryProjectWikiCanon(workspace, 'Atlas protagonist');

      expect(result.available).toBe(true);
      if (!result.available) return;

      expect(result.workspaceId).toBe(workspace.identity.workspaceId);
      expect(result.totalPages).toBe(3);
      expect(result.matches).toHaveLength(3);
      expect(result.matches.map((match) => match.slug)).toEqual([
        'characters/atlas-hero-profile',
        'drafts/atlas-draft-notes',
        'teams/atlas-crew-manifest',
      ]);

      expect(result.matches[0]).toMatchObject({
        pageId: createProjectWikiPageId('story-bible:hero-7'),
        slug: 'characters/atlas-hero-profile',
        title: 'Atlas Hero Profile',
        filePath: 'characters/atlas-hero-profile.md',
        authority: {
          workspaceId: workspace.identity.workspaceId,
          scopeAuthority: 'workspace',
          canonAuthority: 'canon-page',
          projectionAuthority: 'derived',
          promotion: 'manual',
          promotedFrom: 'story-bible',
          status: 'curated',
        },
      });
      expect(result.matches[0].score).toBeGreaterThan(result.matches[1].score);
      expect(result.matches[0].excerpt).toContain('primary protagonist');
      expect(result.matches[0].excerpt).toContain('project canon');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
