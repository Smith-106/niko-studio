import { useState, useEffect, useCallback } from 'react'
import { History, X, RotateCcw, GitCompare } from 'lucide-react'
import { useHistoryPanelState } from '../stores/selectors'
import { listSnapshots, diffSnapshots, restoreSnapshot } from '../services/versionService'
import type { Snapshot, DiffResult } from '../types/project'

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function DiffLine({ line }: { line: DiffResult }) {
  const bg =
    line.type === 'added'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      : line.type === 'removed'
        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
        : ''
  return (
    <div className={`flex font-mono text-xs leading-5 ${bg}`}>
      <span className="w-10 shrink-0 text-right pr-2 text-gray-400 select-none">{line.lineNumber}</span>
      <span className="whitespace-pre-wrap break-all">{line.content}</span>
    </div>
  )
}

function DiffViewer({ projectId, chapterId, from, to, onClose }: {
  projectId: string
  chapterId: string
  from: Snapshot
  to: Snapshot
  onClose: () => void
}) {
  const [diff, setDiff] = useState<DiffResult[] | null>(null)

  useEffect(() => {
    diffSnapshots(projectId, chapterId, from.id, to.id).then(setDiff)
  }, [projectId, chapterId, from.id, to.id])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-dark-border">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="text-red-500">-{formatTime(from.timestamp)}</span>
          <span className="mx-2">→</span>
          <span className="text-green-500">+{formatTime(to.timestamp)}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {diff === null ? (
          <div className="text-xs text-gray-400 p-2">Loading diff...</div>
        ) : diff.length === 0 ? (
          <div className="text-xs text-gray-400 p-2">No differences</div>
        ) : (
          diff.map((line, i) => <DiffLine key={i} line={line} />)
        )}
      </div>
    </div>
  )
}

function RestoreConfirmDialog({ snapshot, onConfirm, onCancel }: {
  snapshot: Snapshot
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Restore Snapshot</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Restore to snapshot from {formatTime(snapshot.timestamp)}{snapshot.label ? ` (${snapshot.label})` : ''}?
          Current content will be replaced.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-primary-500 text-white hover:bg-primary-600"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}

export function HistoryPanel() {
  const {
    currentProjectId,
    currentChapterId,
    historyPanelOpen,
    toggleHistoryPanel,
    sessionIntelligenceEnabled,
    sessionIntelligenceSummary,
    sessionIntelligenceInsights,
    sessionIntelligenceSessionId,
    setSessionIntelligenceEnabled,
    personalizedCraftEnabled,
    personalizedCraftSummary,
    personalizedCraftTrajectory,
    personalizedCraftRecommendations,
    setPersonalizedCraftEnabled,
  } = useHistoryPanelState()

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [diffView, setDiffView] = useState<{ from: Snapshot; to: Snapshot } | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null)

  const loadSnapshots = useCallback(() => {
    if (!currentProjectId || !currentChapterId) {
      setSnapshots([])
      return
    }
    listSnapshots(currentProjectId, currentChapterId).then((index) => {
      setSnapshots(index.snapshots)
    })
  }, [currentProjectId, currentChapterId])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleSnapshotClick = useCallback((snap: Snapshot) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(snap.id)) {
        next.delete(snap.id)
      } else if (next.size < 2) {
        next.add(snap.id)
      } else {
        const arr = Array.from(next)
        next.clear()
        next.add(arr[1])
        next.add(snap.id)
      }
      return next
    })
    setDiffView(null)
  }, [])

  const handleCompare = useCallback(() => {
    const arr = Array.from(selected)
    if (arr.length !== 2) return
    const from = snapshots.find((s) => s.id === arr[0])
    const to = snapshots.find((s) => s.id === arr[1])
    if (from && to) setDiffView({ from, to })
  }, [selected, snapshots])

  const handleRestore = useCallback(async () => {
    if (!restoreTarget || !currentProjectId || !currentChapterId) return
    await restoreSnapshot(currentProjectId, currentChapterId, restoreTarget.id)
    setRestoreTarget(null)
    window.location.reload()
  }, [restoreTarget, currentProjectId, currentChapterId])

  if (!historyPanelOpen) return null

  const selectedArr = Array.from(selected)

  return (
    <div className="w-80 shrink-0 border-l border-gray-200 dark:border-dark-border bg-white dark:bg-[#1a1a1a] flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <History size={14} />
          Version History
        </div>
        <button onClick={toggleHistoryPanel} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <X size={14} />
        </button>
      </div>

      {diffView && currentProjectId && currentChapterId ? (
        <DiffViewer
          projectId={currentProjectId}
          chapterId={currentChapterId}
          from={diffView.from}
          to={diffView.to}
          onClose={() => setDiffView(null)}
        />
      ) : (
        <>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border">
            <label className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
              <span>Session Intelligence</span>
              <input
                type="checkbox"
                checked={sessionIntelligenceEnabled}
                onChange={(event) => setSessionIntelligenceEnabled(event.target.checked)}
              />
            </label>
            {sessionIntelligenceEnabled && sessionIntelligenceSummary && (
              <div className="mt-2 rounded border border-primary-200 bg-primary-50/70 px-2 py-2 text-[11px] text-primary-800 dark:border-primary-500/20 dark:bg-primary-900/10 dark:text-primary-200">
                <div className="font-medium">
                  {sessionIntelligenceSummary}
                </div>
                {sessionIntelligenceSessionId && (
                  <div className="mt-1 text-[10px] opacity-80">
                    Session: {sessionIntelligenceSessionId}
                  </div>
                )}
                {sessionIntelligenceInsights.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {sessionIntelligenceInsights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border">
            <label className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
              <span>Personalized Craft</span>
              <input
                type="checkbox"
                checked={personalizedCraftEnabled}
                onChange={(event) => setPersonalizedCraftEnabled(event.target.checked)}
              />
            </label>
            {personalizedCraftEnabled && personalizedCraftSummary && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50/70 px-2 py-2 text-[11px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="font-medium">
                  {personalizedCraftSummary}
                </div>
                {personalizedCraftTrajectory && (
                  <div className="mt-1 text-[10px] opacity-80">
                    Trajectory: {personalizedCraftTrajectory}
                  </div>
                )}
                {personalizedCraftRecommendations.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {personalizedCraftRecommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {selectedArr.length === 2 && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border">
              <button
                onClick={handleCompare}
                className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600"
              >
                <GitCompare size={12} />
                Compare selected
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {snapshots.length === 0 ? (
              <div className="text-xs text-gray-400 dark:text-gray-500 p-4 text-center">
                No snapshots yet. Auto-saves are created every 5 minutes while editing.
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  onClick={() => handleSnapshotClick(snap)}
                  className={`px-3 py-2 border-b border-gray-50 dark:border-dark-border/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    selected.has(snap.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {formatTime(snap.timestamp)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRestoreTarget(snap)
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                      title="Restore this snapshot"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  {snap.label && (
                    <div className="text-xs text-primary-500 mt-0.5">{snap.label}</div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {(snap.fileSize / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {restoreTarget && (
        <RestoreConfirmDialog
          snapshot={restoreTarget}
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </div>
  )
}
