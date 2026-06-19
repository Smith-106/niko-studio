import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockLanguage: 'zh' | 'en' = 'en'

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    language: mockLanguage,
  }),
}))

import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel'

describe('KeyboardShortcutsPanel', () => {
  beforeEach(() => {
    mockLanguage = 'en'
  })

  it('renders the english shortcuts list and closes from the overlay and close button', () => {
    const onClose = vi.fn()
    const { container } = render(<KeyboardShortcutsPanel onClose={onClose} />)

    expect(screen.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('AI slash commands')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+Z')).toBeInTheDocument()

    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('stops propagation from the inner panel and switches to the zh shortcut set', () => {
    mockLanguage = 'zh'
    const onClose = vi.fn()
    const { container } = render(<KeyboardShortcutsPanel onClose={onClose} />)

    expect(screen.queryByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument()
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+/')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+U')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()

    const overlay = container.firstChild as HTMLElement
    const panel = overlay.firstChild as HTMLElement
    fireEvent.click(panel)
    expect(onClose).not.toHaveBeenCalled()

    const shortcutsList = panel.querySelector('.space-y-2')
    expect(shortcutsList).not.toBeNull()
    expect(within(shortcutsList as HTMLElement).getAllByText(/Ctrl\+|^\//)).toHaveLength(8)

    fireEvent.click(screen.getAllByRole('button')[0]!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
