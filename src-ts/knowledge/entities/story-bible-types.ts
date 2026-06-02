/**
 * Story Bible entities — extends KnowledgeEngine with structured narrative entities
 *
 * Each entity type represents a core element of a story's knowledge graph.
 * CharacterProfile, WorldRule, PlotThread, and TimelineEvent provide the
 * typed schemas that all AI-driven features (Co-Writing, Reader Simulation)
 * read from before generating output.
 */

// ============================================================
// Shared Base
// ============================================================

export interface StoryBibleEntityBase {
  id: string;
  novelId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  completenessScore: number; // 0-1 graduated score
  source: 'auto-extract' | 'manual' | 'hybrid';
  metadata: Record<string, unknown>;
}

// ============================================================
// CharacterProfile (F-001)
// ============================================================

export enum CharacterArchetype {
  PROTAGONIST = 'protagonist',
  ANTAGONIST = 'antagonist',
  SUPPORTING = 'supporting',
  MENTOR = 'mentor',
  NARRATOR = 'narrator',
  DEUTERAGONIST = 'deuteragonist',
}

export interface CharacterTrait {
  trait: string;
  intensity: number; // 0-1
  evidence: string;  // 引用原文出处
}

export interface CharacterRelationship {
  targetId: string;
  type: 'ally' | 'rival' | 'romantic' | 'family' | 'mentor-student' | 'subordinate' | 'other';
  description: string;
}

export interface CharacterProfile extends StoryBibleEntityBase {
  type: 'character';
  archetype: CharacterArchetype;
  traits: CharacterTrait[];
  motivations: string[];
  backstory: string;
  relationships: CharacterRelationship[];
  speechPatterns: string[];
  arcStage: 'introduction' | 'rising' | 'climax' | 'resolution' | 'unknown';
  povAffinity: number; // 0-1, 此角色作为 POV 角色的适合度
}

export function createCharacterProfile(overrides?: Partial<CharacterProfile>): CharacterProfile {
  return {
    id: '',
    novelId: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completenessScore: 0,
    source: 'manual',
    metadata: {},
    type: 'character',
    archetype: CharacterArchetype.SUPPORTING,
    traits: [],
    motivations: [],
    backstory: '',
    relationships: [],
    speechPatterns: [],
    arcStage: 'unknown',
    povAffinity: 0,
    ...overrides,
  };
}

// ============================================================
// WorldRule (F-001)
// ============================================================

export enum WorldRuleCategory {
  PHYSICS = 'physics',
  MAGIC = 'magic',
  SOCIAL = 'social',
  ECONOMIC = 'economic',
  POLITICAL = 'political',
  CULTURAL = 'cultural',
  TECHNOLOGY = 'technology',
}

export interface WorldRule extends StoryBibleEntityBase {
  type: 'world-rule';
  category: WorldRuleCategory;
  description: string;
  constraints: string[];
  exceptions: string[];
  impactScope: 'global' | 'regional' | 'local';
  relatedEntities: string[];
}

export function createWorldRule(overrides?: Partial<WorldRule>): WorldRule {
  return {
    id: '',
    novelId: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completenessScore: 0,
    source: 'manual',
    metadata: {},
    type: 'world-rule',
    category: WorldRuleCategory.SOCIAL,
    description: '',
    constraints: [],
    exceptions: [],
    impactScope: 'local',
    relatedEntities: [],
    ...overrides,
  };
}

// ============================================================
// PlotThread (F-001)
// ============================================================

export enum PlotThreadStatus {
  SETUP = 'setup',
  DEVELOPING = 'developing',
  CLIMAX = 'climax',
  RESOLVED = 'resolved',
  DORMANT = 'dormant',
  ABANDONED = 'abandoned',
}

export interface PlotThread extends StoryBibleEntityBase {
  type: 'plot-thread';
  status: PlotThreadStatus;
  premise: string;
  goal: string;
  stakes: string;
  involvedCharacters: string[];
  keyEvents: string[];  // TimelineEvent IDs
  foreshadowingRefs: string[];
  resolution: string | null;
}

export function createPlotThread(overrides?: Partial<PlotThread>): PlotThread {
  return {
    id: '',
    novelId: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completenessScore: 0,
    source: 'manual',
    metadata: {},
    type: 'plot-thread',
    status: PlotThreadStatus.SETUP,
    premise: '',
    goal: '',
    stakes: '',
    involvedCharacters: [],
    keyEvents: [],
    foreshadowingRefs: [],
    resolution: null,
    ...overrides,
  };
}

// ============================================================
// TimelineEvent (F-001)
// ============================================================

export enum TimelineEventType {
  INCIDENT = 'incident',
  DECISION = 'decision',
  REVELATION = 'revelation',
  CONFRONTATION = 'confrontation',
  TRANSITION = 'transition',
  MILESTONE = 'milestone',
}

export interface TimelineEvent extends StoryBibleEntityBase {
  type: 'timeline-event';
  eventType: TimelineEventType;
  timestamp: string;       // 故事内时间点
  chapterRef: string;      // 章节引用
  description: string;
  participants: string[];  // CharacterProfile IDs
  consequences: string[];
  plotThreadRefs: string[]; // PlotThread IDs
  emotionalImpact: 'low' | 'medium' | 'high' | 'critical';
}

export function createTimelineEvent(overrides?: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: '',
    novelId: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completenessScore: 0,
    source: 'manual',
    metadata: {},
    type: 'timeline-event',
    eventType: TimelineEventType.INCIDENT,
    timestamp: '',
    chapterRef: '',
    description: '',
    participants: [],
    consequences: [],
    plotThreadRefs: [],
    emotionalImpact: 'low',
    ...overrides,
  };
}

// ============================================================
// Union type + helpers
// ============================================================

export type StoryBibleEntity = CharacterProfile | WorldRule | PlotThread | TimelineEvent;

export const SB_ENTITY_TYPES = ['character', 'world-rule', 'plot-thread', 'timeline-event'] as const;
export type SbEntityType = typeof SB_ENTITY_TYPES[number];

export function getEntityType(entity: StoryBibleEntity): SbEntityType {
  return entity.type;
}