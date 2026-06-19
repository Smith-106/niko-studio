import { describe, expect, it, vi } from 'vitest';

import {
  OutputAggregator,
  createOutputAggregator,
} from '../../cowriting/OutputAggregator.js';
import type { ModelConfig } from '../../cowriting/ModelRouter.js';

const modelConfig: ModelConfig = {
  id: 'test-model',
  name: 'Test Model',
  provider: 'openai',
  maxTokens: 32_000,
  supportsStreaming: true,
};

describe('cowriting/OutputAggregator', () => {
  it('strips prompt artifacts and numbered prefixes for auto mode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00.000Z'));

    const aggregator = createOutputAggregator();
    const result = aggregator.aggregate(
      [
        '## Story Bible',
        '',
        '',
        '1. The gate groaned open in the rain.',
        '2. Maybe the warning still mattered.',
      ].join('\n'),
      'auto',
      modelConfig,
    );

    expect(result).toEqual({
      mode: 'auto',
      text: 'The gate groaned open in the rain.\nMaybe the warning still mattered.',
      metadata: {
        model: 'test-model',
        generatedAt: '2026-06-04T12:00:00.000Z',
        tokenCount: result.metadata.tokenCount,
        confidence: result.metadata.confidence,
      },
    });
    expect(result.metadata.tokenCount).toBeGreaterThan(0);
    expect(result.metadata.confidence).toBeLessThan(0.8);

    vi.useRealTimers();
  });

  it('parses guided options, including 0-1 decimal scores, and pads missing options', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        'Option 1:',
        'She stepped through first, refusing to let the silence own her.',
        'Coherence: 0.85',
        'Creativity: 90/100',
        'Style Match: 0.75',
        'Rationale: Tight continuation with controlled risk.',
        '',
        'Option 2:',
        'He chose retreat, counting each heartbeat as the corridor dimmed.',
        'Coherence: 50',
        'Creativity: 40',
        'Style Match: 60',
      ].join('\n'),
      'guided',
      modelConfig,
    );

    expect(result.mode).toBe('guided');
    expect(result.options).toHaveLength(3);
    expect(result.options?.[0]).toEqual({
      text: 'She stepped through first, refusing to let the silence own her.',
      scores: {
        coherence: 85,
        creativity: 90,
        styleMatch: 75,
      },
      overallScore: 83,
      index: 0,
    });
    expect(result.options?.[1]).toMatchObject({
      text: 'He chose retreat, counting each heartbeat as the corridor dimmed.',
      overallScore: 50,
      index: 1,
    });
    expect(result.options?.[2]).toEqual({
      text: '',
      scores: {
        coherence: 0,
        creativity: 0,
        styleMatch: 0,
      },
      overallScore: 0,
      index: 2,
    });
    expect(result.text).toBe('She stepped through first, refusing to let the silence own her.');
  });

  it('adds compliance notes for directed mode adaptations and strips adaptation prose from body text', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        'Adaptation: the instruction was adjusted to preserve continuity.',
        'The witness stays silent, but the accusation still lands.',
      ].join('\n'),
      'directed',
      modelConfig,
    );

    expect(result.mode).toBe('directed');
    expect(result.text).toBe(
      'The witness stays silent, but the accusation still lands.\n\n[Instruction adapted to maintain quality constraints]',
    );
  });

  it('falls back unknown modes to auto formatting', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate('1. A clean fallback line.', 'mystery', modelConfig);

    expect(result.mode).toBe('auto');
    expect(result.text).toBe('A clean fallback line.');
  });

  it('skips repeated artifact lines before preserving the first real content line', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        '## Instructions',
        'Would you like me to keep going?',
        'The corridor answered with a colder silence.',
      ].join('\n'),
      'auto',
      modelConfig,
    );

    expect(result.text).toBe('The corridor answered with a colder silence.');
  });

  it('falls back to a single guided option with mid-range default scores when no option markers exist', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      'A lone continuation without explicit option markers or score annotations.',
      'guided',
      modelConfig,
    );

    expect(result.options).toEqual([
      {
        text: 'A lone continuation without explicit option markers or score annotations.',
        scores: {
          coherence: 50,
          creativity: 50,
          styleMatch: 50,
        },
        overallScore: 50,
        index: 0,
      },
      {
        text: '',
        scores: {
          coherence: 0,
          creativity: 0,
          styleMatch: 0,
        },
        overallScore: 0,
        index: 1,
      },
      {
        text: '',
        scores: {
          coherence: 0,
          creativity: 0,
          styleMatch: 0,
        },
        overallScore: 0,
        index: 2,
      },
    ]);
  });

  it('parses numbered guided options and strips standalone score-only lines', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        '1. The lantern trembled, but she did not.',
        '85/100',
        '2. He waited for the stairwell to betray a sound.',
        '3. Rain kept drilling the railing with patient insistence.',
      ].join('\n'),
      'guided',
      modelConfig,
    );

    expect(result.options?.map((option) => option.text)).toEqual([
      'The lantern trembled, but she did not.',
      'He waited for the stairwell to betray a sound.',
      'Rain kept drilling the railing with patient insistence.',
    ]);
    expect(result.options?.every((option) => option.overallScore === 50)).toBe(true);
  });

  it('adds conflict compliance notes for directed mode and boosts confidence when no adaptation is needed', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        'This conflicts with established character logic.',
        'She answers anyway, because the danger leaves no room for retreat.',
      ].join('\n'),
      'directed',
      modelConfig,
    );

    expect(result.text).toContain('[Instruction partially adapted due to quality constraint conflict]');
    expect(result.metadata.confidence).toBe(0.55);
  });

  it('uses the medium confidence tier for moderately long plain output', () => {
    const aggregator = new OutputAggregator();
    const mediumLengthText = 'The storm kept speaking through the shutters while she refused to step back. '.repeat(6).trim();

    const result = aggregator.aggregate(mediumLengthText, 'auto', modelConfig);

    expect(result.metadata.confidence).toBe(0.7);
  });

  it('boosts confidence for long guided outputs with three strong options', () => {
    const aggregator = new OutputAggregator();
    const longOption = 'Stone and thunder closed around the stairwell while she counted each breath. '.repeat(16).trim();

    const result = aggregator.aggregate(
      [
        'Option 1:',
        longOption,
        'Coherence: 92',
        'Creativity: 88',
        'Style Match: 86',
        '',
        'Option 2:',
        `${longOption} Second angle.`,
        'Coherence: 84',
        'Creativity: 82',
        'Style Match: 80',
        '',
        'Option 3:',
        `${longOption} Third angle.`,
        'Coherence: 78',
        'Creativity: 76',
        'Style Match: 74',
      ].join('\n'),
      'guided',
      modelConfig,
    );

    expect(result.text).toBe(longOption);
    expect(result.metadata.confidence).toBe(0.9);
  });
});
