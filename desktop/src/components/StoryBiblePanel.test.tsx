import { beforeEach, describe, expect, it, vi } from 'vitest'
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
}))

const canonApiState = vi.hoisted(() => ({
  list: vi.fn(),
  promote: vi.fn(),
  read: vi.fn(),
}))

function extractMergePayload(cypher: string): Record<string, unknown> {
  const setStart = cypher.indexOf(' SET ')
  const returnStart = cypher.lastIndexOf(' RETURN n')
  return JSON.parse(cypher.slice(setStart + 5, returnStart))
}

vi.mock('../api/client', () => ({
  queryGraph: vi.fn(async (cypher: string) => {
    if (cypher.startsWith('MERGE (n:Item')) {
      const payload = extractMergePayload(cypher)
      const timestamp = new Date().toISOString()
      persistedState.storyBible = {
        id: 'story-bible-1',
        type: 'Item',
        name: String(payload.name ?? 'story-bible'),
        properties: payload,
        created_at: persistedState.storyBible?.created_at ?? timestamp,
        updated_at: timestamp,
      }
      return { success: true, data: [{ n: persistedState.storyBible }] }
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
  beforeEach(() => {
    persistedState.storyBible = null
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
  })

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
    await user.type(synopsisInput, '导入概要')

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
