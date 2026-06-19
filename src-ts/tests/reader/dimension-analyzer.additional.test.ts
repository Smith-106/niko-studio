import { afterEach, describe, expect, it, vi } from 'vitest';

import { DimensionAnalyzer, createDimensionAnalyzer } from '../../reader/DimensionAnalyzer.js';
import {
  createGeneralReader,
  createLiteraryCritic,
  createSuspenseEnthusiast,
} from '../../reader/PersonaDefinition.js';
import { QualityDimension } from '../../quality/types.js';

describe('reader/DimensionAnalyzer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('analyzes all supported dimensions in the expected order', () => {
    const analyzer = createDimensionAnalyzer();
    const persona = createGeneralReader();
    const text = [
      'However the hallway stayed silent until Mara said the name aloud.',
      'Suddenly the lights failed and her heart pounded.',
    ].join('\n\n');

    const results = analyzer.analyzeAllDimensions(text, persona);

    expect(results).toHaveLength(4);
    expect(results.map(result => result.dimension)).toEqual([
      QualityDimension.PLOT_COHERENCE,
      QualityDimension.CHARACTER_CONSISTENCY,
      QualityDimension.STYLE_CONSISTENCY,
      QualityDimension.PACING_TENSION,
    ]);
    expect(results.map(result => result.weight)).toEqual([0.7, 0.7, 0.5, 0.6]);
  });

  it('flags a dimension when weighted findings push the score below the persona threshold', () => {
    const analyzer = new DimensionAnalyzer();
    const persona = createLiteraryCritic();
    const findings = [
      {
        description: 'Style issue',
        severity: 'high' as const,
        location: { paragraph: 1 },
        suggestion: 'Revise the sentence rhythm.',
      },
    ];

    vi.spyOn(analyzer as never, 'performHeuristicAnalysis' as never).mockReturnValue(0.6);
    vi.spyOn(analyzer as never, 'extractFindings' as never).mockReturnValue(findings);

    const result = analyzer.analyzeDimension(
      'Dense and repetitive prose.',
      QualityDimension.STYLE_CONSISTENCY,
      persona,
    );

    expect(result.weight).toBe(0.95);
    expect(result.score).toBeCloseTo(0.41, 5);
    expect(result.flagged).toBe(true);
    expect(result.findings).toEqual(findings);
  });

  it('returns neutral scores for empty style inputs and single-paragraph pacing inputs', () => {
    const analyzer = new DimensionAnalyzer();

    expect(
      (analyzer as any).performHeuristicAnalysis('', QualityDimension.STYLE_CONSISTENCY),
    ).toBe(0.5);
    expect(
      (analyzer as any).performHeuristicAnalysis(
        'Suddenly the door burst open and danger rushed in.',
        QualityDimension.PACING_TENSION,
      ),
    ).toBe(0.5);
  });

  it('extracts pacing and style findings from long paragraphs and repeated vocabulary', () => {
    const analyzer = new DimensionAnalyzer();
    const longParagraph = Array.from({ length: 151 }, (_, index) => `word${index}`).join(' ');
    const repeatedWord = Array.from({ length: 6 }, () => 'repetition').join(' ');

    const pacingFindings = (analyzer as any).extractFindings(
      `${longParagraph}\n\nshort paragraph`,
      QualityDimension.PACING_TENSION,
    );
    const styleFindings = (analyzer as any).extractFindings(
      repeatedWord,
      QualityDimension.STYLE_CONSISTENCY,
    );

    expect(pacingFindings).toEqual([
      expect.objectContaining({
        severity: 'medium',
        location: { paragraph: 1 },
      }),
    ]);
    expect(styleFindings).toEqual([
      expect.objectContaining({
        severity: 'low',
      }),
    ]);
    expect(styleFindings[0].description).toContain('repetition');
  });

  it('applies weighted penalties across severities and clamps negative scores to zero', () => {
    const analyzer = new DimensionAnalyzer();
    const findings = [
      {
        description: 'Minor issue',
        severity: 'low' as const,
        location: {},
        suggestion: 'Trim repetition.',
      },
      {
        description: 'Moderate issue',
        severity: 'medium' as const,
        location: {},
        suggestion: 'Tighten the paragraph.',
      },
      {
        description: 'Major issue',
        severity: 'high' as const,
        location: {},
        suggestion: 'Rewrite the scene.',
      },
    ];

    expect((analyzer as any).applyWeightedSensitivity(0.8, 0.5, findings)).toBeCloseTo(0.625, 5);
    expect((analyzer as any).applyWeightedSensitivity(0.1, 1, findings)).toBe(0);
    expect((analyzer as any).applyWeightedSensitivity(0.77, 0.6, [])).toBe(0.77);
  });

  it('uses heuristic analyzers for supported dimensions and falls back to neutral for unknown ones', () => {
    const analyzer = new DimensionAnalyzer();
    const plotText = [
      'However the witness changed her story.',
      'Meanwhile the detective found the key.',
      'Then the timeline finally aligned.',
    ].join('\n\n');
    const characterText = [
      'Mara said the room felt wrong.',
      'Jon whispered that the floor was moving.',
    ].join('\n\n');
    const styleText = [
      'one two three four.',
      'one two three four five six seven.',
      'one two three four five.',
    ].join(' ');
    const pacingText = [
      'Calm setup words remain sparse.',
      'Suddenly urgent footsteps raced down the narrow corridor while every witness froze in fear.',
    ].join('\n\n');

    expect(
      (analyzer as any).performHeuristicAnalysis(plotText, QualityDimension.PLOT_COHERENCE),
    ).toBeGreaterThan(0.5);
    expect(
      (analyzer as any).performHeuristicAnalysis(
        characterText,
        QualityDimension.CHARACTER_CONSISTENCY,
      ),
    ).toBeGreaterThan(0.5);
    expect(
      (analyzer as any).performHeuristicAnalysis(styleText, QualityDimension.STYLE_CONSISTENCY),
    ).toBeGreaterThan(0.7);
    expect(
      (analyzer as any).performHeuristicAnalysis(pacingText, QualityDimension.PACING_TENSION),
    ).toBeGreaterThan(0.4);
    expect((analyzer as any).performHeuristicAnalysis('plain text', 'unknown')).toBe(0.5);
  });

  it('keeps a dimension unflagged when the persona threshold stays below the weighted score', () => {
    const analyzer = new DimensionAnalyzer();
    const persona = createSuspenseEnthusiast();

    vi.spyOn(analyzer as never, 'performHeuristicAnalysis' as never).mockReturnValue(0.9);
    vi.spyOn(analyzer as never, 'extractFindings' as never).mockReturnValue([]);

    const result = analyzer.analyzeDimension(
      'Fast, tense, and coherent prose.',
      QualityDimension.PACING_TENSION,
      persona,
    );

    expect(result.score).toBe(0.9);
    expect(result.weight).toBe(0.95);
    expect(result.flagged).toBe(false);
  });
});
