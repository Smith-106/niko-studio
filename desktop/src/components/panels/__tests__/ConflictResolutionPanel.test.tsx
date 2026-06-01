import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConflictResolutionPanel } from '../ConflictResolutionPanel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@/api/transport', () => ({
  isTauriRuntime: vi.fn(() => true),
}))

vi.mock('@/stores/knowledgeGraphStore', () => ({
  useKnowledgeGraphStore: vi.fn(() => ({
    obsidianVaultPath: '/test/vault',
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const conflictItems = [
  { id: 'conflict-1', note_path: 'notes/chapter1.md', detected_at: 1700000000000 },
  { id: 'conflict-2', note_path: 'notes/chapter2.md', detected_at: 1700000001000 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictResolutionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: load conflicts returns items
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return Promise.resolve(conflictItems)
      }
      if (cmd === 'get_conflict_content') {
        return Promise.resolve({
          vault: 'Vault version content',
          knowledge: 'Knowledge version content',
        })
      }
      if (cmd === 'resolve_sync_conflict') {
        return Promise.resolve()
      }
      return Promise.resolve()
    })
  })

  // ---------------------------------------------------------------------------
  // Conflict resolution failure
  // ---------------------------------------------------------------------------

  it('keeps conflict item when resolve_sync_conflict fails', async () => {
    // Make resolve_sync_conflict reject
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return Promise.resolve(conflictItems)
      }
      if (cmd === 'get_conflict_content') {
        return Promise.resolve({
          vault: 'Vault version content',
          knowledge: 'Knowledge version content',
        })
      }
      if (cmd === 'resolve_sync_conflict') {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve()
    })

    render(<ConflictResolutionPanel />)

    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.getByText(/2 个冲突待解决/)).toBeInTheDocument()
    })

    // Click on first conflict to expand
    fireEvent.click(screen.getByText('notes/chapter1.md'))

    // Wait for content to load and buttons to appear
    await waitFor(() => {
      expect(screen.getByText('采用 Vault')).toBeInTheDocument()
    })

    // Click resolve button
    fireEvent.click(screen.getByText('采用 Vault'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'resolve_sync_conflict',
        expect.objectContaining({
          id: 'conflict-1',
          resolution: 'vault-wins',
        }),
      )
    })

    // The conflict should still be displayed (not removed on failure)
    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
      expect(screen.getByText(/2 个冲突待解决/)).toBeInTheDocument()
    })
  })

  it('removes conflict item when resolve_sync_conflict succeeds', async () => {
    render(<ConflictResolutionPanel />)

    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.getByText(/2 个冲突待解决/)).toBeInTheDocument()
    })

    // Click on first conflict to expand
    fireEvent.click(screen.getByText('notes/chapter1.md'))

    // Wait for content and buttons
    await waitFor(() => {
      expect(screen.getByText('采用 Vault')).toBeInTheDocument()
    })

    // Click resolve
    fireEvent.click(screen.getByText('采用 Vault'))

    await waitFor(() => {
      // Conflict count should decrease
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    // First conflict should be gone
    expect(screen.queryByText('notes/chapter1.md')).not.toBeInTheDocument()
    // Second conflict should remain
    expect(screen.getByText('notes/chapter2.md')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  it('shows empty state when no conflicts exist', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return Promise.resolve([])
      }
      return Promise.resolve()
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('无同步冲突')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Conflict list
  // ---------------------------------------------------------------------------

  it('displays all conflict items', async () => {
    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
      expect(screen.getByText('notes/chapter2.md')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Content loading on select
  // ---------------------------------------------------------------------------

  it('loads and displays conflict content when a conflict is selected', async () => {
    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
    })

    // Click to select
    fireEvent.click(screen.getByText('notes/chapter1.md'))

    await waitFor(() => {
      expect(screen.getByText('Vault 版本')).toBeInTheDocument()
      expect(screen.getByText('Niko Studio 版本')).toBeInTheDocument()
    })

    expect(screen.getByText('Vault version content')).toBeInTheDocument()
    expect(screen.getByText('Knowledge version content')).toBeInTheDocument()
  })

  it('clears content when selected conflict is deselected', async () => {
    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
    })

    // Click to select
    fireEvent.click(screen.getByText('notes/chapter1.md'))

    await waitFor(() => {
      expect(screen.getByText('Vault 版本')).toBeInTheDocument()
    })

    // Click again to deselect
    fireEvent.click(screen.getByText('notes/chapter1.md'))

    await waitFor(() => {
      expect(screen.queryByText('Vault 版本')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Both resolution directions
  // ---------------------------------------------------------------------------

  it('calls resolve with knowledge-wins when adopt Niko button is clicked', async () => {
    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('notes/chapter1.md'))

    await waitFor(() => {
      expect(screen.getByText('采用 Niko')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('采用 Niko'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'resolve_sync_conflict',
        expect.objectContaining({
          id: 'conflict-1',
          resolution: 'knowledge-wins',
        }),
      )
    })
  })
})
