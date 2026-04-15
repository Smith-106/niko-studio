import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeModal } from './KnowledgeModal'
import { promoteProjectWikiCanonApi } from '../api/client'
import { translations } from '../i18n'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'

const knowledgeTabScenario = vi.hoisted(() => ({
  value: 'empty' as 'empty' | 'filled' | 'effect',
  characterLoadEffectRuns: 0,
}))

vi.mock('../api/client', () => ({
  searchMemory: vi.fn(),
  queryGraph: vi.fn(),
  listSkills: vi.fn(),
  loadSkill: vi.fn(),
  matchSkills: vi.fn(),
  getSkillChain: vi.fn(),
  getTemporalFacts: vi.fn(),
  getCharacter: vi.fn(),
  getForeshadows: vi.fn(),
  addMemory: vi.fn(),
  promoteProjectWikiCanonApi: vi.fn(),
}))

vi.mock('./knowledge/CharacterTab', async () => {
  const React = await import('react')

  return {
    CharacterTab: ({
      onItemClick,
      onItemsChange,
      onLoadingChange,
      onStatusChange,
    }: {
      onItemClick: (item: Record<string, unknown>) => void
      onItemsChange: (items: Array<Record<string, unknown>>) => void
      onLoadingChange: (loading: boolean) => void
      onStatusChange: (status: unknown) => void
    }) => {
      React.useEffect(() => {
        if (knowledgeTabScenario.value !== 'effect') return

        knowledgeTabScenario.characterLoadEffectRuns += 1
        if (knowledgeTabScenario.characterLoadEffectRuns > 1) {
          throw new Error('knowledge load effect retriggered')
        }

        onLoadingChange(true)
        onStatusChange(null)
        onItemsChange([{ id: 'char-1', name: 'Alice', description: '主角' }])
        onLoadingChange(false)
      }, [onItemsChange, onLoadingChange, onStatusChange])

      if (knowledgeTabScenario.value === 'effect') {
        return <div>Alice</div>
      }

      return knowledgeTabScenario.value === 'filled'
        ? (
            <button
              type="button"
              onClick={() => onItemClick({ id: 'char-1', name: 'Alice', description: '主角' })}
            >
              Alice
            </button>
          )
        : (
            <button type="button" title="添加角色" aria-label="添加角色" disabled>
              添加角色
            </button>
          )
    },
  }
})

vi.mock('./knowledge/LocationTab', () => ({
  LocationTab: ({ onItemClick }: { onItemClick: (item: Record<string, unknown>) => void }) =>
    knowledgeTabScenario.value === 'filled'
      ? (
          <button
            type="button"
            onClick={() => onItemClick({ id: 'loc-1', name: 'Harbor', description: '港口' })}
          >
            Harbor
          </button>
        )
      : (
          <button type="button" title="添加地点" aria-label="添加地点" disabled>
            添加地点
          </button>
        ),
}))

vi.mock('./knowledge/PlotTab', () => ({
  PlotTab: ({ onItemClick }: { onItemClick: (item: Record<string, unknown>) => void }) =>
    knowledgeTabScenario.value === 'filled'
      ? (
          <button
            type="button"
            onClick={() =>
              onItemClick({ id: 'plot-1', title: 'Bridge Alarm', content: 'Act 1 turning point' })
            }
          >
            Bridge Alarm
          </button>
        )
      : (
          <button type="button" title="添加剧情" aria-label="添加剧情" disabled>
            添加剧情
          </button>
        ),
}))

const zh = translations.zh
const en = translations.en

