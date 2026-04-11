import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from '../../mcp/http-types';
import { resolveProjectWikiStore, writeProjectWikiPage } from '../../project/wiki-store.js';

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

describe('chat endpoints', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-chat-endpoint-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspace;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
    vi.resetModules();
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('returns real SSE events without placeholder chunks', async () => {
    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');

    const response = await chatStreamEndpoint(makeRequest({
      messages: [{ role: 'user', content: '写一段带明显冲突的出场场景' }],
      workflowLevel: 'L2',
      skills: [],
      allowLlmFallback: true,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Content-Type']).toBe('text/event-stream');

    const body = String(response.body);
    expect(body).toContain('event: content');
    expect(body).toContain('event: done');
    expect(body).not.toContain('Streaming placeholder');
  });

  it('uses workflow execution for non-stream chat responses', async () => {
    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');

    const response = await chatEndpoint(makeRequest({
      messages: [{ role: 'user', content: '写一段角色初次登场的描写' }],
      workflowLevel: 'L2',
      skills: [],
      allowLlmFallback: true,
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(typeof body['content']).toBe('string');
    expect(String(body['content']).length).toBeGreaterThan(0);
    expect(body['workflow_level']).toBe('L2');
  });

  it('includes canon context metadata when workspace canon matches the user message', async () => {
    const store = resolveProjectWikiStore(workspace, 'atlas-project');
    expect(store.available).toBe(true);
    if (!store.available) return;

    await writeProjectWikiPage(store, {
      workspaceId: 'atlas-project',
      title: 'Atlas Harbor Canon',
      slug: 'locations/atlas-harbor',
      idSeed: 'manual:atlas-harbor',
      promotedFrom: 'manual',
      body: 'Atlas Harbor is the canonical dock district where the smugglers operate at night.',
    });

    const { chatEndpoint, chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');

    const response = await chatEndpoint(makeRequest({
      messages: [{ role: 'user', content: '整理 Atlas Harbor 的 smuggler 线索' }],
      workflowLevel: 'L2',
      skills: [],
      allowLlmFallback: true,
      workspace: {
        identity: {
          workspaceId: 'atlas-project',
          projectId: 'atlas-project',
          workspaceRoot: workspace,
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    const writerMetadata = body['writer_metadata'] as Record<string, unknown>;
    const canonContext = writerMetadata['canon_context'] as Record<string, unknown>;
    expect(canonContext).toMatchObject({
      available: true,
      injected: true,
      match_count: 1,
    });
    expect(String(body['content'])).toContain('Atlas Harbor Canon');
    expect(JSON.stringify(canonContext)).toContain('Atlas Harbor Canon');

    const streamResponse = await chatStreamEndpoint(makeRequest({
      messages: [{ role: 'user', content: '整理 Atlas Harbor 的 smuggler 线索' }],
      workflowLevel: 'L2',
      skills: [],
      allowLlmFallback: true,
      workspace: {
        identity: {
          workspaceId: 'atlas-project',
          projectId: 'atlas-project',
          workspaceRoot: workspace,
        },
      },
    }));

    expect(streamResponse.statusCode).toBe(200);
    const streamBody = String(streamResponse.body);
    expect(streamBody).toContain('"canon_context"');
    expect(streamBody).toContain('Atlas Harbor Canon');
    expect(streamBody).toContain('Workspace Canon Context');
  });
});
