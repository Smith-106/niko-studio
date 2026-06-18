import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRESET_PERSONAS,
  createCustomPersona,
  createGeneralReader,
  createLiteraryCritic,
  createSuspenseEnthusiast,
  getPresetPersona,
  listPresetPersonas,
} from '../../reader/PersonaDefinition.js';

describe('reader/PersonaDefinition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the three preset personas with their expected priorities', () => {
    const suspense = createSuspenseEnthusiast();
    const critic = createLiteraryCritic();
    const general = createGeneralReader();

    expect(suspense).toMatchObject({
      id: 'preset-suspense-enthusiast',
      type: 'preset',
      parameters: {
        plotWeight: 0.9,
        pacingWeight: 0.95,
      },
    });
    expect(suspense.parameters.focusAreas).toContain('cliffhanger-effectiveness');

    expect(critic).toMatchObject({
      id: 'preset-literary-critic',
      type: 'preset',
      parameters: {
        styleWeight: 0.95,
        characterWeight: 0.85,
      },
    });
    expect(critic.parameters.biases).toContain('values literary merit');

    expect(general).toMatchObject({
      id: 'preset-general-reader',
      type: 'preset',
      parameters: {
        toleranceThreshold: 0.5,
        plotWeight: 0.7,
      },
    });
    expect(general.parameters.focusAreas).toContain('readability');
  });

  it('deep merges custom overrides onto the default persona shell', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const custom = createCustomPersona({
      name: 'Romance Reader',
      parameters: {
        characterWeight: 0.9,
        focusAreas: ['chemistry'],
        biases: ['prefers happy endings'],
      },
    });

    expect(custom.id).toMatch(/^custom-1700000000000-/);
    expect(custom).toMatchObject({
      name: 'Romance Reader',
      type: 'custom',
      description: 'User-defined reader persona with custom preferences.',
      parameters: {
        plotWeight: 0.5,
        characterWeight: 0.9,
        styleWeight: 0.5,
        pacingWeight: 0.5,
        toleranceThreshold: 0.5,
        focusAreas: ['chemistry'],
        biases: ['prefers happy endings'],
      },
    });
  });

  it('exposes preset registry helpers that stay in sync with the factory map', () => {
    expect(Object.keys(PRESET_PERSONAS)).toEqual([
      'suspense-enthusiast',
      'literary-critic',
      'general-reader',
      'pacing-hawk',
      'anti-ai-flavor-critic',
      'young-adult-reader',
      'web-novel-veteran',
    ]);
    expect(listPresetPersonas()).toEqual([
      'suspense-enthusiast',
      'literary-critic',
      'general-reader',
      'pacing-hawk',
      'anti-ai-flavor-critic',
      'young-adult-reader',
      'web-novel-veteran',
    ]);
    expect(getPresetPersona('general-reader')).toMatchObject({
      id: 'preset-general-reader',
      name: 'General Reader',
    });
  });
});
