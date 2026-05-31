import type { MouseEvent } from 'react'

import { Sidebar } from './components/Sidebar'
import { ProjectSidebar } from './components/ProjectSidebar'
import { AppRightPanels } from './components/AppRightPanels'
import { AppMainContent } from './components/AppMainContent'
import { ChatSidebar } from './components/ChatSidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/ToastContainer'
import { WelcomeWizard } from './components/WelcomeWizard'
import { useAppViewModel } from './hooks/useAppViewModel'
import { useAppStartup } from './hooks/useAppStartup'
import { useToast } from './hooks/useToast'
import { useOnboarding } from './hooks/useOnboarding'
import { useI18n } from './i18n'
import { useSettingsStore } from './stores/settingsStore'

function App() {
  const { isFirstRun, markDone } = useOnboarding()

  if (isFirstRun) {
    return (
      <WelcomeWizard onComplete={markDone} />
    )
  }

  return <AppMain />
}

function AppMain() {
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
        <ErrorBoundary fallback={<div className="w-14 h-screen bg-slate-100 dark:bg-dark-surface flex items-center justify-center text-sm text-gray-400">导航栏出错</div>}>
          <Sidebar {...sidebarProps} />
        </ErrorBoundary>

        <ErrorBoundary fallback={<div className="w-48 h-screen bg-slate-100 dark:bg-dark-surface flex items-center justify-center text-sm text-gray-400">项目面板出错</div>}>
          <ProjectSidebar />
        </ErrorBoundary>

        <ErrorBoundary fallback={<div className="flex-1 h-screen flex items-center justify-center text-sm text-gray-400">编辑器出错</div>}>
          <AppMainContent {...appMainContentProps} />
        </ErrorBoundary>

        <ErrorBoundary fallback={<div className="w-72 h-screen bg-slate-100 dark:bg-dark-surface flex items-center justify-center text-sm text-gray-400">对话面板出错</div>}>
          <ChatSidebar {...chatSidebarProps} />
        </ErrorBoundary>

        <AppRightPanels {...appRightPanelsProps} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ErrorBoundary>
  )
}

export default App
