import { Sidebar } from './components/Sidebar'
import { AppRightPanels } from './components/AppRightPanels'
import { AppMainContent } from './components/AppMainContent'
import { useAppViewModel } from './hooks/useAppViewModel'
import { useAppStartup } from './hooks/useAppStartup'

function App() {
  const { sidebarProps, appRightPanelsProps, appMainContentProps } = useAppViewModel()

  useAppStartup()

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans antialiased overflow-hidden">
      <Sidebar {...sidebarProps} />

      <AppMainContent {...appMainContentProps} />

      <AppRightPanels {...appRightPanelsProps} />
    </div>
  )
}

export default App

