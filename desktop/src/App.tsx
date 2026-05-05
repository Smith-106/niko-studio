import type { MouseEvent } from 'react'

import { Sidebar } from './components/Sidebar'
import { ProjectSidebar } from './components/ProjectSidebar'
import { AppRightPanels } from './components/AppRightPanels'
import { AppMainContent } from './components/AppMainContent'
import { ChatSidebar } from './components/ChatSidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/ToastContainer'
import { useAppViewModel } from './hooks/useAppViewModel'
import { useAppStartup } from './hooks/useAppStartup'
import { useToast } from './hooks/useToast'
import { useI18n } from './i18n'
import { useSettingsStore } from './stores/settingsStore'

function App() {
  const { sidebarProps, appRightPanelsProps, appMainContentProps, chatSidebarProps } = useAppViewModel()
  const { toasts, addToast, removeToast } = useToast()
  const { t } = useI18n()
  const fontSize = useSettingsStore((state) => state.settings.fontSize)

  useAppStartup((msg) => addToast('info', msg, 8000))

  const handleSkipToMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const mainContent = document.getElementById('app-main-content')
    if (!(mainContent instanceof HTMLElement)) {
      return
    }

    window.history.replaceState(null, '', '#app-main-content')
    mainContent.focus()
  }

  return (
    <ErrorBoundary>
      <a
        href="#app-main-content"
        className="skip-link"
        onClick={handleSkipToMainContent}
      >
        {t.skipToMainContent}
      </a>
      <div
        className="flex h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans antialiased overflow-hidden"
        data-font-size={fontSize}
      >
        <Sidebar {...sidebarProps} />

        <ProjectSidebar />

        <AppMainContent {...appMainContentProps} />

        <ChatSidebar {...chatSidebarProps} />

        <AppRightPanels {...appRightPanelsProps} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ErrorBoundary>
  )
}

export default App
