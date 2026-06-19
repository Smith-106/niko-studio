import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
const openMock = vi.hoisted(() => vi.fn())
const setVaultPathMock = vi.hoisted(() => vi.fn())
const setSyncStatusMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}))

vi.mock('@/stores/knowledgeGraphStore', () => ({
  useKnowledgeGraphStore: () => ({
    obsidianVaultPath: '/vaults/current',
    setVaultPath: setVaultPathMock,
    setSyncStatus: setSyncStatusMock,
  }),
}))

import { VaultSelector } from './VaultSelector'

describe('VaultSelector', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    openMock.mockReset()
    setVaultPathMock.mockReset()
    setSyncStatusMock.mockReset()
  })

  it('discovers vaults, selects one, refreshes, and supports manual browsing', async () => {
    invokeMock.mockImplementation(async (command: string, payload?: Record<string, unknown>) => {
      if (command === 'list_vaults') {
        return [
          {
            path: '/vaults/current',
            name: 'Current Vault',
            has_obsidian_config: true,
          },
          {
            path: '/vaults/manual',
            name: 'Manual Vault',
            has_obsidian_config: false,
          },
        ]
      }
      if (command === 'select_vault') {
        return {
          path: payload?.vaultPath,
          name: 'Selected Vault',
          has_obsidian_config: true,
        }
      }
      return null
    })
    openMock.mockResolvedValue('/vaults/manual')

    render(<VaultSelector />)

    await waitFor(() => {
      expect(screen.getByText('Current Vault')).toBeInTheDocument()
    })
    expect(screen.getByText('非标准')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Manual Vault'))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('select_vault', {
        vaultPath: '/vaults/manual',
      })
    })
    expect(setSyncStatusMock).toHaveBeenCalledWith('syncing')
    expect(setVaultPathMock).toHaveBeenCalledWith('/vaults/manual')
    expect(setSyncStatusMock).toHaveBeenCalledWith('synced')

    fireEvent.click(screen.getByTitle('刷新'))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('list_vaults')
    })

    fireEvent.click(screen.getByRole('button', { name: '手动选择目录' }))
    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith({
        directory: true,
        title: '选择 Obsidian Vault 目录',
      })
    })
  })

  it('surfaces discovery and selection failures', async () => {
    let listCalls = 0
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'list_vaults') {
        listCalls += 1
        if (listCalls === 1) {
          throw new Error('list failed')
        }
        return [
          {
            path: '/vaults/retry',
            name: 'Retry Vault',
            has_obsidian_config: true,
          },
        ]
      }
      if (command === 'select_vault') {
        throw new Error('select failed')
      }
      return null
    })

    render(<VaultSelector />)

    await waitFor(() => {
      expect(screen.getByText('Error: list failed')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('刷新'))
    await waitFor(() => {
      expect(screen.getByText('Retry Vault')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry Vault'))
    await waitFor(() => {
      expect(screen.getByText('Error: select failed')).toBeInTheDocument()
    })
    expect(setSyncStatusMock).toHaveBeenCalledWith('error')
  })
})
