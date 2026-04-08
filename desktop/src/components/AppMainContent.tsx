import type { ComponentProps } from 'react'

import { AppHeader } from './AppHeader'
import { AppRestoreStatusBanner } from './AppRestoreStatusBanner'
import { DocumentEditor } from './DocumentEditor'
import { AppContextFooter } from './AppContextFooter'
import { useI18n } from '../i18n'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'

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
  const { language } = useI18n()
  const workspaceSummary = useWriterWorkspaceSummary()
  const isZh = language === 'zh'

  return (
    <main className="flex-1 flex flex-col relative min-w-0 bg-slate-50 dark:bg-[#0f0f0f] shadow-[-4px_0_20px_-5px_rgba(0,0,0,0.05)] z-20">
      <AppHeader {...headerProps} />

      {workspaceSummary.hasMeaningfulScope && (
        <div className="border-b border-gray-100 bg-white/80 px-4 py-2 text-[11px] text-gray-600 shadow-sm dark:border-dark-border dark:bg-dark-surface/70 dark:text-dark-text-secondary">
          <span className="font-semibold text-gray-800 dark:text-dark-text">
            {isZh ? '当前写作上下文' : 'Current writing context'}
          </span>
          <span className="ml-2">
            {workspaceSummary.scopeChips.join(' · ')}
          </span>
        </div>
      )}

      <AppRestoreStatusBanner restoreStatus={restoreStatus} />

      <DocumentEditor onOpenWritingHelper={onOpenWritingHelper} />

      <AppContextFooter contextEstimatedText={contextEstimatedText} />
    </main>
  )
}
