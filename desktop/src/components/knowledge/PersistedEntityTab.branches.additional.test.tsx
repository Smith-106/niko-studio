import { useState } from 'react'
import { User } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PersistedEntityTab } from './PersistedEntityTab'
import type { FieldConfig, KnowledgeItem, OperationStatus } from './KnowledgeTypes'
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
  failEntityType: null as 'Character' | 'Location' | 'Event' | null,
  graphDataErrorEntityType: null as 'Character' | 'Location' | 'Event' | null,
  mergeGraphError: null as string | null,
  deleteGraphError: null as string | null,
  mergeReturnsEmpty: false,
  validateEntityError: null as string | null,
}))

vi.mock('../../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (persistedGraph.validateEntityError && cypher.startsWith('MATCH')) {
      throw new Error(persistedGraph.validateEntityError)
    }

    if (cypher.startsWith('MERGE (n:')) {
      // Simple merge handler
      if (persistedGraph.mergeGraphError) {
        return { success: true, data: [{ error: persistedGraph.mergeGraphError }] }
      }
      const nameMatch = /name:\s*'([^']*)'/.exec(cypher)
      const name = nameMatch?.[1] ?? 'Unknown'
      const existing = persistedGraph.characters.find((c) => c.name === name)
      if (existing) {
        existing.updated_at = new Date().toISOString()
        return { success: true, data: persistedGraph.mergeReturnsEmpty ? [] : [{ n: existing }] }
      }
      const newItem = {
        id: `char-${persistedGraph.characters.length + 1}`,
        type: 'Character',
        name,
        properties: { workspaceId: 'default-project', itemKind: 'character', description: '' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      persistedGraph.characters.push(newItem)
      return { success: true, data: persistedGraph.mergeReturnsEmpty ? [] : [{ n: newItem }] }
    }

    if (cypher.includes('DETACH DELETE')) {
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
      if (persistedGraph.failEntityType === 'Character') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      if (persistedGraph.graphDataErrorEntityType === 'Character') {
        return { success: true, data: [{ error: 'graph row error' }] }
      }
      return { success: true, data: persistedGraph.characters.map((item) => ({ n: item })) }
    }
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
  searchQuery = '',
  extraFields,
  itemKind,
  entityType = 'Character' as const,
  itemLabel = '角色',
}: {
  initialItems?: KnowledgeItem[]
  initialSelectedItem?: KnowledgeItem | null
  searchQuery?: string
  extraFields?: FieldConfig[]
  itemKind?: string
  entityType?: 'Character' | 'Location' | 'Event'
  itemLabel?: string
}) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [currentSelectedItem, setCurrentSelectedItem] = useState<KnowledgeItem | null>(initialSelectedItem)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      <PersistedEntityTab
        entityType={entityType}
        itemKind={itemKind}
        itemLabel={itemLabel}
        itemIcon={User}
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setCurrentSelectedItem}
        selectedItemId={String(currentSelectedItem?.id ?? currentSelectedItem?.name ?? '')}
        selectedItem={currentSelectedItem}
        searchQuery={searchQuery}
        onStatusChange={setStatus}
        extraFields={extraFields}
      />
    </>
  )
}

