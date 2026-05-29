import { SyncStateStore } from './sync-state-store'

interface DiffSection {
  heading: string
  vaultLines: string[]
  knowledgeLines: string[]
  hasConflict: boolean
}

export class MarkdownDiff {
  private store: SyncStateStore

  constructor(store: SyncStateStore) {
    this.store = store
  }

  structuredDiff(vaultContent: string, knowledgeContent: string): DiffSection[] {
    const vaultSections = this.splitByHeading(vaultContent)
    const knowledgeSections = this.splitByHeading(knowledgeContent)

    const allHeadings = new Set([...vaultSections.keys(), ...knowledgeSections.keys()])
    const sections: DiffSection[] = []

    for (const heading of allHeadings) {
      const vaultLines = vaultSections.get(heading) ?? []
      const knowledgeLines = knowledgeSections.get(heading) ?? []
      const hasConflict =
        vaultLines.length > 0 &&
        knowledgeLines.length > 0 &&
        vaultLines.join('\n') !== knowledgeLines.join('\n')

      sections.push({ heading, vaultLines, knowledgeLines, hasConflict })
    }

    return sections
  }

  autoMerge(vaultContent: string, knowledgeContent: string): {
    merged: string
    conflicts: DiffSection[]
  } {
    const sections = this.structuredDiff(vaultContent, knowledgeContent)
    const mergedLines: string[] = []
    const conflicts: DiffSection[] = []

    for (const section of sections) {
      if (section.hasConflict) {
        conflicts.push(section)
        // Default: keep both with conflict markers
        mergedLines.push(`# ${section.heading}`)
        mergedLines.push('<<<<<<< vault')
        mergedLines.push(...section.vaultLines)
        mergedLines.push('=======')
        mergedLines.push(...section.knowledgeLines)
        mergedLines.push('>>>>>>> knowledge')
      } else {
        mergedLines.push(`# ${section.heading}`)
        const lines = section.vaultLines.length > 0 ? section.vaultLines : section.knowledgeLines
        mergedLines.push(...lines)
      }
    }

    return { merged: mergedLines.join('\n'), conflicts }
  }

  private splitByHeading(content: string): Map<string, string[]> {
    const sections = new Map<string, string[]>()
    let currentHeading = '__preamble__'
    let currentLines: string[] = []

    for (const line of content.split('\n')) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        sections.set(currentHeading, currentLines)
        currentHeading = headingMatch[2].trim()
        currentLines = []
      } else {
        currentLines.push(line)
      }
    }

    sections.set(currentHeading, currentLines)
    return sections
  }
}
