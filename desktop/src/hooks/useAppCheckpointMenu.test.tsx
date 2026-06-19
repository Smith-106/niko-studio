import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listCheckpointsMock = vi.hoisted(() => vi.fn())
const restoreCheckpointMock = vi.hoisted(() => vi.fn())
const useAppStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  listCheckpoints: listCheckpointsMock,
  restoreCheckpoint: restoreCheckpointMock,
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { useAppCheckpointMenu } from './useAppCheckpointMenu'

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

describe('useAppCheckpointMenu', () => {
  let appState = buildAppState()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
    appState = buildAppState()
    useAppStoreMock.mockImplementation((selector: (state: typeof appState) => unknown) => selector(appState))
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('opens the menu, loads checkpoints, and injects fallback workflow/chat ids', async () => {
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
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    expect(result.current.checkpointMenuOpen).toBe(true)
    expect(result.current.checkpointsLoading).toBe(false)
    expect(result.current.checkpoints).toEqual([
      {
        id: 'cp-1',
        description: 'Checkpoint A',
        created_at: '2026-06-03T00:00:00.000Z',
      },
    ])
    expect(listCheckpointsMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        workflow: expect.objectContaining({ sessionId: 'conversation-42' }),
        chat: expect.objectContaining({ conversationId: 'conversation-42' }),
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    expect(result.current.checkpointMenuOpen).toBe(false)
    expect(listCheckpointsMock).toHaveBeenCalledTimes(1)
  })

  it('maps refresh failures for unsuccessful and thrown checkpoint list calls', async () => {
    listCheckpointsMock
      .mockResolvedValueOnce({ success: false, error: 'checkpoint list failed' })
      .mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'checkpoint list failed',
    })
    expect(result.current.checkpoints).toEqual([])

    act(() => {
      result.current.closeCheckpointMenu()
    })

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'restore failed',
    })
    expect(result.current.checkpointsLoading).toBe(false)
  })

  it('closes on outside pointer down, but stays open when clicking inside the menu', async () => {
    listCheckpointsMock.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    const container = document.createElement('div')
    const insideTarget = document.createElement('button')
    const outsideTarget = document.createElement('div')
    container.append(insideTarget)
    document.body.append(container, outsideTarget)

    act(() => {
      result.current.checkpointMenuContainerRef.current = container
    })

    act(() => {
      insideTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(result.current.checkpointMenuOpen).toBe(true)

    act(() => {
      outsideTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(result.current.checkpointMenuOpen).toBe(false)
  })

  it('ignores pointer events whose targets are not DOM nodes', async () => {
    listCheckpointsMock.mockResolvedValue({ success: true, data: [] })

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    let pointerHandler: ((event: MouseEvent) => void) | undefined
    addEventListenerSpy.mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'mousedown' && typeof listener === 'function') {
        pointerHandler = listener as (event: MouseEvent) => void
      }
    }) as typeof document.addEventListener)

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    act(() => {
      pointerHandler?.({ target: {} } as MouseEvent)
    })

    expect(result.current.checkpointMenuOpen).toBe(true)

    addEventListenerSpy.mockRestore()
  })

  it('restores checkpoints, closes the menu, and clears success status after the timeout', async () => {
    vi.useFakeTimers()
    listCheckpointsMock.mockResolvedValue({ success: true, data: [] })
    restoreCheckpointMock.mockResolvedValue({
      success: true,
      data: { status: 'restored' },
    })

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-7')
    })

    expect(restoreCheckpointMock).toHaveBeenCalledWith(
      'cp-7',
      expect.objectContaining({
        workflow: expect.objectContaining({ sessionId: 'conversation-42' }),
        chat: expect.objectContaining({ conversationId: 'conversation-42' }),
      }),
    )
    expect(result.current.restoreStatus).toEqual({
      type: 'success',
      message: 'restore success',
    })
    expect(result.current.checkpointMenuOpen).toBe(false)

    act(() => {
      vi.advanceTimersByTime(2499)
    })
    expect(result.current.restoreStatus).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.restoreStatus).toBeNull()
  })

  it('maps restore failures for unsuccessful and thrown restore calls', async () => {
    restoreCheckpointMock
      .mockResolvedValueOnce({ success: false, error: 'checkpoint not found' })
      .mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-8')
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'checkpoint not found',
    })

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-9')
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'restore failed',
    })
  })

  it('falls back to default restore text when checkpoint APIs return no explicit error message', async () => {
    listCheckpointsMock.mockResolvedValue({ success: false })
    restoreCheckpointMock.mockResolvedValue({ success: false })

    const { result } = renderHook(() =>
      useAppCheckpointMenu({
        restoreFailedText: 'restore failed',
        restoreSuccessText: 'restore success',
      }),
    )

    await act(async () => {
      await result.current.handleToggleCheckpointMenu()
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'restore failed',
    })

    await act(async () => {
      await result.current.handleRestoreCheckpoint('cp-fallback')
    })

    expect(result.current.restoreStatus).toEqual({
      type: 'error',
      message: 'restore failed',
    })
  })
})
