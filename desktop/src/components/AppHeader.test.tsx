import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      chatSidebarToggleExpand: 'Expand chat sidebar',
      chatSidebarToggleCollapse: 'Collapse chat sidebar',
      settingsCheckConnection: 'Check connection',
    },
  }),
}))

vi.mock('./AiToolbar', () => ({
  AiToolbar: ({
    disabled,
    onWrite,
    onRewrite,
    onDescribe,
    onBrainstorm,
    onOpenWritingHelper,
    onOpenTextOptimizer,
  }: {
    disabled?: boolean
    onWrite: () => void
    onRewrite: () => void
    onDescribe: () => void
    onBrainstorm: () => void
    onOpenWritingHelper: () => void
    onOpenTextOptimizer: () => void
  }) => (
    <div>
      <span>AI toolbar</span>
      <button type="button" disabled={disabled} onClick={onWrite}>AI Write</button>
      <button type="button" disabled={disabled} onClick={onRewrite}>AI Rewrite</button>
      <button type="button" disabled={disabled} onClick={onDescribe}>AI Describe</button>
      <button type="button" disabled={disabled} onClick={onBrainstorm}>AI Brainstorm</button>
      <button type="button" disabled={disabled} onClick={onOpenWritingHelper}>Open Writing Helper</button>
      <button type="button" disabled={disabled} onClick={onOpenTextOptimizer}>Open Text Optimizer</button>
    </div>
  ),
}))

import { logger } from '../utils/logger'

import { AppHeader } from './AppHeader'

