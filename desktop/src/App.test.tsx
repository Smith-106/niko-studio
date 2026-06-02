import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const appTestMocks = vi.hoisted(() => ({
  useAppStartupMock: vi.fn(),
  useOnboardingMock: vi.fn(),
}))

const appViewModel = {
  sidebarProps: {},
  appRightPanelsProps: {},
  appMainContentProps: {
    headerProps: {},
    restoreStatus: null,
    contextEstimatedText: '',
    onOpenWritingHelper: vi.fn(),
  },
  chatSidebarProps: {},
}

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}))

vi.mock('./components/AppRightPanels', () => ({
  AppRightPanels: () => <aside>Right panels</aside>,
}))

vi.mock('./components/AppMainContent', () => ({
  AppMainContent: () => (
    <main id="app-main-content" tabIndex={-1}>
      Main content
    </main>
  ),
}))

vi.mock('./components/ChatSidebar', () => ({
  ChatSidebar: () => <aside>Chat sidebar</aside>,
}))

vi.mock('./components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./components/ToastContainer', () => ({
  ToastContainer: () => null,
}))

vi.mock('./components/WelcomeWizard', () => ({
  WelcomeWizard: ({ onComplete }: { onComplete: () => void }) => (
    <div>
      <span>Welcome wizard</span>
      <button onClick={onComplete}>finish onboarding</button>
    </div>
  ),
}))

vi.mock('./hooks/useAppViewModel', () => ({
  useAppViewModel: () => appViewModel,
}))

vi.mock('./hooks/useAppStartup', () => ({
  useAppStartup: appTestMocks.useAppStartupMock,
}))

vi.mock('./hooks/useOnboarding', () => ({
  useOnboarding: appTestMocks.useOnboardingMock,
}))

vi.mock('./hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}))

vi.mock('./stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { settings: { fontSize: 'small' | 'medium' | 'large' } }) => unknown) =>
    selector({ settings: { fontSize: 'medium' } }),
}))

vi.mock('./i18n', () => ({
  useI18n: () => ({
    t: {
      skipToMainContent: 'Skip to main content',
    },
  }),
}))

import App from './App'

describe('App shell accessibility', () => {
  it('boots app startup even when onboarding wizard is shown on first run', () => {
    const markDone = vi.fn()
    appTestMocks.useOnboardingMock.mockReturnValue({
      isFirstRun: true,
      markDone,
      resetOnboarding: vi.fn(),
    })

    render(<App />)

    expect(screen.getByText('Welcome wizard')).toBeInTheDocument()
    expect(appTestMocks.useAppStartupMock).toHaveBeenCalledTimes(1)
  })

  it('renders a skip link that moves focus to the main content region', async () => {
    appTestMocks.useOnboardingMock.mockReturnValue({
      isFirstRun: false,
      markDone: vi.fn(),
      resetOnboarding: vi.fn(),
    })
    const user = userEvent.setup()

    render(<App />)

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    const mainContent = screen.getByRole('main')
    const shell = mainContent.parentElement

    await user.click(skipLink)

    expect(mainContent).toHaveFocus()
    expect(window.location.hash).toBe('#app-main-content')
    expect(shell).toHaveAttribute('data-font-size', 'medium')
  })
})
