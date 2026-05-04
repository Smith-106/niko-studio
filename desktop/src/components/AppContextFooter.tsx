import React from 'react'

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

  if (!hasText && !showMetrics) {
    return null
  }

  return (
    <div className="shell-text-compact px-4 py-1 text-gray-400 dark:text-dark-text-secondary border-t border-gray-200 dark:border-dark-border flex items-center gap-4">
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
  )
})
