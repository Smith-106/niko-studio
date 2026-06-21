import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ConsensusReport } from '../../api/reader'
import type { OverlayMarker } from '../../types/reader'

import { DetailPanel } from './DetailPanel'

const selectedMarker: OverlayMarker = {
  id: 'marker-1',
  type: 'consensus',
  dimension: 'Plot Coherence',
  severity: 'high',
  description: '伏笔断裂',
  position: { chapterId: 'chapter-3', paragraphIndex: 4 },
  personaCount: 3,
  consensusStrength: 0.85,
  personaIds: ['hero', 'critic', 'reader'],
}

const matchedReport: ConsensusReport = {
  items: [
    {
      description: '伏笔断裂',
      dimension: 'Plot Coherence',
      agreeingPersonas: ['hero', 'reader'],
      disagreeingPersonas: ['critic'],
      severity: 'high',
      consensusStrength: 0.85,
      location: { chapter: 'chapter-3', paragraph: 4 },
    },
  ],
  overallAssessment: '整体存在关键伏笔问题',
  criticalIssues: [],
  dissentItems: [],
  dimensionSummaries: {
    'Plot Coherence': { avgScore: 0.58, consensus: 0.72 },
  },
}

const overviewReport: ConsensusReport = {
  items: [],
  overallAssessment: '整体需要先修关键问题，再进行细节润色',
  criticalIssues: [
    {
      description: '问题一',
      dimension: 'Plot',
      agreeingPersonas: ['a'],
      disagreeingPersonas: [],
      severity: 'critical',
      consensusStrength: 0.91,
      location: {},
    },
    {
      description: '问题二',
      dimension: 'Style',
      agreeingPersonas: ['a'],
      disagreeingPersonas: [],
      severity: 'high',
      consensusStrength: 0.8,
      location: {},
    },
    {
      description: '问题三',
      dimension: 'Character',
      agreeingPersonas: ['a'],
      disagreeingPersonas: [],
      severity: 'high',
      consensusStrength: 0.76,
      location: {},
    },
    {
      description: '问题四',
      dimension: 'Pacing & Tension',
      agreeingPersonas: ['a'],
      disagreeingPersonas: [],
      severity: 'high',
      consensusStrength: 0.74,
      location: {},
    },
  ],
  dissentItems: [
    {
      description: '存在审美分歧',
      dimension: 'Style',
      agreeingPersonas: ['reader'],
      disagreeingPersonas: ['critic'],
      severity: 'medium',
      consensusStrength: 0.4,
      location: {},
    },
    {
      description: '角色理解不一',
      dimension: 'Character',
      agreeingPersonas: ['reader'],
      disagreeingPersonas: ['critic'],
      severity: 'medium',
      consensusStrength: 0.45,
      location: {},
    },
  ],
  dimensionSummaries: {
    Plot: { avgScore: 0.62, consensus: 0.88 },
    Style: { avgScore: 0.47, consensus: 0.51 },
  },
}

