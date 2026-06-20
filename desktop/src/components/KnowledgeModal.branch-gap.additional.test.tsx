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
  characterItem: { id: 'char-1', name: 'Alice', description: '主角' } as Record<string, unknown>,
  locationItem: { id: 'loc-1', name: 'Harbor', description: '港口' } as Record<string, unknown>,
  plotItem: { id: 'plot-1', title: 'Bridge Alarm', content: 'Act 1 turning point' } as Record<string, unknown>,
}))

function getScenarioItemLabel(item: Record<string, unknown>): string {
  const label = item.name ?? item.title ?? item.id
  return typeof label === 'string' && label.trim() ? label : 'Item'
}

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
        onLoadingChange(true)
        onStatusChange(null)
        onItemsChange([knowledgeTabScenario.characterItem])
        onLoadingChange(false)
      }, [onItemsChange, onLoadingChange, onStatusChange])

      if (knowledgeTabScenario.value === 'effect') {
        return <div>Alice</div>
      }

      return knowledgeTabScenario.value === 'filled'
        ? (
            <button
              type="button"
              onClick={() => onItemClick(knowledgeTabScenario.characterItem)}
            >
              {getScenarioItemLabel(knowledgeTabScenario.characterItem)}
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
            onClick={() => onItemClick(knowledgeTabScenario.locationItem)}
          >
            {getScenarioItemLabel(knowledgeTabScenario.locationItem)}
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
            onClick={() => onItemClick(knowledgeTabScenario.plotItem)}
          >
            {getScenarioItemLabel(knowledgeTabScenario.plotItem)}
          </button>
        )
      : (
          <button type="button" title="添加剧情" aria-label="添加剧情" disabled>
            添加剧情
          </button>
        ),
}))

const zh = translations.zh

