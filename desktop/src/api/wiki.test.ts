import { describe, expect, it, vi } from 'vitest'

import { type ProjectWorkspaceContext } from './workspace'
import {
  listProjectWikiCanonPagesApi,
  promoteProjectWikiCanonApi,
  readProjectWikiCanonPageApi,
} from './wiki'

const workspace: ProjectWorkspaceContext = {
  schemaVersion: '2026-04-08',
  identity: {
    workspaceId: 'atlas-workspace',
    projectId: 'atlas-project',
    projectName: 'Atlas',
    workspaceRoot: '/tmp/atlas',
  },
  manuscript: {
    manuscriptId: null,
    title: null,
    chapterId: 'chapter-1',
    chapterTitle: null,
    chapterNumber: 1,
  },
  storyBible: {
    storyBibleId: null,
    draftId: 'draft-1',
    version: null,
    storage: 'workspace' as const,
  },
  knowledge: {
    focusEntityId: null,
    graphEntityIds: [],
    memoryEntryIds: [],
  },
  authority: {
    recordSetId: null,
    activeSceneId: null,
    activeEventId: null,
    activeTimelineId: null,
    consistencyRunId: null,
  },
  workflow: {
    sessionId: 'workflow-session-1',
    planId: null,
    level: 'L3',
  },
  chat: {
    conversationId: 'conversation-1',
    comparisonEnabled: false,
  },
  compatibility: {
    additiveContract: true as const,
    migratedLegacyFields: [],
    notes: [],
  },
}

describe('wiki api', () => {
  it('posts manual promotion payloads with canonical workspace context', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await promoteProjectWikiCanonApi({
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
    }, workspace)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/wiki/promote')
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
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
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    })
  })

  it('posts review list payloads with additive workspace semantics', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, total_pages: 0, pages: [] }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await listProjectWikiCanonPagesApi(workspace, {
      status: 'curated',
      limit: 5,
    })

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/wiki/list')
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      status: 'curated',
      limit: 5,
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
        },
      },
    })
  })

  it('posts review read payloads for a selected canon page', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, page: null }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await readProjectWikiCanonPageApi('characters/atlas-hero-profile', workspace)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/wiki/page')
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      slug: 'characters/atlas-hero-profile',
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
        },
      },
    })
  })
})
