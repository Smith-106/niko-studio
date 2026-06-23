/**
 * Reader Simulation MCP Validation Helpers
 *
 * Persona resolution, overlay marker building, and weight adjustment
 * for Reader Simulation Engine (SME-02).
 *
 * Related: T-036, SME-02
 */

import type { ReaderPersona, PresetPersonaId } from '../PersonaDefinition';
import {
  PRESET_PERSONAS,
  getPresetPersona,
  listPresetPersonas,
} from '../PersonaDefinition';
import type { ReaderReaction, OverlayMarker } from './reader-types';
import type { FeedbackAggregate } from './reader-types';
import { customPersonaStore, MIN_WEIGHT, MAX_WEIGHT, WEIGHT_STEP } from './reader-services';

// ============================================================
// Dimension Mapping
// ============================================================

// Map dimension names to persona parameter keys
export const DIMENSION_TO_PARAM: Record<string, keyof ReaderPersona['parameters']> = {
  plotCoherence: 'plotWeight',
  characterConsistency: 'characterWeight',
  styleConsistency: 'styleWeight',
  pacingTension: 'pacingWeight',
  'Plot Coherence': 'plotWeight',
  'Character Consistency': 'characterWeight',
  'Style Consistency': 'styleWeight',
  'Pacing & Tension': 'pacingWeight',
  Plot: 'plotWeight',
  Character: 'characterWeight',
  Style: 'styleWeight',
  Pacing: 'pacingWeight',
};

// ============================================================
// Persona Resolution
// ============================================================

export function resolvePersonas(personaIds?: string[]): ReaderPersona[] {
  if (!personaIds || personaIds.length === 0) {
    // Default: use all preset personas
    return listPresetPersonas().map((id) => getPresetPersona(id));
  }

  return personaIds.map((id) => {
    // Check preset first
    if (id in PRESET_PERSONAS) {
      return getPresetPersona(id as PresetPersonaId);
    }
    // Then check custom store
    const custom = customPersonaStore.get(id);
    if (custom) {
      return custom;
    }
    throw new Error(`Persona not found: ${id}`);
  });
}

// ============================================================
// Overlay Marker Building
// ============================================================

export function buildOverlayMarkers(reactions: ReaderReaction[]): OverlayMarker[] {
  const markers: OverlayMarker[] = [];

  for (const reaction of reactions) {
    for (const highlight of reaction.highlights) {
      markers.push({
        personaId: reaction.personaId,
        personaName: reaction.personaName,
        position: highlight.position,
        reaction: highlight.reaction,
        comment: highlight.comment,
        dimension: highlight.dimension,
        text: highlight.text,
      });
    }
  }

  return markers;
}

// ============================================================
// Weight Adjustment
// ============================================================

/**
 * Adjust persona weights based on feedback aggregate.
 *
 * Logic:
 * - If accept > reject: increase weight for that dimension (+0.05)
 * - If reject > accept: decrease weight for that dimension (-0.05)
 * - If equal or modify-heavy: no change
 *
 * Weights are clamped to [0, 1].
 */
export function adjustPersonaWeights(
  persona: ReaderPersona,
  dimension: string,
  aggregate: FeedbackAggregate,
): { changed: boolean; weights: Record<string, number>; paramUpdates: Record<string, number> } {
  const paramKey = DIMENSION_TO_PARAM[dimension];
  if (!paramKey) {
    // Unknown dimension — return current weights without modification
    return {
      changed: false,
      weights: extractCurrentWeights(persona),
      paramUpdates: {},
    };
  }

  const raw = persona.parameters[paramKey];
  const currentWeight = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : 0.5;
  let newWeight = currentWeight;

  // Decision logic: accept vs reject
  if (aggregate.accept > aggregate.reject) {
    newWeight = Math.min(MAX_WEIGHT, currentWeight + WEIGHT_STEP);
  } else if (aggregate.reject > aggregate.accept) {
    newWeight = Math.max(MIN_WEIGHT, currentWeight - WEIGHT_STEP);
  }
  // If equal or modify-heavy, no change

  const changed = newWeight !== currentWeight;
  const paramUpdates: Record<string, number> = changed ? { [paramKey]: newWeight } : {};

  return {
    changed,
    weights: { ...extractCurrentWeights(persona), ...(changed ? { [paramKey]: newWeight } : {}) },
    paramUpdates,
  };
}

export function extractCurrentWeights(persona: ReaderPersona): Record<string, number> {
  return {
    plotWeight: persona.parameters.plotWeight,
    characterWeight: persona.parameters.characterWeight,
    styleWeight: persona.parameters.styleWeight,
    pacingWeight: persona.parameters.pacingWeight,
    toleranceThreshold: persona.parameters.toleranceThreshold,
  };
}
