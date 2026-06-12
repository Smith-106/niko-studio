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

describe('mcp/endpoints/agent tail additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NIKO_WORKFLOW_WORKSPACE;
  });

  afterEach(() => {
    delete process.env.NIKO_WORKFLOW_WORKSPACE;
  });

  it('falls back to context project ids and default scene cards when workspace ids are blank', async () => {
    const normalizedWorkspace = { identity: { projectId: 'ctx-project' } };
    normalizeProjectWorkspaceContextMock.mockReturnValue(normalizedWorkspace);
    agentWriteMock.mockResolvedValue({ content: 'draft' });

    const { agentWriteEndpoint } = await import('../../mcp/endpoints/agent.js');
    await agentWriteEndpoint(makeRequest({
      workspace: {
        identity: {
          workspaceId: '   ',
        },
      },
      context: {
        projectId: ' ctx-project ',
      },
    }));

    expect(normalizeProjectWorkspaceContextMock).toHaveBeenCalledWith({
      workspace: {
        identity: {
          workspaceId: '   ',
        },
      },
      workspace_id: undefined,
      workspaceId: undefined,
      project_id: 'ctx-project',
      projectId: 'ctx-project',
      context: {
        projectId: ' ctx-project ',
      },
    }, {
      workspaceRoot: process.cwd(),
    });
    expect(agentWriteMock).toHaveBeenCalledWith({
      scene_card: {},
      skills: undefined,
      word_target: 2000,
      allow_llm_fallback: true,
      quality_goals: undefined,
      workspace: normalizedWorkspace,
    });
  });

  it('passes undefined workspace and project ids through normalization when only a workspace shell is provided', async () => {
    normalizeProjectWorkspaceContextMock.mockReturnValue({ identity: {} });
    agentWriteMock.mockResolvedValue({ content: 'workspace shell' });

    const { agentWriteEndpoint } = await import('../../mcp/endpoints/agent.js');
    await agentWriteEndpoint(makeRequest({
      workspace: {},
    }));

    expect(normalizeProjectWorkspaceContextMock).toHaveBeenCalledWith({
      workspace: {},
      workspace_id: undefined,
      workspaceId: undefined,
      project_id: undefined,
      projectId: undefined,
      context: undefined,
    }, {
      workspaceRoot: process.cwd(),
    });
  });

  it('defaults missing draft text and stringifies non-Error revise failures', async () => {
    agentReviseMock.mockRejectedValue('plain failure');

    const { agentReviseEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentReviseEndpoint(makeRequest({}));

    expect(agentReviseMock).toHaveBeenCalledWith({
      draft: '',
      feedback: {},
      allow_llm_fallback: true,
      quality_goals: undefined,
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'plain failure' });
  });

  it('defaults missing scene info to an empty object for agent context requests', async () => {
    agentGetContextMock.mockResolvedValue({ context: [] });

    const { agentContextEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentContextEndpoint(makeRequest({
      context_types: ['plot', 'memory'],
    }));

    expect(agentGetContextMock).toHaveBeenCalledWith({}, ['plot', 'memory']);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ context: [] });
  });
});
