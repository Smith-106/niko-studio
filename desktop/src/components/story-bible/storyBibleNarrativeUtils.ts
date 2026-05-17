export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function slugifyRecordSegment(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    || 'record'
}

export type NarrativeRecordKind = 'scene' | 'event' | 'timeline'
export type NarrativeTimelineMode = 'story' | 'narrative'

export function buildNarrativeItemKind(kind: NarrativeRecordKind): string {
  return `narrative-${kind}`
}

export function buildNarrativeRecordId(kind: NarrativeRecordKind, workspaceId: string, title: string): string {
  return `${kind}-${workspaceId}-${slugifyRecordSegment(title)}`
}
