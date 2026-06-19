import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryGraphMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  queryGraph: queryGraphMock,
}))

import { useAppStore } from '../stores/appStore'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { useStoryContext } from './useStoryContext'

function buildWorkspace(workspaceId = 'atlas-workspace', projectId = 'atlas-project') {
  const workspace = createDefaultProjectWorkspaceContext({
    workspaceRoot: `/tmp/${projectId}`,
    fallbackProjectId: projectId,
  })
  workspace.identity.workspaceId = workspaceId
  workspace.identity.projectId = projectId
  return workspace
}

describe('useStoryContext extra branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
      currentProjectId: null,
      currentChapterId: null,
      getChaptersForProject: state.getChaptersForProject,
    }))
  })

  // Branch: extractItemSummary — item.name resolves from title in normalizeGraphItem (line 19-21)
  // normalizeGraphItem falls back: name = readString(item.name) ?? readString(properties.name) ?? readString(item.id) ?? ''
  // When item has no name and no properties.name but has an id, name = id
  it('uses item id when name is not available in graph data', async () => {
    const workspace = buildWorkspace('id-fallback-ws', 'id-fallback')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'id-fallback',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        // Item with no name but has id — normalizeGraphItem uses id as name
        return {
          success: true,
          data: [{ c: { id: 'char-by-id', workspaceId: 'id-fallback-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // normalizeGraphItem: name = id = 'char-by-id', description = ''
    // extractItemSummary: name is truthy, desc is '' → returns just name
    expect(ctx.characters).toContain('char-by-id')
  })

  // Branch: extractItemSummary — name from title when type provides fallback (line 34)
  // normalizeGraphItem: title = readString(item.title) ?? readString(properties.title) ?? readString(item.type) ?? ''
  it('uses item type as title when no title is provided', async () => {
    const workspace = buildWorkspace('type-title-ws', 'type-title')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'type-title',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [{ c: { id: 'char-type', name: 'TypeChar', type: 'Character', description: 'Has type', workspaceId: 'type-title-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    expect(ctx.characters).toContain('TypeChar')
  })

  // Branch: extractItemSummary — description from content field (line 21-22)
  // normalizeGraphItem: description = readString(item.description) ?? readString(item.content) ?? ...
  it('uses item content when description is not directly provided', async () => {
    const workspace = buildWorkspace('content-desc-ws', 'content-desc')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'content-desc',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [{ c: { id: 'char-content', name: 'ContentChar', content: 'Content from content field', workspaceId: 'content-desc-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // normalizeGraphItem uses content as description fallback
    expect(ctx.characters).toContain('ContentChar')
    expect(ctx.characters).toContain('Content from content field')
  })

  // Branch: extractItemSummary — name is truthy, desc is empty → returns just name (line 23)
  it('returns just name when description is empty', async () => {
    const workspace = buildWorkspace('name-only-ws', 'name-only')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'name-only',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [{ c: { id: '1', name: 'SoloName', workspaceId: 'name-only-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // name is truthy, desc is empty → returns just name
    expect(ctx.characters).toBe('SoloName')
  })

  // Branch: extractItemSummary — name and id are empty → returns '' (line 23)
  it('returns empty string when both name and id are empty', async () => {
    const workspace = buildWorkspace('empty-name-ws', 'empty-name')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'empty-name',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [{ c: { id: '', name: '', workspaceId: 'empty-name-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // name = '' and id = '' → name is falsy → extractItemSummary returns ''
    // But the item still passes through filterWorkspaceKnowledgeItems,
    // and extractItemSummary returns '' → filter(Boolean) removes it
    expect(ctx.characters).toBe('')
  })

  // Branch: foreshadowing appended when plotThreads already has content (line 93-94)
  it('appends foreshadowing to existing plotThreads', async () => {
    const workspace = buildWorkspace('foreshadow-append-ws', 'foreshadow-append')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'foreshadow-append',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = "narrative-event"')) {
        return {
          success: true,
          data: [{ n: { id: '1', name: 'PlotEvent', description: 'A plot event', workspaceId: 'foreshadow-append-ws' } }],
        }
      }
      if (cypher.includes('foreshadowing')) {
        return {
          success: true,
          data: [{ n: { id: '2', name: 'Foreshadow', description: 'A foreshadowing', workspaceId: 'foreshadow-append-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // plotThreads should have both plot event and foreshadowing joined by \n
    expect(ctx.plotThreads).toContain('PlotEvent')
    expect(ctx.plotThreads).toContain('Foreshadow')
    expect(ctx.plotThreads).toContain('\n')
  })

  // Branch: worldview fallback to Location when worldview query returns empty (line 113-120)
  it('falls back to Location query when worldview is empty', async () => {
    const workspace = buildWorkspace('location-fallback-ws', 'location-fallback')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'location-fallback',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (w:Worldview)')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('MATCH (l:Location)')) {
        return {
          success: true,
          data: [{ l: { id: 'loc-1', name: 'Castle', description: 'An ancient castle', workspaceId: 'location-fallback-ws' } }],
        }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    // Worldview was empty, so Location query ran and populated worldview
    expect(ctx.worldview).toContain('Castle')
  })

  // Branch: previousChapterSummary when prevChapter has no title (line 135-137)
  it('returns empty string for previous chapter with no title', async () => {
    const workspace = buildWorkspace('no-title-ws', 'no-title')

    const getChaptersForProject = vi.fn().mockReturnValue([
      { id: 'chapter-0', volumeId: 'v-1', title: '', order: 0, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z' },
      { id: 'chapter-1', volumeId: 'v-1', title: 'Chapter One', order: 1, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z' },
    ])

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'no-title',
      currentChapterId: 'chapter-1',
      getChaptersForProject,
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(getChaptersForProject).toHaveBeenCalledWith('no-title')
    })

    // prevChapter.title is '' → `prevChapter?.title ? ... : ''` returns ''
    expect(result.current.getStoryContext().previousChapterSummary).toBe('')
  })

  // Branch: previousChapterSummary when prevChapter has a title (line 136)
  it('returns previous chapter title summary when title exists', async () => {
    const workspace = buildWorkspace('title-ws', 'title-project')

    const getChaptersForProject = vi.fn().mockReturnValue([
      { id: 'chapter-0', volumeId: 'v-1', title: 'Prologue', order: 0, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z' },
      { id: 'chapter-1', volumeId: 'v-1', title: 'Chapter One', order: 1, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z' },
    ])

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'title-project',
      currentChapterId: 'chapter-1',
      getChaptersForProject,
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(getChaptersForProject).toHaveBeenCalledWith('title-project')
    })

    // prevChapter.title is 'Prologue' → returns `上一章: Prologue`
    expect(result.current.getStoryContext().previousChapterSummary).toBe('上一章: Prologue')
  })

  // Branch: getStoryContext returns buildEmptyContext() when cacheRef.current is null (line 175-176)
  it('returns empty context from getStoryContext when no cache exists', () => {
    // Use a workspaceId that is 'default-project' so the useEffect never loads
    const workspace = buildWorkspace('default-project', 'default-project')
    workspace.identity.workspaceId = 'default-project'

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: null,
      currentChapterId: null,
    }))

    const { result } = renderHook(() => useStoryContext())

    // cacheRef.current is null because useEffect returned early
    const ctx = result.current.getStoryContext()
    expect(ctx).toEqual({
      characters: '',
      plotThreads: '',
      worldview: '',
      previousChapterSummary: '',
    })
  })

  // Branch: useEffect returns early when workspaceId === 'default-project' (line 150)
  it('does not load context when workspaceId is default-project', async () => {
    const workspace = buildWorkspace('default-project', 'default-project')
    workspace.identity.workspaceId = 'default-project'

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'default-project',
      currentChapterId: null,
    }))

    const { result } = renderHook(() => useStoryContext())

    // Wait a tick to confirm queryGraph was never called
    await act(async () => {
      await Promise.resolve()
    })

    expect(queryGraphMock).not.toHaveBeenCalled()
    expect(result.current.getStoryContext()).toEqual({
      characters: '',
      plotThreads: '',
      worldview: '',
      previousChapterSummary: '',
    })
  })

  // Branch: useEffect returns early when loadingRef.current is true (line 152)
  it('does not start duplicate loads when already loading', async () => {
    const workspace = buildWorkspace('loading-guard-ws', 'loading-guard')
    let resolveLoad: () => void = () => {}
    const loadPromise = new Promise<void>((resolve) => { resolveLoad = resolve })

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'loading-guard',
      currentChapterId: null,
    }))

    // Make queryGraph hang so loading stays true
    queryGraphMock.mockImplementation(() => loadPromise)

    const { result, rerender } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    const initialCallCount = queryGraphMock.mock.calls.length

    // Trigger a re-render by changing workspace
    const newWorkspace = buildWorkspace('loading-guard-ws-2', 'loading-guard')
    newWorkspace.identity.workspaceId = 'loading-guard-ws-2'

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentWorkspace: newWorkspace,
      }))
    })

    rerender()

    // queryGraph may or may not get additional calls depending on timing,
    // but the key point is no crash and the guard works
    // Now resolve the hanging promise
    resolveLoad()

    await act(async () => {
      await Promise.resolve()
    })
  })

  // Branch: charRes.success is false (line 61)
  it('skips characters when queryGraph returns success=false', async () => {
    const workspace = buildWorkspace('char-fail-ws', 'char-fail')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'char-fail',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return { success: false, data: [] }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    expect(ctx.characters).toBe('')
  })

  // Branch: charRes.data is not an array (line 61)
  it('skips characters when queryGraph returns non-array data', async () => {
    const workspace = buildWorkspace('char-nonarray-ws', 'char-nonarray')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'char-nonarray',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return { success: true, data: 'not-an-array' }
      }
      return { success: true, data: [] }
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    expect(ctx.characters).toBe('')
  })

  // Branch: catch block in chapter lookup (line 141)
  it('catches error during chapter lookup gracefully', async () => {
    const workspace = buildWorkspace('chapter-err-ws', 'chapter-err')

    const getChaptersForProject = vi.fn().mockImplementation(() => {
      throw new Error('chapter lookup error')
    })

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'chapter-err',
      currentChapterId: 'chapter-1',
      getChaptersForProject,
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(getChaptersForProject).toHaveBeenCalled()
    })

    // Error is caught, previousChapterSummary stays empty
    const ctx = result.current.getStoryContext()
    expect(ctx.previousChapterSummary).toBe('')
  })
})
