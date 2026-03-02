import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvaluationPanel } from './EvaluationPanel'

vi.mock('../api/client', () => ({
  evaluateContent: vi.fn(),
  createCheckpoint: vi.fn(),
  listCheckpoints: vi.fn(),
  restoreCheckpoint: vi.fn(),
  applyRecommendation: vi.fn(),
  undoRecommendation: vi.fn(),
  batchApplyRecommendations: vi.fn(),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: () => ({
    addMessage: vi.fn(),
  }),
}))

import {
  applyRecommendation,
  batchApplyRecommendations,
  createCheckpoint,
  evaluateContent,
  listCheckpoints,
  restoreCheckpoint,
  undoRecommendation,
} from '../api/client'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedApplyRecommendation = vi.mocked(applyRecommendation)
const mockedUndoRecommendation = vi.mocked(undoRecommendation)
const mockedBatchApplyRecommendations = vi.mocked(batchApplyRecommendations)

describe('EvaluationPanel actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockedEvaluateContent.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 72,
        lock_score: 24,
        style_score: 24,
        logic_score: 24,
        actionable_feedback: '补强冲突推进',
        suggestions: [
          { id: 'rec-01', title: '增加冲突', reason: '提升张力', action: 'apply' },
          { id: 'rec-02', title: '收束视角', reason: '保证一致', action: 'apply' },
        ],
      },
    })

    mockedListCheckpoints.mockResolvedValue({ success: true, data: [] })
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
  })

  it('supports apply and undo flow for a single suggestion', async () => {
    mockedApplyRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'applied',
        message: 'recommendation applied',
      },
    })

    mockedUndoRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'undone',
        message: 'recommendation undone',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText('改进建议')
    expect(mockedEvaluateContent).toHaveBeenCalledWith(
      '测试内容',
      undefined,
      undefined,
      expect.objectContaining({
        naturalness: 80,
        readability: 80,
        coherence: 80,
        style_consistency: 80,
      })
    )

    const applyButtons = await screen.findAllByRole('button', { name: 'apply' })
    await userEvent.click(applyButtons[0])

    await waitFor(() => {
      expect(mockedApplyRecommendation).toHaveBeenCalledWith(
        '测试内容',
        expect.objectContaining({ id: 'rec-01' })
      )
      expect(screen.getByText('recommendation applied')).toBeInTheDocument()
    })

    const undoButtons = await screen.findAllByRole('button', { name: 'undo' })
    await userEvent.click(undoButtons[0])

    await waitFor(() => {
      expect(mockedUndoRecommendation).toHaveBeenCalledWith(
        '测试内容',
        expect.objectContaining({ id: 'rec-01' })
      )
      expect(screen.getByText('recommendation undone')).toBeInTheDocument()
    })
  })

  it('supports batch apply and batch undo flow', async () => {
    mockedBatchApplyRecommendations.mockResolvedValue({
      success: true,
      data: {
        total: 2,
        applied: 2,
        undone: 0,
        failed: 0,
        results: [
          {
            recommendation_id: 'rec-01',
            status: 'applied',
            message: 'recommendation applied',
          },
          {
            recommendation_id: 'rec-02',
            status: 'applied',
            message: 'recommendation applied',
          },
        ],
      },
    })

    mockedUndoRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'undone',
        message: 'recommendation undone',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText('改进建议')

    await userEvent.click(screen.getByRole('button', { name: '批量应用' }))

    await waitFor(() => {
      expect(mockedBatchApplyRecommendations).toHaveBeenCalledWith(
        '测试内容',
        expect.arrayContaining([
          expect.objectContaining({ id: 'rec-01' }),
          expect.objectContaining({ id: 'rec-02' }),
        ])
      )
      expect(screen.getByText('批量结果：成功 2，失败 0')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: '批量撤销' }))

    await waitFor(() => {
      expect(mockedUndoRecommendation).toHaveBeenCalledTimes(2)
      expect(screen.getByText('批量撤销结果：成功 2，失败 0')).toBeInTheDocument()
    })
  })
})
