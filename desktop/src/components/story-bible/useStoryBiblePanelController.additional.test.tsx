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
import { readCanonCopy } from './storyBiblePanelUtils'
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

describe('useStoryBiblePanelController additional coverage', () => {
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

  it('uses English genre presets and the empty synopsis hint when language is en', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.language).toBe('en')
    expect(result.current.genrePresets).toContain('Fantasy')
    expect(result.current.genrePresets).toContain('Light Novel')
    expect(result.current.genrePresets).not.toContain('奇幻')
    expect(result.current.synopsisPromotionHint).toBe(readCanonCopy('en').synopsisRequired)
  })

  it('clears a stale selected canon page when refresh results no longer contain the slug', async () => {
    listProjectWikiCanonPagesApiMock.mockResolvedValue(
      buildCanonListResponse([
        {
          id: 'canon-1',
          slug: 'story-bible/old-synopsis',
          title: 'Old synopsis',
          file_path: 'story-bible/old-synopsis.md',
        },
      ]),
    )
    readProjectWikiCanonPageApiMock.mockResolvedValue(buildCanonPageResponse('story-bible/old-synopsis', 'Old synopsis'))

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.canonPages).toHaveLength(1)
    })

    await act(async () => {
      await result.current.loadCanonPage('story-bible/old-synopsis')
    })

    expect(result.current.selectedCanonSlug).toBe('story-bible/old-synopsis')
    expect(result.current.selectedCanonPage?.slug).toBe('story-bible/old-synopsis')

    listProjectWikiCanonPagesApiMock.mockResolvedValueOnce(
      buildCanonListResponse([
        {
          id: 'canon-2',
          slug: 'story-bible/new-synopsis',
          title: 'New synopsis',
          file_path: 'story-bible/new-synopsis.md',
        },
      ]),
    )

    await act(async () => {
      await result.current.refreshCanonPages()
    })

    await waitFor(() => {
      expect(result.current.canonPages).toHaveLength(1)
      expect(result.current.selectedCanonSlug).toBeNull()
      expect(result.current.selectedCanonPage).toBeNull()
    })
  })

  it('shows the promotion failure message when canon promotion fails', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
      success: false,
      error: 'promotion failed',
      data: undefined,
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A concise premise for canon promotion.')
    })

    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    await waitFor(() => {
      expect(promoteProjectWikiCanonApiMock).toHaveBeenCalledTimes(1)
      expect(result.current.canonPromoting).toBe(false)
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: readCanonCopy('en').promoteFailed,
      })
    })
    expect(readProjectWikiCanonPageApiMock).not.toHaveBeenCalled()
  })

  it('does not auto-persist an untouched empty draft after the initial load completes', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 450))
    })

    expect(queryGraphMock).not.toHaveBeenCalledWith(expect.stringContaining('MERGE (n:Item'), expect.anything())
  })

  it('auto clears draft and canon messages after the timeout window', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.useFakeTimers()
    try {
      act(() => {
        result.current.handleResetDraft()
      })
      expect(result.current.draftMessage).toEqual({
        type: 'success',
        text: result.current.t.storyBibleDraftReset,
      })

      await act(async () => {
        await result.current.handlePromoteSynopsis()
      })
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: result.current.canonCopy.synopsisRequired,
      })

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.draftMessage).toBeNull()
      expect(result.current.canonMessage).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the previous canon message timeout before showing the next message', async () => {
    try {
      useSettingsStore.getState().updateSettings({ language: 'en' })
      promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
        success: false,
        error: 'promotion failed',
        data: undefined,
      })

      const { result } = renderHook(() => useStoryBiblePanelController())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      vi.useFakeTimers()

      await act(async () => {
        await result.current.handlePromoteSynopsis()
      })
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: result.current.canonCopy.synopsisRequired,
      })

      act(() => {
        result.current.setSynopsis('A concise premise for canon promotion.')
      })

      await act(async () => {
        await result.current.handlePromoteSynopsis()
      })

      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: readCanonCopy('en').promoteFailed,
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: readCanonCopy('en').promoteFailed,
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2400)
      })
      expect(result.current.canonMessage).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('swallows knowledge and narrative refresh errors during initial load', async () => {
    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        throw new Error('character query failed')
      }
      if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = \"narrative-scene\"')) {
        throw new Error('scene query failed')
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.syncState).toBe('idle')
    expect(result.current.characters).toEqual([])
    expect(result.current.locations).toEqual([])
    expect(result.current.sceneRecords).toEqual([])
    expect(result.current.eventRecords).toEqual([])
    expect(result.current.timelineRecords).toEqual([])
  })

  it('selects scene, event, and timeline records with fallback fields', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectSceneRecord({
        id: 'scene-1',
        name: 'Scene Name',
        description: 'Scene summary',
      } as never)
      result.current.selectEventRecord({
        id: 'event-1',
        name: 'Event Name',
        content: 'Event summary',
      } as never)
      result.current.selectTimelineRecord({
        id: 'timeline-1',
        name: 'Timeline Name',
        description: 'Timeline summary',
        mode: 'narrative',
      } as never)
    })

    expect(result.current.sceneDraft).toMatchObject({
      recordId: 'scene-1',
      title: 'Scene Name',
      summary: 'Scene summary',
    })
    expect(result.current.eventDraft).toMatchObject({
      recordId: 'event-1',
      title: 'Event Name',
      summary: 'Event summary',
    })
    expect(result.current.timelineDraft).toMatchObject({
      recordId: 'timeline-1',
      title: 'Timeline Name',
      summary: 'Timeline summary',
      mode: 'narrative',
    })
  })

  it('toggles preset genres and adds a trimmed custom genre once', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.toggleGenre('Fantasy')
    })
    expect(result.current.genres).toContain('Fantasy')

    act(() => {
      result.current.toggleGenre('Fantasy')
    })
    expect(result.current.genres).not.toContain('Fantasy')

    act(() => {
      result.current.setGenreInput('  Mythic  ')
    })
    act(() => {
      result.current.addCustomGenre()
    })
    expect(result.current.genres).toContain('Mythic')
    expect(result.current.genreInput).toBe('')

    act(() => {
      result.current.setGenreInput('Mythic')
    })
    act(() => {
      result.current.addCustomGenre()
    })
    expect(result.current.genres.filter((genre) => genre === 'Mythic')).toHaveLength(1)
  })

  it('shows an error message when saving scene, event, and timeline records fails', async () => {
    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.startsWith('MERGE (n:Item') && cypher.includes("itemKind: 'narrative-scene'")) {
        return { success: false, error: 'scene failed', data: [] }
      }
      if (cypher.startsWith('MERGE (n:Item') && cypher.includes("itemKind: 'narrative-event'")) {
        return { success: false, error: 'event failed', data: [] }
      }
      if (cypher.startsWith('MERGE (n:Item') && cypher.includes("itemKind: 'narrative-timeline'")) {
        return { success: false, error: 'timeline failed', data: [] }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSceneDraft({
        recordId: null,
        title: 'Scene Alpha',
        summary: 'Scene Summary',
        chapterId: 'chapter-1',
        sceneOrder: '2',
      })
    })
    await act(async () => {
      await result.current.handleSaveSceneRecord()
    })
    expect(result.current.sceneSaving).toBe(false)
    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.scene.saveError,
    })

    act(() => {
      result.current.setEventDraft({
        recordId: null,
        title: 'Event Alpha',
        summary: 'Event Summary',
        sceneId: 'scene-1',
      })
    })
    await act(async () => {
      await result.current.handleSaveEventRecord()
    })
    expect(result.current.eventSaving).toBe(false)
    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.event.saveError,
    })

    act(() => {
      result.current.setTimelineDraft({
        recordId: null,
        title: 'Timeline Alpha',
        summary: 'Timeline Summary',
        mode: 'story',
      })
    })
    await act(async () => {
      await result.current.handleSaveTimelineRecord()
    })
    expect(result.current.timelineSaving).toBe(false)
    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.timeline.saveError,
    })
  })

  it('surfaces invalid imported drafts and clears the file input element', async () => {
    const OriginalFileReader = globalThis.FileReader

    class MockFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null

      readAsText() {
        this.onload?.({ target: { result: '{"kind":"invalid"}' } })
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

      const file = new File(['invalid'], 'story-bible.json', { type: 'application/json' })
      await act(async () => {
        result.current.handleImportDraft({
          target: { files: [file] },
        } as never)
      })

      expect(result.current.draftMessage).toEqual({
        type: 'error',
        text: result.current.t.storyBibleDraftImportInvalid,
      })
      expect(input.value).toBe('')
    } finally {
      globalThis.FileReader = OriginalFileReader
    }
  })

  it('surfaces the English autosave failure copy when debounced persistence fails', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.startsWith('MERGE (n:Item')) {
        return { success: false, error: 'persist failed', data: [] }
      }
      return { success: true, data: [] }
    })

    try {
      const { result } = renderHook(() => useStoryBiblePanelController())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      vi.useFakeTimers()

      act(() => {
        result.current.setBraindump('Draft that will fail to persist')
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350)
      })

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.syncState).toBe('error')
      expect(result.current.draftMessage).toEqual({
        type: 'error',
        text: 'Failed to save the Story Bible. Your current draft is still here. Please retry.',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces load failures when the persisted graph query returns a mutation error row', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (n:Item) WHERE n.name =')) {
        return {
          success: true,
          data: [{ error: 'graph mutation failed' }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.syncState).toBe('error')
    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: 'Failed to load the Story Bible. Please try again.',
    })
  })
})
