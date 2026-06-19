import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCheckpointMock = vi.hoisted(() => vi.fn())
const listCheckpointsMock = vi.hoisted(() => vi.fn())
const restoreCheckpointMock = vi.hoisted(() => vi.fn())
const useAppStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  createCheckpoint: createCheckpointMock,
  listCheckpoints: listCheckpointsMock,
  restoreCheckpoint: restoreCheckpointMock,
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { useEvaluationCheckpoints } from './useEvaluationCheckpoints'

const texts = {
  loadingCheckpoints: 'load failed',
  evaluationCheckpointPlaceholder: 'checkpoint placeholder',
  save: 'save failed',
  restoreFailed: 'restore failed',
}

function buildAppState() {
  const currentWorkspace = createDefaultProjectWorkspaceContext({
    workspaceRoot: '/tmp/atlas-project',
    fallbackProjectId: 'atlas-project',
  })
  currentWorkspace.workflow.sessionId = null
  currentWorkspace.chat.conversationId = null
  return {
    currentConversationId: 'conversation-42',
    currentWorkspace,
  }
}

describe('useEvaluationCheckpoints', () => {
  let appState = buildAppState()

  beforeEach(() => {
    vi.clearAllMocks()
    appState = buildAppState()
    useAppStoreMock.mockImplementation((selector: (state: typeof appState) => unknown) => selector(appState))
  })

  it('loads checkpoints and injects fallback workflow/chat ids into the workspace payload', async () => {
    listCheckpointsMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'cp-1',
          description: 'Checkpoint A',
          created_at: '2026-06-03T00:00:00.000Z',
        },
      ],
    })

    const { result } = renderHook(() =>
      useEvaluationCheckpoints({
        t: texts,
        onRestoreSuccess: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.refreshCheckpoints()
    })

    expect(listCheckpointsMock).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        workflow: expect.objectContaining({ sessionId: 'conversation-42' }),
        chat: expect.objectContaining({ conversationId: 'conversation-42' }),
      }),
    )
    expect(result.current.checkpoints).toEqual([
      {
        id: 'cp-1',
        description: 'Checkpoint A',
        created_at: '2026-06-03T00:00:00.000Z',
      },
    ])
    expect(result.current.checkpointError).toBeNull()
  })

  it('reports refresh failures for both unsuccessful and thrown list calls', async () => {
    listCheckpointsMock
      .mockResolvedValueOnce({ success: false, data: [] })
      .mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useEvaluationCheckpoints({
        t: texts,
        onRestoreSuccess: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.refreshCheckpoints()
    })
    expect(result.current.checkpointError).toBe('load failed')

    await act(async () => {
      await result.current.refreshCheckpoints()
    })
    expect(result.current.checkpointError).toBe('load failed')
  })

  it('creates checkpoints with placeholder fallback, resets input on success, and surfaces create errors', async () => {
    listCheckpointsMock.mockResolvedValue({
      success: true,
      data: [],
    })
    createCheckpointMock
      .mockResolvedValueOnce({
        success: true,
        data: { checkpoint_id: 'cp-2' },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'checkpoint write failed',
      })
      .mockResolvedValueOnce({
        success: false,
      })
      .mockRejectedValueOnce(new Error('disk full'))

    const { result } = renderHook(() =>
      useEvaluationCheckpoints({
        t: texts,
        onRestoreSuccess: vi.fn(),
      }),
    )

    act(() => {
      result.current.setCheckpointDescription('Named checkpoint')
    })

    await act(async () => {
      await result.current.handleCreateCheckpoint()
    })

    expect(createCheckpointMock).toHaveBeenNthCalledWith(
      1,
      'Named checkpoint',
      undefined,
      expect.objectContaining({
        workflow: expect.objectContaining({ sessionId: 'conversation-42' }),
      }),
    )
    expect(result.current.checkpointDescription).toBe('')
    expect(listCheckpointsMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.handleCreateCheckpoint()
    })
    expect(createCheckpointMock).toHaveBeenNthCalledWith(
      2,
      'checkpoint placeholder',
      undefined,
      expect.any(Object),
    )
    expect(result.current.checkpointError).toBe('checkpoint write failed')

    await act(async () => {
      await result.current.handleCreateCheckpoint()
    })
    expect(result.current.checkpointError).toBe('save failed')

    await act(async () => {
      await result.current.handleCreateCheckpoint()
    })
    expect(result.current.checkpointError).toBe('save failed')
  })

  it('restores checkpoints, calls success handlers, refreshes on success, and maps restore failures', async () => {
    const onRestoreSuccess = vi.fn().mockResolvedValue(undefined)
    listCheckpointsMock.mockResolvedValue({
      success: true,
      data: [],
    })
    restoreCheckpointMock
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'restored' },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'checkpoint missing',
      })
      .mockResolvedValueOnce({
        success: false,
      })
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() =>
      useEvaluationCheckpoints({
        t: texts,
        onRestoreSuccess,
      }),
    )

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-9')
    })

    expect(restoreCheckpointMock).toHaveBeenNthCalledWith(
      1,
      'cp-9',
      expect.objectContaining({
        workflow: expect.objectContaining({ sessionId: 'conversation-42' }),
        chat: expect.objectContaining({ conversationId: 'conversation-42' }),
      }),
    )
    expect(onRestoreSuccess).toHaveBeenCalledWith('cp-9')
    await waitFor(() => {
      expect(listCheckpointsMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-10')
    })
    expect(result.current.checkpointError).toBe('checkpoint missing')

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-11')
    })
    expect(result.current.checkpointError).toBe('restore failed')

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-12')
    })
    expect(result.current.checkpointError).toBe('restore failed')
  })
})
