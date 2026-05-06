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

function detectTimelineIssues(chapters: ChapterContent[]): TimelineIssue[] {
  const issues: TimelineIssue[] = []

  const timeExpressions: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /(\d{1,4})年/g, label: 'year' },
    { pattern: /([春夏秋冬][天季])/g, label: 'season' },
    { pattern: /([一二三四五六七八九十]+)[日号]/g, label: 'day' },
    { pattern: /(昨天|今天|明天|前天|后天|大前天|大后天)/g, label: 'relative_day' },
    { pattern: /(上午|下午|傍晚|深夜|凌晨|中午|黄昏|黎明)/g, label: 'time_of_day' },
    { pattern: /(第[一二三四五六七八九十百]+[天月年周])/g, label: 'ordinal_period' },
  ]

  const chapterTimelines = chapters.map((ch) => {
    const events: Array<{ text: string; type: string }> = []
    for (const { pattern, label } of timeExpressions) {
      for (const match of ch.content.matchAll(pattern)) {
        events.push({ text: match[0], type: label })
      }
    }
    return { chapter: ch.chapterNumber, events }
  })

  const dayExpressions = /(昨天|今天|明天|前天|后天)/g
  const chapterRelDays = chapters.map((ch) => {
    const refs: string[] = []
    for (const match of ch.content.matchAll(dayExpressions)) {
      refs.push(match[0])
    }
    return { chapter: ch.chapterNumber, refs }
  })

  for (let i = 0; i < chapterRelDays.length; i++) {
    const current = chapterRelDays[i]
    if (current.refs.length === 0) continue
    for (let j = i + 1; j < chapterRelDays.length; j++) {
      const later = chapterRelDays[j]
      const sameRefs = current.refs.filter((r) => later.refs.includes(r))
      if (sameRefs.length > 0 && sameRefs.length >= Math.max(current.refs.length, later.refs.length) * 0.5) {
        issues.push({
          event1: sameRefs.join(', '),
          event2: sameRefs.join(', '),
          chapter1: current.chapter,
          chapter2: later.chapter,
          description: `Same relative time references (${sameRefs.join(', ')}) appear in chapters ${current.chapter} and ${later.chapter} despite narrative progression. This may indicate a timeline inconsistency.`,
        })
      }
    }
  }

  for (let i = 0; i < chapterTimelines.length; i++) {
    const ct = chapterTimelines[i]
    const yearEvents = ct.events.filter((e) => e.type === 'year')
    for (let j = i + 1; j < chapterTimelines.length; j++) {
      const lt = chapterTimelines[j]
      const laterYears = lt.events.filter((e) => e.type === 'year')
      if (yearEvents.length > 0 && laterYears.length > 0) {
        const firstYear = yearEvents[0].text
        const laterYear = laterYears[laterYears.length - 1].text
        const fy = parseInt(firstYear)
        const ly = parseInt(laterYear)
        if (!isNaN(fy) && !isNaN(ly) && fy > ly) {
          issues.push({
            event1: firstYear,
            event2: laterYear,
            chapter1: ct.chapter,
            chapter2: lt.chapter,
            description: `Timeline regression: "${firstYear}" in chapter ${ct.chapter} is later than "${laterYear}" in chapter ${lt.chapter}.`,
          })
        }
      }
    }
  }

  return issues
}

function normalizeCharacterName(raw: string): string {
  const verbSuffixes = ['笑了', '笑道', '说道', '喊道', '叹道', '答道', '问到', '看着', '走了', '想了']
  for (const suffix of verbSuffixes) {
    if (raw.endsWith(suffix) && raw.length > suffix.length) {
      return raw.slice(0, raw.length - suffix.length)
    }
  }
  if (raw.length > 2) {
    const lastChar = raw[raw.length - 1]
    const actionChars = '说想看走笑问答喊叫点摇皱叹握拉推拍抱瞪扭抬低转站坐躺冲跑飞道'
    if (actionChars.includes(lastChar)) {
      return raw.slice(0, raw.length - 1)
    }
  }
  return raw
}

