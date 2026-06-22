import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/chat/additional',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function loadChatModule(options?: { failCanonQuery?: boolean }) {
  vi.resetModules();

  if (options?.failCanonQuery) {
    vi.doMock('../../project/wiki-query.js', () => ({
      queryProjectWikiCanon: vi.fn().mockRejectedValue(new Error('canon failed')),
    }));
  }

  return import('../../mcp/endpoints/chat.js');
}

describe('chat additional coverage', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  const originalAllowOutside = process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-chat-additional-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspace;
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
    if (originalAllowOutside === undefined) {
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    } else {
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = originalAllowOutside;
    }
    }

    try {
      const runtimeProvider = await import('../../container/workflow-runtime-provider.js');
      runtimeProvider.resetWorkflowEngineRuntimeProvider();
    } catch {
      // ignore cleanup failures after mocked module resets
    }

    vi.restoreAllMocks();
    vi.resetModules();

    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
      workspace = '';
    }
  });

  it('rejects invalid message payload shapes and size limits', async () => {
    const { chatEndpoint } = await loadChatModule();

    const invalidMessages = await chatEndpoint(makeRequest({ messages: 'bad-payload' as unknown[] }));
    expect(invalidMessages.statusCode).toBe(400);
    expect(invalidMessages.body).toEqual({ error: 'Invalid messages. Expected array' });

    const tooManyMessages = await chatEndpoint(
      makeRequest({
        messages: Array.from({ length: 129 }, () => ({ role: 'user', content: 'x' })),
      }),
    );
    expect(tooManyMessages.statusCode).toBe(400);
    expect(tooManyMessages.body).toEqual({ error: 'Too many messages. Max 128' });

    const nonObjectMessage = await chatEndpoint(
      makeRequest({ messages: ['bad-message' as unknown as Record<string, unknown>] }),
    );
    expect(nonObjectMessage.statusCode).toBe(400);
    expect(nonObjectMessage.body).toEqual({
      error: 'Invalid message at index 0. Expected object',
    });

    const invalidRole = await chatEndpoint(
      makeRequest({ messages: [{ role: 'tool', content: 'x' }] }),
    );
    expect(invalidRole.statusCode).toBe(400);
    expect(invalidRole.body).toEqual({ error: 'Invalid message.role at index 0' });

    const invalidContent = await chatEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 123 }] }),
    );
    expect(invalidContent.statusCode).toBe(400);
    expect(invalidContent.body).toEqual({
      error: 'Invalid message.content at index 0. Expected string',
    });

    const longMessage = await chatEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'x'.repeat(24_001) }] }),
    );
    expect(longMessage.statusCode).toBe(413);
    expect(longMessage.body).toEqual({
      error: 'message.content at index 0 exceeds maximum length of 24000 characters (got 24001)',
    });

    const totalTooLong = await chatEndpoint(
      makeRequest({
        messages: Array.from({ length: 6 }, () => ({ role: 'user', content: 'y'.repeat(21_000) })),
      }),
    );
    expect(totalTooLong.statusCode).toBe(400);
    expect(totalTooLong.body).toEqual({
      error: 'Context too long. Max 120000 chars',
    });
  });

  it('rejects empty conversations and conversations without a user message', async () => {
    const { chatEndpoint } = await loadChatModule();

    const noMessages = await chatEndpoint(makeRequest({ messages: [] }));
    expect(noMessages.statusCode).toBe(400);
    expect(noMessages.body).toEqual({ error: 'No messages provided' });

    const noUserMessage = await chatEndpoint(
      makeRequest({ messages: [{ role: 'assistant', content: 'only assistant text' }] }),
    );
    expect(noUserMessage.statusCode).toBe(400);
    expect(noUserMessage.body).toEqual({ error: 'No user message found' });
  });

  it('covers adaptive chunking for empty, sentence-based, and long fallback chunks', async () => {
    const { adaptiveChunkContent } = await loadChatModule();

    expect(adaptiveChunkContent('')).toEqual([]);

    const sentenceChunks = adaptiveChunkContent('First sentence. Second sentence.', 20, 5);
    expect(sentenceChunks.length).toBeGreaterThan(1);

    const fallbackChunks = adaptiveChunkContent('x'.repeat(120), 50, 10);
    expect(fallbackChunks).toHaveLength(3);
    expect(fallbackChunks[0]).toHaveLength(50);
    expect(fallbackChunks[1]).toHaveLength(50);
  });

  it('returns workflow execution errors for non-stream requests', async () => {
    vi.resetModules();
    const runtimeProvider = await import('../../container/workflow-runtime-provider.js');
    runtimeProvider.setWorkflowEngineRuntimeProvider(() => ({
      route: vi.fn().mockResolvedValue({ level: 'L2' }),
      runWithExecutionContext: vi.fn().mockResolvedValue({ error: 'provider failed' }),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_complete', final_output: 'unused' };
      }),
    }) as any);

    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatEndpoint(
      makeRequest({ messages: [{ role: 'user', content: '执行失败分支' }] }),
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'provider failed' });
  });

  it('emits done events for blocked plans in stream mode', async () => {
    vi.resetModules();
    const runtimeProvider = await import('../../container/workflow-runtime-provider.js');
    runtimeProvider.setWorkflowEngineRuntimeProvider(() => ({
      route: vi.fn().mockResolvedValue({ level: 'L5' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_blocked', status: 'blocked' };
      }),
    }) as any);

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'blocked stream' }] }),
    );

    expect(response.statusCode).toBe(200);
    const body = String(response.body);
    expect(body).toContain('event: done');
    expect(body).toContain('"decision":"no_go"');
    expect(body).toContain('"failure_reason":"blocked"');
  });

  it('emits error events for plan errors in stream mode', async () => {
    vi.resetModules();
    const runtimeProvider = await import('../../container/workflow-runtime-provider.js');
    runtimeProvider.setWorkflowEngineRuntimeProvider(() => ({
      route: vi.fn().mockResolvedValue({ level: 'L3' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_error', error: 'stream failed' };
      }),
    }) as any);

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'error stream' }] }),
    );

    expect(response.statusCode).toBe(200);
    const body = String(response.body);
    expect(body).toContain('event: error');
    expect(body).toContain('"status":"failed"');
    expect(body).toContain('"error":"stream failed"');
  });

  it('falls back to query-error canon metadata when canon lookup throws', async () => {
    vi.resetModules();
    const runtimeProvider = await import('../../container/workflow-runtime-provider.js');
    runtimeProvider.setWorkflowEngineRuntimeProvider(() => ({
      route: vi.fn().mockResolvedValue({ level: 'L2' }),
      runWithExecutionContext: vi.fn().mockResolvedValue({
        final_output: 'fallback content',
        evaluation: { score: 7, feedback: 'ok' },
        plan: { total_steps: 1 },
      }),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_complete', final_output: 'unused' };
      }),
    }) as any);

    const { chatEndpoint } = await loadChatModule({ failCanonQuery: true });
    const response = await chatEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'canon lookup failure' }] }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, any>;
    expect(body.writer_metadata.canon_context).toMatchObject({
      available: false,
      reason: 'query-error',
      injected: false,
      match_count: 0,
    });
    expect(body.writer_metadata.retrieval_packet.counts).toMatchObject({
      entities: 0,
      relations: 0,
      memories: 0,
      total: 0,
    });
  });
});
