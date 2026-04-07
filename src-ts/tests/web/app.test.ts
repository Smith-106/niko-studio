import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { workflowRunStreamMock } = vi.hoisted(() => ({
  workflowRunStreamMock: vi.fn(),
}));

vi.mock('../../workflow/workflow-engine.js', () => {
  class WorkflowEngineMock {
    runStream = workflowRunStreamMock;
  }

  return { WorkflowEngine: WorkflowEngineMock };
});

function createResponseDouble() {
  const state = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
  };

  const res = {
    setHeader: vi.fn((key: string, value: string) => {
      state.headers[key] = value;
    }),
    writeHead: vi.fn((statusCode: number, headers?: Record<string, string>) => {
      state.statusCode = statusCode;
      if (headers) {
        Object.assign(state.headers, headers);
      }
    }),
    end: vi.fn((body?: string) => {
      state.body = body ?? '';
    }),
  };

  return { res, state };
}

describe('web/app compatibility path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['WEB_WORKFLOW_ENABLED'];
    delete process.env['WEB_UI_FORWARD_URL'];
  });

  afterEach(() => {
    delete process.env['WEB_WORKFLOW_ENABLED'];
    delete process.env['WEB_UI_FORWARD_URL'];
  });

  it('returns 410 for the deprecated root route by default', async () => {
    const { createApp } = await import('../../web/app.js');
    const { handleRequest } = createApp();
    const { res, state } = createResponseDouble();

    handleRequest(
      {
        method: 'GET',
        url: '/',
        headers: {},
      } as never,
      res as never,
    );

    expect(state.statusCode).toBe(410);
    expect(state.body).toContain('Web UI has been deprecated');
    expect(state.headers['X-Niko-Web-Compatibility']).toBe('compatibility-only');
    expect(state.headers['X-Niko-Primary-Path']).toBe('desktop+mcp-gateway');
  });

  it('returns 302 with Location when WEB_UI_FORWARD_URL is a valid http/https URL', async () => {
    process.env['WEB_UI_FORWARD_URL'] = 'https://gateway.example.com/landing/';

    const { createApp } = await import('../../web/app.js');
    const { handleRequest } = createApp();
    const { res, state } = createResponseDouble();

    handleRequest(
      {
        method: 'GET',
        url: '/',
        headers: {},
      } as never,
      res as never,
    );

    expect(state.statusCode).toBe(302);
    expect(state.headers['Location']).toBe('https://gateway.example.com/landing');
    expect(state.headers['X-Niko-Web-Compatibility']).toBe('compatibility-only');
    expect(state.headers['X-Niko-Primary-Path']).toBe('desktop+mcp-gateway');
    expect(state.body).toContain('Redirecting to Gateway');
  });

  it('falls back to 410 when WEB_UI_FORWARD_URL uses unsupported protocol', async () => {
    process.env['WEB_UI_FORWARD_URL'] = 'javascript:alert(1)';

    const { createApp } = await import('../../web/app.js');
    const { handleRequest } = createApp();
    const { res, state } = createResponseDouble();

    handleRequest(
      {
        method: 'GET',
        url: '/',
        headers: {},
      } as never,
      res as never,
    );

    expect(state.statusCode).toBe(410);
    expect(state.body).toContain('Web UI has been deprecated');
  });

  it('emits workflow_disabled when websocket workflow gate is off', async () => {
    const { handleWsMessage } = await import('../../web/app.js');
    const ws = { send: vi.fn() };

    await handleWsMessage(
      'client-1',
      { type: 'start_workflow', content: '测试工作流', mode: 'L3' },
      ws as never,
    );

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(ws.send.mock.calls[0][0]))).toEqual({
      type: 'error',
      code: 'workflow_disabled',
      message: 'Web workflow is disabled by default. Set WEB_WORKFLOW_ENABLED=true to enable it.',
    });
  });

  it('dispatches real workflow websocket events when enabled', async () => {
    process.env['WEB_WORKFLOW_ENABLED'] = 'true';
    workflowRunStreamMock.mockImplementation(async function* () {
      yield { type: 'plan_created', plan_id: 'plan-1' };
      yield { type: 'step_start', step_id: 'step-1', step_name: 'generate' };
      yield {
        type: 'step_complete',
        step_id: 'step-1',
        step_name: 'generate',
        status: 'completed',
        result: {
          draft_content: 'Draft content',
          lock_analysis: { score: 88 },
          scene_cards: [{ id: 'scene-1' }],
        },
      };
      yield { type: 'plan_complete', plan_id: 'plan-1' };
    });

    const { handleWsMessage } = await import('../../web/app.js');
    const ws = { send: vi.fn() };

    await handleWsMessage(
      'client-2',
      { type: 'start_workflow', content: '测试工作流', mode: 'L2' },
      ws as never,
    );

    const payloads = ws.send.mock.calls.map(([raw]) => JSON.parse(String(raw)));
    expect(payloads[0]).toMatchObject({
      type: 'risk_prompt',
      severity: 'warning',
    });
    expect(payloads[1]).toMatchObject({
      type: 'status',
      status: 'starting',
    });
    expect(payloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'plan_created', plan_id: 'plan-1' }),
      expect.objectContaining({ type: 'step_start', step_id: 'step-1', step_name: 'generate' }),
      expect.objectContaining({ type: 'step_complete', step_id: 'step-1', step_name: 'generate' }),
      expect.objectContaining({ type: 'draft_update', content: 'Draft content' }),
      expect.objectContaining({ type: 'lock_update', data: { score: 88 } }),
      expect.objectContaining({ type: 'scenes_update', data: [{ id: 'scene-1' }] }),
      expect.objectContaining({ type: 'status', status: 'completed', plan_id: 'plan-1' }),
    ]));
  });
});
