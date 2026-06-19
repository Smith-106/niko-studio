import { type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalysisPanel } from './AnalysisPanel'

const MOCK_CHAPTERS = [
  { id: 'chapter-1', title: 'Chapter 1' },
  { id: 'chapter-2', title: 'Chapter 2' },
]

const { resetMockAppStore, useAppStoreMock } = vi.hoisted(() => {
  const state = {
    analysisResults: {} as Record<string, { chaptersAnalyzed: string[]; result: Record<string, unknown>; createdAt: string }>,
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0 },
    analysisError: null as string | null,
    startAnalysis: vi.fn(),
    loadCachedResult: vi.fn().mockResolvedValue(undefined),
    clearAnalysis: vi.fn(),
    currentProjectId: 'project-1',
    currentChapterContent: 'Current chapter text for writing craft coverage.',
    getChaptersForProject: vi.fn(() => MOCK_CHAPTERS),
  }

  const resetMockAppStore = () => {
    state.analysisResults = {}
    state.isAnalyzing = false
    state.analysisProgress = { processed: 0, total: 0 }
    state.analysisError = null
    state.startAnalysis = vi.fn()
    state.loadCachedResult = vi.fn().mockResolvedValue(undefined)
    state.clearAnalysis = vi.fn()
    state.currentProjectId = 'project-1'
    state.currentChapterContent = 'Current chapter text for writing craft coverage.'
    state.getChaptersForProject = vi.fn(() => MOCK_CHAPTERS)
  }

  const useAppStoreMock = Object.assign(
    <T,>(selector?: (storeState: typeof state) => T) => (selector ? selector(state) : (state as T)),
    {
      getState: () => state,
      setState: (partial: Partial<typeof state>) => Object.assign(state, partial),
    },
  )

  return { resetMockAppStore, useAppStoreMock }
})

const runCrossChapterConsistencyMock = vi.hoisted(() => vi.fn())
const readChapterContentMock = vi.hoisted(() => vi.fn())
const extractTextMock = vi.hoisted(() => vi.fn())
const { resetMockSettingsStore, useSettingsStoreMock } = vi.hoisted(() => {
  const createSettingsState = () => ({
    settings: {
      llmProviders: [
        {
          id: 'openai',
          enabled: true,
          apiKey: 'sk-test',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4o',
        },
      ],
      primaryProvider: 'openai',
    },
  })

  const state = createSettingsState()

  const resetMockSettingsStore = () => {
    const nextState = createSettingsState()
    state.settings = nextState.settings
  }

  const useSettingsStoreMock = Object.assign(
    <T,>(selector?: (storeState: typeof state) => T) => (selector ? selector(state) : (state as T)),
    {
      getState: () => state,
      setState: (partial: Partial<typeof state>) => Object.assign(state, partial),
    },
  )

  return { resetMockSettingsStore, useSettingsStoreMock }
})

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: useSettingsStoreMock,
}))

vi.mock('../api/m10-apis', () => ({
  runCrossChapterConsistency: runCrossChapterConsistencyMock,
}))

vi.mock('../services/projectFileService', () => ({
  readChapterContent: readChapterContentMock,
  extractText: extractTextMock,
}))

