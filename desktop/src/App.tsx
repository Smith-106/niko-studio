import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
import { useSettingsStore } from './stores/settingsStore'
import { useMessages } from './stores/selectors'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './i18n'

type RightPanelType = 'none' | 'knowledge' | 'evaluation' | 'mcpStatus' | 'writingHelper'

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
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'niko.sidebar-collapsed-v1'
const ACTIVE_RIGHT_PANEL_STORAGE_KEY = 'niko.active-right-panel-v1'

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

const loadSidebarCollapsed = (): boolean => {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return false
  } catch {
    return false
  }
}

const isRightPanelType = (value: unknown): value is RightPanelType => {
  return value === 'none' || value === 'knowledge' || value === 'evaluation' || value === 'mcpStatus' || value === 'writingHelper'
}

const loadActiveRightPanel = (): RightPanelType => {
  try {
    const raw = localStorage.getItem(ACTIVE_RIGHT_PANEL_STORAGE_KEY)
    if (!raw) return 'none'
    return isRightPanelType(raw) ? raw : 'none'
  } catch {
    return 'none'
  }
}

const APP_CONNECTION_LABEL = {
  connected: 'serviceRunning',
  degraded: 'serviceDegraded',
  reconnecting: 'serviceReconnecting',
  disconnected: 'serviceOffline',
} as const

type HeaderConnectionState = keyof typeof APP_CONNECTION_LABEL

const APP_CONNECTION_DOT: Record<HeaderConnectionState, string> = {
  connected: 'bg-green-500',
  degraded: 'bg-amber-500',
  reconnecting: 'bg-blue-500',
  disconnected: 'bg-red-500',
}

function App() {
  const { backendStatus, checkBackend } = useAppStore()
  const messages = useMessages()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadSidebarCollapsed())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>(() => loadActiveRightPanel())
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const [writingHelperDraft, setWritingHelperDraft] = useState<WritingHelperDraftState>(() => loadWritingHelperDraft())
  const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [contextUsage, setContextUsage] = useState<ContextUsage>({ usedChars: 0, usedK: 0, totalK: 128, percent: 0 })
  const [runtimeView, setRuntimeView] = useState<GatewayRuntimeView | null>(null)
  const { t } = useI18n()

  const closeRightPanel = useCallback(() => {
    setActiveRightPanel('none')
  }, [])

  const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
    setIsTemplatePanelOpen(false)
    setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
  }, [])

  // 应用主题
  useTheme()

  useEffect(() => {
    if (!('__TAURI__' in window)) {
      return
    }

    const settings = useSettingsStore.getState().settings

    void invoke('set_gateway_base_override', {
      base: settings.apiBaseUrl && settings.apiBaseUrl.trim() ? settings.apiBaseUrl.trim() : null,
    })

    void invoke('start_backend')
  }, [])

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false')
    } catch {
      // ignore localStorage write failures
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_RIGHT_PANEL_STORAGE_KEY, activeRightPanel)
    } catch {
      // ignore localStorage write failures
    }
  }, [activeRightPanel])

  useEffect(() => {
    if (!checkpointMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (checkpointMenuContainerRef.current?.contains(target)) return
      setCheckpointMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCheckpointMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [checkpointMenuOpen])

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

  const handleContextUsageChange = useCallback((usage: ContextUsage) => {
    setContextUsage((prev) => {
      if (
        prev.usedChars === usage.usedChars &&
        prev.usedK === usage.usedK &&
        prev.totalK === usage.totalK &&
        prev.percent === usage.percent
      ) {
        return prev
      }
      return usage
    })
  }, [])

  const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
  const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
  const headerConnectionLabelKey = APP_CONNECTION_LABEL[headerConnectionState] ?? (backendStatus ? 'serviceRunning' : 'serviceOffline')
  const headerConnectionText = t[headerConnectionLabelKey]

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenKnowledge={() => toggleRightPanel('knowledge')}
        onOpenPrompts={() => {
          setActiveRightPanel('none')
          setIsTemplatePanelOpen(true)
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenEvaluation={() => toggleRightPanel('evaluation')}
        onOpenMcpStatus={() => toggleRightPanel('mcpStatus')}
        onOpenWritingHelper={() => toggleRightPanel('writingHelper')}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-dark-bg shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] z-20">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 relative">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-4 relative" ref={checkpointMenuContainerRef}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-surface2 shadow-inner border border-gray-200 dark:border-dark-border2">
              <div className={`w-2 h-2 rounded-full shadow-sm ${headerDotClass}`} />
              <span className="text-[11px] font-medium text-gray-600 dark:text-dark-text">
                {headerConnectionText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary">
                {t.contextUsage} <span className="text-gray-700 dark:text-dark-text">{contextUsage.usedK.toFixed(1)}k/{contextUsage.totalK}k</span>
              </span>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-dark-border2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${contextUsage.percent > 85 ? 'bg-danger-500' : contextUsage.percent > 65 ? 'bg-warning-500' : 'bg-primary-500'}`} 
                  style={{ width: `${Math.min(100, Math.max(0, contextUsage.percent))}%` }} 
                />
              </div>
            </div>
            <button
              onClick={handleToggleCheckpointMenu}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border2 text-gray-700 dark:text-dark-text rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all active:scale-[0.98]"
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
        <ChatArea
          onContextUsageChange={handleContextUsageChange}
          connectionState={headerConnectionState}
          isTemplatePanelOpen={isTemplatePanelOpen}
          onTemplatePanelOpenChange={setIsTemplatePanelOpen}
        />

        <div className="px-4 py-1 text-[11px] text-gray-400 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border">
          {t.contextEstimated}
        </div>
      </main>

      {activeRightPanel === 'knowledge' && (
        <KnowledgeModal isOpen onClose={closeRightPanel} />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          if (resumeWritingHelperAfterSettings) {
            setActiveRightPanel('writingHelper')
            setResumeWritingHelperAfterSettings(false)
          }
        }}
      />
      {activeRightPanel === 'evaluation' && (
        <EvaluationPanel
          content={messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || ''}
          onClose={closeRightPanel}
        />
      )}
      {activeRightPanel === 'mcpStatus' && <McpStatusPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'writingHelper' && (
        <WritingHelperPanel
          onClose={closeRightPanel}
          onOpenSettings={() => {
            setResumeWritingHelperAfterSettings(true)
            setActiveRightPanel('none')
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

