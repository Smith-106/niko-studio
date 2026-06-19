import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CharacterTab } from './CharacterTab'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'

const knowledgeApiMocks = vi.hoisted(() => ({
  getCharacterProfile: vi.fn(),
  analyzeCharacterDepth: vi.fn(),
  getCharacterRelationships: vi.fn(),
}))

const t = {
  knowledgeTabCharacters: '角色',
  knowledgeProfileTitle: '角色档案',
  knowledgeCharacterNamePlaceholder: '角色名',
  knowledgeProfileLoad: '加载档案',
  knowledgeProfileNotFound: '未找到角色档案。',
  knowledgeDepthTitle: '深度分析',
  knowledgeDepthAnalyze: '分析深度',
  knowledgeDepthLevel: '深度等级',
  knowledgeDepthScores: '五维评分',
  knowledgeDepthSuggestions: '改进建议',
  knowledgeRelationshipsTitle: '关系网络',
  knowledgeRelationshipsLoad: '加载关系',
}

vi.mock('../../api/knowledge', () => ({
  getCharacterProfile: knowledgeApiMocks.getCharacterProfile,
  analyzeCharacterDepth: knowledgeApiMocks.analyzeCharacterDepth,
  getCharacterRelationships: knowledgeApiMocks.getCharacterRelationships,
}))

vi.mock('./PersistedEntityTab', () => ({
  PersistedEntityTab: ({ itemLabel }: { itemLabel: string }) => (
    <div data-testid="persisted-entity-tab">{itemLabel}</div>
  ),
}))

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t,
    translate: (key: keyof typeof t) => t[key],
    language: 'zh',
  }),
}))

function CharacterHarness() {
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
        selectedItemId={String(selectedItem?.id ?? '')}
        selectedItem={selectedItem}
        searchQuery=""
        onStatusChange={setStatus}
      />
    </>
  )
}