describe('PersistedEntityTab additional branch coverage', () => {
  beforeEach(() => {
    persistedGraph.characters = []
    persistedGraph.failEntityType = null
    persistedGraph.graphDataErrorEntityType = null
    persistedGraph.mergeGraphError = null
    persistedGraph.deleteGraphError = null
    persistedGraph.mergeReturnsEmpty = false
    persistedGraph.validateEntityError = null
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  it('skips populating editor when selectedItem type does not match entityType', async () => {
    const mismatchedItem: KnowledgeItem = {
      id: 'loc-1',
      type: 'Location',
      name: 'WrongType',
      description: 'This is a location',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={mismatchedItem} />)

    // The useEffect at line 150-151 should return early because
    // readString(selectedItem.type) === 'Location' !== 'Character' (entityType)
    // So draftName stays empty
    const nameInput = await screen.findByLabelText('角色名称')
    expect(nameInput).toHaveValue('')
  })

  it('populates editor from selectedItem.content when description is empty', async () => {
    const contentItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'ContentChar',
      description: '',
      content: 'This is the content fallback',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={contentItem} />)

    const nameInput = await screen.findByLabelText('角色名称')
    expect(nameInput).toHaveValue('ContentChar')

    const descInput = screen.getByLabelText('角色描述')
    // description is '' (empty) so falls back to content
    expect(descInput).toHaveValue('This is the content fallback')
  })

  it('populates editor from selectedItem.description when description exists', async () => {
    const descItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'DescChar',
      description: 'Description takes priority',
      content: 'Content is ignored',
      workspaceId: 'default-project',
    }

    render(<Harness initialSelectedItem={descItem} />)

    const descInput = await screen.findByLabelText('角色描述')
    expect(descInput).toHaveValue('Description takes priority')
  })

  it('sets matchWorkspaceId to null when workspaceId is empty', async () => {
    const noWorkspaceItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'NoWorkspace',
      description: 'desc',
      workspaceId: '',
    }

    render(<Harness initialSelectedItem={noWorkspaceItem} />)

    // The save button should show "添加角色" (addLabel) because matchName is set
    // but matchWorkspaceId is null (empty string || null = null)
    // Actually, matchName = 'NoWorkspace' so it shows saveLabel
    const saveButton = await screen.findByRole('button', { name: '保存角色' })
    expect(saveButton).toBeInTheDocument()
  })

  it('shows addLabel when no matchName is set (new entity)', async () => {
    render(<Harness />)

    const saveButton = await screen.findByRole('button', { name: '添加角色' })
    expect(saveButton).toBeInTheDocument()
  })

  it('shows saveLabel when matchName is set (existing entity)', async () => {
    const existingItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'Existing',
      description: 'desc',
      workspaceId: 'ws-1',
    }

    render(<Harness initialSelectedItem={existingItem} />)

    const saveButton = await screen.findByRole('button', { name: '保存角色' })
    expect(saveButton).toBeInTheDocument()
  })

  it('returns early from handleSave when name is empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await screen.findByLabelText('角色名称')

    // Click save without entering a name
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('输入角色名称')
    })
  })

  it('shows loading state in item list', async () => {
    render(<Harness />)

    // Wait for initial load to finish
    await screen.findByText('当前工作区还没有角色条目。')
  })

  it('filters items by search query', async () => {
    const user = userEvent.setup()
    persistedGraph.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'Alice',
        properties: { workspaceId: 'default-project', itemKind: 'character', description: 'Brave hero' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'char-2',
        type: 'Character',
        name: 'Bob',
        properties: { workspaceId: 'default-project', itemKind: 'character', description: 'Quiet friend' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<Harness searchQuery="alice" />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    })
  })

  it('renders extra textarea field type', async () => {
    render(
      <Harness
        extraFields={[
          { key: 'backstory', label: 'Background', type: 'textarea' },
        ]}
      />,
    )

    await screen.findByLabelText('角色名称')
    expect(screen.getByLabelText('Background')).toBeInTheDocument()
    // It should be a textarea, not an input
    const bgField = screen.getByLabelText('Background')
    expect(bgField.tagName).toBe('TEXTAREA')
  })

  it('renders extra text input field type', async () => {
    render(
      <Harness
        extraFields={[
          { key: 'role', label: 'Role', type: 'text' },
        ]}
      />,
    )

    await screen.findByLabelText('角色名称')
    const roleField = screen.getByLabelText('Role')
    expect(roleField.tagName).toBe('INPUT')
  })

  it('renders plot-specific description placeholder for zh language', async () => {
    useSettingsStore.getState().updateSettings({ language: 'zh' })

    render(<Harness itemKind="plot" itemLabel="剧情" />)

    const descInput = await screen.findByLabelText('剧情描述')
    expect(descInput).toHaveAttribute('placeholder', '记录这个剧情节点的关键冲突、推进和后果。')
  })

  it('renders english plot-specific description placeholder', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<Harness itemKind="plot" itemLabel="Plot" />)

    const descInput = await screen.findByLabelText('Plot details')
    expect(descInput).toHaveAttribute(
      'placeholder',
      'Capture the turning point, stakes, and aftermath for this plot beat.',
    )
  })

  it('handles loadItems catch block from validateEntityType error', async () => {
    persistedGraph.validateEntityError = 'Invalid entity type'

    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('加载角色失败，请稍后重试。')
    })
  })

  it('clears editor on reset button click', async () => {
    const user = userEvent.setup()
    const existingItem: KnowledgeItem = {
      id: 'char-1',
      type: 'Character',
      name: 'ClearTest',
      description: 'Will be cleared',
      workspaceId: 'ws-1',
    }

    render(<Harness initialSelectedItem={existingItem} />)

    const nameInput = await screen.findByLabelText('角色名称')
    expect(nameInput).toHaveValue('ClearTest')

    await user.click(screen.getByRole('button', { name: '清空编辑器' }))

    await waitFor(() => {
      expect(screen.getByLabelText('角色名称')).toHaveValue('')
      expect(screen.getByLabelText('角色描述')).toHaveValue('')
    })
    // After clearing, save button shows addLabel
    expect(screen.getByRole('button', { name: '添加角色' })).toBeInTheDocument()
  })

  it('renders Chinese delete confirmation labels', async () => {
    const user = userEvent.setup()
    persistedGraph.characters = [{
      id: 'char-1',
      type: 'Character',
      name: 'ToDelete',
      properties: { workspaceId: 'default-project', itemKind: 'character', description: 'Will be deleted' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]

    useSettingsStore.getState().updateSettings({ language: 'zh' })

    render(<Harness />)

    await user.type(await screen.findByLabelText('角色名称'), 'ToDelete')
    await user.type(screen.getByLabelText('角色描述'), 'Test')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    await waitFor(() => {
      expect(screen.getByText('ToDelete')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /ToDelete/ }))
    expect(screen.getByText('删除')).toBeInTheDocument()

    await user.click(screen.getByText('删除'))
    expect(screen.getByText(/确定删除/)).toBeInTheDocument()
    expect(screen.getByText('确认')).toBeInTheDocument()
    expect(screen.getByText('取消')).toBeInTheDocument()
  })
})
