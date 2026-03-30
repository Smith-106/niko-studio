import { Sidebar } from './components/Sidebar'
import { AppRightPanels } from './components/AppRightPanels'
import { AppMainContent } from './components/AppMainContent'
import { ChatSidebar } from './components/ChatSidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/ToastContainer'
import { useAppViewModel } from './hooks/useAppViewModel'
import { useAppStartup } from './hooks/useAppStartup'
import { useToast } from './hooks/useToast'

function App() {
  const { sidebarProps, appRightPanelsProps, appMainContentProps, chatSidebarProps } = useAppViewModel()
  const { toasts, removeToast } = useToast()

  useAppStartup()

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans antialiased overflow-hidden">
        <Sidebar {...sidebarProps} />

        <AppMainContent {...appMainContentProps} />

        <ChatSidebar {...chatSidebarProps} />

        <AppRightPanels {...appRightPanelsProps} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ErrorBoundary>
  )
}

export default App
