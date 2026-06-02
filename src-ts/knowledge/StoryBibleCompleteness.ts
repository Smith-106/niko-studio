/**
 * Story Bible Completeness Gate — graduated scoring for SB entity quality
 *
 * Evaluates Story Bible entity completeness with 4-level graduated scoring:
 * - critical (0.0-0.3): Cannot proceed with co-writing
 * - incomplete (0.3-0.6): Co-writing with reduced quality
 * - adequate (0.6-0.8): Co-writing with standard quality
 * - comprehensive (0.8-1.0): Co-writing with full context
 *
 * Per-entity-type scoring with field weights, protagonist 2x weighting.
 */

import type {
  CharacterProfile,
  WorldRule,
  PlotThread,
  TimelineEvent,
  StoryBibleEntity,
} from './entities/story-bible-types';
import {
  CharacterArchetype,
  WorldRuleCategory,
  PlotThreadStatus,
  TimelineEventType,
} from './entities/story-bible-types';

// ============================================================
// Completeness Level
// ============================================================

export type CompletenessLevel = 'critical' | 'incomplete' | 'adequate' | 'comprehensive';

export interface EntityScoreDetail {
  entityId: string;
  entityType: string;
  score: number;
  missingFields: string[];
  fieldScores: Record<string, number>;
}

export interface CompletenessReport {
  overallScore: number;
  level: CompletenessLevel;
  entityScores: Map<string, EntityScoreDetail>;
  missingFields: string[];
  recommendations: string[];
  timestamp: string;
}

// ============================================================
// Field Weight Definitions
// ============================================================

interface FieldWeight {
  field: string;
  weight: number;
  validator: (entity: StoryBibleEntity) => boolean;
}

// CharacterProfile: name(0.2) + archetype(0.1) + traits(0.2) + motivations(0.15)
//                  + backstory(0.15) + relationships(0.1) + speechPatterns(0.1)
const CHARACTER_WEIGHTS: FieldWeight[] = [
  {
    field: 'name',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return typeof c.name === 'string' && c.name.trim().length > 0;
    },
  },
  {
    field: 'archetype',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return Object.values(CharacterArchetype).includes(c.archetype);
    },
  },
  {
    field: 'traits',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return Array.isArray(c.traits) && c.traits.length >= 2;
    },
  },
  {
    field: 'motivations',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return Array.isArray(c.motivations) && c.motivations.length >= 1;
    },
  },
  {
    field: 'backstory',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return typeof c.backstory === 'string' && c.backstory.trim().length >= 50;
    },
  },
  {
    field: 'relationships',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return Array.isArray(c.relationships) && c.relationships.length >= 1;
    },
  },
  {
    field: 'speechPatterns',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const c = e as CharacterProfile;
      return Array.isArray(c.speechPatterns) && c.speechPatterns.length >= 1;
    },
  },
];

// WorldRule: name(0.2) + category(0.1) + description(0.3) + constraints(0.2)
//            + impactScope(0.1) + exceptions(0.1)
const WORLD_RULE_WEIGHTS: FieldWeight[] = [
  {
    field: 'name',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      return typeof w.name === 'string' && w.name.trim().length > 0;
    },
  },
  {
    field: 'category',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      return Object.values(WorldRuleCategory).includes(w.category);
    },
  },
  {
    field: 'description',
    weight: 0.3,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      return typeof w.description === 'string' && w.description.trim().length >= 30;
    },
  },
  {
    field: 'constraints',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      return Array.isArray(w.constraints) && w.constraints.length >= 1;
    },
  },
  {
    field: 'impactScope',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      return ['global', 'regional', 'local'].includes(w.impactScope);
    },
  },
  {
    field: 'exceptions',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const w = e as WorldRule;
      // exceptions can be empty, but must be an array
      return Array.isArray(w.exceptions);
    },
  },
];

// PlotThread: name(0.15) + premise(0.2) + goal(0.2) + stakes(0.15)
//             + involvedCharacters(0.15) + status(0.15)
const PLOT_THREAD_WEIGHTS: FieldWeight[] = [
  {
    field: 'name',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return typeof p.name === 'string' && p.name.trim().length > 0;
    },
  },
  {
    field: 'premise',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return typeof p.premise === 'string' && p.premise.trim().length >= 20;
    },
  },
  {
    field: 'goal',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return typeof p.goal === 'string' && p.goal.trim().length >= 10;
    },
  },
  {
    field: 'stakes',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return typeof p.stakes === 'string' && p.stakes.trim().length >= 10;
    },
  },
  {
    field: 'involvedCharacters',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return Array.isArray(p.involvedCharacters) && p.involvedCharacters.length >= 1;
    },
  },
  {
    field: 'status',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const p = e as PlotThread;
      return Object.values(PlotThreadStatus).includes(p.status);
    },
  },
];

// TimelineEvent: name(0.1) + description(0.2) + timestamp(0.15) + chapterRef(0.15)
//                + participants(0.15) + eventType(0.1) + emotionalImpact(0.15)
const TIMELINE_EVENT_WEIGHTS: FieldWeight[] = [
  {
    field: 'name',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return typeof t.name === 'string' && t.name.trim().length > 0;
    },
  },
  {
    field: 'description',
    weight: 0.2,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return typeof t.description === 'string' && t.description.trim().length >= 20;
    },
  },
  {
    field: 'timestamp',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return typeof t.timestamp === 'string' && t.timestamp.trim().length > 0;
    },
  },
  {
    field: 'chapterRef',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return typeof t.chapterRef === 'string' && t.chapterRef.trim().length > 0;
    },
  },
  {
    field: 'participants',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return Array.isArray(t.participants) && t.participants.length >= 1;
    },
  },
  {
    field: 'eventType',
    weight: 0.1,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return Object.values(TimelineEventType).includes(t.eventType);
    },
  },
  {
    field: 'emotionalImpact',
    weight: 0.15,
    validator: (e: StoryBibleEntity) => {
      const t = e as TimelineEvent;
      return ['low', 'medium', 'high', 'critical'].includes(t.emotionalImpact);
    },
  },
];

