import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
    sessionIntelligenceEnabled: true,
    sessionIntelligenceSummary: 'Session insight summary',
    sessionIntelligenceInsights: ['First insight'],
    sessionIntelligenceSessionId: 'session-1',
    personalizedCraftEnabled: true,
    personalizedCraftSummary: 'Craft summary',
    personalizedCraftTrajectory: 'Trajectory note',
    personalizedCraftRecommendations: ['Craft recommendation'],
    ...overrides,
  })
}

describe('HistoryPanel branch-gap coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSnapshotsMock.mockResolvedValue({ snapshots: [] })
    diffSnapshotsMock.mockResolvedValue([])
    restoreSnapshotMock.mockResolvedValue(undefined)
    setHistoryState()
  })

  it('renders RestoreConfirmDialog without label when snapshot.label is null', async () => {
    listSnapshotsMock.mockResolvedValue({
      snapshots: [
        {
          id: 'snap-nolabel',
          timestamp: '2026-06-03T01:00:00.000Z',
          label: null as unknown as string,
          fileSize: 512,
        },
      ],
    })

    render(<HistoryPanel />)

    expect(await screen.findByText(/0\.5 KB/)).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Restore this snapshot'))

    expect(await screen.findByText('Restore Snapshot')).toBeInTheDocument()
    const dialogText = screen.getByText(/Restore to snapshot from/)
    expect(dialogText.textContent).not.toContain('(')
    expect(dialogText.textContent).toMatch(/Restore to snapshot from \d{4}-\d{2}-\d{2} \d{2}:\d{2}\?/)
  })

  it('returns early from handleCompare when fewer than 2 snapshots are selected', async () => {
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

    render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Draft A'))

    expect(screen.queryByRole('button', { name: 'Compare selected' })).not.toBeInTheDocument()
    expect(diffSnapshotsMock).not.toHaveBeenCalled()
  })

  it('skips restore when currentProjectId is null after confirm dialog opens', async () => {
    listSnapshotsMock.mockResolvedValue({
      snapshots: [
        {
          id: 'snap-a',
          timestamp: '2026-06-03T00:00:00.000Z',
          label: 'Draft A',
          fileSize: 1024,
        },
      ],
    })

    const originalLocation = window.location
    const reloadSpy = vi.fn()
    delete (window as unknown as { location?: Location }).location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadSpy },
      writable: true,
      configurable: true,
    })

    try {
      render(<HistoryPanel />)

      expect(await screen.findByText('Draft A')).toBeInTheDocument()
      fireEvent.click(screen.getByTitle('Restore this snapshot'))
      expect(await screen.findByText('Restore Snapshot')).toBeInTheDocument()

      act(() => {
        setHistoryState({ currentProjectId: null })
      })

      // Wait for re-render to propagate the new handleRestore closure
      await screen.findByText('Restore Snapshot')

      fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

      await waitFor(() => {
        expect(restoreSnapshotMock).not.toHaveBeenCalled()
      })
      expect(reloadSpy).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    }
  })
})
