import React from 'react'

interface AppContextFooterProps {
  contextEstimatedText: string
}

export const AppContextFooter = React.memo(function AppContextFooter({ contextEstimatedText }: AppContextFooterProps) {
  return (
    <div className="px-4 py-1 text-[11px] text-gray-400 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border">
      {contextEstimatedText}
    </div>
  )
})
