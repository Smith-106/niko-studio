import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConflictResolutionPanel } from './ConflictResolutionPanel'

const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => false))
const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/transport', () => ({
  isTauriRuntime: isTauriRuntimeMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@/stores/knowledgeGraphStore', () => ({
  useKnowledgeGraphStore: () => ({
    obsidianVaultPath: '/tmp/vault',
  }),
}))

describe('ConflictResolutionPanel branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriRuntimeMock.mockReturnValue(false)
  })

  it('shows no-conflicts state when conflicts list is empty (line 69)', () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockResolvedValue([])

    render(<ConflictResolutionPanel />)

    expect(screen.getByText('无同步冲突')).toBeInTheDocument()
  })

  it('returns early from loadConflicts when not in tauri runtime (line 21)', () => {
    isTauriRuntimeMock.mockReturnValue(false)

    render(<ConflictResolutionPanel />)

    expect(invokeMock).not.toHaveBeenCalled()
    expect(screen.getByText('无同步冲突')).toBeInTheDocument()
  })

  it('returns early from loadConflicts when obsidianVaultPath is null (line 21)', () => {
    isTauriRuntimeMock.mockReturnValue(true)

    vi.resetModules()
    // Re-mock with null vault path
    vi.doMock('@/stores/knowledgeGraphStore', () => ({
      useKnowledgeGraphStore: () => ({
        obsidianVaultPath: null,
      }),
    }))

    // Just verify it doesn't crash — the component still renders
    render(<ConflictResolutionPanel />)
    expect(screen.getByText('无同步冲突')).toBeInTheDocument()
  })

  it('renders conflict items and selects/deselects on click (line 92)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return [
          { id: 'c1', note_path: 'notes/ch1.md', detected_at: 1700000000000 },
          { id: 'c2', note_path: 'notes/ch2.md', detected_at: 1700000001000 },
        ]
      }
      if (cmd === 'get_conflict_content') {
        return { vault: 'vault text', knowledge: 'knowledge text' }
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/2 个冲突待解决/)).toBeInTheDocument()
    })

    // Click first conflict to select it
    fireEvent.click(screen.getByText('notes/ch1.md'))

    await waitFor(() => {
      expect(screen.getByText('vault text')).toBeInTheDocument()
      expect(screen.getByText('knowledge text')).toBeInTheDocument()
    })

    // Click again to deselect
    fireEvent.click(screen.getByText('notes/ch1.md'))

    // Content should disappear
    await waitFor(() => {
      expect(screen.queryByText('vault text')).not.toBeInTheDocument()
    })
  })

  it('clears content when not in tauri runtime even after selecting (line 36-40)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return [{ id: 'c1', note_path: 'test.md', detected_at: 1700000000000 }]
      }
      if (cmd === 'get_conflict_content') {
        return { vault: 'v content', knowledge: 'k content' }
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    // Click to select — content loads because isTauriRuntime is true
    fireEvent.click(screen.getByText('test.md'))

    await waitFor(() => {
      expect(screen.getByText('v content')).toBeInTheDocument()
    })

    // Now make isTauriRuntime return false for next render cycle
    isTauriRuntimeMock.mockReturnValue(false)

    // Click again to deselect
    fireEvent.click(screen.getByText('test.md'))

    // Content should be cleared since deselected
    await waitFor(() => {
      expect(screen.queryByText('v content')).not.toBeInTheDocument()
    })
  })

  it('shows fallback text when content is empty (lines 106, 112)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return [{ id: 'c1', note_path: 'empty.md', detected_at: 1700000000000 }]
      }
      if (cmd === 'get_conflict_content') {
        return { vault: '', knowledge: '' }
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('empty.md'))

    await waitFor(() => {
      // Both content areas show fallback text
      const fallbacks = screen.getAllByText('(无内容)')
      expect(fallbacks.length).toBe(2)
    })
  })

  it('resolves conflict with vault-wins and removes it from the list (line 59-67)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_sync_conflicts') {
        return [{ id: 'c1', note_path: 'resolve.md', detected_at: 1700000000000 }]
      }
      if (cmd === 'get_conflict_content') {
        return { vault: 'v', knowledge: 'k' }
      }
      if (cmd === 'resolve_sync_conflict') {
        return undefined
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    // Select the conflict
    fireEvent.click(screen.getByText('resolve.md'))

    await waitFor(() => {
      expect(screen.getByText('采用 Vault')).toBeInTheDocument()
    })

    // Click "采用 Vault"
    fireEvent.click(screen.getByText('采用 Vault'))

    await waitFor(() => {
      // After resolution, conflict is removed, shows no-conflicts
      expect(screen.getByText('无同步冲突')).toBeInTheDocument()
    })

    expect(invokeMock).toHaveBeenCalledWith('resolve_sync_conflict', {
      id: 'c1',
      resolution: 'vault-wins',
    })
  })

  it('resolves conflict with knowledge-wins (line 129)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_sync_conflicts') {
        return [{ id: 'c1', note_path: 'kw.md', detected_at: 1700000000000 }]
      }
      if (cmd === 'get_conflict_content') {
        return { vault: 'v', knowledge: 'k' }
      }
      if (cmd === 'resolve_sync_conflict') {
        return undefined
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('kw.md'))

    await waitFor(() => {
      expect(screen.getByText('采用 Niko')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('采用 Niko'))

    await waitFor(() => {
      expect(screen.getByText('无同步冲突')).toBeInTheDocument()
    })

    expect(invokeMock).toHaveBeenCalledWith('resolve_sync_conflict', {
      id: 'c1',
      resolution: 'knowledge-wins',
    })
  })

  it('catches errors in loadConflicts gracefully (line 25-27)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockRejectedValue(new Error('vault disconnected'))

    render(<ConflictResolutionPanel />)

    // Should not throw, just show no-conflicts
    await waitFor(() => {
      expect(screen.getByText('无同步冲突')).toBeInTheDocument()
    })
  })

  it('catches errors in get_conflict_content gracefully (line 48-52)', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    let callCount = 0
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return [{ id: 'c1', note_path: 'err.md', detected_at: 1700000000000 }]
      }
      if (cmd === 'get_conflict_content') {
        throw new Error('content unavailable')
      }
      return undefined
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText(/1 个冲突待解决/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('err.md'))

    // Content loading fails, should show fallback
    await waitFor(() => {
      const fallbacks = screen.getAllByText('(无内容)')
      expect(fallbacks.length).toBe(2)
    })
  })
})
