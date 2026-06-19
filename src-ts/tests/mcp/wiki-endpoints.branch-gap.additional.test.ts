import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const listProjectWikiCanonPagesMock = vi.fn();
const promoteProjectWikiCanonMock = vi.fn();
const readProjectWikiCanonPageMock = vi.fn();

vi.mock('../../mcp/services/wiki.js', () => ({
  listProjectWikiCanonPages: listProjectWikiCanonPagesMock,
  promoteProjectWikiCanon: promoteProjectWikiCanonMock,
  readProjectWikiCanonPage: readProjectWikiCanonPageMock,
}));

function makeRequest(url: string, body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function buildWorkspaceBody(): Record<string, unknown> {
  return {
    workspace: {
      identity: {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        projectName: 'Atlas',
        workspaceRoot: '/tmp/atlas',
      },
      workflow: {
        sessionId: 'session-7',
      },
    },
  };
}

describe('wiki endpoints branch-gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('falls back to empty title/body strings and omits invalid raw evidence payloads', async () => {
    promoteProjectWikiCanonMock.mockResolvedValueOnce({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: { id: 'page-blank', slug: 'blank' },
      raw_evidence_path: null,
      log_entry: null,
    });

    const { wikiPromoteEndpoint } = await import('../../mcp/endpoints/wiki.js');
    await wikiPromoteEndpoint(makeRequest('/wiki/promote', {
      ...buildWorkspaceBody(),
      slug: '   ',
      raw_evidence: [],
    }));

    expect(promoteProjectWikiCanonMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '',
      body: '',
      slug: undefined,
      idSeed: undefined,
      promotedFrom: null,
      sourceId: undefined,
      sourceRef: undefined,
      status: undefined,
      rawEvidence: undefined,
      metadata: undefined,
    }));
  });

  it('normalizes blank raw evidence fields to undefined', async () => {
    promoteProjectWikiCanonMock.mockResolvedValueOnce({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: { id: 'page-raw', slug: 'raw' },
      raw_evidence_path: null,
      log_entry: null,
    });

    const { wikiPromoteEndpoint } = await import('../../mcp/endpoints/wiki.js');
    await wikiPromoteEndpoint(makeRequest('/wiki/promote', {
      ...buildWorkspaceBody(),
      title: 'Raw Edge',
      body: 'body',
      rawEvidence: {
        relativePath: '   ',
        content: '   ',
      },
    }));

    expect(promoteProjectWikiCanonMock).toHaveBeenCalledWith(expect.objectContaining({
      rawEvidence: {
        relativePath: undefined,
        content: undefined,
      },
    }));
  });

  it('passes an empty slug when wiki page requests omit the field entirely', async () => {
    readProjectWikiCanonPageMock.mockResolvedValueOnce({
      available: true,
      reason: 'missing-slug',
      workspace_id: 'atlas-workspace',
      page: null,
    });

    const { wikiReadPageEndpoint } = await import('../../mcp/endpoints/wiki.js');
    const response = await wikiReadPageEndpoint(makeRequest('/wiki/page', {
      ...buildWorkspaceBody(),
    }));

    expect(readProjectWikiCanonPageMock).toHaveBeenCalledWith(expect.objectContaining({
      slug: '',
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      reason: 'missing-slug',
      page: null,
    });
  });
});
