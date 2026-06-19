import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const sbExtractFromManuscriptMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/story-bible', async () => {
  const actual = await vi.importActual<typeof import('../../api/story-bible')>('../../api/story-bible')
  return {
    ...actual,
    sbExtractFromManuscript: sbExtractFromManuscriptMock,
  }
})

import { AutoExtractButton } from './AutoExtractButton'

const extractionResult = {
  novelId: 'novel-1',
  extracted: [
    {
      id: 'char-1',
      novelId: 'novel-1',
      name: 'Atlas',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.91,
      source: 'auto-extract' as const,
      metadata: {},
      type: 'character' as const,
      archetype: 'hero',
      traits: [],
      motivations: [],
      backstory: '',
      relationships: [],
      speechPatterns: [],
      arcStage: 'setup',
      povAffinity: 0.7,
    },
    {
      id: 'world-1',
      novelId: 'novel-1',
      name: '律法',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.6,
      source: 'auto-extract' as const,
      metadata: {},
      type: 'world-rule' as const,
      category: 'magic',
      description: '规则描述',
      constraints: [],
      exceptions: [],
      impactScope: 'global',
      relatedEntities: [],
    },
    {
      id: 'plot-1',
      novelId: 'novel-1',
      name: '暗线',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.5,
      source: 'auto-extract' as const,
      metadata: {},
      type: 'plot-thread' as const,
      status: 'active',
      premise: 'premise',
      goal: 'goal',
      stakes: 'stakes',
      involvedCharacters: [],
      keyEvents: [],
      foreshadowingRefs: [],
      resolution: null,
    },
    {
      id: 'timeline-1',
      novelId: 'novel-1',
      name: '初遇',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.42,
      source: 'auto-extract' as const,
      metadata: {},
      type: 'timeline-event' as const,
      eventType: 'meeting',
      timestamp: 'chapter-1',
      chapterRef: '1',
      description: 'desc',
      participants: [],
      consequences: [],
      plotThreadRefs: [],
      emotionalImpact: 'high',
    },
  ],
  conflicts: [{ type: 'merge', message: '名称冲突' }],
  confidence: 0.85,
  warnings: ['请检查时间线'],
  timestamp: '2026-06-03T00:00:00.000Z',
}

describe('AutoExtractButton', () => {
  beforeEach(() => {
    sbExtractFromManuscriptMock.mockReset()
  })

  it('respects the disabled state and lets users cancel confirmation', () => {
    const { rerender } = render(
      <AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} disabled />,
    )

    expect(screen.getByRole('button', { name: 'Auto-Extract' })).toBeDisabled()

    rerender(<AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))

    expect(screen.getByText('Auto-Extract Entities')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Auto-Extract Entities')).not.toBeInTheDocument()
  })

  it('shows loading and success summaries, then notifies the caller', async () => {
    sbExtractFromManuscriptMock.mockResolvedValue({
      success: true,
      data: extractionResult,
    })

    const onExtractionComplete = vi.fn()
    const { container } = render(
      <AutoExtractButton novelId="novel-1" onExtractionComplete={onExtractionComplete} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    expect(screen.getByText('Extracting...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Extraction Complete')).toBeInTheDocument()
    })

    expect(sbExtractFromManuscriptMock).toHaveBeenCalledWith('novel-1')
    expect(onExtractionComplete).toHaveBeenCalledWith(extractionResult)
    expect(container.textContent).toContain('1 Characters')
    expect(container.textContent).toContain('1 World Rules')
    expect(container.textContent).toContain('1 Plot Threads')
    expect(container.textContent).toContain('1 Timeline Events')
    expect(container.textContent).toContain('85%')
    expect(screen.getByText('请检查时间线')).toBeInTheDocument()
    expect(screen.getByText('[merge] 名称冲突')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(screen.getByRole('button', { name: 'Auto-Extract' })).toBeInTheDocument()
  })

  it('surfaces api failures, supports retry, and handles thrown errors', async () => {
    sbExtractFromManuscriptMock
      .mockResolvedValueOnce({
        success: false,
        error: 'backend down',
      })
      .mockRejectedValueOnce(new Error('network down'))

    render(<AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    await waitFor(() => {
      expect(screen.getByText('Extraction Failed')).toBeInTheDocument()
    })

    expect(screen.getByText('backend down')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Auto-Extract Entities')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.getByRole('button', { name: 'Auto-Extract' })).toBeInTheDocument()
  })

  it.each([
    { confidence: 0.65, textClass: 'text-blue-400', barClass: 'bg-blue-500' },
    { confidence: 0.35, textClass: 'text-yellow-400', barClass: 'bg-yellow-500' },
    { confidence: 0.2, textClass: 'text-red-400', barClass: 'bg-red-500' },
  ])(
    'renders confidence styles for score $confidence',
    async ({ confidence, textClass, barClass }) => {
      sbExtractFromManuscriptMock.mockResolvedValue({
        success: true,
        data: {
          ...extractionResult,
          confidence,
        },
      })

      const { container } = render(
        <AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))
      fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

      const percentageLabel = `${Math.round(confidence * 100)}%`

      await waitFor(() => {
        expect(screen.getByText(percentageLabel)).toBeInTheDocument()
      })

      expect(screen.getByText(percentageLabel)).toHaveClass(textClass)
      expect(
        container.querySelector(`[style="width: ${Math.round(confidence * 100)}%;"]`),
      ).toHaveClass(barClass)
    },
  )

  it('shows zero counts for missing entity types and hides empty confidence or notices', async () => {
    sbExtractFromManuscriptMock.mockResolvedValue({
      success: true,
      data: {
        ...extractionResult,
        extracted: [extractionResult.extracted[0]],
        confidence: 0,
        warnings: [],
        conflicts: [],
      },
    })

    const { container } = render(
      <AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    await waitFor(() => {
      expect(screen.getByText('Extraction Complete')).toBeInTheDocument()
    })

    expect(container.textContent).toContain('0 World Rules')
    expect(container.textContent).toContain('0 Plot Threads')
    expect(container.textContent).toContain('0 Timeline Events')
    expect(screen.queryByText('Confidence')).not.toBeInTheDocument()
    expect(screen.queryByText(/\[merge]/)).not.toBeInTheDocument()
  })

  it('falls back to unknown error messages for empty api and thrown failures', async () => {
    sbExtractFromManuscriptMock
      .mockResolvedValueOnce({
        success: false,
        error: '',
      })
      .mockRejectedValueOnce('network down as string')

    render(<AutoExtractButton novelId="novel-1" onExtractionComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Extract' }))
    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    await waitFor(() => {
      expect(screen.getByText('Unknown error occurred')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Extract' }))

    await waitFor(() => {
      expect(screen.getByText('Unknown error occurred')).toBeInTheDocument()
    })
  })
})
