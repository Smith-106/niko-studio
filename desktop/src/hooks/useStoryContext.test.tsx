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

describe('useStoryContext', () => {
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

  it('returns an empty synchronous context and skips loading for the default workspace', async () => {
    const { result } = renderHook(() => useStoryContext())

    expect(result.current.getStoryContext()).toEqual({
      characters: '',
      plotThreads: '',
      worldview: '',
      previousChapterSummary: '',
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(queryGraphMock).not.toHaveBeenCalled()
  })

  it('loads scoped graph context, falls back to locations for worldview, and caches by workspace id', async () => {
    const workspace = buildWorkspace()
    const getChaptersForProject = vi.fn().mockReturnValue([
      {
        id: 'chapter-1',
        volumeId: 'v-1',
        title: 'Chapter One',
        order: 0,
        createdAt: '2026-06-03T00:00:00Z',
        updatedAt: '2026-06-03T00:00:00Z',
      },
      {
        id: 'chapter-2',
        volumeId: 'v-1',
        title: 'Chapter Two',
        order: 1,
        createdAt: '2026-06-03T00:00:00Z',
        updatedAt: '2026-06-03T00:00:00Z',
      },
    ])

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'atlas-project',
      currentChapterId: 'chapter-2',
      getChaptersForProject,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [
            {
              c: {
                id: 'char-1',
                name: 'Captain Lin',
                description: 'Bridge commander',
                workspaceId: 'atlas-workspace',
              },
            },
            {
              c: {
                id: 'char-2',
                name: 'Ignored',
                description: 'Other project',
                workspaceId: 'other-workspace',
              },
            },
          ],
        }
      }
      if (cypher.includes('narrative-event') || cypher.includes('narrative-scene')) {
        return {
          success: true,
          data: [
            {
              n: {
                id: 'plot-1',
                name: 'Bridge Ambush',
                description: 'Raid on the harbor span',
                projectId: 'atlas-project',
                itemKind: 'narrative-event',
              },
            },
          ],
        }
      }
      if (cypher.includes('foreshadowing')) {
        return {
          success: true,
          data: [
            {
              n: {
                id: 'foreshadow-1',
                name: 'Silver Ring',
                description: 'Hidden family crest',
              },
            },
          ],
        }
      }
      if (cypher.includes('MATCH (w:Worldview)')) {
        return {
          success: true,
          data: [],
        }
      }
      if (cypher.includes('MATCH (l:Location)')) {
        return {
          success: true,
          data: [
            {
              l: {
                id: 'loc-1',
                name: 'Harbor City',
                description: 'Floating trade capital',
                workspaceId: 'atlas-workspace',
              },
            },
          ],
        }
      }
      throw new Error(`unexpected cypher: ${cypher}`)
    })

    const { result, rerender } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(result.current.getStoryContext().characters).toContain('Captain Lin: Bridge commander')
    })

    expect(result.current.getStoryContext()).toEqual({
      characters: 'Captain Lin: Bridge commander',
      plotThreads: 'Bridge Ambush: Raid on the harbor span\nSilver Ring: Hidden family crest',
      worldview: 'Harbor City: Floating trade capital',
      previousChapterSummary: expect.stringContaining('Chapter One'),
    })
    expect(queryGraphMock).toHaveBeenCalledTimes(5)
    expect(getChaptersForProject).toHaveBeenCalledWith('atlas-project')

    useAppStore.setState((state) => ({
      ...state,
      currentChapterId: 'chapter-1',
    }))
    rerender()

    await act(async () => {
      await Promise.resolve()
    })

    expect(queryGraphMock).toHaveBeenCalledTimes(5)
  })

  it('falls back to foreshadowing when plot loading fails and leaves untitled previous chapters blank', async () => {
    const workspace = buildWorkspace('echo-workspace', 'echo-project')
    const getChaptersForProject = vi.fn().mockReturnValue([
      {
        id: 'chapter-1',
        volumeId: 'v-1',
        title: '',
        order: 0,
        createdAt: '2026-06-03T00:00:00Z',
        updatedAt: '2026-06-03T00:00:00Z',
      },
      {
        id: 'chapter-2',
        volumeId: 'v-1',
        title: 'Chapter Two',
        order: 1,
        createdAt: '2026-06-03T00:00:00Z',
        updatedAt: '2026-06-03T00:00:00Z',
      },
    ])

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'echo-project',
      currentChapterId: 'chapter-2',
      getChaptersForProject,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return {
          success: true,
          data: [
            {
              c: {
                id: 'char-1',
                name: 'Scout Mara',
                description: 'Tracks omens',
                workspaceId: 'echo-workspace',
              },
            },
          ],
        }
      }
      if (cypher.includes('narrative-event') || cypher.includes('narrative-scene')) {
        throw new Error('plot query unavailable')
      }
      if (cypher.includes('foreshadowing')) {
        return {
          success: true,
          data: [
            {
              n: {
                id: 'foreshadow-1',
                name: 'Broken Sundial',
                description: 'Points toward the siege',
                projectId: 'echo-project',
                itemKind: 'foreshadowing',
              },
            },
          ],
        }
      }
      if (cypher.includes('MATCH (w:Worldview)')) {
        return {
          success: true,
          data: [],
        }
      }
      if (cypher.includes('MATCH (l:Location)')) {
        return {
          success: true,
          data: [],
        }
      }
      throw new Error(`unexpected cypher: ${cypher}`)
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(result.current.getStoryContext().plotThreads).toBe('Broken Sundial: Points toward the siege')
    })

    expect(result.current.getStoryContext()).toEqual({
      characters: 'Scout Mara: Tracks omens',
      plotThreads: 'Broken Sundial: Points toward the siege',
      worldview: '',
      previousChapterSummary: '',
    })
    expect(getChaptersForProject).toHaveBeenCalledWith('echo-project')
  })

  it('tolerates graph and chapter lookup failures by keeping an empty cached context', async () => {
    const workspace = buildWorkspace('storm-workspace', 'storm-project')
    const getChaptersForProject = vi.fn(() => {
      throw new Error('chapter index unavailable')
    })

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: workspace,
      currentProjectId: 'storm-project',
      currentChapterId: 'chapter-9',
      getChaptersForProject,
    }))

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (w:Worldview)')) {
        throw new Error('worldview offline')
      }
      if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = "narrative-event"')) {
        return { success: false, data: [] }
      }
      throw new Error('graph unavailable')
    })

    const { result } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalledTimes(4)
    })

    expect(result.current.getStoryContext()).toEqual({
      characters: '',
      plotThreads: '',
      worldview: '',
      previousChapterSummary: '',
    })
    expect(getChaptersForProject).toHaveBeenCalledWith('storm-project')
  })

  it('skips starting a second load while a workspace change arrives during an active request', async () => {
    const alphaWorkspace = buildWorkspace('alpha-workspace', 'alpha-project')
    const betaWorkspace = buildWorkspace('beta-workspace', 'beta-project')

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: alphaWorkspace,
      currentProjectId: 'alpha-project',
      currentChapterId: null,
      getChaptersForProject: vi.fn().mockReturnValue([]),
    }))

    let releaseCharacters: (() => void) | null = null
    const characterQuery = new Promise<{ success: boolean; data: unknown[] }>((resolve) => {
      releaseCharacters = () => resolve({ success: true, data: [] })
    })

    queryGraphMock.mockImplementation(async (cypher: string) => {
      if (cypher.includes('MATCH (c:Character)')) {
        return characterQuery
      }
      return { success: true, data: [] }
    })

    const { rerender } = renderHook(() => useStoryContext())

    await waitFor(() => {
      expect(queryGraphMock).toHaveBeenCalledTimes(1)
    })

    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: betaWorkspace,
      currentProjectId: 'beta-project',
    }))
    rerender()

    await act(async () => {
      await Promise.resolve()
    })

    expect(queryGraphMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      releaseCharacters?.()
      await characterQuery
    })
  })
})
