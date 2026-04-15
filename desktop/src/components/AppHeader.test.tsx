import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      chatSidebarToggleExpand: 'Expand chat sidebar',
      chatSidebarToggleCollapse: 'Collapse chat sidebar',
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
        contextUsageText="42%"
        contextUsageBarClass="bg-primary-500"
        contextUsageWidthPercent={42}
        headerDotClass="bg-green-500"
        headerConnectionText="Connected"
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
})
