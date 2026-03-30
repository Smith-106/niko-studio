import { describe, expect, it } from 'vitest'
import { countWords, countChars, readingTimeMinutes } from './wordCount'

describe('wordCount', () => {
  describe('countWords', () => {
    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0)
    })

    it('counts English words separated by spaces', () => {
      expect(countWords('hello world foo')).toBe(3)
    })

    it('counts CJK characters as individual words', () => {
      expect(countWords('你好世界')).toBe(4)
    })

    it('handles mixed CJK and English', () => {
      expect(countWords('你好hello世界world')).toBe(6)
    })

    it('handles CJK with spaces', () => {
      expect(countWords('这是 一段 测试')).toBe(6)
    })
  })

  describe('countChars', () => {
    it('returns 0 for empty string', () => {
      expect(countChars('')).toBe(0)
    })

    it('counts all characters', () => {
      expect(countChars('hello')).toBe(5)
    })

    it('counts CJK characters correctly', () => {
      expect(countChars('你好')).toBe(2)
    })
  })

  describe('readingTimeMinutes', () => {
    it('returns at least 1 minute for empty text', () => {
      expect(readingTimeMinutes('')).toBe(1)
    })

    it('returns at least 1 minute for non-empty text', () => {
      expect(readingTimeMinutes('hello')).toBe(1)
    })

    it('calculates based on word count with default 500 wpm', () => {
      // 500 words = 1 min, 501 words = 2 min
      const words = 'word '.repeat(500).trim()
      expect(readingTimeMinutes(words)).toBe(1)
    })
  })
})
