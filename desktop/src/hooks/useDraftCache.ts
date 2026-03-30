import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_PREFIX = 'niko.draft:'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface DraftEntry {
  text: string
  timestamp: number
}

function load(key: string): string {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return ''
    const entry = JSON.parse(raw) as DraftEntry
    if (Date.now() - entry.timestamp > DRAFT_TTL_MS) {
      localStorage.removeItem(STORAGE_PREFIX + key)
      return ''
    }
    return entry.text
  } catch {
    return ''
  }
}

function save(key: string, text: string): void {
  if (!text) {
    localStorage.removeItem(STORAGE_PREFIX + key)
    return
  }
  try {
    const entry: DraftEntry = { text, timestamp: Date.now() }
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // localStorage may be full
  }
}

export function useDraftCache(conversationId: string | null) {
  const cacheKey = conversationId ?? '__global__'
  const [persistedText, setPersistedText] = useState(() => load(cacheKey))
  const draftKeyRef = useRef(cacheKey)
  draftKeyRef.current = cacheKey

  const persist = useCallback((text: string) => {
    save(draftKeyRef.current, text)
  }, [])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_PREFIX + draftKeyRef.current)
    setPersistedText('')
  }, [])

  // Reload when conversation changes
  useEffect(() => {
    setPersistedText(load(cacheKey))
  }, [cacheKey])

  return { persistedText, persist, clearDraft }
}
