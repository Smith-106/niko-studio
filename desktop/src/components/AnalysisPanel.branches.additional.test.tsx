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

describe('AnalysisPanel branch coverage — traitDrifts and empty-result fallback paths', () => {
  beforeEach(() => {
    resetMockAppStore()
    resetMockSettingsStore()
    runCrossChapterConsistencyMock.mockReset()
    readChapterContentMock.mockReset()
    extractTextMock.mockReset()
    readChapterContentMock.mockImplementation(async (_projectId: string, chapterId: string) => `raw:${chapterId}`)
    extractTextMock.mockImplementation((value: string) => `text:${value}`)
  })

  it('renders traitDrifts section when cross-chapter result includes trait drifts', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [],
        traitDrifts: [
          { character: 'Aria', description: 'Motivation shifts from survival to revenge without transition' },
          { character: 'Kael', description: 'Personality reversal in chapter 3' },
        ],
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // switch to consistency tab
    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    expect(runButton).toBeTruthy()
    fireEvent.click(runButton!)

    await waitFor(() => {
      expect(runCrossChapterConsistencyMock).toHaveBeenCalledOnce()
    })

    // traitDrifts header renders
    expect(screen.getByText('角色特征漂移')).toBeInTheDocument()
    // trait drift items render — character name and description are in sibling nodes
    expect(screen.getByText('Aria')).toBeInTheDocument()
    expect(screen.getByText('Motivation shifts from survival to revenge without transition')).toBeInTheDocument()
    expect(screen.getByText('Kael')).toBeInTheDocument()
    expect(screen.getByText('Personality reversal in chapter 3')).toBeInTheDocument()
  })

  it('shows no-issues message when cross-chapter result omits all four optional arrays', async () => {
    // Return data with no optional fields at all — triggers || [] fallback on every check
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {},
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    expect(runButton).toBeTruthy()
    fireEvent.click(runButton!)

    expect(await screen.findByText('未发现跨章一致性问题')).toBeInTheDocument()
  })

  it('shows no-issues message when cross-chapter result has only traitDrifts undefined and other arrays empty', async () => {
    // traitDrifts is undefined (triggers || [] fallback), other arrays are explicitly empty
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [],
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button')[4])

    const runButton = screen.getAllByRole('button').find((button) =>
      button.className.includes('bg-indigo-600'),
    )
    expect(runButton).toBeTruthy()
    fireEvent.click(runButton!)

    expect(await screen.findByText('未发现跨章一致性问题')).toBeInTheDocument()
  })

  it('does not render traitDrifts section when the field is absent from result', async () => {
    // Only nameConflicts present, traitDrifts absent
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [{ similarity: 'medium', name1: 'Ren', name2: 'Len' }],
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

    // nameConflicts renders
    expect(screen.getByText('命名冲突')).toBeInTheDocument()
    // traitDrifts section is absent
    expect(screen.queryByText('角色特征漂移')).not.toBeInTheDocument()
    // no-issues message does NOT appear (nameConflicts has items)
    expect(screen.queryByText('未发现跨章一致性问题')).not.toBeInTheDocument()
  })
})
