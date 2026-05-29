import React from 'react'
import { FileText, Zap } from 'lucide-react'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useSettingsStore } from '../stores/settingsStore'

interface AppContextFooterProps {
  contextEstimatedText: string
  wordCount?: number
  readingTime?: number
}

export const AppContextFooter = React.memo(function AppContextFooter({
  contextEstimatedText,
  wordCount,
  readingTime,
}: AppContextFooterProps) {
  const hasText = contextEstimatedText.trim().length > 0
  const showMetrics = wordCount !== undefined && wordCount > 0
  const workspaceSummary = useWriterWorkspaceSummary()
  const workflowLevel = useSettingsStore((s) => s.settings.defaultWorkflowLevel)
  const isDefaultProject = workspaceSummary.projectLabel === 'default-project'
  const locationLabel = workspaceSummary.chapterLabel ?? (isDefaultProject ? null : workspaceSummary.projectLabel)

  if (!hasText && !showMetrics && !locationLabel) {
    return null
  }

  return (
    <div className="shell-text-compact px-4 py-1.5 text-gray-400 dark:text-dark-text-secondary border-t border-gray-200 dark:border-dark-border flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {locationLabel && (
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-dark-text-muted">
            <FileText size={12} />
            <span className="truncate max-w-[180px]">{locationLabel}</span>
          </span>
        )}
        <span className="flex items-center gap-1 text-primary-500/70 dark:text-primary-400/70">
          <Zap size={11} />
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
