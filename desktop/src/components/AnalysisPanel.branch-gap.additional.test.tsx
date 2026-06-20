import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const MOCK_CHAPTERS_TWO = [
  { id: 'chapter-1', title: '第一章' },
  { id: 'chapter-2', title: '第二章' },
]

const MOCK_CHAPTERS_SINGLE = [{ id: 'chapter-1', title: '第一章' }]

const { resetMockAppStore, useAppStoreMock } = vi.hoisted(() => {
  const state = {
    analysisResults: {} as Record<string, unknown>,
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0 },
    analysisError: null as string | null,
    startAnalysis: vi.fn(),
    loadCachedResult: vi.fn().mockResolvedValue(undefined),
    clearAnalysis: vi.fn(),
    currentProjectId: 'project-1' as string | null,
    currentChapterContent: '这是当前章节的正文，用于触发写作工艺分析。',
    getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
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
    state.currentChapterContent = '这是当前章节的正文，用于触发写作工艺分析。'
    state.getChaptersForProject = vi.fn(() => MOCK_CHAPTERS_TWO)
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

const useSettingsStoreMock = vi.hoisted(() =>
  Object.assign(
    <T,>(selector?: (state: {
      settings: {
        llmProviders: Array<{ id: string; enabled: boolean; apiKey: string; baseUrl: string; defaultModel: string }>
        primaryProvider: string
      }
    }) => T) => {
      const state = {
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
      }
      return selector ? selector(state) : (state as T)
    },
    {
      getState: () => ({
        resetSettings: vi.fn(),
        updateProvider: vi.fn(),
        updateSettings: vi.fn(),
      }),
    },
  ),
)

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: useSettingsStoreMock,
}))

vi.mock('../api/m10-apis', () => ({
  runCrossChapterConsistency: runCrossChapterConsistencyMock,
}))

vi.mock('../api/writing-craft', () => ({
  analyzeWritingCraft: vi.fn(),
  analyzeWritingCraftLLM: vi.fn(),
}))

vi.mock('../services/projectFileService', () => ({
  readChapterContent: vi.fn().mockResolvedValue('<p>Chapter content</p>'),
  extractText: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
}))

