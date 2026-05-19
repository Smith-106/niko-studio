import {
  analyzeWritingSessionIntelligenceCore,
  type WritingSessionIntelligenceResult,
  type WritingSessionTelemetry,
} from '../../../src-ts/analysis/writing-session-intelligence-core'

export type { WritingSessionTelemetry } from '../../../src-ts/analysis/writing-session-intelligence-core'

export interface WritingSessionTelemetryEvent {
  type: 'editor_update' | 'save' | 'history_open' | 'rewrite' | 'jump_edit'
  timestamp: string
  chapterId?: string | null
  characterFocus?: string[]
  keywordFocus?: string[]
}

export function createWritingSessionTelemetry(
  sessionId: string,
  chapterId: string | null,
): WritingSessionTelemetry {
  const now = new Date().toISOString()
  return {
    sessionId,
    chapterId,
    startedAt: now,
    updatedAt: now,
    eventCount: 0,
    activeMinutes: 0,
    saveCount: 0,
    historyPanelOpenCount: 0,
    rewriteCount: 0,
    jumpEditCount: 0,
    recentActions: [],
    characterFocus: [],
    keywordFocus: [],
  }
}

export function applyTelemetryEvent(
  telemetry: WritingSessionTelemetry,
  event: WritingSessionTelemetryEvent,
): WritingSessionTelemetry {
  const recentActions = [...telemetry.recentActions, event.type].slice(-12)
  const updatedAt = event.timestamp
  const startedAtMs = new Date(telemetry.startedAt).getTime()
  const updatedAtMs = new Date(updatedAt).getTime()
  const activeMinutes = Math.max(telemetry.activeMinutes, Math.round((updatedAtMs - startedAtMs) / 60000))

  return {
    ...telemetry,
    chapterId: event.chapterId ?? telemetry.chapterId,
    updatedAt,
    eventCount: telemetry.eventCount + 1,
    activeMinutes,
    saveCount: telemetry.saveCount + (event.type === 'save' ? 1 : 0),
    historyPanelOpenCount: telemetry.historyPanelOpenCount + (event.type === 'history_open' ? 1 : 0),
    rewriteCount: telemetry.rewriteCount + (event.type === 'rewrite' ? 1 : 0),
    jumpEditCount: telemetry.jumpEditCount + (event.type === 'jump_edit' ? 1 : 0),
    recentActions,
    characterFocus: event.characterFocus?.length ? event.characterFocus : telemetry.characterFocus,
    keywordFocus: event.keywordFocus?.length ? event.keywordFocus : telemetry.keywordFocus,
  }
}

export function summarizeWritingSessionTelemetry(
  telemetry: WritingSessionTelemetry,
): WritingSessionIntelligenceResult {
  return analyzeWritingSessionIntelligenceCore(telemetry)
}
