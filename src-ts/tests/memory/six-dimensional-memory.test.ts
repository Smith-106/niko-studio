/**
 * Six-Dimensional Memory Tests
 *
 * Tests DimensionType enum, DimensionScore, ClassificationResult,
 * ProcessedContent, BaseDimensionProcessor, all 6 dimension processors,
 * and DimensionRouter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DimensionType,
  DimensionScore,
  ClassificationResult,
  ProcessedContent,
  BaseDimensionProcessor,
  TimelineProcessor,
  ContextProcessor,
  CharacterProcessor,
  WorldviewProcessor,
  PreferenceProcessor,
  ExperienceProcessor,
  DimensionRouter,
  getDimensionRouter,
  resetDimensionRouter,
} from '../../memory/six-dimensional-memory';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetDimensionRouter();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
  });
});

afterEach(() => {
  resetDimensionRouter();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// DimensionType enum
// ---------------------------------------------------------------------------

describe('DimensionType', () => {
  it('has six dimension types', () => {
    expect(Object.values(DimensionType)).toEqual([
      'timeline',
      'context',
      'character',
      'worldview',
      'preference',
      'experience',
    ]);
  });
});

// ---------------------------------------------------------------------------
// DimensionScore
// ---------------------------------------------------------------------------

describe('DimensionScore', () => {
  it('constructs with defaults', () => {
    const score = new DimensionScore({ dimension: DimensionType.TIMELINE });
    expect(score.dimension).toBe(DimensionType.TIMELINE);
    expect(score.score).toBe(0.0);
    expect(score.confidence).toBe(0.0);
    expect(score.keywordsMatched).toEqual([]);
  });

  it('constructs with full parameters', () => {
    const score = new DimensionScore({
      dimension: DimensionType.CHARACTER,
      score: 0.8,
      confidence: 0.9,
      keywordsMatched: ['hero', 'villain'],
    });
    expect(score.score).toBe(0.8);
    expect(score.confidence).toBe(0.9);
    expect(score.keywordsMatched).toEqual(['hero', 'villain']);
  });
});

// ---------------------------------------------------------------------------
// ClassificationResult
// ---------------------------------------------------------------------------

describe('ClassificationResult', () => {
  it('constructs with full parameters', () => {
    const now = new Date();
    const scores = [
      new DimensionScore({ dimension: DimensionType.TIMELINE, score: 0.7 }),
      new DimensionScore({ dimension: DimensionType.CONTEXT, score: 0.3 }),
    ];
    const result = new ClassificationResult({
      content: 'Test content',
      primaryDimension: DimensionType.TIMELINE,
      scores,
      multiDimensional: true,
      extractedEntities: ['Alice'],
      timestamp: now,
    });
    expect(result.content).toBe('Test content');
    expect(result.primaryDimension).toBe(DimensionType.TIMELINE);
    expect(result.scores).toHaveLength(2);
    expect(result.multiDimensional).toBe(true);
    expect(result.extractedEntities).toEqual(['Alice']);
    expect(result.timestamp).toBe(now);
  });

  it('getScore returns score for a dimension', () => {
    const scores = [
      new DimensionScore({ dimension: DimensionType.TIMELINE, score: 0.7 }),
      new DimensionScore({ dimension: DimensionType.CONTEXT, score: 0.3 }),
    ];
    const result = new ClassificationResult({
      content: 'Test',
      primaryDimension: DimensionType.TIMELINE,
      scores,
    });
    expect(result.getScore(DimensionType.TIMELINE)).toBe(0.7);
    expect(result.getScore(DimensionType.CONTEXT)).toBe(0.3);
    expect(result.getScore(DimensionType.CHARACTER)).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// ProcessedContent
// ---------------------------------------------------------------------------

describe('ProcessedContent', () => {
  it('constructs with defaults', () => {
    const pc = new ProcessedContent({
      original: 'Original text',
      processed: 'Processed text',
      dimension: DimensionType.CONTEXT,
    });
    expect(pc.original).toBe('Original text');
    expect(pc.processed).toBe('Processed text');
    expect(pc.dimension).toBe(DimensionType.CONTEXT);
    expect(pc.extractedData).toEqual({});
    expect(pc.tags).toEqual([]);
    expect(pc.importance).toBe(0.5);
    expect(pc.metadata).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// BaseDimensionProcessor
// ---------------------------------------------------------------------------

describe('BaseDimensionProcessor', () => {
  it('exposes the configured dimension', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, []);
    expect(processor.dimension).toBe(DimensionType.CONTEXT);
  });

  it('classifies empty content as zero score', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, [
      'scene', 'chapter', 'story',
    ]);
    const score = processor.classify('');
    expect(score.score).toBe(0.0);
    expect(score.confidence).toBe(0.0);
    expect(score.keywordsMatched).toEqual([]);
  });

  it('classifies whitespace-only content as zero score', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, [
      'scene',
    ]);
    const score = processor.classify('   ');
    expect(score.score).toBe(0.0);
    expect(score.confidence).toBe(0.0);
    expect(score.keywordsMatched).toEqual([]);
  });

  it('classifies content with matching keywords', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, [
      'scene', 'chapter', 'story', 'narrative', 'plot',
    ]);
    const score = processor.classify('The scene in chapter one drives the plot forward.');
    expect(score.score).toBeGreaterThan(0);
    expect(score.confidence).toBeGreaterThan(0);
    expect(score.keywordsMatched.length).toBeGreaterThan(0);
  });

  it('process returns ProcessedContent with extracted data', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, [
      'scene', 'chapter',
    ]);
    const result = processor.process('The scene begins with chapter one.');
    expect(result).toBeInstanceOf(ProcessedContent);
    expect(result.dimension).toBe(DimensionType.CONTEXT);
    expect(result.importance).toBeGreaterThan(0);
  });

  it('extractEntities returns empty array by default', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, []);
    expect(processor.extractEntities('some content')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TimelineProcessor
// ---------------------------------------------------------------------------

describe('TimelineProcessor', () => {
  it('extracts date patterns', () => {
    const processor = new TimelineProcessor();
    const entities = processor.extractEntities('It happened on 2026-03-15 and again on 2025/12/01.');
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.some((e) => e.includes('2026-03-15'))).toBe(true);
  });

  it('extracts time references', () => {
    const processor = new TimelineProcessor();
    const entities = processor.extractEntities('The meeting is at 14:30 and ends at 16:00.');
    expect(entities.some((e) => e.includes('14:30'))).toBe(true);
  });

  it('process extracts temporal markers', () => {
    const processor = new TimelineProcessor();
    const result = processor.process('First, the hero woke up. Then, he went outside. Finally, he returned.');
    expect(result.extractedData.temporal_markers).toBeDefined();
    expect(result.extractedData.has_sequence).toBe(true);
  });

  it('has static TIMELINE_KEYWORDS', () => {
    expect(TimelineProcessor.TIMELINE_KEYWORDS.length).toBeGreaterThan(0);
    expect(TimelineProcessor.TIMELINE_KEYWORDS).toContain('before');
    expect(TimelineProcessor.TIMELINE_KEYWORDS).toContain('after');
  });
});

// ---------------------------------------------------------------------------
// ContextProcessor
// ---------------------------------------------------------------------------

describe('ContextProcessor', () => {
  it('extracts chapter/scene references', () => {
    const processor = new ContextProcessor();
    const entities = processor.extractEntities('See Chapter 3 and Scene 5 for details.');
    expect(entities.length).toBeGreaterThan(0);
  });

  it('extracts POV markers', () => {
    const processor = new ContextProcessor();
    const entities = processor.extractEntities('Written in first-person perspective.');
    expect(entities.some((e) => e.includes('first-person'))).toBe(true);
  });

  it('has static CONTEXT_KEYWORDS', () => {
    expect(ContextProcessor.CONTEXT_KEYWORDS).toContain('scene');
    expect(ContextProcessor.CONTEXT_KEYWORDS).toContain('chapter');
  });
});

// ---------------------------------------------------------------------------
// CharacterProcessor
// ---------------------------------------------------------------------------

describe('CharacterProcessor', () => {
  it('classifies character-related content', () => {
    const processor = new CharacterProcessor();
    const score = processor.classify('The protagonist has a strong motivation and character arc.');
    expect(score.score).toBeGreaterThan(0);
    expect(score.keywordsMatched.length).toBeGreaterThan(0);
  });

  it('process extracts trait data', () => {
    const processor = new CharacterProcessor();
    const result = processor.process('The brave hero trusted his ally.');
    expect(result.extractedData.traits).toBeDefined();
    expect(result.extractedData.has_relationships).toBe(true);
  });

  it('extracts sentence-start and dialogue speaker names', () => {
    const processor = new CharacterProcessor();
    const entities = processor.extractEntities(
      'Alice waited. Bob felt afraid. "Leave now," shouted Clara.',
    );
    expect(entities).toEqual(expect.arrayContaining(['Bob', 'Clara']));
  });

  it('has static CHARACTER_KEYWORDS', () => {
    expect(CharacterProcessor.CHARACTER_KEYWORDS).toContain('protagonist');
    expect(CharacterProcessor.CHARACTER_KEYWORDS).toContain('antagonist');
  });
});

// ---------------------------------------------------------------------------
// WorldviewProcessor
// ---------------------------------------------------------------------------

describe('WorldviewProcessor', () => {
  it('classifies world-building content', () => {
    const processor = new WorldviewProcessor();
    const score = processor.classify('The magic system in this realm has strict rules and cultural traditions.');
    expect(score.score).toBeGreaterThan(0);
  });

  it('extracts place names', () => {
    const processor = new WorldviewProcessor();
    const entities = processor.extractEntities('The Kingdom of Eldoria and the Empire of Valoria fought.');
    expect(entities.length).toBeGreaterThan(0);
  });

  it('extracts named systems from world-building content', () => {
    const processor = new WorldviewProcessor();
    const entities = processor.extractEntities(
      'The Celestial Magic governs every oath in the realm.',
    );
    expect(entities).toContain('The Celestial');
  });

  it('has static WORLDVIEW_KEYWORDS', () => {
    expect(WorldviewProcessor.WORLDVIEW_KEYWORDS).toContain('world');
    expect(WorldviewProcessor.WORLDVIEW_KEYWORDS).toContain('magic');
  });
});

// ---------------------------------------------------------------------------
// PreferenceProcessor
// ---------------------------------------------------------------------------

describe('PreferenceProcessor', () => {
  it('classifies preference content', () => {
    const processor = new PreferenceProcessor();
    const score = processor.classify('I prefer a formal style with concise approach.');
    expect(score.score).toBeGreaterThan(0);
  });

  it('extracts preference and avoidance statements', () => {
    const processor = new PreferenceProcessor();
    const entities = processor.extractEntities('I prefer shorter paragraphs. Avoid overly long sentences.');
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.some((e) => e.startsWith('avoid:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ExperienceProcessor
// ---------------------------------------------------------------------------

describe('ExperienceProcessor', () => {
  it('classifies experience content', () => {
    const processor = new ExperienceProcessor();
    const score = processor.classify('I learned that shorter sentences improve readability. This technique works well.');
    expect(score.score).toBeGreaterThan(0);
  });

  it('extracts learning statements', () => {
    const processor = new ExperienceProcessor();
    const entities = processor.extractEntities('I discovered that active voice is stronger. I realized the pattern.');
    expect(entities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DimensionRouter
// ---------------------------------------------------------------------------

describe('DimensionRouter', () => {
  it('initializes with all six processors', () => {
    const router = new DimensionRouter();
    expect(router.getProcessor(DimensionType.TIMELINE)).toBeInstanceOf(TimelineProcessor);
    expect(router.getProcessor(DimensionType.CONTEXT)).toBeInstanceOf(ContextProcessor);
    expect(router.getProcessor(DimensionType.CHARACTER)).toBeInstanceOf(CharacterProcessor);
    expect(router.getProcessor(DimensionType.WORLDVIEW)).toBeInstanceOf(WorldviewProcessor);
    expect(router.getProcessor(DimensionType.PREFERENCE)).toBeInstanceOf(PreferenceProcessor);
    expect(router.getProcessor(DimensionType.EXPERIENCE)).toBeInstanceOf(ExperienceProcessor);
  });

  it('throws for unknown dimension', () => {
    const router = new DimensionRouter();
    expect(() => router.getProcessor('unknown' as DimensionType)).toThrow('Unknown dimension');
  });

  it('classifies content across all dimensions', () => {
    const router = new DimensionRouter();
    const result = router.classify('The scene began first, then the hero arrived. His character development was key.');
    expect(result).toBeInstanceOf(ClassificationResult);
    expect(result.scores).toHaveLength(6);
    expect(result.primaryDimension).toBeDefined();
  });

  it('detects multi-dimensional content', () => {
    const router = new DimensionRouter();
    const result = router.classify(
      'The scene in chapter 3 shows the protagonist development. The world has magic and cultural traditions. I prefer formal style.',
    );
    // Content mentions scene (context), protagonist (character), world/magic (worldview), prefer (preference)
    const highScores = result.scores.filter((s) => s.score > 0.3);
    expect(highScores.length).toBeGreaterThan(1);
    expect(result.multiDimensional).toBe(true);
  });

  it('processes content for a specific dimension', () => {
    const router = new DimensionRouter();
    const result = router.process('The hero began his journey first, then encountered danger.', DimensionType.TIMELINE);
    expect(result).toBeInstanceOf(ProcessedContent);
    expect(result.dimension).toBe(DimensionType.TIMELINE);
  });

  it('auto-classifies when dimension is null', () => {
    const router = new DimensionRouter();
    const result = router.process('The timeline began before the war ended.');
    expect(result).toBeInstanceOf(ProcessedContent);
    expect(result.dimension).toBeDefined();
  });

  it('defaults classification to context when no dimension scores match', () => {
    const router = new DimensionRouter();
    const result = router.classify('');
    expect(result.primaryDimension).toBe(DimensionType.CONTEXT);
    expect(result.extractedEntities).toEqual([]);
  });

  it('throws when processing an unknown dimension', () => {
    const router = new DimensionRouter();
    expect(() => router.process('content', 'unknown' as DimensionType)).toThrow(
      'Unknown dimension',
    );
  });

  it('processAll returns results for all dimensions', () => {
    const router = new DimensionRouter();
    const results = router.processAll('Test content');
    expect(results.size).toBe(6);
    for (const [dim, processed] of results) {
      expect(processed).toBeInstanceOf(ProcessedContent);
      expect(processed.dimension).toBe(dim);
    }
  });

  it('getRelevantDimensions returns dimensions above threshold', () => {
    const router = new DimensionRouter();
    const content = 'First the hero began, then the scene changed. The character arc developed.';
    const relevant = router.getRelevantDimensions(content, 0.1);
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant).toContain(DimensionType.TIMELINE);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('singleton functions', () => {
  it('getDimensionRouter returns same instance', () => {
    const r1 = getDimensionRouter();
    const r2 = getDimensionRouter();
    expect(r1).toBe(r2);
  });

  it('resetDimensionRouter creates new instance', () => {
    const r1 = getDimensionRouter();
    resetDimensionRouter();
    const r2 = getDimensionRouter();
    expect(r1).not.toBe(r2);
  });
});
