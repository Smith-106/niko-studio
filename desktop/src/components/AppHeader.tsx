import { useId, useLayoutEffect, useRef, type MutableRefObject } from 'react'
import { PanelRightClose, PanelRightOpen, History, Clock } from 'lucide-react'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { useI18n } from '../i18n'
import { AiToolbar } from './AiToolbar'

interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

interface AppHeaderProps {
  appTitle: string
  contextUsageVisible: boolean
  contextUsageText: string
  contextUsageWidthPercent: number
  headerConnectionState: 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
  headerDotClass: string
  headerConnectionText: string
  onOpenDiagnostics: () => void
  checkpointLabel: string
  loadingCheckpointsLabel: string
  noCheckpointsLabel: string
  restoreLabel: string
  checkpointMenuOpen: boolean
  checkpointsLoading: boolean
  checkpoints: CheckpointItem[]
  checkpointMenuContainerRef: MutableRefObject<HTMLDivElement | null>
  checkpointMenuTriggerRef: MutableRefObject<HTMLButtonElement | null>
  onToggleCheckpointMenu: () => void | Promise<void>
  onCloseCheckpointMenu: () => void
  onRestoreCheckpoint: (checkpointId: string) => void | Promise<void>
  chatSidebarCollapsed: boolean
  onToggleChatSidebar: () => void
  aiToolbarDisabled?: boolean
  onAiWrite: () => void
  onAiRewrite: () => void
  onAiDescribe: () => void
  onAiBrainstorm: () => void
  onOpenWritingHelper: () => void
  onOpenTextOptimizer: () => void
}

function ContextRing({ percent, colorClass }: { percent: number; colorClass: string }) {
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference
  const isWarning = percent > 70
  const isCritical = percent > 90

  return (
    <div className="relative w-7 h-7 flex items-center justify-center" title={`${percent.toFixed(0)}%`}>
      <svg className="w-7 h-7 -rotate-90" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-200 dark:text-dark-border" />
        <circle
          cx="12" cy="12" r={radius} fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : colorClass}`}
        />
      </svg>
      <span className={`absolute text-[8px] font-bold ${isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-dark-text-secondary'}`}>
        {percent >= 10 ? Math.round(percent) : '<10'}
      </span>
    </div>
  )
}

