import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PenLine } from 'lucide-react'
import { ChatMessageList } from './ChatMessageList'

// Mock store selectors
vi.mock('../stores/selectors', () => ({
  useMessages: vi.fn(),
  useSelectedSkills: vi.fn(),
  useCurrentConversationId: vi.fn(),
  useAvailableSkills: vi.fn(),
  useWorkflowLevel: vi.fn(),
  useAllowLlmFallback: vi.fn(),
  useQualityGoals: vi.fn(),
  useLatestAssistantMessageContent: vi.fn(),
  useChatAreaSettings: vi.fn(),
  useCreateConversation: vi.fn(),
  useAddMessage: vi.fn(),
}))

// Mock writer workspace summary
vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: vi.fn(),
}))

// Mock virtualizer for test environment
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
    measureElement: vi.fn(),
  })),
}))

// Mock MessageBubble
vi.mock('./MessageBubble', () => ({
  MessageBubble: ({ message }: { message: any }) => (
    <div data-testid={`message-${message.id}`}>{message.content}</div>
  ),
}))

import { useMessages, useSelectedSkills } from '../stores/selectors'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useVirtualizer } from '@tanstack/react-virtual'

const mockedUseMessages = vi.mocked(useMessages)
const mockedUseSelectedSkills = vi.mocked(useSelectedSkills)
const mockedUseWriterWorkspaceSummary = vi.mocked(useWriterWorkspaceSummary)
const mockedUseVirtualizer = vi.mocked(useVirtualizer)

const createMockScrollPos = () => ({
  containerRef: { current: document.createElement('div') },
  handleScroll: vi.fn(),
  isNearBottom: true,
  scrollToBottom: vi.fn(),
})

const defaultProps = {
  isLoading: false,
  streamingContent: '',
  streamStatusText: '思考中...',
  starterActions: [],
  modePresets: [
    { id: 'focusWriting' as const, label: '专注写作' },
    { id: 'agentDiagnose' as const, label: '智能诊断' },
    { id: 'compareReview' as const, label: '对比审阅' },
  ],
  scrollPos: createMockScrollPos(),
  onStarterAction: vi.fn(),
  onApplyModePreset: vi.fn(),
  onOpenTemplateLibrary: vi.fn(),
  onOpenFilePicker: vi.fn(),
  onAssistantSelection: vi.fn(),
  onComparisonAccept: vi.fn(),
  startWritingTitle: '开始创作',
  startWritingDesc: '选择一个快捷操作开始写作',
  chatStarterHint: '提示文字',
  templateLibraryEntry: '模板库',
  composerUpload: '上传文件',
}

describe('ChatMessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseVirtualizer.mockReturnValue({
      getTotalSize: () => 0,
      getVirtualItems: () => [],
      measureElement: vi.fn(),
    } as any)
    mockedUseMessages.mockReturnValue([])
    mockedUseSelectedSkills.mockReturnValue([])
    mockedUseWriterWorkspaceSummary.mockReturnValue({
      hasMeaningfulScope: false,
      scopeChips: [],
      meaningfulWorkspace: null,
      projectLabel: null,
      chapterLabel: null,
      storyBibleLabel: null,
      focusLabel: null,
      workspaceLabel: null,
      workflowLabel: null,
    } as any)
  })

  it('renders empty state when no messages', () => {
    render(<ChatMessageList {...defaultProps} />)

    expect(screen.getByText('开始创作')).toBeInTheDocument()
    expect(screen.getByText('提示文字')).toBeInTheDocument()
  })

  it('renders messages when present', () => {
    mockedUseMessages.mockReturnValue([
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Hi there', timestamp: new Date() },
    ] as any)

    render(<ChatMessageList {...defaultProps} />)

    expect(screen.getByTestId('message-1')).toBeInTheDocument()
    expect(screen.getByTestId('message-2')).toBeInTheDocument()
  })

  it('renders streaming content as assistant message when loading', () => {
    mockedUseMessages.mockReturnValue([
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
    ] as any)

    render(<ChatMessageList {...defaultProps} isLoading={true} streamingContent="Thinking..." />)

    expect(screen.getByTestId('message-streaming-assistant')).toBeInTheDocument()
    expect(screen.getByText('思考中...')).toBeInTheDocument()
  })

  it('renders starter actions in empty state', () => {
    const starterActions = [
      {
        id: 'continueDraft',
        label: '继续写作',
        icon: PenLine,
        description: '继续当前内容',
        prompt: '请继续写作',
        mode: 'chat' as const,
        agentAction: 'write' as const,
        workflowLevel: 'L3' as const,
      },
    ]

    render(<ChatMessageList {...defaultProps} starterActions={starterActions} />)

    expect(screen.getByText('继续写作')).toBeInTheDocument()
    expect(screen.getByText('继续当前内容')).toBeInTheDocument()
  })

  it('renders mode presets in empty state', () => {
    render(<ChatMessageList {...defaultProps} />)

    expect(screen.getByText('专注写作')).toBeInTheDocument()
    expect(screen.getByText('智能诊断')).toBeInTheDocument()
    expect(screen.getByText('对比审阅')).toBeInTheDocument()
  })

  it('renders virtualized rows and skips rows without a backing message', () => {
    mockedUseMessages.mockReturnValue(
      Array.from({ length: 51 }, (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${index}`,
        timestamp: new Date(),
      })) as any,
    )
    const measureElement = vi.fn()
    mockedUseVirtualizer.mockReturnValue({
      getTotalSize: () => 640,
      getVirtualItems: () => [
        { index: 0, start: 0, size: 80, key: 'msg-0' },
        { index: 999, start: 80, size: 80, key: 'missing-row' },
      ],
      measureElement,
    } as any)

    const { container } = render(<ChatMessageList {...defaultProps} />)

    expect(screen.getByTestId('message-msg-0')).toBeInTheDocument()
    expect(container.querySelector('[data-index="999"]')).toBeNull()
  })
})
