import React from 'react'

interface AppContextFooterProps {
  contextEstimatedText: string
}

export const AppContextFooter = React.memo(function AppContextFooter({ contextEstimatedText }: AppContextFooterProps) {
  if (!contextEstimatedText.trim()) {
    return null
  }

  return (
    <div className="shell-text-compact px-4 py-1 text-gray-400 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border">
      {contextEstimatedText}
    </div>
  )
})
