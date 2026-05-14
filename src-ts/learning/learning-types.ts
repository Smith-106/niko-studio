/**
 * Learning Module — Shared Types
 *
 * Shared interfaces, enums, and data structures for the three learning pipelines:
 * - Import Learning (CAP-001)
 * - Self-Evolving Writing (CAP-002)
 * - Reading Learning (CAP-003)
 */

// ============================================================
// Enums
// ============================================================

export enum LearningCapability {
  IMPORT = 'import',
  SELF_EVOLVING = 'self_evolving',
  READING = 'reading',
}

export enum PipelineStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ExtractionTier {
  LIGHT = 'light',
  HEAVY = 'heavy',
  BLOCKED = 'blocked',
}

export enum EntityType {
  CHARACTER = 'character',
  LOCATION = 'location',
  ORGANIZATION = 'organization',
  ITEM = 'item',
  EVENT = 'event',
  CONCEPT = 'concept',
}

export enum WorldviewCategory {
  RULE = 'rule',
  SETTING = 'setting',
  CULTURE = 'culture',
  MAGIC_SYSTEM = 'magic_system',
  TECHNOLOGY = 'technology',
  SOCIAL_STRUCTURE = 'social_structure',
}

// ============================================================
// Core Interfaces
// ============================================================

export interface ILearningPipeline {
  readonly capability: LearningCapability;
  execute(input: PipelineInput): Promise<ExtractionResult>;
  getStatus(): PipelineStatusInfo;
  enable(): void;
  disable(): void;
}

export interface PipelineInput {
  content: string;
  metadata?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface PipelineStatusInfo {
  capability: LearningCapability;
  status: PipelineStatus;
  lastRun?: string;
  itemsProcessed: number;
  enabled: boolean;
  error?: string;
}

// ============================================================
// Extraction Types
// ============================================================

export interface ExtractionResult {
  entities: EntityExtraction[];
  styleFeatures: StyleFeatureVector;
  worldviewElements: WorldviewElement[];
  insights: Insight[];
  metadata: Record<string, unknown>;
}

export interface EntityExtraction {
  name: string;
  type: EntityType;
  confidence: number;
  attributes: Record<string, unknown>;
  mentions: number;
}

export interface StyleFeatureVector {
  dimensions: Record<string, number>;
  summary: string;
  confidence: number;
}

export interface WorldviewElement {
  name: string;
  category: WorldviewCategory;
  description: string;
  evidence: string[];
  confidence: number;
}

export interface Insight {
  content: string;
  source: string;
  tags: string[];
  confidence: number;
  chapter?: string;
}

// ============================================================
// Self-Evolving Writing Types (CAP-002)
// ============================================================

export interface StyleRule {
  id: string;
  name: string;
  description: string;
  dimensions: Record<string, number>;
  evidenceCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface StyleDriftReport {
  baselineDate: string;
  currentDate: string;
  overallDrift: number;
  dimensionDrifts: Record<string, number>;
  severity: 'none' | 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface PreferenceSignal {
  userId: string;
  action: 'accept' | 'reject' | 'modify';
  dimension: string;
  value: number;
  timestamp: string;
  context?: string;
}

export interface FeedbackEvidence {
  source: string;
  action: 'accept' | 'reject' | 'modify';
  dimension: string;
  value: number;
  timestamp: string;
}

// ============================================================
// Reading Learning Types (CAP-003)
// ============================================================

export interface SpoilerGateResult {
  tier: ExtractionTier;
  allowedCategories: string[];
  reason: string;
}

export interface ReadingSession {
  bookId: string;
  currentChapter: number;
  totalChapters: number;
  lastPosition: string;
  startedAt: string;
  updatedAt: string;
}

export interface DistilledInsight {
  stage: 'capture' | 'annotate' | 'connect' | 'question' | 'synthesize' | 'distill';
  content: string;
  metadata: Record<string, unknown>;
}

export interface CrossReference {
  sourceBook: string;
  targetBook: string;
  entityType: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  confidence: number;
}

// ============================================================
// Config
// ============================================================

export interface LearningConfig {
  enabledCapabilities: LearningCapability[];
  evidenceThreshold: number;
  driftThreshold: number;
  maxConcurrentPipelines: number;
  distillationTemplate: string;
}
