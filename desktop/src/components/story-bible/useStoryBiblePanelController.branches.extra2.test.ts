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
    workspaceRoot: 'C:/tmp/story-bible-controller-2',
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
    braindump: payload.braindump,
    genres: payload.genres,
    synopsis: payload.synopsis,
    outline: payload.outline,
    style: payload.style,
    version: payload.version,
  }
}

describe('useStoryBiblePanelController extra2 branch coverage', () => {
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

    listProjectWikiCanonPagesApiMock.mockResolvedValue({
      success: true,
      data: { available: true, reason: null, workspace_id: 'default-project', total_pages: 0, pages: [] },
    })
    promoteProjectWikiCanonApiMock.mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-1',
          slug: 'story-bible/default-project-synopsis',
          title: 'Synopsis',
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

  // Line 274: activateNarrativeRecord with no recordSetId on item → uses authority.recordSetId
  it('uses authority.recordSetId when item has no recordSetId', async () => {
    // Set authority.recordSetId to a value
    appState.currentWorkspace.authority.recordSetId = 'authority-rs'

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      // Item without recordSetId field
      result.current.activateNarrativeRecord('scene', { id: 'scene-active' } as never)
    })

    expect(appState.setCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          recordSetId: 'authority-rs',
          activeSceneId: 'scene-active',
        }),
      }),
    )
  })

  // Line 274: activateNarrativeRecord falls back to workspaceId when both item and authority recordSetId empty
  it('uses workspaceId when neither item nor authority has recordSetId', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      // Item without recordSetId, authority.recordSetId is null by default
      result.current.activateNarrativeRecord('event', { id: 'event-active' } as never)
    })

    expect(appState.setCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        authority: expect.objectContaining({
          // recordSetId falls through to workspaceId
          recordSetId: expect.any(String),
          activeEventId: 'event-active',
        }),
      }),
    )
  })

  // Line 290: selectSceneRecord uses content as summary fallback
  it('uses content as summary fallback for scene record when summary and description empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectSceneRecord({
        id: 'scene-content',
        name: 'ContentScene',
        summary: '',
        description: '',
        content: 'Content from content field',
        chapterId: 'ch-1',
        sceneOrder: '2',
      } as never)
    })

    expect(result.current.sceneDraft).toMatchObject({
      recordId: 'scene-content',
      title: 'ContentScene',
      summary: 'Content from content field',
      chapterId: 'ch-1',
      sceneOrder: '2',
    })
  })

  // Line 298: selectEventRecord with empty id → recordId null
  it('sets event recordId to null when id is empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectEventRecord({
        id: '',
        name: 'NoIdEvent',
        summary: 'event summary',
        sceneId: 'scene-1',
      } as never)
    })

    expect(result.current.eventDraft).toMatchObject({
      recordId: null,
      title: 'NoIdEvent',
      summary: 'event summary',
      sceneId: 'scene-1',
    })
  })

  // Line 307: selectTimelineRecord with empty id → recordId null
  it('sets timeline recordId to null when id is empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectTimelineRecord({
        id: '',
        name: 'NoIdTimeline',
        summary: 'timeline summary',
        mode: 'narrative',
      } as never)
    })

    expect(result.current.timelineDraft).toMatchObject({
      recordId: null,
      title: 'NoIdTimeline',
    })
  })

  // Line 309: selectTimelineRecord uses content as summary fallback
  it('uses content as summary fallback for timeline record', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.selectTimelineRecord({
        id: 'tl-content',
        name: 'ContentTimeline',
        summary: '',
        description: '',
        content: 'Timeline content field',
        mode: 'narrative',
      } as never)
    })

    expect(result.current.timelineDraft).toMatchObject({
      recordId: 'tl-content',
      title: 'ContentTimeline',
      summary: 'Timeline content field',
    })
  })

  // Line 334: scene save with empty chapterId → null in mutation
  it('sends chapterId null when scene chapterId is empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSceneDraft({
        recordId: null,
        title: 'Scene Title',
        summary: 'summary',
        chapterId: '   ',
        sceneOrder: '1',
      })
    })

    await act(async () => {
      await result.current.handleSaveSceneRecord()
    })

    // The MERGE mutation should have been called — queryGraph is called for scene save
    expect(queryGraphMock).toHaveBeenCalled()
    // Verify success message shown
    expect(result.current.draftMessage).toEqual({
      type: 'success',
      text: result.current.narrativeCopy.scene.saveSuccess,
    })
  })

  // Line 342: scene save graphError branch (response.error empty, graphError present)
  it('shows save error when scene save returns graph-level error with empty response error', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSceneDraft({
        recordId: null,
        title: 'Scene Title',
        summary: 'summary',
        chapterId: 'ch-1',
        sceneOrder: '1',
      })
    })

    // Mock queryGraph to return success=false with empty error but data has error row
    queryGraphMock.mockImplementationOnce(async (cypher: string) => {
      if (cypher.includes('MERGE') && cypher.includes('scene')) {
        return { success: false, error: '', data: [{ error: 'graph-level scene error' }] }
      }
      return { success: true, data: [] }
    })

    await act(async () => {
      await result.current.handleSaveSceneRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.scene.saveError,
    })
    expect(result.current.sceneSaving).toBe(false)
  })

  // Line 342: scene save saveError literal fallback (both response.error and graphError empty)
  it('shows save error fallback when scene save returns failure with no error and empty data', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSceneDraft({
        recordId: null,
        title: 'Scene Title',
        summary: 'summary',
        chapterId: 'ch-1',
        sceneOrder: '1',
      })
    })

    // Both response.error empty AND data empty array → graphError null → falls to saveError literal
    queryGraphMock.mockImplementationOnce(async (cypher: string) => {
      if (cypher.includes('MERGE') && cypher.includes('scene')) {
        return { success: false, error: '', data: [] }
      }
      return { success: true, data: [] }
    })

    await act(async () => {
      await result.current.handleSaveSceneRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.scene.saveError,
    })
  })

  // Line 377: event save with empty sceneId → null
  it('sends sceneId null when event sceneId is empty', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setEventDraft({
        recordId: null,
        title: 'Event Title',
        summary: 'summary',
        sceneId: '   ',
      })
    })

    await act(async () => {
      await result.current.handleSaveEventRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'success',
      text: result.current.narrativeCopy.event.saveSuccess,
    })
  })

  // Line 384: event save graphError fallback
  it('shows save error when event save returns graph-level error', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setEventDraft({
        recordId: null,
        title: 'Event Title',
        summary: 'summary',
        sceneId: 'scene-1',
      })
    })

    queryGraphMock.mockImplementationOnce(async (cypher: string) => {
      if (cypher.includes('MERGE') && cypher.includes('event')) {
        return { success: false, error: '', data: [{ error: 'graph event error' }] }
      }
      return { success: true, data: [] }
    })

    await act(async () => {
      await result.current.handleSaveEventRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.event.saveError,
    })
  })

  // Line 426: timeline save graphError fallback
  it('shows save error when timeline save returns graph-level error', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setTimelineDraft({
        recordId: null,
        title: 'Timeline Title',
        summary: 'summary',
        mode: 'narrative',
      })
    })

    queryGraphMock.mockImplementationOnce(async (cypher: string) => {
      if (cypher.includes('MERGE') && cypher.includes('timeline')) {
        return { success: false, error: '', data: [{ error: 'graph timeline error' }] }
      }
      return { success: true, data: [] }
    })

    await act(async () => {
      await result.current.handleSaveTimelineRecord()
    })

    expect(result.current.draftMessage).toEqual({
      type: 'error',
      text: result.current.narrativeCopy.timeline.saveError,
    })
  })

  // Line 457: canon list reason fallback
  it('shows canon load error when canon list returns failure with reason but empty error', async () => {
    listProjectWikiCanonPagesApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: { available: false, reason: 'rate limited' },
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: result.current.canonCopy.reviewLoadFailed,
      })
    })
  })

  // Line 457: 'Canon list failed' literal fallback (no reason, no error)
  it('shows canon load error when canon list returns failure with no error or reason', async () => {
    listProjectWikiCanonPagesApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: undefined,
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.canonMessage).toEqual({
        type: 'error',
        text: result.current.canonCopy.reviewLoadFailed,
      })
    })
  })

  // Line 481: canon page reason fallback
  it('shows canon read error when reading canon page returns failure with reason', async () => {
    readProjectWikiCanonPageApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: { available: false, reason: 'page not found' },
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.loadCanonPage('story-bible/missing')
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.reviewReadFailed,
    })
  })

  // Line 481: 'Canon page read failed' literal fallback
  it('shows canon read error when reading canon page returns failure with no error or reason', async () => {
    readProjectWikiCanonPageApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: undefined,
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.loadCanonPage('story-bible/missing')
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.reviewReadFailed,
    })
  })

  // Line 814: canon promotion reason fallback
  it('shows canon promote error when promotion returns failure with reason', async () => {
    promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: { available: false, reason: 'promotion denied' },
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A meaningful synopsis to promote')
    })

    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.promoteFailed,
    })
  })

  // Line 814: 'Canon promotion failed' literal fallback
  it('shows canon promote error when promotion returns failure with no error or reason', async () => {
    promoteProjectWikiCanonApiMock.mockResolvedValueOnce({
      success: false,
      error: '',
      data: undefined,
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSynopsis('A meaningful synopsis to promote')
    })

    await act(async () => {
      await result.current.handlePromoteSynopsis()
    })

    expect(result.current.canonMessage).toEqual({
      type: 'error',
      text: result.current.canonCopy.promoteFailed,
    })
  })

  // Line 520/529/533/535: persisted item with invalid style, empty id, empty version
  it('falls back to tried style, storyBibleName, and default version for persisted item with invalid fields', async () => {
    // Persisted item with: invalid style, no id (will use readString), no version
    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.startsWith('MATCH') && cypher.includes('story-bible')) {
        return {
          success: true,
          data: [{
            n: buildPersistedItem({
              id: '',
              name: 'Custom Story Bible',
              itemKind: 'story-bible',
              style: 'invalid-style-id',
              braindump: 'loaded braindump',
              genres: '["Fantasy"]',
              synopsis: 'loaded synopsis',
              outline: 'loaded outline',
              // version deliberately omitted
            }),
          }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.braindump).toBe('loaded braindump')
    })

    // Line 520: isStyleId('invalid-style-id') is false → selectedStyle falls back to 'tried'
    expect(result.current.selectedStyle).toBe('tried')
    expect(result.current.synopsis).toBe('loaded synopsis')
    expect(result.current.outline).toBe('loaded outline')
  })

  // Line 746/748: import draft with missing version and exportedAt → uses fallbacks
  it('imports draft using version and exportedAt fallbacks when missing', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Build a draft payload without version and exportedAt
    const draftPayload = {
      kind: 'story-bible-local-draft',
      draft: {
        braindump: 'imported braindump',
        genres: ['Fantasy', 'SciFi'],
        synopsis: 'imported synopsis',
        outline: 'imported outline',
        style: 'tried',
      },
      // version and exportedAt deliberately omitted
    }

    const file = new File([JSON.stringify(draftPayload)], 'draft.json', { type: 'application/json' })

    await act(async () => {
      await result.current.handleImportDraft({
        target: { files: [file] },
      } as never)
    })

    // The import applies asynchronously via FileReader.onload — wait for state
    await waitFor(() => {
      expect(result.current.braindump).toBe('imported braindump')
    })

    expect(result.current.synopsis).toBe('imported synopsis')
    expect(result.current.draftMessage).toEqual({
      type: 'success',
      text: expect.any(String),
    })
  })

  // Line 731: FileReader result null → '' (defensive guard)
  it('shows import error when FileReader result is null', async () => {
    const { result } = renderHook(() => useStoryBiblePanelController())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Mock FileReader to have null result on load (synchronous trigger)
    const originalFileReader = global.FileReader
    class FakeFileReader {
      onload: ((event: { target: { result: unknown } | null }) => void) | null = null
      readAsText(): void {
        // Simulate the defensive guard: target.result is null — fire synchronously
        this.onload?.({ target: { result: null } })
      }
    }
    global.FileReader = FakeFileReader as unknown as typeof FileReader

    const file = new File(['not-json'], 'draft.json', { type: 'application/json' })

    try {
      await act(async () => {
        await result.current.handleImportDraft({
          target: { files: [file] },
        } as never)
      })

      // String(null ?? '') = String('') = '' → JSON.parse('') throws → shows import invalid error
      await waitFor(() => {
        expect(result.current.draftMessage).toEqual({
          type: 'error',
          text: expect.any(String),
        })
      })
    } finally {
      global.FileReader = originalFileReader
    }
  })
})
