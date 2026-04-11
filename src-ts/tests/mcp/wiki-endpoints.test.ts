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

describe('wiki endpoints', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('maps promotion payloads into the bounded wiki service contract', async () => {
    promoteProjectWikiCanonMock.mockResolvedValueOnce({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: { id: 'page-1', slug: 'characters/atlas-hero-profile' },
      raw_evidence_path: '/tmp/raw.md',
      log_entry: { type: 'promotion' },
    });

    const { wikiPromoteEndpoint } = await import('../../mcp/endpoints/wiki.js');
    const response = await wikiPromoteEndpoint(makeRequest('/wiki/promote', {
      title: 'Atlas Hero Profile',
      body: 'Atlas is the primary protagonist.',
      slug: 'characters/atlas-hero-profile',
      promoted_from: 'story-bible',
      source_id: 'hero-7',
      source_ref: 'story-bible.characters.hero-7',
      raw_evidence: {
        relative_path: 'imports/story-bible/hero-7.md',
        content: 'Hero source note',
      },
      metadata: {
        section: 'characters',
      },
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
        workflow: {
          sessionId: 'workflow-session-7',
        },
      },
    }));

    expect(promoteProjectWikiCanonMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Atlas Hero Profile',
      body: 'Atlas is the primary protagonist.',
      slug: 'characters/atlas-hero-profile',
      promotedFrom: 'story-bible',
      sourceId: 'hero-7',
      sourceRef: 'story-bible.characters.hero-7',
      rawEvidence: {
        relativePath: 'imports/story-bible/hero-7.md',
        content: 'Hero source note',
      },
      metadata: {
        section: 'characters',
      },
      workspace: expect.objectContaining({
        identity: expect.objectContaining({
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        }),
      }),
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      available: true,
      workspace_id: 'atlas-workspace',
      workspace: expect.objectContaining({
        identity: expect.objectContaining({
          workspaceId: 'atlas-workspace',
        }),
      }),
    }));
  });

  it('maps canon list payloads into the review list service contract', async () => {
    listProjectWikiCanonPagesMock.mockResolvedValueOnce({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      total_pages: 1,
      pages: [
        {
          id: 'page-1',
          slug: 'characters/atlas-hero-profile',
          title: 'Atlas Hero Profile',
          status: 'curated',
          file_path: 'characters/atlas-hero-profile.md',
        },
      ],
    });

    const { wikiListEndpoint } = await import('../../mcp/endpoints/wiki.js');
    const response = await wikiListEndpoint(makeRequest('/wiki/list', {
      status: 'curated',
      limit: 5,
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
      },
    }));

    expect(listProjectWikiCanonPagesMock).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        identity: expect.objectContaining({
          workspaceId: 'atlas-workspace',
        }),
      }),
      status: 'curated',
      limit: 5,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      total_pages: 1,
      pages: [
        expect.objectContaining({
          slug: 'characters/atlas-hero-profile',
        }),
      ],
    }));
  });

  it('maps canon read payloads into the review read service contract', async () => {
    readProjectWikiCanonPageMock.mockResolvedValueOnce({
      available: true,
      reason: null,
      workspace_id: 'atlas-workspace',
      page: {
        id: 'page-1',
        slug: 'characters/atlas-hero-profile',
        title: 'Atlas Hero Profile',
        status: 'curated',
        file_path: 'characters/atlas-hero-profile.md',
        markdown: '# Atlas Hero Profile',
      },
    });

    const { wikiReadPageEndpoint } = await import('../../mcp/endpoints/wiki.js');
    const response = await wikiReadPageEndpoint(makeRequest('/wiki/page', {
      slug: 'characters/atlas-hero-profile',
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
      },
    }));

    expect(readProjectWikiCanonPageMock).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        identity: expect.objectContaining({
          workspaceId: 'atlas-workspace',
        }),
      }),
      slug: 'characters/atlas-hero-profile',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      page: expect.objectContaining({
        slug: 'characters/atlas-hero-profile',
      }),
    }));
  });
});
