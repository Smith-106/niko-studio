export interface ChapterContent {
  chapterNumber: number
  title: string
  content: string
}

export interface NameConflict {
  character: string
  chapter1: number
  chapter2: number
  description: string
}

export interface TimelineIssue {
  event1: string
  event2: string
  chapter1: number
  chapter2: number
  description: string
}

export interface UnresolvedThread {
  thread: string
  lastMentioned: number
  description: string
}

export interface TraitDrift {
  character: string
  trait: string
  chapter1: number
  chapter2: number
  description: string
}

export interface ConsistencyReport {
  overallScore: number
  nameConflicts: NameConflict[]
  timelineIssues: TimelineIssue[]
  unresolvedThreads: UnresolvedThread[]
  traitDrifts: TraitDrift[]
  chaptersChecked: number
}

function extractCharacterMentions(content: string): Map<string, Set<string>> {
  const mentions = new Map<string, Set<string>>()
  const namePattern = /[一-鿿]{2,4}(?=说|道|想|看|走|笑|问|答|喊|叫|点|摇|皱|叹|握|拉|推|拍|抱|瞪|扭|抬|低|转|站|坐|躺|冲|跑|飞)/g
  const matches = content.matchAll(namePattern)
  for (const match of matches) {
    const name = match[0]
    const context = content.substring(Math.max(0, match.index! - 20), match.index! + 20)
    const existing = mentions.get(name) ?? new Set()
    existing.add(context)
    mentions.set(name, existing)
  }

  const quotedNames = content.match(/[""「]([一-鿿]{2,4})[」""]/g)
  if (quotedNames) {
    for (const qn of quotedNames) {
      const name = qn.replace(/[""「」""]/g, '')
      if (name.length >= 2) {
        const existing = mentions.get(name) ?? new Set()
        existing.add(`quoted: ${qn}`)
        mentions.set(name, existing)
      }
    }
  }

  const englishNames = content.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g)
  if (englishNames) {
    const commonWords = new Set(['The', 'This', 'That', 'Then', 'There', 'When', 'What', 'Where', 'Which', 'Who', 'How', 'But', 'And', 'Not', 'His', 'Her', 'She', 'They', 'Their', 'Our', 'Your', 'My'])
    for (const name of englishNames) {
      if (!commonWords.has(name)) {
        const existing = mentions.get(name) ?? new Set()
        existing.add(`english name: ${name}`)
        mentions.set(name, existing)
      }
    }
  }

  return mentions
}

function findSimilarNames(names: string[]): Map<string, string[]> {
  const similar = new Map<string, string[]>()
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]
      const b = names[j]
      if (a.length >= 2 && b.length >= 2 && a.length <= 4 && b.length <= 4) {
        const shared = [...a].filter((c) => b.includes(c)).length
        const ratio = shared / Math.max(a.length, b.length)
        if (ratio >= 0.6 && a !== b) {
          const existing = similar.get(a) ?? []
          if (!existing.includes(b)) existing.push(b)
          similar.set(a, existing)
        }
      }
    }
  }
  return similar
}

export function detectNameConflicts(chapters: ChapterContent[]): NameConflict[] {
  const conflicts: NameConflict[] = []
  const chapterNames = chapters.map((ch) => ({
    chapter: ch.chapterNumber,
    names: extractCharacterMentions(ch.content),
  }))

  const allNames = new Set<string>()
  for (const cn of chapterNames) {
    for (const name of cn.names.keys()) {
      allNames.add(name)
    }
  }

  const similar = findSimilarNames([...allNames])
  for (const [name, aliases] of similar) {
    for (const alias of aliases) {
      const chaptersWithA = chapterNames.filter((cn) => cn.names.has(name)).map((cn) => cn.chapter)
      const chaptersWithB = chapterNames.filter((cn) => cn.names.has(alias)).map((cn) => cn.chapter)

      if (chaptersWithA.length > 0 && chaptersWithB.length > 0) {
        conflicts.push({
          character: `${name} / ${alias}`,
          chapter1: chaptersWithA[0],
          chapter2: chaptersWithB[0],
          description: `Possible name inconsistency: "${name}" appears in chapters ${chaptersWithA.join(', ')} and "${alias}" appears in chapters ${chaptersWithB.join(', ')}. These may refer to the same character.`,
        })
      }
    }
  }

  return conflicts
}

export function detectUnresolvedThreads(chapters: ChapterContent[]): UnresolvedThread[] {
  const threads: UnresolvedThread[] = []

  const introPatterns = [
    /(\S{2,10})的?秘密/g,
    /(\S{2,10})的?真相/g,
    /(\S{2,10})之谜/g,
    /(\S{2,10})到底/g,
    /还没?有?(?:告诉|说|揭开|揭晓|透露|揭露|公开)/g,
    /谜底/g,
  ]

  const resolutionPatterns = [
    /原来|真相(?:是|为|就是)|秘密(?:是|为)|谜底(?:是|揭开)/g,
  ]

  const introduced = new Map<string, number>()
  const resolved = new Set<string>()

  for (const ch of chapters) {
    for (const pattern of introPatterns) {
      const matches = ch.content.matchAll(pattern)
      for (const match of matches) {
        const key = match[0].substring(0, 20)
        if (!introduced.has(key)) {
          introduced.set(key, ch.chapterNumber)
        }
      }
    }

    for (const pattern of resolutionPatterns) {
      const matches = ch.content.matchAll(pattern)
      for (const match of matches) {
        resolved.add(match[0])
      }
    }
  }

  for (const [thread, chapter] of introduced) {
    if (!resolved.has(thread)) {
      threads.push({
        thread,
        lastMentioned: chapter,
        description: `"${thread}" was introduced in chapter ${chapter} but has not been resolved in subsequent chapters.`,
      })
    }
  }

  return threads
}

export function runCrossChapterConsistency(chapters: ChapterContent[]): ConsistencyReport {
  const nameConflicts = detectNameConflicts(chapters)
  const unresolvedThreads = detectUnresolvedThreads(chapters)

  const issueCount = nameConflicts.length + unresolvedThreads.length
  const maxIssues = Math.max(chapters.length * 2, 1)
  const overallScore = Math.max(0, Math.round((1 - issueCount / maxIssues) * 100) / 10)

  return {
    overallScore,
    nameConflicts,
    timelineIssues: [],
    unresolvedThreads,
    traitDrifts: [],
    chaptersChecked: chapters.length,
  }
}
