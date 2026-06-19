import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

const analyzeWritingCraftMock = vi.hoisted(() => vi.fn())
const analyzeEmotionalArcMock = vi.hoisted(() => vi.fn())
const generateMarkdownReportMock = vi.hoisted(() => vi.fn())
const downloadAsFileMock = vi.hoisted(() => vi.fn())
const generatePdfHtmlMock = vi.hoisted(() => vi.fn())
const downloadPdfFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/writing-craft', async () => {
  const actual = await vi.importActual<typeof import('../../api/writing-craft')>('../../api/writing-craft')
  return {
    ...actual,
    analyzeWritingCraft: analyzeWritingCraftMock,
    analyzeEmotionalArc: analyzeEmotionalArcMock,
  }
})

vi.mock('../../utils/export-analysis', () => ({
  generateMarkdownReport: generateMarkdownReportMock,
  downloadAsFile: downloadAsFileMock,
}))

vi.mock('../../utils/export-pdf', () => ({
  generatePdfHtml: generatePdfHtmlMock,
  downloadPdfFile: downloadPdfFileMock,
}))

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ value }: { value: number }) => <div>{`progress:${value}`}</div>,
}))

vi.mock('./WritingDimensionDetail', () => ({
  WritingDimensionDetail: () => <div>detail</div>,
}))

vi.mock('./InlineAnnotation', () => ({
  InlineAnnotation: ({ text, dimensions }: { text: string; dimensions: Array<unknown> }) => (
    <div>{`annotation:${dimensions.length}:${text}`}</div>
  ),
}))

vi.mock('./EmotionalArcChart', () => ({
  EmotionalArcChart: ({ result }: { result: { timeline: Array<unknown> } }) => (
    <div>{`arc:${result.timeline.length}`}</div>
  ),
}))

vi.mock('./ReaderImmersionDashboard', () => ({
  ReaderImmersionDashboard: ({ chapters, visible }: { chapters: Array<unknown>; visible: boolean }) => (
    <div>{`immersion:${visible}:${chapters.length}`}</div>
  ),
}))

vi.mock('./PacingPrescriptionPanel', () => ({
  PacingPrescriptionPanel: ({ chapters, visible }: { chapters: Array<unknown>; visible: boolean }) => (
    <div>{`pacing:${visible}:${chapters.length}`}</div>
  ),
}))

vi.mock('lucide-react', () => ({
  BarChart3: ({ size }: { size: number }) => <svg data-size={size} />,
  Loader2: ({ size }: { size: number }) => <svg data-size={size} />,
  AlertCircle: ({ size }: { size: number }) => <svg data-size={size} />,
  Download: ({ size }: { size: number }) => <svg data-size={size} />,
  FileText: ({ size }: { size: number }) => <svg data-size={size} />,
}))

import type { LLMConfig, WritingCraftResult } from '../../api/writing-craft'
import { WritingDashboard } from './WritingDashboard'

const LLM_CONFIG: LLMConfig = {
  api_key: 'test-key',
  base_url: 'https://example.test',
  model: 'gpt-test',
}

const SINGLE_RESULT: WritingCraftResult = {
  overallScore: 6.5,
  textLength: 200,
  dimensions: [
    {
      dimension: 'structure',
      label: '结构分析',
      score: 7,
      maxScore: 10,
      evidence: ['三幕结构完整'],
      suggestions: ['加强中段张力'],
      details: {},
    },
  ],
}

const CHAPTERS = [
  { chapterIndex: 0, content: '第一章内容' },
  { chapterIndex: 1, content: '第二章内容' },
]

