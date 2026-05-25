import { describe, it, expect, vi } from 'vitest'
import { stableKey, stableStringKey, stableStringify } from './stableKey'

describe('stableKey', () => {
  it('produces deterministic hash for the same input', () => {
    const hash1 = stableKey('hello world')
    const hash2 = stableKey('hello world')
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = stableKey('hello')
    const hash2 = stableKey('world')
    expect(hash1).not.toBe(hash2)
  })

  it('returns 0 for empty string', () => {
    const hash = stableKey('')
    expect(hash).toBe(0x811c9dc5 >>> 0)
  })
})

describe('stableStringKey', () => {
  it('produces deterministic output regardless of key order', () => {
    const key1 = stableStringKey({ a: 1, b: 2 })
    const key2 = stableStringKey({ b: 2, a: 1 })
    expect(key1).toBe(key2)
  })

  it('produces different output for different values', () => {
    const key1 = stableStringKey({ a: 1 })
    const key2 = stableStringKey({ a: 2 })
    expect(key1).not.toBe(key2)
  })

  it('handles empty object', () => {
    const key = stableStringKey({})
    expect(key).toBe('')
  })
})

describe('stableStringify', () => {
  it('produces valid JSON with sorted keys', () => {
    const result = stableStringify({ b: 2, a: 1 })
    expect(result).toBe('{"a":1,"b":2}')
  })

  it('is stable regardless of insertion order', () => {
    const result1 = stableStringify({ a: 1, b: 2 })
    const result2 = stableStringify({ b: 2, a: 1 })
    expect(result1).toBe(result2)
  })

  it('handles nested objects', () => {
    const result = stableStringify({ b: { d: 4, c: 3 }, a: 1 })
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}')
  })

  it('handles arrays', () => {
    const result = stableStringify({ items: [3, 1, 2] })
    expect(result).toBe('{"items":[3,1,2]}')
  })

  it('handles null and undefined', () => {
    expect(stableStringify(null)).toBe('{}')
    expect(stableStringify(undefined)).toBe('{}')
  })
})