vi.mock('./intelligence', () => ({
  AccordionWrapper: ({
    items,
  }: {
    items: Array<{ id: string; header: ReactNode; content: ReactNode }>
  }) => (
    <div data-testid="accordion-wrapper">
      {items.map((item) => (
        <div key={item.id}>
          <div>{item.header}</div>
          <div>{item.content}</div>
        </div>
      ))}
    </div>
  ),
  IntelligenceBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  MetricValue: ({ value, label }: { value: string; label: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  ProgressBar: ({ value }: { value: number }) => <div data-testid="progress-bar">{value}</div>,
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
  WritingDashboard: ({
    text,
    visible,
    llmConfig,
    chapters,
  }: {
    text: string
    visible: boolean
    llmConfig?: { api_key: string; base_url: string; model: string }
    chapters?: Array<{ content: string; chapterIndex: number }>
  }) =>
    visible ? (
      <div data-testid="writing-dashboard">
        {text}|{chapters?.length ?? 0}|{llmConfig?.model ?? 'none'}
      </div>
    ) : null,
}))

describe('AnalysisPanel additional behavior', () => {
  beforeEach(() => {
    resetMockAppStore()
    resetMockSettingsStore()
    runCrossChapterConsistencyMock.mockReset()
    readChapterContentMock.mockReset()
    extractTextMock.mockReset()
    readChapterContentMock.mockImplementation(async (_projectId: string, chapterId: string) => `raw:${chapterId}`)
    extractTextMock.mockImplementation((value: string) => `text:${value}`)
  })

  it('loads cached results on mount and starts standard analysis with every chapter id', async () => {
    render(<AnalysisPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(useAppStoreMock.getState().loadCachedResult).toHaveBeenCalledWith('project-1', 'character_arc')
    })

    const analyzeButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-primary-cta'),
    )

    expect(analyzeButton).toBeTruthy()
    fireEvent.click(analyzeButton!)

    expect(useAppStoreMock.getState().startAnalysis).toHaveBeenCalledWith(
      'project-1',
      'character_arc',
      ['chapter-1', 'chapter-2'],
    )
  })

  it('shows progress state and wires clear and close actions', () => {
    useAppStoreMock.setState({
      isAnalyzing: true,
      analysisProgress: { processed: 1, total: 4 },
      analysisError: 'analysis failed',
    })

    const onClose = vi.fn()
    render(<AnalysisPanel onClose={onClose} />)

    expect(screen.getByTestId('progress-bar')).toHaveTextContent('25')
    expect(screen.getByText('analysis failed')).toBeInTheDocument()

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])

    expect(useAppStoreMock.getState().clearAnalysis).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders the empty state branch when no chapters exist', () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => []),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    const analyzeButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-primary-cta'),
    )
    expect(analyzeButton).toBeUndefined()
  })

  it('explains cross-chapter requirements when the project has no chapters', () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => []),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    expect(screen.getByText('在项目中添加章节后，即可启用跨章一致性检测、时间线分析和角色特征漂移检测。')).toBeInTheDocument()
  })

  it('explains that at least two chapters are required for cross-chapter checks', () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => [{ id: 'chapter-1', title: 'Only chapter' }]),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    expect(screen.getByText('需要至少 2 个章节才能执行跨章检测')).toBeInTheDocument()
  })

  it('hydrates writing-craft chapter payloads when the writing tab is selected', async () => {
    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[6])

    await waitFor(() => {
      expect(readChapterContentMock).toHaveBeenCalledTimes(2)
    })

    expect(extractTextMock).toHaveBeenCalledWith('raw:chapter-1')
    expect(screen.getByTestId('writing-dashboard')).toHaveTextContent(
      'Current chapter text for writing craft coverage.|2|gpt-4o',
    )
  })

  it('shows the writing-craft empty-text hint and omits provider metadata when no provider is usable', async () => {
    useAppStoreMock.setState({
      currentChapterContent: '   ',
    })
    useSettingsStoreMock.setState({
      settings: {
        llmProviders: [
          {
            id: 'openai',
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o',
          },
        ],
        primaryProvider: 'openai',
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[6])

    await waitFor(() => {
      expect(readChapterContentMock).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByText('请先在编辑器中输入或加载当前章节正文，再使用写作工艺分析。')).toBeInTheDocument()
    expect(screen.getByTestId('writing-dashboard')).toHaveTextContent('|2|none')
  })

  it('treats a missing project as an empty writing-craft payload source', () => {
    useAppStoreMock.setState({
      currentProjectId: null,
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[6])

    expect(screen.getByTestId('writing-dashboard')).toHaveTextContent(
      'Current chapter text for writing craft coverage.|0|gpt-4o',
    )
    expect(readChapterContentMock).not.toHaveBeenCalled()
    expect(useAppStoreMock.getState().getChaptersForProject).not.toHaveBeenCalled()
    expect(useAppStoreMock.getState().loadCachedResult).not.toHaveBeenCalled()
  })

  it('runs cross-chapter consistency checks and renders returned findings', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [{ similarity: 'high', name1: 'Ava', name2: 'Eva' }],
        unresolvedThreads: [{ lastMentioned: 3, description: 'Loose thread remains' }],
        timelineIssues: [{ chapter1: 1, chapter2: 2, description: 'Timeline conflict' }],
        traitDrifts: [{ character: 'Hero', description: 'Trait drift' }],
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )

    expect(runButton).toBeTruthy()
    fireEvent.click(runButton!)

    await waitFor(() => {
      expect(runCrossChapterConsistencyMock).toHaveBeenCalledOnce()
    })

    expect(screen.getByText((value) => value.includes('Ava') && value.includes('Eva'))).toBeInTheDocument()
    expect(screen.getByText((value) => value.includes('Loose thread remains'))).toBeInTheDocument()
    expect(screen.getByText((value) => value.includes('Timeline conflict'))).toBeInTheDocument()
    expect(screen.getByText((value) => value.includes('Hero'))).toBeInTheDocument()
  })

  it('shows the network fallback when the cross-chapter request throws', async () => {
    runCrossChapterConsistencyMock.mockRejectedValueOnce(new Error('boom'))

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    fireEvent.click(runButton!)

    expect(await screen.findByText('网络错误，请检查连接后重试')).toBeInTheDocument()
  })

  it('surfaces backend errors and exposes the retry path for cross-chapter checks', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: false,
      error: 'service offline',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    fireEvent.click(runButton!)

    await screen.findByText('service offline')

    const retryButton = screen.getByRole('button', { name: '重试' })
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(runCrossChapterConsistencyMock).toHaveBeenCalledTimes(2)
    })
  })

  it('falls back to blank chapter titles and the default backend error copy', async () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => [
        { id: 'chapter-1', title: '' },
        { id: 'chapter-2', title: 'Chapter 2' },
      ]),
    })
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: null,
    })

    const { container } = render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    fireEvent.click(runButton!)

    await waitFor(() => {
      expect(runCrossChapterConsistencyMock).toHaveBeenCalledWith({
        chapters: [
          { chapterNumber: 1, title: '', content: 'text:raw:chapter-1' },
          { chapterNumber: 2, title: 'Chapter 2', content: 'text:raw:chapter-2' },
        ],
      })
    })

    await waitFor(() => {
      const errorMessage = container.querySelector('div.mt-2.flex.items-center.gap-2 p')
      expect(errorMessage?.textContent).toBeTruthy()
      expect(errorMessage?.textContent).not.toBe('service offline')
    })
  })

  it('renders fallback labels when cross-chapter findings omit optional fields', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [{}],
        unresolvedThreads: [{}],
        timelineIssues: [{}],
        traitDrifts: [{}],
      },
    })

    const { container } = render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    fireEvent.click(runButton!)

    await waitFor(() => {
      expect(runCrossChapterConsistencyMock).toHaveBeenCalledOnce()
    })

    expect(container.querySelectorAll('div.text-xs.text-dark-text-muted.bg-dark-card.rounded.p-2.mb-1')).toHaveLength(4)
    expect(container.textContent ?? '').toContain('?')
    expect(container.textContent ?? '').toContain('Ch.undefined')
  })

  it('renders the pass state when cross-chapter checks return no issues', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [],
        traitDrifts: [],
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    fireEvent.click(runButton!)

    expect(await screen.findByText('未发现跨章一致性问题')).toBeInTheDocument()
  })

  it('renders summary details from cached analysis results', () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1', 'chapter-2'],
          createdAt: '2026-06-03T00:00:00Z',
          result: {
            summary: 'Character arc remains stable.',
            score: 0.86,
            details: [
              {
                title: 'Midpoint pressure',
                description: 'Strengthen the turning beat.',
              },
            ],
          },
        },
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('Character arc remains stable.')).toBeInTheDocument()
    expect(screen.getByText('86')).toBeInTheDocument()
    expect(screen.getByText(/Midpoint pressure/)).toBeInTheDocument()
    expect(screen.getByText(/Strengthen the turning beat/)).toBeInTheDocument()
  })

  it('renders fallback detail labels and severity badges for cached results', () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          createdAt: '2026-06-03T00:00:00Z',
          result: {
            details: [
              {
                description: 'Missing title but severe.',
                severity: 'high',
              },
              {
                title: 'Moderate note',
                severity: 'medium',
              },
              {
                title: 'Light note',
                severity: 'low',
              },
            ],
          },
        },
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('条目 1')).toBeInTheDocument()
    expect(screen.getByText('Missing title but severe.')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  it('renders the empty result fallback when cached analysis payload is missing', () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          createdAt: '2026-06-03T00:00:00Z',
          result: undefined as unknown as Record<string, unknown>,
        },
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('无分析结果')).toBeInTheDocument()
  })
})
