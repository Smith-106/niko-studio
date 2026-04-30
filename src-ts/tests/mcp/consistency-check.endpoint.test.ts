import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import type { HttpRequest } from '../../mcp/http-types';
import { consistencyCheckEndpoint, buildConsistencyInputFromWorkspace } from '../../mcp/endpoints/critic';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/consistency/check',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('consistency check endpoint', () => {
  it('supports the standalone consistency route and returns a normalized workspace payload', async () => {
    const response = await consistencyCheckEndpoint(makeRequest({
      chapters: [
        '盛夏的阳光照在战场上，夏日的炎热让人窒息。林明在战斗中受了重伤。最终，林明死亡，永远闭上了眼睛。老王的好友林明离世了。',
        '春天来了，春暖花开，三月的风轻轻吹过。林明不在了，老王独自坐在院子里。',
        '林明走了过来，笑着和大家打招呼。老王看到林明走了过来。',
      ],
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        storyBible: {
          draftId: 'draft-2',
          storage: 'local-draft',
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      runId: expect.stringContaining('consistency-atlas-workspace-'),
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
        storyBible: {
          draftId: 'draft-2',
          storage: 'local-draft',
        },
        authority: {
          consistencyRunId: expect.stringContaining('consistency-atlas-workspace-'),
        },
      },
    });

    const body = response.body as Record<string, unknown>;
    const combined = body.combined as Record<string, unknown>;
    expect(Number(combined.totalConflicts)).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 when no chapters and no workspace root provided', async () => {
    const response = await consistencyCheckEndpoint(makeRequest({}));
    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('No chapters') });
  });

  it('returns 400 when workspace root has no chapter files', async () => {
    const emptyDir = join(tmpdir(), `niko-empty-ws-${randomUUID().slice(0, 8)}`);
    mkdirSync(emptyDir, { recursive: true });
    try {
      const response = await consistencyCheckEndpoint(makeRequest({
        workspaceRoot: emptyDir,
      }));
      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({ error: expect.stringContaining('No chapter files') });
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('auto-scans workspace when chapters are empty and workspace root is provided', async () => {
    const wsDir = join(tmpdir(), `niko-ws-scan-${randomUUID().slice(0, 8)}`);
    const chaptersDir = join(wsDir, 'manuscript');
    mkdirSync(chaptersDir, { recursive: true });
    writeFileSync(join(chaptersDir, '01_opening.md'), '第一章内容。林明出场了。');
    writeFileSync(join(chaptersDir, '02_conflict.md'), '第二章内容。林明不在了。');
    try {
      const response = await consistencyCheckEndpoint(makeRequest({
        workspaceRoot: wsDir,
      }));
      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.analyzedAt).toBeDefined();
      expect(body.combined).toMatchObject({ totalConflicts: expect.any(Number) });
    } finally {
      rmSync(wsDir, { recursive: true, force: true });
    }
  });
});

describe('buildConsistencyInputFromWorkspace', () => {
  const cleanupDirs: string[] = [];
  afterEach(() => {
    for (const dir of cleanupDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanupDirs.length = 0;
  });

  it('returns null for non-existent workspace', async () => {
    const result = await buildConsistencyInputFromWorkspace('/tmp/niko-nonexistent-' + randomUUID());
    expect(result).toBeNull();
  });

  it('discovers chapter files in manuscript subdirectory', async () => {
    const wsDir = join(tmpdir(), `niko-builder-${randomUUID().slice(0, 8)}`);
    const msDir = join(wsDir, 'manuscript');
    mkdirSync(msDir, { recursive: true });
    cleanupDirs.push(wsDir);
    writeFileSync(join(msDir, '01_dawn.md'), 'Chapter 1 content');
    writeFileSync(join(msDir, '02_dusk.txt'), 'Chapter 2 content');
    writeFileSync(join(msDir, 'notes.json'), '{"skip": true}'); // not a chapter file

    const result = await buildConsistencyInputFromWorkspace(wsDir);
    expect(result).not.toBeNull();
    expect(result!.chapters).toHaveLength(2);
    expect(result!.chapterMeta).toEqual([
      { chapterNumber: 1, title: 'dawn' },
      { chapterNumber: 2, title: 'dusk' },
    ]);
    expect(result!.worldRules).toEqual([]);
  });

  it('derives chapter number from filename digits', async () => {
    const wsDir = join(tmpdir(), `niko-chnum-${randomUUID().slice(0, 8)}`);
    mkdirSync(wsDir, { recursive: true });
    cleanupDirs.push(wsDir);
    writeFileSync(join(wsDir, 'chapter-10.md'), 'Content 10');
    writeFileSync(join(wsDir, 'chapter-3.md'), 'Content 3');

    const result = await buildConsistencyInputFromWorkspace(wsDir);
    expect(result).not.toBeNull();
    // Sorted alphabetically: chapter-10 before chapter-3
    expect(result!.chapterMeta[0].chapterNumber).toBe(10);
    expect(result!.chapterMeta[1].chapterNumber).toBe(3);
  });
});
