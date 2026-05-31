import { EntityType } from '../graph/graph-manager'

export type ForeshadowState = 'planted' | 'approaching' | 'due' | 'resolved' | 'expired'

export interface ForeshadowRecord {
  id: string
  entityId: string
  hint: string
  plantedChapter: number
  maxDistance: number
  reminderThreshold: number
  state: ForeshadowState
  resolvedChapter?: number
  resolution?: string
}

export class ForeshadowTracker {
  private foreshadows: Map<string, ForeshadowRecord> = new Map()

  plant(id: string, entityId: string, hint: string, chapter: number, maxDistance = 50, reminderThreshold = 10): ForeshadowRecord {
    const record: ForeshadowRecord = {
      id, entityId, hint, plantedChapter: chapter,
      maxDistance, reminderThreshold, state: 'planted',
    }
    this.foreshadows.set(id, record)
    return record
  }

  resolve(id: string, chapter: number, resolution: string): boolean {
    const f = this.foreshadows.get(id)
    if (!f) return false
    f.state = 'resolved'
    f.resolvedChapter = chapter
    f.resolution = resolution
    return true
  }

  getAlerts(currentChapter: number): Array<ForeshadowRecord & { urgency: ForeshadowState; chaptersUntilDue: number }> {
    const results: Array<ForeshadowRecord & { urgency: ForeshadowState; chaptersUntilDue: number }> = []
    for (const f of this.foreshadows.values()) {
      if (f.state === 'resolved' || f.state === 'expired') continue
      const distance = currentChapter - f.plantedChapter
      const chaptersUntilDue = f.maxDistance - distance
      let state: ForeshadowState = f.state
      if (chaptersUntilDue <= 0) state = 'overdue' as ForeshadowState
      else if (chaptersUntilDue <= f.reminderThreshold) state = 'due'
      else if (chaptersUntilDue <= f.maxDistance * 0.6) state = 'approaching'
      results.push({ ...f, state, urgency: state, chaptersUntilDue })
    }
    return results.sort((a, b) => a.chaptersUntilDue - b.chaptersUntilDue)
  }

  markExpired(currentChapter: number): number {
    let count = 0
    for (const f of this.foreshadows.values()) {
      if (f.state !== 'resolved' && (currentChapter - f.plantedChapter) > f.maxDistance) {
        f.state = 'expired'
        count++
      }
    }
    return count
  }

  getAll(): ForeshadowRecord[] {
    return [...this.foreshadows.values()]
  }

  getPending(): ForeshadowRecord[] {
    return [...this.foreshadows.values()].filter(f => f.state !== 'resolved' && f.state !== 'expired')
  }
}
