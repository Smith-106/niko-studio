/**
 * Reader Simulation MCP Types
 *
 * Request/response types and interfaces for Reader Simulation Engine (SME-02).
 *
 * Related: T-036, SME-02
 */

import type { DualEngineResult, ReaderReaction } from '../DualEngine';
import type { ConsensusReport, ConsensusComparisonItem } from '../ConsensusEngine';

// ============================================================
// Request Types
// ============================================================

export interface AnalyzeRequest {
  novelId: string;
  personaIds?: string[]; // defaults to all presets
  text?: string; // optional override for testing / future callers
}

export interface CreatePersonaRequest {
  name: string;
  parameters: Record<string, any>;
}

export interface DeAIRequest {
  novelId: string;
  text?: string;
  mode?: 'de-ai' | 'style-shift';
  targetStyle?: string;
}

export interface DeAIResponse {
  novelId: string;
  originalText: string;
  revisedText: string;
  aiFlavorScore: number;
  improvements?: {
    delta: Record<string, number>;
    improvedDimensions: string[];
    regressedDimensions: string[];
    unchangedDimensions: string[];
  };
  suggestions: string[];
  mode: string;
}

// --- Feedback Types ---

export type FeedbackAction = 'helpful' | 'not_helpful' | 'ignore';

export interface FeedbackRequest {
  novelId: string;
  personaId: string;
  feedbackId: string;
  action: FeedbackAction;
  dimension?: string;
}

export interface FeedbackAggregate {
  /** 该 persona 在该 dimension 上的接受计数 */
  accept: number;
  /** 该 persona 在该 dimension 上的拒绝计数 */
  reject: number;
  /** 该 persona 在该 dimension 上的修改计数 */
  modify: number;
  /** 最近一次更新时间 */
  lastUpdated: string;
}

export interface FeedbackResponse {
  novelId: string;
  personaId: string;
  feedbackId: string;
  action: FeedbackAction;
  dimension?: string;
  updatedWeights?: Record<string, number>;
  weightsChanged: boolean;
}

// --- A/B Compare Types ---

export interface CompareVersionInput {
  text: string;
  label?: string;
}

export interface CompareRequest {
  novelId: string;
  versionA: CompareVersionInput;
  versionB: CompareVersionInput;
  personaIds?: string[];
}

export interface CompareResult {
  novelId: string;
  versionAConsensus: ConsensusReport;
  versionBConsensus: ConsensusReport;
  comparison: ConsensusComparisonItem[];
  overallWinner: 'A' | 'B' | 'tie';
  versionALabel?: string;
  versionBLabel?: string;
}

// ============================================================
// Response Types
// ============================================================

export interface OverlayMarker {
  personaId: string;
  personaName: string;
  position: { chapter: string; paragraph: number };
  reaction: 'positive' | 'negative' | 'neutral';
  comment: string;
  dimension: string;
  text: string;
}

// Re-export engine types needed by consumers
export type { DualEngineResult, ReaderReaction, ConsensusReport, ConsensusComparisonItem };