function detectTraitDrifts(chapters: ChapterContent[]): TraitDrift[] {
  const drifts: TraitDrift[] = []

  const traitWords: Array<{ trait: string; word: string; opposite: string }> = [
    { trait: 'personality', word: '冷酷', opposite: '温柔' },
    { trait: 'personality', word: '温柔', opposite: '冷酷' },
    { trait: 'personality', word: '善良', opposite: '凶恶' },
    { trait: 'personality', word: '凶恶', opposite: '善良' },
    { trait: 'personality', word: '勇敢', opposite: '怯懦' },
    { trait: 'personality', word: '怯懦', opposite: '勇敢' },
    { trait: 'personality', word: '暴躁', opposite: '沉稳' },
    { trait: 'personality', word: '沉稳', opposite: '暴躁' },
    { trait: 'personality', word: '开朗', opposite: '沉默' },
    { trait: 'personality', word: '沉默', opposite: '开朗' },
    { trait: 'appearance', word: '高大', opposite: '矮小' },
    { trait: 'appearance', word: '矮小', opposite: '高大' },
    { trait: 'appearance', word: '苗条', opposite: '肥胖' },
    { trait: 'appearance', word: '肥胖', opposite: '苗条' },
    { trait: 'speech', word: '轻声', opposite: '大喊' },
    { trait: 'speech', word: '大喊', opposite: '轻声' },
    { trait: 'speech', word: '激动', opposite: '平静' },
    { trait: 'speech', word: '平静', opposite: '激动' },
    { trait: 'speech', word: '冷漠', opposite: '温和' },
    { trait: 'speech', word: '温和', opposite: '冷漠' },
  ]

  const characterTraits = new Map<string, Map<number, string[]>>()

  for (const ch of chapters) {
    const mentions = extractCharacterMentions(ch.content)
    for (const [rawName] of mentions) {
      const name = normalizeCharacterName(rawName)
      if (name.length < 2) continue
      if (!characterTraits.has(name)) characterTraits.set(name, new Map())
      const byChapter = characterTraits.get(name)!
      if (!byChapter.has(ch.chapterNumber)) byChapter.set(ch.chapterNumber, [])
      for (const { word } of traitWords) {
        if (ch.content.includes(word)) {
          byChapter.get(ch.chapterNumber)!.push(word)
        }
      }
    }
  }

  for (const [name, byChapter] of characterTraits) {
    const chapterNums = [...byChapter.keys()].sort((a, b) => a - b)
    if (chapterNums.length < 2) continue

    for (let i = 0; i < chapterNums.length - 1; i++) {
      const ch1 = chapterNums[i]
      const ch2 = chapterNums[i + 1]
      const traits1 = byChapter.get(ch1)!
      const traits2 = byChapter.get(ch2)!
      if (traits1.length === 0 || traits2.length === 0) continue

      for (const t1 of traits1) {
        for (const t2 of traits2) {
          const entry = traitWords.find((tw) => tw.word === t1)
          if (entry && (entry.opposite === t2)) {
            drifts.push({
              character: name,
              trait: entry.trait,
              chapter1: ch1,
              chapter2: ch2,
              description: `${name}: trait "${t1}" in chapter ${ch1} shifts to "${t2}" in chapter ${ch2} without explicit character development.`,
            })
          }
        }
      }
    }
  }

  return drifts
}

export function runCrossChapterConsistency(chapters: ChapterContent[]): ConsistencyReport {
  const nameConflicts = detectNameConflicts(chapters)
  const timelineIssues = detectTimelineIssues(chapters)
  const unresolvedThreads = detectUnresolvedThreads(chapters)
  const traitDrifts = detectTraitDrifts(chapters)

  const issueCount = nameConflicts.length + timelineIssues.length + unresolvedThreads.length + traitDrifts.length
  const maxIssues = Math.max(chapters.length * 2, 1)
  const overallScore = Math.max(0, Math.round((1 - issueCount / maxIssues) * 100) / 10)

  return {
    overallScore,
    nameConflicts,
    timelineIssues,
    unresolvedThreads,
    traitDrifts,
    chaptersChecked: chapters.length,
  }
}
