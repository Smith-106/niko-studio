/**
 * Reader Persona Definition — configurable reader simulation profiles
 *
 * Reader personas represent different reader types with distinct preferences,
 * tolerances, and focus areas. Used by Reader Simulation Engine (SME-02)
 * to generate persona-specific feedback on narrative content.
 */

// ============================================================
// Reader Persona Interface
// ============================================================

export interface ReaderPersona {
  id: string;
  name: string;
  type: 'preset' | 'custom';
  description: string;
  parameters: {
    plotWeight: number;        // 0-1, how much this reader cares about plot coherence
    characterWeight: number;   // 0-1, importance of character development
    styleWeight: number;       // 0-1, sensitivity to prose quality
    pacingWeight: number;      // 0-1, attention to pacing/tension
    toleranceThreshold: number; // 0-1, below this = flags issue
    focusAreas: string[];       // specific aspects this reader pays attention to
    biases: string[];           // known biases (e.g., "prefers fast pacing")
    // Extended fields (optional, for Anti-AI Flavor 2.0)
    ageGroup?: string;          // e.g., "young-adult", "adult", "mature"
    culturalBackground?: string; // e.g., "chinese-webnovel", "western-literary"
    readingPreference?: string;  // e.g., "fast-paced", "immersive", "analytical"
    genrePreference?: string;      // e.g., "suspense", "romance", "webnovel"
    aiFlavorSensitivity?: number; // 0-1, sensitivity to AI-generated prose flavor
  };
}

// ============================================================
// Preset Personas (SME-02)
// ============================================================

/**
 * Suspense Enthusiast
 * - Values: pacing, tension, cliffhangers
 * - Low tolerance for slow sections
 * - Prefers plot twists
 */
export function createSuspenseEnthusiast(): ReaderPersona {
  return {
    id: 'preset-suspense-enthusiast',
    name: 'Suspense Enthusiast',
    type: 'preset',
    description: 'Thrives on tension and unpredictability. Quickly loses interest in slow-paced sections. Values plot twists and cliffhangers above all.',
    parameters: {
      plotWeight: 0.9,           // Very high — plot coherence is critical
      characterWeight: 0.5,      // Moderate — characters serve the plot
      styleWeight: 0.4,          // Lower — style secondary to tension
      pacingWeight: 0.95,        // Very high — pacing is paramount
      toleranceThreshold: 0.3,   // Low — quick to flag slow sections
      focusAreas: [
        'pacing-rhythm',
        'tension-building',
        'cliffhanger-effectiveness',
        'plot-twist-setup',
        'foreshadowing-payoff',
        'suspense-maintenance',
      ],
      biases: [
        'prefers fast pacing',
        'low patience for exposition',
        'values unpredictability',
        'enjoys cliffhangers',
      ],
    },
  };
}

/**
 * Literary Critic
 * - Values: prose quality, symbolism, thematic depth
 * - High standards for character development
 * - Sensitive to clichés
 */
export function createLiteraryCritic(): ReaderPersona {
  return {
    id: 'preset-literary-critic',
    name: 'Literary Critic',
    type: 'preset',
    description: 'Analytical reader with high standards for prose quality and thematic depth. Sensitive to clichés and values nuanced character development.',
    parameters: {
      plotWeight: 0.6,           // Moderate — plot serves themes
      characterWeight: 0.85,     // High — character depth is essential
      styleWeight: 0.95,         // Very high — prose quality paramount
      pacingWeight: 0.5,         // Moderate — pacing serves narrative arc
      toleranceThreshold: 0.7,   // High — expects quality, flags issues readily
      focusAreas: [
        'prose-quality',
        'symbolism-depth',
        'thematic-coherence',
        'character-complexity',
        'narrative-voice',
        'literary-devices',
        'cliché-detection',
        'subtext-interpretation',
      ],
      biases: [
        'high standards for prose',
        'values literary merit',
        'sensitive to clichés',
        'appreciates thematic depth',
        'prefers complex characters',
      ],
    },
  };
}

/**
 * General Reader
 * - Balanced preferences
 * - Values engagement and readability
 * - Moderate standards across dimensions
 */
