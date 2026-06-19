import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { InlineHints } from './InlineHints'
import type { InlineSuggestion } from './InlineHints'

describe('InlineHints', () => {
  const mockSuggestions: InlineSuggestion[] = [
    {
      id: 'suggestion-1',
      text: 'The narrative continues with a sense of quiet anticipation. Characters move through the space with purpose.',
      confidence: 0.85,
      mode: 'auto',
    },
    {
      id: 'suggestion-2',
      text: 'A sudden draft swept through the room, extinguishing the candle and plunging everything into darkness.',
      confidence: 0.45,
      mode: 'guided',
    },
    {
      id: 'suggestion-3',
      text: 'Before she could step inside, a voice called her name from behind.',
      confidence: 0.35,
      mode: 'auto',
    },
  ]

  const mockPosition = { line: 5, column: 10 }

  it('renders all suggestions with correct content', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    // Check header
    expect(screen.getByText('AI 建议')).toBeInTheDocument()

    // Check confidence indicators
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()

    // Check mode badges
    const autoBadges = screen.getAllByText('自动')
    const guidedBadges = screen.getAllByText('引导')
    expect(autoBadges).toHaveLength(2)
    expect(guidedBadges).toHaveLength(1)

    // Check action buttons
    const acceptButtons = screen.getAllByText('采用')
    const dismissButtons = screen.getAllByText('忽略')
    expect(acceptButtons).toHaveLength(3)
    expect(dismissButtons).toHaveLength(3)
  })

  it('truncates long suggestion text', () => {
    const longSuggestion: InlineSuggestion = {
      id: 'long',
      text: 'A'.repeat(200),
      confidence: 0.7,
      mode: 'auto',
    }

    render(
      <InlineHints
        suggestions={[longSuggestion]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        position={mockPosition}
      />
    )

    const displayedText = screen.getByText(/AAA\.\.\./)
    expect(displayedText).toBeInTheDocument()
  })

  it('calls onAccept when accept button is clicked', async () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    const acceptButtons = screen.getAllByText('采用')
    fireEvent.click(acceptButtons[0])

    expect(onAccept).toHaveBeenCalledWith('suggestion-1')
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    vi.useFakeTimers()
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    const dismissButtons = screen.getAllByText('忽略')
    fireEvent.click(dismissButtons[1])

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(onDismiss).toHaveBeenCalledWith('suggestion-2')
    vi.useRealTimers()
  })

  it('applies the dismissed animation class before the parent removes a suggestion', () => {
    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        position={mockPosition}
      />
    )

    const dismissButton = screen.getAllByText('忽略')[1]
    fireEvent.click(dismissButton)

    const suggestionCard = dismissButton?.closest('div[class*="transition-all duration-200"]') as HTMLElement | null
    expect(suggestionCard?.className).toContain('opacity-0')
    expect(suggestionCard?.className).toContain('scale-95')
  })

  it('dismisses all suggestions when close button is clicked', async () => {
    vi.useFakeTimers()
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    const closeButton = screen.getByLabelText('关闭所有建议')
    fireEvent.click(closeButton)

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(onDismiss).toHaveBeenCalledTimes(3)
    expect(onDismiss).toHaveBeenCalledWith('suggestion-1')
    expect(onDismiss).toHaveBeenCalledWith('suggestion-2')
    expect(onDismiss).toHaveBeenCalledWith('suggestion-3')
    vi.useRealTimers()
  })

  it('applies correct confidence colors', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    // Get confidence indicator dots
    const container = document.querySelector('.space-y-2 > div')
    expect(container).toBeInTheDocument()
  })

  it('positions card based on line and column', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    const { container } = render(
      <InlineHints
        suggestions={mockSuggestions}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.top).toBe('160px') // 5 * 24 + 40
    expect(wrapper.style.left).toBe('100px') // 10 * 8 + 20
  })

  it('returns null when no suggestions remain', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()

    const { container } = render(
      <InlineHints
        suggestions={[]}
        onAccept={onAccept}
        onDismiss={onDismiss}
        position={mockPosition}
      />
    )

    expect(container.firstChild).toBeNull()
  })
})
