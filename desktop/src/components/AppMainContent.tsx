import type { ComponentProps } from 'react'
import { AppHeader } from './AppHeader'
import { AppRestoreStatusBanner } from './AppRestoreStatusBanner'
import { DocumentEditor } from './DocumentEditor'
import { AppContextFooter } from './AppContextFooter'

interface AppMainContentProps {
  headerProps: ComponentProps<typeof AppHeader>
  restoreStatus: ComponentProps<typeof AppRestoreStatusBanner>['restoreStatus']
  contextEstimatedText: string
  onOpenWritingHelper: () => void
}

export function AppMainContent({
  headerProps,
  restoreStatus,
  contextEstimatedText,
  onOpenWritingHelper,
}: AppMainContentProps) {
  return (
    <main className="flex-1 flex flex-col relative min-w-0 bg-slate-50 dark:bg-[#0f0f0f] shadow-[-4px_0_20px_-5px_rgba(0,0,0,0.05)] z-20">
      <AppHeader {...headerProps} />

      <AppRestoreStatusBanner restoreStatus={restoreStatus} />

      <DocumentEditor onOpenWritingHelper={onOpenWritingHelper} />

      <AppContextFooter contextEstimatedText={contextEstimatedText} />
    </main>
  )
}
