import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockInvoke = vi.fn()
const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => true))
const useKnowledgeGraphStoreMock = vi.hoisted(() => vi.fn(() => ({ obsidianVaultPath: '/test/vault' })))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@/api/transport', () => ({
  isTauriRuntime: isTauriRuntimeMock,
}))

vi.mock('@/stores/knowledgeGraphStore', () => ({
  useKnowledgeGraphStore: useKnowledgeGraphStoreMock,
}))

import { ConflictResolutionPanel } from '../ConflictResolutionPanel'

const conflictItems = [
  { id: 'conflict-1', note_path: 'notes/chapter1.md', detected_at: 1700000000000 },
  { id: 'conflict-2', note_path: 'notes/chapter2.md', detected_at: 1700000001000 },
]

describe('ConflictResolutionPanel additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriRuntimeMock.mockReturnValue(true)
    useKnowledgeGraphStoreMock.mockReturnValue({ obsidianVaultPath: '/test/vault' })
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

  it('falls back to the empty state when loading conflicts throws', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return Promise.reject(new Error('vault unavailable'))
      }
      return Promise.resolve()
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_sync_conflicts', { vaultPath: '/test/vault' })
      expect(screen.getByText('无同步冲突')).toBeInTheDocument()
    })
  })

  it('shows empty conflict content on load failure and closes the expanded row from the dismiss button', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_conflicts') {
        return Promise.resolve(conflictItems)
      }
      if (cmd === 'get_conflict_content') {
        return Promise.reject(new Error('content unavailable'))
      }
      return Promise.resolve()
    })

    render(<ConflictResolutionPanel />)

    await waitFor(() => {
      expect(screen.getByText('notes/chapter1.md')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('notes/chapter1.md'))

    await waitFor(() => {
      expect(screen.getAllByText('(无内容)')).toHaveLength(2)
    })

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(screen.queryByText('Vault 版本')).not.toBeInTheDocument()
    })
  })
})