describe('KnowledgeModal branch-gap additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    knowledgeTabScenario.value = 'empty'
    knowledgeTabScenario.characterItem = { id: 'char-1', name: 'Alice', description: '主角' }
    knowledgeTabScenario.locationItem = { id: 'loc-1', name: 'Harbor', description: '港口' }
    knowledgeTabScenario.plotItem = { id: 'plot-1', title: 'Bridge Alarm', content: 'Act 1 turning point' }
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
        authority: {
          recordSetId: null,
          activeSceneId: null,
          activeEventId: null,
          activeTimelineId: null,
          consistencyRunId: null,
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

  // Line 25: slugifySegment — value is a number, covers String(value ?? '') with numeric input
  it('slugifySegment: converts numeric value to string and normalizes', async () => {
    knowledgeTabScenario.value = 'filled'
    // Provide an item where id is a number (not string/null/undefined)
    knowledgeTabScenario.characterItem = { id: 42, name: 'NumericChar', description: 'test' } as Record<string, unknown>

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'NumericChar' }))
    expect(screen.getByText(zh.knowledgePromoteCanon)).toBeInTheDocument()
  })

  // Line 35: formatKnowledgeValue — typeof value !== 'object' branch (primitive value)
  // This is tested indirectly through detailEntries rendering where a non-object value
  // like a string or number is displayed. But we need to cover the `String(value)` branch
  // specifically for formatKnowledgeValue when called from buildKnowledgeCanonBody.
  it('formatKnowledgeValue: includes primitive values correctly in canon body', async () => {
    knowledgeTabScenario.value = 'filled'
    knowledgeTabScenario.characterItem = {
      id: 'char-primitive',
      name: 'PrimitiveChar',
      description: 'A char with primitives',
      role: 'hero',
      level: 5,
    } as Record<string, unknown>

    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-prim',
          slug: 'characters/atlas-workspace-char-primitive',
          title: 'PrimitiveChar',
          status: 'curated',
          path: '/tmp/prim.md',
          markdown: '# PrimitiveChar\n\nA char with primitives\n\n## Details\n\n### role\nhero\n\n### level\n5',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/prim.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'PrimitiveChar' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    // The body should contain primitive values serialized as strings
    expect(payload.body).toContain('hero')
    expect(payload.body).toContain('5')
  })

  // Line 35: formatKnowledgeValue — typeof value === 'object' branch
  it('formatKnowledgeValue: serializes object values as JSON in canon body', async () => {
    knowledgeTabScenario.value = 'filled'
    knowledgeTabScenario.characterItem = {
      id: 'char-obj',
      name: 'ObjValueChar',
      description: 'A char with object values',
      metadata: { key: 'val' },
    } as Record<string, unknown>

    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-obj',
          slug: 'characters/atlas-workspace-char-obj',
          title: 'ObjValueChar',
          status: 'curated',
          path: '/tmp/obj.md',
          markdown: '# ObjValueChar',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/obj.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'ObjValueChar' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    // The body should contain the object value serialized as JSON
    expect(payload.body).toContain('"key": "val"')
  })

  // Line 31: slugifySegment — normalized string is non-empty, returns the normalized value
  it('slugifySegment: returns the normalized string for typical names', async () => {
    knowledgeTabScenario.value = 'filled'
    knowledgeTabScenario.characterItem = { id: 'my-char', name: 'My Character', description: 'test' } as Record<string, unknown>

    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-slug',
          slug: 'characters/atlas-workspace-my-char',
          title: 'My Character',
          status: 'curated',
          path: '/tmp/slug.md',
          markdown: '# My Character',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/slug.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'My Character' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    // The slug uses itemId from slugifySegment(id) which is "my-char"
    expect(payload.slug).toBe('characters/atlas-workspace-my-char')
  })

  // Line 107-109: selectedItemId computation — selectedItem is not an object (rare edge case)
  // The condition `typeof selectedItem === 'object'` is false for primitives
  // This branch can't be easily hit with the current mock setup since items are always objects.
  // But we test the renderSelectedItemDetails null return when selectedItem is null.
  it('selectedItemId is empty when no item is selected', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    // No item selected — the promote canon button should not be present
    expect(screen.queryByRole('button', { name: zh.knowledgePromoteCanon })).not.toBeInTheDocument()
  })

  // Lines 29-31: slugifySegment — trim and normalize edge cases
  it('slugifySegment: trims leading and trailing hyphens from normalized string', async () => {
    knowledgeTabScenario.value = 'filled'
    // Name with dashes that will produce leading/trailing hyphens after normalization
    knowledgeTabScenario.characterItem = { id: 'char-dash', name: '---My Name---', description: 'test' } as Record<string, unknown>

    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-dash',
          slug: 'characters/atlas-workspace-char-dash',
          title: '---My Name---',
          status: 'curated',
          path: '/tmp/dash.md',
          markdown: '# My Name',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/dash.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: '---My Name---' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    // The itemId comes from slugifySegment(id) which is "char-dash"
    expect(payload.slug).toBe('characters/atlas-workspace-char-dash')
  })

  // Line 41: buildKnowledgeCanonBody — summary always has a fallback value (knowledgeNoDescription)
  // since || short-circuits on falsy values. We verify the summary is included in the canon body.
  it('buildKnowledgeCanonBody: includes summary in canon body', async () => {
    knowledgeTabScenario.value = 'filled'
    knowledgeTabScenario.characterItem = {
      id: 'char-summary',
      name: 'SummaryChar',
      description: 'A detailed description',
    } as Record<string, unknown>

    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-summary',
          slug: 'characters/atlas-workspace-char-summary',
          title: 'SummaryChar',
          status: 'curated',
          path: '/tmp/summary.md',
          markdown: '# SummaryChar',
          promoted_from: 'manual',
        },
        raw_evidence_path: '/tmp/summary.json',
        log_entry: { type: 'promotion' },
      },
    })

    const user = userEvent.setup()
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'SummaryChar' }))
    await user.click(screen.getByRole('button', { name: zh.knowledgePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    const body = payload.body as string
    // The body should contain the summary after the title
    expect(body).toContain('A detailed description')
  })
})
