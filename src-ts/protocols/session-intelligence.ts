/**
 * Session Intelligence Protocol
 *
 * Defines the contract for the writing session intelligence service.
 * Collects UI writing behavior telemetry, performs cross-session
 * pattern mining, and produces actionable insights.
 */

import type {
  WritingSessionTelemetry,
  SessionInsight,
  WritingSessionPattern,
} from '../analysis/writing-session-intelligence-core';

import type {
  SessionCluster,
} from '../analysis/writing-session-cluster';

// ============================================================
// Protocol interfaces
// ============================================================

/**
 * Aggregated insight produced from cross-session pattern mining.
 */
export interface CrossSessionInsight {
  patternType: string;
  description: string;
  affectedSessions: number;
  confidence: number;
  recommendations: string[];
  relatedPatterns: string[];
}

/**
 * ISessionIntelligence — Protocol for the session intelligence service.
 *
 * Collects writing behavior telemetry from the UI, performs single-session
 * analysis and cross-session pattern mining, and produces actionable insights.
 */
export interface ISessionIntelligence {
  /**
   * Initialize the service.
   */
  initialize(): Promise<void>;

  /**
   * Record a telemetry event from the UI writing surface.
   */
  recordTelemetry(event: WritingSessionTelemetry): void;

  /**
   * Analyze a single writing session's telemetry data.
   */
  analyzeSession(telemetry: WritingSessionTelemetry): SessionInsight[];

  /**
   * Mine patterns across multiple recorded sessions.
   * Returns cross-session insights and detected patterns.
   */
  minePatterns(): CrossSessionInsight[];

  /**
   * Get all recorded session telemetry.
   */
  getRecordedSessions(): WritingSessionTelemetry[];

  /**
   * Get detected cross-session patterns.
   */
  getPatterns(): WritingSessionPattern[];

  /**
   * Get session clusters.
   */
  getClusters(): SessionCluster[];

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the service.
   */
  shutdown(): Promise<void>;
}
