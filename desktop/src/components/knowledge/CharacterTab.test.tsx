import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterTab } from './CharacterTab'
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
  failEntityType: null as 'Character' | null,
}))

function extractBalancedObject(text: string, startIndex: number) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]!
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return { json: text.slice(startIndex, index + 1), endIndex: index + 1 }
    }
  }
  throw new Error('Unable to parse balanced JSON object')
}

function parseMergeMutation(cypher: string) {
  const header = /^MERGE\s*\(n:(\w+)\s*/.exec(cypher)
  if (!header) throw new Error(`Unexpected mutation: ${cypher}`)
  const matchObject = extractBalancedObject(cypher, header[0].length)
  const setStart = cypher.indexOf('SET', matchObject.endIndex)
  const setObject = extractBalancedObject(cypher, setStart + 4)
  return {
    entityType: header[1],
    matchProps: JSON.parse(matchObject.json) as Record<string, unknown>,
    setProps: JSON.parse(setObject.json) as Record<string, unknown>,
  }
}

vi.mock('../../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (cypher.startsWith('MERGE (n:')) {
      const { entityType, matchProps, setProps } = parseMergeMutation(cypher)
      const collection = entityType === 'Character' ? persistedGraph.characters : []
      const matchName = String(matchProps.name ?? '')
      const now = new Date().toISOString()
      let existing = collection.find((item) => item.name === matchName)
      if (!existing) {
        existing = {
          id: `character-${collection.length + 1}`,
          type: entityType,
          name: String(setProps.name ?? matchName),
          properties: { ...setProps },
          created_at: now,
          updated_at: now,
        }
        collection.push(existing)
      } else {
        existing.name = String(setProps.name ?? existing.name)
        existing.properties = { ...existing.properties, ...setProps }
        existing.updated_at = now
      }
      return { success: true, data: [{ n: existing }] }
    }
    if (cypher.includes('MATCH (n:Character)')) {
      if (persistedGraph.failEntityType === 'Character') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      return { success: true, data: persistedGraph.characters.map((item) => ({ n: item })) }
    }
    return { success: true, data: [] }
  }),
}))

function CharacterHarness(props: { searchQuery?: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      <CharacterTab
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setSelectedItem}
        selectedItemId={String(selectedItem?.id ?? selectedItem?.name ?? '')}
        selectedItem={selectedItem}
        searchQuery={props.searchQuery ?? ''}
        onStatusChange={setStatus}
      />
    </>
  )
}

describe('CharacterTab', () => {
  beforeEach(() => {
    persistedGraph.characters = []
    persistedGraph.failEntityType = null
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  it('loads and displays character items from the graph', async () => {
    persistedGraph.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'Alice',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
          description: 'The protagonist',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CharacterHarness />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('The protagonist')).toBeInTheDocument()
  })

  it('creates a new character via the form', async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Bob')
    await user.type(screen.getByLabelText('角色描述'), 'A sidekick')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getAllByText('A sidekick').length).toBeGreaterThan(0)
    expect(screen.getByText('角色已保存到当前工作区。')).toBeInTheDocument()
  })

  it('selects a character and populates the editor for editing', async () => {
    const user = userEvent.setup()
    persistedGraph.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'Charlie',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
          description: 'Original description',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CharacterHarness />)

    await user.click(await screen.findByRole('button', { name: /Charlie/ }))

    const nameInput = screen.getByLabelText('角色名称') as HTMLInputElement
    expect(nameInput.value).toBe('Charlie')

    const descriptionInput = screen.getByLabelText('角色描述') as HTMLTextAreaElement
    expect(descriptionInput.value).toBe('Original description')
  })

  it('clears the editor when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Dave')
    await user.type(screen.getByLabelText('角色描述'), 'Some description')

    await user.click(screen.getByRole('button', { name: '清空编辑器' }))

    const nameInput = screen.getByLabelText('角色名称') as HTMLInputElement
    expect(nameInput.value).toBe('')

    const descriptionInput = screen.getByLabelText('角色描述') as HTMLTextAreaElement
    expect(descriptionInput.value).toBe('')
  })

  it('shows error status when the graph query fails', async () => {
    persistedGraph.failEntityType = 'Character'

    render(<CharacterHarness />)

    expect(await screen.findByText('加载角色失败，请稍后重试。')).toBeInTheDocument()
  })

  it('filters characters based on searchQuery', async () => {
    persistedGraph.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'AliceWonder',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
          description: 'Wonderland girl',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'char-2',
        type: 'Character',
        name: 'BobBuilder',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
          description: 'Can we fix it',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CharacterHarness searchQuery="Alice" />)

    expect(await screen.findByText('AliceWonder')).toBeInTheDocument()
    expect(screen.queryByText('BobBuilder')).not.toBeInTheDocument()
  })

  it('highlights the selected character with blue background', async () => {
    const user = userEvent.setup()
    persistedGraph.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'Eve',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
          description: 'Desc',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<CharacterHarness />)

    const charButton = await screen.findByRole('button', { name: /Eve/ })
    expect(charButton.className).not.toContain('bg-blue-50')

    await user.click(charButton)
    expect(charButton.className).toContain('bg-blue-50')
  })

  it('shows empty state when no characters exist', async () => {
    render(<CharacterHarness />)

    await waitFor(() => {
      // After loading completes, the empty state shows
      expect(screen.getByText('当前工作区还没有角色条目。')).toBeInTheDocument()
    })
  })
})
