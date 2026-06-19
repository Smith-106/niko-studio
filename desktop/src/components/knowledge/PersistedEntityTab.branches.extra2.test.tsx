import { useState } from 'react'
import { User } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PersistedEntityTab } from './PersistedEntityTab'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import { createDefaultProjectWorkspaceContext } from '../../types/workspace'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'

type PersistedEntity = {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

const persistedGraph = vi.hoisted(() => ({
  characters: [] as PersistedEntity[],
  validateEntityError: null as string | null,
  // Line 119: load error fallback chain `response.error || graphError || copy.loadError`
  loadReturnsGraphError: false, // response.error undefined + graphError truthy
  loadReturnsErrorless: false, // response.error undefined + graphError falsy -> copy.loadError
  // Line 224: save error fallback chain `response.error || graphError || copy.saveError`
  mergeReturnsError: null as string | null, // response.error truthy
  mergeReturnsErrorless: false, // response.error undefined + graphError falsy -> copy.saveError
  mergeGraphError: null as string | null, // response.error undefined + graphError truthy
  // Line 236: saved item with empty workspaceId
  mergeReturnsEmptyWorkspaceId: false,
  mergeReturnsEmpty: false,
  // Line 283: delete error fallback `graphError || 'Delete failed'`
  deleteReturnsErrorless: false, // graphError falsy -> 'Delete failed'
  deleteGraphError: null as string | null, // graphError truthy
  // Line 275: track whether DETACH DELETE was issued
  deleteCalls: 0,
}))

vi.mock('../../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (persistedGraph.validateEntityError && cypher.startsWith('MATCH')) {
      throw new Error(persistedGraph.validateEntityError)
    }

    if (cypher.startsWith('MERGE (n:')) {
      if (persistedGraph.mergeReturnsError) {
        return { success: false, error: persistedGraph.mergeReturnsError, data: [] }
      }
      if (persistedGraph.mergeReturnsErrorless) {
        return { success: false, error: undefined, data: [] }
      }
      if (persistedGraph.mergeGraphError) {
        return { success: true, data: [{ error: persistedGraph.mergeGraphError }] }
      }
      if (persistedGraph.mergeReturnsEmptyWorkspaceId) {
        return {
          success: true,
          data: [{ n: { id: 'saved-1', type: 'Character', name: 'SavedItem', properties: {} } }],
        }
      }
      const nameMatch = /name:\s*'([^']*)'/.exec(cypher)
      const name = nameMatch?.[1] ?? 'Unknown'
      const existing = persistedGraph.characters.find((c) => c.name === name)
      if (existing) {
        existing.updated_at = '2026-06-17T00:00:00.000Z'
        return { success: true, data: persistedGraph.mergeReturnsEmpty ? [] : [{ n: existing }] }
      }
      const newItem = {
        id: `char-${persistedGraph.characters.length + 1}`,
        type: 'Character',
        name,
        properties: { workspaceId: 'default-project', itemKind: 'character', description: '' },
        created_at: '2026-06-17T00:00:00.000Z',
        updated_at: '2026-06-17T00:00:00.000Z',
      }
      persistedGraph.characters.push(newItem)
      return { success: true, data: persistedGraph.mergeReturnsEmpty ? [] : [{ n: newItem }] }
    }

    if (cypher.includes('DETACH DELETE')) {
      persistedGraph.deleteCalls += 1
      if (persistedGraph.deleteReturnsErrorless) {
        return { success: false, error: undefined, data: [] }
      }
      if (persistedGraph.deleteGraphError) {
        return { success: true, data: [{ error: persistedGraph.deleteGraphError }] }
      }
      const nameMatch = /name:\s*'([^']*)'/.exec(cypher)
      if (nameMatch?.[1]) {
        const idx = persistedGraph.characters.findIndex((c) => c.name === nameMatch[1])
        if (idx !== -1) persistedGraph.characters.splice(idx, 1)
      }
      return { success: true, data: [] }
    }

    if (cypher.includes('MATCH (n:Character)')) {
      if (persistedGraph.loadReturnsGraphError) {
        return { success: false, error: undefined, data: [{ error: 'graph row error' }] }
      }
      if (persistedGraph.loadReturnsErrorless) {
        return { success: false, error: undefined, data: [] }
      }
      return { success: true, data: persistedGraph.characters.map((item) => ({ n: item })) }
    }

    // rename queries (MATCH ... SET ...) and any other MATCH fallthrough
    return { success: true, data: [] }
  }),
}))

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('lucide-react', () => ({
  Folder: ({ size }: { size: number }) => <svg data-size={size} />,
  RotateCcw: ({ size }: { size: number }) => <svg data-size={size} />,
  Save: ({ size }: { size: number }) => <svg data-size={size} />,
  Trash2: ({ size }: { size: number }) => <svg data-size={size} />,
  User: ({ size }: { size: number }) => <svg data-size={size} />,
}))

