import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { SettingsModal } from './components/SettingsModal'
import { KnowledgeModal } from './components/KnowledgeModal'
import { EvaluationPanel } from './components/EvaluationPanel'
import { McpStatusPanel } from './components/McpStatusPanel'
import { useAppStore } from './stores/appStore'
import { useMessages } from './stores/selectors'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './i18n'

function App() {
  const { backendStatus, checkBackend } = useAppStore()
  const messages = useMessages()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [evaluationOpen, setEvaluationOpen] = useState(false)
  const [mcpStatusOpen, setMcpStatusOpen] = useState(false)
  const { t } = useI18n()

  // 应用主题
  useTheme()

  useEffect(() => {
    // Check backend status on mount
    checkBackend()

    // Health check interval - 30 seconds instead of 5 seconds
    let interval: ReturnType<typeof setInterval> | null = setInterval(checkBackend, 30000)

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
        checkBackend()
        if (!interval) {
          interval = setInterval(checkBackend, 30000)
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
  }, [checkBackend])

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
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-800 dark:text-dark-text">📖 {t.appTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${backendStatus ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
              {backendStatus ? t.serviceRunning : t.serviceOffline}
            </span>
          </div>
        </header>

        {/* Chat Area */}
        <ChatArea />
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
