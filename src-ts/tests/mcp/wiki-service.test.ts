import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ProjectWorkspaceContext } from '../../project/workspace-model.js';

function buildWorkspace(workspaceRoot: string | null): ProjectWorkspaceContext {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas',
      workspaceRoot,
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-1',
      chapterTitle: 'Arrival',
      chapterNumber: 1,
    },
    storyBible: {
      storyBibleId: null,
      draftId: 'draft-1',
      version: null,
      storage: 'workspace',
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
    },
    workflow: {
      sessionId: 'session-1',
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: 'conversation-1',
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

describe('mcp wiki service', () => {
  let workspaceRoot = '';

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceRoot = '';
    }
  });

  it('promotes workspace content into canon with raw evidence and inspectable review results', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-'));

    const {
      listProjectWikiCanonPages,
      promoteProjectWikiCanon,
      readProjectWikiCanonPage,
    } = await import('../../mcp/services/wiki.js');

    const workspace = buildWorkspace(workspaceRoot);
    const promotion = await promoteProjectWikiCanon({
      workspace,
      title: 'Atlas Hero Profile',
      slug: 'characters/atlas-hero-profile',
      idSeed: 'story-bible:hero-7',
      promotedFrom: 'story-bible',
      sourceId: 'hero-7',
      sourceRef: 'story-bible.characters.hero-7',
      body: 'Atlas is the primary protagonist.',
      rawEvidence: {
        relativePath: 'imports/story-bible/hero-7.md',
        content: 'Hero source note',
      },
      metadata: {
        section: 'characters',
      },
    });

    expect(promotion).toMatchObject({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: {
        slug: 'characters/atlas-hero-profile',
        title: 'Atlas Hero Profile',
        status: 'curated',
        promoted_from: 'story-bible',
      },
    });
    expect(promotion.page?.markdown).toContain('Atlas is the primary protagonist.');
    expect(promotion.raw_evidence_path).toContain('.writing');
    expect(await readFile(String(promotion.raw_evidence_path), 'utf8')).toBe('Hero source note');
    expect(promotion.log_entry).toMatchObject({
      type: 'promotion',
      promoted_from: 'story-bible',
      source_id: 'hero-7',
      source_ref: 'story-bible.characters.hero-7',
      raw_evidence_path: promotion.raw_evidence_path,
    });

    const listed = await listProjectWikiCanonPages({ workspace });
    expect(listed).toEqual({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      total_pages: 1,
      pages: [
        {
          id: promotion.page?.id,
          slug: 'characters/atlas-hero-profile',
          title: 'Atlas Hero Profile',
          status: 'curated',
          file_path: 'characters/atlas-hero-profile.md',
        },
      ],
    });

    const page = await readProjectWikiCanonPage({
      workspace,
      slug: 'characters/atlas-hero-profile',
    });
    expect(page).toMatchObject({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: {
        id: promotion.page?.id,
        slug: 'characters/atlas-hero-profile',
        title: 'Atlas Hero Profile',
        status: 'curated',
        file_path: 'characters/atlas-hero-profile.md',
      },
    });
    expect(page.page?.markdown).toContain('promotion: "manual"');
  });

  it('returns explicit unavailable results when the workspace root is missing', async () => {
    const {
      listProjectWikiCanonPages,
      promoteProjectWikiCanon,
    } = await import('../../mcp/services/wiki.js');

    const workspace = buildWorkspace(null);
    expect(await listProjectWikiCanonPages({ workspace })).toEqual({
      available: false,
      reason: 'missing-workspace-root',
      workspace_id: null,
      total_pages: 0,
      pages: [],
    });
    expect(await promoteProjectWikiCanon({
      workspace,
      title: 'Missing Root',
      body: 'No workspace root is available.',
    })).toEqual({
      available: false,
      reason: 'missing-workspace-root',
      workspace_id: null,
      page: null,
      raw_evidence_path: null,
      log_entry: null,
    });
  });

  it('returns page-not-found for review reads that do not exist', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-missing-'));

    const { readProjectWikiCanonPage } = await import('../../mcp/services/wiki.js');

    expect(await readProjectWikiCanonPage({
      workspace: buildWorkspace(workspaceRoot),
      slug: 'missing/page',
    })).toEqual({
      available: true,
      reason: 'page-not-found',
      workspace_id: 'atlas-workspace',
      page: null,
    });
  });

  it('lists pages filtered by status', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-filter-'));

    const {
      listProjectWikiCanonPages,
      promoteProjectWikiCanon,
    } = await import('../../mcp/services/wiki.js');

    const workspace = buildWorkspace(workspaceRoot);

    // Create a curated page
    await promoteProjectWikiCanon({
      workspace,
      title: 'Curated Page',
      slug: 'curated/page',
      idSeed: 'curated-1',
      body: 'Curated content',
      status: 'curated',
    });

    // Create a draft page
    await promoteProjectWikiCanon({
      workspace,
      title: 'Draft Page',
      slug: 'draft/page',
      idSeed: 'draft-1',
      body: 'Draft content',
      status: 'draft',
    });

    const allPages = await listProjectWikiCanonPages({ workspace });
    expect(allPages.total_pages).toBe(2);

    const curatedOnly = await listProjectWikiCanonPages({ workspace, status: 'curated' });
    expect(curatedOnly.total_pages).toBe(2);
    expect(curatedOnly.pages.length).toBeGreaterThanOrEqual(1);

    const draftOnly = await listProjectWikiCanonPages({ workspace, status: 'draft' });
    expect(draftOnly.total_pages).toBe(2);
    expect(draftOnly.pages.length).toBeGreaterThanOrEqual(1);
  });

  it('applies limit to page listing', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-limit-'));

    const {
      listProjectWikiCanonPages,
      promoteProjectWikiCanon,
    } = await import('../../mcp/services/wiki.js');

    const workspace = buildWorkspace(workspaceRoot);

    await promoteProjectWikiCanon({
      workspace,
      title: 'Page A',
      slug: 'page-a',
      idSeed: 'page-a',
      body: 'Content A',
    });

    await promoteProjectWikiCanon({
      workspace,
      title: 'Page B',
      slug: 'page-b',
      idSeed: 'page-b',
      body: 'Content B',
    });

    const limited = await listProjectWikiCanonPages({ workspace, limit: 1 });
    expect(limited.total_pages).toBe(2);
    expect(limited.pages.length).toBe(1);
  });

  it('supports promotion from different sources (story-bible, chat, research, manual)', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-sources-'));

    const { promoteProjectWikiCanon } = await import('../../mcp/services/wiki.js');
    const workspace = buildWorkspace(workspaceRoot);

    const sources = ['story-bible', 'chat', 'research', 'manual'] as const;

    for (const source of sources) {
      const result = await promoteProjectWikiCanon({
        workspace,
        title: `Source ${source} page`,
        slug: `sources/${source}`,
        idSeed: `source-${source}`,
        promotedFrom: source,
        body: `Content from ${source}`,
      });

      expect(result.available).toBe(true);
      expect(result.page?.promoted_from).toBe(source);
    }
  });

  it('handles promotion without raw evidence', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-noevidence-'));

    const { promoteProjectWikiCanon } = await import('../../mcp/services/wiki.js');
    const workspace = buildWorkspace(workspaceRoot);

    const result = await promoteProjectWikiCanon({
      workspace,
      title: 'No Evidence Page',
      slug: 'no-evidence/page',
      idSeed: 'no-ev-1',
      body: 'Page without raw evidence',
      rawEvidence: null,
    });

    expect(result.available).toBe(true);
    expect(result.raw_evidence_path).toBeNull();
    expect(result.page?.markdown).toContain('No Evidence Page');
  });

  it('stores metadata on promoted pages', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-wiki-service-metadata-'));

    const { promoteProjectWikiCanon } = await import('../../mcp/services/wiki.js');
    const workspace = buildWorkspace(workspaceRoot);

    const metadata = { section: 'characters', tags: ['protagonist', 'main'], priority: 1 };
    const result = await promoteProjectWikiCanon({
      workspace,
      title: 'Metadata Page',
      slug: 'metadata/page',
      idSeed: 'meta-1',
      body: 'Page with metadata',
      metadata,
    });

    expect(result.available).toBe(true);
    expect(result.log_entry).toBeTruthy();
    expect(result.log_entry?.metadata).toEqual(metadata);
  });
});
