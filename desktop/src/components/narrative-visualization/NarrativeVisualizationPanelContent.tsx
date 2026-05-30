import { useEffect, useState } from 'react'

import {
  getNarrativeVisualization,
  type NarrativeVisualizationBundle,
} from '../../api/narrative-visualization'
import { readChapterContent, extractText } from '../../services/projectFileService'
import { useAppStore } from '../../stores/appStore'
import { CharacterGraphView } from './CharacterGraphView'
import { TimelineView } from './TimelineView'
import { TensionCurveView } from './TensionCurveView'
import { useVisualizationData } from './useVisualizationData'
import { VisualizationToolbar } from './VisualizationToolbar'
import { useVisualizationState } from './useVisualizationState'

interface NarrativeVisualizationPanelProps {
  onClose?: () => void
  data?: NarrativeVisualizationBundle | null
  skipAutoLoad?: boolean
}

function VisualizationShell({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section
      className="rounded-2xl border border-dark-border bg-dark-card/80 p-4"
      aria-label={title}
    >
      <h3 className="text-sm font-semibold text-dark-text-primary">{title}</h3>
      <p className="mt-2 text-sm text-dark-text-muted">{description}</p>
    </section>
  )
}

export function NarrativeVisualizationPanel({
  onClose,
  data,
  skipAutoLoad = false,
}: NarrativeVisualizationPanelProps) {
  const currentProjectId = useAppStore((state) => state.currentProjectId)
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const getChaptersForProject = useAppStore((state) => state.getChaptersForProject)
  const {
    activeView,
    setActiveView,
    selectedChapterId,
    setSelectedChapterId,
    availableViews,
  } = useVisualizationState()
  const [remoteData, setRemoteData] = useState<NarrativeVisualizationBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visualizationData = useVisualizationData(data ?? remoteData)

  useEffect(() => {
    if (data) {
      setRemoteData(data)
      return
    }
    if (skipAutoLoad) {
      setRemoteData(null)
      setError(null)
      setLoading(false)
      return
    }
    if (!currentProjectId) {
      setRemoteData(null)
      setError(null)
      return
    }

    const chapters = getChaptersForProject(currentProjectId)
    if (chapters.length === 0) {
      setRemoteData(null)
      setError(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const chapterPayload = await Promise.all(
          chapters.map(async (chapter, index) => {
            const raw = await readChapterContent(currentProjectId, chapter.id)
            return {
              content: extractText(raw),
              chapterIndex: index,
              chapterNumber: index + 1,
              title: chapter.title,
            }
          }),
        )

        const response = await getNarrativeVisualization({
          chapters: chapterPayload,
          chapterMeta: chapterPayload.map((chapter) => ({
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
          })),
          relationshipRoot: currentWorkspace.identity.projectName || currentWorkspace.identity.workspaceId,
          workspace: currentWorkspace,
        })

        if (cancelled) return
        if (!response.success || !response.data?.success || !response.data.data) {
          setError(response.error || 'Failed to load narrative visualization.')
          setRemoteData(null)
          return
        }

        setRemoteData(response.data.data)
      } catch {
        if (!cancelled) {
          setError('Failed to load narrative visualization.')
          setRemoteData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentProjectId, currentWorkspace, data, getChaptersForProject, skipAutoLoad])

  const activeViewNode = activeView === 'timeline'
    ? (
        <TimelineView
          data={visualizationData.timeline}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
        />
      )
      : activeView === 'tension'
      ? (
          <TensionCurveView
            data={visualizationData.tension}
            selectedChapterId={selectedChapterId}
            onSelectChapter={setSelectedChapterId}
          />
        )
      : (
          <CharacterGraphView data={visualizationData.characterGraph} />
        )

  return (
    <div className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col">
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4" aria-label="Narrative Visualization Panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dark-text-primary">Narrative Visualization</h2>
          <p className="mt-1 text-sm text-dark-text-muted">
            Timeline, tension, and character relationship views will render here from the shared visualization contracts.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="rounded-full border border-dark-border px-3 py-1 text-xs text-dark-text-muted"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      <VisualizationToolbar
        activeView={activeView}
        availableViews={availableViews}
        onViewChange={setActiveView}
      />

      {loading ? (
        <VisualizationShell
          title="Loading"
          description="Loading narrative visualization data from the shared analysis contracts."
        />
      ) : null}

      {error ? (
        <VisualizationShell
          title="Visualization error"
          description={error}
        />
      ) : null}

      {activeViewNode}

      <VisualizationShell
        title="Selection state"
        description={`Active mode: ${activeView}. Selected chapter: ${selectedChapterId ?? 'none'}.`}
      />

      <button
        type="button"
        className="self-start rounded-lg border border-dark-border px-3 py-2 text-xs text-dark-text-muted"
        onClick={() => setSelectedChapterId(selectedChapterId ? null : 'chapter-1')}
      >
        {selectedChapterId ? 'Clear selected chapter' : 'Select sample chapter'}
      </button>
    </aside>
    </div>
  )
}
