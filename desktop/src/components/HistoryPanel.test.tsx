import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useAppStore } from '../stores/appStore'
import { HistoryPanel } from './HistoryPanel'

vi.mock('../services/versionService', () => ({
  listSnapshots: vi.fn(() => Promise.resolve({ snapshots: [] })),
  diffSnapshots: vi.fn(() => Promise.resolve([])),
  restoreSnapshot: vi.fn(() => Promise.resolve()),
}))

describe('HistoryPanel session intelligence', () => {
  beforeEach(() => {
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
})
