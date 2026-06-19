import { describe, expect, it } from 'vitest';
import {
  createAntiAIFlavorCritic,
  createCustomPersona,
  createGeneralReader,
  createLiteraryCritic,
  createPacingHawk,
  createSuspenseEnthusiast,
  createWebNovelVeteran,
  createYoungAdultReader,
  getPresetPersona,
  listPresetPersonas,
  PRESET_PERSONAS,
  type PresetPersonaId,
  type ReaderPersona,
} from './PersonaDefinition';

describe('PersonaDefinition', () => {
  describe('preset personas', () => {
    it('has at least 7 presets registered', () => {
      const ids = listPresetPersonas();
      expect(ids.length).toBeGreaterThanOrEqual(7);
    });

    it('includes all expected preset IDs', () => {
      const ids = listPresetPersonas();
      expect(ids).toContain('suspense-enthusiast');
      expect(ids).toContain('literary-critic');
      expect(ids).toContain('general-reader');
      expect(ids).toContain('pacing-hawk');
      expect(ids).toContain('anti-ai-flavor-critic');
      expect(ids).toContain('young-adult-reader');
      expect(ids).toContain('web-novel-veteran');
    });

    it('suspense-enthusiast has high plot and pacing weights', () => {
      const p = createSuspenseEnthusiast();
      expect(p.parameters.plotWeight).toBeGreaterThanOrEqual(0.8);
      expect(p.parameters.pacingWeight).toBeGreaterThanOrEqual(0.9);
      expect(p.type).toBe('preset');
    });

    it('literary-critic has high style and character weights', () => {
      const p = createLiteraryCritic();
      expect(p.parameters.styleWeight).toBeGreaterThanOrEqual(0.8);
      expect(p.parameters.characterWeight).toBeGreaterThanOrEqual(0.8);
      expect(p.type).toBe('preset');
    });

    it('general-reader has balanced weights', () => {
      const p = createGeneralReader();
      expect(p.parameters.plotWeight).toBeGreaterThanOrEqual(0.5);
      expect(p.parameters.characterWeight).toBeGreaterThanOrEqual(0.5);
      expect(p.parameters.styleWeight).toBeGreaterThanOrEqual(0.4);
      expect(p.parameters.pacingWeight).toBeGreaterThanOrEqual(0.5);
      expect(p.type).toBe('preset');
    });

    it('pacing-hawk has extreme pacing weight and low tolerance', () => {
      const p = createPacingHawk();
      expect(p.parameters.pacingWeight).toBe(1.0);
      expect(p.parameters.toleranceThreshold).toBeLessThanOrEqual(0.25);
      expect(p.parameters.ageGroup).toBe('young-adult');
      expect(p.parameters.culturalBackground).toBe('chinese-webnovel');
      expect(p.parameters.readingPreference).toBe('fast-paced');
      expect(p.parameters.genrePreference).toBe('webnovel');
      expect(p.parameters.aiFlavorSensitivity).toBe(0.6);
      expect(p.type).toBe('preset');
    });

    it('anti-ai-flavor-critic has high style weight and max AI sensitivity', () => {
      const p = createAntiAIFlavorCritic();
      expect(p.parameters.styleWeight).toBeGreaterThanOrEqual(0.9);
      expect(p.parameters.aiFlavorSensitivity).toBe(0.95);
      expect(p.parameters.ageGroup).toBe('adult');
      expect(p.parameters.culturalBackground).toBe('western-literary');
      expect(p.parameters.readingPreference).toBe('analytical');
      expect(p.parameters.genrePreference).toBe('literary-fiction');
      expect(p.type).toBe('preset');
    });

    it('young-adult-reader focuses on character growth and emotional resonance', () => {
      const p = createYoungAdultReader();
      expect(p.parameters.characterWeight).toBeGreaterThanOrEqual(0.8);
      expect(p.parameters.ageGroup).toBe('young-adult');
      expect(p.parameters.culturalBackground).toBe('western-contemporary');
      expect(p.parameters.readingPreference).toBe('immersive');
      expect(p.parameters.genrePreference).toBe('young-adult');
      expect(p.parameters.aiFlavorSensitivity).toBe(0.5);
      expect(p.type).toBe('preset');
    });

    it('web-novel-veteran has high plot and pacing with webnovel cultural background', () => {
      const p = createWebNovelVeteran();
      expect(p.parameters.plotWeight).toBeGreaterThanOrEqual(0.75);
      expect(p.parameters.pacingWeight).toBeGreaterThanOrEqual(0.85);
      expect(p.parameters.ageGroup).toBe('adult');
      expect(p.parameters.culturalBackground).toBe('chinese-webnovel');
      expect(p.parameters.readingPreference).toBe('fast-paced');
      expect(p.parameters.genrePreference).toBe('webnovel');
      expect(p.parameters.aiFlavorSensitivity).toBe(0.7);
      expect(p.type).toBe('preset');
    });

    it('getPresetPersona returns valid persona for each ID', () => {
      const ids = listPresetPersonas();
      for (const id of ids) {
        const p = getPresetPersona(id as PresetPersonaId);
        expect(p.id).toContain(id);
        expect(p.name).toBeTruthy();
        expect(p.parameters.plotWeight).toBeGreaterThanOrEqual(0);
        expect(p.parameters.plotWeight).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('custom persona factory', () => {
    it('creates custom persona with defaults', () => {
      const p = createCustomPersona({ name: 'Test Reader' });
      expect(p.name).toBe('Test Reader');
      expect(p.type).toBe('custom');
      expect(p.parameters.plotWeight).toBe(0.5);
      expect(p.parameters.focusAreas).toEqual([]);
      expect(p.parameters.biases).toEqual([]);
    });

    it('merges overrides correctly', () => {
      const p = createCustomPersona({
        name: 'Custom Critic',
        parameters: {
          plotWeight: 0.8,
          characterWeight: 0.5,
          styleWeight: 0.9,
          pacingWeight: 0.5,
          focusAreas: ['originality', 'pacing'],
          biases: ['prefers complex plots'],
          toleranceThreshold: 0.5,
          aiFlavorSensitivity: 0.85,
          ageGroup: 'adult',
          genrePreference: 'suspense',
        },
      });
      expect(p.parameters.plotWeight).toBe(0.8);
      expect(p.parameters.styleWeight).toBe(0.9);
      expect(p.parameters.focusAreas).toEqual(['originality', 'pacing']);
      expect(p.parameters.biases).toEqual(['prefers complex plots']);
      expect(p.parameters.aiFlavorSensitivity).toBe(0.85);
      expect(p.parameters.ageGroup).toBe('adult');
      expect(p.parameters.genrePreference).toBe('suspense');
    });

    it('generates unique IDs for custom personas', () => {
      const p1 = createCustomPersona({ name: 'A' });
      const p2 = createCustomPersona({ name: 'B' });
      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('PRESET_PERSONAS registry', () => {
    it('is a frozen const object with factory functions', () => {
      expect(typeof PRESET_PERSONAS['suspense-enthusiast']).toBe('function');
      expect(typeof PRESET_PERSONAS['pacing-hawk']).toBe('function');
      expect(typeof PRESET_PERSONAS['anti-ai-flavor-critic']).toBe('function');
      expect(typeof PRESET_PERSONAS['young-adult-reader']).toBe('function');
      expect(typeof PRESET_PERSONAS['web-novel-veteran']).toBe('function');
    });
  });
});
