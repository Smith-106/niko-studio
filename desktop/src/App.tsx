import { useState, useEffect } from 'react'
import { BookOpenText } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { SettingsModal } from './components/SettingsModal'
import { KnowledgeModal } from './components/KnowledgeModal'
import { EvaluationPanel } from './components/EvaluationPanel'
import { McpStatusPanel } from './components/McpStatusPanel'
import { deriveGatewayRuntimeState, GatewayRuntimeView, getGatewayHealth, listCheckpoints, restoreCheckpoint } from './api/client'
import { useAppStore } from './stores/appStore'
import { useMessages, useCurrentConversationSummary } from './stores/selectors'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './i18n'

interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

interface ContextUsage {
  usedChars: number
  usedK: number
  totalK: number
  percent: number
}

const APP_CONNECTION_DOT: Record<string, string> = {
  connected: 'bg-green-500',
  degraded: 'bg-amber-500',
  reconnecting: 'bg-teal-500',
  disconnected: 'bg-red-500',
}

function App() {
  const { backendStatus, checkBackend } = useAppStore()
  const messages = useMessages()
  const conversationSummary = useCurrentConversationSummary()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [evaluationOpen, setEvaluationOpen] = useState(false)
  const [mcpStatusOpen, setMcpStatusOpen] = useState(false)
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [contextUsage, setContextUsage] = useState<ContextUsage>({ usedChars: 0, usedK: 0, totalK: 128, percent: 0 })
  const [runtimeView, setRuntimeView] = useState<GatewayRuntimeView | null>(null)
  const { t } = useI18n()

  // 应用主题
  useTheme()

  useEffect(() => {
    // Check backend status on mount
    checkBackend()

    const fetchGatewayRuntime = async () => {
      try {
        const response = await getGatewayHealth()
        if (response.success && response.data) {
          setRuntimeView(deriveGatewayRuntimeState(response.data, backendStatus))
          return
        }
      } catch {
        // ignore runtime fetch error
      }
      setRuntimeView(deriveGatewayRuntimeState(null, backendStatus))
    }

    void fetchGatewayRuntime()

    // Health check interval - 30 seconds instead of 5 seconds
    let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      void checkBackend()
      void fetchGatewayRuntime()
    }, 30000)

    // Pause polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - clear interval
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      } else {
        // Tab is visible - check immediately and restart interval
        void checkBackend()
        void fetchGatewayRuntime()
        if (!interval) {
          interval = setInterval(() => {
            void checkBackend()
            void fetchGatewayRuntime()
          }, 30000)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [backendStatus, checkBackend])

  useEffect(() => {
    if (!restoreStatus) return

    const timer = setTimeout(() => setRestoreStatus(null), 2500)
    return () => clearTimeout(timer)
  }, [restoreStatus])

  const refreshCheckpoints = async () => {
    setCheckpointsLoading(true)
    try {
      const response = await listCheckpoints(10)
      if (response.success && Array.isArray(response.data)) {
        setCheckpoints(response.data)
      } else {
        setCheckpoints([])
        setRestoreStatus({ type: 'error', message: response.error || t.restoreFailed })
      }
    } catch {
      setCheckpoints([])
      setRestoreStatus({ type: 'error', message: t.restoreFailed })
    } finally {
      setCheckpointsLoading(false)
    }
  }

  const handleToggleCheckpointMenu = async () => {
    const nextOpen = !checkpointMenuOpen
    setCheckpointMenuOpen(nextOpen)
    if (nextOpen) {
      await refreshCheckpoints()
    }
  }

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    try {
      const response = await restoreCheckpoint(checkpointId)
      if (response.success) {
        setRestoreStatus({ type: 'success', message: t.restoreSuccess })
        setCheckpointMenuOpen(false)
      } else {
        setRestoreStatus({ type: 'error', message: response.error || t.restoreFailed })
      }
    } catch {
      setRestoreStatus({ type: 'error', message: t.restoreFailed })
    }
  }

  const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
  const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
  const headerConnectionText =
    headerConnectionState === 'connected'
      ? t.serviceRunning
      : headerConnectionState === 'degraded'
        ? t.serviceDegraded
        : headerConnectionState === 'reconnecting'
          ? t.serviceReconnecting
          : t.serviceDisconnected

  const sessionHealthText =
    conversationSummary.health.state === 'healthy'
      ? t.sidebarHealthHealthy
      : conversationSummary.health.state === 'degraded'
        ? t.sidebarHealthDegraded
        : conversationSummary.health.state === 'error'
          ? t.sidebarHealthError
          : t.sidebarHealthIdle

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark-bg">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenEvaluation={() => setEvaluationOpen(true)}
        onOpenMcpStatus={() => setMcpStatusOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 dark:border-dark-border bg-white/95 dark:bg-dark-surface backdrop-blur-sm flex items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpenText size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="text-base font-semibold text-slate-800 dark:text-dark-text truncate">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 relative shrink-0">
            <div className="flex items-center gap-2" aria-live="polite">
              <div className={`w-2 h-2 rounded-full ${headerDotClass}`} />
              <span className="hidden sm:inline text-sm text-slate-600 dark:text-dark-text-secondary">
                {headerConnectionText}
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-2 rounded-full bg-slate-100 dark:bg-dark-border px-2 py-1 text-xs text-slate-600 dark:text-dark-text-secondary" aria-live="polite">
              <span>{t.contextUsage} ~{contextUsage.usedK.toFixed(1)}k/{contextUsage.totalK}k ({contextUsage.percent.toFixed(1)}%)</span>
              {runtimeView && <span>· {t.headerReconnectAttempts}: {runtimeView.reconnectAttempts}</span>}
              <span>· {t.headerSessionHealth}: {sessionHealthText}</span>
              {typeof conversationSummary.performance.lastLatencyMs === 'number' && (
                <span>· {t.headerLatencySummary}: {conversationSummary.performance.lastLatencyMs}ms</span>
              )}
              {conversationSummary.health.decision && <span>· {t.headerLastDecision}: {conversationSummary.health.decision}</span>}
            </div>
            <button
              onClick={handleToggleCheckpointMenu}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:hover:bg-dark-border"
            >
              {t.checkpoint}
            </button>

            {checkpointMenuOpen && (
              <div className="absolute right-0 top-10 w-72 max-w-[88vw] rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-20 dark:border-dark-border dark:bg-dark-surface">
                {checkpointsLoading ? (
                  <div className="text-xs text-slate-500 dark:text-dark-text-secondary p-2">{t.loadingCheckpoints}</div>
                ) : checkpoints.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-dark-text-secondary p-2">{t.noCheckpoints}</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto ui-scroll">
                    {checkpoints.map((checkpoint) => (
                      <div key={checkpoint.id} className="p-2 border border-slate-200 dark:border-dark-border rounded-lg">
                        <div className="text-xs text-slate-700 dark:text-dark-text truncate" title={checkpoint.description || checkpoint.id}>
                          {checkpoint.description || checkpoint.id}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                        <button
                          onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                          className="mt-1 cursor-pointer rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {t.restore}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {restoreStatus && (
          <div
            className={`px-4 py-2 text-xs ${
              restoreStatus.type === 'success'
                ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {restoreStatus.message}
          </div>
        )}

        {/* Chat Area */}
        <ChatArea onContextUsageChange={setContextUsage} connectionState={headerConnectionState} />

        <div className="border-t border-slate-200 px-4 py-1 text-[11px] text-slate-500 dark:border-dark-border dark:text-dark-text-secondary">
          {t.contextEstimated}
        </div>
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KnowledgeModal isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
      {evaluationOpen && (
        <EvaluationPanel
          content={messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || ''}
          onClose={() => setEvaluationOpen(false)}
        />
      )}
      {mcpStatusOpen && <McpStatusPanel onClose={() => setMcpStatusOpen(false)} />}
    </div>
  )
}

export default App
