import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { queryProjectWikiCanon } from './wiki-query.js';
import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import { ensureProjectWikiStore, resolveProjectWikiStore } from './wiki-store.js';

async function createWorkspaceRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'niko-project-wiki-query-branch-gap-'));
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

describe('project wiki query branch-gap coverage', () => {
  const workspaceRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaceRoots.splice(0).map((workspaceRoot) => rm(workspaceRoot, { recursive: true, force: true })),
    );
  });

  it('ignores pages whose canon authority is invalid', async () => {
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
            id: 'wpg-invalid-canon',
            slug: 'records/invalid-canon',
            title: 'Invalid Canon',
            filePath: 'records/invalid-canon.md',
            status: 'curated',
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writePage(
      store.paths.pagesDir,
      'records/invalid-canon.md',
      [
        '---',
        'id: "wpg-invalid-canon"',
        'slug: "records/invalid-canon"',
        'title: "Invalid Canon"',
        `workspaceId: ${JSON.stringify(store.workspaceId)}`,
        'status: "curated"',
        'promotedFrom: "manual"',
        'promotion: "manual"',
        'scopeAuthority: "workspace"',
        'canonAuthority: "legacy-canon"',
        'projectionAuthority: "derived"',
        '---',
        'Atlas still appears in the body, but the page contract is invalid.',
        '',
      ].join('\n'),
    );

    const result = await queryProjectWikiCanon(workspace, 'atlas');

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.totalPages).toBe(1);
    expect(result.matches).toEqual([]);
  });
});
