import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createProjectWikiKnowledgeLayer } from './wiki-knowledge-layer.js';
import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import { writeProjectWikiProjectionSnapshot } from './wiki-projection.js';
import { resolveProjectWikiStore, writeProjectWikiPage } from './wiki-store.js';

describe('project wiki knowledge layer', () => {
  it('degrades cleanly when the workspace has no canon store', async () => {
    const workspace = createDefaultProjectWorkspaceContext();
    const knowledgeLayer = createProjectWikiKnowledgeLayer(workspace);

    await expect(knowledgeLayer.search_entities('Atlas')).resolves.toEqual([]);
    await expect(knowledgeLayer.get_related_entities('wpg_atlas')).resolves.toEqual([]);
    await expect(knowledgeLayer.search_memories('Atlas')).resolves.toEqual([]);
  });

  it('returns canon-first entity results from the workspace wiki store', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-knowledge-entities-'));

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
        body: 'Atlas is the protagonist who protects the city archives from smugglers.',
      });

      await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Old Harbor',
        slug: 'locations/old-harbor',
        idSeed: 'manual:old-harbor',
        promotedFrom: 'manual',
        body: 'Old Harbor is a fog-heavy dock district where Atlas tracks the smugglers.',
      });

      const knowledgeLayer = createProjectWikiKnowledgeLayer(workspace);
      const entities = await knowledgeLayer.search_entities('Atlas smugglers', { limit: 4 });

      expect(entities).toHaveLength(2);
      expect(entities[0]).toMatchObject({
        name: 'Atlas Hero Profile',
        origin: 'wiki-canon',
        slug: 'characters/atlas-hero-profile',
        type: 'character',
      });
      expect(entities[0]?.description).toContain('protagonist');
      expect(entities[0]?.authority).toMatchObject({
        canonAuthority: 'canon-page',
        scopeAuthority: 'workspace',
        workspaceId: workspace.identity.workspaceId,
      });

      expect(entities[1]).toMatchObject({
        name: 'Old Harbor',
        slug: 'locations/old-harbor',
        type: 'location',
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('surfaces projection-derived relations and memory context without making projections authoritative', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-knowledge-projections-'));

    try {
      const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
      const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
      expect(store.available).toBe(true);
      if (!store.available) return;

      const heroPage = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Hero Profile',
        slug: 'characters/atlas-hero-profile',
        idSeed: 'story-bible:hero-7',
        promotedFrom: 'story-bible',
        body: [
          'Atlas protects the city archives and hides the atlas sigil when danger closes in.',
          'He keeps watch over Old Harbor whenever contraband enters the city.',
        ].join(' '),
      });
      expect(heroPage).not.toBeNull();
      if (!heroPage) return;

      await writeProjectWikiProjectionSnapshot(store, {
        kind: 'graph',
        page: heroPage.frontmatter,
        snapshot: {
          nodes: [
            {
              id: heroPage.frontmatter.id,
              name: 'Atlas',
              type: 'character',
            },
            {
              id: 'loc:old-harbor',
              name: 'Old Harbor',
              type: 'location',
            },
          ],
          edges: [
            {
              source: heroPage.frontmatter.id,
              target: 'loc:old-harbor',
              type: 'protects',
            },
          ],
        },
      });

      await writeProjectWikiProjectionSnapshot(store, {
        kind: 'memory',
        page: heroPage.frontmatter,
        snapshot: {
          summary: 'Atlas keeps a private oath to defend the archives.',
          memories: [
            {
              id: 'memory-1',
              content: 'Atlas once hid the atlas sigil in Old Harbor before the raid.',
            },
          ],
        },
      });

      const knowledgeLayer = createProjectWikiKnowledgeLayer(workspace);
      const relations = await knowledgeLayer.get_related_entities(heroPage.frontmatter.id);
      const memories = await knowledgeLayer.search_memories('Atlas archives', { limit: 4 });

      expect(relations).toEqual([
        expect.objectContaining({
          canonAuthority: 'canon-page',
          origin: 'wiki-projection-graph',
          pageId: heroPage.frontmatter.id,
          projectionAuthority: 'derived',
          source: 'Atlas',
          sourceId: heroPage.frontmatter.id,
          target: 'Old Harbor',
          targetId: 'loc:old-harbor',
          type: 'protects',
          workspaceId: workspace.identity.workspaceId,
        }),
      ]);

      expect(memories[0]).toMatchObject({
        authority: {
          canonAuthority: 'canon-page',
          workspaceId: workspace.identity.workspaceId,
        },
        origin: 'wiki-canon',
        pageId: heroPage.frontmatter.id,
        title: 'Atlas Hero Profile',
      });
      expect(memories[0]?.content).toContain('Atlas Hero Profile');
      expect(memories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            origin: 'wiki-projection-memory',
            pageId: heroPage.frontmatter.id,
            projectionAuthority: 'derived',
            projectionId: `memory:${heroPage.frontmatter.id}`,
          }),
        ]),
      );
      expect(memories.some((memory) => memory.content.includes('private oath'))).toBe(true);
      expect(memories.some((memory) => memory.content.includes('atlas sigil in Old Harbor'))).toBe(true);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
