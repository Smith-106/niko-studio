import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const agentRouteMock = vi.hoisted(() => vi.fn());
const agentWriteMock = vi.hoisted(() => vi.fn());
const agentReviseMock = vi.hoisted(() => vi.fn());
const agentGetContextMock = vi.hoisted(() => vi.fn());
const normalizeProjectWorkspaceContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/agent.js', () => ({
  agentRoute: agentRouteMock,
  agentWrite: agentWriteMock,
  agentRevise: agentReviseMock,
  agentGetContext: agentGetContextMock,
}));

vi.mock('../../project/workspace-model.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../project/workspace-model.js')>();
  return {
    ...actual,
    normalizeProjectWorkspaceContext: normalizeProjectWorkspaceContextMock,
  };
});

function makeRequest(body: unknown): HttpRequest {
  return {
    method: 'POST',
    url: '/agent/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('mcp/endpoints/agent additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NIKO_WORKFLOW_WORKSPACE;
  });

  afterEach(() => {
    delete process.env.NIKO_WORKFLOW_WORKSPACE;
    vi.doUnmock('../../mcp/http-types.js');
  });

  it('routes empty tasks through agentRouteEndpoint', async () => {
    agentRouteMock.mockResolvedValue({ workflow_level: 'L3' });

    const { agentRouteEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentRouteEndpoint(makeRequest({}));

    expect(agentRouteMock).toHaveBeenCalledWith('');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ workflow_level: 'L3' });
  });

  it('passes default write parameters when no workspace context is provided', async () => {
    agentWriteMock.mockResolvedValue({ content: 'draft' });

    const { agentWriteEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentWriteEndpoint(makeRequest({
      scene_card: { scene_id: 'SC-1' },
    }));

    expect(normalizeProjectWorkspaceContextMock).not.toHaveBeenCalled();
    expect(agentWriteMock).toHaveBeenCalledWith({
      scene_card: { scene_id: 'SC-1' },
      skills: undefined,
      word_target: 2000,
      allow_llm_fallback: true,
      quality_goals: undefined,
      workspace: undefined,
    });
    expect(response.body).toEqual({ content: 'draft' });
  });

  it('normalizes legacy workspace identifiers using the configured workspace root', async () => {
    process.env.NIKO_WORKFLOW_WORKSPACE = 'C:/tmp/workspace-root';
    const normalizedWorkspace = {
      identity: {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
      },
    };
    normalizeProjectWorkspaceContextMock.mockReturnValue(normalizedWorkspace);
    agentWriteMock.mockResolvedValue({ content: 'normalized draft' });

    const { agentWriteEndpoint } = await import('../../mcp/endpoints/agent.js');
    await agentWriteEndpoint(makeRequest({
      scene_card: { scene_id: 'SC-2' },
      workspace_id: ' atlas-workspace ',
      projectId: ' atlas-project ',
      context: { projectId: 'context-project' },
      qualityGoals: { voice: 0.9 },
    }));

    expect(normalizeProjectWorkspaceContextMock).toHaveBeenCalledWith({
      workspace: undefined,
      workspace_id: 'atlas-workspace',
      workspaceId: 'atlas-workspace',
      project_id: 'atlas-project',
      projectId: 'atlas-project',
      context: { projectId: 'context-project' },
    }, {
      workspaceRoot: 'C:/tmp/workspace-root',
    });
    expect(agentWriteMock).toHaveBeenCalledWith(expect.objectContaining({
      quality_goals: { voice: 0.9 },
      workspace: normalizedWorkspace,
    }));
  });

  it('returns 400 when the revise body is not an object', async () => {
    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentReviseEndpoint(makeRequest('not-an-object'));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Request body must be an object' });
  });

  it('returns 400 when feedback is not an object', async () => {
    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentReviseEndpoint(makeRequest({
      draft: 'draft',
      feedback: 'too short',
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'feedback must be an object' });
  });

  it('defaults missing feedback and allow_llm_fallback before revising', async () => {
    agentReviseMock.mockResolvedValue({ content: 'revised' });

    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentReviseEndpoint(makeRequest({
      draft: 'draft',
      qualityGoals: { coherence: 0.8 },
    }));

    expect(agentReviseMock).toHaveBeenCalledWith({
      draft: 'draft',
      feedback: {},
      allow_llm_fallback: true,
      quality_goals: { coherence: 0.8 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ content: 'revised' });
  });

  it('maps revise failures to HTTP status codes', async () => {
    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');

    agentReviseMock.mockRejectedValueOnce(new Error('ValueError: bad feedback'));
    const valueErrorResponse = await agentReviseEndpoint(makeRequest({ draft: 'draft', feedback: {} }));

    agentReviseMock.mockRejectedValueOnce(new Error('LLM backend unavailable'));
    const llmResponse = await agentReviseEndpoint(makeRequest({ draft: 'draft', feedback: {} }));

    agentReviseMock.mockRejectedValueOnce(new Error('unexpected boom'));
    const genericResponse = await agentReviseEndpoint(makeRequest({ draft: 'draft', feedback: {} }));

    expect(valueErrorResponse.statusCode).toBe(400);
    expect(llmResponse.statusCode).toBe(503);
    expect(genericResponse.statusCode).toBe(500);
  });

  it('returns 400 when parseBody throws during revise requests', async () => {
    vi.resetModules();
    vi.doMock('../../mcp/http-types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../mcp/http-types.js')>();
      return {
        ...actual,
        parseBody: vi.fn(() => {
          throw new Error('invalid json');
        }),
      };
    });

    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentReviseEndpoint(makeRequest({ draft: 'ignored' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid JSON body' });
  });

  it('forwards scene info and context types to agentGetContext', async () => {
    agentGetContextMock.mockResolvedValue({ plot: { beats: 3 } });

    const { agentContextEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentContextEndpoint(makeRequest({
      scene_info: { location: 'dock' },
      context_types: ['plot'],
    }));

    expect(agentGetContextMock).toHaveBeenCalledWith({ location: 'dock' }, ['plot']);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ plot: { beats: 3 } });
  });
});
