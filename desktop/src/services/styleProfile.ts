export interface StyleProfile {
  avgSentenceLength: number
  vocabRichness: number
  dialogueRatio: number
  tensePreference: 'past' | 'present' | 'mixed'
  avgParagraphLength: number
  sentenceLengthDistribution: number[]
  dominantPOV: 'first' | 'third' | 'mixed'
  sampleHash: string
  extractedAt: string
}

const SENTENCE_ENDINGS = /[.!?。！？]+/g
const DIALOGUE_MARKERS = /[""「」『』""'']/g
const PARAGRAPH_BREAK = /\n\s*\n/

function hashContent(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).slice(0, 16)
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_ENDINGS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function countWords(text: string): number {
  const cjk = text.match(/[一-鿿㐀-䶿]/g)
  const latin = text.replace(/[一-鿿㐀-䶿]/g, ' ').trim().split(/\s+/).filter(Boolean)
  return (cjk?.length ?? 0) + latin.length
}

function countUniqueWords(text: string): number {
  const normalized = text.toLowerCase().replace(/[^\w一-鿿㐀-䶿]/g, ' ')
  const words = normalized.split(/\s+/).filter(Boolean)
  return new Set(words).size
}

function countDialogueSentences(text: string): number {
  const sentences = splitSentences(text)
  let count = 0
  for (const s of sentences) {
    if (DIALOGUE_MARKERS.test(s)) count++
    DIALOGUE_MARKERS.lastIndex = 0
  }
  return count
}

function detectTense(text: string): 'past' | 'present' | 'mixed' {
  const lower = text.toLowerCase()
  const pastIndicators = /\b(was|were|had|did|went|came|said|thought|felt|knew|saw|heard)\b/g
  const presentIndicators = /\b(is|are|has|does|goes|comes|says|thinks|feels|knows|sees|hears)\b/g
  const pastCount = (lower.match(pastIndicators) ?? []).length
  const presentCount = (lower.match(presentIndicators) ?? []).length
  if (pastCount > presentCount * 2) return 'past'
  if (presentCount > pastCount * 2) return 'present'
  return 'mixed'
}

function detectPOV(text: string): 'first' | 'third' | 'mixed' {
  const lower = text.toLowerCase()
  const firstPerson = /\b(i|me|my|mine|myself|we|us|our|ours)\b/g
  const thirdPerson = /\b(he|him|his|she|her|hers|they|them|their|it|its)\b/g
  const firstCount = (lower.match(firstPerson) ?? []).length
  const thirdCount = (lower.match(thirdPerson) ?? []).length
  if (firstCount > thirdCount * 2) return 'first'
  if (thirdCount > firstCount * 2) return 'third'
  return 'mixed'
}

export function extractStyleProfile(text: string): StyleProfile {
  const sentences = splitSentences(text)
  const paragraphs = text.split(PARAGRAPH_BREAK).filter((p) => p.trim().length > 0)
  const totalWords = countWords(text)
  const uniqueWords = countUniqueWords(text)
  const dialogueSentences = countDialogueSentences(text)

  const sentenceLengths = sentences.map((s) => countWords(s))
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0

  const buckets = 5
  const maxLen = Math.max(...sentenceLengths, 1)
  const distribution = new Array(buckets).fill(0)
  for (const len of sentenceLengths) {
    const bucket = Math.min(Math.floor((len / maxLen) * buckets), buckets - 1)
    distribution[bucket]++
  }

  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    vocabRichness: totalWords > 0 ? Math.round((uniqueWords / totalWords) * 1000) / 1000 : 0,
    dialogueRatio: sentences.length > 0 ? Math.round((dialogueSentences / sentences.length) * 1000) / 1000 : 0,
    tensePreference: detectTense(text),
    avgParagraphLength: paragraphs.length > 0
      ? Math.round((paragraphs.reduce((a, p) => a + countWords(p), 0) / paragraphs.length) * 10) / 10
      : 0,
    sentenceLengthDistribution: distribution,
    dominantPOV: detectPOV(text),
    sampleHash: hashContent(text),
    extractedAt: new Date().toISOString(),
  }
}

export function buildStyleGuidance(profile: StyleProfile): string {
  const lines: string[] = ['Target style parameters:']
  lines.push(`- Average sentence length: ${profile.avgSentenceLength} words`)
  lines.push(`- Vocabulary richness: ${(profile.vocabRichness * 100).toFixed(1)}%`)
  lines.push(`- Dialogue ratio: ${(profile.dialogueRatio * 100).toFixed(1)}%`)
  lines.push(`- Tense: ${profile.tensePreference}`)
  lines.push(`- POV: ${profile.dominantPOV}`)
  lines.push(`- Average paragraph length: ${profile.avgParagraphLength} words`)
  lines.push('')
  lines.push('Match these parameters when generating or revising text. Do not deviate significantly from the measured style.')
  return lines.join('\n')
}

export function compareStyleProfiles(a: StyleProfile, b: StyleProfile): {
  overallSimilarity: number
  differences: Array<{ metric: string; a: number; b: number; delta: number }>
} {
  const metrics: Array<{ metric: string; a: number; b: number }> = [
    { metric: 'avgSentenceLength', a: a.avgSentenceLength, b: b.avgSentenceLength },
    { metric: 'vocabRichness', a: a.vocabRichness, b: b.vocabRichness },
    { metric: 'dialogueRatio', a: a.dialogueRatio, b: b.dialogueRatio },
    { metric: 'avgParagraphLength', a: a.avgParagraphLength, b: b.avgParagraphLength },
  ]

  const maxValues: Record<string, number> = {
    avgSentenceLength: 50,
    vocabRichness: 1,
    dialogueRatio: 1,
    avgParagraphLength: 200,
  }

  const differences = metrics.map(({ metric, a: va, b: vb }) => ({
    metric,
    a: va,
    b: vb,
    delta: Math.round(Math.abs(va - vb) * 1000) / 1000,
  }))

  const totalDissimilarity = differences.reduce((sum, d) => {
    const max = maxValues[d.metric] || 1
    return sum + (d.delta / max)
  }, 0)

  const overallSimilarity = Math.max(0, Math.round((1 - totalDissimilarity / differences.length) * 1000) / 1000)

  return { overallSimilarity, differences }
}
