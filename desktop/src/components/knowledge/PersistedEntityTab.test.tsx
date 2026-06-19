import { useState } from 'react'
import { User } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CharacterTab } from './CharacterTab'
import { LocationTab } from './LocationTab'
import { PlotTab } from './PlotTab'
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
  locations: [] as PersistedEntity[],
  events: [] as PersistedEntity[],
  failEntityType: null as 'Character' | 'Location' | 'Event' | null,
  graphDataErrorEntityType: null as 'Character' | 'Location' | 'Event' | null,
  mergeGraphError: null as string | null,
  deleteGraphError: null as string | null,
  mergeReturnsEmpty: false,
}))

function extractBalancedBraces(text: string, startIndex: number) {
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]!
    if (inString) {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === stringChar) {
        inString = false
      }
      continue
    }

    if (char === "'" || char === '"') {
      inString = true
      stringChar = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          text: text.slice(startIndex, index + 1),
          endIndex: index + 1,
        }
      }
    }
  }

  throw new Error('Unable to parse balanced braces')
}

function parseCypherProps(propsText: string): Record<string, unknown> {
  // Parse Cypher property format: {key: 'value', key2: 'value2'} or {key: "value"}
  const inner = propsText.slice(1, -1).trim()
  if (!inner) return {}

  const result: Record<string, unknown> = {}
  let remaining = inner

  while (remaining.length > 0) {
    remaining = remaining.trimStart()
    if (!remaining) break

    // Parse key (identifier)
    const keyMatch = /^(\w+)\s*:\s*/.exec(remaining)
    if (!keyMatch) break
    const key = keyMatch[1]
    remaining = remaining.slice(keyMatch[0].length)

    // Parse value (string literal or other)
    remaining = remaining.trimStart()
    if (remaining.startsWith("'") || remaining.startsWith('"')) {
      const quote = remaining[0]!
      let valueEnd = 1
      while (valueEnd < remaining.length) {
        if (remaining[valueEnd] === '\\') {
          valueEnd += 2
          continue
        }
        if (remaining[valueEnd] === quote) {
          valueEnd += 1
          break
        }
        valueEnd += 1
      }
      const raw = remaining.slice(1, valueEnd - 1)
      result[key] = raw
      remaining = remaining.slice(valueEnd)
    } else {
      // Non-string value (number, boolean, null)
      const valueMatch = /^([^,}]+)/.exec(remaining)
      if (valueMatch) {
        const raw = valueMatch[1]!.trim()
        if (raw === 'true') result[key] = true
        else if (raw === 'false') result[key] = false
        else if (raw === 'null') result[key] = null
        else result[key] = Number(raw)
        remaining = remaining.slice(valueMatch[0].length)
      }
    }

    // Skip comma separator
    remaining = remaining.trimStart()
    if (remaining.startsWith(',')) {
      remaining = remaining.slice(1)
    }
  }

  return result
}

