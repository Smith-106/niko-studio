import { useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let toastId = 0

/**
 * Simple toast notification state manager.
 * Adapted from Cherry Studio's window.toast pattern.
 *
 * Usage:
 *   const { toasts, addToast, removeToast } = useToast()
 *   addToast('success', 'Copied to clipboard')
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = ++toastId
      setToasts((prev) => [...prev.slice(-4), { id, type, message }])
      const timer = setTimeout(() => removeToast(id), duration)
      timersRef.current.set(id, timer)
    },
    [removeToast],
  )

  return { toasts, addToast, removeToast }
}
