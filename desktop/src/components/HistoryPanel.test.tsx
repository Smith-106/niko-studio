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
    })
  })

  it('renders and toggles the session intelligence summary block', async () => {
    render(<HistoryPanel />)

    expect(await screen.findByText('检测到轻微停滞风险。')).toBeInTheDocument()
    expect(screen.getByText('Session: session-1')).toBeInTheDocument()
    expect(screen.getByText('先完成一个最小段落目标。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(useAppStore.getState().sessionIntelligenceEnabled).toBe(false)
  })
})