describe('AppHeader checkpoint disclosure', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderHeader(
    overrides: Partial<ComponentProps<typeof AppHeader>> = {},
  ) {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }
    const checkpointMenuTriggerRef = { current: null as HTMLButtonElement | null }

    render(
      <AppHeader
        appTitle="Niko Studio"
        contextUsageVisible
        contextUsageText="42%"
        contextUsageWidthPercent={42}
        headerConnectionState="connected"
        headerDotClass="bg-green-500"
        headerConnectionText="Connected"
        onOpenDiagnostics={() => {}}
        checkpointLabel="Checkpoint"
        loadingCheckpointsLabel="Loading checkpoints"
        noCheckpointsLabel="No checkpoints"
        restoreLabel="Restore"
        checkpointMenuOpen
        checkpointsLoading={false}
        checkpoints={[
          {
            id: 'cp-1',
            description: 'Checkpoint 1',
            created_at: '2026-04-15 22:00',
          },
        ]}
        checkpointMenuContainerRef={checkpointMenuContainerRef}
        checkpointMenuTriggerRef={checkpointMenuTriggerRef}
        onToggleCheckpointMenu={() => {}}
        onCloseCheckpointMenu={() => {}}
        onRestoreCheckpoint={() => {}}
        chatSidebarCollapsed={false}
        onToggleChatSidebar={() => {}}
        onAiWrite={() => {}}
        onAiRewrite={() => {}}
        onAiDescribe={() => {}}
        onAiBrainstorm={() => {}}
        onOpenWritingHelper={() => {}}
        onOpenTextOptimizer={() => {}}
        {...overrides}
      />,
    )

    return { checkpointMenuContainerRef, checkpointMenuTriggerRef }
  }

  it('exposes expanded state and moves focus into the opened checkpoint popup', async () => {
    renderHeader()

    expect(screen.getByRole('button', { name: 'Checkpoint' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Checkpoint' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restore' })).toHaveFocus()
    })
  })

  it('moves focus from a loading popup container to the first restore action when checkpoints load', async () => {
    function CheckpointHeaderHarness() {
      const [checkpointsLoading, setCheckpointsLoading] = useState(true)
      const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
      const checkpointMenuTriggerRef = useRef<HTMLButtonElement | null>(null)

      return (
        <>
          <button type="button" onClick={() => setCheckpointsLoading(false)}>
            Finish loading
          </button>
          <AppHeader
            appTitle="Niko Studio"
            contextUsageVisible
            contextUsageText="42%"
            contextUsageWidthPercent={42}
            headerConnectionState="connected"
            headerDotClass="bg-green-500"
            headerConnectionText="Connected"
            onOpenDiagnostics={() => {}}
            checkpointLabel="Checkpoint"
            loadingCheckpointsLabel="Loading checkpoints"
            noCheckpointsLabel="No checkpoints"
            restoreLabel="Restore"
            checkpointMenuOpen
            checkpointsLoading={checkpointsLoading}
            checkpoints={checkpointsLoading ? [] : [
              {
                id: 'cp-1',
                description: 'Checkpoint 1',
                created_at: '2026-04-15 22:00',
              },
            ]}
            checkpointMenuContainerRef={checkpointMenuContainerRef}
            checkpointMenuTriggerRef={checkpointMenuTriggerRef}
            onToggleCheckpointMenu={() => {}}
            onCloseCheckpointMenu={() => {}}
            onRestoreCheckpoint={() => {}}
            chatSidebarCollapsed={false}
            onToggleChatSidebar={() => {}}
            onAiWrite={() => {}}
            onAiRewrite={() => {}}
            onAiDescribe={() => {}}
            onAiBrainstorm={() => {}}
            onOpenWritingHelper={() => {}}
            onOpenTextOptimizer={() => {}}
          />
        </>
      )
    }

    const user = userEvent.setup()

    render(<CheckpointHeaderHarness />)

    const dialog = screen.getByRole('dialog', { name: 'Checkpoint' })
    await waitFor(() => {
      expect(dialog).toHaveFocus()
    })

    await user.click(screen.getByRole('button', { name: 'Finish loading' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restore' })).toHaveFocus()
    })
  })

  it('traps focus within the checkpoint popup and restores focus on Escape', async () => {
    const user = userEvent.setup()

    function CheckpointHeaderHarness() {
      const [open, setOpen] = useState(true)
      const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
      const checkpointMenuTriggerRef = useRef<HTMLButtonElement | null>(null)

      return (
        <>
          <button type="button">Before</button>
          <AppHeader
            appTitle="Niko Studio"
            contextUsageVisible
            contextUsageText="42%"
            contextUsageWidthPercent={42}
            headerConnectionState="connected"
            headerDotClass="bg-green-500"
            headerConnectionText="Connected"
            onOpenDiagnostics={() => {}}
            checkpointLabel="Checkpoint"
            loadingCheckpointsLabel="Loading checkpoints"
            noCheckpointsLabel="No checkpoints"
            restoreLabel="Restore"
            checkpointMenuOpen={open}
            checkpointsLoading={false}
            checkpoints={[
              {
                id: 'cp-1',
                description: 'Checkpoint 1',
                created_at: '2026-04-15 22:00',
              },
            ]}
            checkpointMenuContainerRef={checkpointMenuContainerRef}
            checkpointMenuTriggerRef={checkpointMenuTriggerRef}
            onToggleCheckpointMenu={() => setOpen((value) => !value)}
            onCloseCheckpointMenu={() => setOpen(false)}
            onRestoreCheckpoint={() => {}}
            chatSidebarCollapsed={false}
            onToggleChatSidebar={() => {}}
            onAiWrite={() => {}}
            onAiRewrite={() => {}}
            onAiDescribe={() => {}}
            onAiBrainstorm={() => {}}
            onOpenWritingHelper={() => {}}
            onOpenTextOptimizer={() => {}}
          />
          <button type="button">After</button>
        </>
      )
    }

    render(<CheckpointHeaderHarness />)

    const trigger = screen.getByRole('button', { name: 'Checkpoint' })
    const restoreButton = screen.getByRole('button', { name: 'Restore' })

    await waitFor(() => {
      expect(restoreButton).toHaveFocus()
    })

    await user.tab()
    expect(restoreButton).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Checkpoint' })).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })

  it('shows diagnostics shortcut when the service is not fully connected', () => {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }
    const checkpointMenuTriggerRef = { current: null as HTMLButtonElement | null }
    const onOpenDiagnostics = vi.fn()

    render(
      <AppHeader
        appTitle="Niko Studio"
        contextUsageVisible
        contextUsageText="42%"
        contextUsageWidthPercent={42}
        headerConnectionState="degraded"
        headerDotClass="bg-amber-500"
        headerConnectionText="Degraded"
        onOpenDiagnostics={onOpenDiagnostics}
        checkpointLabel="Checkpoint"
        loadingCheckpointsLabel="Loading checkpoints"
        noCheckpointsLabel="No checkpoints"
        restoreLabel="Restore"
        checkpointMenuOpen={false}
        checkpointsLoading={false}
        checkpoints={[]}
        checkpointMenuContainerRef={checkpointMenuContainerRef}
        checkpointMenuTriggerRef={checkpointMenuTriggerRef}
        onToggleCheckpointMenu={() => {}}
        onCloseCheckpointMenu={() => {}}
        onRestoreCheckpoint={() => {}}
        chatSidebarCollapsed={false}
        onToggleChatSidebar={() => {}}
        onAiWrite={() => {}}
        onAiRewrite={() => {}}
        onAiDescribe={() => {}}
        onAiBrainstorm={() => {}}
        onOpenWritingHelper={() => {}}
        onOpenTextOptimizer={() => {}}
      />,
    )

    screen.getByRole('button', { name: 'Check connection' }).click()
    expect(onOpenDiagnostics).toHaveBeenCalledTimes(1)
  })

  it('hides context usage summary when there is no meaningful usage yet', () => {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }
    const checkpointMenuTriggerRef = { current: null as HTMLButtonElement | null }

    render(
      <AppHeader
        appTitle="Niko Studio"
        contextUsageVisible={false}
        contextUsageText="0.0k/128k"
        contextUsageWidthPercent={0}
        headerConnectionState="connected"
        headerDotClass="bg-green-500"
        headerConnectionText="Connected"
        onOpenDiagnostics={() => {}}
        checkpointLabel="Checkpoint"
        loadingCheckpointsLabel="Loading checkpoints"
        noCheckpointsLabel="No checkpoints"
        restoreLabel="Restore"
        checkpointMenuOpen={false}
        checkpointsLoading={false}
        checkpoints={[]}
        checkpointMenuContainerRef={checkpointMenuContainerRef}
        checkpointMenuTriggerRef={checkpointMenuTriggerRef}
        onToggleCheckpointMenu={() => {}}
        onCloseCheckpointMenu={() => {}}
        onRestoreCheckpoint={() => {}}
        chatSidebarCollapsed={true}
        onToggleChatSidebar={() => {}}
        onAiWrite={() => {}}
        onAiRewrite={() => {}}
        onAiDescribe={() => {}}
        onAiBrainstorm={() => {}}
        onOpenWritingHelper={() => {}}
        onOpenTextOptimizer={() => {}}
      />,
    )

    expect(screen.queryByText('Context')).not.toBeInTheDocument()
    expect(screen.queryByText('0.0k/128k')).not.toBeInTheDocument()
  })

  it('runs guarded ai actions when connected and restores checkpoints from the menu', async () => {
    const user = userEvent.setup()
    const onAiWrite = vi.fn()
    const onRestoreCheckpoint = vi.fn()

    renderHeader({ onAiWrite, onRestoreCheckpoint })

    await user.click(screen.getByRole('button', { name: 'AI Write' }))
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    expect(onAiWrite).toHaveBeenCalledTimes(1)
    expect(onRestoreCheckpoint).toHaveBeenCalledWith('cp-1')
  })

  it('shows empty checkpoint state when the popup is open without saved checkpoints', () => {
    renderHeader({
      checkpointMenuOpen: true,
      checkpoints: [],
      checkpointsLoading: false,
    })

    expect(screen.getByText('No checkpoints')).toBeInTheDocument()
  })

  it('guards ai actions when disconnected, supports dismiss, and auto-clears the offline warning', async () => {
    vi.useFakeTimers()
    const onAiWrite = vi.fn()

    renderHeader({
      headerConnectionState: 'disconnected',
      headerDotClass: 'bg-red-500',
      headerConnectionText: 'Disconnected',
      onAiWrite,
    })

    fireEvent.click(screen.getByRole('button', { name: 'AI Write' }))

    expect(onAiWrite).not.toHaveBeenCalled()
    const warningText = screen.getByText(/无法使用|离线/)
    const warning = warningText.parentElement as HTMLElement

    fireEvent.click(within(warning).getByRole('button'))
    expect(screen.queryByText(/无法使用|离线/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'AI Write' }))
    expect(screen.getByText(/无法使用|离线/)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText(/无法使用|离线/)).not.toBeInTheDocument()
  })

  it('reconnects the gateway and resets the retry state after the timer elapses', async () => {
    vi.useFakeTimers()
    const onReconnectGateway = vi.fn(async () => {})

    renderHeader({
      headerConnectionState: 'disconnected',
      headerDotClass: 'bg-red-500',
      headerConnectionText: 'Disconnected',
      checkpointMenuOpen: false,
      onReconnectGateway,
    })

    const reconnectButton = screen.getByRole('button', { name: /重连|检测/ })

    fireEvent.click(reconnectButton)

    expect(onReconnectGateway).toHaveBeenCalledTimes(1)
    expect(reconnectButton).toBeDisabled()

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(1200)
    })

    expect(reconnectButton).not.toBeDisabled()
  })

  it('logs reconnect failures and still clears the retry state after the timeout', async () => {
    vi.useFakeTimers()
    const reconnectError = new Error('gateway unavailable')
    const onReconnectGateway = vi.fn(async () => {
      throw reconnectError
    })
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    renderHeader({
      headerConnectionState: 'disconnected',
      headerDotClass: 'bg-red-500',
      headerConnectionText: 'Disconnected',
      checkpointMenuOpen: false,
      onReconnectGateway,
    })

    const reconnectButton = screen.getByRole('button', { name: /重连|检测/ })

    await act(async () => {
      fireEvent.click(reconnectButton)
      await Promise.resolve()
    })

    expect(onReconnectGateway).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('Reconnect failed:', reconnectError)

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(1200)
    })

    expect(reconnectButton).not.toBeDisabled()
  })

  it('keeps focus on the active restore button when the checkpoint list changes inside the dialog', async () => {
    const user = userEvent.setup()

    function PreserveFocusHarness() {
      const [checkpoints, setCheckpoints] = useState([
        { id: 'cp-1', description: 'Checkpoint 1', created_at: '2026-04-15 22:00' },
      ])
      const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
      const checkpointMenuTriggerRef = useRef<HTMLButtonElement | null>(null)

      return (
        <AppHeader
          appTitle="Niko Studio"
          contextUsageVisible
          contextUsageText="42%"
          contextUsageWidthPercent={42}
          headerConnectionState="connected"
          headerDotClass="bg-green-500"
          headerConnectionText="Connected"
          onOpenDiagnostics={() => {}}
          checkpointLabel="Checkpoint"
          loadingCheckpointsLabel="Loading checkpoints"
          noCheckpointsLabel="No checkpoints"
          restoreLabel="Restore"
          checkpointMenuOpen
          checkpointsLoading={false}
          checkpoints={checkpoints}
          checkpointMenuContainerRef={checkpointMenuContainerRef}
          checkpointMenuTriggerRef={checkpointMenuTriggerRef}
          onToggleCheckpointMenu={() => {}}
          onCloseCheckpointMenu={() => {}}
          onRestoreCheckpoint={() => {
            setCheckpoints((prev) => [
              ...prev,
              { id: `cp-${prev.length + 1}`, description: `Checkpoint ${prev.length + 1}`, created_at: '2026-04-15 22:05' },
            ])
          }}
          chatSidebarCollapsed={false}
          onToggleChatSidebar={() => {}}
          onAiWrite={() => {}}
          onAiRewrite={() => {}}
          onAiDescribe={() => {}}
          onAiBrainstorm={() => {}}
          onOpenWritingHelper={() => {}}
          onOpenTextOptimizer={() => {}}
        />
      )
    }

    render(<PreserveFocusHarness />)

    const restoreButton = screen.getByRole('button', { name: 'Restore' })

    await waitFor(() => {
      expect(restoreButton).toHaveFocus()
    })

    fireEvent.click(restoreButton)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2)
    })

    expect(screen.getAllByRole('button', { name: 'Restore' })[0]).toHaveFocus()
  })
})
