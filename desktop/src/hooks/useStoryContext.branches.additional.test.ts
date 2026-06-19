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

describe('useStoryContext branch coverage', () => {
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

  it('caches empty context when all queries fail (covers catch blocks)', async () => {
    const workspace = buildWorkspace('fail-workspace', 'fail-project')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'fail-project',
      currentChapterId: 'chapter-1',
    }))

    queryGraphMock.mockRejectedValue(new Error('graph offline'))

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    const ctx = result.current.getStoryContext()
    expect(ctx).toEqual({
      characters: '',
      plotThreads: '',
      worldview: '',
      previousChapterSummary: '',
    })
  })

  it('skips previous chapter summary when projectId is null (line 130)', async () => {
    const workspace = buildWorkspace('no-project-ws', 'no-project')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: null,
      currentChapterId: 'chapter-2',
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    expect(result.current.getStoryContext().previousChapterSummary).toBe('')
  })

  it('skips previous chapter summary when currentChapterId is null (line 130)', async () => {
    const workspace = buildWorkspace('no-chapter-ws', 'no-chapter')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'no-chapter',
      currentChapterId: null,
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    expect(result.current.getStoryContext().previousChapterSummary).toBe('')
  })

  it('skips previous chapter when current chapter is the first (currentIdx <= 0, line 133)', async () => {
    const workspace = buildWorkspace('first-chapter-ws', 'first-chapter')
    const getChaptersForProject = vi.fn().mockReturnValue([
      {
        id: 'chapter-1',
        volumeId: 'v-1',
        title: 'The Beginning',
        order: 0,
        createdAt: '2026-06-03T00:00:00Z',
        updatedAt: '2026-06-03T00:00:00Z',
      },
    ])

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'first-chapter',
      currentChapterId: 'chapter-1',
      getChaptersForProject,
    }))

    queryGraphMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(getChaptersForProject).toHaveBeenCalledWith('first-chapter')
    })

    expect(result.current.getStoryContext().previousChapterSummary).toBe('')
  })

  it('keeps worldview from Worldview query when it succeeds (skips Location fallback, line 113)', async () => {
    const workspace = buildWorkspace('worldview-ok-ws', 'worldview-ok')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'worldview-ok',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('narrative-event') || cypher.includes('narrative-scene')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('foreshadowing')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('MATCH (w:Worldview)')) {
        return {
          success: true,
          data: [
            {
              w: {
                id: 'world-1',
                name: 'Magic System',
                description: 'Elemental forces govern the world',
                workspaceId: 'worldview-ok-ws',
              },
            },
          ],
        }
      }
      // Location query should NOT be called since worldview succeeded
      if (cypher.includes('MATCH (l:Location)')) {
        throw new Error('Location query should not be called when worldview has data')
      }
      throw new Error(`unexpected cypher: ${cypher}`)
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(result.current.getStoryContext().worldview).toContain('Magic System')
    })

    // Worldview was populated, Location fallback was NOT called
    const locationCalls = queryGraphMock.mock.calls.filter(
      (args: string[]) => args[0].includes('MATCH (l:Location)'),
    )
    expect(locationCalls.length).toBe(0)
  })

  it('skips appending foreshadowing when foreshadowText is empty (line 92-96)', async () => {
    const workspace = buildWorkspace('no-foreshadow-ws', 'no-foreshadow')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'no-foreshadow',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('narrative-event') || cypher.includes('narrative-scene')) {
        return {
          success: true,
          data: [
            {
              n: {
                id: 'plot-1',
                name: 'Battle Scene',
                description: 'The siege begins',
                workspaceId: 'no-foreshadow-ws',
              },
            },
          ],
        }
      }
      if (cypher.includes('foreshadowing')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('Worldview') || cypher.includes('Location')) {
        return { success: true, data: [] }
      }
      throw new Error(`unexpected cypher: ${cypher}`)
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(result.current.getStoryContext().plotThreads).toContain('Battle Scene')
    })

    // Foreshadowing returned empty, so plotThreads is just the plot text
    expect(result.current.getStoryContext().plotThreads).toBe('Battle Scene: The siege begins')
  })

  it('skips plot text branch when plot query returns empty (line 76 if-branch)', async () => {
    const workspace = buildWorkspace('empty-plot-ws', 'empty-plot')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'empty-plot',
      currentChapterId: null,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return { success: true, data: [] }
      }
      // Plot query succeeds but returns no data after filtering
      if (cypher.includes('narrative-event') || cypher.includes('narrative-scene')) {
        return {
          success: true,
          data: [
            {
              n: {
                id: 'plot-1',
                name: 'Ignored Plot',
                description: 'From different workspace',
                workspaceId: 'other-workspace',  // Won't match our workspace filter
              },
            },
          ],
        }
      }
      if (cypher.includes('foreshadowing')) {
        return { success: true, data: [] }
      }
      if (cypher.includes('Worldview') || cypher.includes('Location')) {
        return { success: true, data: [] }
      }
      throw new Error(`unexpected cypher: ${cypher}`)
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalled()
    })

    await act(async () => {
      await Promise.resolve()
    })

    // plotText is empty (filtered out by workspace), so if(plotText) is false
    expect(result.current.getStoryContext().plotThreads).toBe('')
  })
})
