import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultStyleVector,
  driftEventToDict,
  getMatchLevel,
  type StyleMatchResult,
  type StyleProfile,
  type StyleVector,
  StyleAnalyzer,
  StyleDriftDetector,
  StyleMatcher,
  styleProfileFromDict,
  styleProfileToDict,
  styleVectorCosineSimilarity,
} from '../../narrative/style-system';

function createVector(overrides: Partial<StyleVector> = {}): StyleVector {
  return {
    ...createDefaultStyleVector(),
    ...overrides,
  };
}

function createZeroVector(): StyleVector {
  return Object.fromEntries(
    Object.keys(createDefaultStyleVector()).map((key) => [key, 0]),
  ) as unknown as StyleVector;
}

function matchWithSimilarity(similarity: number): StyleMatchResult {
  return {
    targetProfile: 'target',
    similarity,
    distance: 0,
    dimensionScores: {},
    suggestions: [],
  };
}

describe('style-system additional coverage', () => {
  it('covers punctuation-only defaults, latin token boundaries, and llm fallback branches', async () => {
    const analyzer = new StyleAnalyzer();
    const punctuationOnly = '\uff01\uff1f\uff1b\u2026';

    expect(analyzer.analyze(punctuationOnly)).toEqual(createDefaultStyleVector());
    expect(analyzer.analyze('alpha\u4f60 beta').vocabulary_richness).toBeGreaterThan(0);
    expect(analyzer.analyze('\u3400\u{20000}\u3002').vocabulary_richness).toBeGreaterThan(0);
    expect(analyzer.analyze('plain\u3002').certainty_level).toBe(0.5);
    expect(analyzer.analyze('\u4e00\u5b9a\u3002').certainty_level).toBe(1);

    const base = analyzer.analyze('alpha\u4f60\u3002');
    const emptyClient = { generateJson: vi.fn().mockResolvedValue({}) };
    const sparseClient = { generateJson: vi.fn().mockResolvedValue({ rhetorical: {}, narrative: {} }) };
    const failingClient = { generateJson: vi.fn().mockRejectedValue(new Error('offline')) };

    await expect(new StyleAnalyzer(emptyClient as never).analyzeWithLlm('alpha\u4f60\u3002')).resolves.toEqual(base);
    await expect(new StyleAnalyzer(sparseClient as never).analyzeWithLlm('alpha\u4f60\u3002')).resolves.toEqual(base);
    await expect(new StyleAnalyzer(failingClient as never).analyzeWithLlm('alpha\u4f60\u3002')).resolves.toEqual(base);
  });

  it('covers defensive white-box helper guards that public analysis normalizes away', () => {
    const analyzer = new StyleAnalyzer() as unknown as {
      analyzeLexical(text: string, words: string[]): Record<string, number>;
      analyzeNarrative(text: string, sentences: string[]): Record<string, number>;
      analyzeRhythmic(text: string, paragraphs: string[], sentences: string[]): Record<string, number>;
      isParallel(sentences: string[]): boolean;
    };
    const matcher = new StyleMatcher() as unknown as {
      averageVectors(vectors: StyleVector[]): StyleVector;
    };
    const wordsWithImpossibleLength = {
      length: -1,
      [Symbol.iterator]: function* iterateNothing() {},
      reduce: () => 0,
      filter: () => [],
    } as unknown as string[];

    expect(analyzer.analyzeLexical('', ['token']).technical_density).toBe(0);
    expect(analyzer.analyzeLexical('text', wordsWithImpossibleLength).colloquial_ratio).toBe(0);
    expect(analyzer.analyzeRhythmic('', ['paragraph'], ['sentence']).punctuation_rhythm).toBe(0.5);
    expect(analyzer.analyzeNarrative('', ['sentence'])).toMatchObject({
      dialogue_ratio: 0,
      description_density: 0.5,
    });
    expect(analyzer.isParallel(['one', 'two'])).toBe(false);
    expect(matcher.averageVectors([])).toEqual(createDefaultStyleVector());
  });

  it('extracts rich text signals and keeps base values for missing llm fields', async () => {
    const richText = [
      '\u8bf7\u60a8\u770b\u8fd9\u4efd AI 3.5% \u62a5\u544a\uff0c\u6211\u89c9\u5f97\u5b83\u50cf\u4e00\u9762\u955c\u5b50\u3002',
      '\u56e0\u4e3a\u98ce\u4f4e\u8bed\uff0c\u6240\u4ee5\u57ce\u5e02\u53f9\u606f\uff0c\u4f46\u662f\u4ed6\u88ab\u5bd2\u96e8\u63a8\u5411\u95e8\u53e3\u3002',
      '\u96be\u9053\u6211\u4eec\u4e0d\u8be5\u524d\u8fdb\u5417\uff1f\u5979\u8bf4\uff1a\u201c\u8d70\u5427\uff0c\u5343\u4e07\u522b\u56de\u5934\u554a\uff01\u201d',
      '\u6211\u66fe\u7ecf\u5bb3\u6015\uff0c\u6b63\u5728\u5b66\u4f1a\u770b\u89c1\u6e29\u6696\u7684\u5149\u3002',
    ].join('\n\n');

    const analyzer = new StyleAnalyzer();
    const vector = analyzer.analyze(richText);

    expect(vector.technical_density).toBeGreaterThan(0);
    expect(vector.colloquial_ratio).toBeGreaterThan(0);
    expect(vector.clause_ratio).toBeGreaterThan(0);
    expect(vector.passive_ratio).toBeGreaterThan(0);
    expect(vector.interrogative_ratio).toBeGreaterThan(0);
    expect(vector.metaphor_density).toBeGreaterThan(0);
    expect(vector.rhetorical_question).toBeGreaterThan(0);
    expect(vector.hyperbole_level).toBeGreaterThan(0);
    expect(vector.personification).toBeGreaterThan(0);
    expect(vector.dialogue_ratio).toBeGreaterThan(0);
    expect(vector.description_density).toBeGreaterThan(0);

    const noClient = await analyzer.analyzeWithLlm(richText);
    expect(noClient).toEqual(vector);

    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        rhetorical: { metaphor_density: 0.77 },
        narrative: { description_density: 0.66 },
      }),
    };
    const llmVector = await new StyleAnalyzer(llmClient as never).analyzeWithLlm(richText);

    expect(llmClient.generateJson).toHaveBeenCalledTimes(1);
    expect(llmVector.metaphor_density).toBe(0.77);
    expect(llmVector.description_density).toBe(0.66);
    expect(llmVector.hyperbole_level).toBe(vector.hyperbole_level);
    expect(llmVector.showing_vs_telling).toBe(vector.showing_vs_telling);
  });

  it('covers public helper boundaries for match levels and dictionaries', () => {
    const zero = createZeroVector();
    const profile: StyleProfile = {
      name: 'minimal',
      vector: createVector({ vocabulary_richness: 0.8 }),
      sampleCount: 2,
      description: '',
      tags: [],
      sourceTexts: ['private sample'],
    };

    expect(styleVectorCosineSimilarity(zero, createDefaultStyleVector())).toBe(0);
    expect(getMatchLevel(matchWithSimilarity(0.91))).toBe('excellent');
    expect(getMatchLevel(matchWithSimilarity(0.76))).toBe('good');
    expect(getMatchLevel(matchWithSimilarity(0.61))).toBe('fair');
    expect(getMatchLevel(matchWithSimilarity(0.41))).toBe('weak');
    expect(getMatchLevel(matchWithSimilarity(0.39))).toBe('poor');

    const dict = styleProfileToDict(profile);
    expect(dict).not.toHaveProperty('sourceTexts');
    expect(dict).toMatchObject({ name: 'minimal', sample_count: 2, tags: [] });

    const restored = styleProfileFromDict({ vector: {} });
    expect(restored).toMatchObject({
      name: '',
      sampleCount: 1,
      description: '',
      tags: [],
      sourceTexts: [],
    });

    expect(
      driftEventToDict({
        position: 10,
        segmentIndex: 2,
        driftMagnitude: 0.4,
        driftedDimensions: ['tone'],
        beforeVector: createDefaultStyleVector(),
        afterVector: createVector({ formality_level: 1 }),
        severity: 'minor',
      }),
    ).toEqual({
      position: 10,
      segment_index: 2,
      drift_magnitude: 0.4,
      drifted_dimensions: ['tone'],
      severity: 'minor',
    });
  });

  it('covers drift detector no-op and reference severity branches', () => {
    const base = createDefaultStyleVector();
    const shifted = createVector({ vocabulary_richness: 1, avg_sentence_length: 1 });
    const analyzer = {
      analyze: vi.fn((text: string) => (text.includes('z') ? shifted : base)),
    };

    const detector = new StyleDriftDetector(5, 5, 10, analyzer as never);
    expect(detector.detect('short')).toEqual([]);
    expect(detector.detect('aaaaabbbbb')).toEqual([]);
    expect(detector.getStabilityScore('aaaaabbbbb')).toBe(1);

    const referenceDetector = new StyleDriftDetector(5, 5, 0.05, analyzer as never);
    const events = referenceDetector.detectAgainstReference('zzzzzaaaaa', base);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].severity).toBe('severe');
    expect(events[0].driftedDimensions).toContain('vocabulary_richness');

    const singleWindowDetector = new StyleDriftDetector(6, 100, 0.1, analyzer as never);
    expect(singleWindowDetector.detect('aaaaaabbbbbb')).toEqual([]);

    const moderateDetector = new StyleDriftDetector(5, 5, 0.25, analyzer as never);
    expect(moderateDetector.detect('aaaaazzzzz')[0].severity).toBe('moderate');
    expect(moderateDetector.detectAgainstReference('zzzzz', base)[0].severity).toBe('moderate');

    class UnknownSeverityDetector extends StyleDriftDetector {
      detect(): any[] {
        return [{
          severity: 'custom',
          position: 0,
          segmentIndex: 0,
          driftMagnitude: 1,
          driftedDimensions: [],
          beforeVector: base,
          afterVector: shifted,
        }];
      }
    }
    expect(new UnknownSeverityDetector(5, 5).getStabilityScore('aaaaazzzzz')).toBeCloseTo(0.95);
  });

  it('covers matcher empty, import, missing guide, and suggestion branches', async () => {
    const targetVector = createVector({
      vocabulary_richness: 1,
      avg_sentence_length: 1,
      formality_level: 1,
      dialogue_ratio: 1,
      showing_vs_telling: 1,
    });
    const draftVector = createVector({
      vocabulary_richness: 0,
      avg_sentence_length: 0,
      formality_level: 0,
      dialogue_ratio: 0,
      showing_vs_telling: 0,
    });
    const analyzer = {
      analyze: vi.fn((text: string) => (text === 'sample' ? targetVector : draftVector)),
    };
    const matcher = new StyleMatcher(analyzer as never);

    expect(() => matcher.learn('empty', [])).toThrow('At least one sample text is required');
    expect(matcher.findClosestStyle('draft')).toEqual(['', 0]);
    expect(matcher.importProfiles({ bad: {} })).toBe(0);
    await expect(matcher.generateStyleGuide('missing')).rejects.toThrow('Unknown style profile');

    matcher.learn('target', ['sample']);
    const result = matcher.match('draft', 'target');

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.dimensionScores.vocabulary_richness).toBeLessThan(0.7);
    expect(result.dimensionScores.formality_level).toBeLessThan(0.7);
  });

  it('covers all matcher suggestion dimensions in both directions', () => {
    function suggestionsFor(target: Partial<StyleVector>, draft: Partial<StyleVector>): string[] {
      const targetVector = createVector(target);
      const draftVector = createVector(draft);
      const analyzer = {
        analyze: vi.fn((text: string) => (text === 'sample' ? targetVector : draftVector)),
      };
      const matcher = new StyleMatcher(analyzer as never);
      matcher.learn('target', ['sample']);
      return matcher.match('draft', 'target').suggestions;
    }

    const groupA = {
      vocabulary_richness: 1,
      avg_word_length: 1,
      colloquial_ratio: 1,
      avg_sentence_length: 1,
      sentence_complexity: 1,
    };
    const groupB = {
      metaphor_density: 1,
      formality_level: 1,
      emotional_valence: 1,
      dialogue_ratio: 1,
      showing_vs_telling: 1,
    };
    const lowA = {
      vocabulary_richness: 0,
      avg_word_length: 0,
      colloquial_ratio: 0,
      avg_sentence_length: 0,
      sentence_complexity: 0,
    };
    const lowB = {
      metaphor_density: 0,
      formality_level: 0,
      emotional_valence: 0,
      dialogue_ratio: 0,
      showing_vs_telling: 0,
    };

    expect(suggestionsFor(groupA, lowA)).toHaveLength(5);
    expect(suggestionsFor(lowA, groupA)).toHaveLength(5);
    expect(suggestionsFor(groupB, lowB)).toHaveLength(5);
    expect(suggestionsFor(lowB, groupB)).toHaveLength(5);
  });

  it('covers basic guide fallback text and threshold levels', async () => {
    async function guideFor(vector: StyleVector, name: string): Promise<string> {
      const analyzer = { analyze: vi.fn(() => vector) };
      const matcher = new StyleMatcher(analyzer as never);
      matcher.learn(name, ['sample']);
      return matcher.generateStyleGuide(name);
    }

    const highGuide = await guideFor(createVector({
      vocabulary_richness: 0.9,
      colloquial_ratio: 0.8,
      avg_sentence_length: 0.9,
      sentence_complexity: 0.9,
      metaphor_density: 0.9,
      formality_level: 0.9,
      emotional_valence: 0.9,
      dialogue_ratio: 0.9,
      showing_vs_telling: 0.9,
    }), 'high');
    const mediumGuide = await guideFor(createVector({
      vocabulary_richness: 0.5,
      colloquial_ratio: 0.3,
      avg_sentence_length: 0.5,
      sentence_complexity: 0.5,
      metaphor_density: 0.3,
      formality_level: 0.5,
      emotional_valence: 0.5,
      dialogue_ratio: 0.3,
      showing_vs_telling: 0.5,
    }), 'medium');
    const lowGuide = await guideFor(createVector({
      vocabulary_richness: 0.1,
      colloquial_ratio: 0.1,
      avg_sentence_length: 0.1,
      sentence_complexity: 0.1,
      metaphor_density: 0.1,
      formality_level: 0.1,
      emotional_valence: 0.1,
      dialogue_ratio: 0.1,
      showing_vs_telling: 0.1,
    }), 'low');

    expect(highGuide).toContain('# high');
    expect(mediumGuide).toContain('# medium');
    expect(lowGuide).toContain('# low');
  });
});
