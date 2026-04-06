import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from '../../mcp/http-types';

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
});
