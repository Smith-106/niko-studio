import { useCallback, useEffect, useRef, useState } from 'react'

interface UseResizablePanelOptions {
  defaultWidth: number
  minWidth: number
  maxWidth: number
  storageKey: string
  direction?: 'rtl' | 'ltr'
}

export function useResizablePanel({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  direction = 'rtl',
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= minWidth && n <= maxWidth) return n
      }
    } catch {}
    return defaultWidth
  })

  const [isResizing, setIsResizing] = useState(false)
  const widthRef = useRef(width)
  widthRef.current = width
  // Track active listeners so cleanup can remove them if component unmounts during resize
  const activeListenersRef = useRef<{ onMove: (ev: MouseEvent) => void; onUp: () => void } | null>(null)

  // Cleanup document listeners if component unmounts during an active resize session
  useEffect(() => {
    return () => {
      if (activeListenersRef.current) {
        document.removeEventListener('mousemove', activeListenersRef.current.onMove)
        document.removeEventListener('mouseup', activeListenersRef.current.onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [])

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const originX = e.clientX
      const originWidth = widthRef.current
      setIsResizing(true)

      const onMove = (ev: MouseEvent) => {
        const delta = direction === 'rtl' ? ev.clientX - originX : originX - ev.clientX
        const next = Math.max(minWidth, Math.min(maxWidth, originWidth + delta))
        setWidth(next)
        try {
          localStorage.setItem(storageKey, String(Math.round(next)))
        } catch {}
      }

      const onUp = () => {
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        activeListenersRef.current = null
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      activeListenersRef.current = { onMove, onUp }
    },
    [direction, minWidth, maxWidth, storageKey],
  )

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth)
    try {
      localStorage.setItem(storageKey, String(defaultWidth))
    } catch {}
  }, [defaultWidth, storageKey])

  return { width, isResizing, startResize, resetWidth }
}
