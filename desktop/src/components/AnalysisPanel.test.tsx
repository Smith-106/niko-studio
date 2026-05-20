import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'

const MOCK_CHAPTERS = [{ id: 'chapter-1', title: '第一章' }]

const { resetMockAppStore, useAppStoreMock } = vi.hoisted(() => {
  const state = {
    analysisResults: {},
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0 },
    analysisError: null as string | null,
    startAnalysis: vi.fn(),
    loadCachedResult: vi.fn().mockResolvedValue(undefined),
    clearAnalysis: vi.fn(),
    currentProjectId: 'project-1',
    currentChapterContent: '这是当前章节的正文，用于触发写作工艺分析。',
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
    state.currentChapterContent = '这是当前章节的正文，用于触发写作工艺分析。'
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

const analyzeWritingCraftMock = vi.hoisted(() => vi.fn())
const analyzeWritingCraftLLMMock = vi.hoisted(() => vi.fn())
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
  runCrossChapterConsistency: vi.fn(),
}))

vi.mock('../api/writing-craft', () => ({
  analyzeWritingCraft: analyzeWritingCraftMock,
  analyzeWritingCraftLLM: analyzeWritingCraftLLMMock,
}))

vi.mock('./intelligence', () => ({
  AccordionWrapper: ({ items }: { items: Array<{ id: string; content: ReactNode }> }) => (
    <div data-testid="accordion-wrapper">
      {items.map((item) => (
        <div key={item.id}>{item.content}</div>
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
  }: {
    text: string
    visible: boolean
    llmConfig?: { api_key: string; base_url: string; model: string }
  }) => {
    const [showResult, setShowResult] = useState(false)

    if (!visible) {
      return null
    }

    return (
      <div>
        <p>写作质量分析</p>
        <button
          onClick={async () => {
            await analyzeWritingCraftMock(text)
            setShowResult(true)
          }}
        >
          开始分析
        </button>
        {showResult ? <div>反面模式预警</div> : null}
        <button
          onClick={async () => {
            if (!llmConfig) {
              return
            }
            await analyzeWritingCraftLLMMock(text, llmConfig, ['structure'])
          }}
        >
          AI 深度分析
        </button>
      </div>
    )
  },
}))

import { AnalysisPanel } from './AnalysisPanel'

const MOCK_RESULT = {
  overallScore: 6.8,
  textLength: 22,
  dimensions: [
    {
      dimension: 'structure' as const,
      label: '结构',
      score: 6,
      maxScore: 10,
      evidence: ['检测到 2 个关键结构节拍'],
      suggestions: ['补强高潮前的转折动机'],
      details: {
        antiPatternHealth: 3.2,
        criticalAntiPatterns: 2,
      },
    },
  ],
}

describe('AnalysisPanel writing-craft host wiring', () => {
  beforeEach(() => {
    resetMockAppStore()
    analyzeWritingCraftMock.mockReset()
    analyzeWritingCraftLLMMock.mockReset()
  })

  it('mounts WritingDashboard in the visible analysis host and reaches the backend control path', async () => {
    analyzeWritingCraftMock.mockResolvedValue({
      success: true,
      data: MOCK_RESULT,
    })
    analyzeWritingCraftLLMMock.mockResolvedValue({
      success: true,
      data: {
        ...MOCK_RESULT,
        dimensions: [
          {
            ...MOCK_RESULT.dimensions[0],
            details: { analysis: 'AI 深度分析结果' },
            suggestions: ['增加伏笔回收'],
          },
        ],
        source: 'llm',
      },
    })

    render(<AnalysisPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /写作工艺/ }))
    expect(screen.getByText('写作质量分析')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(analyzeWritingCraftMock).toHaveBeenCalledWith('这是当前章节的正文，用于触发写作工艺分析。')
    })

    expect(await screen.findByText(/反面模式预警/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'AI 深度分析' }))

    await waitFor(() => {
      expect(analyzeWritingCraftLLMMock).toHaveBeenCalledWith(
        '这是当前章节的正文，用于触发写作工艺分析。',
        {
          api_key: 'sk-test',
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o',
        },
        ['structure'],
      )
    })
  })
})
