/**
 * Session Intelligence Service Implementation
 *
 * Collects writing behavior telemetry, performs single-session analysis
 * via the writing-session-intelligence-core module, and cross-session
 * clustering via the WritingSessionCluster class.
 */

import type {
  WritingSessionTelemetry,
  SessionInsight,
  WritingSessionPattern,
} from '../analysis/writing-session-intelligence-core';

import { analyzeWritingSessionIntelligenceCore } from '../analysis/writing-session-intelligence-core';

import type {
  WritingSession,
  SessionCluster,
} from '../analysis/writing-session-cluster';

import { createWritingSessionCluster } from '../analysis/writing-session-cluster';

import type {
  ISessionIntelligence,
  CrossSessionInsight,
} from '../protocols/session-intelligence';

import { createLogger } from '../logger/index';

const log = createLogger('session-intelligence');

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
  };
}

export class SessionIntelligenceServiceImpl implements ISessionIntelligence {
  private readonly sessions: WritingSessionTelemetry[] = [];
  private patterns: WritingSessionPattern[] = [];
  private clusters: SessionCluster[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    log.info('Session intelligence service initialized');
    this.initialized = true;
  }

  recordTelemetry(event: WritingSessionTelemetry): void {
    this.sessions.push(event);
    log.info(`Recorded telemetry: session=${event.sessionId}, events=${event.eventCount}`);
  }

  analyzeSession(telemetry: WritingSessionTelemetry): SessionInsight[] {
    const result = analyzeWritingSessionIntelligenceCore(telemetry);
    return result.insights;
  }

  minePatterns(): CrossSessionInsight[] {
    if (this.sessions.length < 2) return [];

    // Use WritingSessionCluster for cross-session clustering
    const clusterer = createWritingSessionCluster(':memory:');
    const writingSessions = this.sessions.map(buildSessionForClustering);
    this.clusters = clusterer.clusterSessions(writingSessions);
    clusterer.close();

    // Cache analysis results per session to avoid quadratic re-analysis
    const sessionResults = this.sessions.map((s) => ({
      session: s,
      result: analyzeWritingSessionIntelligenceCore(s),
    }));

    // Extract unique patterns across all sessions
    const patternSet = new Set<WritingSessionPattern>();
    for (const { result } of sessionResults) {
      for (const insight of result.insights) {
        patternSet.add(insight.pattern);
      }
    }
    this.patterns = [...patternSet];

    // Build per-session pattern index for efficient lookup
    const sessionByPattern = new Map<WritingSessionPattern, Array<{
      session: WritingSessionTelemetry;
      insights: SessionInsight[];
    }>>();
    for (const { session, result } of sessionResults) {
      for (const insight of result.insights) {
        if (!sessionByPattern.has(insight.pattern)) {
          sessionByPattern.set(insight.pattern, []);
        }
        sessionByPattern.get(insight.pattern)!.push({ session, insights: result.insights });
      }
    }

    // Convert to CrossSessionInsight[]
    const insights: CrossSessionInsight[] = [];
    for (const pattern of this.patterns) {
      const matches = sessionByPattern.get(pattern) ?? [];
      const avgConfidence =
        matches.reduce((sum, m) => {
          const match = m.insights.find((i) => i.pattern === pattern);
          return sum + (match?.confidence ?? 0);
        }, 0) / Math.max(matches.length, 1);

      const sampleInsight = matches[0]?.insights.find((i) => i.pattern === pattern);

      insights.push({
        patternType: pattern,
        description: sampleInsight?.summary ?? `Detected ${pattern} pattern across sessions`,
        affectedSessions: matches.length,
        confidence: avgConfidence,
        recommendations: sampleInsight ? [sampleInsight.suggestion] : [],
        relatedPatterns: this.patterns.filter((p) => p !== pattern),
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  getRecordedSessions(): WritingSessionTelemetry[] {
    return [...this.sessions];
  }

  getPatterns(): WritingSessionPattern[] {
    return [...this.patterns];
  }

  getClusters(): SessionCluster[] {
    return [...this.clusters];
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.sessions.length = 0;
    this.patterns = [];
    this.clusters = [];
    this.initialized = false;
    log.info('Session intelligence service shut down');
  }
}
