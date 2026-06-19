import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  events: [] as PersistedEntity[],
  failEntityType: null as 'Event' | null,
}))

function extractBalancedBraces(text: string, startIndex: number) {
  let depth = 0
  let inString = false
  let stringChar = ''
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]!
    if (inString) {
      if (char === '\\') { index += 1; continue }
      if (char === stringChar) { inString = false }
      continue
    }
    if (char === "'" || char === '"') { inString = true; stringChar = char; continue }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return { text: text.slice(startIndex, index + 1), endIndex: index + 1 }
    }
  }
  throw new Error('Unable to parse balanced braces')
}

function parseCypherProps(propsText: string): Record<string, unknown> {
  const inner = propsText.slice(1, -1).trim()
  if (!inner) return {}
  const result: Record<string, unknown> = {}
  let remaining = inner
  while (remaining.length > 0) {
    remaining = remaining.trimStart()
    if (!remaining) break
    const keyMatch = /^(\w+)\s*:\s*/.exec(remaining)
    if (!keyMatch) break
    const key = keyMatch[1]
    remaining = remaining.slice(keyMatch[0].length).trimStart()
    if (remaining.startsWith("'") || remaining.startsWith('"')) {
      const quote = remaining[0]!
      let valueEnd = 1
      while (valueEnd < remaining.length) {
        if (remaining[valueEnd] === '\\') { valueEnd += 2; continue }
        if (remaining[valueEnd] === quote) { valueEnd += 1; break }
        valueEnd += 1
      }
      result[key] = remaining.slice(1, valueEnd - 1)
      remaining = remaining.slice(valueEnd)
    } else {
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
    remaining = remaining.trimStart()
    if (remaining.startsWith(',')) remaining = remaining.slice(1)
  }
  return result
}

function parseMergeMutation(cypher: string) {
  const header = /^MERGE\s*\(n:(\w+)\s*/.exec(cypher)
  if (!header) throw new Error(`Unexpected mutation: ${cypher}`)
  const matchObject = extractBalancedBraces(cypher, header[0].length)
  const setRegion = cypher.slice(matchObject.endIndex)
  const nPlusAssignMatch = /SET\s+n\s*\+=\s*/.exec(setRegion)
  const setStart = nPlusAssignMatch
    ? cypher.indexOf(nPlusAssignMatch[0], matchObject.endIndex) + nPlusAssignMatch[0].length
    : cypher.indexOf('SET', matchObject.endIndex) + 3
  const setBraceStart = cypher.indexOf('{', setStart - 1)
  const setObject = extractBalancedBraces(cypher, setBraceStart)
  return {
    entityType: header[1],
    matchProps: parseCypherProps(matchObject.text),
    setProps: parseCypherProps(setObject.text),
  }
}

vi.mock('../../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (cypher.startsWith('MERGE (n:')) {
      const { entityType, matchProps, setProps } = parseMergeMutation(cypher)
      const collection = entityType === 'Event' ? persistedGraph.events : []
      const matchName = String(matchProps.name ?? '')
      const now = new Date().toISOString()
      let existing = collection.find((item) => item.name === matchName)
      if (!existing) {
        existing = {
          id: `event-${collection.length + 1}`,
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
    if (cypher.includes('MATCH (n:Event)')) {
      if (persistedGraph.failEntityType === 'Event') {
        return { success: false, error: 'graph unavailable', data: [] }
      }
      return { success: true, data: persistedGraph.events.map((item) => ({ n: item })) }
    }
    return { success: true, data: [] }
  }),
}))

function PlotHarness(props: { searchQuery?: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      <PlotTab
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

describe('PlotTab', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
    persistedGraph.events = []
    persistedGraph.failEntityType = null
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

  it('loads and displays plot event items from the graph', async () => {
    persistedGraph.events = [
      {
        id: 'event-1',
        type: 'Event',
        name: 'Battle of Troy',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'plot',
          description: 'The climactic siege',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<PlotHarness />)

    expect(await screen.findByText('Battle of Troy')).toBeInTheDocument()
    expect(screen.getByText('The climactic siege')).toBeInTheDocument()
  })

  it('creates a new plot event via the form', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<PlotHarness />)

    await user.type(await screen.findByLabelText('剧情名称'), 'The Betrayal')
    await user.type(screen.getByLabelText('剧情描述'), 'Marcus reveals his true allegiance')
    await user.click(screen.getByRole('button', { name: '添加剧情' }))

    expect(await screen.findByText('The Betrayal')).toBeInTheDocument()
    expect(screen.getAllByText('Marcus reveals his true allegiance').length).toBeGreaterThan(0)
    expect(screen.getByText('剧情已保存到当前工作区。')).toBeInTheDocument()
  })

  it('selects a plot event and populates the editor', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    persistedGraph.events = [
      {
        id: 'event-1',
        type: 'Event',
        name: 'Midpoint Crisis',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'plot',
          description: 'Everything falls apart',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<PlotHarness />)

    await user.click(await screen.findByRole('button', { name: /Midpoint Crisis/ }))

    expect((screen.getByLabelText('剧情名称') as HTMLInputElement).value).toBe('Midpoint Crisis')
    expect((screen.getByLabelText('剧情描述') as HTMLTextAreaElement).value).toBe('Everything falls apart')
  })

  it('clears the editor when the clear button is clicked', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<PlotHarness />)

    await user.type(await screen.findByLabelText('剧情名称'), 'Test Plot')
    await user.type(screen.getByLabelText('剧情描述'), 'Test plot desc')

    await user.click(screen.getByRole('button', { name: '清空编辑器' }))

    expect((screen.getByLabelText('剧情名称') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('剧情描述') as HTMLTextAreaElement).value).toBe('')
  })

  it('shows error status when graph query fails', async () => {
    persistedGraph.failEntityType = 'Event'

    render(<PlotHarness />)

    expect(await screen.findByText('加载剧情失败，请稍后重试。')).toBeInTheDocument()
  })

  it('filters plot events based on searchQuery', async () => {
    persistedGraph.events = [
      {
        id: 'event-1',
        type: 'Event',
        name: 'Opening Scene',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'plot',
          description: 'The beginning',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'event-2',
        type: 'Event',
        name: 'Closing Scene',
        properties: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'plot',
          description: 'The end',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    render(<PlotHarness searchQuery="Opening" />)

    expect(await screen.findByText('Opening Scene')).toBeInTheDocument()
    expect(screen.queryByText('Closing Scene')).not.toBeInTheDocument()
  })

  it('shows empty state when no plot events exist', async () => {
    render(<PlotHarness />)

    await waitFor(() => {
      expect(screen.getByText('当前工作区还没有剧情条目。')).toBeInTheDocument()
    })
  })

  it('uses plot-specific description placeholder text', async () => {
    render(<PlotHarness />)

    await waitFor(() => {
      const descriptionTextarea = screen.getByLabelText('剧情描述')
      expect(descriptionTextarea.getAttribute('placeholder')).toContain('剧情节点的关键冲突')
    })
  })
})