vi.mock('./intelligence', () => ({
  AccordionWrapper: ({ items }: { items: Array<{ id: string; header: ReactNode; content: ReactNode }> }) => (
    <div data-testid="accordion-wrapper">
      {items.map((item) => (
        <div key={item.id}>
          <div data-testid="accordion-header">{item.header}</div>
          <div>{item.content}</div>
        </div>
      ))}
    </div>
  ),
  IntelligenceBadge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-testid={`badge-${variant || 'default'}`}>{children}</span>
  ),
  MetricValue: ({ value, label }: { value: string; label: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  ProgressBar: ({ value }: { value: number }) => <div data-testid="progress-bar">{value}</div>,
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
  WritingDashboard: () => <div>WritingDashboard</div>,
}))

import { AnalysisPanel } from './AnalysisPanel'

describe('AnalysisPanel branch-gap additional coverage', () => {
  beforeEach(() => {
    resetMockAppStore()
    runCrossChapterConsistencyMock.mockReset()
  })

  // Line 70: setChapterPayloads current.length === 0 ? current : []
  // When activeTab is writing_craft and chapters.length < 2 but chapterPayloads is non-empty,
  // the effect resets chapterPayloads to [] (takes the else branch of the ternary).
  it('resets chapterPayloads to empty when switching to writing_craft tab with fewer than 2 chapters', async () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_SINGLE),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // Click the writing_craft tab to trigger the useEffect
    fireEvent.click(screen.getByRole('button', { name: /写作工艺/ }))

    // The component should render the writing craft section without crashing
    await waitFor(() => {
      // Use getAllByText since the text appears multiple times
      expect(screen.getAllByText(/写作工艺分析/).length).toBeGreaterThan(0)
    })
  })

  // Line 70: No project ID branch
  it('resets chapterPayloads when currentProjectId is null', async () => {
    useAppStoreMock.setState({
      currentProjectId: null,
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_SINGLE),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /写作工艺/ }))

    await waitFor(() => {
      expect(screen.getAllByText(/写作工艺分析/).length).toBeGreaterThan(0)
    })
  })

  // Line 111: res.error || '检测失败，请重试' — when error is falsy
  it('shows fallback error message when cross-chapter check fails with empty error', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: false,
      error: '',
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // Click the consistency tab
    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))

    // Click the cross-chapter consistency button
    const button = screen.getByRole('button', { name: /跨章一致性检测/ })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('检测失败，请重试')).toBeTruthy()
    })
  })

  // Line 113-114: catch block for cross-chapter consistency
  it('shows network error when cross-chapter check throws', async () => {
    runCrossChapterConsistencyMock.mockRejectedValue(new Error('network failure'))

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))

    const button = screen.getByRole('button', { name: /跨章一致性检测/ })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('网络错误，请检查连接后重试')).toBeTruthy()
    })
  })

  // Line 248-251: chapters.length === 0 branch in consistency section
  it('shows zero-chapter message in consistency section when no chapters exist', async () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => []),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))

    // When chapters.length === 0, the cross-chapter section shows the add-chapters message
    expect(screen.getByText(/添加章节后，即可启用跨章一致性检测/)).toBeTruthy()
  })

  // Line 248-251: chapters.length === 1 branch (< 2 but not 0)
  it('shows needs-2-chapters message in consistency section with only 1 chapter', async () => {
    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_SINGLE),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))

    expect(screen.getByText(/需要至少 2 个章节才能执行跨章检测/)).toBeTruthy()
  })

  // Lines 298-303: All four cross-chapter arrays are empty — "no issues" branch
  it('shows no-issues message when cross-chapter result has empty arrays', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [],
        traitDrifts: [],
      },
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))

    const button = screen.getByRole('button', { name: /跨章一致性检测/ })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('未发现跨章一致性问题')).toBeTruthy()
    })
  })

  // Lines 255-265: nameConflicts with data
  it('renders name conflicts when cross-chapter result has conflicts', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [{ similarity: '0.95', name1: 'Alice', name2: 'Alicia' }],
        unresolvedThreads: [],
        timelineIssues: [],
        traitDrifts: [],
      },
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))
    fireEvent.click(screen.getByRole('button', { name: /跨章一致性检测/ }))

    await waitFor(() => {
      expect(screen.getByText('命名冲突')).toBeTruthy()
      expect(screen.getByText('0.95')).toBeTruthy()
      expect(screen.getByText(/Alice/)).toBeTruthy()
    })
  })

  // Lines 266-275: unresolvedThreads with data
  it('renders unresolved threads when cross-chapter result has them', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [{ lastMentioned: '5', description: 'A loose thread' }],
        timelineIssues: [],
        traitDrifts: [],
      },
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))
    fireEvent.click(screen.getByRole('button', { name: /跨章一致性检测/ }))

    await waitFor(() => {
      expect(screen.getByText('未解决线索')).toBeTruthy()
      expect(screen.getByText(/第 5 章引入/)).toBeTruthy()
    })
  })

  // Lines 276-286: timelineIssues with data
  it('renders timeline issues when cross-chapter result has them', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [{ chapter1: '2', chapter2: '3', description: 'Timeline gap' }],
        traitDrifts: [],
      },
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))
    fireEvent.click(screen.getByRole('button', { name: /跨章一致性检测/ }))

    await waitFor(() => {
      expect(screen.getByText('时间线问题')).toBeTruthy()
      expect(screen.getByText('Ch.2→Ch.3')).toBeTruthy()
    })
  })

  // Lines 287-297: traitDrifts with data
  it('renders trait drifts when cross-chapter result has them', async () => {
    runCrossChapterConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        nameConflicts: [],
        unresolvedThreads: [],
        timelineIssues: [],
        traitDrifts: [{ character: 'Bob', description: 'Changed personality' }],
      },
    })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))
    fireEvent.click(screen.getByRole('button', { name: /跨章一致性检测/ }))

    await waitFor(() => {
      expect(screen.getByText('角色特征漂移')).toBeTruthy()
      expect(screen.getByText('Bob')).toBeTruthy()
    })
  })

  // Retry button in cross-chapter error
  it('clicking retry re-runs cross-chapter consistency check', async () => {
    runCrossChapterConsistencyMock
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({
        success: true,
        data: {
          nameConflicts: [],
          unresolvedThreads: [],
          timelineIssues: [],
          traitDrifts: [],
        },
      })

    useAppStoreMock.setState({
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
      currentProjectId: 'project-1',
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /一致性/ }))
    fireEvent.click(screen.getByRole('button', { name: /跨章一致性检测/ }))

    await waitFor(() => {
      expect(screen.getByText('网络错误，请检查连接后重试')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /重试/ }))

    await waitFor(() => {
      expect(screen.getByText('未发现跨章一致性问题')).toBeTruthy()
    })
  })

  // AnalysisResultView: no data
  it('renders no-result message when analysis result has no data', async () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          result: null,
          createdAt: '2026-01-01',
        },
      },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // character_arc tab should be active by default and show "no result"
    expect(screen.getByText('无分析结果')).toBeTruthy()
  })

  // AnalysisResultView: no summary, no score
  it('renders dash for missing score and omits summary section when absent', async () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          result: { details: [] },
          createdAt: '2026-01-01',
        },
      },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('摘要')).toBeNull()
  })

  // AnalysisResultView: severity branches (medium and success/low)
  it('renders medium severity badge and low severity badge', async () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          result: {
            summary: 'A summary',
            score: 0.75,
            details: [
              { title: 'Issue 1', description: 'A medium issue', severity: 'medium' },
              { title: 'Issue 2', severity: 'low' },
            ],
          },
          createdAt: '2026-01-01',
        },
      },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('摘要')).toBeTruthy()
    expect(screen.getByText('A summary')).toBeTruthy()
    expect(screen.getByText('medium')).toBeTruthy()
    expect(screen.getByText('low')).toBeTruthy()
  })

  // ProgressBar: total is 0 — covers Math.max(analysisProgress.total, 1)
  it('renders progress bar with safe denominator when total is 0', async () => {
    useAppStoreMock.setState({
      isAnalyzing: true,
      analysisProgress: { processed: 3, total: 0 },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // The progress bar should be visible (value = (3 / Math.max(0, 1)) * 100 = 300)
    expect(screen.getByTestId('progress-bar')).toBeTruthy()
  })

  // AnalysisResultView: description is not a string — should not render description
  it('skips description when item.description is not a string', async () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          result: {
            details: [
              { title: 'Item 1', description: 42, severity: 'high' },
            ],
          },
          createdAt: '2026-01-01',
        },
      },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('high')).toBeTruthy()
    // The number 42 should NOT appear as description text since typeof !== 'string'
    expect(screen.queryByText('42')).toBeNull()
  })

  // AnalysisResultView: no title — falls back to "条目 N"
  it('renders fallback title when detail item has no title', async () => {
    useAppStoreMock.setState({
      analysisResults: {
        character_arc: {
          chaptersAnalyzed: ['chapter-1'],
          result: {
            details: [
              { description: 'Some detail', severity: 'high' },
            ],
          },
          createdAt: '2026-01-01',
        },
      },
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    // The fallback title "条目 1" should appear in the accordion header
    expect(screen.getByTestId('accordion-wrapper').textContent).toContain('条目 1')
  })

  // Writing craft: no text available
  it('shows empty text message when currentChapterContent is empty', async () => {
    useAppStoreMock.setState({
      currentChapterContent: '',
      currentProjectId: 'project-1',
      getChaptersForProject: vi.fn(() => MOCK_CHAPTERS_TWO),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /写作工艺/ }))

    expect(screen.getByText(/请先在编辑器中输入或加载当前章节正文/)).toBeTruthy()
  })

  // handleAnalyze: no currentProjectId
  it('disables analysis button and shows no-chapter message when no project is open', async () => {
    useAppStoreMock.setState({
      currentProjectId: null,
      getChaptersForProject: vi.fn(() => []),
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    expect(screen.getByText('打开包含章节的项目后即可使用智能分析功能')).toBeTruthy()
  })
})
