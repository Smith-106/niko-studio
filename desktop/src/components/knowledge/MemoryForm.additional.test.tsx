import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MemoryForm } from './MemoryForm'
import { useAppStore } from '../../stores/appStore'

const mocks = vi.hoisted(() => ({
  getTemporalFacts: vi.fn(),
  getCharacter: vi.fn(),
  getForeshadows: vi.fn(),
  addMemory: vi.fn(),
  plantForeshadow: vi.fn(),
  getForeshadowStats: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  getTemporalFacts: mocks.getTemporalFacts,
  getCharacter: mocks.getCharacter,
  getForeshadows: mocks.getForeshadows,
  addMemory: mocks.addMemory,
}))

vi.mock('../../api/knowledge', () => ({
  plantForeshadow: mocks.plantForeshadow,
  getForeshadowStats: mocks.getForeshadowStats,
}))

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: {
      knowledgeTemporalTitle: 'Temporal facts',
      knowledgeTemporalEntityPlaceholder: 'Entity ID',
      knowledgeTemporalAtTimePlaceholder: 'At time',
      knowledgeTemporalAction: 'Load temporal facts',
      knowledgeTemporalEntityRequired: 'Entity ID is required',
      knowledgeTemporalLoaded: 'Temporal facts loaded',
      knowledgeCharacterTitle: 'Character details',
      knowledgeCharacterNamePlaceholder: 'Character name',
      knowledgeCharacterAction: 'Load character',
      knowledgeCharacterNameRequired: 'Character name is required',
      knowledgeCharacterLoaded: 'Character loaded',
      knowledgeForeshadowTitle: 'Foreshadows',
      knowledgeForeshadowStatusPlaceholder: 'Status',
      knowledgeForeshadowStatusPending: 'Pending',
      knowledgeForeshadowStatusResolved: 'Resolved',
      knowledgeForeshadowStatusAll: 'All',
      knowledgeForeshadowChapterPlaceholder: 'Chapter',
      knowledgeForeshadowAction: 'Load foreshadows',
      knowledgeForeshadowsLoaded: 'Foreshadows loaded',
      knowledgeForeshadowPlantDescPlaceholder: 'Plant description',
      knowledgeForeshadowPlantAction: 'Plant foreshadow',
      knowledgeForeshadowPlanted: 'Foreshadow planted',
      knowledgeForeshadowStatsLoaded: 'Foreshadow stats loaded',
      knowledgeForeshadowHinted: 'Hinted',
      knowledgeForeshadowHarvested: 'Harvested',
      knowledgeMemoryTitle: 'Add memory',
      knowledgeMemoryContentPlaceholder: 'Memory content',
      knowledgeMemoryLayerPlaceholder: 'Layer',
      knowledgeMemoryDimensionPlaceholder: 'Dimension',
      knowledgeMemoryEntityPlaceholder: 'Memory entity',
      knowledgeMemoryTagsPlaceholder: 'Tags',
      knowledgeMemoryAction: 'Add memory',
      knowledgeMemoryContentRequired: 'Memory content is required',
      knowledgeMemoryAdded: 'Memory added',
      knowledgeRequestFailed: 'Request failed',
      knowledgeNoDescription: 'No description',
    },
  }),
}))

function resetWorkspace() {
  useAppStore.setState((state) => ({
    ...state,
    backendStatus: false,
    currentWorkspace: {
      schemaVersion: '2026-04-08',
      identity: {
        workspaceId: 'default-project',
        projectId: 'default-project',
        projectName: 'Test',
        workspaceRoot: '/tmp/test',
      },
      knowledge: { focusEntityId: '', graphEntityIds: [], memoryEntryIds: [] },
      authority: {
        recordSetId: null,
        activeSceneId: null,
        activeEventId: null,
        activeTimelineId: null,
        consistencyRunId: null,
      },
      manuscript: {
        manuscriptId: null,
        title: null,
        chapterId: null,
        chapterTitle: null,
        chapterNumber: null,
      },
      storyBible: {
        storyBibleId: null,
        draftId: null,
        version: null,
        storage: 'workspace',
      },
      workflow: {
        sessionId: null,
        planId: null,
        level: 'L3',
      },
      chat: {
        conversationId: null,
        comparisonEnabled: false,
      },
      compatibility: {
        additiveContract: true,
        migratedLegacyFields: [],
        notes: [],
      },
    },
  }))
}

