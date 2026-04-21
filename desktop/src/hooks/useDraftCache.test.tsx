import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDraftCache } from './useDraftCache'

describe('useDraftCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty string when no draft exists', () => {
    const { result } = renderHook(() => useDraftCache('conv-1'))
    expect(result.current.persistedText).toBe('')
  })

  it('persists text and returns it', () => {
    const { result } = renderHook(() => useDraftCache('conv-1'))

    act(() => {
      result.current.persist('Hello world')
    })

    // persistedText should update on next read
    const raw = localStorage.getItem('niko.draft:conv-1')
    expect(raw).toBeTruthy()

    const parsed = JSON.parse(raw!)
    expect(parsed.text).toBe('Hello world')
  })

  it('clears draft from localStorage and state', () => {
    const { result } = renderHook(() => useDraftCache('conv-1'))

    act(() => {
      result.current.persist('Some text')
    })

    expect(localStorage.getItem('niko.draft:conv-1')).toBeTruthy()

    act(() => {
      result.current.clearDraft()
    })

    expect(localStorage.getItem('niko.draft:conv-1')).toBeNull()
    expect(result.current.persistedText).toBe('')
  })

  it('uses __global__ key when conversationId is null', () => {
    const { result } = renderHook(() => useDraftCache(null))

    act(() => {
      result.current.persist('global draft')
    })

    expect(localStorage.getItem('niko.draft:__global__')).toBeTruthy()
  })

  it('loads existing draft from localStorage on mount', () => {
    localStorage.setItem('niko.draft:conv-2', JSON.stringify({
      text: 'existing draft',
      timestamp: Date.now(),
    }))

    const { result } = renderHook(() => useDraftCache('conv-2'))
    expect(result.current.persistedText).toBe('existing draft')
  })

  it('expires drafts older than 24 hours', () => {
    const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000
    localStorage.setItem('niko.draft:conv-3', JSON.stringify({
      text: 'old draft',
      timestamp: expiredTimestamp,
    }))

    const { result } = renderHook(() => useDraftCache('conv-3'))
    expect(result.current.persistedText).toBe('')
    expect(localStorage.getItem('niko.draft:conv-3')).toBeNull()
  })

  it('overwrites previous draft when persisting new text', () => {
    const { result } = renderHook(() => useDraftCache('conv-4'))

    act(() => {
      result.current.persist('First version')
    })

    act(() => {
      result.current.persist('Second version')
    })

    const raw = localStorage.getItem('niko.draft:conv-4')
    const parsed = JSON.parse(raw!)
    expect(parsed.text).toBe('Second version')
  })

  it('removes entry from localStorage when persisting empty text', () => {
    const { result } = renderHook(() => useDraftCache('conv-5'))

    act(() => {
      result.current.persist('non-empty')
    })
    expect(localStorage.getItem('niko.draft:conv-5')).toBeTruthy()

    act(() => {
      result.current.persist('')
    })
    expect(localStorage.getItem('niko.draft:conv-5')).toBeNull()
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('niko.draft:conv-6', 'not json')

    const { result } = renderHook(() => useDraftCache('conv-6'))
    expect(result.current.persistedText).toBe('')
  })

  it('reloads draft when conversationId changes', () => {
    localStorage.setItem('niko.draft:conv-a', JSON.stringify({
      text: 'draft A',
      timestamp: Date.now(),
    }))
    localStorage.setItem('niko.draft:conv-b', JSON.stringify({
      text: 'draft B',
      timestamp: Date.now(),
    }))

    const { result, rerender } = renderHook(
      ({ id }) => useDraftCache(id),
      { initialProps: { id: 'conv-a' as string | null } },
    )

    expect(result.current.persistedText).toBe('draft A')

    rerender({ id: 'conv-b' })

    expect(result.current.persistedText).toBe('draft B')
  })
})
