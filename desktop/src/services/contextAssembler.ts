import type { StyleProfile, buildStyleGuidance } from './styleProfile'

export interface ContextAssemblyOptions {
  storyBible?: string
  characterProfiles?: Array<{ name: string; description: string }>
  memoryEntries?: Array<{ content: string; relevance: number }>
  styleProfile?: StyleProfile
  styleGuidanceBuilder?: typeof buildStyleGuidance
}

export function assembleContext(currentText: string, options: ContextAssemblyOptions): string {
  const sections: string[] = []

  const entityMentions = extractEntityMentions(currentText)

  if (options.characterProfiles && options.characterProfiles.length > 0) {
    const relevant = options.characterProfiles.filter((cp) =>
      entityMentions.some((m) => cp.name.includes(m) || m.includes(cp.name)),
    )
    const profiles = relevant.length > 0 ? relevant : options.characterProfiles.slice(0, 3)
    sections.push(
      '## Character Context\n' +
      profiles.map((p) => `- **${p.name}**: ${p.description}`).join('\n'),
    )
  }

  if (options.storyBible && options.storyBible.trim().length > 0) {
    const relevantExcerpts = extractRelevantExcerpts(options.storyBible, entityMentions)
    if (relevantExcerpts.length > 0) {
      sections.push(
        '## Story Bible References\n' +
        relevantExcerpts.slice(0, 5).join('\n'),
      )
    }
  }

  if (options.memoryEntries && options.memoryEntries.length > 0) {
    const sorted = [...options.memoryEntries].sort((a, b) => b.relevance - a.relevance)
    sections.push(
      '## Relevant Memories\n' +
      sorted.slice(0, 5).map((m) => `- ${m.content}`).join('\n'),
    )
  }

  if (options.styleProfile && options.styleGuidanceBuilder) {
    sections.push(options.styleGuidanceBuilder(options.styleProfile))
  }

  return sections.join('\n\n')
}

function extractEntityMentions(text: string): string[] {
  const mentions = new Set<string>()

  const cjkNames = text.match(/[一-鿿]{2,4}(?=说|道|想|的|在|了|和|对|向|被|把)/g)
  if (cjkNames) {
    for (const name of cjkNames) {
      if (name.length >= 2) mentions.add(name)
    }
  }

  const engNames = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g)
  if (engNames) {
    const common = new Set(['The', 'This', 'That', 'Then', 'There', 'When', 'What', 'Where', 'Which', 'Who', 'How'])
    for (const name of engNames) {
      if (!common.has(name)) mentions.add(name)
    }
  }

  return [...mentions]
}

function extractRelevantExcerpts(storyBible: string, mentions: string[]): string[] {
  if (mentions.length === 0) return []

  const lines = storyBible.split('\n').filter((l) => l.trim().length > 0)
  const relevant: Array<{ line: string; score: number }> = []

  for (const line of lines) {
    let score = 0
    for (const mention of mentions) {
      if (line.includes(mention)) score++
    }
    if (score > 0) {
      relevant.push({ line: line.trim(), score })
    }
  }

  return relevant
    .sort((a, b) => b.score - a.score)
    .map((r) => r.line)
}
