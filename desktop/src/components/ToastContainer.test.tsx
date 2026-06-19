import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastContainer } from './ToastContainer'
import type { ToastItem } from '../hooks/useToast'

const successToast: ToastItem = { id: 1, type: 'success', message: 'Operation succeeded' }
const errorToast: ToastItem = { id: 2, type: 'error', message: 'Something went wrong' }
const infoToast: ToastItem = { id: 3, type: 'info', message: 'Here is some info' }

describe('ToastContainer', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('returns null when toasts array is empty', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders a single success toast with correct message', () => {
    render(
      <ToastContainer toasts={[successToast]} onDismiss={vi.fn()} />,
    )

    expect(screen.getByText('Operation succeeded')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders multiple toasts stacked vertically', () => {
    render(
      <ToastContainer
        toasts={[successToast, errorToast, infoToast]}
        onDismiss={vi.fn()}
      />,
    )

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(3)
    expect(screen.getByText('Operation succeeded')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Here is some info')).toBeInTheDocument()
  })

  it('applies type-specific styles to each toast', () => {
    const { container } = render(
      <ToastContainer
        toasts={[successToast, errorToast, infoToast]}
        onDismiss={vi.fn()}
      />,
    )

    const alerts = container.querySelectorAll('[role="alert"]')
    // success toast should have green styling
    expect(alerts[0]?.className).toContain('bg-green-50')
    expect(alerts[0]?.className).toContain('text-green-700')

    // error toast should have red styling
    expect(alerts[1]?.className).toContain('bg-red-50')
    expect(alerts[1]?.className).toContain('text-red-700')

    // info toast should have blue styling
    expect(alerts[2]?.className).toContain('bg-blue-50')
    expect(alerts[2]?.className).toContain('text-blue-700')
  })

  it('calls onDismiss with the toast id when a toast is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <ToastContainer
        toasts={[successToast, errorToast]}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByText('Something went wrong'))
    expect(onDismiss).toHaveBeenCalledWith(2)
  })

  it('delays dismissal animation outside the test runtime branch', () => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'production')
    const onDismiss = vi.fn()

    render(
      <ToastContainer
        toasts={[successToast]}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByText('Operation succeeded'))

    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(249)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledWith(1)
  })

  it('shows the correct icon for each toast type', () => {
    render(
      <ToastContainer
        toasts={[successToast, errorToast, infoToast]}
        onDismiss={vi.fn()}
      />,
    )

    // Success icon
    const successAlert = screen.getByText('Operation succeeded').closest('[role="alert"]')
    expect(successAlert?.querySelector('span')?.textContent).toBe('\u2713')

    // Error icon
    const errorAlert = screen.getByText('Something went wrong').closest('[role="alert"]')
    expect(errorAlert?.querySelector('span')?.textContent).toBe('\u2715')

    // Info icon
    const infoAlert = screen.getByText('Here is some info').closest('[role="alert"]')
    expect(infoAlert?.querySelector('span')?.textContent).toBe('\u2139')
  })

  it('renders the container with fixed positioning at bottom-right', () => {
    const { container } = render(
      <ToastContainer toasts={[infoToast]} onDismiss={vi.fn()} />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('fixed')
    expect(wrapper.className).toContain('bottom-4')
    expect(wrapper.className).toContain('right-4')
  })

  it('uses flex column with gap for toast stacking', () => {
    const { container } = render(
      <ToastContainer toasts={[successToast, errorToast]} onDismiss={vi.fn()} />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('flex')
    expect(wrapper.className).toContain('flex-col')
    expect(wrapper.className).toContain('gap-2')
  })
})
