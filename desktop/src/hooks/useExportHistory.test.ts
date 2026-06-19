import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExportHistory } from './useExportHistory'

describe('useExportHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty history initially', () => {
    const { result } = renderHook(() => useExportHistory())
    expect(result.current.history).toEqual([])
  })

  it('records an export entry', () => {
    const { result } = renderHook(() => useExportHistory())

    act(() => {
      result.current.recordExport('md', 'My Document', 500)
    })

    expect(result.current.history).toHaveLength(1)
    const entry = result.current.history[0]
    expect(entry.format).toBe('md')
    expect(entry.title).toBe('My Document')
    expect(entry.wordCount).toBe(500)
    expect(entry.id).toMatch(/^exp-/)
  })

  it('returns history sorted by exportedAt DESC', () => {
    const { result } = renderHook(() => useExportHistory())

    act(() => { result.current.recordExport('md', 'First', 100) })
    act(() => { result.current.recordExport('html', 'Second', 200) })

    expect(result.current.history).toHaveLength(2)
    expect(result.current.history[0].title).toBe('Second')
    expect(result.current.history[1].title).toBe('First')
  })

  it('caps at 50 entries with FIFO eviction', () => {
    const { result } = renderHook(() => useExportHistory())

    for (let i = 0; i < 55; i++) {
      act(() => { result.current.recordExport('md', `Doc ${i}`, i * 10) })
    }

    expect(result.current.history).toHaveLength(50)
    expect(result.current.history[0].title).toBe('Doc 54')
    expect(result.current.history[49].title).toBe('Doc 5')
  })

  it('clears all history', () => {
    const { result } = renderHook(() => useExportHistory())

    act(() => { result.current.recordExport('md', 'Doc', 100) })
    expect(result.current.history).toHaveLength(1)

    act(() => { result.current.clearHistory() })
    expect(result.current.history).toEqual([])
    expect(localStorage.getItem('niko.export-history-v1')).toBeNull()
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useExportHistory())

    act(() => { result.current.recordExport('pdf', 'Persisted', 300) })

    const raw = localStorage.getItem('niko.export-history-v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed[0].format).toBe('pdf')
  })

  it('falls back to an empty history when persisted data is invalid', () => {
    localStorage.setItem('niko.export-history-v1', '{invalid-json')

    const { result } = renderHook(() => useExportHistory())

    expect(result.current.history).toEqual([])
  })

  it('falls back to an empty history when storage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useExportHistory())

    expect(result.current.history).toEqual([])
  })

  it('keeps in-memory history updates when persistence writes fail', () => {
    const { result } = renderHook(() => useExportHistory())

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => {
      act(() => {
        result.current.recordExport('docx', 'Draft Export', 1200)
      })
    }).not.toThrow()

    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0]).toMatchObject({
      format: 'docx',
      title: 'Draft Export',
      wordCount: 1200,
    })
  })
})
