import { describe, expect, it } from 'vitest';

import {
  createProjectWikiPageFrontmatter,
  createProjectWikiPageId,
  createProjectWikiPageIdentity,
  normalizeProjectWikiSlug,
  normalizeProjectWikiWorkspaceId,
  projectWikiProjectionSnapshotFilename,
} from './wiki-schema.js';

describe('project wiki schema additional coverage', () => {
  it('falls back to default workspace, slug, snapshot, and seed values when sanitization strips content', () => {
    expect(normalizeProjectWikiWorkspaceId('!!!')).toBe('workspace');
    expect(normalizeProjectWikiSlug('   ')).toBe('untitled');
    expect(normalizeProjectWikiSlug('!!!')).toBe('untitled');
    expect(projectWikiProjectionSnapshotFilename(undefined as never)).toBe('projection.json');
    expect(createProjectWikiPageId(undefined as never)).toBe(
      createProjectWikiPageId('untitled'),
    );
  });

  it('falls through page identity inputs from page id to generated defaults when earlier fields are absent', () => {
    const fromPageId = createProjectWikiPageIdentity({
      slug: null,
      title: null,
      idSeed: null,
      pageId: ' Canon / Entry ',
    });
    const generated = createProjectWikiPageIdentity({
      slug: null,
      title: null,
      idSeed: null,
      pageId: null,
    });

    expect(fromPageId).toEqual({
      pageId: 'Canon / Entry',
      slug: 'canon/entry',
      filePath: 'canon/entry.md',
    });
    expect(generated).toEqual({
      pageId: createProjectWikiPageId('untitled'),
      slug: 'untitled',
      filePath: 'untitled.md',
    });
  });

  it('uses frontmatter defaults when optional fields are omitted or blank', () => {
    const frontmatter = createProjectWikiPageFrontmatter({
      workspaceId: '!!!',
      title: '   ' as never,
      slug: undefined,
      pageId: ' Canon / Entry ',
      idSeed: undefined,
      promotedFrom: undefined,
      status: undefined,
    });

    expect(frontmatter).toEqual({
      id: 'Canon / Entry',
      slug: 'untitled',
      title: 'untitled',
      workspaceId: 'workspace',
      status: 'curated',
      promotedFrom: 'manual',
      promotion: 'manual',
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
    });
  });
});
