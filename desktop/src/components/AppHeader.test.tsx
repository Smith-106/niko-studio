import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState, type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

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
  AiToolbar: () => <div>AI toolbar</div>,
}))

import { AppHeader } from './AppHeader'

describe('AppHeader checkpoint disclosure', () => {
  function renderHeader(
    overrides: Partial<ComponentProps<typeof AppHeader>> = {},
  ) {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }
    const checkpointMenuTriggerRef = { current: null as HTMLButtonElement | null }

    render(
      <AppHeader
        appTitle="Niko Studio"
        contextUsageLabel="Context"
        contextUsageVisible
        contextUsageText="42%"
        contextUsageBarClass="bg-primary-500"
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
            contextUsageLabel="Context"
            contextUsageVisible
            contextUsageText="42%"
            contextUsageBarClass="bg-primary-500"
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
            contextUsageLabel="Context"
            contextUsageVisible
            contextUsageText="42%"
            contextUsageBarClass="bg-primary-500"
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
        contextUsageLabel="Context"
        contextUsageVisible
        contextUsageText="42%"
        contextUsageBarClass="bg-primary-500"
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
        contextUsageLabel="Context"
        contextUsageVisible={false}
        contextUsageText="0.0k/128k"
        contextUsageBarClass="bg-primary-500"
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
})
