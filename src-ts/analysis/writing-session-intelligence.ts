import {
  analyzeWritingSessionIntelligenceCore,
  type WritingSessionIntelligenceResult,
  type WritingSessionTelemetry,
} from './writing-session-intelligence-core.js'
import { createWritingSessionCluster, type WritingSession } from './writing-session-cluster.js'

function buildSessionForClustering(telemetry: WritingSessionTelemetry): WritingSession {
  return {
    id: telemetry.sessionId,
    type: 'chapter',
    characters: telemetry.characterFocus,
    keywords: telemetry.keywordFocus,
    order: telemetry.eventCount,
    relatedEntities: telemetry.characterFocus,
    styleVector: [
      Math.min(1, telemetry.activeMinutes / 60),
      Math.min(1, telemetry.saveCount / 10),
      Math.min(1, telemetry.rewriteCount / 10),
      Math.min(1, telemetry.jumpEditCount / 10),
      Math.min(1, telemetry.historyPanelOpenCount / 10),
    ],
  }
}

export function analyzeWritingSessionIntelligence(
  telemetry: WritingSessionTelemetry,
): WritingSessionIntelligenceResult {
  const baseResult = analyzeWritingSessionIntelligenceCore(telemetry)

  let clusterName: string | null = null
  try {
    const cluster = createWritingSessionCluster(':memory:')
    const result = cluster.clusterSessions([buildSessionForClustering(telemetry)])
    clusterName = result[0]?.name ?? null
    cluster.close()
  } catch {
    clusterName = null
  }

  return {
    ...baseResult,
    clusterName,
  }
}