function Harness({
  initialItems = [],
  initialSelectedItem = null,
}: {
  initialItems?: KnowledgeItem[]
  initialSelectedItem?: KnowledgeItem | null
}) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [currentSelectedItem, setCurrentSelectedItem] = useState<KnowledgeItem | null>(initialSelectedItem)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      <PersistedEntityTab
        entityType="Character"
        itemLabel="角色"
        itemIcon={User}
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setCurrentSelectedItem}
        selectedItemId={String(currentSelectedItem?.id ?? currentSelectedItem?.name ?? '')}
        selectedItem={currentSelectedItem}
        searchQuery=""
        onStatusChange={setStatus}
      />
    </>
  )
}

describe('PersistedEntityTab extra2 branch coverage', () => {
  beforeEach(() => {
    persistedGraph.characters = []
    persistedGraph.validateEntityError = null
    persistedGraph.loadReturnsGraphError = false
    persistedGraph.loadReturnsErrorless = false
    persistedGraph.mergeReturnsError = null
    persistedGraph.mergeReturnsErrorless = false
    persistedGraph.mergeGraphError = null
    persistedGraph.mergeReturnsEmptyWorkspaceId = false
    persistedGraph.mergeReturnsEmpty = false
    persistedGraph.deleteReturnsErrorless = false
    persistedGraph.deleteGraphError = null
    persistedGraph.deleteCalls = 0
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  // Line 119: load error `response.error || graphError` — response.error undefined + graphError truthy
  it('throws graphError branch when load returns failure with graph row error and no top-level error', async () => {
    persistedGraph.loadReturnsGraphError = true

    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('加载角色失败，请稍后重试。')
    })
  })

  // Line 119: load error fallback `copy.loadError` — both response.error and graphError falsy
  it('throws copy.loadError fallback when load returns failure with no error', async () => {
    persistedGraph.loadReturnsErrorless = true

    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('加载角色失败，请稍后重试。')
    })
  })

  // Line 224: save error `response.error` truthy branch
  it('throws response.error when merge fails with an error message', async () => {
    const user = userEvent.setup()
    persistedGraph.mergeReturnsError = 'merge failed reason'

    render(<Harness />)

    await screen.findByLabelText('角色名称')
    await user.type(screen.getByLabelText('角色名称'), 'NewChar')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('保存角色失败，请稍后重试。')
    })
  })

  // Line 224: save error `graphError` truthy branch (response.error falsy)
  it('throws graphError branch when merge returns graph row error', async () => {
    const user = userEvent.setup()
    persistedGraph.mergeGraphError = 'merge graph error'

    render(<Harness />)

    await screen.findByLabelText('角色名称')
    await user.type(screen.getByLabelText('角色名称'), 'NewChar')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('保存角色失败，请稍后重试。')
    })
  })

  // Line 224: save error fallback `copy.saveError` — both falsy
  it('throws copy.saveError fallback when merge fails with no error', async () => {
    const user = userEvent.setup()
    persistedGraph.mergeReturnsErrorless = true

    render(<Harness />)

    await screen.findByLabelText('角色名称')
    await user.type(screen.getByLabelText('角色名称'), 'NewChar')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('保存角色失败，请稍后重试。')
    })
  })

  // Line 189: rename path — `matchWorkspaceId || currentWorkspace.identity.workspaceId` (matchWorkspaceId null)
  it('falls back to workspace identity workspaceId when renaming an item with empty workspaceId', async () => {
    const user = userEvent.setup()
    const noWorkspaceItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'Original',
      description: 'desc',
      workspaceId: '',
    }

    render(<Harness initialSelectedItem={noWorkspaceItem} />)

    const nameInput = await screen.findByLabelText('角色名称')
    expect(nameInput).toHaveValue('Original')

    // Rename — triggers the matchWorkspaceId-falsy branch at line 189
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(screen.getByRole('button', { name: '保存角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('角色已保存到当前工作区。')
    })
  })

  // Line 236: `readString(savedItem.workspaceId) || null` — savedItem.workspaceId falsy
  it('sets matchWorkspaceId to null when saved item has no workspaceId', async () => {
    const user = userEvent.setup()
    persistedGraph.mergeReturnsEmptyWorkspaceId = true
    const existingItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'Existing',
      description: 'desc',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={existingItem} />)

    await screen.findByLabelText('角色名称')

    // Save without rename — merge returns a saved item with no workspaceId
    await user.click(screen.getByRole('button', { name: '保存角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('角色已保存到当前工作区。')
    })
  })

  // Line 275: `!matchName || !matchWorkspaceId` — matchName truthy + matchWorkspaceId falsy (early return)
  it('returns early from delete when matchWorkspaceId is null', async () => {
    const user = userEvent.setup()
    const noWorkspaceItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'ToDelete',
      description: 'desc',
      workspaceId: '',
    }

    render(<Harness initialSelectedItem={noWorkspaceItem} />)

    await screen.findByLabelText('角色名称')

    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '确认' }))

    // handleDelete returned early at line 275 — no DETACH DELETE query issued
    await waitFor(() => {
      expect(persistedGraph.deleteCalls).toBe(0)
    })
  })

  // Line 283: `graphError || 'Delete failed'` — graphError falsy -> 'Delete failed'
  it('shows Delete failed when delete returns failure with no error', async () => {
    const user = userEvent.setup()
    persistedGraph.deleteReturnsErrorless = true
    const existingItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'Existing',
      description: 'desc',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={existingItem} />)

    await screen.findByLabelText('角色名称')

    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '确认' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Delete failed')
    })
  })

  // Line 283: `graphError || 'Delete failed'` — graphError truthy
  it('shows graphError message when delete returns graph row error', async () => {
    const user = userEvent.setup()
    persistedGraph.deleteGraphError = 'delete graph error'
    const existingItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'Existing',
      description: 'desc',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={existingItem} />)

    await screen.findByLabelText('角色名称')

    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '确认' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('delete graph error')
    })
  })

  // Lines 421 + 432: list-item render fallbacks for `item.id ?? item.name ?? ''` and
  // `readString(item.name) || readString(item.title) || String(item.id ?? '')`
  it('renders list items with varied id/name/title shapes', async () => {
    // loadItems errors out so it does not overwrite the initial items
    persistedGraph.loadReturnsErrorless = true

    const items: KnowledgeItem[] = [
      { id: 'a', name: 'Alpha', type: 'Character' }, // id truthy, name truthy
      { name: 'NoIdHasName', type: 'Character' }, // id null, name truthy (421 id-null + name-not-null)
      { id: 'c', name: '', title: 'CharlieTitle', type: 'Character' }, // name falsy, title truthy
      { id: 'd', name: '', title: '', type: 'Character' }, // name+title falsy, id truthy
      { type: 'Character' }, // id null + name null (421 name-null) + id null (432 id-null)
    ]

    render(<Harness initialItems={items} />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
  })
})
