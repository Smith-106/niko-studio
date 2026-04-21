import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatSidebar } from './ChatSidebar'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'

vi.mock('./ChatArea', () => ({
  ChatArea: (props: Record<string, unknown>) => (
    <div data-testid="chat-area">
      {Object.entries(props).map(([key, value]) => (
        <span key={key} data-prop={key}>{String(value)}</span>
      ))}
    </div>
  ),
}))

vi.mock('../hooks/useChatStreaming', () => ({
  useChatStreaming: () => ({
    streamingContent: '',
    setStreamingContent: vi.fn(),
    startStream: vi.fn(),
    cancelStream: vi.fn(),
  }),
}))

vi.mock('../hooks/useChatRecovery', () => ({
  useChatRecovery: () => ({
    recoverableCheckpointId: null,
    setRecoverableCheckpointId: vi.fn(),
    recoverStatus: null,
    setRecoverStatus: vi.fn(),
    createBeforeSendCheckpoint: vi.fn().mockResolvedValue(null),
    restoreToCheckpoint: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../hooks/useInlineActions', () => ({
  useInlineActions: () => ({
    selectedText: '',
    selectionMeta: null,
    inlineAction: null,
    setInlineAction: vi.fn(),
    resetInlineState: vi.fn(),
    handleAssistantSelection: vi.fn(),
    runDisabled: true,
  }),
}))

vi.mock('../hooks/useMemoryUpload', () => ({
  useMemoryUpload: () => ({
    uploadStatus: null,
    fileInputRef: { current: null },
    openPicker: vi.fn(),
    handleFileUpload: vi.fn(),
  }),
}))

vi.mock('../hooks/useChatRequestBuilder', () => ({
  useChatRequestBuilder: () => ({
    buildChatRequest: vi.fn().mockReturnValue({ messages: [] }),
  }),
}))

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: () => ({
    hasMeaningfulScope: false,
    scopeChips: [],
    chapterLabel: null,
    projectLabel: null,
    meaningfulWorkspace: null,
  }),
}))

vi.mock('../hooks/useScrollPosition', () => ({
  useScrollPosition: () => ({
    containerRef: { current: null },
    isNearBottom: true,
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
  }),
}))

vi.mock('../api/client', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  agentRoute: vi.fn(),
  agentWrite: vi.fn(),
  agentRevise: vi.fn(),
  agentGetContext: vi.fn(),
  promoteProjectWikiCanonApi: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(),
  uploadMemoryFile: vi.fn(),
}))

describe('ChatSidebar', () => {
  const defaultChatAreaProps = {
    onContextUsageChange: undefined,
    connectionState: 'connected' as const,
  }

  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, language: 'zh' },
    }))
    useAppStore.setState({
      conversationsById: {},
      allConversationIds: [],
      currentConversationId: null,
      selectedSkills: [],
    })
  })

  it('renders the ChatArea inside an aside element', () => {
    render(
      <ChatSidebar
        chatAreaProps={defaultChatAreaProps}
        chatSidebarCollapsed={false}
      />,
    )

    const aside = document.querySelector('aside')
    expect(aside).toBeInTheDocument()
    expect(screen.getByTestId('chat-area')).toBeInTheDocument()
  })

  it('applies collapsed width when chatSidebarCollapsed is true', () => {
    const { container } = render(
      <ChatSidebar
        chatAreaProps={defaultChatAreaProps}
        chatSidebarCollapsed={true}
      />,
    )

    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-0')
    expect(aside?.className).toContain('overflow-hidden')
  })

  it('applies expanded width when chatSidebarCollapsed is false', () => {
    const { container } = render(
      <ChatSidebar
        chatAreaProps={defaultChatAreaProps}
        chatSidebarCollapsed={false}
      />,
    )

    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-[320px]')
    expect(aside?.className).not.toContain('w-0')
  })

  it('includes border and transition classes on the aside', () => {
    const { container } = render(
      <ChatSidebar
        chatAreaProps={defaultChatAreaProps}
        chatSidebarCollapsed={false}
      />,
    )

    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('border-l')
    expect(aside?.className).toContain('transition-all')
    expect(aside?.className).toContain('duration-300')
  })

  it('forwards chatAreaProps to ChatArea', () => {
    render(
      <ChatSidebar
        chatAreaProps={{ ...defaultChatAreaProps, connectionState: 'disconnected' as const }}
        chatSidebarCollapsed={false}
      />,
    )

    const chatArea = screen.getByTestId('chat-area')
    expect(chatArea).toBeInTheDocument()
    const connectionProp = chatArea.querySelector('[data-prop="connectionState"]')
    expect(connectionProp?.textContent).toBe('disconnected')
  })

  it('has a shadow and relative positioning', () => {
    const { container } = render(
      <ChatSidebar
        chatAreaProps={defaultChatAreaProps}
        chatSidebarCollapsed={false}
      />,
    )

    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('shadow-')
    expect(aside?.className).toContain('relative')
  })
})