export function createGeneralReader(): ReaderPersona {
  return {
    id: 'preset-general-reader',
    name: 'General Reader',
    type: 'preset',
    description: 'Balanced reader seeking engaging, accessible stories. Values readability and emotional connection. Moderate standards across all dimensions.',
    parameters: {
      plotWeight: 0.7,           // Moderate-high — plot important but not dominant
      characterWeight: 0.7,      // Moderate-high — character connection matters
      styleWeight: 0.5,          // Moderate — style should serve story
      pacingWeight: 0.6,         // Moderate — pacing should feel natural
      toleranceThreshold: 0.5,   // Moderate — balanced tolerance
      focusAreas: [
        'engagement',
        'readability',
        'emotional-connection',
        'story-flow',
        'character-relatability',
        'satisfying-resolution',
      ],
      biases: [
        'values accessibility',
        'prefers engaging narratives',
        'moderate standards',
        'seeks emotional connection',
      ],
    },
  };
}

/**
 * Pacing Hawk
 * - Values: ultra-fast pacing, hook density, zero tolerance for drag
 * - Genre: webnovel / serial fiction
 * - Low tolerance for slow sections, high AI flavor sensitivity
 */
export function createPacingHawk(): ReaderPersona {
  return {
    id: 'preset-pacing-hawk',
    name: 'Pacing Hawk',
    type: 'preset',
    description: 'Ruthless pace-driven reader with zero tolerance for slow sections. Demands constant hooks, tight cliffhangers, and immediate payoff. Common in webnovel binge readers.',
    parameters: {
      plotWeight: 0.85,
      characterWeight: 0.4,
      styleWeight: 0.3,
      pacingWeight: 1.0,
      toleranceThreshold: 0.2,
      focusAreas: [
        'hook-density',
        'chapter-ending-cliffhanger',
        'pacing-rhythm',
        'drag-detection',
        'scene-efficiency',
        'tension-escalation',
      ],
      biases: [
        'zero tolerance for slow pacing',
        'demands immediate engagement',
        'values hook over depth',
        'binge-reading mindset',
      ],
      ageGroup: 'young-adult',
      culturalBackground: 'chinese-webnovel',
      readingPreference: 'fast-paced',
      genrePreference: 'webnovel',
      aiFlavorSensitivity: 0.6,
    },
  };
}

/**
 * Anti-AI Flavor Critic
 * - Values: human-like prose, originality, natural dialogue
 * - High sensitivity to AI-generated patterns
 * - Prefers organic, imperfect, authentic writing
 */
export function createAntiAIFlavorCritic(): ReaderPersona {
  return {
    id: 'preset-anti-ai-flavor-critic',
    name: 'Anti-AI Flavor Critic',
    type: 'preset',
    description: 'Hyper-sensitive to AI-generated prose patterns. Values human imperfection, organic dialogue, and original voice. Flags repetitive structures, generic descriptions, and formulaic transitions.',
    parameters: {
      plotWeight: 0.5,
      characterWeight: 0.7,
      styleWeight: 0.95,
      pacingWeight: 0.4,
      toleranceThreshold: 0.75,
      focusAreas: [
        'ai-flavor-detection',
        'prose-authenticity',
        'dialogue-naturalness',
        'originality-score',
        'repetitive-structure',
        'generic-description',
        'formulaic-transition',
      ],
      biases: [
        'extremely sensitive to AI patterns',
        'values human imperfection',
        'prefers organic over polished',
        'flags repetitive phrasing',
      ],
      ageGroup: 'adult',
      culturalBackground: 'western-literary',
      readingPreference: 'analytical',
      genrePreference: 'literary-fiction',
      aiFlavorSensitivity: 0.95,
    },
  };
}

/**
 * Young Adult Reader
 * - Values: character growth, emotional resonance, accessibility
 * - Prefers relatable protagonists and clear emotional arcs
 * - Moderate tolerance, seeks connection over complexity
 */
