import { render, screen, waitFor } from '@testing-library/react'
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
  it('exposes expanded state and moves focus into the opened checkpoint popup', async () => {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }

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
        onToggleCheckpointMenu={() => {}}
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

    expect(screen.getByRole('button', { name: 'Checkpoint' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Checkpoint' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restore' })).toHaveFocus()
    })
  })

  it('shows diagnostics shortcut when the service is not fully connected', () => {
    const checkpointMenuContainerRef = { current: null as HTMLDivElement | null }
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
        onToggleCheckpointMenu={() => {}}
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
        onToggleCheckpointMenu={() => {}}
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
