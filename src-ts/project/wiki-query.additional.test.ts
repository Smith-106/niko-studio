import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { queryProjectWikiCanon } from './wiki-query.js';
import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import { ensureProjectWikiStore, resolveProjectWikiStore } from './wiki-store.js';

async function createWorkspaceRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'niko-project-wiki-query-additional-'));
}

async function writePage(
  pagesDir: string,
  relativePath: string,
  markdown: string,
): Promise<void> {
  const targetPath = path.join(pagesDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, markdown, 'utf8');
}

function createMarkdownPage(options: {
  id: string;
  slug: string;
  title: string;
  workspaceId: string;
  status?: string;
  promotedFrom?: string;
  promotion?: string;
  scopeAuthority?: string;
  canonAuthority?: string;
  projectionAuthority?: string;
  body: string;
}): string {
  return [
    '---',
    `id: ${options.id}`,
    `slug: ${options.slug}`,
    `title: ${options.title}`,
    `workspaceId: ${options.workspaceId}`,
    `status: ${options.status ?? 'curated'}`,
    `promotedFrom: ${options.promotedFrom ?? 'manual'}`,
    `promotion: ${options.promotion ?? 'manual'}`,
    `scopeAuthority: ${options.scopeAuthority ?? 'workspace'}`,
    `canonAuthority: ${options.canonAuthority ?? 'canon-page'}`,
    `projectionAuthority: ${options.projectionAuthority ?? 'derived'}`,
    '---',
    options.body,
    '',
  ].join('\n');
}

