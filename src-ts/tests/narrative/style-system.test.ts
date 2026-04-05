import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultStyleVector,
  getMatchLevel,
  type StyleVector,
  StyleAnalyzer,
  StyleDriftDetector,
  StyleMatcher,
  styleVectorCosineSimilarity,
  styleVectorDistance,
  styleVectorFromArray,
  styleVectorFromDict,
  styleVectorToArray,
  styleVectorToDict,
} from '../../narrative/style-system';

function createVector(overrides: Partial<StyleVector> = {}): StyleVector {
  return {
    ...createDefaultStyleVector(),
    ...overrides,
  };
}

describe('style-system', () => {
  it('roundtrips style vectors and computes distance and similarity helpers', () => {
    const vector = createVector({
      vocabulary_richness: 0.9,
      avg_sentence_length: 0.2,
      showing_vs_telling: 0.8,
    });

    const roundtrip = styleVectorFromArray(styleVectorToArray(vector));
    const partial = styleVectorFromDict({
      vocabulary_richness: 0.9,
      avg_sentence_length: 0.2,
    });

    expect(roundtrip).toEqual(vector);
    expect(styleVectorToDict(roundtrip)).toMatchObject({
      vocabulary_richness: 0.9,
      avg_sentence_length: 0.2,
      showing_vs_telling: 0.8,
    });
    expect(partial.vocabulary_richness).toBe(0.9);
    expect(partial.avg_sentence_length).toBe(0.2);
    expect(partial.showing_vs_telling).toBe(createDefaultStyleVector().showing_vs_telling);
    expect(styleVectorDistance(vector, roundtrip)).toBe(0);
    expect(styleVectorCosineSimilarity(vector, roundtrip)).toBeCloseTo(1, 10);
    expect(() => styleVectorFromArray([1, 2, 3])).toThrow('Expected 30 dimensions');
  });

  it('analyzes empty text deterministically and merges llm refinements when available', async () => {
    const analyzer = new StyleAnalyzer();
    const empty = analyzer.analyze('');

    expect(empty).toEqual(createDefaultStyleVector());

    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        rhetorical: {
          metaphor_density: 0.95,
          hyperbole_level: 0.8,
        },
        narrative: {
          showing_vs_telling: 0.9,
          description_density: 0.75,
        },
      }),
    };
    const llmAnalyzer = new StyleAnalyzer(llmClient as never);

    const merged = await llmAnalyzer.analyzeWithLlm(
      '我看见雨夜的街灯像碎裂的镜子。她说：“别回头。”风从长巷尽头压过来。',
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(merged.metaphor_density).toBe(0.95);
    expect(merged.hyperbole_level).toBe(0.8);
    expect(merged.showing_vs_telling).toBe(0.9);
    expect(merged.description_density).toBe(0.75);
  });

  it('detects drift and computes stability against sliding windows and references', () => {
    const baseline = createVector({ vocabulary_richness: 0.2 });
    const shifted = createVector({
      vocabulary_richness: 0.95,
      avg_sentence_length: 0.9,
      formality_level: 0.9,
    });
    const analyzer = {
      analyze: vi.fn((text: string) => (text.includes('b') || text.includes('c') ? shifted : baseline)),
    };
    const detector = new StyleDriftDetector(5, 5, 0.3, analyzer as never);
    const text = 'aaaaabbbbbccccc';

    const events = detector.detect(text);
    const referenceEvents = detector.detectAgainstReference(text, baseline);
    const stability = detector.getStabilityScore(text);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.segmentIndex).toBe(1);
    expect(events[0]?.driftedDimensions).toContain('vocabulary_richness');
    expect(['moderate', 'severe']).toContain(String(events[0]?.severity));
    expect(referenceEvents.length).toBeGreaterThan(0);
    expect(stability).toBeGreaterThanOrEqual(0);
    expect(stability).toBeLessThan(1);
  });

  it('learns profiles, matches text, and imports or exports profile dictionaries', () => {
    const matcher = new StyleMatcher();
    matcher.learn(
      'formal',
      ['她郑重陈述事实，并以谨慎克制的语气推进叙述。'],
      '正式克制',
      ['formal'],
    );
    matcher.learn(
      'casual',
      ['她笑着说：“走吧，别磨蹭了！”语气轻快而口语化。'],
      '轻快口语',
      ['casual'],
    );

    const result = matcher.match(
      '她郑重陈述事实，并以谨慎克制的语气推进叙述。',
      'formal',
    );
    const closest = matcher.findClosestStyle(
      '她笑着说：“走吧，别磨蹭了！”语气轻快而口语化。',
    );
    const exported = matcher.exportProfiles();

    expect(result.targetProfile).toBe('formal');
    expect(result.similarity).toBeGreaterThan(0.99);
    expect(getMatchLevel(result)).toBe('excellent');
    expect(closest[0]).toBe('casual');
    expect(matcher.listProfiles()).toEqual(['formal', 'casual']);

    const imported = new StyleMatcher();
    const importedCount = imported.importProfiles(exported);

    expect(importedCount).toBe(2);
    expect(imported.getProfile('formal')?.description).toBe('正式克制');
    expect(() => matcher.match('任意文本', 'missing')).toThrow('Unknown style profile');
  });

  it('falls back to a basic guide when no llm is present or guide generation fails', async () => {
    const matcher = new StyleMatcher();
    matcher.learn(
      'shadow',
      ['夜色沉下去，街灯像冷火，人物只用低声对话推动场景。'],
      '冷感、克制、偏展示',
      ['moody'],
    );

    const basicGuide = await matcher.generateStyleGuide('shadow');

    expect(basicGuide).toContain('# shadow 风格指南');
    expect(basicGuide).toContain('冷感、克制、偏展示');

    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const llmMatcher = new StyleMatcher(undefined, llmClient as never);
    llmMatcher.learn(
      'shadow',
      ['夜色沉下去，街灯像冷火，人物只用低声对话推动场景。'],
      '冷感、克制、偏展示',
      ['moody'],
    );

    const fallbackGuide = await llmMatcher.generateStyleGuide('shadow');

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(fallbackGuide).toContain('# shadow 风格指南');
  });
});
