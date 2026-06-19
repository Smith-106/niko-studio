import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body?: unknown): HttpRequest {
  return {
    method: 'POST',
    url: '/chat/branches',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function installRuntimeProvider(runtime: Record<string, unknown>) {
  const providerModule = await import('../../container/workflow-runtime-provider.js');
  const provider = vi.fn().mockReturnValue(runtime);
  providerModule.setWorkflowEngineRuntimeProvider(provider as any);
  return { provider, providerModule };
}

function parseSseEvents(body: unknown): Array<{ event: string; data: Record<string, any> }> {
  return String(body)
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')),
      };
    });
}

describe('chat endpoint branch coverage', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
  let workspace = '';

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-chat-branches-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspace;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalWorkspace === undefined) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }

    try {
      const providerModule = await import('../../container/workflow-runtime-provider.js');
      providerModule.resetWorkflowEngineRuntimeProvider();
    } catch {
      // Module may have been reset by a test-specific mock.
    }

    vi.doUnmock('../../project/wiki-query.js');
    vi.doUnmock('../../mcp/http-types.js');
    vi.doUnmock('../../workflow/types.js');
    vi.restoreAllMocks();
    vi.resetModules();

    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
      workspace = '';
    }
  });

  it('validates stream request bodies before creating a workflow runtime', async () => {
    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');

    expect((await chatStreamEndpoint(makeRequest({ messages: 'not-array' }))).body).toEqual({
      error: 'Invalid messages. Expected array',
    });
    expect((await chatStreamEndpoint(makeRequest())).body).toEqual({ error: 'No messages provided' });
    expect(
      (await chatStreamEndpoint(makeRequest({ messages: [{ role: 'assistant', content: 'assistant only' }] }))).body,
    ).toEqual({ error: 'No user message found' });
  });

  it('covers parseBody nullish fallback for both chat modes', async () => {
    vi.doMock('../../mcp/http-types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../mcp/http-types.js')>();
      return {
        ...actual,
        parseBody: vi.fn().mockReturnValue(undefined),
      };
    });

    const { chatEndpoint, chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');

    expect((await chatEndpoint(makeRequest({ ignored: true }))).body).toEqual({ error: 'No messages provided' });
    expect((await chatStreamEndpoint(makeRequest({ ignored: true }))).body).toEqual({ error: 'No messages provided' });
  });

  it('covers invalid workflow level fallback when label normalization throws', async () => {
    vi.doMock('../../workflow/types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../workflow/types.js')>();
      return {
        ...actual,
        toWorkflowLabel: vi.fn().mockImplementation(() => {
          throw new Error('bad workflow level');
        }),
        toWorkflowSlug: vi.fn().mockReturnValue('standard'),
      };
    });

    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({ level: 'bad-level' }),
      runWithExecutionContext: vi.fn().mockResolvedValue({ final_output: 'level fallback response' }),
      runStreamWithExecutionContext: vi.fn(async function* () {}),
    });

    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'normalize level' }] }),
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>)['workflow_level']).toBe('L3');
  });

  it('builds non-stream fallback content, default comparison models, and step-array counts', async () => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    const runWithExecutionContext = vi.fn().mockResolvedValue({
      result: {
        processed_text: 'nested processed response',
        decision_reason: 'nested feedback',
      },
      plan: { steps: ['draft', 'revise'] },
    });
    const route = vi.fn().mockResolvedValue({ level: 'L4' });
    const { provider } = await installRuntimeProvider({
      route,
      runWithExecutionContext,
      runStreamWithExecutionContext: vi.fn(async function* () {}),
    });

    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatEndpoint(
      makeRequest({
        messages: [{ role: 'user', content: 'write a branch scene' }],
        skills: ['one', 'two', 'three', 'four', 'five', 'six'],
        comparison: { enabled: true },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(provider).toHaveBeenCalledWith({
      workspace: process.cwd(),
      sessionNamespace: 'mcp-chat',
    });
    const body = response.body as Record<string, any>;
    expect(body.content).toBe('nested processed response');
    expect(body.comparison).toMatchObject({
      enabled: true,
      primary: { model: 'primary', content: 'nested processed response' },
      control: { model: 'control', content: 'nested processed response' },
    });
    expect(body.evaluation).toEqual({ score: 0, feedback: 'nested feedback' });
    expect(body.skills_used).toEqual(['one', 'two', 'three', 'four', 'five']);
    expect(body.workflow_info).toMatchObject({
      level: 'L4',
      level_slug: 'brainstorm',
      steps_completed: 2,
      total_steps: 2,
    });
    expect(runWithExecutionContext).toHaveBeenCalledWith('write a branch scene', undefined, 'L4', undefined);
  });

  it('falls back to L3 and default response text when route and result omit optional details', async () => {
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({}),
      runWithExecutionContext: vi.fn().mockResolvedValue({
        final_status: {},
        plan: {},
      }),
      runStreamWithExecutionContext: vi.fn(async function* () {}),
    });

    vi.doMock('../../project/wiki-query.js', () => ({
      queryProjectWikiCanon: vi.fn().mockResolvedValue({
        available: false,
        reason: 'no-store',
        totalPages: 0,
        matches: [],
      }),
    }));

    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatEndpoint(makeRequest({ messages: [{ role: 'user', content: 'plain request' }] }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, any>;
    expect(body.content).toContain('Workflow completed for: "plain request');
    expect(body.workflow_level).toBe('L3');
    expect(body.workflow_level_slug).toBe('standard');
    expect(body.workflow_info.total_steps).toBe(1);
    expect(body.writer_metadata.canon_context).toMatchObject({
      available: false,
      reason: 'no-store',
      injected: false,
    });
  });

  it('returns non-stream catch errors when the workflow runtime fails', async () => {
    await installRuntimeProvider({
      route: vi.fn().mockRejectedValue(new Error('route failed')),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {}),
    });

    const { chatEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatEndpoint(makeRequest({ messages: [{ role: 'user', content: 'explode route' }] }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Error: route failed' });
  });

  it('streams step progress, nested content, evaluations, unknown events, and final completion', async () => {
    const runStreamWithExecutionContext = vi.fn(async function* () {
      yield { type: 'plan_created', plan: { total_steps: 0 } };
      yield { type: 'step_start' };
      yield {
        type: 'step_complete',
        final_status: {
          draft_content: 'stream branch content.',
          actionable_feedback: 'tighten the scene',
        },
      };
      yield { type: 'step_complete', final_output: 'stream branch content.' };
      yield null;
      yield {
        type: 'plan_complete',
        final_output: 'stream branch content.',
        score: 8,
      };
    });
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({}),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext,
    });

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatStreamEndpoint(
      makeRequest({
        messages: [{ role: 'user', content: 'stream a branch scene' }],
        skills: ['draft', 'critic'],
      }),
    );

    expect(response.statusCode).toBe(200);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.event)).toContain('routing');
    expect(events.find((event) => event.data.message === 'Starting step: unknown')).toBeTruthy();
    expect(events.find((event) => event.event === 'content')?.data.chunk).toBe('stream branch content.');
    expect(events.filter((event) => event.event === 'evaluation')).toEqual([
      expect.objectContaining({ data: { score: 0, feedback: 'tighten the scene' } }),
      expect.objectContaining({ data: { score: 8, feedback: '' } }),
    ]);
    expect(events.at(-1)).toMatchObject({
      event: 'done',
      data: {
        status: 'completed',
        decision: 'go',
        workflow_level: 'L3',
        workflow_level_slug: 'standard',
      },
    });
    expect(runStreamWithExecutionContext).toHaveBeenCalledWith(
      'stream a branch scene',
      undefined,
      'L3',
      undefined,
    );
  });

  it('streams distinct plan-complete content with serializable object values', async () => {
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({ level: 'L2' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield {
          type: 'plan_complete',
          final_output: `${'final stream sentence '.repeat(5)}.`,
          diagnostics: {
            nested: [{ value: undefined, callable: () => 'ignored' }],
          },
        };
      }),
    });

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const response = await chatStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'distinct final stream' }] }),
    );

    expect(response.statusCode).toBe(200);
    expect(String(response.body)).toContain('final stream sentence');
    expect(String(response.body)).toContain('event: content');
    expect(String(response.body)).toContain('event: done');
  });

  it('streams fallback content and default stream errors', async () => {
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({ level: 'L2' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_complete' };
      }),
    });

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const fallbackResponse = await chatStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'fallback stream request' }] }),
    );
    expect(String(fallbackResponse.body)).toContain('Workflow L2 completed for request: fallback stream request');

    vi.resetModules();
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({ level: 'L2' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'error' };
      }),
    });
    const { chatStreamEndpoint: errorStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const errorResponse = await errorStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'default stream error' }] }),
    );

    expect(errorResponse.statusCode).toBe(200);
    expect(String(errorResponse.body)).toContain('"error":"Stream error"');
    expect(String(errorResponse.body)).toContain('"failure_reason":"Stream error"');
  });

  it('uses default blocked status and returns stream catch errors', async () => {
    await installRuntimeProvider({
      route: vi.fn().mockResolvedValue({ level: 'L5' }),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {
        yield { type: 'plan_blocked' };
      }),
    });

    const { chatStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const blockedResponse = await chatStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'blocked default status' }] }),
    );
    expect(String(blockedResponse.body)).toContain('"status":"blocked"');
    expect(String(blockedResponse.body)).toContain('"failure_reason":"blocked"');

    vi.resetModules();
    await installRuntimeProvider({
      route: vi.fn().mockRejectedValue(new Error('stream route failed')),
      runWithExecutionContext: vi.fn(),
      runStreamWithExecutionContext: vi.fn(async function* () {}),
    });
    const { chatStreamEndpoint: throwingStreamEndpoint } = await import('../../mcp/endpoints/chat.js');
    const throwingResponse = await throwingStreamEndpoint(
      makeRequest({ messages: [{ role: 'user', content: 'stream catch' }] }),
    );

    expect(throwingResponse.statusCode).toBe(500);
    expect(throwingResponse.body).toEqual({ error: 'Error: stream route failed' });
  });
});
