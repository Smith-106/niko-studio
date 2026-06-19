import { describe, expect, it } from 'vitest';

import {
  PROJECT_WIKI_AUTHORITY_CONTRACT,
  PROJECT_WIKI_LAYOUT,
  createProjectWikiPageFrontmatter,
  createProjectWikiPageId,
  createProjectWikiPageIdentity,
  isProjectWikiManualPromotionContract,
  normalizeProjectWikiSlug,
  projectWikiProjectionFilePath,
  projectWikiProjectionSnapshotFilename,
  projectWikiPageFrontmatterToMarkdown,
  projectWikiSlugToFilePath,
} from './wiki-schema.js';

describe('project wiki schema', () => {
  it('defines the canonical wiki root layout', () => {
    expect(PROJECT_WIKI_LAYOUT).toEqual({
      rootDir: '.writing/wiki',
      pagesDir: '.writing/wiki/pages',
      rawDir: '.writing/wiki/raw',
      projectionsDir: '.writing/wiki/projections',
      graphProjectionDir: '.writing/wiki/projections/graph',
      memoryProjectionDir: '.writing/wiki/projections/memory',
      indexFile: '.writing/wiki/index.json',
      logFile: '.writing/wiki/events.ndjson',
    });
  });

  it('builds inspectable projection file names under the wiki root', () => {
    expect(projectWikiProjectionSnapshotFilename(' wpg_hero-7 ')).toBe('wpg_hero-7.json');
    expect(projectWikiProjectionFilePath('graph', 'wpg_hero-7')).toBe(
      'projections/graph/wpg_hero-7.json',
    );
    expect(projectWikiProjectionFilePath('memory', 'wpg_hero-7')).toBe(
      'projections/memory/wpg_hero-7.json',
    );
  });

  it('keeps page identifiers stable when the slug changes', () => {
    const original = createProjectWikiPageIdentity({
      title: 'Characters / Atlas Hero Notes',
      idSeed: 'story-bible:hero-7',
    });
    const renamed = createProjectWikiPageIdentity({
      slug: 'characters/atlas-hero-profile',
      idSeed: 'story-bible:hero-7',
    });

    expect(normalizeProjectWikiSlug('  Characters / Atlas Hero Notes  ')).toBe(
      'characters/atlas-hero-notes',
    );
    expect(projectWikiSlugToFilePath('Characters / Atlas Hero Notes')).toBe(
      'characters/atlas-hero-notes.md',
    );
    expect(original.pageId).toBe(createProjectWikiPageId('story-bible:hero-7'));
    expect(original.pageId).toBe(renamed.pageId);
    expect(renamed.slug).toBe('characters/atlas-hero-profile');
    expect(renamed.filePath).toBe('characters/atlas-hero-profile.md');
  });

  it('creates manual-promotion-first frontmatter for canon pages', () => {
    const frontmatter = createProjectWikiPageFrontmatter({
      workspaceId: 'Atlas Project',
      title: 'Atlas Hero Profile',
      slug: 'characters/atlas-hero-profile',
      idSeed: 'story-bible:hero-7',
      promotedFrom: 'story-bible',
    });

    expect(isProjectWikiManualPromotionContract(PROJECT_WIKI_AUTHORITY_CONTRACT)).toBe(true);
    expect(frontmatter).toEqual({
      id: createProjectWikiPageId('story-bible:hero-7'),
      slug: 'characters/atlas-hero-profile',
      title: 'Atlas Hero Profile',
      workspaceId: 'atlas-project',
      status: 'curated',
      promotedFrom: 'story-bible',
      promotion: 'manual',
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
    });
    expect(projectWikiPageFrontmatterToMarkdown(frontmatter)).toBe([
      '---',
      `id: ${JSON.stringify(frontmatter.id)}`,
      'slug: "characters/atlas-hero-profile"',
      'title: "Atlas Hero Profile"',
      'workspaceId: "atlas-project"',
      'status: "curated"',
      'promotedFrom: "story-bible"',
      'promotion: "manual"',
      'scopeAuthority: "workspace"',
      'canonAuthority: "canon-page"',
      'projectionAuthority: "derived"',
      '---',
    ].join('\n'));
  });

  it('uses the last normalized slug segment as fallback title', () => {
    const frontmatter = createProjectWikiPageFrontmatter({
      workspaceId: 'Atlas Project',
      title: '   ',
      slug: 'characters/final-title',
    });

    expect(frontmatter.title).toBe('final-title');
  });
});
