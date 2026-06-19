import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const analyzeWritingCraftLLMMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/writing-craft', async () => {
  const actual = await vi.importActual<typeof import('../../api/writing-craft')>('../../api/writing-craft')
  return {
    ...actual,
    analyzeWritingCraftLLM: analyzeWritingCraftLLMMock,
  }
})

import { analyzeWritingCraftLLM, type DimensionResult, type LLMConfig } from '../../api/writing-craft'
import { WritingDimensionDetail } from './WritingDimensionDetail'

const mockedAnalyzeWritingCraftLLM = vi.mocked(analyzeWritingCraftLLM)

const LLM_CONFIG: LLMConfig = {
  api_key: 'test-key',
  base_url: 'https://example.test',
  model: 'gpt-test',
}

function buildDimension(overrides: Partial<DimensionResult> = {}): DimensionResult {
  return {
    dimension: 'character',
    label: 'Character',
    score: 9,
    maxScore: 10,
    evidence: ['Evidence A'],
    suggestions: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    details: {
      antiPatternHealth: 6,
      criticalAntiPatterns: 1,
    },
    ...overrides,
  }
}

describe('WritingDimensionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders score bands, evidence, and caps visible suggestions at five items', () => {
    const { rerender } = render(
      <WritingDimensionDetail
        dimension={buildDimension({ score: 9 })}
        text="Sample draft"
        llmConfig={LLM_CONFIG}
      />,
    )

    expect(screen.getByText(/9\/10/)).toBeInTheDocument()
    expect(screen.getByText('Evidence A')).toBeInTheDocument()
    expect(screen.getByText('S5')).toBeInTheDocument()
    expect(screen.queryByText('S6')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI/ })).toBeInTheDocument()

    rerender(<WritingDimensionDetail dimension={buildDimension({ score: 7 })} />)
    expect(screen.getByText(/7\/10/)).toBeInTheDocument()

    rerender(<WritingDimensionDetail dimension={buildDimension({ score: 5 })} />)
    expect(screen.getByText(/5\/10/)).toBeInTheDocument()

    rerender(<WritingDimensionDetail dimension={buildDimension({ score: 3 })} />)
    expect(screen.getByText(/3\/10/)).toBeInTheDocument()
  })

  it('runs deep analysis, shows loading state, and renders returned analysis', async () => {
    const user = userEvent.setup()
    let resolveRequest: ((value: Awaited<ReturnType<typeof analyzeWritingCraftLLM>>) => void) | null = null
    mockedAnalyzeWritingCraftLLM.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    render(
      <WritingDimensionDetail
        dimension={buildDimension({
          suggestions: [],
        })}
        text="Draft paragraph"
        llmConfig={LLM_CONFIG}
      />,
    )

    await user.click(screen.getByRole('button', { name: /AI/ }))

    expect(mockedAnalyzeWritingCraftLLM).toHaveBeenCalledWith(
      'Draft paragraph',
      LLM_CONFIG,
      ['character'],
    )
    expect(screen.getByRole('button')).toBeDisabled()

    resolveRequest?.({
      success: true,
      data: {
        source: 'llm',
        overallScore: 88,
        textLength: 1200,
        dimensions: [
          buildDimension({
            suggestions: ['LLM suggestion'],
            details: { analysis: 'Deep analysis insight' },
          }),
        ],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Deep analysis insight')).toBeInTheDocument()
    })
    expect(screen.getByText('LLM suggestion')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('keeps AI analysis hidden when the returned dimension is missing or lacks analysis text', async () => {
    const user = userEvent.setup()
    mockedAnalyzeWritingCraftLLM
      .mockResolvedValueOnce({
        success: true,
        data: {
          source: 'llm',
          overallScore: 77,
          textLength: 640,
          dimensions: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          source: 'llm',
          overallScore: 79,
          textLength: 720,
          dimensions: [
            buildDimension({
              suggestions: ['Only suggestion'],
              details: {},
            }),
          ],
        },
      })

    const { rerender } = render(
      <WritingDimensionDetail
        dimension={buildDimension({
          suggestions: [],
        })}
        text="Draft paragraph"
        llmConfig={LLM_CONFIG}
      />,
    )

    await user.click(screen.getByRole('button', { name: /AI/ }))

    await waitFor(() => {
      expect(mockedAnalyzeWritingCraftLLM).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText('AI 鍒嗘瀽')).not.toBeInTheDocument()
    expect(screen.queryByText('Only suggestion')).not.toBeInTheDocument()

    rerender(
      <WritingDimensionDetail
        dimension={buildDimension({
          suggestions: [],
        })}
        text="Second draft paragraph"
        llmConfig={LLM_CONFIG}
      />,
    )

    await user.click(screen.getByRole('button', { name: /AI/ }))

    await waitFor(() => {
      expect(mockedAnalyzeWritingCraftLLM).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('button', { name: /AI/ })).toBeInTheDocument()
    expect(screen.queryByText('Only suggestion')).not.toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })

  it('shows fallback analysis text when deep analysis throws', async () => {
    const user = userEvent.setup()
    mockedAnalyzeWritingCraftLLM.mockRejectedValueOnce(new Error('boom'))

    render(
      <WritingDimensionDetail
        dimension={buildDimension()}
        text="Draft paragraph"
        llmConfig={LLM_CONFIG}
      />,
    )

    await user.click(screen.getByRole('button', { name: /AI/ }))

    await waitFor(() => {
      expect(screen.getByText(/LLM/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('omits AI controls when text or llm config is missing', () => {
    const { rerender } = render(
      <WritingDimensionDetail
        dimension={buildDimension()}
        text="Draft paragraph"
      />,
    )

    expect(screen.queryByRole('button', { name: /AI/ })).not.toBeInTheDocument()

    rerender(
      <WritingDimensionDetail
        dimension={buildDimension()}
        llmConfig={LLM_CONFIG}
      />,
    )

    expect(screen.queryByRole('button', { name: /AI/ })).not.toBeInTheDocument()
  })
})
