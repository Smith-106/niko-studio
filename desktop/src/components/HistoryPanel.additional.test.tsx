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
    {
      id: 'snap-c',
      timestamp: '2026-06-03T00:10:00.000Z',
      label: 'Draft C',
      fileSize: 4096,
    },
  ]
}

describe('HistoryPanel additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSnapshotsMock.mockResolvedValue({ snapshots: [] })
    diffSnapshotsMock.mockResolvedValue([])
    restoreSnapshotMock.mockResolvedValue(undefined)
    setHistoryState()
  })

  it('returns null when the panel is closed', () => {
    setHistoryState({
      historyPanelOpen: false,
      currentProjectId: null,
      currentChapterId: null,
    })

    const { container } = render(<HistoryPanel />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows empty state without loading snapshots when project context is missing', async () => {
    setHistoryState({
      currentProjectId: null,
      currentChapterId: null,
    })

    render(<HistoryPanel />)

    await waitFor(() => {
      expect(
        screen.getByText(/No snapshots yet\. Auto-saves are created every 5 minutes while editing\./),
      ).toBeInTheDocument()
    })
    expect(listSnapshotsMock).not.toHaveBeenCalled()
  })

  it('cycles selection to the latest two snapshots, renders removed diff, and closes diff view', async () => {
    listSnapshotsMock.mockResolvedValue({ snapshots: buildSnapshots() })
    diffSnapshotsMock.mockResolvedValue([
      {
        type: 'removed',
        lineNumber: 12,
        content: 'Removed line',
      },
    ])

    const { container } = render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Draft A'))
    fireEvent.click(screen.getByText('Draft B'))
    fireEvent.click(screen.getByText('Draft C'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))

    await waitFor(() => {
      expect(diffSnapshotsMock).toHaveBeenCalledWith('project-1', 'chapter-1', 'snap-b', 'snap-c')
    })
    expect(await screen.findByText('Removed line')).toBeInTheDocument()

    const removedLine = await screen.findByText('Removed line')
    const diffRoot = removedLine.closest('.flex.flex-col.h-full')
    const diffCloseButton = diffRoot?.querySelector('button') as HTMLButtonElement | null
    expect(diffCloseButton).toBeTruthy()
    fireEvent.click(diffCloseButton!)

    expect(await screen.findByText('Version History')).toBeInTheDocument()
    expect(screen.getByText('Draft C')).toBeInTheDocument()
  })

  it('falls back to no differences when diff loading fails', async () => {
    listSnapshotsMock.mockResolvedValue({
      snapshots: buildSnapshots().slice(0, 2),
    })
    diffSnapshotsMock.mockRejectedValueOnce(new Error('diff failed'))

    render(<HistoryPanel />)

    expect(await screen.findByText('Draft A')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Draft A'))
    fireEvent.click(screen.getByText('Draft B'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected' }))

    expect(await screen.findByText('Loading diff...')).toBeInTheDocument()
    expect(await screen.findByText('No differences')).toBeInTheDocument()
  })

  it('toggles personalized craft and supports restore cancel and confirm flows', async () => {
    listSnapshotsMock.mockResolvedValue({
      snapshots: buildSnapshots().slice(0, 1),
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
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1]!)
      expect(useAppStore.getState().personalizedCraftEnabled).toBe(false)

      fireEvent.click(screen.getByTitle('Restore this snapshot'))
      expect(await screen.findByText('Restore Snapshot')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => {
        expect(screen.queryByText('Restore Snapshot')).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Restore this snapshot'))
      fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))

      await waitFor(() => {
        expect(restoreSnapshotMock).toHaveBeenCalledWith('project-1', 'chapter-1', 'snap-a')
      })
      expect(reloadSpy).toHaveBeenCalledOnce()
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    }
  })
})
