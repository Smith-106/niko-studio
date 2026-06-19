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

describe('useStoryBiblePanelController extra branch coverage', () => {
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
    readProjectWikiCanonPageApiMock.mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'page:synopsis',
          slug: 'story-bible/default-project-synopsis',
          title: 'Synopsis',
          status: 'curated',
          file_path: 'story-bible/default-project-synopsis.md',
          markdown: '# Synopsis',
        },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    console.error = originalConsoleError
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    localStorage.clear()
  })

  // Branch: handleSaveSceneRecord early return when !title (line 316-318)
  it('shows error when saving scene record with empty title', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSceneDraft({
        recordId: null,
        title: '',
        summary: 'some summary',
        chapterId: 'ch-1',
        sceneOrder: '1',
      })
    })

    await act(async () => {
      await result.current.handleSaveSceneRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.scene.titlePlaceholder,
    })
    // The early return means queryGraph was never called with MERGE for narrative scene
    // (it was called for story-bible load, but not for scene save)
    expect(result.current.sceneSaving).toBe(false)
  })

  // Branch: handleSaveEventRecord early return when !title (line 359-361)
  it('shows error when saving event record with empty title', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setEventDraft({
        recordId: null,
        title: '   ',
        summary: 'some summary',
        sceneId: 'scene-1',
      })
    })

    await act(async () => {
      await result.current.handleSaveEventRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.event.titlePlaceholder,
    })
  })

  // Branch: handleSaveTimelineRecord early return when !title (line 401-403)
  it('shows error when saving timeline record with empty title', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setTimelineDraft({
        recordId: null,
        title: '',
        summary: 'some summary',
        mode: 'narrative',
      })
    })

    await act(async () => {
      await result.current.handleSaveTimelineRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.timeline.titlePlaceholder,
    })
  })

  // Branch: selectTimelineRecord with mode !== 'narrative' (line 310)
  it('selects timeline record with story mode when mode is not narrative', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectTimelineRecord({
        id: 'timeline-1',
        name: 'Story Timeline',
        description: 'A story timeline',
        mode: 'other-mode',
      } as never)
    })

    // mode is 'other-mode' which is not 'narrative', so mode becomes 'story'
    expect(result.current.timelineDraft).toMatchObject({
      recordId: 'timeline-1',
      title: 'Story Timeline',
      summary: 'A story timeline',
      mode: 'story',
    })
  })

  // Branch: refreshCanonPages catch block (line 468-470)
  it('shows error when canon page list request fails', async () => {
    listProjectWikiCanonPagesApiMock.mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await waitFor(() => {
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: result.current.canonCopy.reviewLoadFailed,
      })
    })
  })

  // Branch: loadCanonPage catch block (line 486-488)
  it('shows error when reading canon page fails', async () => {
    readProjectWikiCanonPageApiMock.mockRejectedValueOnce(new Error('page read error'))

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.loadCanonPage('story-bible/nonexistent')
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.reviewReadFailed,
    })
    expect(result.current.canonLoadingSlug).toBeNull()
  })

  // Branch: handleImportDraft with no file (line 725-726)
  it('does nothing when import is called with no file', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const input = document.createElement('input')
    act(() => {
      result.current.fileInputRef.current = input
    })

    await act(async () => {
      result.current.handleImportDraft({
        target: { files: [] },
      } as never)
    })

    // Should not change any state
    expect(result.current.draftMessage).toBeNull()
  })

  // Branch: handlePromoteSynopsis with empty synopsis (line 784-786)
  it('shows synopsis required error when promoting with empty synopsis', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Synopsis is empty by default after fresh load
    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.synopsisRequired,
    })
    expect(promoteProjectWikiCanonApiMock).not.toHaveBeenCalled()
  })

  // Branch: canPromoteSynopsis and synopsisPromotionHint (line 841-842)
  it('updates canPromoteSynopsis and synopsisPromotionHint when synopsis has content', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Initially synopsis is empty
    expect(result.current.canPromoteSynopsis).toBe(false)
    expect(result.current.synopsisPromotionHint).toBe(result.current.canonCopy.synopsisRequired)

    act(() => {
      result.current.setSynopsis('A meaningful synopsis')
    })

    expect(result.current.canPromoteSynopsis).toBe(true)
    expect(result.current.synopsisPromotionHint).toBe(result.current.canonCopy.reviewHint)
  })

  // Branch: handleResetDraft sets lastSavedSignatureRef to '__reset__' (line 778)
  it('resets draft and sets lastSavedSignatureRef to __reset__', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setBraindump('Some content')
    })

    act(() => {
      result.current.handleResetDraft()
    })

    expect(result.current.braindump).toBe('')
    expect(result.current.genres).toEqual([])
    expect(result.current.synopsis).toBe('')
    expect(result.current.outline).toBe('')
    expect(result.current.selectedStyle).toBe('tried')
    expect(result.current.draftMessage).toEqual({
      type: 'success',
      text: result.current.t.storyBibleDraftReset,
    })
  })

  // Branch: activateNarrativeRecord with different kinds (line 279-281)
  it('activates scene, event, and timeline records by setting workspace authority', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.activateNarrativeRecord('scene', { id: 'scene-active', recordSetId: 'rs-1' } as never)
    })

    expect(appState.setCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          recordSetId: 'rs-1',
          activeSceneId: 'scene-active',
        }),
      }),
    )

    act(() => {
      result.current.activateNarrativeRecord('event', { id: 'event-active', recordSetId: 'rs-1' } as never)
    })

    expect(appState.setCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          activeEventId: 'event-active',
        }),
      }),
    )

    act(() => {
      result.current.activateNarrativeRecord('timeline', { id: 'timeline-active', recordSetId: 'rs-1' } as never)
    })

    expect(appState.setCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          activeTimelineId: 'timeline-active',
        }),
      }),
    )
  })

  // Branch: loadCanonPage success path (line 484-485)
  it('loads and selects a canon page by slug', async () => {
    listProjectWikiCanonPagesApiMock.mockResolvedValue(
      buildCanonListResponse([
        { id: 'canon-1', slug: 'story-bible/default-project-synopsis', title: 'Synopsis' },
      ]),
    )

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.canonPages).toHaveLength(1)
    })

    await act(async () => {
      await result.current.loadCanonPage('story-bible/default-project-synopsis')
    })

    expect(result.current.selectedCanonSlug).toBe('story-bible/default-project-synopsis')
    expect(result.current.selectedCanonPage).not.toBeNull()
    expect(result.current.selectedCanonPage?.slug).toBe('story-bible/default-project-synopsis')
    expect(result.current.canonLoadingSlug).toBeNull()
  })

  // Branch: addCustomGenre with empty input guard (line 702-704)
  it('does not add custom genre when genreInput is empty or already exists', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Add a genre first
    act(() => {
      result.current.toggleGenre('Fantasy')
    })
    expect(result.current.genres).toContain('Fantasy')

    // Try to add duplicate via custom input
    act(() => {
      result.current.setGenreInput('Fantasy')
    })
    act(() => {
      result.current.addCustomGenre()
    })
    // Should not add duplicate
    expect(result.current.genres.filter((g) => g === 'Fantasy')).toHaveLength(1)

    // Try to add empty genre
    act(() => {
      result.current.setGenreInput('   ')
    })
    act(() => {
      result.current.addCustomGenre()
    })
    // Should not add whitespace-only genre
    expect(result.current.genres).not.toContain('   ')
  })

  // Branch: loadWorkspaceStoryBible with no persisted item → legacy draft path (line 544-556)
  it('loads empty state when no persisted item and no legacy draft exist', async () => {
    // Return empty results for all graph queries
    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    // Clear localStorage so no legacy draft
    localStorage.clear()

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.syncState).toBe('idle')
    expect(result.current.braindump).toBe('')
    expect(result.current.genres).toEqual([])
    expect(result.current.synopsis).toBe('')
    expect(result.current.outline).toBe('')
    expect(result.current.selectedStyle).toBe('tried')
  })

  // Branch: selectSceneRecord with empty id → recordId null (line 288)
  it('selects scene record with null recordId when id is empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectSceneRecord({
        id: '',
        name: 'NoIdScene',
        summary: 'summary',
        chapterId: 'ch-2',
        sceneOrder: '5',
      } as never)
    })

    expect(result.current.sceneDraft).toMatchObject({
      recordId: null,
      title: 'NoIdScene',
      summary: 'summary',
      chapterId: 'ch-2',
      sceneOrder: '5',
    })
  })

  // Branch: selectEventRecord with content fallback (line 300)
  it('selects event record using content fallback when summary and description are empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectEventRecord({
        id: 'event-fallback',
        name: 'FallbackEvent',
        summary: '',
        description: '',
        content: 'Content as fallback',
        sceneId: 'scene-1',
      } as never)
    })

    expect(result.current.eventDraft).toMatchObject({
      recordId: 'event-fallback',
      title: 'FallbackEvent',
      summary: 'Content as fallback',
      sceneId: 'scene-1',
    })
  })
})
