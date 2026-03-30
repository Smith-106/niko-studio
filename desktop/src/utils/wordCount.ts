const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/

export function countWords(text: string): number {
  if (!text) return 0
  let wordCount = 0
  let inEnglishWord = false

  for (const char of text) {
    if (CJK_RANGE.test(char)) {
      if (inEnglishWord) {
        wordCount++
        inEnglishWord = false
      }
      wordCount++
    } else if (/\s/.test(char)) {
      if (inEnglishWord) {
        wordCount++
        inEnglishWord = false
      }
    } else {
      inEnglishWord = true
    }
  }
  if (inEnglishWord) wordCount++

  return wordCount
}

export function countChars(text: string): number {
  return text.length
}

export function readingTimeMinutes(text: string, wordsPerMinute = 500): number {
  const words = countWords(text)
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}