export function createYoungAdultReader(): ReaderPersona {
  return {
    id: 'preset-young-adult-reader',
    name: 'Young Adult Reader',
    type: 'preset',
    description: 'Seeks emotional connection and character growth. Values relatable protagonists, accessible prose, and satisfying emotional arcs. Moderate standards with preference for clarity over complexity.',
    parameters: {
      plotWeight: 0.6,
      characterWeight: 0.85,
      styleWeight: 0.5,
      pacingWeight: 0.65,
      toleranceThreshold: 0.45,
      focusAreas: [
        'character-growth',
        'emotional-resonance',
        'relatability',
        'coming-of-age-elements',
        'friendship-dynamics',
        'identity-themes',
        'accessible-prose',
      ],
      biases: [
        'values emotional connection',
        'prefers relatable characters',
        'seeks growth arcs',
        'moderate complexity tolerance',
      ],
      ageGroup: 'young-adult',
      culturalBackground: 'western-contemporary',
      readingPreference: 'immersive',
      genrePreference: 'young-adult',
      aiFlavorSensitivity: 0.5,
    },
  };
}

/**
 * Web Novel Veteran
 * - Values: update rhythm,爽点 (satisfaction moments), trope mastery
 * - High tolerance for formula if executed well
 * - Sensitive to pacing within chapter structure
 */
export function createWebNovelVeteran(): ReaderPersona {
  return {
    id: 'preset-web-novel-veteran',
    name: 'Web Novel Veteran',
    type: 'preset',
    description: 'Experienced webnovel reader with deep genre knowledge. Values satisfying plot beats (爽点), trope execution, and chapter-level pacing. High tolerance for formula when well-executed.',
    parameters: {
      plotWeight: 0.8,
      characterWeight: 0.55,
      styleWeight: 0.35,
      pacingWeight: 0.9,
      toleranceThreshold: 0.35,
      focusAreas: [
        '爽点-density',
        'trope-execution',
        'chapter-structure',
        'update-rhythm-simulation',
        'power-progression',
        'face-slapping-timing',
        'cliffhanger-quality',
      ],
      biases: [
        'values satisfying plot beats',
        'appreciates trope mastery',
        'high formula tolerance',
        'chapter-level pacing focus',
      ],
      ageGroup: 'adult',
      culturalBackground: 'chinese-webnovel',
      readingPreference: 'fast-paced',
      genrePreference: 'webnovel',
      aiFlavorSensitivity: 0.7,
    },
  };
}

// ============================================================
// Legacy Presets (kept for backward compatibility)
// ============================================================

/**
 * Create custom reader persona with user-defined parameters
 *
 * @param overrides - Partial persona configuration
 * @returns Complete ReaderPersona with custom settings
 *
 * @example
 * ```ts
 * const romanceReader = createCustomPersona({
 *   name: 'Romance Reader',
 *   description: 'Focuses on romantic tension and character chemistry',
 *   parameters: {
 *     plotWeight: 0.5,
 *     characterWeight: 0.9,
 *     styleWeight: 0.6,
 *     pacingWeight: 0.7,
 *     toleranceThreshold: 0.4,
 *     focusAreas: ['romantic-tension', 'character-chemistry', 'emotional-payoff'],
 *     biases: ['values romantic development', 'prefers happy endings'],
 *   },
 * });
 * ```
 */
export function createCustomPersona(overrides: Partial<ReaderPersona>): ReaderPersona {
  const defaults: ReaderPersona = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Custom Reader',
    type: 'custom',
    description: 'User-defined reader persona with custom preferences.',
    parameters: {
      plotWeight: 0.5,
      characterWeight: 0.5,
      styleWeight: 0.5,
      pacingWeight: 0.5,
      toleranceThreshold: 0.5,
      focusAreas: [],
      biases: [],
    },
  };

  // Deep merge with overrides
  return {
    ...defaults,
    ...overrides,
    parameters: {
      ...defaults.parameters,
      ...overrides.parameters,
    },
  };
}

// ============================================================
// Preset Registry
// ============================================================

export const PRESET_PERSONAS = {
  'suspense-enthusiast': createSuspenseEnthusiast,
  'literary-critic': createLiteraryCritic,
  'general-reader': createGeneralReader,
  'pacing-hawk': createPacingHawk,
  'anti-ai-flavor-critic': createAntiAIFlavorCritic,
  'young-adult-reader': createYoungAdultReader,
  'web-novel-veteran': createWebNovelVeteran,
} as const;

export type PresetPersonaId = keyof typeof PRESET_PERSONAS;

export function getPresetPersona(id: PresetPersonaId): ReaderPersona {
  return PRESET_PERSONAS[id]();
}

export function listPresetPersonas(): PresetPersonaId[] {
  return Object.keys(PRESET_PERSONAS) as PresetPersonaId[];
}
