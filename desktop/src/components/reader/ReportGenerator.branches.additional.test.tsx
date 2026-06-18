import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const analyzeReaderMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/reader', () => ({
  analyzeReader: analyzeReaderMock,
}))

import {
  ConsensusBar,
  DimensionCard,
  ReportGenerator,
} from './ReportGenerator'

describe('ReportGenerator branch coverage additional', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders error state and retries (line 438-456)', async () => {
    analyzeReaderMock
      .mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          novelId: 'retry-test',
          readerReactions: [],
          editorialAnalysis: {
            structuralIssues: [],
            styleNotes: [],
            pacingAssessment: 'Recovered',
            recommendations: [],
          },
          consensus: {
            items: [],
            overallAssessment: 'Recovered',
            criticalIssues: [],
            dissentItems: [],
            dimensionSummaries: {},
          },
          dimensionScores: [],
          timestamp: '2024-01-01T00:00:00Z',
        },
      })

    render(<ReportGenerator novelId="retry-test" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('生成失败')).toBeInTheDocument()
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })
  })

  it('catches non-Error exceptions in generateReport (line 297-298)', async () => {
    analyzeReaderMock.mockRejectedValue('string error')

    render(<ReportGenerator novelId="string-err" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('生成失败')).toBeInTheDocument()
      expect(screen.getByText('string error')).toBeInTheDocument()
    })
  })

  it('exports report with dimension analysis when dimensionSummaries exist', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'dim-test',
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '维度测试',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '维度测试',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {
            'Plot Coherence': { avgScore: 0.8, consensus: 0.9 },
            'Style Consistency': { avgScore: 0.6, consensus: 0.7 },
          },
        },
        dimensionScores: [
          {
            personaId: 'critic',
            personaName: '评论家',
            scores: [
              { dimension: 'Plot Coherence', score: 0.8, weight: 0.5 },
              { dimension: 'Style Consistency', score: 0.6, weight: 0.5 },
            ],
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="dim-test" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('维度分析')).toBeInTheDocument()
    })

    // Export and verify markdown contains dimension analysis
    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const markdown = writeText.mock.calls[0][0] as string
    expect(markdown).toContain('## 维度分析')
    expect(markdown).toContain('情节连贯')
  })

  it('exports report with consensus issues and dissent in markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'consensus-test',
        readerReactions: [
          {
            personaId: 'reader1',
            personaName: '读者1',
            dimensions: {},
            highlights: [
              {
                text: '段落',
                position: { chapter: '5', paragraph: 2 },
                reaction: 'negative',
                comment: 'A critical plot hole',
                dimension: 'Plot Coherence',
              },
            ],
            overallScore: 0.7,
          },
        ],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '冲突测试',
          recommendations: [],
        },
        consensus: {
          items: [
            {
              description: 'A critical plot hole',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['reader1'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '5', paragraph: 2 },
            },
          ],
          overallAssessment: '冲突测试',
          criticalIssues: [
            {
              description: 'A critical plot hole',
              dimension: 'Plot Coherence',
              agreeingPersonas: ['reader1'],
              disagreeingPersonas: [],
              severity: 'high',
              consensusStrength: 0.7,
              location: { chapter: '5', paragraph: 2 },
            },
          ],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="consensus-test" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      // The critical issues section should show
      expect(screen.getByText(/关键问题/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const markdown = writeText.mock.calls[0][0] as string
    expect(markdown).toContain('## 建议')
  })

  it('shows "稿件整体质量良好" when no critical issues', async () => {
    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'no-critical',
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '质量良好',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '质量良好',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="no-critical" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('建议')).toBeInTheDocument()
    })

    expect(screen.getByText('稿件整体质量良好，建议进行细节打磨')).toBeInTheDocument()
  })

  it('truncates recommendations after 5 critical issues', async () => {
    const reactions = Array.from({ length: 6 }, (_, i) => ({
      personaId: `reader-${i}`,
      personaName: `读者-${i}`,
      dimensions: {},
      highlights: [
        {
          text: `段落${i}`,
          position: { chapter: String(i), paragraph: 1 },
          reaction: 'negative' as const,
          comment: `Critical issue ${i}`,
          dimension: 'Plot Coherence',
        },
      ],
      overallScore: 0.7,
    }))

    const consensusItems = reactions.map((r, i) => ({
      description: `Critical issue ${i}`,
      dimension: 'Plot Coherence',
      agreeingPersonas: [r.personaId],
      disagreeingPersonas: [],
      severity: 'high' as const,
      consensusStrength: 0.7,
      location: { chapter: String(i), paragraph: 1 },
    }))

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'many-issues',
        readerReactions: reactions,
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '很多问题',
          recommendations: [],
        },
        consensus: {
          items: consensusItems,
          overallAssessment: '很多问题',
          criticalIssues: consensusItems,
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="many-issues" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      // Should show at least the recommendations section
      expect(screen.getByText('建议')).toBeInTheDocument()
    })

    // Should show truncation message "还有 1 个问题需要处理..."
    expect(screen.getByText(/还有 1 个问题需要处理/)).toBeInTheDocument()
  })

  it('renders ConsensusBar with different strength levels', () => {
    const { container: c1 } = render(<ConsensusBar strength={0.9} />)
    expect(c1.querySelector('.bg-green-500')).toBeInTheDocument()

    const { container: c2 } = render(<ConsensusBar strength={0.7} />)
    expect(c2.querySelector('.bg-yellow-500')).toBeInTheDocument()

    const { container: c3 } = render(<ConsensusBar strength={0.5} />)
    expect(c3.querySelector('.bg-orange-500')).toBeInTheDocument()

    const { container: c4 } = render(<ConsensusBar strength={0.2} />)
    expect(c4.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('renders DimensionCard with score color thresholds', () => {
    const { container: c1 } = render(
      <DimensionCard dimension="Plot Coherence" summary={{ avgScore: 0.9, consensus: 0.8 }} />,
    )
    expect(c1.querySelector('.text-green-400')).toBeInTheDocument()

    const { container: c2 } = render(
      <DimensionCard dimension="Style" summary={{ avgScore: 0.65, consensus: 0.5 }} />,
    )
    expect(c2.querySelector('.text-yellow-400')).toBeInTheDocument()

    const { container: c3 } = render(
      <DimensionCard dimension="Pacing" summary={{ avgScore: 0.3, consensus: 0.7 }} />,
    )
    expect(c3.querySelector('.text-red-400')).toBeInTheDocument()
  })

  it('uses DIMENSION_LABELS fallback for DimensionCard with unknown dimension', () => {
    render(
      <DimensionCard dimension="CustomDimension" summary={{ avgScore: 0.5, consensus: 0.5 }} />,
    )

    // Unknown dimension falls back to raw name
    expect(screen.getByText('CustomDimension')).toBeInTheDocument()
  })

  it('handles clipboard write failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'clip-fail',
        readerReactions: [],
        editorialAnalysis: {
          structuralIssues: [],
          styleNotes: [],
          pacingAssessment: '导出失败测试',
          recommendations: [],
        },
        consensus: {
          items: [],
          overallAssessment: '导出失败测试',
          criticalIssues: [],
          dissentItems: [],
          dimensionSummaries: {},
        },
        dimensionScores: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
    })

    render(<ReportGenerator novelId="clip-fail" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      expect(screen.getByText('读者模拟报告')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '导出报告' }))

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy report:', expect.any(Error))
    })

    consoleErrorSpy.mockRestore()
  })

  it('uses overallAssessment fallback when editorialAnalysis.pacingAssessment is missing', async () => {
    analyzeReaderMock.mockResolvedValueOnce({
      success: true,
      data: {
        novelId: 'no-pacing',
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

    render(<ReportGenerator novelId="no-pacing" />)

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }))

    await waitFor(() => {
      // Falls back to '分析完成' when pacingAssessment is empty
      expect(screen.getByText('分析完成')).toBeInTheDocument()
    })
  })
})
