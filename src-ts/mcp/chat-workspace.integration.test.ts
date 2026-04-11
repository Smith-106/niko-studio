import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from './http-types';
import { resolveProjectWikiStore, writeProjectWikiPage } from '../project/wiki-store.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/chat/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('chat workspace integration', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  let workspaceRoot = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-chat-workspace-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
    vi.resetModules();
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('returns authoritative workspace metadata for chat compatibility', async () => {
    const store = resolveProjectWikiStore(workspaceRoot, 'atlas-project');
    expect(store.available).toBe(true);
    if (!store.available) return;

    await writeProjectWikiPage(store, {
      workspaceId: 'atlas-project',
      title: 'Chapter 9 Canon',
      slug: 'plot/chapter-9-canon',
      idSeed: 'manual:chapter-9',
      promotedFrom: 'manual',
      body: 'Chapter 9 canon says the protagonist is organizing context around the archive trail.',
    });

    const { chatEndpoint } = await import('./endpoints/chat.js');

    const response = await chatEndpoint(makeRequest({
      messages: [{ role: 'user', content: '整理当前章节需要的上下文' }],
      workflowLevel: 'L2',
      skills: [],
      allowLlmFallback: true,
      context: {
        projectId: 'atlas-project',
        chapterId: 'chapter-9',
      },
      workspace: {
        storyBible: {
          draftId: 'story-bible-draft-1',
          storage: 'local-draft',
        },
        workflow: {
          sessionId: 'workflow-session-9',
        },
        chat: {
          conversationId: 'conversation-9',
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    const writerMetadata = body['writer_metadata'] as Record<string, unknown>;
    const workspace = writerMetadata['workspace_context'] as Record<string, unknown>;
    const canonContext = writerMetadata['canon_context'] as Record<string, unknown>;
    expect(body['workspace']).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-9',
      },
      workflow: {
        sessionId: 'workflow-session-9',
      },
      chat: {
        conversationId: 'conversation-9',
      },
    });
    expect(workspace).toMatchObject({
      storyBible: {
        draftId: 'story-bible-draft-1',
      },
    });
    expect(canonContext).toMatchObject({
      available: true,
      injected: true,
      match_count: 1,
    });
    expect(String(body['content'])).toContain('Chapter 9 Canon');
    expect(body['context']).toEqual({
      projectId: 'atlas-project',
      chapterId: 'chapter-9',
    });
  });
});