function parseMergeMutation(cypher: string) {
  const header = /^MERGE\s*\(n:(\w+)\s*/.exec(cypher)
  if (!header) {
    throw new Error(`Unexpected mutation: ${cypher}`)
  }

  const entityType = header[1] as 'Character' | 'Location' | 'Event'
  const matchObject = extractBalancedBraces(cypher, header[0].length)
  // Handle both "SET n +=" and "SET {" styles
  const setRegion = cypher.slice(matchObject.endIndex)
  const nPlusAssignMatch = /SET\s+n\s*\+=\s*/.exec(setRegion)
  const setStart = nPlusAssignMatch
    ? cypher.indexOf(nPlusAssignMatch[0], matchObject.endIndex) + nPlusAssignMatch[0].length
    : cypher.indexOf('SET', matchObject.endIndex) + 3

  // Find the opening brace for SET props
  const setBraceStart = cypher.indexOf('{', setStart - 1)
  const setObject = extractBalancedBraces(cypher, setBraceStart)

  return {
    entityType,
    matchProps: parseCypherProps(matchObject.text),
    setProps: parseCypherProps(setObject.text),
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

      if (persistedGraph.mergeGraphError) {
        return { success: true, data: [{ error: persistedGraph.mergeGraphError }] }
      }

      return { success: true, data: persistedGraph.mergeReturnsEmpty ? [] : [{ n: existing }] }
    }

    if (cypher.includes('DETACH DELETE')) {
      if (persistedGraph.deleteGraphError) {
        return { success: true, data: [{ error: persistedGraph.deleteGraphError }] }
      }

      const entityMatch = /MATCH \(n:(\w+)\s+\{/.exec(cypher)
      const entityType = entityMatch?.[1] as 'Character' | 'Location' | 'Event' | undefined
      const nameMatch = /name:\s*['"]([^'"]+)['"]/.exec(cypher)
      const name = nameMatch?.[1]

      if (entityType && name) {
        const collection =
          entityType === 'Character'
            ? persistedGraph.characters
            : entityType === 'Location'
              ? persistedGraph.locations
              : persistedGraph.events
        const index = collection.findIndex((item) => item.name === name)
        if (index !== -1) {
          collection.splice(index, 1)
        }
      }
      return { success: true, data: [] }
    }

    if (cypher.startsWith('MATCH (n:') && cypher.includes('SET n.name')) {
      // Rename mutation
      const entityMatch = /MATCH \(n:(\w+)\s+\{name:/.exec(cypher)
      const oldNameMatch = /name:\s*"([^"]+)"/.exec(cypher)
      const newNameMatch = /SET n\.name\s*=\s*"([^"]+)"/.exec(cypher)
      const entityType = entityMatch?.[1] as 'Character' | 'Location' | 'Event' | undefined
      const oldName = oldNameMatch?.[1]
      const newName = newNameMatch?.[1]

      if (entityType && oldName && newName) {
        const collection =
          entityType === 'Character'
            ? persistedGraph.characters
            : entityType === 'Location'
              ? persistedGraph.locations
              : persistedGraph.events
        const existing = collection.find((item) => item.name === oldName)
        if (existing) {
          existing.name = newName
        }
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

    if (cypher.includes('MATCH (n:Location)')) {
      if (persistedGraph.failEntityType === 'Location') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      if (persistedGraph.graphDataErrorEntityType === 'Location') {
        return { success: true, data: [{ error: 'graph row error' }] }
      }
      return { success: true, data: persistedGraph.locations.map((item) => ({ n: item })) }
    }

    if (cypher.includes('MATCH (n:Event)')) {
      if (persistedGraph.failEntityType === 'Event') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      if (persistedGraph.graphDataErrorEntityType === 'Event') {
        return { success: true, data: [{ error: 'graph row error' }] }
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

function BareCharacterHarness({
  initialItems = [],
  selectedItem = null,
  searchQuery = '',
  extraFields,
  itemKind,
}: {
  initialItems?: KnowledgeItem[]
  selectedItem?: KnowledgeItem | null
  searchQuery?: string
  extraFields?: FieldConfig[]
  itemKind?: string
}) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [currentSelectedItem, setCurrentSelectedItem] = useState<KnowledgeItem | null>(selectedItem)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div>{status.message}</div>}
      <PersistedEntityTab
        entityType="Character"
        itemKind={itemKind}
        itemLabel="Character"
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

describe('persisted knowledge authoring tabs', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
    persistedGraph.characters = []
    persistedGraph.locations = []
    persistedGraph.events = []
    persistedGraph.failEntityType = null
    persistedGraph.graphDataErrorEntityType = null
    persistedGraph.mergeGraphError = null
    persistedGraph.deleteGraphError = null
    persistedGraph.mergeReturnsEmpty = false
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
    })
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('creates, edits, and reloads persisted characters', { timeout: 15_000 }, async () => {
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

  it('creates persisted locations', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<LocationHarness />)

    await user.type(await screen.findByLabelText('地点名称'), 'Harbor')
    await user.type(screen.getByLabelText('地点描述'), '港口')
    await user.click(screen.getByRole('button', { name: '添加地点' }))

    expect(await screen.findByText('Harbor')).toBeInTheDocument()
    expect(screen.getAllByText('港口').length).toBeGreaterThan(0)
  })

  it('creates persisted plot events', { timeout: 15_000 }, async () => {
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

  it('retries loading automatically after backend health recovers', { timeout: 15_000 }, async () => {
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

  it('shows delete button when editing an existing character', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Bob')
    await user.type(screen.getByLabelText('角色描述'), '配角')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    expect(await screen.findByText('Bob')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bob/ }))
    expect(screen.getByText('删除')).toBeInTheDocument()
  })

  it('shows confirmation before delete and cancels', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Eve')
    await user.type(screen.getByLabelText('角色描述'), '反派')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    expect(await screen.findByText('Eve')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Eve/ }))
    await user.click(screen.getByText('删除'))

    expect(screen.getByText(/确定删除/)).toBeInTheDocument()
    expect(screen.getByText('确认')).toBeInTheDocument()
    expect(screen.getByText('取消')).toBeInTheDocument()

    await user.click(screen.getByText('取消'))
    expect(screen.queryByText('确认')).not.toBeInTheDocument()
    expect(screen.getByText('Eve')).toBeInTheDocument()
  })

  it('deletes entity after confirmation', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    await user.type(await screen.findByLabelText('角色名称'), 'Mallory')
    await user.type(screen.getByLabelText('角色描述'), '反派')
    await user.click(screen.getByRole('button', { name: '添加角色' }))

    expect(await screen.findByText('Mallory')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mallory/ }))
    await user.click(screen.getByText('删除'))
    await user.click(screen.getByText('确认'))

    await waitFor(() => {
      expect(screen.queryByText('Mallory')).not.toBeInTheDocument()
    })
  })

  it('renders extra fields for Character (role, traits)', { timeout: 15_000 }, async () => {
    render(<CharacterHarness />)

    expect(await screen.findByLabelText('Role')).toBeInTheDocument()
    expect(screen.getByLabelText('Traits')).toBeInTheDocument()
  })

  it('renders extra fields for Location (geography)', { timeout: 15_000 }, async () => {
    render(<LocationHarness />)

    expect(await screen.findByLabelText('Geography')).toBeInTheDocument()
  })

  it('renders extra fields for Plot (chapter, act)', { timeout: 15_000 }, async () => {
    render(<PlotHarness />)

    expect(await screen.findByLabelText('Chapter')).toBeInTheDocument()
    expect(screen.getByLabelText('Act')).toBeInTheDocument()
  })

  it('renders english editor copy and validates empty saves for direct character tabs', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<BareCharacterHarness />)

    expect(await screen.findByLabelText('Character name')).toBeInTheDocument()
    expect(screen.getByLabelText('Character details')).toHaveAttribute(
      'placeholder',
      'Capture the key details, purpose, and writing notes for this character.',
    )
    expect(screen.getByText('No character entries exist for this workspace yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Character' }))

    expect(screen.getByText('Enter character name')).toBeInTheDocument()
  })

  it('renders english plot copy for plot-specific placeholders', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<PlotHarness />)

    expect(await screen.findByLabelText('Plots details')).toHaveAttribute(
      'placeholder',
      'Capture the turning point, stakes, and aftermath for this plot beat.',
    )
  })

  it('reports row-level graph errors during load', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    persistedGraph.graphDataErrorEntityType = 'Character'

    render(<CharacterHarness />)

    expect(await screen.findByText('Failed to load characters. Please try again.')).toBeInTheDocument()
  })

  it('surfaces save failures after editing direct extra fields', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    persistedGraph.mergeGraphError = 'merge blocked'

    render(<BareCharacterHarness extraFields={[
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'traits', label: 'Traits', type: 'textarea' },
    ]} />)

    await user.type(await screen.findByLabelText('Character name'), 'Nadia')
    await user.type(screen.getByLabelText('Character details'), 'A precise witness.')
    await user.type(screen.getByLabelText('Role'), 'Observer')
    await user.type(screen.getByLabelText('Traits'), 'Calm and analytical')
    await user.click(screen.getByRole('button', { name: 'Add Character' }))

    expect(await screen.findByText('Failed to save character. Please try again.')).toBeInTheDocument()
  })

  it('falls back when merge responses omit saved rows and reports delete failures', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    persistedGraph.mergeReturnsEmpty = true

    render(<BareCharacterHarness />)

    await user.type(await screen.findByLabelText('Character name'), 'Orphan')
    await user.type(screen.getByLabelText('Character details'), 'Still persisted after an empty merge response.')
    await user.click(screen.getByRole('button', { name: 'Add Character' }))

    expect(await screen.findByText('Character saved to the current workspace.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Character' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()

    persistedGraph.deleteGraphError = 'delete blocked'
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Delete "Orphan"?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Error: delete blocked')).toBeInTheDocument()
    expect(screen.getByText('Orphan')).toBeInTheDocument()
  })

  it('renders fallback titles and no-description copy for sparse graph items', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    persistedGraph.characters = [{
      id: '',
      type: 'Character',
      name: '',
      title: 'Fallback title',
      properties: {
        workspaceId: 'default-project',
        projectId: 'default-project',
        itemKind: 'character',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as PersistedEntity]

    render(<CharacterHarness />)

    expect(await screen.findByText('Fallback title')).toBeInTheDocument()
    expect(screen.getByText('No description')).toBeInTheDocument()
  })
})
