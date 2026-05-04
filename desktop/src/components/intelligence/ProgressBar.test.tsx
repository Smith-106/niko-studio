import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('renders with correct width for given value', () => {
    const { container } = render(<ProgressBar value={75} />)
    const inner = container.querySelector('.bg-primary-cta') as HTMLElement
    expect(inner).toBeTruthy()
    expect(inner.style.width).toBe('75%')
  })

  it('clamps value to 0 minimum', () => {
    const { container } = render(<ProgressBar value={-10} />)
    const inner = container.querySelector('.bg-primary-cta') as HTMLElement
    expect(inner.style.width).toBe('0%')
  })

  it('clamps value to 100 maximum', () => {
    const { container } = render(<ProgressBar value={200} />)
    const inner = container.querySelector('.bg-primary-cta') as HTMLElement
    expect(inner.style.width).toBe('100%')
  })
})