describe('DetailPanel', () => {
  it('renders the empty state when nothing is selected and still supports closing', () => {
    const onClose = vi.fn()

    render(<DetailPanel selectedItem={null} consensusReport={null} onClose={onClose} />)

    expect(screen.getByRole('region', { name: '读者模拟详情面板' })).toHaveClass(
      'translate-x-full',
    )
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
    expect(screen.getByText('点击标记查看详情')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '关闭面板' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders selected marker details with consensus personas and location data', () => {
    render(
      <DetailPanel
        selectedItem={selectedMarker}
        consensusReport={matchedReport}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('标记详情')).toBeInTheDocument()
    expect(screen.getByText('情节连贯')).toBeInTheDocument()
    expect(screen.getByText('问题描述')).toBeInTheDocument()
    expect(screen.getByText('伏笔断裂')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('同意角色 (2)')).toBeInTheDocument()
    expect(screen.getByText('反对角色 (1)')).toBeInTheDocument()
    expect(screen.getByText('章节: chapter-3')).toBeInTheDocument()
    expect(screen.getByText('段落: 5')).toBeInTheDocument()
  })

  it('falls back to marker persona ids when there is no matching consensus item', () => {
    render(
      <DetailPanel
        selectedItem={{
          ...selectedMarker,
          type: 'dissent',
          dimension: 'Style',
          severity: 'medium',
          description: '措辞风格分裂',
          position: {},
          personaIds: ['editor', 'reader'],
        }}
        consensusReport={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('风格')).toBeInTheDocument()
    expect(screen.getByText('涉及角色 (2)')).toBeInTheDocument()
    expect(screen.getByText('editor')).toBeInTheDocument()
    expect(screen.getByText('reader')).toBeInTheDocument()
  })

  it('shows the overview report with summaries, counts, and critical issue preview truncation', () => {
    render(<DetailPanel selectedItem={null} consensusReport={overviewReport} onClose={vi.fn()} />)

    expect(screen.getByText('共识概览')).toBeInTheDocument()
    expect(screen.getByText('整体需要先修关键问题，再进行细节润色')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('维度概览')).toBeInTheDocument()
    expect(screen.getByText('关键问题预览')).toBeInTheDocument()
    expect(screen.getByText('还有 1 个关键问题...')).toBeInTheDocument()
  })

  it('renders alternate strength bar colors and high score styling', () => {
    const { container, rerender } = render(
      <DetailPanel
        selectedItem={{ ...selectedMarker, consensusStrength: 0.45 }}
        consensusReport={matchedReport}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('[style="width: 45%;"]')).toHaveClass('bg-orange-500')

    rerender(
      <DetailPanel
        selectedItem={{ ...selectedMarker, consensusStrength: 0.65 }}
        consensusReport={matchedReport}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('[style="width: 65%;"]')).toHaveClass('bg-yellow-500')

    rerender(
      <DetailPanel
        selectedItem={{ ...selectedMarker, consensusStrength: 0.25 }}
        consensusReport={matchedReport}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('[style="width: 25%;"]')).toHaveClass('bg-red-500')

    rerender(
      <DetailPanel
        selectedItem={null}
        consensusReport={{
          ...overviewReport,
          criticalIssues: [],
          dimensionSummaries: {
            Emotion: { avgScore: 0.91, consensus: 0.95 },
          },
        }}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('.text-green-400.font-mono')).toHaveTextContent('91')
  })

  it('renders no inner content when both props are undefined at runtime', () => {
    const { container } = render(
      <DetailPanel
        selectedItem={undefined as unknown as OverlayMarker | null}
        consensusReport={undefined as unknown as ConsensusReport | null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: '读者模拟详情面板' })).toHaveClass('translate-x-0')
    expect(container.querySelector('.custom-scrollbar')?.textContent).toBe('')
  })

  it('calls onFeedback with not_helpful and applies the corresponding style', () => {
    const onFeedback = vi.fn()

    render(
      <DetailPanel
        selectedItem={selectedMarker}
        consensusReport={matchedReport}
        onClose={vi.fn()}
        onFeedback={onFeedback}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '无用' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
    expect(onFeedback).toHaveBeenCalledWith(expect.any(String), 'not_helpful')
    expect(screen.getByRole('button', { name: '无用' })).toHaveClass('bg-red-500/20')
  })

  it('calls onFeedback when feedback buttons are clicked and disables further clicks', () => {
    const onFeedback = vi.fn()

    render(
      <DetailPanel
        selectedItem={selectedMarker}
        consensusReport={matchedReport}
        onClose={vi.fn()}
        onFeedback={onFeedback}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '有用' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
    expect(onFeedback).toHaveBeenCalledWith(expect.any(String), 'helpful')
    expect(screen.getByRole('button', { name: '有用' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '无用' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '无用' }))

    expect(onFeedback).toHaveBeenCalledTimes(1)
  })

  it('falls back to raw dimension labels when no localized label exists', () => {
    const { rerender } = render(
      <DetailPanel
        selectedItem={{
          ...selectedMarker,
          dimension: 'Theme',
          description: '主题冲突',
        }}
        consensusReport={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Theme')).toBeInTheDocument()

    rerender(
      <DetailPanel
        selectedItem={null}
        consensusReport={{
          ...overviewReport,
          criticalIssues: [
            {
              description: '主题割裂',
              dimension: 'Theme',
              agreeingPersonas: ['reader'],
              disagreeingPersonas: [],
              severity: 'medium',
              consensusStrength: 0.61,
              location: {},
            },
          ],
          dimensionSummaries: {
            Theme: { avgScore: 0.61, consensus: 0.44 },
          },
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Theme').length).toBeGreaterThanOrEqual(2)
  })
})