describe('MemoryForm additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetWorkspace()
    mocks.getTemporalFacts.mockResolvedValue({ success: true, data: [] })
    mocks.getCharacter.mockResolvedValue({
      success: true,
      data: { name: 'Alice', role: 'Guide', relationships: { Bob: 'Friend' } },
    })
    mocks.getForeshadows.mockResolvedValue({ success: true, data: [] })
    mocks.addMemory.mockResolvedValue({ success: true, data: { id: 'mem-1' } })
    mocks.plantForeshadow.mockResolvedValue({ success: true, data: { data: { id: 'fo-1' } } })
    mocks.getForeshadowStats.mockResolvedValue({
      success: true,
      data: {
          by_state: { planted: 2, hinted: 3, harvested: 1 },
      },
    })
  })

  it('falls back to no description when a character has no relationships', async () => {
    const user = userEvent.setup()
    const onItemsChange = vi.fn()

    mocks.getCharacter.mockResolvedValue({
      success: true,
      data: { name: 'Solo', role: 'Scout', relationships: undefined },
    })

    render(<MemoryForm onStatusChange={vi.fn()} onItemsChange={onItemsChange} />)

    await user.type(screen.getByLabelText('Character name'), 'Solo')
    await user.click(screen.getByRole('button', { name: 'Load character' }))

    await waitFor(() => {
      expect(onItemsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'Solo',
          description: 'No description',
        }),
      ])
    })
  })

  it('validates the plant description before sending the request', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Plant foreshadow' }))

    expect(mocks.plantForeshadow).not.toHaveBeenCalled()
    expect(onStatusChange).toHaveBeenCalledWith({
      type: 'error',
      message: 'Plant description',
    })
  })

  it('plants a foreshadow, refreshes stats, and clears the input', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    const input = screen.getByLabelText('Plant description') as HTMLInputElement
    await user.type(input, 'Seed an omen in chapter three')
    await user.click(screen.getByRole('button', { name: 'Plant foreshadow' }))

    await waitFor(() => {
      expect(mocks.plantForeshadow).toHaveBeenCalledWith('Seed an omen in chapter three')
      expect(mocks.getForeshadowStats).toHaveBeenCalled()
    })

    expect(onStatusChange).toHaveBeenCalledWith({
      type: 'success',
      message: 'Foreshadow planted',
    })
    expect(onStatusChange).toHaveBeenCalledWith({
      type: 'success',
      message: 'Foreshadow stats loaded',
    })
    expect(input.value).toBe('')
    expect(screen.getByText('Foreshadow planted: 2')).toBeInTheDocument()
    expect(screen.getByText('Hinted: 3')).toBeInTheDocument()
    expect(screen.getByText('Harvested: 1')).toBeInTheDocument()
  })

  it('surfaces foreshadow plant failures', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    mocks.plantForeshadow.mockResolvedValue({
      success: false,
      error: 'Unable to plant foreshadow',
    })

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    await user.type(screen.getByLabelText('Plant description'), 'Broken branch')
    await user.click(screen.getByRole('button', { name: 'Plant foreshadow' }))

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'error',
        message: 'Unable to plant foreshadow',
      })
    })
  })

  it('falls back to the generic request failure when planting a foreshadow returns no error text', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    mocks.plantForeshadow.mockResolvedValue({
      success: false,
    })

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    await user.type(screen.getByLabelText('Plant description'), 'Silent failure')
    await user.click(screen.getByRole('button', { name: 'Plant foreshadow' }))

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'error',
        message: 'Request failed',
      })
    })
  })

  it('surfaces foreshadow stats failures from the stats button', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    mocks.getForeshadowStats.mockResolvedValue({
      success: false,
      error: 'Stats are unavailable',
    })

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'error',
        message: 'Stats are unavailable',
      })
    })
  })

  it('falls back to the generic request failure when foreshadow stats return no error text', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    mocks.getForeshadowStats.mockResolvedValue({
      success: false,
    })

    render(<MemoryForm onStatusChange={onStatusChange} onItemsChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        type: 'error',
        message: 'Request failed',
      })
    })
  })
})
