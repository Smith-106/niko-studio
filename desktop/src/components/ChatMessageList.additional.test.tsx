import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PenLine } from 'lucide-react'

import { ChatMessageList } from './ChatMessageList'

const mocks = vi.hoisted(() => ({
  useMessages: vi.fn(),
  useSelectedSkills: vi.fn(),
  useWriterWorkspaceSummary: vi.fn(),
  virtualizerOptions: [] as any[],
  virtualizerState: {
    totalSize: 0,
    items: [] as Array<{ index: number; start: number }>,
    measureElement: vi.fn(),
  },
}))

vi.mock('../stores/selectors', () => ({
  useMessages: mocks.useMessages,
  useSelectedSkills: mocks.useSelectedSkills,
}))

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: mocks.useWriterWorkspaceSummary,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: unknown) => {
    mocks.virtualizerOptions.push(options)
    return {
      getTotalSize: () => mocks.virtualizerState.totalSize,
      getVirtualItems: () => mocks.virtualizerState.items,
      measureElement: mocks.virtualizerState.measureElement,
    }
  },
}))

vi.mock('./MessageBubble', () => ({
  MessageBubble: ({ message }: { message: { id: string; content: string } }) => (
    <div data-testid={`bubble-${message.id}`}>{message.content}</div>
  ),
}))

function createScrollPos(isNearBottom = true) {
  return {
    containerRef: { current: document.createElement('div') },
    handleScroll: vi.fn(),
    isNearBottom,
    scrollToBottom: vi.fn(),
  }
}

function createDefaultProps(overrides: Partial<Parameters<typeof ChatMessageList>[0]> = {}) {
  return {
    isLoading: false,
    streamingContent: '',
    streamStatusText: 'Thinking...',
    starterActions: [
      {
        id: 'continue',
        label: 'Continue writing',
        icon: PenLine,
        description: 'Continue the current draft',
        prompt: 'Continue',
        mode: 'chat' as const,
        agentAction: 'write' as const,
        workflowLevel: 'L3' as const,
      },
    ],
    modePresets: [
      { id: 'focusWriting' as const, label: 'Focus' },
      { id: 'agentDiagnose' as const, label: 'Diagnose' },
      { id: 'compareReview' as const, label: 'Compare' },
    ],
    scrollPos: createScrollPos(),
    onStarterAction: vi.fn(),
    onApplyModePreset: vi.fn(),
    onOpenTemplateLibrary: vi.fn(),
    onOpenFilePicker: vi.fn(),
    onAssistantSelection: vi.fn(),
    onComparisonAccept: vi.fn(),
    startWritingTitle: 'Start writing',
    startWritingDesc: 'Kick things off',
    chatStarterHint: 'Pick a way to begin',
    templateLibraryEntry: 'Library',
    composerUpload: 'Upload',
    ...overrides,
  }
}

describe('ChatMessageList additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.virtualizerOptions.length = 0
    mocks.virtualizerState.totalSize = 0
    mocks.virtualizerState.items = []
    mocks.virtualizerState.measureElement = vi.fn()
    mocks.useMessages.mockReturnValue([])
    mocks.useSelectedSkills.mockReturnValue([])
    mocks.useWriterWorkspaceSummary.mockReturnValue({
      hasMeaningfulScope: false,
      scopeChips: [],
    })
  })

  it('renders scope chips and wires empty-state actions', async () => {
    const user = userEvent.setup()
    const props = createDefaultProps()

    mocks.useWriterWorkspaceSummary.mockReturnValue({
      hasMeaningfulScope: true,
      scopeChips: ['Project: Atlas', 'Chapter: 12'],
    })

    render(<ChatMessageList {...props} />)

    expect(screen.getByText('Project: Atlas')).toBeInTheDocument()
    expect(screen.getByText('Chapter: 12')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Continue writing/i }))
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('button', { name: 'Library' }))
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(props.onStarterAction).toHaveBeenCalledWith(props.starterActions[0])
    expect(props.onApplyModePreset).toHaveBeenCalledWith('focusWriting')
    expect(props.onOpenTemplateLibrary).toHaveBeenCalledTimes(1)
    expect(props.onOpenFilePicker).toHaveBeenCalledTimes(1)
    expect(props.scrollPos.scrollToBottom).toHaveBeenCalled()
  })

  it('skips auto-scroll when the user is not near the bottom and shows only loading status', () => {
    const scrollPos = createScrollPos(false)

    mocks.useMessages.mockReturnValue([
      { id: 'm1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: 'm2', role: 'assistant', content: 'World', timestamp: new Date() },
    ])

    render(
      <ChatMessageList
        {...createDefaultProps({
          isLoading: true,
          streamingContent: '',
          scrollPos,
        })}
      />,
    )

    expect(screen.getByTestId('bubble-m1')).toBeInTheDocument()
    expect(screen.getByTestId('bubble-m2')).toBeInTheDocument()
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
    expect(screen.queryByTestId('bubble-streaming-assistant')).not.toBeInTheDocument()
    expect(scrollPos.scrollToBottom).not.toHaveBeenCalled()
  })

  it('uses the virtualized branch and preserves virtualizer sizing rules', () => {
    const longMessage = 'x'.repeat(2000)
    const messages = Array.from({ length: 51 }, (_, index) => ({
      id: `m${index}`,
      role: index % 2 === 0 ? 'assistant' : 'user',
      content: index === 0 ? longMessage : `message-${index}`,
      timestamp: new Date(),
    }))

    mocks.useMessages.mockReturnValue(messages)
    mocks.virtualizerState.totalSize = 1400
    mocks.virtualizerState.items = [
      { index: 0, start: 0 },
      { index: 50, start: 1220 },
    ]

    render(<ChatMessageList {...createDefaultProps()} />)

    expect(screen.getByTestId('bubble-m0')).toBeInTheDocument()
    expect(screen.getByTestId('bubble-m50')).toBeInTheDocument()
    expect(screen.queryByTestId('bubble-m1')).not.toBeInTheDocument()

    const options = mocks.virtualizerOptions.at(-1)
    expect(options.count).toBe(51)
    expect(options.overscan).toBe(5)
    expect(options.getScrollElement()).toBeTruthy()
    expect(options.estimateSize(999)).toBe(80)
    expect(options.estimateSize(0)).toBe(600)
    expect(options.estimateSize(1)).toBe(80)
  })

  it('skips sparse virtual rows that no longer have a backing message', () => {
    mocks.useMessages.mockReturnValue([
      { id: 'm0', role: 'assistant', content: 'alpha', timestamp: new Date() },
    ])
    mocks.virtualizerState.totalSize = 400
    mocks.virtualizerState.items = [
      { index: 0, start: 0 },
      { index: 3, start: 280 },
    ]

    render(<ChatMessageList {...createDefaultProps()} />)

    expect(screen.getByTestId('bubble-m0')).toBeInTheDocument()
    expect(screen.queryByTestId('bubble-m3')).not.toBeInTheDocument()
  })
})
