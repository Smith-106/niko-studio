import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IntelligenceBadge } from './IntelligenceBadge'

describe('IntelligenceBadge', () => {
  it('renders children text', () => {
    render(<IntelligenceBadge variant="success">Active</IntelligenceBadge>)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('applies success variant styles', () => {
    render(<IntelligenceBadge variant="success">ok</IntelligenceBadge>)
    const el = screen.getByText('ok')
    expect(el.style.backgroundColor).toBe('rgba(16, 185, 129, 0.12)')
    expect(el.style.color).toBe('rgb(5, 150, 105)')
  })

  it('applies warning variant styles', () => {
    render(<IntelligenceBadge variant="warning">warn</IntelligenceBadge>)
    const el = screen.getByText('warn')
    expect(el.style.backgroundColor).toBe('rgba(245, 158, 11, 0.12)')
  })

  it('applies danger variant styles', () => {
    render(<IntelligenceBadge variant="danger">bad</IntelligenceBadge>)
    const el = screen.getByText('bad')
    expect(el.style.color).toBe('rgb(220, 38, 38)')
  })
})
