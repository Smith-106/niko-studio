import { describe, expect, it } from 'vitest'

import {
  applyTelemetryEvent,
  createWritingSessionTelemetry,
  summarizeWritingSessionTelemetry,
} from './writingSessionTelemetry'

describe('writingSessionTelemetry', () => {
  it('builds telemetry from lightweight editor events', () => {
    const telemetry = createWritingSessionTelemetry('session-1', 'chapter-7')
    const updated = applyTelemetryEvent(telemetry, {
      type: 'save',
      timestamp: telemetry.startedAt,
      chapterId: 'chapter-7',
      characterFocus: ['林岚'],
      keywordFocus: ['冲突', '匿名信'],
    })

    expect(updated.eventCount).toBe(1)
    expect(updated.saveCount).toBe(1)
    expect(updated.characterFocus).toEqual(['林岚'])
    expect(updated.keywordFocus).toEqual(['冲突', '匿名信'])
  })

  it('produces advisory insights from telemetry', () => {
    const telemetry = {
      ...createWritingSessionTelemetry('session-2', 'chapter-8'),
      eventCount: 6,
      activeMinutes: 52,
      saveCount: 0,
      historyPanelOpenCount: 2,
      rewriteCount: 4,
      jumpEditCount: 3,
    }

    const result = summarizeWritingSessionTelemetry(telemetry)

    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights.some((item) => item.pattern === 'rewrite_loop')).toBe(true)
    expect(result.insights.some((item) => item.pattern === 'fatigue_risk')).toBe(true)
  })
})
