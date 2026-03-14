import type { KnowledgeItem } from './KnowledgeTypes'

export const toGraphItems = (rows: unknown[] | undefined, key: string): KnowledgeItem[] => {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    if (row && typeof row === 'object' && key in (row as Record<string, unknown>)) {
      const value = (row as Record<string, unknown>)[key]
      if (value && typeof value === 'object') {
        return value as Record<string, unknown>
      }
    }
    if (row && typeof row === 'object') {
      return row as Record<string, unknown>
    }
    return { value: String(row) }
  })
}
