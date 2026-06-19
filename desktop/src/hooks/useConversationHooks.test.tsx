import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatRecovery } from './useChatRecovery'

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
      workflow: { sessionId: null, planId: null, level: null },
      chat: { conversationId: null, comparisonEnabled: null },
      compatibility: { additiveContract: true, migratedLegacyFields: [], notes: [] },
      schemaVersion: '2026-04-08',
    },
  }
  return {
    useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  }
})

const defaultT = {
  streamReconnecting: 'Reconnecting...',
  streamRecovered: 'Stream recovered',
  streamInterrupted: 'Stream interrupted',
  streamRestoreBeforeSendSuccess: 'Checkpoint restored',
  restoreFailed: 'Restore failed',
}

type TestConnectionState = 'connected' | 'degraded' | 'disconnected' | 'reconnecting'

describe('useChatRecovery additional conversation hooks coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('connection state transition edge cases', () => {
    it('sets disconnected status when transitioning from degraded to disconnected', () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
        { initialProps: { state: 'degraded' as TestConnectionState } },
      )

      rerender({ state: 'disconnected' as TestConnectionState })

      expect(result.current.recoverStatus?.type).toBe('error')
      expect(result.current.recoverStatus?.message).toBe('Stream interrupted')
    })

    it('sets reconnecting status when transitioning from disconnected to reconnecting', () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
        { initialProps: { state: 'disconnected' as TestConnectionState } },
      )

      rerender({ state: 'reconnecting' as TestConnectionState })

      expect(result.current.recoverStatus?.type).toBe('error')
      expect(result.current.recoverStatus?.message).toBe('Reconnecting...')
    })

    it('does not set recovered status when transitioning from degraded to connected (not from reconnecting)', () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
        { initialProps: { state: 'degraded' as TestConnectionState } },
      )

      rerender({ state: 'connected' as TestConnectionState })

      // Only transitions from reconnecting -> connected show "recovered"
      // degraded -> connected does not trigger any status
      expect(result.current.recoverStatus).toBeNull()
    })

    it('sets reconnecting status on initial reconnecting state', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'reconnecting', t: defaultT }),
      )

      expect(result.current.recoverStatus?.type).toBe('error')
      expect(result.current.recoverStatus?.message).toBe('Reconnecting...')
    })

    it('sets disconnected status on initial disconnected state', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'disconnected', t: defaultT }),
      )

      expect(result.current.recoverStatus?.type).toBe('error')
      expect(result.current.recoverStatus?.message).toBe('Stream interrupted')
    })

    it('preserves null status on initial connected state', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      expect(result.current.recoverStatus).toBeNull()
    })

    it('preserves null status on initial degraded state', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'degraded', t: defaultT }),
      )

      expect(result.current.recoverStatus).toBeNull()
    })
  })

  describe('checkpoint creation edge cases', () => {
    it('returns null when createCheckpoint returns success but no checkpoint_id', async () => {
      createCheckpointMock.mockResolvedValue({
        success: true,
        data: { commit_hash: 'abc123' },
      })

      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      await act(async () => {
        const checkpointId = await result.current.createBeforeSendCheckpoint('pre-send')
        expect(checkpointId).toBeNull()
      })

      expect(result.current.recoverableCheckpointId).toBeNull()
    })

    it('returns checkpoint id from successful response data', async () => {
      createCheckpointMock.mockResolvedValue({
        success: true,
        data: { checkpoint_id: 'cp-42', commit_hash: 'def456' },
      })

      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      await act(async () => {
        const checkpointId = await result.current.createBeforeSendCheckpoint('pre-send')
        expect(checkpointId).toBe('cp-42')
      })

      expect(result.current.recoverableCheckpointId).toBe('cp-42')
    })

    it('propagates error when createCheckpoint throws', async () => {
      createCheckpointMock.mockRejectedValue(new Error('network error'))

      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      // createBeforeSendCheckpoint does not catch; the error propagates
      await act(async () => {
        await expect(result.current.createBeforeSendCheckpoint('pre-send')).rejects.toThrow('network error')
      })

      expect(result.current.recoverableCheckpointId).toBeNull()
    })

    it('allows manual checkpoint id override via setRecoverableCheckpointId', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      act(() => {
        result.current.setRecoverableCheckpointId('manual-cp-1')
      })

      expect(result.current.recoverableCheckpointId).toBe('manual-cp-1')
    })
  })

  describe('restoreToCheckpoint edge cases', () => {
    it('restores successfully and clears the checkpoint id', async () => {
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

      await act(async () => {
        await result.current.restoreToCheckpoint()
      })

      expect(result.current.recoverableCheckpointId).toBeNull()
      expect(result.current.recoverStatus?.type).toBe('success')
      expect(result.current.recoverStatus?.message).toBe('Checkpoint restored')
    })

    it('handles response with success=false and error message', async () => {
      createCheckpointMock.mockResolvedValue({
        success: true,
        data: { checkpoint_id: 'cp-1' },
      })
      restoreCheckpointMock.mockResolvedValue({
        success: false,
        error: 'version conflict detected',
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
      expect(result.current.recoverStatus?.message).toBe('version conflict detected')
      // Checkpoint id preserved for potential retry
      expect(result.current.recoverableCheckpointId).toBe('cp-1')
    })

    it('falls back to restoreFailed message when no error field', async () => {
      createCheckpointMock.mockResolvedValue({
        success: true,
        data: { checkpoint_id: 'cp-1' },
      })
      restoreCheckpointMock.mockResolvedValue({
        success: false,
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
      expect(result.current.recoverStatus?.message).toBe('Restore failed')
    })

    it('handles thrown exception during restore', async () => {
      createCheckpointMock.mockResolvedValue({
        success: true,
        data: { checkpoint_id: 'cp-1' },
      })
      restoreCheckpointMock.mockRejectedValue(new Error('server timeout'))

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

  describe('recoverStatus manual control', () => {
    it('allows setting recoverStatus via setRecoverStatus', () => {
      const { result } = renderHook(() =>
        useChatRecovery({ connectionState: 'connected', t: defaultT }),
      )

      act(() => {
        result.current.setRecoverStatus({ type: 'info', message: 'Manual status' })
      })

      expect(result.current.recoverStatus?.type).toBe('info')
      expect(result.current.recoverStatus?.message).toBe('Manual status')
    })

    it('allows clearing recoverStatus via setRecoverStatus(null)', () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: TestConnectionState }) => useChatRecovery({ connectionState: state, t: defaultT }),
        { initialProps: { state: 'connected' as TestConnectionState } },
      )

      // First set a status
      rerender({ state: 'reconnecting' as TestConnectionState })
      expect(result.current.recoverStatus).not.toBeNull()

      // Then clear it
      act(() => {
        result.current.setRecoverStatus(null)
      })

      expect(result.current.recoverStatus).toBeNull()
    })
  })
})
