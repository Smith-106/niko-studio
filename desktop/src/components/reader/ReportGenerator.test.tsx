import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const analyzeReaderMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/reader', () => ({
  analyzeReader: analyzeReaderMock,
}))

import type { ConsensusItem, ConsensusReport } from '../../../../src-ts/reader/ConsensusEngine'
import {
  ConsensusBar,
  ConsensusIssueItem,
  DimensionCard,
  DissentItem,
  ReportGenerator,
} from './ReportGenerator'

function buildConsensusItem(overrides: Partial<ConsensusItem> = {}): ConsensusItem {
  return {
    description: 'Plot gap near the midpoint',
    dimension: 'Plot Coherence',
    agreeingPersonas: ['critic'],
    disagreeingPersonas: [],
    severity: 'high',
    consensusStrength: 0.7,
    location: { chapter: '12', paragraph: 3 },
    ...overrides,
  }
}

describe('ReportGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders consensus bars across threshold colors', () => {
    const { container, rerender } = render(<ConsensusBar strength={0.8} />)

    expect(container.querySelector('div[style="width: 80%;"]')).toHaveClass('bg-green-500')

    rerender(<ConsensusBar strength={0.6} />)
    expect(container.querySelector('div[style="width: 60%;"]')).toHaveClass('bg-yellow-500')

    rerender(<ConsensusBar strength={0.4} />)
    expect(container.querySelector('div[style="width: 40%;"]')).toHaveClass('bg-orange-500')

    rerender(<ConsensusBar strength={0.39} />)
    expect(container.querySelector('div[style="width: 39%;"]')).toHaveClass('bg-red-500')
  })

  it('renders dimension cards with translated labels and score colors', () => {
    const { rerender } = render(
      <DimensionCard dimension="Plot" summary={{ avgScore: 0.82, consensus: 0.61 }} />,
    )

    expect(screen.getByText('情节')).toBeInTheDocument()
    expect(screen.getByText('82')).toHaveClass('text-green-400')

    rerender(<DimensionCard dimension="Mystery" summary={{ avgScore: 0.65, consensus: 0.5 }} />)
    expect(screen.getByText('Mystery')).toBeInTheDocument()
    expect(screen.getByText('65')).toHaveClass('text-yellow-400')

    rerender(<DimensionCard dimension="Style" summary={{ avgScore: 0.34, consensus: 0.22 }} />)
    expect(screen.getByText('风格')).toBeInTheDocument()
    expect(screen.getByText('34')).toHaveClass('text-red-400')
  })

  it('renders consensus overflow badges and dissent persona groups', () => {
    render(
      <>
        <ConsensusIssueItem
          item={buildConsensusItem({
            agreeingPersonas: ['critic', 'reader', 'editor', 'beta', 'omega'],
          })}
        />
        <DissentItem
          item={buildConsensusItem({
            dimension: 'Mystery',
            description: 'Readers disagree strongly',
            agreeingPersonas: ['editor'],
            disagreeingPersonas: ['critic', 'reader'],
            consensusStrength: 0.3,
          })}
        />
      </>,
    )

    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('分歧')).toBeInTheDocument()
    expect(screen.getByText('同意 (1)')).toBeInTheDocument()
    expect(screen.getByText('反对 (2)')).toBeInTheDocument()
    expect(screen.getByText('Mystery')).toBeInTheDocument()
  })

  it('generates a report, notifies the caller, and exports markdown to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const onReportGenerated = vi.fn()
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'novel-7',
        readerReactions: [
          {
            personaId: 'critic',
            personaName: '评论家',
            dimensions: {},
            highlights: [
              {
                text: 'A missing transition',
                position: { chapter: '12', paragraph: 3 },
                reaction: 'negative',
                comment: 'Plot gap near the midpoint',
                dimension: 'Plot Coherence',
              },
            ],
            overallScore: 0.7,
          },
          {
            personaId: 'reader',
            personaName: '读者',
            dimensions: {},
            highlights: [
              {
                text: 'The prose lands well.',
                position: { chapter: '12', paragraph: 5 },
                reaction: 'positive',
                comment: 'Elegant prose',
                dimension: 'Style',
              },
            ],
            overallScore: 0.8,
          },
        ],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '节奏分析完成，前半段需要补强悬念。',
          recommendations: [],
        },
        consensus: {
          items: [
            {
              description: 'Plot gap near the midpoint',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['critic'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '12', paragraph: 3 },
            },
            {
              description: 'Elegant prose',
              dimension: 'Style',
              agreeingPersonas: ['reader'],
              disagreeingPersonas: [],
              severity: 'medium',
              consensusStrength: 0.7,
              location: { chapter: '12', paragraph: 5 },
            },
          ],
          overallAssessment: '节奏分析完成，前半段需要补强悬念。',
          criticalIssues: [
            {
              description: 'Plot gap near the midpoint',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['critic'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '12', paragraph: 3 },
            },
          ],
          dissentItems: [],
          dimensionSummaries: {
            Plot: { avgScore: 0.82, consensus: 0.9 },
            Style: { avgScore: 0.66, consensus: 0.8 },
          },
        },
        dimensionScores: [
          {
            personaId: 'critic',
            personaName: '评论家',
            scores: [
              { dimension: 'Plot', score: 0.82, weight: 0.5 },
              { dimension: 'Style', score: 0.66, weight: 0.5 },
            ],
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="novel-7" onReportGenerated={onReportGenerated} />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    expect(analyzeReaderMock).toHaveBeenCalledWith('novel-7')
    expect(screen.getByText('节奏分析完成，前半段需要补强悬念。')).toBeInTheDocument()
    expect(screen.getByText('共识问题 (1)')).toBeInTheDocument()
    expect(screen.getByText('维度分析')).toBeInTheDocument()
    expect(screen.getByText('处理 情节连贯 问题: Plot gap near the midpoint...')).toBeInTheDocument()
    expect(onReportGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        overallAssessment: '节奏分析完成，前半段需要补强悬念。',
        items: expect.arrayContaining([
          expect.objectContaining({
            description: 'Plot gap near the midpoint',
            severity: 'high',
          }),
          expect.objectContaining({
            description: 'Elegant prose',
            severity: 'medium',
          }),
        ]),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const markdown = writeText.mock.calls[0][0] as string
    expect(markdown).toContain('# 读者模拟报告')
    expect(markdown).toContain('小说 ID: novel-7')
    expect(markdown).toContain('## 共识问题')
    expect(markdown).toContain('Plot gap near the midpoint')
    expect(consoleLogSpy).toHaveBeenCalledWith('Report exported to clipboard')
  })

  it('shows an error state and can recover on retry', async () => {
    analyzeReaderMock
      .mockResolvedValueOnce({
        success: false,
        error: 'gateway offline',
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          novelId: 'novel-retry',
          readerReactions: [],
          editorialAnalysis: {
            structuralIssues: [],
            styleNotes: [],
            pacingAssessment: '重试后成功',
            recommendations: [],
          },
          consensus: {
            items: [],
            overallAssessment: '重试后成功',
            criticalIssues: [],
            dissentItems: [],
            dimensionSummaries: {},
          },
          dimensionScores: [],
          timestamp: '2024-01-01T00:00:00Z',
        },
      })

    render(<ReportGenerator novelId="novel-retry" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('生成失败')).toBeInTheDocument()
    })

    expect(screen.getByText('gateway offline')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    expect(screen.getByText('重试后成功')).toBeInTheDocument()
    expect(analyzeReaderMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to the default summary and low-priority recommendation without critical issues', async () => {
    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'novel-clean',
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '分析完成',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="novel-clean" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    expect(screen.getByText('分析完成')).toBeInTheDocument()
    expect(screen.getByText('稿件整体质量良好，建议进行细节打磨')).toBeInTheDocument()
    expect(screen.queryByText('维度分析')).not.toBeInTheDocument()
    expect(screen.queryByText(/共识问题 \(/)).not.toBeInTheDocument()
  })

  it('reports clipboard export failures to the console', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const writeText = vi.fn().mockRejectedValue(new Error('copy failed'))

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'novel-export-error',
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '可导出报告',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '可导出报告',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="novel-export-error" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to copy report:',
      expect.any(Error),
    )
  })

  it('exports dissent sections and truncates recommendations after five critical issues', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'novel-dissent',
        readerReactions: [
          {
            personaId: 'critic',
            personaName: '评论家',
            dimensions: {},
            highlights: [
              {
                text: 'Anchor issue',
                position: { chapter: '7', paragraph: 2 },
                reaction: 'negative',
                comment: 'Anchor issue',
                dimension: 'Plot Coherence',
              },
            ],
            overallScore: 0.7,
          },
        ],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '需要更细的修订计划',
          recommendations: [],
        },
        consensus: {
          items: [
            {
              description: 'Anchor issue',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['critic'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '7', paragraph: 2 },
            },
          ],
          overallAssessment: '需要更细的修订计划',
          criticalIssues: [
            {
              description: 'Anchor issue',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['critic'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '7', paragraph: 2 },
            },
          ],
          dissentItems: [
            {
              description: 'Readers disagree strongly',
              dimension: 'Mystery',
              agreeingPersonas: [],
              disagreeingPersonas: [],
              severity: 'medium',
              consensusStrength: 0.2,
              location: { chapter: '1', paragraph: 1 },
            },
          ],
          dimensionSummaries: {},
        },
        dimensionScores: [
          {
            personaId: 'critic',
            personaName: '评论家',
            scores: [
              { dimension: 'Plot', score: 0.82, weight: 0.5 },
              { dimension: 'Mystery', score: 0.59, weight: 0.5 },
            ],
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    let capturedReport: ConsensusItem[] | null = null

    const onReportGenerated = vi.fn((report: ConsensusReport) => report)
    const view = render(
      <ReportGenerator
        novelId="novel-dissent"
        onReportGenerated={(report) => {
          report.criticalIssues = Array.from({ length: 6 }, (_, index) => buildConsensusItem({
            description: `Critical issue ${index + 1}`,
            severity: index === 0 ? 'critical' : 'high',
            agreeingPersonas: index === 5 ? [] : [`persona-${index + 1}`],
          }))
          report.dissentItems = [
            buildConsensusItem({
              dimension: 'Mystery',
              description: 'Readers disagree strongly',
              agreeingPersonas: [],
              disagreeingPersonas: [],
              severity: 'medium',
              consensusStrength: 0.2,
            }),
          ]
          capturedReport = report.criticalIssues
          onReportGenerated(report)
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    expect(onReportGenerated).toHaveBeenCalled()
    expect(capturedReport).toHaveLength(6)

    view.rerender(
      <ReportGenerator
        novelId="novel-dissent"
        onReportGenerated={onReportGenerated}
      />,
    )

    expect(screen.getByText('分歧点 (1)')).toBeInTheDocument()
    expect(screen.getByText('还有 1 个问题需要处理...')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const markdown = writeText.mock.calls[0][0] as string
    expect(markdown).toContain('## 分歧点')
    expect(markdown).toContain('### Mystery')
    expect(markdown).toContain('- 同意: 无')
    expect(markdown).toContain('- 反对: 无')
    expect(markdown).toContain('Critical issue 6')
  })
})