describe('WritingDashboard extra2 branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateMarkdownReportMock.mockReturnValue('# report')
    generatePdfHtmlMock.mockReturnValue('<html>report</html>')
  })

  // Line 68: handleAnalyze catch — Error instance path (err.message)
  it('shows error message when analyzeWritingCraft throws an Error', async () => {
    const user = userEvent.setup()
    analyzeWritingCraftMock.mockRejectedValueOnce(new Error('network failure'))

    render(<WritingDashboard text="测试文本" visible={true} llmConfig={LLM_CONFIG} />)

    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText('network failure')).toBeInTheDocument()
    })
  })

  // Line 68: handleAnalyze catch — non-Error path ('Unknown error')
  it('shows Unknown error when analyzeWritingCraft throws a non-Error value', async () => {
    const user = userEvent.setup()
    analyzeWritingCraftMock.mockRejectedValueOnce('string-error')

    render(<WritingDashboard text="测试文本" visible={true} llmConfig={LLM_CONFIG} />)

    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })
  })

  // Line 88: handleAnalyzeCrossChapter catch — Error instance path (err.message)
  it('shows error message when cross-chapter analysis throws an Error', async () => {
    const user = userEvent.setup()
    analyzeEmotionalArcMock.mockRejectedValueOnce(new Error('cross failure'))

    render(<WritingDashboard text="测试文本" visible={true} chapters={CHAPTERS} />)

    await user.click(screen.getByRole('button', { name: '跨章节' }))

    await waitFor(() => {
      expect(screen.getByText('cross failure')).toBeInTheDocument()
    })
  })

  // Line 193: mode='cross' && !hasCrossData → "需要至少 2 个章节" message
  it('shows insufficient chapters message in cross mode after chapters drop below 2', async () => {
    const user = userEvent.setup()
    analyzeEmotionalArcMock.mockResolvedValueOnce({ success: true, data: { timeline: [], tensionDeserts: [], curveMatches: [], overallArcScore: 0.5, suggestions: [] } })

    const { rerender } = render(<WritingDashboard text="测试文本" visible={true} chapters={CHAPTERS} />)

    // Enter cross mode with 2 chapters
    await user.click(screen.getByRole('button', { name: '跨章节' }))

    // Rerender with only 1 chapter — hasCrossData becomes false, but mode stays 'cross'
    rerender(<WritingDashboard text="测试文本" visible={true} chapters={[{ chapterIndex: 0, content: 'One' }]} />)

    expect(screen.getByText('需要至少 2 个章节才能执行跨章节分析。')).toBeInTheDocument()
  })

  // Line 65: response.error ?? 'Analysis failed' — when analyzeWritingCraft returns success=false with no error
  it('shows Analysis failed fallback when analyzeWritingCraft returns failure with no error', async () => {
    const user = userEvent.setup()
    analyzeWritingCraftMock.mockResolvedValueOnce({ success: false, error: undefined })

    render(<WritingDashboard text="测试文本" visible={true} llmConfig={LLM_CONFIG} />)

    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    })
  })

  // Line 85: arcRes.error ?? 'Analysis failed' — cross-chapter failure with no error
  it('shows Analysis failed fallback when cross-chapter analysis returns failure with no error', async () => {
    const user = userEvent.setup()
    analyzeEmotionalArcMock.mockResolvedValueOnce({ success: false, error: undefined })

    render(<WritingDashboard text="测试文本" visible={true} chapters={CHAPTERS} />)

    await user.click(screen.getByRole('button', { name: '跨章节' }))

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    })
  })

  // Line 95/102: handleExport/handleExportPdf proceed path (result exists) — calls download functions
  it('exports markdown and pdf when result is available', async () => {
    const user = userEvent.setup()
    analyzeWritingCraftMock.mockResolvedValueOnce({ success: true, data: SINGLE_RESULT })

    render(<WritingDashboard text="测试文本" visible={true} llmConfig={LLM_CONFIG} />)

    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText('综合评分 · 6.5/10')).toBeInTheDocument()
    })

    // Click the markdown export button (identified by title)
    await user.click(screen.getByTitle('导出 Markdown 报告'))
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)

    // Click the PDF export button
    await user.click(screen.getByTitle('导出 PDF 报告'))
    expect(downloadPdfFileMock).toHaveBeenCalledTimes(1)
  })
})
