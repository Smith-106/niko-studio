import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queryGraphMock = vi.hoisted(() => vi.fn())
const listProjectWikiCanonPagesApiMock = vi.hoisted(() => vi.fn())
const promoteProjectWikiCanonApiMock = vi.hoisted(() => vi.fn())
const readProjectWikiCanonPageApiMock = vi.hoisted(() => vi.fn())
const useAppStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/client', () => ({
  queryGraph: queryGraphMock,
  listProjectWikiCanonPagesApi: listProjectWikiCanonPagesApiMock,
  promoteProjectWikiCanonApi: promoteProjectWikiCanonApiMock,
  readProjectWikiCanonPageApi: readProjectWikiCanonPageApiMock,
}))

vi.mock('../../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

import { useSettingsStore } from '../../stores/settingsStore'
import { createDefaultProjectWorkspaceContext, mergeProjectWorkspaceContext } from '../../types/workspace'
import { useStoryBiblePanelController } from './useStoryBiblePanelController'

type AppState = {
  currentWorkspace: ReturnType<typeof createDefaultProjectWorkspaceContext>
  setCurrentWorkspace: (patch: unknown) => void
}

function buildWorkspace() {
  const workspace = createDefaultProjectWorkspaceContext({
    workspaceRoot: 'C:/tmp/story-bible-controller',
    fallbackProjectId: 'default-project',
  })
  workspace.identity.projectName = 'default-project'
  workspace.storyBible.storyBibleId = 'story-bible-1'
  workspace.storyBible.draftId = 'story-bible-default-project'
  return workspace
}

function buildPersistedItem(payload: Record<string, unknown> = {}) {
  return {
    id: String(payload.id ?? 'story-bible-1'),
    type: 'Item',
    name: String(payload.name ?? 'Story Bible'),
    properties: payload,
    created_at: '2026-06-05T00:00:00.000Z',
    updated_at: '2026-06-05T00:00:00.000Z',
  }
}

function buildCanonListResponse(
  pages: Array<{
    id: string
    slug: string
    title: string
    file_path?: string
  }>,
) {
  return {
    success: true,
    data: {
      available: true,
      reason: null,
      workspace_id: 'default-project',
      total_pages: pages.length,
      pages,
    },
  }
}

function buildCanonPageResponse(slug: string, title = 'Story Bible Synopsis') {
  return {
    success: true,
    data: {
      available: true,
      reason: null,
      workspace_id: 'default-project',
      page: {
        id: `page:${slug}`,
        slug,
        title,
        status: 'curated',
        file_path: `${slug}.md`,
        markdown: `# ${title}`,
      },
    },
  }
}

describe('useStoryBiblePanelController uncovered branches', () => {
  const originalConsoleError = console.error
  let appState: AppState

  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()
    localStorage.clear()
    useSettingsStore.getState().updateSettings({ language: 'zh' })

    appState = {
      currentWorkspace: buildWorkspace(),
      setCurrentWorkspace: vi.fn((patch: unknown) => {
        appState.currentWorkspace = mergeProjectWorkspaceContext(appState.currentWorkspace, patch)
      }),
    }

    useAppStoreMock.mockImplementation(<T,>(selector: (state: AppState) => T) => selector(appState))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.startsWith('MERGE (n:Item')) {
        return {
          success: true,
          data: [{ n: buildPersistedItem({ id: 'story-bible-1', name: 'Story Bible', itemKind: 'story-bible' }) }],
        }
      }
      return { success: true, data: [] }
    })

    listProjectWikiCanonPagesApiMock.mockResolvedValue(buildCanonListResponse([]))
    promoteProjectWikiCanonApiMock.mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-1',
          slug: 'story-bible/default-project-synopsis',
          title: 'default-project Story Bible Synopsis',
          status: 'curated',
          file_path: 'story-bible/default-project-synopsis.md',
          markdown: '# Canon',
        },
      },
    })
    readProjectWikiCanonPageApiMock.mockResolvedValue(
      buildCanonPageResponse('story-bible/default-project-synopsis', 'default-project Story Bible Synopsis'),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    console.error = originalConsoleError
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    localStorage.clear()
  })

  it('falls back to "tried" style when imported draft style is not a valid StyleId (line 754)', async () => {
    const OriginalFileReader = globalThis.FileReader

    class MockFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null

      readAsText() {
        this.onload?.({
          target: {
            result: JSON.stringify({
              version: '1.0',
              kind: 'story-bible-local-draft',
              exportedAt: '2026-06-05T00:00:00.000Z',
              draft: {
                braindump: 'imported braindump',
                genres: ['Fantasy'],
                synopsis: 'imported synopsis',
                outline: 'imported outline',
                style: 'invalid-style-id',
              },
            }),
          },
        })
      }
    }

    globalThis.FileReader = MockFileReader as never

    try {
      const { result } = renderHook(() => useStoryBiblePanelController())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const input = document.createElement('input')
      input.value = 'selected'
      act(() => {
        result.current.fileInputRef.current = input
      })

      const file = new File(['draft'], 'story-bible.json', { type: 'application/json' })
      await act(async () => {
        result.current.handleImportDraft({
          target: { files: [file] },
        } as never)
      })

      // isStyleId('invalid-style-id') returns false, so style falls back to 'tried'
      expect(result.current.selectedStyle).toBe('tried')
      expect(result.current.braindump).toBe('imported braindump')
      expect(result.current.synopsis).toBe('imported synopsis')
    } finally {
      globalThis.FileReader = OriginalFileReader
    }
  })

  it('uses workspaceId as workspaceLabel when projectName is empty (line 791)', async () => {
    // Set projectName to empty string
    appState.currentWorkspace.identity.projectName = ''

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A synopsis to promote with empty project name.')
    })

    // Capture the promoteProjectWikiCanonApi call to verify workspaceLabel
    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    expect(promoteProjectWikiCanonApiMock).toHaveBeenCalledTimes(1)
    const promoteCall = promoteProjectWikiCanonApiMock.mock.calls[0]
    const promotedTitle = promoteCall[0].title

    // When projectName is empty, workspaceLabel = workspaceId (not empty)
    // The title should use workspaceId instead of projectName
    const workspaceId = appState.currentWorkspace.identity.workspaceId
    expect(promotedTitle).toBe(`${workspaceId} Story Bible Synopsis`)
  })

  it('throws and shows error when canon promotion response has no page (line 814)', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        available: true,
        reason: 'promotion denied',
        workspace_id: 'default-project',
        page: null,
      },
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A synopsis for the failed promotion test.')
    })

    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    // The response.data.page is null, so !response.data?.page is true → throw
    // This triggers the catch block → showCanonMessage('error', canonCopy.promoteFailed)
    expect(result.current.canonPromoting).toBe(false)
    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: 'Failed to promote synopsis to canon.',
    })
  })

  it('throws and shows error when canon promotion response is not successful with reason (line 814)', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
      success: false,
      error: 'rate limit exceeded',
      data: undefined,
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A synopsis for the error-with-reason test.')
    })

    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    expect(result.current.canonPromoting).toBe(false)
    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: 'Failed to promote synopsis to canon.',
    })
  })
})
