import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { useAppStore } from '../stores/appStore'
import { HistoryPanel } from './HistoryPanel'

const listSnapshotsMock = vi.hoisted(() => vi.fn())
const diffSnapshotsMock = vi.hoisted(() => vi.fn())
const restoreSnapshotMock = vi.hoisted(() => vi.fn())

vi.mock('../services/versionService', () => ({
  listSnapshots: listSnapshotsMock,
  diffSnapshots: diffSnapshotsMock,
  restoreSnapshot: restoreSnapshotMock,
}))

describe('HistoryPanel session intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSnapshotsMock.mockResolvedValue({ snapshots: [] })
    diffSnapshotsMock.mockResolvedValue([])
    restoreSnapshotMock.mockResolvedValue(undefined)
    useAppStore.setState({
      currentProjectId: 'project-1',
      currentChapterId: 'chapter-1',
      historyPanelOpen: true,
      sessionIntelligenceEnabled: true,
      sessionIntelligenceSummary: '检测到轻微停滞风险。',
      sessionIntelligenceInsights: ['先完成一个最小段落目标。'],
      sessionIntelligenceSessionId: 'session-1',
      personalizedCraftEnabled: true,
      personalizedCraftSummary: '近期重点：character · improving',
      personalizedCraftTrajectory: '近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。',
      personalizedCraftRecommendations: ['优先针对角色动机与冲突可见性做小范围修订。'],
    })
  })

  it('renders and toggles the session intelligence summary block', async () => {
    render(<HistoryPanel />)

    expect(await screen.findByText('检测到轻微停滞风险。')).toBeInTheDocument()
    expect(screen.getByText('Session: session-1')).toBeInTheDocument()
    expect(screen.getByText('先完成一个最小段落目标。')).toBeInTheDocument()
    expect(screen.getByText('近期重点：character · improving')).toBeInTheDocument()
    expect(screen.getByText(/Trajectory:/)).toBeInTheDocument()
    expect(screen.getByText('优先针对角色动机与冲突可见性做小范围修订。')).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]!)
    expect(useAppStore.getState().sessionIntelligenceEnabled).toBe(false)
  })

  it('loads snapshots and compares two selected versions in the diff view', async () => {
    listSnapshotsMock.mockResolvedValue({
      snapshots: [
        {
          id: 'snap-a',
          timestamp: '2026-06-03T00:00:00.000Z',
          label: 'Draft A',
          fileSize: 1024,
        },
        {
          id: 'snap-b',
          timestamp: '2026-06-03T00:05:00.000Z',
          label: 'Draft B',
          fileSize: 2048,
        },
      ],
    })
    diffSnapshotsMock.mockResolvedValue([
      {
        type: 'added',
        lineNumber: 7,
        content: 'Added line',
      },
    ])

    render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()
    expect(screen.getByText('Draft B')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Draft A'))
    fireEvent.click(screen.getByText('Draft B'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))

    await waitFor(() => {
      expect(diffSnapshotsMock).toHaveBeenCalledWith('project-1', 'chapter-1', 'snap-a', 'snap-b')
    })
    expect(await screen.findByText('Added line')).toBeInTheDocument()
  })
})
