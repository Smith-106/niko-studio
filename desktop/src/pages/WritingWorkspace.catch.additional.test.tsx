import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('../components/narrative/ForeshadowPanel', () => ({
  ForeshadowPanel: ({
    alerts,
    onResolve,
  }: {
    alerts: Array<{ foreshadowId: string; hint: string }>
    onResolve: (id: string) => void
  }) => (
    <div>
      <div data-testid="foreshadow-count">{alerts.length}</div>
      {alerts.map((alert) => (
        <div key={alert.foreshadowId}>
          <span>{alert.hint}</span>
          <button onClick={() => onResolve(alert.foreshadowId)}>resolve-{alert.foreshadowId}</button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../components/narrative/QualityScorePanel', () => ({
  QualityScorePanel: () => <div>quality-panel</div>,
}))

vi.mock('../components/narrative/BrainstormPanel', () => ({
  BrainstormPanel: () => <div>brainstorm-panel</div>,
}))

vi.mock('../components/story-bible', () => ({
  StoryBiblePanel: ({ novelId }: { novelId: string }) => <div>story-bible:{novelId}</div>,
}))

import { logger } from '../utils/logger'

import WritingWorkspace from './WritingWorkspace'

const FORESHADOW_ALERTS = [
  {
    foreshadow_id: 'seed-1',
    hint: '门口的旧钥匙',
    planted_at: 1,
    current_chapter: 2,
    chapters_until_due: 3,
    urgency: 'approaching' as const,
  },
]

describe('WritingWorkspace catch block coverage', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return { online: true }
      if (command === 'get_foreshadow_alerts') return FORESHADOW_ALERTS
      return { ok: true }
    })
  })

  it('handles refreshForeshadows catch when get_foreshadow_alerts throws', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    // add_foreshadow succeeds, but get_foreshadow_alerts throws in refreshForeshadows
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return { online: true }
      if (command === 'add_foreshadow') return { ok: true }
      if (command === 'get_foreshadow_alerts') throw new Error('foreshadow fetch failed')
      return { ok: true }
    })

    render(<WritingWorkspace />)

    // Add foreshadow via Enter key — addForeshadow calls refreshForeshadows after success
    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Enter',
      target: { value: 'test hint' },
    })

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('add_foreshadow', expect.objectContaining({
        hint: 'test hint',
      }))
    })

    // refreshForeshadows should have been called and caught the error
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Foreshadow refresh failed:', expect.any(Error))
    })

    errorSpy.mockRestore()
  })

  it('handles resolveForeshadow catch when resolve_foreshadow throws', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    // get_foreshadow_alerts succeeds (to populate state), but resolve_foreshadow throws
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return { online: true }
      if (command === 'add_foreshadow') return { ok: true }
      if (command === 'get_foreshadow_alerts') return FORESHADOW_ALERTS
      if (command === 'resolve_foreshadow') throw new Error('resolve failed')
      return { ok: true }
    })

    render(<WritingWorkspace />)

    // Switch to foreshadow tab first so we can see the panel
    fireEvent.click(screen.getByRole('button', { name: '伏笔管理' }))

    // Add a foreshadow which will populate the foreshadow state via refreshForeshadows
    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Enter',
      target: { value: 'test hint' },
    })

    // Wait for foreshadow alerts to appear in the foreshadow panel
    await waitFor(() => {
      expect(screen.getByText('门口的旧钥匙')).toBeInTheDocument()
    })

    // Click resolve button — resolve_foreshadow will throw
    fireEvent.click(screen.getByRole('button', { name: 'resolve-seed-1' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('resolve_foreshadow', { id: 'seed-1' })
    })

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Resolve foreshadow failed:', expect.any(Error))
    })

    errorSpy.mockRestore()
  })
})
