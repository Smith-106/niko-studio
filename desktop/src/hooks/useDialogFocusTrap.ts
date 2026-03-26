import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface UseDialogFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>
  onClose: () => void
  isActive?: boolean
}

export function useDialogFocusTrap({ containerRef, onClose, isActive = true }: UseDialogFocusTrapOptions) {
  useEffect(() => {
    if (!isActive) {
      return
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusDialog = () => {
      const dialog = containerRef.current
      if (!dialog) return
      const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable) {
        focusable.focus()
      } else {
        dialog.focus()
      }
    }

    focusDialog()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = containerRef.current
      if (!dialog) return

      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1
      )

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (!active || active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [containerRef, isActive, onClose])
}
