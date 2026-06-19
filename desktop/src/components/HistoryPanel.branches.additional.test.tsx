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

function setHistoryState(
  overrides: Partial<ReturnType<typeof useAppStore.getState>> = {},
) {
  useAppStore.setState({
    currentProjectId: 'project-1',
    currentChapterId: 'chapter-1',
    historyPanelOpen: true,
    sessionIntelligenceEnabled: false,
    sessionIntelligenceSummary: '',
    sessionIntelligenceInsights: [],
    sessionIntelligenceSessionId: null,
    personalizedCraftEnabled: false,
    personalizedCraftSummary: '',
    personalizedCraftTrajectory: '',
    personalizedCraftRecommendations: [],
    ...overrides,
  })
}

function buildSnapshots() {
  return [
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
  ]
}

describe('HistoryPanel branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSnapshotsMock.mockResolvedValue({ snapshots: [] })
    diffSnapshotsMock.mockResolvedValue([])
    restoreSnapshotMock.mockResolvedValue(undefined)
    setHistoryState()
  })

  it('renders diff lines with unchanged type (empty bg class)', async () => {
    listSnapshotsMock.mockResolvedValue({ snapshots: buildSnapshots() })
    diffSnapshotsMock.mockResolvedValue([
      {
        type: 'same',
        lineNumber: 1,
        content: 'Unchanged line',
      },
      {
        type: 'added',
        lineNumber: 2,
        content: 'Added line',
      },
    ])

    render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Draft A'))
    fireEvent.click(screen.getByText('Draft B'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))

    await waitFor(() => {
      expect(screen.getByText('Unchanged line')).toBeInTheDocument()
    })
    expect(screen.getByText('Added line')).toBeInTheDocument()
  })

  it('sets snapshots to empty when listSnapshots rejects (line 135)', async () => {
    listSnapshotsMock.mockRejectedValue(new Error('fetch failed'))

    render(<HistoryPanel />)

    // Should show empty state after error
    await waitFor(() => {
      expect(
        screen.getByText(/No snapshots yet/),
      ).toBeInTheDocument()
    })
  })

  it('deselects a snapshot when clicking it again (line 147)', async () => {
    listSnapshotsMock.mockResolvedValue({ snapshots: buildSnapshots() })

    render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()

    // Click Draft A to select it
    fireEvent.click(screen.getByText('Draft A'))

    // Click Draft A again to deselect it
    fireEvent.click(screen.getByText('Draft A'))

    // Draft A should no longer be selected (compare button should not appear)
    expect(screen.queryByRole('button', { name: 'Compare selected' })).not.toBeInTheDocument()
  })
})
