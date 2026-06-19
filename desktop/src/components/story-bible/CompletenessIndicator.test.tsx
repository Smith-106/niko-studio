import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  CompletenessIndicator,
  completenessColor,
  completenessTextColor,
} from './CompletenessIndicator'

describe('CompletenessIndicator', () => {
  it('renders the small badge with clamped percentages and tooltip metadata', () => {
    render(<CompletenessIndicator score={-0.2} size="sm" showLabel tooltip="缺少角色关系" />)

    const label = screen.getByText('0%')
    expect(label.className).toContain('text-red-400')
    expect(label.parentElement).toHaveAttribute('title', '缺少角色关系')
  })

  it('renders the medium progress bar using the auto-derived level', () => {
    const { container } = render(<CompletenessIndicator score={0.67} size="md" showLabel />)

    expect(screen.getByText('67%').className).toContain('text-blue-400')

    const bar = container.querySelector('.bg-blue-500') as HTMLDivElement | null
    expect(bar?.style.width).toBe('67%')
  })

  it('renders the large variant with explicit level overrides and helper colors', () => {
    const { container } = render(
      <CompletenessIndicator score={1.2} level="comprehensive" size="lg" showLabel />,
    )

    expect(screen.getByText('Comprehensive')).toBeInTheDocument()
    expect(screen.getByText('100%').className).toContain('text-green-400')

    const bar = container.querySelector('.bg-green-500') as HTMLDivElement | null
    expect(bar?.style.width).toBe('100%')

    expect(completenessColor(0.81)).toBe('bg-green-500')
    expect(completenessColor(0.45)).toBe('bg-yellow-500')
    expect(completenessTextColor(0.62)).toBe('text-blue-400')
    expect(completenessTextColor(0.1)).toBe('text-red-400')
  })

  it('falls back to the critical level when the score cannot match any threshold', () => {
    render(<CompletenessIndicator score={Number.NaN} size="lg" />)

    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(completenessColor(Number.NaN)).toBe('bg-red-500')
    expect(completenessTextColor(Number.NaN)).toBe('text-red-400')
  })
})
