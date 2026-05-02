import React from 'react'

interface AppContextFooterProps {
  contextEstimatedText: string
}

export const AppContextFooter = React.memo(function AppContextFooter({ contextEstimatedText }: AppContextFooterProps) {
  if (!contextEstimatedText.trim()) {
    return null
  }

  return (
    <div className="shell-text-compact px-4 py-1 text-gray-400 dark:text-dark-text-secondary border-t border-gray-200 dark:border-dark-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
      {contextEstimatedText}
    </div>
  )
})
