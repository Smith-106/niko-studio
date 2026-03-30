import { useRef, useEffect, useCallback, useState } from 'react'

const STORAGE_PREFIX = 'niko.scroll:'

function throttle<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...args)
      }, wait - (now - last))
    }
  }) as T
}

export function useScrollPosition(key: string, throttleWait = 100) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const checkNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const threshold = 120
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    setIsNearBottom(atBottom)
  }, [])

  const savePosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(container.scrollTop))
    } catch {
      // localStorage may be full or unavailable
    }
    checkNearBottom()
  }, [key, checkNearBottom])

  const throttledSave = useRef(throttle(savePosition, throttleWait))

  useEffect(() => {
    throttledSave.current = throttle(savePosition, throttleWait)
  }, [savePosition, throttleWait])

  const handleScroll = useCallback(() => {
    throttledSave.current()
  }, [])

  // Restore scroll position after mount
  useEffect(() => {
    const container = containerRef.current
    if (!container || !key) return

    requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(STORAGE_PREFIX + key)
        if (saved) {
          container.scrollTop = Number(saved)
        }
      } catch {
        // ignore
      }
    })
  }, [key])

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (typeof container.scrollTo !== 'function') {
      // JSDOM fallback
      container.scrollTop = container.scrollHeight
      return
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [])

  return { containerRef, handleScroll, isNearBottom, scrollToBottom }
}
