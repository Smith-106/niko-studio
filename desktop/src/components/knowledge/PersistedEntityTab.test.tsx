import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CharacterTab } from './CharacterTab'
import { LocationTab } from './LocationTab'
import { PlotTab } from './PlotTab'
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
  locations: [] as PersistedEntity[],
  events: [] as PersistedEntity[],
  failEntityType: null as 'Character' | 'Location' | 'Event' | null,
}))

function extractBalancedObject(text: string, startIndex: number) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]!
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          json: text.slice(startIndex, index + 1),
          endIndex: index + 1,
        }
      }
    }
  }

  throw new Error('Unable to parse balanced JSON object')
}

function parseMergeMutation(cypher: string) {
  const header = /^MERGE\s*\(n:(\w+)\s*/.exec(cypher)
  if (!header) {
    throw new Error(`Unexpected mutation: ${cypher}`)
  }

  const entityType = header[1] as 'Character' | 'Location' | 'Event'
  const matchObject = extractBalancedObject(cypher, header[0].length)
  const setStart = cypher.indexOf('SET', matchObject.endIndex)
  const setObject = extractBalancedObject(cypher, setStart + 4)

  return {
    entityType,
    matchProps: JSON.parse(matchObject.json) as Record<string, unknown>,
    setProps: JSON.parse(setObject.json) as Record<string, unknown>,
  }
}

vi.mock('../../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (cypher.startsWith('MERGE (n:')) {
      const { entityType, matchProps, setProps } = parseMergeMutation(cypher)
      const collection =
        entityType === 'Character'
          ? persistedGraph.characters
          : entityType === 'Location'
            ? persistedGraph.locations
            : persistedGraph.events

      const matchName = String(matchProps.name ?? '')
      const matchWorkspaceId = typeof matchProps.workspaceId === 'string' ? matchProps.workspaceId : null
      const now = new Date().toISOString()

      let existing = collection.find((item) => {
        if (item.name !== matchName) return false
        if (!matchWorkspaceId) return true
        return item.properties.workspaceId === matchWorkspaceId
      })

      if (!existing) {
        existing = {
          id: `${entityType.toLowerCase()}-${collection.length + 1}`,
          type: entityType,
          name: String(setProps.name ?? matchName),
          properties: {
            ...Object.fromEntries(Object.entries(matchProps).filter(([key]) => key !== 'name')),
            ...Object.fromEntries(Object.entries(setProps).filter(([key]) => key !== 'name')),
          },
          created_at: now,
          updated_at: now,
        }
        collection.push(existing)
      } else {
        existing.name = String(setProps.name ?? existing.name)
        existing.properties = {
          ...existing.properties,
          ...Object.fromEntries(Object.entries(setProps).filter(([key]) => key !== 'name')),
        }
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

    if (cypher.includes('MATCH (n:Location)')) {
      if (persistedGraph.failEntityType === 'Location') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      return { success: true, data: persistedGraph.locations.map((item) => ({ n: item })) }
    }

    if (cypher.includes('MATCH (n:Event)')) {
      if (persistedGraph.failEntityType === 'Event') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      return { success: true, data: persistedGraph.events.map((item) => ({ n: item })) }
    }

    return { success: true, data: [] }
  }),
}))

function CharacterHarness() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div>{status.message}</div>}
      <CharacterTab
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setSelectedItem}
        selectedItemId={String(selectedItem?.id ?? selectedItem?.name ?? '')}
        selectedItem={selectedItem}
        searchQuery=""
        onStatusChange={setStatus}
      />
    </>
  )
}

function LocationHarness() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div>{status.message}</div>}
      <LocationTab
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setSelectedItem}
        selectedItemId={String(selectedItem?.id ?? selectedItem?.name ?? '')}
        selectedItem={selectedItem}
        searchQuery=""
        onStatusChange={setStatus}
      />
    </>
  )
}

function PlotHarness() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div>{status.message}</div>}
      <PlotTab
        items={items}
        onItemsChange={setItems}
        loading={loading}
        onLoadingChange={setLoading}
        onItemClick={setSelectedItem}
        selectedItemId={String(selectedItem?.id ?? selectedItem?.name ?? '')}
        selectedItem={selectedItem}
        searchQuery=""
        onStatusChange={setStatus}
      />
    </>
  )
}

describe('persisted knowledge authoring tabs', () => {
  beforeEach(() => {
    persistedGraph.characters = []
    persistedGraph.locations = []
    persistedGraph.events = []
    persistedGraph.failEntityType = null
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  it('creates, edits, and reloads persisted characters', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Alice')
    await user.type(screen.getByLabelText('角色描述'), '主角')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('角色已保存到当前工作区。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Alice/ }))
    const nameInput = screen.getByLabelText('角色名称')
    await user.clear(nameInput)
    await user.type(nameInput, 'Alicia')
    const descriptionInput = screen.getByLabelText('角色描述')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, '更新后的主角')
    await user.click(screen.getByRole('button', { name: '保存角色' }))

    await waitFor(() => {
      expect(screen.getByText('Alicia')).toBeInTheDocument()
    })

    unmount()
    render(<CharacterHarness />)

    expect(await screen.findByText('Alicia')).toBeInTheDocument()
    expect(screen.getByText('更新后的主角')).toBeInTheDocument()
  })

  it('creates persisted locations', async () => {
    const user = userEvent.setup()
    render(<LocationHarness />)

    await user.type(await screen.findByLabelText('地点名称'), 'Harbor')
    await user.type(screen.getByLabelText('地点描述'), '港口')
    await user.click(screen.getByRole('button', { name: '添加地点' }))

    expect(await screen.findByText('Harbor')).toBeInTheDocument()
    expect(screen.getAllByText('港口').length).toBeGreaterThan(0)
  })

  it('creates persisted plot events', async () => {
    const user = userEvent.setup()
    render(<PlotHarness />)

    await user.type(await screen.findByLabelText('剧情名称'), 'Bridge Alarm')
    await user.type(screen.getByLabelText('剧情描述'), '第一幕转折点')
    await user.click(screen.getByRole('button', { name: '添加剧情' }))

    expect(await screen.findByText('Bridge Alarm')).toBeInTheDocument()
    expect(screen.getAllByText('第一幕转折点').length).toBeGreaterThan(0)
  })

  it('reports a load-specific error when the knowledge query fails on entry', async () => {
    persistedGraph.failEntityType = 'Character'

    render(<CharacterHarness />)

    expect(await screen.findByText('加载角色失败，请稍后重试。')).toBeInTheDocument()
    expect(screen.queryByText('保存角色失败，请稍后重试。')).not.toBeInTheDocument()
  })

  it('retries loading automatically after backend health recovers', async () => {
    persistedGraph.failEntityType = 'Character'

    render(<CharacterHarness />)

    expect(await screen.findByText('加载角色失败，请稍后重试。')).toBeInTheDocument()

    persistedGraph.failEntityType = null
    persistedGraph.characters = [{
      id: 'character-1',
      type: 'Character',
      name: 'Alice',
      properties: {
        workspaceId: 'default-project',
        projectId: 'default-project',
        itemKind: 'character',
        description: 'Recovered after backend ready',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]

    act(() => {
      useAppStore.setState({ backendStatus: true })
    })

    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })
})
