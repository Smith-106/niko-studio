import { createRef, useRef, type RefObject } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDialogFocusTrap } from './useDialogFocusTrap'

interface DialogHarnessProps {
  closeOnEscape?: boolean
  isActive?: boolean
  onClose?: (reason?: string) => void
  withFocusable?: boolean
  useInternalInitialFocus?: boolean
  useExternalInitialFocus?: boolean
  restoreFocusRef?: RefObject<HTMLElement | null>
}

function DialogHarness({
  closeOnEscape = true,
  isActive = true,
  onClose = vi.fn(),
  withFocusable = true,
  useInternalInitialFocus = false,
  useExternalInitialFocus = false,
  restoreFocusRef,
}: DialogHarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalInitialFocusRef = useRef<HTMLButtonElement>(null)
  const externalInitialFocusRef = useRef<HTMLButtonElement>(null)

  useDialogFocusTrap({
    containerRef,
    onClose,
    isActive,
    closeOnEscape,
    initialFocusRef: useInternalInitialFocus
      ? internalInitialFocusRef
      : useExternalInitialFocus
        ? externalInitialFocusRef
        : undefined,
    restoreFocusRef,
  })

  return (
    <div>
      {useExternalInitialFocus ? (
        <button ref={externalInitialFocusRef} data-testid="external-initial">
          external initial
        </button>
      ) : null}
      <div ref={containerRef} data-testid="dialog" role="dialog" tabIndex={-1}>
        {withFocusable ? (
          <>
            <button
              ref={useInternalInitialFocus ? internalInitialFocusRef : undefined}
              data-testid="first"
            >
              first
            </button>
            <button data-testid="last">last</button>
          </>
        ) : (
          <span>no focusables</span>
        )}
      </div>
    </div>
  )
}

function DetachedDialogHarness({
  closeOnEscape = true,
  onClose = vi.fn(),
}: Pick<DialogHarnessProps, 'closeOnEscape' | 'onClose'>) {
  const containerRef = useRef<HTMLDivElement>(null)

  useDialogFocusTrap({
    containerRef,
    onClose,
    closeOnEscape,
  })

  return <div data-testid="detached-dialog">detached</div>
}

afterEach(() => {
  cleanup()
})

describe('useDialogFocusTrap additional coverage', () => {
  it('focuses the requested initial element and wraps tab navigation inside the dialog', () => {
    render(<DialogHarness useInternalInitialFocus />)

    const first = screen.getByTestId('first')
    const last = screen.getByTestId('last')

    expect(first).toHaveFocus()

    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()

    first.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('falls back to the dialog element when there are no focusable descendants', () => {
    render(<DialogHarness withFocusable={false} />)

    const dialog = screen.getByTestId('dialog')
    expect(dialog).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(dialog).toHaveFocus()
  })

  it('moves focus back inside the dialog when tabbing from an external element', () => {
    render(<DialogHarness useExternalInitialFocus />)

    const external = screen.getByTestId('external-initial')
    const first = screen.getByTestId('first')
    const last = screen.getByTestId('last')

    external.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()

    external.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('closes on escape unless disabled or already prevented', () => {
    const onClose = vi.fn()
    const { rerender } = render(<DialogHarness onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith('escape')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<DialogHarness closeOnEscape={false} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const prevented = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    prevented.preventDefault()
    window.dispatchEvent(prevented)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not activate when the trap is disabled', () => {
    const outside = document.createElement('button')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    outside.focus()

    try {
      const onClose = vi.fn()
      render(<DialogHarness isActive={false} onClose={onClose} />)

      expect(outside).toHaveFocus()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      outside.remove()
    }
  })

  it('restores explicit focus targets on cleanup and falls back to the previous focus otherwise', () => {
    const restoreTarget = document.createElement('button')
    restoreTarget.textContent = 'restore'
    document.body.appendChild(restoreTarget)

    const previousFocus = document.createElement('button')
    previousFocus.textContent = 'previous'
    document.body.appendChild(previousFocus)
    previousFocus.focus()

    try {
      const restoreFocusRef = createRef<HTMLElement>()
      restoreFocusRef.current = restoreTarget

      const firstRender = render(<DialogHarness restoreFocusRef={restoreFocusRef} />)
      firstRender.unmount()
      expect(restoreTarget).toHaveFocus()

      previousFocus.focus()
      const disconnectedRef = createRef<HTMLElement>()
      disconnectedRef.current = document.createElement('button')

      const secondRender = render(<DialogHarness restoreFocusRef={disconnectedRef} />)
      secondRender.unmount()
      expect(previousFocus).toHaveFocus()
    } finally {
      restoreTarget.remove()
      previousFocus.remove()
    }
  })

  it('gracefully skips focus cycling when the dialog ref is missing and previous focus is not an HTMLElement', () => {
    const svgFocus = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => svgFocus,
    })

    try {
      const onClose = vi.fn()
      const renderResult = render(<DetachedDialogHarness onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Tab' })
      expect(screen.getByTestId('detached-dialog')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledWith('escape')

      expect(() => renderResult.unmount()).not.toThrow()
    } finally {
      delete (document as Document & { activeElement?: Element }).activeElement
    }
  })
})