describe('KnowledgeModal accessibility and labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    knowledgeTabScenario.value = 'empty'
    knowledgeTabScenario.characterLoadEffectRuns = 0
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    useAppStore.setState({
      currentWorkspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-2',
          chapterTitle: null,
          chapterNumber: 2,
        },
        storyBible: {
          storyBibleId: null,
          draftId: 'draft-2',
          version: null,
          storage: 'workspace',
        },
        knowledge: {
          focusEntityId: null,
          graphEntityIds: [],
          memoryEntryIds: [],
        },
        workflow: {
          sessionId: 'workflow-session-2',
          planId: null,
          level: 'L3',
        },
        chat: {
          conversationId: 'conversation-2',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    })
  })

  it('renders as named dialog and supports escape close', async () => {
    const onClose = vi.fn()
    render(<KnowledgeModal isOpen onClose={onClose} />)

    expect(await screen.findByRole('dialog', { name: zh.knowledgeTitle })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps child load callbacks stable across modal rerenders', async () => {
    knowledgeTabScenario.value = 'effect'

    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('dialog', { name: zh.knowledgeTitle })).toBeInTheDocument()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(knowledgeTabScenario.characterLoadEffectRuns).toBe(1)
  })

  it('renders i18n tab labels and search control', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('button', { name: zh.knowledgeTabCharacters })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabLocations })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabPlots })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabSkills })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: zh.knowledgeSearchPlaceholder })).toBeInTheDocument()
  })

  it('renders zh-only labels for temporal, character, foreshadow, and memory forms', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByText(zh.knowledgeTemporalTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeTemporalEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeTemporalAtTimePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTemporalAction })).toBeInTheDocument()

    expect(screen.getByText(zh.knowledgeCharacterTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeCharacterNamePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeCharacterAction })).toBeInTheDocument()

    expect(screen.getByText(zh.knowledgeForeshadowTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeForeshadowStatusPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeForeshadowChapterPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeForeshadowAction })).toBeInTheDocument()

    expect(screen.getAllByText(zh.knowledgeMemoryTitle)).toHaveLength(2)
    expect(screen.getByLabelText(zh.knowledgeMemoryContentPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryLayerPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryDimensionPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryTagsPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeMemoryAction })).toBeInTheDocument()
  })

  it('renders en-only labels for temporal, character, foreshadow, and memory forms', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('dialog', { name: en.knowledgeTitle })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeTemporalTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeTemporalEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeTemporalAtTimePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeTemporalAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeCharacterTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeCharacterNamePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeCharacterAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeForeshadowTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeForeshadowStatusPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeForeshadowChapterPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeForeshadowAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeMemoryTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryContentPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryLayerPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryDimensionPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryTagsPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeMemoryAction })).toBeInTheDocument()
  })

  it('shows read-only details for character, location, and plot selections', async () => {
    knowledgeTabScenario.value = 'filled'

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Alice' }))
    expect(screen.getAllByText('主角').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: zh.knowledgeTabLocations }))
    await user.click(screen.getByRole('button', { name: 'Harbor' }))
    expect(screen.getAllByText('港口').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: zh.knowledgeTabPlots }))
    await user.click(screen.getByRole('button', { name: 'Bridge Alarm' }))
    expect(screen.getAllByText('Act 1 turning point').length).toBeGreaterThan(0)
  })

  it('promotes a selected knowledge item into canon', async () => {
    knowledgeTabScenario.value = 'filled'
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-knowledge-1',
          slug: 'characters/atlas-workspace-char-1',
          title: 'Alice',
          status: 'curated',
          path: '/tmp/alice.md',
          markdown: '# Alice',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/alice.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Alice' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })
    const [payload, workspace] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    expect(payload).toMatchObject({
      title: 'Alice',
      slug: 'characters/atlas-workspace-char-1',
      promotedFrom: 'manual',
      sourceId: 'char-1',
      sourceRef: 'knowledge.characters.char-1',
      rawEvidence: {
        relativePath: 'imports/knowledge/characters/atlas-workspace-char-1.json',
        content: JSON.stringify({ id: 'char-1', name: 'Alice', description: '主角' }, null, 2),
      },
      metadata: {
        source_surface: 'knowledge-modal',
        knowledge_tab: 'characters',
        item_id: 'char-1',
        workflow_session_id: 'workflow-session-2',
        chapter_id: 'chapter-2',
      },
    })
    expect(workspace).toMatchObject({
      identity: {
        workspaceId: 'atlas-workspace',
      },
    })
    expect(screen.getByText(zh.knowledgePromoteCanonSuccess)).toBeInTheDocument()
  })

  it('renders disabled create affordances for empty non-skill tabs', async () => {
    knowledgeTabScenario.value = 'empty'

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(screen.getByTitle(zh.knowledgeAddPrefix + zh.knowledgeTabCharacters)).toBeDisabled()

    await user.click(screen.getByRole('button', { name: zh.knowledgeTabLocations }))
    expect(screen.getByTitle(zh.knowledgeAddPrefix + zh.knowledgeTabLocations)).toBeDisabled()

    await user.click(screen.getByRole('button', { name: zh.knowledgeTabPlots }))
    expect(screen.getByTitle(zh.knowledgeAddPrefix + zh.knowledgeTabPlots)).toBeDisabled()
  })
})
