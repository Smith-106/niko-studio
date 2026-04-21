import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppRestoreStatusBanner } from './AppRestoreStatusBanner'

describe('AppRestoreStatusBanner', () => {
  it('returns null when restoreStatus is null', () => {
    const { container } = render(<AppRestoreStatusBanner restoreStatus={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders success banner with message', () => {
    render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'success', message: 'Checkpoint restored' }}
      />,
    )
    expect(screen.getByText('Checkpoint restored')).toBeInTheDocument()
  })

  it('renders error banner with message', () => {
    render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'error', message: 'Restore failed' }}
      />,
    )
    expect(screen.getByText('Restore failed')).toBeInTheDocument()
  })

  it('applies green styling for success type', () => {
    const { container } = render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'success', message: 'OK' }}
      />,
    )
    const banner = container.querySelector('div')
    expect(banner?.className).toContain('text-green-700')
    expect(banner?.className).toContain('bg-green-50')
  })

  it('applies red styling for error type', () => {
    const { container } = render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'error', message: 'Fail' }}
      />,
    )
    const banner = container.querySelector('div')
    expect(banner?.className).toContain('text-red-700')
    expect(banner?.className).toContain('bg-red-50')
  })

  it('renders banner with Chinese message', () => {
    render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'success', message: '检查点已恢复' }}
      />,
    )
    expect(screen.getByText('检查点已恢复')).toBeInTheDocument()
  })

  it('renders a single status message at a time', () => {
    const { rerender } = render(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'success', message: 'First' }}
      />,
    )
    expect(screen.getByText('First')).toBeInTheDocument()

    rerender(
      <AppRestoreStatusBanner
        restoreStatus={{ type: 'error', message: 'Second' }}
      />,
    )
    expect(screen.queryByText('First')).not.toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
