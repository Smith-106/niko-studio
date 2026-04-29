import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StoryBiblePanel } from './StoryBiblePanel'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import {
  listProjectWikiCanonPagesApi,
  promoteProjectWikiCanonApi,
  queryGraph,
  readProjectWikiCanonPageApi,
} from '../api/client'

type PersistedEntity = {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

const persistedState = vi.hoisted(() => ({
  storyBible: null as PersistedEntity | null,
  characters: [] as PersistedEntity[],
  locations: [] as PersistedEntity[],
  scenes: [] as PersistedEntity[],
  events: [] as PersistedEntity[],
  timelines: [] as PersistedEntity[],
}))

const canonApiState = vi.hoisted(() => ({
  list: vi.fn(),
  promote: vi.fn(),
  read: vi.fn(),
}))

function persistWorkspaceItem(payload: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const itemKind = String(payload.itemKind ?? '')
  const entity: PersistedEntity = {
    id: String((payload.id ?? payload.name ?? itemKind) || 'item'),
    type: 'Item',
    name: String(payload.name ?? payload.title ?? payload.id ?? 'item'),
    properties: payload,
    created_at: timestamp,
    updated_at: timestamp,
  }

  if (itemKind === 'story-bible') {
    persistedState.storyBible = {
      ...entity,
      id: 'story-bible-1',
      created_at: persistedState.storyBible?.created_at ?? timestamp,
    }
    return persistedState.storyBible
  }

  const collections: Record<string, PersistedEntity[]> = {
    'narrative-scene': persistedState.scenes,
    'narrative-event': persistedState.events,
    'narrative-timeline': persistedState.timelines,
  }
  const collection = collections[itemKind]
  if (collection) {
    const existingIndex = collection.findIndex((entry) => entry.id === entity.id)
    if (existingIndex >= 0) {
      collection[existingIndex] = {
        ...collection[existingIndex],
        ...entity,
        created_at: collection[existingIndex].created_at,
      }
      return collection[existingIndex]
    }
    collection.unshift(entity)
    return entity
  }

  return entity
}

vi.mock('../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (cypher.startsWith('MERGE (n:Item')) {
      const setStart = cypher.indexOf(' SET ')
      const returnStart = cypher.lastIndexOf(' RETURN n')
      const payload = JSON.parse(cypher.slice(setStart + 5, returnStart)) as Record<string, unknown>
      const persisted = persistWorkspaceItem(payload)
      return { success: true, data: [{ n: persisted }] }
    }

    if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = "narrative-scene"')) {
      return {
        success: true,
        data: persistedState.scenes.map((scene) => ({ n: scene })),
      }
    }

    if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = "narrative-event"')) {
      return {
        success: true,
        data: persistedState.events.map((event) => ({ n: event })),
      }
    }

    if (cypher.includes('MATCH (n:Item) WHERE n.itemKind = "narrative-timeline"')) {
      return {
        success: true,
        data: persistedState.timelines.map((timeline) => ({ n: timeline })),
      }
    }

    if (cypher.includes('MATCH (n:Item)')) {
      return {
        success: true,
        data: persistedState.storyBible ? [{ n: persistedState.storyBible }] : [],
      }
    }

    if (cypher.includes('MATCH (c:Character)')) {
      return {
        success: true,
        data: persistedState.characters.map((character) => ({ c: character })),
      }
    }

    if (cypher.includes('MATCH (l:Location)')) {
      return {
        success: true,
        data: persistedState.locations.map((location) => ({ l: location })),
      }
    }

    return { success: true, data: [] }
  }),
  listProjectWikiCanonPagesApi: canonApiState.list,
  promoteProjectWikiCanonApi: canonApiState.promote,
  readProjectWikiCanonPageApi: canonApiState.read,
}))


const zh = translations.zh

