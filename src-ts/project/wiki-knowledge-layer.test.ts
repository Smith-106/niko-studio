import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectWikiFactPacketBundle,
  createProjectWikiFactPacketBundleFromCanonMatches,
  createProjectWikiKnowledgeLayer,
} from './wiki-knowledge-layer.js';
import type { ProjectWikiQueryAuthorityMetadata, ProjectWikiQueryMatch } from './wiki-query.js';
import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import { writeProjectWikiProjectionSnapshot } from './wiki-projection.js';
import { resolveProjectWikiStore, writeProjectWikiPage } from './wiki-store.js';

describe('project wiki knowledge layer', () => {
  const authority: ProjectWikiQueryAuthorityMetadata = {
    workspaceId: 'workspace-a',
    scopeAuthority: 'workspace',
    canonAuthority: 'canon-page',
    projectionAuthority: 'derived',
    promotion: 'manual',
    promotedFrom: 'manual',
    status: 'curated',
  };

  it('degrades cleanly when the workspace has no canon store', async () => {
    const workspace = createDefaultProjectWorkspaceContext();
    const knowledgeLayer = createProjectWikiKnowledgeLayer(workspace);

    await expect(knowledgeLayer.search_entities('Atlas')).resolves.toEqual([]);
    await expect(knowledgeLayer.search_entities('   ')).resolves.toEqual([]);
    await expect(knowledgeLayer.get_related_entities('wpg_atlas')).resolves.toEqual([]);
    await expect(knowledgeLayer.get_related_entities('   ')).resolves.toEqual([]);
    await expect(knowledgeLayer.search_memories('Atlas')).resolves.toEqual([]);
    await expect(knowledgeLayer.search_memories('   ')).resolves.toEqual([]);
  });

  it('creates fact packet bundles for entity, relation, memory, and canon-match inputs', () => {
    const workspace = createDefaultProjectWorkspaceContext({ fallbackProjectId: 'packet-project' });
    const bundle = createProjectWikiFactPacketBundle(workspace, 'Atlas archive', {
      entities: [
        {
          authority,
          description: '',
          filePath: '.writing/wiki/pages/libraries/hidden-archive.md',
          id: 'entity-1',
          name: 'Hidden Archive',
          origin: 'wiki-canon',
          pageId: 'page-entity',
          score: 0.77,
          slug: 'libraries/hidden-archive',
          type: 'library',
        },
      ],
      relations: [
        {
          canonAuthority: 'canon-page',
          id: 'relation-1',
          origin: 'wiki-projection-graph',
          pageId: 'page-entity',
          projectionAuthority: 'derived',
          projectionId: 'graph:page-entity',
          source: 'Hidden Archive',
          sourceId: 'entity-1',
          target: 'Old Harbor',
          targetId: 'location-1',
          type: 'guards',
          workspaceId: 'workspace-relation',
        },
        {
          canonAuthority: 'canon-page',
          id: 'relation-without-workspace',
          origin: 'wiki-projection-graph',
          pageId: 'page-entity',
          projectionAuthority: 'derived',
          projectionId: 'graph:page-entity',
          source: 'Hidden Archive',
          sourceId: 'entity-1',
          target: 'Unbound clue',
          targetId: 'clue-1',
          type: 'mentions',
        } as never,
      ],
      memories: [
        {
          authority: { ...authority, workspaceId: 'workspace-memory' },
          content: 'Atlas hid a key in the old catalog.',
          id: 'memory-1',
          origin: 'wiki-projection-memory',
          pageId: 'page-entity',
          projectionAuthority: 'derived',
          projectionId: 'memory:page-entity',
          title: 'Catalog clue',
        },
      ],
    });

    expect(bundle.counts).toEqual({
      entities: 1,
      relations: 2,
      memories: 1,
      total: 4,
    });
    expect(bundle.workspaceId).toBe(workspace.identity.workspaceId);
    expect(bundle.packets.map((packet) => packet.kind)).toEqual(['entity', 'relation', 'relation', 'memory']);
    expect(bundle.packets[0]).toMatchObject({
      packetId: 'entity:entity-1',
      evidence: [
        expect.objectContaining({
          excerpt: null,
          source: 'wiki-canon',
        }),
      ],
      workspaceId: 'workspace-a',
    });
    expect(bundle.packets[1]).toMatchObject({
      packetId: 'relation:relation-1',
      source: {
        authority: null,
        kind: 'relation',
        origin: 'wiki-projection-graph',
      },
      workspaceId: 'workspace-relation',
    });
    expect(bundle.packets[2]).toMatchObject({
      packetId: 'relation:relation-without-workspace',
      workspaceId: 'workspace',
    });
    expect(bundle.packets[3]).toMatchObject({
      packetId: 'memory:memory-1',
      score: null,
      source: {
        authority: { ...authority, workspaceId: 'workspace-memory' },
        kind: 'memory',
        origin: 'wiki-projection-memory',
      },
      workspaceId: 'workspace-memory',
    });

    const scoredMemoryBundle = createProjectWikiFactPacketBundle(workspace, 'scored memory', {
      memories: [
        {
          authority: { ...authority, workspaceId: '   ' },
          content: 'A scored memory falls back to the generic workspace when authority metadata is blank.',
          id: 'memory-scored',
          origin: 'wiki-projection-memory',
          pageId: 'page-memory-scored',
          score: 0.42,
          title: 'Scored memory',
        } as never,
      ],
    });
    expect(scoredMemoryBundle.packets[0]).toMatchObject({
      packetId: 'memory:memory-scored',
      score: 0.42,
      workspaceId: 'workspace',
    });

    const emptyRetrievedBundle = createProjectWikiFactPacketBundle(workspace, 'nothing yet', {});
    expect(emptyRetrievedBundle.counts).toEqual({
      entities: 0,
      relations: 0,
      memories: 0,
      total: 0,
    });

    const match: ProjectWikiQueryMatch = {
      authority,
      excerpt: 'A library page that should be singularized from its slug segment.',
      filePath: '.writing/wiki/pages/libraries/hidden-archive.md',
      pageId: 'page-library',
      score: 0.5,
      slug: 'libraries/hidden-archive',
      title: 'Hidden Archive Library',
    };
    const canonBundle = createProjectWikiFactPacketBundleFromCanonMatches(
      workspace,
      'library',
      [match],
    );

    expect(canonBundle.counts).toMatchObject({ entities: 1, total: 1 });
    expect(canonBundle.packets[0]?.payload).toMatchObject({
      id: 'page-library',
      type: 'library',
    });

    const pluralBundle = createProjectWikiFactPacketBundleFromCanonMatches(
      workspace,
      'secret',
      [{
        ...match,
        pageId: 'page-secret',
        slug: 'secrets/hidden-key',
        title: 'Hidden Key Secret',
      }],
    );

    expect(pluralBundle.packets[0]?.payload).toMatchObject({
      id: 'page-secret',
      type: 'secret',
    });

    const fallbackBundle = createProjectWikiFactPacketBundleFromCanonMatches(
      workspace,
      'lore',
      [{
        ...match,
        pageId: 'page-lore',
        slug: 'lore/atlas-omen',
        title: 'Atlas Omen Lore',
      }],
    );

    expect(fallbackBundle.packets[0]?.payload).toMatchObject({
      id: 'page-lore',
      type: 'lore',
    });

    const emptySlugBundle = createProjectWikiFactPacketBundleFromCanonMatches(
      workspace,
      'empty slug',
      [{
        ...match,
        pageId: 'page-empty-slug',
        slug: '',
        title: 'Untyped Canon Page',
      }],
    );

    expect(emptySlugBundle.packets[0]?.payload).toMatchObject({
      id: 'page-empty-slug',
      type: 'page',
    });
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

  it('normalizes graph projection fallbacks and memory search limits', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-knowledge-edges-'));

    try {
      const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
      const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
      expect(store.available).toBe(true);
      if (!store.available) return;

      const graphPage = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Graph Edge Cases',
        slug: 'notes/atlas-graph-edge-cases',
        idSeed: 'manual:graph-edge-cases',
        promotedFrom: 'manual',
        body: 'Atlas maps edge cases with labels, relationships, and fallback references.',
      });
      expect(graphPage).not.toBeNull();
      if (!graphPage) return;

      await writeProjectWikiProjectionSnapshot(store, {
        kind: 'graph',
        page: graphPage.frontmatter,
        snapshot: {
          nodes: [
            null,
            { label: 'Missing id' },
            { id: 'missing-label' },
            { entityId: 'mentor', label: 'Mentor Label', summary: 'Mentor summary' },
            { nodeId: 'villain', title: 'Villain Title' },
          ],
          edges: [
            null,
            { source: { label: 'No source id' }, target: 'mentor', type: 'ignored' },
            { source: 'missing-label', target: { id: 'mentor', label: 'Mentor Inline' }, relationship: 'guides' },
            { from: { entityId: 'mentor' }, to: { nodeId: 'villain', title: 'Villain Inline' }, relation: 'warns' },
            { sourceId: graphPage.frontmatter.id, targetId: 'external-target', label: 'points_to' },
            { source: { id: 'inline-only', label: 'Inline Only' }, target: 'mentor', type: 'advises' },
            { source: { id: 'mentor', name: 'Mentor Name' }, target: { id: 'untyped' } },
            { source: 'orphan-only' },
          ],
        },
      });

      const knowledgeLayer = createProjectWikiKnowledgeLayer(workspace);
      const relations = await knowledgeLayer.get_related_entities(graphPage.frontmatter.id);

      expect(relations).toEqual([
        expect.objectContaining({
          source: 'missing-label',
          target: 'Mentor Label',
          type: 'guides',
        }),
        expect.objectContaining({
          source: 'Mentor Label',
          target: 'Villain Title',
          type: 'warns',
        }),
        expect.objectContaining({
          source: 'Atlas Graph Edge Cases',
          target: 'external-target',
          type: 'points_to',
        }),
        expect.objectContaining({
          source: 'Inline Only',
          target: 'Mentor Label',
          type: 'advises',
        }),
        expect.objectContaining({
          source: 'Mentor Label',
          target: 'untyped',
          type: 'related_to',
        }),
      ]);

      const noProjectionPage = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas No Projection Page',
        slug: 'notes/atlas-no-projection-page',
        idSeed: 'manual:no-projection-page',
        promotedFrom: 'manual',
        body: 'Atlas keeps no graph projection for this page.',
      });
      expect(noProjectionPage).not.toBeNull();
      if (!noProjectionPage) return;

      await expect(knowledgeLayer.get_related_entities(noProjectionPage.frontmatter.id)).resolves.toEqual([]);

      const noEdgesPage = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas No Edge Page',
        slug: 'notes/atlas-no-edge-page',
        idSeed: 'manual:no-edge-page',
        promotedFrom: 'manual',
        body: 'Atlas keeps a malformed graph projection nearby.',
      });
      expect(noEdgesPage).not.toBeNull();
      if (!noEdgesPage) return;

      await writeProjectWikiProjectionSnapshot(store, {
        kind: 'graph',
        page: noEdgesPage.frontmatter,
        snapshot: {
          nodes: 'not-an-array',
          edges: 'not-an-array',
        },
      });

      await expect(knowledgeLayer.get_related_entities(noEdgesPage.frontmatter.id)).resolves.toEqual([]);

      const memoryPageA = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Memory A',
        slug: 'notes/atlas-memory-a',
        idSeed: 'manual:memory-a',
        promotedFrom: 'manual',
        body: 'Atlas memory limit seed one.',
      });
      const memoryPageB = await writeProjectWikiPage(store, {
        workspaceId: workspace.identity.workspaceId,
        title: 'Atlas Memory B',
        slug: 'notes/atlas-memory-b',
        idSeed: 'manual:memory-b',
        promotedFrom: 'manual',
        body: 'Cobalt lagoon phrase belongs only to the second memory page.',
      });
      expect(memoryPageA).not.toBeNull();
      expect(memoryPageB).not.toBeNull();
      if (!memoryPageA || !memoryPageB) return;

      await writeProjectWikiProjectionSnapshot(store, {
        kind: 'memory',
        page: memoryPageA.frontmatter,
        snapshot: [
          'direct memory',
          {
            entries: [
              { content: 'direct memory' },
              { snippets: [{ text: 'nested snippet' }] },
              { entries: [{ entries: [{ entries: [{ entries: [{ entries: ['too deep'] }] }] }] }] },
            ],
          },
          null,
        ],
      });

      const limitedMemories = await knowledgeLayer.search_memories('Atlas memory limit', { limit: 2 });
      expect(limitedMemories).toHaveLength(2);
      expect(limitedMemories[0]).toMatchObject({
        origin: 'wiki-canon',
        title: 'Atlas Memory A',
      });
      expect(limitedMemories[1]).toMatchObject({
        content: 'direct memory',
        origin: 'wiki-projection-memory',
      });

      const noProjectionMemories = await knowledgeLayer.search_memories('cobalt lagoon', { limit: 3 });
      expect(noProjectionMemories).toEqual(expect.arrayContaining([
        expect.objectContaining({
          origin: 'wiki-canon',
          title: 'Atlas Memory B',
        }),
      ]));
      expect(noProjectionMemories).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          origin: 'wiki-projection-memory',
          pageId: memoryPageB.frontmatter.id,
        }),
      ]));
      expect(noProjectionMemories.find((memory) => memory.title === 'Atlas Memory B')).toMatchObject({
        origin: 'wiki-canon',
        title: 'Atlas Memory B',
      });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