export function AppHeader({
  appTitle,
  contextUsageVisible,
  contextUsageText,
  contextUsageWidthPercent,
  headerConnectionState,
  headerDotClass,
  headerConnectionText,
  onOpenDiagnostics,
  checkpointLabel,
  loadingCheckpointsLabel,
  noCheckpointsLabel,
  restoreLabel,
  checkpointMenuOpen,
  checkpointsLoading,
  checkpoints,
  checkpointMenuContainerRef,
  checkpointMenuTriggerRef,
  onToggleCheckpointMenu,
  onCloseCheckpointMenu,
  onRestoreCheckpoint,
  chatSidebarCollapsed,
  onToggleChatSidebar,
  aiToolbarDisabled,
  onAiWrite,
  onAiRewrite,
  onAiDescribe,
  onAiBrainstorm,
  onOpenWritingHelper,
  onOpenTextOptimizer,
}: AppHeaderProps) {
  const { t } = useI18n()
  const checkpointMenuId = useId()
  const checkpointPanelRef = useRef<HTMLDivElement | null>(null)
  const firstRestoreButtonRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (!checkpointMenuOpen || checkpointsLoading) {
      return
    }

    const panel = checkpointPanelRef.current
    const restoreButton = firstRestoreButtonRef.current
    const activeElement = document.activeElement

    if (!panel || !restoreButton) {
      return
    }

    if (activeElement instanceof HTMLElement && panel.contains(activeElement) && activeElement !== panel) {
      return
    }

    restoreButton.focus()
  }, [checkpointMenuOpen, checkpointsLoading, checkpoints.length])

  useDialogFocusTrap({
    containerRef: checkpointPanelRef,
    initialFocusRef: firstRestoreButtonRef,
    restoreFocusRef: checkpointMenuTriggerRef,
    isActive: checkpointMenuOpen,
    onClose: onCloseCheckpointMenu,
  })

  return (
    <header className="h-14 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shrink-0 z-10 relative">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-gray-800 dark:text-dark-text tracking-wide">{appTitle}</span>
        <AiToolbar
          disabled={aiToolbarDisabled}
          onWrite={onAiWrite}
          onRewrite={onAiRewrite}
          onDescribe={onAiDescribe}
          onBrainstorm={onAiBrainstorm}
          onOpenWritingHelper={onOpenWritingHelper}
          onOpenTextOptimizer={onOpenTextOptimizer}
        />
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          onClick={onToggleChatSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-dark-text-secondary transition-colors hover:bg-gray-100 dark:hover:bg-dark-surface hover:text-gray-700 dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          title={chatSidebarCollapsed ? t.chatSidebarToggleExpand : t.chatSidebarToggleCollapse}
          aria-label={chatSidebarCollapsed ? t.chatSidebarToggleExpand : t.chatSidebarToggleCollapse}
        >
          {chatSidebarCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
        </button>
        {(contextUsageVisible || headerConnectionState !== 'connected') && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-dark-surface/50 border border-gray-200/60 dark:border-dark-border/60 shadow-[var(--shadow-tiny)]">
            <div
              className={`w-2 h-2 rounded-full shadow-sm transition-colors duration-300 ${headerDotClass} ${headerConnectionState !== 'connected' ? 'animate-pulse' : ''}`}
              title={headerConnectionText}
            />
            {headerConnectionState !== 'connected' && (
              <span className={`shell-text-compact font-medium transition-colors duration-300 ${
                headerConnectionState === 'disconnected' ? 'text-danger-600 dark:text-danger-400' :
                'text-amber-600 dark:text-amber-400'
              }`}>{headerConnectionText}</span>
            )}
            {headerConnectionState !== 'connected' && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="shell-text-compact rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 transition-all hover:bg-amber-100 active:scale-95 dark:border-amber-700/50 dark:bg-amber-900/10 dark:text-amber-200 dark:hover:bg-amber-900/20"
                aria-label={t.settingsCheckConnection}
                title={t.settingsCheckConnection}
              >
                {t.settingsCheckConnection}
              </button>
            )}
            {contextUsageVisible && (
              <div className="flex items-center gap-1.5">
                <ContextRing percent={contextUsageWidthPercent} colorClass="text-primary-500 dark:text-primary-400" />
                <span className="shell-text-compact font-medium text-gray-500 dark:text-dark-text-secondary hidden sm:inline">
                  {contextUsageText}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="relative" ref={checkpointMenuContainerRef}>
          <button
            ref={checkpointMenuTriggerRef}
            type="button"
            onClick={onToggleCheckpointMenu}
            className="flex items-center gap-1.5 shell-text-compact px-2.5 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border2 text-gray-700 dark:text-dark-text rounded-lg shadow-[var(--shadow-tiny)] hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all active:scale-[0.98]"
            aria-expanded={checkpointMenuOpen}
            aria-controls={checkpointMenuId}
            aria-haspopup="dialog"
          >
            <History size={14} />
            {checkpointLabel}
          </button>

          {checkpointMenuOpen && (
            <div
              id={checkpointMenuId}
              ref={checkpointPanelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="false"
              aria-label={checkpointLabel}
              className="absolute right-0 top-10 w-80 p-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-[var(--shadow-card)] z-20"
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 border-b border-gray-100 dark:border-dark-border/50">
                <Clock size={12} className="text-gray-400 dark:text-dark-text-muted" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-text-muted">{checkpointLabel}</span>
              </div>
              {checkpointsLoading ? (
                <div className="shell-text-compact text-gray-500 dark:text-dark-text-secondary p-2 animate-pulse">{loadingCheckpointsLabel}</div>
              ) : checkpoints.length === 0 ? (
                <div className="shell-text-compact text-gray-500 dark:text-dark-text-secondary p-2">{noCheckpointsLabel}</div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar py-1">
                  {checkpoints.map((checkpoint, index) => (
                    <button
                      key={checkpoint.id}
                      ref={index === 0 ? firstRestoreButtonRef : undefined}
                      type="button"
                      onClick={() => onRestoreCheckpoint(checkpoint.id)}
                      className="w-full text-left p-2.5 rounded-lg border border-gray-100 dark:border-dark-border/50 hover:border-primary-200 dark:hover:border-primary-700/40 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group"
                    >
                      <div className="shell-text-compact text-gray-700 dark:text-dark-text truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 font-medium" title={checkpoint.description || checkpoint.id}>
                        {checkpoint.description || checkpoint.id}
                      </div>
                      <div className="shell-text-compact text-gray-400 dark:text-dark-text-muted mt-0.5">{checkpoint.created_at}</div>
                      <span className="shell-text-compact mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                        {restoreLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}