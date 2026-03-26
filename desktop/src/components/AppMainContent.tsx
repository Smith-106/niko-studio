import type { ComponentProps } from 'react'
import { AppHeader } from './AppHeader'
import { AppRestoreStatusBanner } from './AppRestoreStatusBanner'
import { ChatArea } from './ChatArea'
import { AppContextFooter } from './AppContextFooter'

interface AppMainContentProps {
  headerProps: ComponentProps<typeof AppHeader>
  restoreStatus: ComponentProps<typeof AppRestoreStatusBanner>['restoreStatus']
  chatAreaProps: ComponentProps<typeof ChatArea>
  contextEstimatedText: string
}

export function AppMainContent({
  headerProps,
  restoreStatus,
  chatAreaProps,
  contextEstimatedText,
}: AppMainContentProps) {
  return (
    <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-dark-bg shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] z-20">
      <AppHeader {...headerProps} />

      <AppRestoreStatusBanner restoreStatus={restoreStatus} />

      <ChatArea {...chatAreaProps} />

      <AppContextFooter contextEstimatedText={contextEstimatedText} />
    </main>
  )
}
