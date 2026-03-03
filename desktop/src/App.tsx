import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { SettingsModal } from './components/SettingsModal'
import { KnowledgeModal } from './components/KnowledgeModal'
import { EvaluationPanel } from './components/EvaluationPanel'
import { McpStatusPanel } from './components/McpStatusPanel'
import { WritingHelperPanel } from './components/WritingHelperPanel'
import { type WritingHelperMode } from './api/client'
import { deriveGatewayRuntimeState, GatewayRuntimeView, getGatewayHealth, listCheckpoints, restoreCheckpoint } from './api/client'
import { useAppStore } from './stores/appStore'
import { useMessages } from './stores/selectors'
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

interface WritingHelperDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}

const WRITING_HELPER_DRAFT_STORAGE_KEY = 'niko.writing-helper-draft-v1'

const DEFAULT_WRITING_HELPER_DRAFT: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
}

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : fallback
}

const toWritingHelperMode = (value: unknown, fallback: WritingHelperMode): WritingHelperMode => {
  if (value === 'polish' || value === 'summarize' || value === 'outline' || value === 'rewrite' || value === 'expand') {
    return value
  }
  return fallback
}

const loadWritingHelperDraft = (): WritingHelperDraftState => {
  try {
    const raw = localStorage.getItem(WRITING_HELPER_DRAFT_STORAGE_KEY)
    if (!raw) return DEFAULT_WRITING_HELPER_DRAFT

    const parsed = JSON.parse(raw) as Partial<WritingHelperDraftState>
    return {
      content: typeof parsed.content === 'string' ? parsed.content : DEFAULT_WRITING_HELPER_DRAFT.content,
      mode: toWritingHelperMode(parsed.mode, DEFAULT_WRITING_HELPER_DRAFT.mode),
      maxSentences: toPositiveInteger(parsed.maxSentences, DEFAULT_WRITING_HELPER_DRAFT.maxSentences),
      maxItems: toPositiveInteger(parsed.maxItems, DEFAULT_WRITING_HELPER_DRAFT.maxItems),
    }
  } catch {
    return DEFAULT_WRITING_HELPER_DRAFT
  }
}

const clearWritingHelperDraftStorage = (): void => {
  try {
    localStorage.removeItem(WRITING_HELPER_DRAFT_STORAGE_KEY)
  } catch {
    // ignore localStorage clear failures
  }
}

const APP_CONNECTION_LABEL: Record<string, string> = {
  connected: '服务运行中',
  degraded: '服务降级',
  reconnecting: '连接恢复中',
  disconnected: '服务未启动',
}

const APP_CONNECTION_DOT: Record<string, string> = {
  connected: 'bg-green-500',
  degraded: 'bg-amber-500',
  reconnecting: 'bg-blue-500',
  disconnected: 'bg-red-500',
}

function App() {
  const { backendStatus, checkBackend } = useAppStore()
  const messages = useMessages()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [evaluationOpen, setEvaluationOpen] = useState(false)
  const [mcpStatusOpen, setMcpStatusOpen] = useState(false)
  const [writingHelperOpen, setWritingHelperOpen] = useState(false)
  const [writingHelperDraft, setWritingHelperDraft] = useState<WritingHelperDraftState>(() => loadWritingHelperDraft())
  const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)
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

  useEffect(() => {
    try {
      localStorage.setItem(WRITING_HELPER_DRAFT_STORAGE_KEY, JSON.stringify(writingHelperDraft))
    } catch {
      // ignore localStorage write failures
    }
  }, [writingHelperDraft])

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

  const handleClearWritingHelperDraft = () => {
    clearWritingHelperDraftStorage()
    setWritingHelperDraft(DEFAULT_WRITING_HELPER_DRAFT)
  }

  const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
  const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
  const headerConnectionText = APP_CONNECTION_LABEL[headerConnectionState] ?? (backendStatus ? t.serviceRunning : t.serviceOffline)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenEvaluation={() => setEvaluationOpen(true)}
        onOpenMcpStatus={() => setMcpStatusOpen(true)}
        onOpenWritingHelper={() => setWritingHelperOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-800 dark:text-dark-text">📖 {t.appTitle}</span>
          </div>
          <div className="flex items-center gap-3 relative">
            <div className={`w-2 h-2 rounded-full ${headerDotClass}`} />
            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
              {headerConnectionText}
            </span>
            <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
              {t.contextUsage} ~{contextUsage.usedK.toFixed(1)}k/{contextUsage.totalK}k ({contextUsage.percent.toFixed(1)}%)
            </span>
            <button
              onClick={handleToggleCheckpointMenu}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t.checkpoint}
            </button>

            {checkpointMenuOpen && (
              <div className="absolute right-0 top-10 w-72 p-2 rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg z-20">
                {checkpointsLoading ? (
                  <div className="text-xs text-gray-500 dark:text-dark-text-secondary p-2">{t.loadingCheckpoints}</div>
                ) : checkpoints.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-dark-text-secondary p-2">{t.noCheckpoints}</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {checkpoints.map((checkpoint) => (
                      <div key={checkpoint.id} className="p-2 border border-gray-200 dark:border-dark-border rounded">
                        <div className="text-xs text-gray-700 dark:text-dark-text truncate" title={checkpoint.description || checkpoint.id}>
                          {checkpoint.description || checkpoint.id}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                        <button
                          onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                          className="mt-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
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

        <div className="px-4 py-1 text-[11px] text-gray-400 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border">
          {t.contextEstimated}
        </div>
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          if (resumeWritingHelperAfterSettings) {
            setWritingHelperOpen(true)
            setResumeWritingHelperAfterSettings(false)
          }
        }}
      />
      <KnowledgeModal isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
      {evaluationOpen && (
        <EvaluationPanel
          content={messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || ''}
          onClose={() => setEvaluationOpen(false)}
        />
      )}
      {mcpStatusOpen && <McpStatusPanel onClose={() => setMcpStatusOpen(false)} />}
      {writingHelperOpen && (
        <WritingHelperPanel
          onClose={() => setWritingHelperOpen(false)}
          onOpenSettings={() => {
            setResumeWritingHelperAfterSettings(true)
            setWritingHelperOpen(false)
            setSettingsOpen(true)
          }}
          draftState={writingHelperDraft}
          onDraftStateChange={setWritingHelperDraft}
          onClearDraft={handleClearWritingHelperDraft}
        />
      )}
    </div>
  )
}

export default App
