import { render, screen } from '@testing-library/react'
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

function renderHeader(
  overrides: Record<string, unknown> = {},
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

describe('AppHeader ContextRing coverage', () => {
  it('applies critical (red) styles when context usage exceeds 90%', () => {
    renderHeader({
      contextUsageText: '95%',
      contextUsageWidthPercent: 95,
    })

    const ring = screen.getByTitle('95%')
    const progressCircle = ring.querySelector('circle:nth-child(2)')
    expect(progressCircle?.getAttribute('class')).toContain('text-red-500')

    const label = ring.querySelector('span')
    expect(label?.getAttribute('class')).toContain('text-red-600')
    expect(label?.textContent).toBe('95')
  })

  it('applies warning (amber) styles when context usage is between 70 and 90', () => {
    renderHeader({
      contextUsageText: '75%',
      contextUsageWidthPercent: 75,
    })

    const ring = screen.getByTitle('75%')
    const progressCircle = ring.querySelector('circle:nth-child(2)')
    expect(progressCircle?.getAttribute('class')).toContain('text-amber-500')

    const label = ring.querySelector('span')
    expect(label?.getAttribute('class')).toContain('text-amber-600')
    expect(label?.textContent).toBe('75')
  })

  it('shows <10 label when context usage is below 10 percent', () => {
    renderHeader({
      contextUsageText: '5%',
      contextUsageWidthPercent: 5,
    })

    const ring = screen.getByTitle('5%')
    const label = ring.querySelector('span')
    expect(label?.textContent).toBe('<10')
  })

  it('uses the default colorClass when usage is normal (below 70)', () => {
    renderHeader({
      contextUsageText: '42%',
      contextUsageWidthPercent: 42,
    })

    const ring = screen.getByTitle('42%')
    const progressCircle = ring.querySelector('circle:nth-child(2)')
    // The default colorClass is "text-primary-500 dark:text-primary-400"
    expect(progressCircle?.getAttribute('class')).toContain('text-primary-500')

    const label = ring.querySelector('span')
    expect(label?.getAttribute('class')).toContain('text-gray-600')
  })
})

describe('AppHeader checkpoint description fallback', () => {
  it('falls back to checkpoint id when description is empty string', () => {
    renderHeader({
      checkpoints: [
        {
          id: 'cp-no-desc',
          description: '',
          created_at: '2026-04-15 22:00',
        },
      ],
    })

    // The checkpoint text should show the id since description is empty
    const checkpointButton = screen.getByRole('button', { name: 'Restore' })
    expect(checkpointButton).toHaveTextContent('cp-no-desc')
    // The title attribute should also fall back to id
    const titleDiv = checkpointButton.querySelector('[title]')
    expect(titleDiv).toHaveAttribute('title', 'cp-no-desc')
  })
})