// ============================================================
// StoryBibleCompleteness Class
// ============================================================

export class StoryBibleCompleteness {
  private readonly entityWeights: Map<string, FieldWeight[]>;

  constructor() {
    this.entityWeights = new Map([
      ['character', CHARACTER_WEIGHTS],
      ['world-rule', WORLD_RULE_WEIGHTS],
      ['plot-thread', PLOT_THREAD_WEIGHTS],
      ['timeline-event', TIMELINE_EVENT_WEIGHTS],
    ]);
  }

  /**
   * Calculate completeness score for a single entity
   */
  scoreEntity(entity: StoryBibleEntity): EntityScoreDetail {
    const entityType = entity.type;
    const weights = this.entityWeights.get(entityType);

    if (!weights) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const fieldScores: Record<string, number> = {};
    const missingFields: string[] = [];
    let totalScore = 0;

    for (const { field, weight, validator } of weights) {
      const isValid = validator(entity);
      const fieldScore = isValid ? weight : 0;
      fieldScores[field] = fieldScore;
      totalScore += fieldScore;

      if (!isValid) {
        missingFields.push(field);
      }
    }

    return {
      entityId: entity.id,
      entityType,
      score: totalScore,
      missingFields,
      fieldScores,
    };
  }

  /**
   * Calculate overall Story Bible completeness
   * Protagonist characters are weighted 2x
   */
  calculateOverallScore(entities: StoryBibleEntity[]): CompletenessReport {
    const entityScores = new Map<string, EntityScoreDetail>();
    const allMissingFields: string[] = [];
    const recommendations: string[] = [];

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const entity of entities) {
      const detail = this.scoreEntity(entity);
      entityScores.set(entity.id, detail);
      allMissingFields.push(...detail.missingFields.map(f => `${entity.type}:${entity.id}:${f}`));

      // Protagonist characters get 2x weight
      const weight = this.getEntityWeight(entity);
      totalWeightedScore += detail.score * weight;
      totalWeight += weight;
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const level = this.scoreToLevel(overallScore);

    // Generate recommendations
    this.generateRecommendations(entityScores, recommendations);

    return {
      overallScore,
      level,
      entityScores,
      missingFields: allMissingFields,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get weight multiplier for an entity
   * Protagonist characters = 2x, others = 1x
   */
  private getEntityWeight(entity: StoryBibleEntity): number {
    if (entity.type === 'character') {
      const char = entity as CharacterProfile;
      return char.archetype === CharacterArchetype.PROTAGONIST ? 2 : 1;
    }
    return 1;
  }

  /**
   * Convert numeric score to completeness level
   */
  private scoreToLevel(score: number): CompletenessLevel {
    if (score < 0.3) return 'critical';
    if (score < 0.6) return 'incomplete';
    if (score < 0.8) return 'adequate';
    return 'comprehensive';
  }

  /**
   * Generate actionable recommendations based on missing fields
   */
  private generateRecommendations(
    entityScores: Map<string, EntityScoreDetail>,
    recommendations: string[],
  ): void {
    const criticalEntities: string[] = [];
    const incompleteEntities: string[] = [];

    for (const [id, detail] of entityScores) {
      if (detail.score < 0.3) {
        criticalEntities.push(`${detail.entityType}:${id}`);
      } else if (detail.score < 0.6) {
        incompleteEntities.push(`${detail.entityType}:${id}`);
      }
    }

    if (criticalEntities.length > 0) {
      recommendations.push(
        `CRITICAL: ${criticalEntities.length} entities have critical completeness issues: ${criticalEntities.slice(0, 3).join(', ')}${criticalEntities.length > 3 ? '...' : ''}. Address these before co-writing.`,
      );
    }

    if (incompleteEntities.length > 0) {
      recommendations.push(
        `INCOMPLETE: ${incompleteEntities.length} entities need improvement for optimal co-writing quality.`,
      );
    }

    // Field-specific recommendations
    const fieldCounts = new Map<string, number>();
    for (const detail of entityScores.values()) {
      for (const field of detail.missingFields) {
        const key = `${detail.entityType}:${field}`;
        fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1);
      }
    }

    // Top 3 most commonly missing fields
    const topMissing = [...fieldCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [field, count] of topMissing) {
      recommendations.push(`Consider adding ${field} (${count} entities missing this field)`);
    }
  }

  /**
   * Quick check if Story Bible is ready for co-writing
   */
  isReadyForCowriting(report: CompletenessReport): boolean {
    return report.level !== 'critical';
  }

  /**
   * Get quality multiplier based on completeness level
   * Used to adjust co-writing output quality expectations
   */
  getQualityMultiplier(level: CompletenessLevel): number {
    switch (level) {
      case 'critical':
        return 0.3;
      case 'incomplete':
        return 0.6;
      case 'adequate':
        return 0.85;
      case 'comprehensive':
        return 1.0;
    }
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createStoryBibleCompleteness(): StoryBibleCompleteness {
  return new StoryBibleCompleteness();
}
