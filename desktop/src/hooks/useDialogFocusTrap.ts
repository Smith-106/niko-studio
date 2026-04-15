import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type DialogCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'action-complete'
  | 'host-close'

interface UseDialogFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>
  onClose: (reason?: DialogCloseReason) => void
  isActive?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  restoreFocusRef?: RefObject<HTMLElement | null>
  closeOnEscape?: boolean
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1
  )
}

export function useDialogFocusTrap({
  containerRef,
  onClose,
  isActive = true,
  initialFocusRef,
  restoreFocusRef,
  closeOnEscape = true,
}: UseDialogFocusTrapOptions) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusDialog = () => {
      const dialog = containerRef.current
      if (!dialog) return

      const initialFocus = initialFocusRef?.current
      if (initialFocus && dialog.contains(initialFocus)) {
        initialFocus.focus()
        return
      }

      const focusable = getFocusableElements(dialog)[0]
      if (focusable) {
        focusable.focus()
      } else {
        dialog.focus()
      }
    }

    focusDialog()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key === 'Escape') {
        if (!closeOnEscape) {
          return
        }

        event.preventDefault()
        onCloseRef.current('escape')
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = containerRef.current
      if (!dialog) return

      const focusableElements = getFocusableElements(dialog)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement as HTMLElement | null
      const activeInside = Boolean(active && dialog.contains(active))
      const activeInCycle = Boolean(active && focusableElements.includes(active))

      if (event.shiftKey) {
        if (!activeInside || !activeInCycle || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!activeInside || !activeInCycle || active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)

      const restoreFocus = restoreFocusRef?.current
      if (restoreFocus?.isConnected) {
        restoreFocus.focus()
        return
      }

      previousFocus?.focus()
    }
  }, [closeOnEscape, containerRef, initialFocusRef, isActive, restoreFocusRef])
}
