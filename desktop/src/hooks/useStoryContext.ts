import { useAppStore } from '../stores/appStore'
import { useCallback, useRef, useEffect } from 'react'
import { queryGraph } from '../api/client'
import { toGraphItems, filterWorkspaceKnowledgeItems } from '../components/knowledge/knowledgeUtils'
import type { ProjectWorkspaceContext } from '../types/workspace'
import type { Chapter } from '../types/project'

export interface StoryContext {
  characters: string
  plotThreads: string
  worldview: string
  previousChapterSummary: string
}

interface CachedStoryContext {
  workspaceId: string | null
  data: StoryContext
}

function extractItemSummary(item: Record<string, unknown>): string {
  const name = String(item.name ?? item.title ?? '')
  const desc = String(item.description ?? item.role ?? item.content ?? item.summary ?? '')
  return name ? (desc ? `${name}: ${desc}` : name) : ''
}

function extractRelevantText(rows: unknown[], key: string, workspace: ProjectWorkspaceContext): string {
  const items = toGraphItems(rows, key)
  const filtered = filterWorkspaceKnowledgeItems(items, workspace)
  if (filtered.length === 0) return ''
  return filtered.map(extractItemSummary).filter(Boolean).join('\n')
}

/**
 * Hook that provides cross-chapter story context for AI writing assistance.
 * Reads story bible data (characters, plot threads, worldview, previous chapter)
 * from the knowledge graph and caches it for synchronous access during AI requests.
 */
export function useStoryContext() {
  const cacheRef = useRef<CachedStoryContext | null>(null)
  const loadingRef = useRef(false)

  const currentWorkspace = useAppStore(s => s.currentWorkspace)
  const currentChapterId = useAppStore(s => s.currentChapterId)

  const buildEmptyContext = useCallback((): StoryContext => ({
    characters: '',
    plotThreads: '',
    worldview: '',
    previousChapterSummary: '',
  }), [])

  const loadStoryContext = useCallback(async (workspace: ProjectWorkspaceContext): Promise<StoryContext> => {
    const result: StoryContext = buildEmptyContext()

    try {
      // Characters from knowledge graph
      const charRes = await queryGraph(
        'MATCH (c:Character) RETURN c LIMIT 100',
        { workspace },
      )
      if (charRes.success && Array.isArray(charRes.data)) {
        result.characters = extractRelevantText(charRes.data, 'c', workspace)
      }
    } catch {
      // Character query may fail if graph is empty
    }

    try {
      // Plot threads from knowledge graph (Item nodes with narrative kinds)
      const plotRes = await queryGraph(
        'MATCH (n:Item) WHERE n.itemKind = "narrative-event" OR n.itemKind = "narrative-scene" RETURN n LIMIT 50',
        { workspace },
      )
      if (plotRes.success && Array.isArray(plotRes.data)) {
        const plotText = extractRelevantText(plotRes.data, 'n', workspace)
        if (plotText) {
          result.plotThreads = plotText
        }
      }
    } catch {
      // Plot thread query may fail
    }

    try {
      // Foreshadowing items as plot context
      const foreshadowRes = await queryGraph(
        'MATCH (n:Item) WHERE n.itemKind = "foreshadowing" RETURN n LIMIT 50',
        { workspace },
      )
      if (foreshadowRes.success && Array.isArray(foreshadowRes.data)) {
        const foreshadowText = extractRelevantText(foreshadowRes.data, 'n', workspace)
        if (foreshadowText) {
          result.plotThreads = result.plotThreads
            ? result.plotThreads + '\n' + foreshadowText
            : foreshadowText
        }
      }
    } catch {
      // Foreshadowing query may fail
    }

    try {
      // Worldview / worldbuilding elements from knowledge graph
      const worldRes = await queryGraph(
        'MATCH (w:Worldview) RETURN w LIMIT 50',
        { workspace },
      )
      if (worldRes.success && Array.isArray(worldRes.data)) {
        result.worldview = extractRelevantText(worldRes.data, 'w', workspace)
      }

      // Also try Location nodes as world-building context
      if (!result.worldview) {
        const locRes = await queryGraph(
          'MATCH (l:Location) RETURN l LIMIT 30',
          { workspace },
        )
        if (locRes.success && Array.isArray(locRes.data)) {
          result.worldview = extractRelevantText(locRes.data, 'l', workspace)
        }
      }
    } catch {
      // Worldview query may fail
    }

    // Previous chapter summary from project chapters
    try {
      const state = useAppStore.getState()
      const projectId = state.currentProjectId
      if (projectId && currentChapterId) {
        const chapters: Chapter[] = state.getChaptersForProject(projectId)
        const currentIdx = chapters.findIndex((c: Chapter) => c.id === currentChapterId)
        if (currentIdx > 0) {
          const prevChapter = chapters[currentIdx - 1]
          result.previousChapterSummary = prevChapter?.title
            ? `上一章: ${prevChapter.title}`
            : ''
        }
      }
    } catch {
      // Chapter lookup may fail
    }

    return result
  }, [currentChapterId, buildEmptyContext])

  // Load and cache story context when workspace changes
  useEffect(() => {
    const workspaceId = currentWorkspace.identity.workspaceId
    if (!workspaceId || workspaceId === 'default-project') return
    if (cacheRef.current && cacheRef.current.workspaceId === workspaceId) return
    if (loadingRef.current) return

    loadingRef.current = true
    loadStoryContext(currentWorkspace)
      .then(data => {
        cacheRef.current = { workspaceId, data }
      })
      .catch(() => {
        // Cache empty context on failure
        cacheRef.current = { workspaceId, data: buildEmptyContext() }
      })
      .finally(() => {
        loadingRef.current = false
      })
  }, [currentWorkspace, loadStoryContext, buildEmptyContext])

  /**
   * Synchronous getter for cached story context.
   * Returns cached data if available, otherwise empty context.
   */
  const getStoryContext = useCallback((): StoryContext => {
    if (cacheRef.current) {
      return cacheRef.current.data
    }
    return buildEmptyContext()
  }, [buildEmptyContext])

  return { getStoryContext }
}