import type { MutableRefObject } from 'react'

interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

interface AppHeaderProps {
  appTitle: string
  contextUsageLabel: string
  contextUsageText: string
  contextUsageBarClass: string
  contextUsageWidthPercent: number
  headerDotClass: string
  headerConnectionText: string
  checkpointLabel: string
  loadingCheckpointsLabel: string
  noCheckpointsLabel: string
  restoreLabel: string
  checkpointMenuOpen: boolean
  checkpointsLoading: boolean
  checkpoints: CheckpointItem[]
  checkpointMenuContainerRef: MutableRefObject<HTMLDivElement | null>
  onToggleCheckpointMenu: () => void | Promise<void>
  onRestoreCheckpoint: (checkpointId: string) => void | Promise<void>
}

export function AppHeader({
  appTitle,
  contextUsageLabel,
  contextUsageText,
  contextUsageBarClass,
  contextUsageWidthPercent,
  headerDotClass,
  headerConnectionText,
  checkpointLabel,
  loadingCheckpointsLabel,
  noCheckpointsLabel,
  restoreLabel,
  checkpointMenuOpen,
  checkpointsLoading,
  checkpoints,
  checkpointMenuContainerRef,
  onToggleCheckpointMenu,
  onRestoreCheckpoint,
}: AppHeaderProps) {
  return (
    <header className="h-14 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 relative">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-gray-800 dark:text-dark-text tracking-wide">{appTitle}</span>
      </div>
      <div className="flex items-center gap-4 relative" ref={checkpointMenuContainerRef}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-surface2 shadow-inner border border-gray-200 dark:border-dark-border2">
          <div className={`w-2 h-2 rounded-full shadow-sm ${headerDotClass}`} />
          <span className="text-[11px] font-medium text-gray-600 dark:text-dark-text">{headerConnectionText}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary">
            {contextUsageLabel} <span className="text-gray-700 dark:text-dark-text">{contextUsageText}</span>
          </span>
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-dark-border2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${contextUsageBarClass}`}
              style={{ width: `${contextUsageWidthPercent}%` }}
            />
          </div>
        </div>
        <button
          onClick={onToggleCheckpointMenu}
          className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border2 text-gray-700 dark:text-dark-text rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all active:scale-[0.98]"
        >
          {checkpointLabel}
        </button>

        {checkpointMenuOpen && (
          <div className="absolute right-0 top-10 w-72 p-2 rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg z-20">
            {checkpointsLoading ? (
              <div className="text-xs text-gray-500 dark:text-dark-text-secondary p-2">{loadingCheckpointsLabel}</div>
            ) : checkpoints.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-dark-text-secondary p-2">{noCheckpointsLabel}</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {checkpoints.map((checkpoint) => (
                  <div key={checkpoint.id} className="p-2 border border-gray-200 dark:border-dark-border rounded">
                    <div className="text-xs text-gray-700 dark:text-dark-text truncate" title={checkpoint.description || checkpoint.id}>
                      {checkpoint.description || checkpoint.id}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                    <button
                      onClick={() => onRestoreCheckpoint(checkpoint.id)}
                      className="mt-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                    >
                      {restoreLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