describe('project wiki query additional coverage', () => {
  const workspaceRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaceRoots.splice(0).map((workspaceRoot) => rm(workspaceRoot, { recursive: true, force: true })),
    );
  });

  it('skips missing and malformed pages, then orders equal-score matches by status and slug', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);

    const index = {
      schemaVersion: '2026-04-10',
      workspaceId: store.workspaceId,
      pages: [
        {
          id: 'wpg-alpha',
          slug: 'records/atlas-hero-alpha',
          title: 'Atlas Hero Alpha',
          filePath: 'records/atlas-hero-alpha.md',
          status: 'curated',
        },
        {
          id: 'wpg-zeta',
          slug: 'records/atlas-hero-zeta',
          title: 'Atlas Hero Zeta',
          filePath: 'records/atlas-hero-zeta.md',
          status: 'curated',
        },
        {
          id: 'wpg-beta',
          slug: 'drafts/atlas-hero-beta',
          title: 'Atlas Hero Beta',
          filePath: 'drafts/atlas-hero-beta.md',
          status: 'draft',
        },
        {
          id: 'wpg-missing',
          slug: 'broken/atlas-hero-missing',
          title: 'Atlas Hero Missing',
          filePath: 'broken/atlas-hero-missing.md',
          status: 'curated',
        },
        {
          id: 'wpg-invalid',
          slug: 'broken/atlas-hero-invalid',
          title: 'Atlas Hero Invalid',
          filePath: 'broken/atlas-hero-invalid.md',
          status: 'curated',
        },
      ],
    };
    await writeFile(store.paths.indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    const baseBody = [
      'Opening beats circle the archive before atlas pauses beside the lantern,',
      'while the hero studies the map and listens for movement in the vault below.',
      'A final lookout note closes the scene with enough distance to require clipping.',
    ].join(' ');
    await writePage(
      store.paths.pagesDir,
      'records/atlas-hero-alpha.md',
      createMarkdownPage({
        id: 'wpg-alpha',
        slug: 'records/atlas-hero-alpha',
        title: 'Atlas Hero Alpha',
        workspaceId: store.workspaceId,
        body: baseBody,
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/atlas-hero-zeta.md',
      createMarkdownPage({
        id: 'wpg-zeta',
        slug: 'records/atlas-hero-zeta',
        title: 'Atlas Hero Zeta',
        workspaceId: store.workspaceId,
        body: baseBody,
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'drafts/atlas-hero-beta.md',
      createMarkdownPage({
        id: 'wpg-beta',
        slug: 'drafts/atlas-hero-beta',
        title: 'Atlas Hero Beta',
        workspaceId: store.workspaceId,
        status: 'draft',
        body: [
          'Opening beats circle the archive before atlas pauses beside the lantern,',
          'while the hero studies the map.',
          'Later atlas returns and the hero marks a second route through the vault.',
        ].join(' '),
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'broken/atlas-hero-invalid.md',
      createMarkdownPage({
        id: 'wpg-invalid',
        slug: 'broken/atlas-hero-invalid',
        title: 'Atlas Hero Invalid',
        workspaceId: store.workspaceId,
        promotion: 'automatic',
        body: 'This page should be ignored because its promotion contract is invalid.',
      }),
    );

    const result = await queryProjectWikiCanon(workspace, 'atlas hero', {
      limit: 10,
      excerptLength: 40,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(5);
    expect(result.matches.map((match) => match.slug)).toEqual([
      'records/atlas-hero-alpha',
      'records/atlas-hero-zeta',
      'drafts/atlas-hero-beta',
    ]);
    expect(result.matches.every((match) => match.score === result.matches[0]!.score)).toBe(true);
    expect(result.matches[0]!.authority.status).toBe('curated');
    expect(result.matches[2]!.authority.status).toBe('draft');
    expect(result.matches[0]!.excerpt).toContain('atlas');
    expect(result.matches[0]!.excerpt.startsWith('... ')).toBe(true);
    expect(result.matches[0]!.excerpt.endsWith(' ...')).toBe(true);
  });

  it('returns no matches for empty normalized queries even when pages exist', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 'wpg-single',
            slug: 'records/atlas-hero-single',
            title: 'Atlas Hero Single',
            filePath: 'records/atlas-hero-single.md',
            status: 'curated',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/atlas-hero-single.md',
      createMarkdownPage({
        id: 'wpg-single',
        slug: 'records/atlas-hero-single',
        title: 'Atlas Hero Single',
        workspaceId: store.workspaceId,
        body: 'Atlas meets the hero in a quiet archive corridor.',
      }),
    );

    const result = await queryProjectWikiCanon(workspace, '   ', {
      limit: 0,
      excerptLength: 0,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(1);
    expect(result.matches).toEqual([]);
  });

  it('falls back to an empty index when the index file is malformed', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(store.paths.indexFile, '{not-valid-json', 'utf8');

    const result = await queryProjectWikiCanon(workspace, 'Atlas');

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(0);
    expect(result.matches).toEqual([]);
  });

  it('builds excerpts from the body head when query terms only match title metadata', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 'wpg-title-only',
            slug: 'records/title-only-hit',
            title: 'Archive Beacon Ledger',
            filePath: 'records/title-only-hit.md',
            status: 'curated',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/title-only-hit.md',
      createMarkdownPage({
        id: 'wpg-title-only',
        slug: 'records/title-only-hit',
        title: 'Archive Beacon Ledger',
        workspaceId: store.workspaceId,
        body: [
          'Opening lines describe the silent corridor and the lantern on the first hook.',
          'No title keywords are repeated in the manuscript body itself.',
          'The closing sentence adds extra detail so the excerpt must be clipped.',
        ].join(' '),
      }),
    );

    const result = await queryProjectWikiCanon(workspace, 'Beacon Ledger', {
      limit: 5,
      excerptLength: 50,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.excerpt.startsWith('Opening lines describe')).toBe(true);
    expect(result.matches[0]!.excerpt.startsWith('... ')).toBe(false);
    expect(result.matches[0]!.excerpt.endsWith(' ...')).toBe(true);
  });

  it('backs the excerpt window up when the body match appears near the end', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 'wpg-tail-hit',
            slug: 'records/tail-hit',
            title: 'Tail Hit Record',
            filePath: 'records/tail-hit.md',
            status: 'curated',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/tail-hit.md',
      createMarkdownPage({
        id: 'wpg-tail-hit',
        slug: 'records/tail-hit',
        title: 'Tail Hit Record',
        workspaceId: store.workspaceId,
        body: [
          'The archive hallway stays quiet while the patrol passes the north vault.',
          'Several ordinary notes keep the excerpt window occupied until the finale.',
          'At the very end the record names the ember signal.',
        ].join(' '),
      }),
    );

    const result = await queryProjectWikiCanon(workspace, 'ember signal', {
      limit: 5,
      excerptLength: 48,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.excerpt).toContain('ember signal');
    expect(result.matches[0]!.excerpt.startsWith('... ')).toBe(true);
    expect(result.matches[0]!.excerpt.endsWith(' ...')).toBe(false);
  });

  it('covers index title and status fallbacks, empty body excerpts, and zero-score page filtering', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 'wpg-sparse',
            slug: 'records/sparse-meta',
            filePath: 'records/sparse-meta.md',
          },
          {
            id: 'wpg-zero-score',
            slug: 'records/unrelated-entry',
            title: 'Unrelated Entry',
            filePath: 'records/unrelated-entry.md',
            status: 'draft',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/sparse-meta.md',
      createMarkdownPage({
        id: 'wpg-sparse',
        slug: 'records/sparse-meta',
        title: 'Sparse Meta',
        workspaceId: store.workspaceId,
        body: '    \n   \n',
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/unrelated-entry.md',
      createMarkdownPage({
        id: 'wpg-zero-score',
        slug: 'records/unrelated-entry',
        title: 'Unrelated Entry',
        workspaceId: store.workspaceId,
        status: 'draft',
        body: 'This unrelated page never mentions the sought phrase.',
      }),
    );

    const result = await queryProjectWikiCanon(workspace, 'Sparse Meta', {
      limit: 5,
      excerptLength: 32,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(2);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      slug: 'records/sparse-meta',
      excerpt: '',
      authority: {
        status: 'curated',
      },
    });
  });

  it('treats non-array indexes as empty and filters entries with non-string identifiers', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);

    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: {
          unexpected: true,
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const nonArrayResult = await queryProjectWikiCanon(workspace, 'atlas');
    expect(nonArrayResult.available).toBe(true);
    if (!nonArrayResult.available) return;
    expect(nonArrayResult.totalPages).toBe(0);
    expect(nonArrayResult.matches).toEqual([]);

    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 99,
            slug: 'records/not-used',
            filePath: 'records/not-used.md',
          },
          {
            id: 'wpg-whitespace',
            slug: 'records/whitespace-title',
            title: '   ',
            filePath: 'records/whitespace-title.md',
            status: '   ',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/whitespace-title.md',
      createMarkdownPage({
        id: 'wpg-whitespace',
        slug: 'records/whitespace-title',
        title: 'Whitespace Title',
        workspaceId: store.workspaceId,
        body: 'Whitespace title pages still mention atlas in the body.',
      }),
    );

    const filteredResult = await queryProjectWikiCanon(workspace, 'atlas');
    expect(filteredResult.available).toBe(true);
    if (!filteredResult.available) return;
    expect(filteredResult.totalPages).toBe(1);
    expect(filteredResult.matches).toHaveLength(1);
    expect(filteredResult.matches[0]!.slug).toBe('records/whitespace-title');
  });

  it('skips pages with malformed frontmatter contracts and missing frontmatter blocks', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    workspaceRoots.push(workspaceRoot);

    const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
    const store = resolveProjectWikiStore(workspace.identity.workspaceRoot, workspace.identity.workspaceId);
    expect(store.available).toBe(true);
    if (!store.available) return;

    await ensureProjectWikiStore(store);
    await writeFile(
      store.paths.indexFile,
      `${JSON.stringify({
        schemaVersion: '2026-04-10',
        workspaceId: store.workspaceId,
        pages: [
          {
            id: 'wpg-valid',
            slug: 'records/valid-page',
            title: 'Valid Atlas Page',
            filePath: 'records/valid-page.md',
            status: 'curated',
          },
          {
            id: 'wpg-no-frontmatter',
            slug: 'records/no-frontmatter',
            title: 'No Frontmatter',
            filePath: 'records/no-frontmatter.md',
            status: 'curated',
          },
          {
            id: 'wpg-missing-title',
            slug: 'records/missing-title',
            title: 'Missing Title',
            filePath: 'records/missing-title.md',
            status: 'curated',
          },
          {
            id: 'wpg-invalid-status',
            slug: 'records/invalid-status',
            title: 'Invalid Status',
            filePath: 'records/invalid-status.md',
            status: 'curated',
          },
          {
            id: 'wpg-invalid-promoted-from',
            slug: 'records/invalid-promoted-from',
            title: 'Invalid Promoted From',
            filePath: 'records/invalid-promoted-from.md',
            status: 'curated',
          },
          {
            id: 'wpg-invalid-scope',
            slug: 'records/invalid-scope',
            title: 'Invalid Scope',
            filePath: 'records/invalid-scope.md',
            status: 'curated',
          },
          {
            id: 'wpg-invalid-projection',
            slug: 'records/invalid-projection',
            title: 'Invalid Projection',
            filePath: 'records/invalid-projection.md',
            status: 'curated',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    await writePage(
      store.paths.pagesDir,
      'records/valid-page.md',
      createMarkdownPage({
        id: 'wpg-valid',
        slug: 'records/valid-page',
        title: 'Valid Atlas Page',
        workspaceId: store.workspaceId,
        body: 'Atlas keeps the valid canon record visible in the archive.',
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/no-frontmatter.md',
      'Atlas appears here without any frontmatter wrapper.\n',
    );
    await writePage(
      store.paths.pagesDir,
      'records/missing-title.md',
      [
        '---',
        'note without separator',
        'id: "wpg-missing-title"',
        'slug: "records/missing-title"',
        'title:',
        `workspaceId: "${store.workspaceId}"`,
        'status: "curated"',
        'promotedFrom: "manual"',
        'promotion: "manual"',
        'scopeAuthority: "workspace"',
        'canonAuthority: "canon-page"',
        'projectionAuthority: "derived"',
        '---',
        'Atlas should not surface because the title field is empty.',
        '',
      ].join('\n'),
    );
    await writePage(
      store.paths.pagesDir,
      'records/invalid-status.md',
      createMarkdownPage({
        id: 'wpg-invalid-status',
        slug: 'records/invalid-status',
        title: 'Invalid Status',
        workspaceId: store.workspaceId,
        status: 'archived',
        body: 'Atlas should not surface because the status contract is invalid.',
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/invalid-promoted-from.md',
      createMarkdownPage({
        id: 'wpg-invalid-promoted-from',
        slug: 'records/invalid-promoted-from',
        title: 'Invalid Promoted From',
        workspaceId: store.workspaceId,
        promotedFrom: 'unknown-origin',
        body: 'Atlas should not surface because promotedFrom is invalid.',
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/invalid-scope.md',
      createMarkdownPage({
        id: 'wpg-invalid-scope',
        slug: 'records/invalid-scope',
        title: 'Invalid Scope',
        workspaceId: store.workspaceId,
        scopeAuthority: 'global',
        body: 'Atlas should not surface because scopeAuthority is invalid.',
      }),
    );
    await writePage(
      store.paths.pagesDir,
      'records/invalid-projection.md',
      createMarkdownPage({
        id: 'wpg-invalid-projection',
        slug: 'records/invalid-projection',
        title: 'Invalid Projection',
        workspaceId: store.workspaceId,
        projectionAuthority: 'source',
        body: 'Atlas should not surface because projectionAuthority is invalid.',
      }),
    );

    const result = await queryProjectWikiCanon(workspace, 'atlas valid');

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(7);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.slug).toBe('records/valid-page');
  });
});
