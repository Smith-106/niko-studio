import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeader } from './SectionHeader'

describe('SectionHeader', () => {
  it('renders title text', () => {
    render(<SectionHeader title="Summary" />)
    expect(screen.getByText('Summary')).toBeTruthy()
  })

  it('renders as h3 element', () => {
    render(<SectionHeader title="Test" />)
    const el = screen.getByText('Test')
    expect(el.tagName).toBe('H3')
  })
})
