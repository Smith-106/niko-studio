import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThinkingEffect } from './ThinkingEffect'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: { thinking: 'Niko is thinking...' },
    language: 'zh',
    translate: (key: string) => key,
  }),
}))

describe('ThinkingEffect', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, language: 'zh' },
    }))
  })

  it('renders the thinking label text', () => {
    render(<ThinkingEffect content="" />)
    expect(screen.getByText('Niko is thinking...')).toBeInTheDocument()
  })

  it('shows the last N lines of content (maxLines)', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`)
    const content = lines.join('\n')

    render(<ThinkingEffect content={content} maxLines={3} />)

    // Should show only the last 3 lines
    expect(screen.getByText('Line 8')).toBeInTheDocument()
    expect(screen.getByText('Line 9')).toBeInTheDocument()
    expect(screen.getByText('Line 10')).toBeInTheDocument()
    // Earlier lines should not appear
    expect(screen.queryByText('Line 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Line 7')).not.toBeInTheDocument()
  })

  it('uses default maxLines of 5 when not specified', () => {
    const lines = Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`)
    const content = lines.join('\n')

    render(<ThinkingEffect content={content} />)

    // Default maxLines=5 should show last 5 lines (4-8)
    expect(screen.getByText('Line 4')).toBeInTheDocument()
    expect(screen.getByText('Line 5')).toBeInTheDocument()
    expect(screen.getByText('Line 8')).toBeInTheDocument()
    // Line 3 should not appear
    expect(screen.queryByText('Line 3')).not.toBeInTheDocument()
  })

  it('renders fewer lines when content has fewer than maxLines', () => {
    const content = 'Only one line'
    render(<ThinkingEffect content={content} maxLines={5} />)

    expect(screen.getByText('Only one line')).toBeInTheDocument()
    // No extra lines rendered
    expect(screen.queryAllByText(/^Line \d+$/)).toHaveLength(0)
  })

  it('renders all lines when content has exactly maxLines', () => {
    const lines = ['First', 'Second', 'Third']
    const content = lines.join('\n')

    render(<ThinkingEffect content={content} maxLines={3} />)

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })

  it('filters out empty lines from content', () => {
    const content = 'Line1\n\n\nLine2\n\nLine3'
    render(<ThinkingEffect content={content} maxLines={5} />)

    expect(screen.getByText('Line1')).toBeInTheDocument()
    expect(screen.getByText('Line2')).toBeInTheDocument()
    expect(screen.getByText('Line3')).toBeInTheDocument()
  })

  it('shows nothing when content is empty', () => {
    const { container } = render(<ThinkingEffect content="" />)
    const lines = container.querySelectorAll('.animate-pulse-subtle')
    expect(lines).toHaveLength(0)
  })

  it('renders with an animated pulse indicator', () => {
    const { container } = render(<ThinkingEffect content="some thought" />)

    // The pulsing dot should be rendered
    const pulseDot = container.querySelector('.animate-pulse')
    expect(pulseDot).toBeInTheDocument()
    expect(pulseDot?.className).toContain('bg-primary-500/60')
    expect(pulseDot?.className).toContain('rounded-full')
  })

  it('applies staggered animation delay to each line', () => {
    const content = 'Line A\nLine B\nLine C'
    render(<ThinkingEffect content={content} maxLines={3} />)

    const textLines = screen.getAllByText(/Line [ABC]/)
    expect(textLines).toHaveLength(3)

    // Each line should have animate-pulse-subtle and animation-delay
    for (const line of textLines) {
      expect(line.className).toContain('animate-pulse-subtle')
      expect(line.style.animationDelay).toBeDefined()
    }
  })
})