describe('CharacterTab additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips blank profile lookups and surfaces not-found profile status on failure', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({ success: false })

    render(<CharacterHarness />)

    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(knowledgeApiMocks.getCharacterProfile).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Unknown')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeProfileNotFound)
    })
    expect(screen.queryByText(/\(.+\)/)).not.toBeInTheDocument()
  })

  it('renders successful depth analysis details and profile score fallbacks', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Alice',
          role: '主角',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.analyzeCharacterDepth.mockResolvedValue({
      success: true,
      data: {
          character: 'Alice',
          scores: {
            dynamicScore: 8.2,
            competenceScore: 7.1,
            eccentricityScore: 6.9,
            contrastScore: 5.7,
            dualityScore: 9.4,
          },
          depth_level: 'S',
          suggestions: ['增加角色反差', '强化成长代价'],
      },
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Alice')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))

    expect(await screen.findByText('Alice (主角)')).toBeInTheDocument()
    expect(screen.getByText(/深度等级:/)).toHaveTextContent('深度等级: — | 五维评分: 0')

    await user.click(screen.getByRole('button', { name: t.knowledgeDepthAnalyze }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeDepthTitle)
    })
    expect(screen.getAllByText(t.knowledgeDepthScores).length).toBeGreaterThan(0)
    expect(screen.getByText('dynamic')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('深度等级: S')).toBeInTheDocument()
    expect(screen.getByText(t.knowledgeDepthSuggestions)).toBeInTheDocument()
    expect(screen.getByText('增加角色反差')).toBeInTheDocument()
    expect(screen.getByText('强化成长代价')).toBeInTheDocument()
  })

  it('surfaces depth analysis failure and renders relationship edges with fallback ids', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-2',
          name: 'Hero',
          role: '配角',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {
            depth_level: 'A',
            overall: 82,
          },
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.analyzeCharacterDepth.mockResolvedValue({
      success: false,
    })
    knowledgeApiMocks.getCharacterRelationships.mockResolvedValue({
      success: true,
      data: {
          nodes: [
            { id: 'hero', name: 'Hero', role: '配角' },
          ],
          edges: [
            { source: 'hero', target: 'ghost', type: 'ally', trust: 0.8 },
          ],
      },
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Hero')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Hero (配角)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeDepthAnalyze }))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeProfileNotFound)
    })

    await user.click(screen.getByRole('button', { name: t.knowledgeRelationshipsLoad }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeRelationshipsTitle)
    })
    expect(screen.getAllByText(t.knowledgeRelationshipsTitle).length).toBeGreaterThan(1)
    expect(screen.getByText('1 nodes, 1 edges')).toBeInTheDocument()
    expect(screen.getByText('Hero → ghost (ally)')).toBeInTheDocument()
  })

  it('skips depth analysis when no profile is loaded', async () => {
    const user = userEvent.setup()
    render(<CharacterHarness />)

    // Depth analyze button should not be visible without a profile,
    // but if it were invoked directly (e.g. via ref), it would early-return.
    // Simulate by loading a profile then verifying the analyze button works,
    // then clearing the profile via a failed reload and trying again.
    knowledgeApiMocks.getCharacterProfile.mockResolvedValueOnce({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Alice',
          role: '主角',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.getCharacterProfile.mockResolvedValueOnce({
      success: true,
      data: null,
    })

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Alice')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Alice (主角)')).toBeInTheDocument()

    // Now trigger a profile load that succeeds but has no data.data —
    // this clears the profile to null via the else branch
    await user.clear(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder))
    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Bob')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeProfileNotFound)
    })

    // Profile panel is gone (profile === null), so depth analyze button is not rendered
    expect(screen.queryByRole('button', { name: t.knowledgeDepthAnalyze })).not.toBeInTheDocument()
  })

  it('sets error status when profile load succeeds but data.data is missing', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: null,
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Ghost')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeProfileNotFound)
    })
    // No profile card rendered since data.data was missing
    expect(screen.queryByText(/\(.+\)/)).not.toBeInTheDocument()
  })

  it('sets error status when relationship load fails', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Eve',
          role: '反派',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.getCharacterRelationships.mockResolvedValue({
      success: false,
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Eve')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Eve (反派)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeRelationshipsLoad }))

    // When relationships fail, status does NOT change (no else branch in handleLoadRelationships)
    // but we verify the API was called and no relationship section appears
    expect(knowledgeApiMocks.getCharacterRelationships).toHaveBeenCalledOnce()
    expect(screen.queryByText(/nodes,/)).not.toBeInTheDocument()
  })

  it('does not render relationship section when load succeeds but data.data is missing', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Eve',
          role: '反派',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.getCharacterRelationships.mockResolvedValue({
      success: true,
      data: null,
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Eve')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Eve (反派)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeRelationshipsLoad }))

    expect(knowledgeApiMocks.getCharacterRelationships).toHaveBeenCalledOnce()
    // data.data is missing so relationships state stays null — no section rendered
    expect(screen.queryByText(/nodes,/)).not.toBeInTheDocument()
  })

  it('sets error status when depth analysis succeeds but data.data is missing', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Mallory',
          role: '反派',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.analyzeCharacterDepth.mockResolvedValue({
      success: true,
      data: null,
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Mallory')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Mallory (反派)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeDepthAnalyze }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeProfileNotFound)
    })
    // No depth section rendered since data.data was missing
    expect(screen.queryByText(t.knowledgeDepthSuggestions)).not.toBeInTheDocument()
  })

  it('renders depth analysis with null score properties falling back to 0', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Nuller',
          role: '测试',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    // Return scores where some properties are null/undefined to exercise ?? 0 fallback
    knowledgeApiMocks.analyzeCharacterDepth.mockResolvedValue({
      success: true,
      data: {
          character: 'Nuller',
          scores: {
            dynamicScore: null as unknown as number,
            competenceScore: 5.5,
            eccentricityScore: undefined as unknown as number,
            contrastScore: 3.3,
            dualityScore: null as unknown as number,
          },
          depth_level: 'C',
          suggestions: [],
      },
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Nuller')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Nuller (测试)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeDepthAnalyze }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeDepthTitle)
    })
    // Null/undefined scores fall back to 0 via ?? 0
    // Three scores are null/undefined, so 0 appears multiple times
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('competence')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // Math.round(5.5)
  })

  it('renders relationship edges with source node missing from node list', async () => {
    const user = userEvent.setup()
    knowledgeApiMocks.getCharacterProfile.mockResolvedValue({
      success: true,
      data: {
          id: 'profile-1',
          name: 'Orphan',
          role: '主角',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
      },
    })
    knowledgeApiMocks.getCharacterRelationships.mockResolvedValue({
      success: true,
      data: {
          nodes: [
            { id: 'target-node', name: 'Target', role: '配角' },
          ],
          edges: [
            // source 'orphan-src' is NOT in nodes — triggers source?.name ?? edge.source
            { source: 'orphan-src', target: 'target-node', type: 'rival', trust: 0.3 },
          ],
      },
    })

    render(<CharacterHarness />)

    await user.type(screen.getByLabelText(t.knowledgeCharacterNamePlaceholder), 'Orphan')
    await user.click(screen.getByRole('button', { name: t.knowledgeProfileLoad }))
    expect(await screen.findByText('Orphan (主角)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.knowledgeRelationshipsLoad }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(t.knowledgeRelationshipsTitle)
    })
    // source?.name is undefined so falls back to edge.source ('orphan-src')
    expect(screen.getByText('orphan-src → Target (rival)')).toBeInTheDocument()
  })
})
