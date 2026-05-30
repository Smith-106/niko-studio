import React from 'react'
import { FileText, Zap, AlertTriangle } from 'lucide-react'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useSettingsStore } from '../stores/settingsStore'

interface AppContextFooterProps {
  contextEstimatedText: string
  wordCount?: number
  readingTime?: number
  contextPercent?: number
}

export const AppContextFooter = React.memo(function AppContextFooter({
  contextEstimatedText,
  wordCount,
  readingTime,
  contextPercent,
}: AppContextFooterProps) {
  const hasText = contextEstimatedText.trim().length > 0
  const showMetrics = wordCount !== undefined && wordCount > 0
  const workspaceSummary = useWriterWorkspaceSummary()
  const workflowLevel = useSettingsStore((s) => s.settings.defaultWorkflowLevel)
  const isDefaultProject = workspaceSummary.projectLabel === 'default-project'
  const locationLabel = workspaceSummary.chapterLabel ?? (isDefaultProject ? null : workspaceSummary.projectLabel)

  const contextWarning = typeof contextPercent === 'number' && contextPercent > 70
  const contextCritical = typeof contextPercent === 'number' && contextPercent > 90

  if (!hasText && !showMetrics && !locationLabel) {
    return null
  }

  return (
    <div className={`shell-text-compact px-4 py-1.5 border-t flex items-center justify-between gap-4 transition-colors duration-300 ${
      contextCritical ? 'border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400' :
      contextWarning ? 'border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400' :
      'border-gray-200 dark:border-dark-border text-gray-400 dark:text-dark-text-secondary'
    }`}>
      <div className="flex items-center gap-3">
        {locationLabel && (
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-dark-text-muted">
            <FileText size={12} />
            <span className="truncate max-w-[180px]">{locationLabel}</span>
          </span>
        )}
        <span className={`flex items-center gap-1 ${
          contextCritical ? 'text-red-500 dark:text-red-400' :
          contextWarning ? 'text-amber-500 dark:text-amber-400' :
          'text-primary-500/70 dark:text-primary-400/70'
        }`}>
          {(contextWarning || contextCritical) ? <AlertTriangle size={11} /> : <Zap size={11} />}
          <span>L{workflowLevel.replace('L', '')}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        {hasText && <span>{contextEstimatedText}</span>}
        {showMetrics && (
          <span className="flex items-center gap-3">
            <span>{wordCount} 字</span>
            {readingTime !== undefined && readingTime > 0 && (
              <span>约 {Math.ceil(readingTime)} 分钟阅读</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
})
