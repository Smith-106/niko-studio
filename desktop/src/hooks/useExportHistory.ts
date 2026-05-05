import { useState, useCallback } from 'react'

const STORAGE_KEY = 'niko.export-history-v1'
const MAX_ENTRIES = 50

export interface ExportEntry {
  id: string
  exportedAt: number
  format: 'md' | 'html' | 'pdf'
  title: string
  wordCount: number
}

function loadHistory(): ExportEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ExportEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: ExportEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage may be full
  }
}

export function useExportHistory() {
  const [history, setHistory] = useState<ExportEntry[]>(() => loadHistory())

  const recordExport = useCallback((format: ExportEntry['format'], title: string, wordCount: number) => {
    const entry: ExportEntry = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exportedAt: Date.now(),
      format,
      title,
      wordCount,
    }
    const updated = [entry, ...loadHistory()].slice(0, MAX_ENTRIES)
    saveHistory(updated)
    setHistory(updated)
  }, [])

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setHistory([])
  }, [])

  return { history, recordExport, clearHistory }
}
