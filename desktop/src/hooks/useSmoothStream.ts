import { useRef, useCallback } from 'react'

interface UseSmoothStreamOptions {
  onUpdate: (text: string) => void
  streamDone: boolean
  minDelay?: number
  initialText?: string
}

export function useSmoothStream({ onUpdate, streamDone, minDelay = 10, initialText = '' }: UseSmoothStreamOptions) {
  const queueRef = useRef('')
  const displayedRef = useRef(initialText)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const segmenter = useRef<Intl.Segmenter | null>(null)
  try {
    // Intl.Segmenter may not be available in all environments
    segmenter.current = new Intl.Segmenter('zh', { granularity: 'grapheme' })
  } catch {
    segmenter.current = null
  }

  const flushQueue = useCallback(() => {
    const queue = queueRef.current
    if (!queue) return ''

    const chars = segmenter.current
      ? [...segmenter.current.segment(queue)].map((s) => s.segment)
      : [...queue]

    const count = Math.max(1, Math.floor(chars.length / 5))
    const toConsume = chars.slice(0, count)
    const remaining = chars.slice(count)

    queueRef.current = remaining.join('')
    return toConsume.join('')
  }, [])

  const tick = useCallback(
    (timestamp: number) => {
      if (timestamp - lastTimeRef.current < minDelay) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastTimeRef.current = timestamp

      const chunk = flushQueue()
      if (chunk) {
        displayedRef.current += chunk
        onUpdate(displayedRef.current)
      }

      if (queueRef.current || !streamDone) {
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [minDelay, streamDone, flushQueue, onUpdate]
  )

  const addChunk = useCallback(
    (chunk: string) => {
      queueRef.current += chunk
      if (!rafRef.current) {
        lastTimeRef.current = 0
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [tick]
  )

  const reset = useCallback(
    (text = '') => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      queueRef.current = ''
      displayedRef.current = text
      onUpdate(text)
    },
    [onUpdate]
  )

  return { addChunk, reset }
}
