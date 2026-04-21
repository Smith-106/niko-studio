import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocationTab } from './LocationTab'
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
  locations: [] as PersistedEntity[],
  failEntityType: null as 'Location' | null,
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
      const collection = entityType === 'Location' ? persistedGraph.locations : []
      const matchName = String(matchProps.name ?? '')
      const now = new Date().toISOString()
      let existing = collection.find((item) => item.name === matchName)
      if (!existing) {
        existing = {
          id: `location-${collection.length + 1}`,
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
    if (cypher.includes('MATCH (n:Location)')) {
      if (persistedGraph.failEntityType === 'Location') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      return { success: true, data: persistedGraph.locations.map((item) => ({ n: item })) }
    }
    return { success: true, data: [] }
  }),
}))

function LocationHarness(props: { searchQuery?: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      <LocationTab
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

describe('LocationTab', () => {
  beforeEach(() => {
    persistedGraph.locations = []
    persistedGraph.failEntityType = null
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  it('loads and displays location items from the graph', async () => {
    persistedGraph.locations = [
      {
        id: 'loc-1',
        type: 'Location',
        name: 'Harbor',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
          description: 'A foggy harbor',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<LocationHarness />)

    expect(await screen.findByText('Harbor')).toBeInTheDocument()
    expect(screen.getByText('A foggy harbor')).toBeInTheDocument()
  })

  it('creates a new location via the form', async () => {
    const user = userEvent.setup()
    render(<LocationHarness />)

    await user.type(await screen.findByLabelText('地点名称'), 'Mountain Peak')
    await user.type(screen.getByLabelText('地点描述'), 'Snow-covered summit')
    await user.click(screen.getByRole('button', { name: '添加地点' }))

    expect(await screen.findByText('Mountain Peak')).toBeInTheDocument()
    expect(screen.getAllByText('Snow-covered summit').length).toBeGreaterThan(0)
    expect(screen.getByText('地点已保存到当前工作区。')).toBeInTheDocument()
  })

  it('selects a location and populates the editor', async () => {
    const user = userEvent.setup()
    persistedGraph.locations = [
      {
        id: 'loc-1',
        type: 'Location',
        name: 'Castle',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
          description: 'An old castle',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<LocationHarness />)

    await user.click(await screen.findByRole('button', { name: /Castle/ }))

    const nameInput = screen.getByLabelText('地点名称') as HTMLInputElement
    expect(nameInput.value).toBe('Castle')

    const descriptionInput = screen.getByLabelText('地点描述') as HTMLTextAreaElement
    expect(descriptionInput.value).toBe('An old castle')
  })

  it('clears the editor fields when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<LocationHarness />)

    await user.type(await screen.findByLabelText('地点名称'), 'Test Location')
    await user.type(screen.getByLabelText('地点描述'), 'Test description')

    await user.click(screen.getByRole('button', { name: '清空编辑器' }))

    expect((screen.getByLabelText('地点名称') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('地点描述') as HTMLTextAreaElement).value).toBe('')
  })

  it('shows error status when graph query fails', async () => {
    persistedGraph.failEntityType = 'Location'

    render(<LocationHarness />)

    expect(await screen.findByText('加载地点失败，请稍后重试。')).toBeInTheDocument()
  })

  it('filters locations based on searchQuery', async () => {
    persistedGraph.locations = [
      {
        id: 'loc-1',
        type: 'Location',
        name: 'DarkForest',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
          description: 'Dense and mysterious',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'loc-2',
        type: 'Location',
        name: 'BrightLake',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
          description: 'Shimmering waters',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<LocationHarness searchQuery="Dark" />)

    expect(await screen.findByText('DarkForest')).toBeInTheDocument()
    expect(screen.queryByText('BrightLake')).not.toBeInTheDocument()
  })

  it('shows empty state when no locations exist', async () => {
    render(<LocationHarness />)

    await waitFor(() => {
      expect(screen.getByText('当前工作区还没有地点条目。')).toBeInTheDocument()
    })
  })

  it('updates an existing location and persists changes', async () => {
    const user = userEvent.setup()
    persistedGraph.locations = [
      {
        id: 'loc-1',
        type: 'Location',
        name: 'OldName',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
          description: 'Old desc',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<LocationHarness />)

    await user.click(await screen.findByRole('button', { name: /OldName/ }))

    const nameInput = screen.getByLabelText('地点名称')
    await user.clear(nameInput)
    await user.type(nameInput, 'NewName')

    const descriptionInput = screen.getByLabelText('地点描述')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'New desc')

    await user.click(screen.getByRole('button', { name: '保存地点' }))

    await waitFor(() => {
      expect(screen.getByText('NewName')).toBeInTheDocument()
    })
    expect(screen.getByText('地点已保存到当前工作区。')).toBeInTheDocument()
  })
})
