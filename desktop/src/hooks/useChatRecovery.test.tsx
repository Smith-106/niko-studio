import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCheckpointMock = vi.hoisted(() => vi.fn())
const restoreCheckpointMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  createCheckpoint: createCheckpointMock,
  restoreCheckpoint: restoreCheckpointMock,
}))

vi.mock('../stores/appStore', () => {
  const state = {
    currentConversationId: 'conv-1',
    currentWorkspace: {
      identity: { workspaceId: 'ws-1', projectId: 'proj-1', projectName: null, workspaceRoot: null },
      manuscript: { manuscriptId: null, title: null, chapterId: null, chapterTitle: null, chapterNumber: null },
      storyBible: { storyBibleId: null, draftId: null, version: null, storage: 'workspace' },
      knowledge: { focusEntityId: null, graphEntityIds: [], memoryEntryIds: [] },
      workflow: { sessionId: 'sess-1', planId: null, level: null },
      chat: { conversationId: 'conv-1', comparisonEnabled: null },
      compatibility: { additiveContract: true, migratedLegacyFields: [], notes: [] },
      schemaVersion: '2026-04-08',
    },
  }
  return {
    useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  }
})

import { useChatRecovery } from './useChatRecovery'

const defaultT = {
  streamReconnecting: 'Reconnecting...',
  streamRecovered: 'Stream recovered',
  streamInterrupted: 'Stream interrupted',
  streamRestoreBeforeSendSuccess: 'Checkpoint restored',
  restoreFailed: 'Restore failed',
}

type TestConnectionState = 'connected' | 'degraded' | 'disconnected' | 'reconnecting'

describe('useChatRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with null checkpoint and recover status', () => {
    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    expect(result.current.recoverableCheckpointId).toBeNull()
    expect(result.current.recoverStatus).toBeNull()
  })

  it('sets reconnecting status when connection state changes to reconnecting', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
      { initialProps: { state: 'connected' as TestConnectionState } },
    )

    rerender({ state: 'reconnecting' as TestConnectionState })

    expect(result.current.recoverStatus?.type).toBe('error')
    expect(result.current.recoverStatus?.message).toBe('Reconnecting...')
  })

  it('sets recovered status when transitioning from reconnecting to connected', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
      { initialProps: { state: 'reconnecting' as TestConnectionState } },
    )

    rerender({ state: 'connected' as TestConnectionState })

    expect(result.current.recoverStatus?.type).toBe('success')
    expect(result.current.recoverStatus?.message).toBe('Stream recovered')
  })

  it('sets disconnected status when connection state changes', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
      { initialProps: { state: 'connected' as TestConnectionState } },
    )

    rerender({ state: 'disconnected' as TestConnectionState })

    expect(result.current.recoverStatus?.type).toBe('error')
    expect(result.current.recoverStatus?.message).toBe('Stream interrupted')
  })

  it('does not update status when connection state stays the same', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
      { initialProps: { state: 'connected' as TestConnectionState } },
    )

    rerender({ state: 'connected' as TestConnectionState })

    expect(result.current.recoverStatus).toBeNull()
  })

  it('createBeforeSendCheckpoint stores checkpoint id on success', async () => {
    createCheckpointMock.mockResolvedValue({
      success: true,
      data: { checkpoint_id: 'cp-1', commit_hash: 'abc123' },
    })

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.createBeforeSendCheckpoint('pre-send')
    })

    expect(result.current.recoverableCheckpointId).toBe('cp-1')
  })

  it('createBeforeSendCheckpoint does not store id on failure', async () => {
    createCheckpointMock.mockResolvedValue({
      success: false,
      error: 'checkpoint creation failed',
    })

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.createBeforeSendCheckpoint('pre-send')
    })

    expect(result.current.recoverableCheckpointId).toBeNull()
  })

  it('restoreToCheckpoint restores and clears checkpoint id', async () => {
    createCheckpointMock.mockResolvedValue({
      success: true,
      data: { checkpoint_id: 'cp-1' },
    })
    restoreCheckpointMock.mockResolvedValue({
      success: true,
      data: { status: 'restored' },
    })

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.createBeforeSendCheckpoint('pre-send')
    })
    expect(result.current.recoverableCheckpointId).toBe('cp-1')

    await act(async () => {
      await result.current.restoreToCheckpoint()
    })

    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-1', expect.any(Object))
    expect(result.current.recoverableCheckpointId).toBeNull()
    expect(result.current.recoverStatus?.type).toBe('success')
    expect(result.current.recoverStatus?.message).toBe('Checkpoint restored')
  })

  it('restoreToCheckpoint sets error when restore fails', async () => {
    createCheckpointMock.mockResolvedValue({
      success: true,
      data: { checkpoint_id: 'cp-1' },
    })
    restoreCheckpointMock.mockResolvedValue({
      success: false,
      error: 'checkpoint not found',
    })

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.createBeforeSendCheckpoint('pre-send')
    })

    await act(async () => {
      await result.current.restoreToCheckpoint()
    })

    expect(result.current.recoverStatus?.type).toBe('error')
    expect(result.current.recoverStatus?.message).toBe('checkpoint not found')
  })

  it('restoreToCheckpoint does nothing when no checkpoint is available', async () => {
    restoreCheckpointMock.mockResolvedValue({ success: true, data: { status: 'ok' } })

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.restoreToCheckpoint()
    })

    expect(restoreCheckpointMock).not.toHaveBeenCalled()
  })

  it('restoreToCheckpoint handles exceptions', async () => {
    createCheckpointMock.mockResolvedValue({
      success: true,
      data: { checkpoint_id: 'cp-1' },
    })
    restoreCheckpointMock.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() =>
      useChatRecovery({ connectionState: 'connected', t: defaultT }),
    )

    await act(async () => {
      await result.current.createBeforeSendCheckpoint('pre-send')
    })

    await act(async () => {
      await result.current.restoreToCheckpoint()
    })

    expect(result.current.recoverStatus?.type).toBe('error')
    expect(result.current.recoverStatus?.message).toBe('Restore failed')
  })
})
