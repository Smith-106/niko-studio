import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const skillsListMock = vi.hoisted(() => vi.fn());
const skillsLoadMock = vi.hoisted(() => vi.fn());
const skillsMatchMock = vi.hoisted(() => vi.fn());
const skillsGetChainMock = vi.hoisted(() => vi.fn());

function makeRequest(
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/skills',
    headers: {},
    body,
    query,
    params: {},
  };
}

async function loadSkillsModule() {
  vi.resetModules();

  vi.doMock('../../mcp/services/skills', () => ({
    skillsList: skillsListMock,
    skillsLoad: skillsLoadMock,
    skillsMatch: skillsMatchMock,
    skillsGetChain: skillsGetChainMock,
  }));

  return import('../../mcp/endpoints/skills.js');
}

describe('skills endpoints branch-gap coverage', () => {
  beforeEach(() => {
    skillsListMock.mockReset();
    skillsLoadMock.mockReset();
    skillsMatchMock.mockReset();
    skillsGetChainMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../mcp/services/skills');
  });

  it('falls back to undefined or empty-string inputs for missing optional request fields', async () => {
    skillsListMock.mockResolvedValueOnce([]);
    skillsLoadMock.mockResolvedValueOnce({ missing: true });
    skillsGetChainMock.mockResolvedValueOnce([]);

    const {
      skillsListEndpoint,
      skillsLoadEndpoint,
      skillsChainEndpoint,
    } = await loadSkillsModule();

    const listResponse = await skillsListEndpoint(makeRequest());
    expect(skillsListMock).toHaveBeenCalledWith(undefined);
    expect(listResponse.body).toEqual({ skills: [] });

    const loadResponse = await skillsLoadEndpoint(makeRequest({}));
    expect(skillsLoadMock).toHaveBeenCalledWith('');
    expect(loadResponse.body).toEqual({ missing: true });

    const chainResponse = await skillsChainEndpoint(makeRequest({}));
    expect(skillsGetChainMock).toHaveBeenCalledWith('');
    expect(chainResponse.body).toEqual([]);
  });
});