describe('StoryBiblePanel', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
    persistedState.storyBible = null
    persistedState.scenes = []
    persistedState.events = []
    persistedState.timelines = []
    persistedState.characters = [
      {
        id: 'char-1',
        type: 'Character',
        name: 'Alice',
        properties: {
          description: '主角',
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'character',
        },
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: '2026-04-08T00:00:00.000Z',
      },
    ]
    persistedState.locations = [
      {
        id: 'loc-1',
        type: 'Location',
        name: 'Harbor',
        properties: {
          description: '港口',
          workspaceId: 'default-project',
          projectId: 'default-project',
          itemKind: 'location',
        },
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: '2026-04-08T00:00:00.000Z',
      },
    ]

    vi.mocked(listProjectWikiCanonPagesApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        total_pages: 0,
        pages: [],
      },
    })
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-1',
          slug: 'story-bible/default-project-synopsis',
          title: 'default-project Story Bible Synopsis',
          status: 'curated',
          path: '/tmp/canon.md',
          markdown: '# Canon',
          promoted_from: 'story-bible',
        },
        raw_evidence_path: '/tmp/raw.md',
        log_entry: { type: 'promotion' },
      },
    })
    vi.mocked(readProjectWikiCanonPageApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-1',
          slug: 'story-bible/default-project-synopsis',
          title: 'default-project Story Bible Synopsis',
          status: 'curated',
          file_path: 'story-bible/default-project-synopsis.md',
          markdown: '# Canon',
        },
      },
    })

    localStorage.clear()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:story-bible-draft'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('announces story bible section expansion state', async () => {
    const user = userEvent.setup()
    render(<StoryBiblePanel />)

    expect(await screen.findByText(zh.storyBiblePersistenceTitle)).toBeInTheDocument()
    const synopsisToggle = screen.getByRole('button', { name: zh.storyBibleSynopsis })
    expect(synopsisToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByPlaceholderText(zh.storyBibleSynopsisPlaceholder)).not.toBeInTheDocument()

    await user.click(synopsisToggle)

    const synopsisField = screen.getByPlaceholderText(zh.storyBibleSynopsisPlaceholder)
    expect(synopsisToggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(synopsisToggle.getAttribute('aria-controls') ?? '')).toContainElement(synopsisField)
  })

  it('migrates the legacy local draft into persisted workspace authority and restores it after reload', async () => {
    localStorage.setItem('niko.sb-braindump-v1', '本地灵感')
    localStorage.setItem('niko.sb-genres-v1', '奇幻,悬疑')
    localStorage.setItem('niko.sb-synopsis-v1', '本地概要')
    localStorage.setItem('niko.sb-outline-v1', '章节大纲')
    localStorage.setItem('niko.sb-style-v1', 'matchMy')

    const user = userEvent.setup()
    const { unmount } = render(<StoryBiblePanel />)

    expect(await screen.findByText(zh.storyBiblePersistenceTitle)).toBeInTheDocument()
    expect(screen.getByText(/权威模型/)).toBeInTheDocument()
    expect(screen.getByText(/导入 \/ 导出/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('本地灵感')).toBeInTheDocument()
    expect(screen.getAllByText('奇幻').length).toBeGreaterThan(0)
    expect(screen.getAllByText('悬疑').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(queryGraph).toHaveBeenCalledWith(expect.stringContaining('MERGE (n:Item'), expect.anything())
    })
    await waitFor(() => {
      expect(localStorage.getItem('niko.sb-braindump-v1')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: zh.storyBibleSynopsis }))
    expect(screen.getByDisplayValue('本地概要')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleOutline }))
    expect(screen.getByDisplayValue('章节大纲')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleStyleTitle }))
    expect(screen.getByRole('button', { name: new RegExp(`^${zh.storyBibleStyleMatchMy}`) })).toHaveAttribute('aria-pressed', 'true')

    unmount()
    render(<StoryBiblePanel />)

    expect(await screen.findByDisplayValue('本地灵感')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: zh.storyBibleSynopsis }))
    expect(screen.getByDisplayValue('本地概要')).toBeInTheDocument()
  }, 10000)

  it('exports compatibility drafts, imports persisted content, and keeps reset state after reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<StoryBiblePanel />)

    await user.click(await screen.findByTitle(zh.storyBibleExportDraft))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByText(zh.storyBibleDraftExported)).toBeInTheDocument()

    const importPayload = {
      version: '1.0',
      kind: 'story-bible-local-draft',
      exportedAt: '2026-04-07T00:00:00.000Z',
      draft: {
        braindump: '导入灵感',
        genres: ['科幻'],
        synopsis: '导入概要',
        outline: '导入大纲',
        style: 'custom',
      },
    }

    const input = screen.getByTestId('story-bible-import-input') as HTMLInputElement
    const file = new File([JSON.stringify(importPayload)], 'story-bible.json', { type: 'application/json' })
    await user.upload(input, file)

    expect(await screen.findByDisplayValue('导入灵感')).toBeInTheDocument()
    expect(screen.getAllByText('科幻').length).toBeGreaterThan(0)
    expect(screen.getByText(zh.storyBibleDraftImported)).toBeInTheDocument()

    await waitFor(() => {
      expect(persistedState.storyBible?.properties.braindump).toBe('导入灵感')
    })

    unmount()
    render(<StoryBiblePanel />)

    expect(await screen.findByDisplayValue('导入灵感')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: zh.storyBibleStyleTitle }))
    expect(screen.getByRole('button', { name: new RegExp(`^${zh.storyBibleStyleCustom}`) })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTitle(zh.storyBibleResetDraft))
    await waitFor(() => {
      const braindumpInputs = screen.getAllByPlaceholderText(zh.storyBibleBraindumpHint)
      expect(braindumpInputs[braindumpInputs.length - 1]).toHaveValue('')
    })
    expect(screen.getByText(zh.storyBibleDraftReset)).toBeInTheDocument()
    await waitFor(() => {
      expect(persistedState.storyBible?.properties.braindump).toBe('')
    })

    unmount()
    render(<StoryBiblePanel />)

    const reloadedBraindumpInputs = await screen.findAllByPlaceholderText(zh.storyBibleBraindumpHint)
    expect(reloadedBraindumpInputs[reloadedBraindumpInputs.length - 1]).toHaveValue('')
    expect(localStorage.getItem('niko.sb-braindump-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-genres-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-synopsis-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-outline-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-style-v1')).toBeNull()
  })

  it('adds deterministic semantics to the visible draft fields and hidden import input', async () => {
    render(<StoryBiblePanel />)

    const braindumpInput = await screen.findByLabelText(zh.storyBibleBraindump)
    const genreInput = screen.getByLabelText(zh.storyBibleGenrePlaceholder)
    const importInput = screen.getByTestId('story-bible-import-input')

    expect(braindumpInput).toHaveAttribute('id', 'story-bible-braindump')
    expect(braindumpInput).toHaveAttribute('name', 'story-bible-braindump')
    expect(genreInput).toHaveAttribute('id', 'story-bible-genre-input')
    expect(genreInput).toHaveAttribute('name', 'story-bible-genre-input')
    expect(importInput).toHaveAttribute('id', 'story-bible-import-input')
    expect(importInput).toHaveAttribute('name', 'story-bible-import-input')
    expect(importInput).toHaveAttribute('aria-label', zh.storyBibleImportDraft)
  })

  it('hides the inert generate CTA and gates synopsis promotion until synopsis content exists', async () => {
    const user = userEvent.setup()

    render(<StoryBiblePanel />)

    expect(screen.queryByRole('button', { name: zh.storyBibleGenerate })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: zh.storyBibleSynopsis }))

    const promoteButton = screen.getByRole('button', { name: '提升概要到 Canon' })
    expect(promoteButton).toBeDisabled()
    expect(screen.getByText('请先填写概要后再提升到 Canon。')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(zh.storyBibleSynopsisPlaceholder), '导入概要')

    expect(promoteButton).toBeEnabled()
    expect(screen.getByText('显式提升后的 canon 页面会出现在这里，并保持为只读检查视图。')).toBeInTheDocument()
  })

  it('keeps the local draft visible and surfaces an explicit failure state when graph save fails', async () => {
    const user = userEvent.setup()
    const originalQueryGraph = vi.mocked(queryGraph).getMockImplementation()

    vi.mocked(queryGraph).mockImplementation(async (cypher: string, options) => {
      if (cypher.startsWith('MERGE (n:Item')) {
        return {
          success: false,
          error: 'graph unavailable',
          data: undefined,
        }
      }
      return originalQueryGraph ? originalQueryGraph(cypher, options) : { success: true, data: [] }
    })

    try {
      render(<StoryBiblePanel />)

      expect(await screen.findByText(zh.storyBiblePersistenceTitle)).toBeInTheDocument()

      const braindumpInput = screen.getByPlaceholderText(zh.storyBibleBraindumpHint)
      await user.type(braindumpInput, '失败后也要保留的草稿')

      await waitFor(() => {
        expect(screen.getByDisplayValue('失败后也要保留的草稿')).toBeInTheDocument()
        expect(screen.getByText('Story Bible 保存失败，当前草稿已保留，请重试。')).toBeInTheDocument()
        expect(screen.getByText('同步失败，请稍后重试')).toBeInTheDocument()
      })
    } finally {
      if (originalQueryGraph) {
        vi.mocked(queryGraph).mockImplementation(originalQueryGraph)
      }
    }
  })



  it('authors workspace-scoped scene, event, and timeline records and activates them', async () => {
    const user = userEvent.setup()

    render(<StoryBiblePanel />)

    const scenesToggle = await screen.findByRole('button', { name: /场景 \(0\)/ })
    await user.click(scenesToggle)
    await user.type(screen.getByPlaceholderText('输入场景标题'), '开场戏')
    await user.type(screen.getByPlaceholderText('chapter-1'), 'chapter-1')
    await user.type(screen.getByPlaceholderText('1'), '1')
    await user.type(screen.getByPlaceholderText('记录场景目标、冲突、结果和关键线索。'), '主角第一次抵达港口。')
    await user.click(screen.getByRole('button', { name: '添加场景' }))

    await waitFor(() => {
      expect(persistedState.scenes).toHaveLength(1)
      expect(persistedState.scenes[0]?.properties).toMatchObject({
        itemKind: 'narrative-scene',
        kind: 'scene',
        title: '开场戏',
        chapterId: 'chapter-1',
        sceneOrder: 1,
        scopeAuthority: 'workspace',
        canonAuthority: 'canon-page',
        projectionAuthority: 'derived',
      })
    })
    expect(screen.getByText('场景已保存到当前工作区。')).toBeInTheDocument()

    const setActiveScene = await screen.findByRole('button', { name: '设为当前场景' })
    await user.click(setActiveScene)
    await screen.findByText(/当前场景: scene-default-project-开场戏/)

    const eventsToggle = screen.getByRole('button', { name: /事件 \(0\)/ })
    await user.click(eventsToggle)
    await user.type(screen.getByPlaceholderText('输入事件标题'), '抵达港口')
    await user.type(screen.getByPlaceholderText('scene-default-project-opening'), 'scene-default-project-开场戏')
    await user.type(screen.getByPlaceholderText('记录事件触发原因、参与者与后果。'), '抵达引发第一轮冲突。')
    await user.click(screen.getByRole('button', { name: '添加事件' }))

    await waitFor(() => {
      expect(persistedState.events).toHaveLength(1)
      expect(persistedState.events[0]?.properties).toMatchObject({
        itemKind: 'narrative-event',
        kind: 'event',
        title: '抵达港口',
        sceneId: 'scene-default-project-开场戏',
      })
    })
    const setActiveEvent = await screen.findByRole('button', { name: '设为当前事件' })
    await user.click(setActiveEvent)
    await screen.findByText(/当前事件: event-default-project-抵达港口/)

    const timelinesToggle = screen.getByRole('button', { name: /时间线 \(0\)/ })
    await user.click(timelinesToggle)
    await user.type(screen.getByPlaceholderText('输入时间线标题'), '主线时间')
    await user.selectOptions(screen.getByRole('combobox'), 'narrative')
    await user.type(screen.getByPlaceholderText('说明这条时间线覆盖的范围和排序原则。'), '按叙事顺序编排当前章节。')
    await user.click(screen.getByRole('button', { name: '添加时间线' }))

    await waitFor(() => {
      expect(persistedState.timelines).toHaveLength(1)
      expect(persistedState.timelines[0]?.properties).toMatchObject({
        itemKind: 'narrative-timeline',
        kind: 'timeline',
        title: '主线时间',
        mode: 'narrative',
      })
    })
    const setActiveTimeline = await screen.findByRole('button', { name: '设为当前时间线' })
    await user.click(setActiveTimeline)
    await screen.findByText(/当前时间线: timeline-default-project-主线时间/)
  }, 15000)

  it('promotes synopsis into canon and shows the canon review preview', async () => {
    const user = userEvent.setup()
    vi.mocked(listProjectWikiCanonPagesApi)
      .mockResolvedValueOnce({
        success: true,
        data: {
          available: true,
          reason: null,
          workspace_id: 'default-project',
          total_pages: 0,
          pages: [],
        },
      })
      .mockResolvedValue({
        success: true,
        data: {
          available: true,
          reason: null,
          workspace_id: 'default-project',
          total_pages: 1,
          pages: [
            {
              id: 'canon-1',
              slug: 'story-bible/default-project-synopsis',
              title: 'default-project Story Bible Synopsis',
              status: 'curated',
              file_path: 'story-bible/default-project-synopsis.md',
            },
          ],
        },
      })
    vi.mocked(readProjectWikiCanonPageApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-1',
          slug: 'story-bible/default-project-synopsis',
          title: 'default-project Story Bible Synopsis',
          status: 'curated',
          file_path: 'story-bible/default-project-synopsis.md',
          markdown: '# Canon\n\n导入概要',
        },
      },
    })

    render(<StoryBiblePanel />)

    await user.click(await screen.findByRole('button', { name: zh.storyBibleSynopsis }))
    const synopsisInput = screen.getByPlaceholderText(zh.storyBibleSynopsisPlaceholder)
    expect(screen.getByRole('button', { name: '提升概要到 Canon' })).toBeDisabled()
    await user.type(synopsisInput, '导入概要')
    expect(screen.getByRole('button', { name: '提升概要到 Canon' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '提升概要到 Canon' }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledWith(expect.objectContaining({
        title: 'default-project Story Bible Synopsis',
        body: '导入概要',
        slug: 'story-bible/default-project-synopsis',
        promotedFrom: 'story-bible',
        sourceRef: 'story-bible.synopsis',
      }), expect.anything())
    })
    expect(await screen.findByText('已将概要提升到 Canon。')).toBeInTheDocument()
    await waitFor(() => {
      expect(readProjectWikiCanonPageApi).toHaveBeenCalledWith(
        'story-bible/default-project-synopsis',
        expect.anything(),
      )
    })

    await user.click(screen.getByRole('button', { name: 'Canon Review' }))
    expect(
      screen.getByRole('button', {
        name: /default-project Story Bible Synopsis story-bible\/default-project-synopsis/,
      }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent('story-bible/default-project-synopsis.md')
    expect(document.body).toHaveTextContent('# Canon')
    expect(document.body).toHaveTextContent('导入概要')
  })
})
