import { describe, expect, it } from 'vitest';

import { SuspenseAnalyzer } from '../../narrative/suspense-analyzer';
import {
  AntiPattern,
  ANTI_PATTERNS,
  GENRE_BEATS,
  GenreBeatType,
  NARRATIVE_TECHNIQUES,
  STORY_STRUCTURES,
  SUBGENRE_RULES,
  type GenreBeatTemplate,
  type SubgenreRules,
} from '../../narrative/writing-craft/craft-catalog';

describe('SuspenseAnalyzer tail branch coverage', () => {
  it('covers medium satisfaction density suggestion', () => {
    const analyzer = new SuspenseAnalyzer();
    const result = analyzer.analyzeSatisfactionDensity(`${'真相'}${'x'.repeat(700)}`);

    expect(result.points).toHaveLength(1);
    expect(result.density).toBeGreaterThanOrEqual(1);
    expect(result.density).toBeLessThan(2);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('covers subgenre clean and forbidden branches with temporary rules', () => {
    const analyzer = new SuspenseAnalyzer();
    const rules = SUBGENRE_RULES as unknown as Record<string, SubgenreRules>;
    const cleanKey = 'tail_clean';
    const forbiddenKey = 'tail_forbidden';

    rules[cleanKey] = {
      subgenre: cleanKey as never,
      label: 'Tail Clean',
      description: 'tail clean test rule',
      coreRules: ['alpha'],
      requiredElements: ['alpha'],
      forbiddenElements: [],
      keywords: { typical: ['alpha'], atypical: [] },
      referenceWorks: [],
    };
    rules[forbiddenKey] = {
      ...rules[cleanKey],
      subgenre: forbiddenKey as never,
      label: 'Tail Forbidden',
      forbiddenElements: ['forbidden-token'],
    };

    try {
      expect(analyzer.checkSubgenreRules(
        [{ content: 'alpha', chapterIndex: 1 }],
        cleanKey as never,
      ).suggestions).toEqual(['Tail Clean的核心规则遵守良好']);

      const forbidden = analyzer.checkSubgenreRules(
        [{ content: 'alpha forbidden-token', chapterIndex: 1 }],
        forbiddenKey as never,
      );
      expect(forbidden.violations).toContain('包含禁止元素: forbidden-token');
    } finally {
      delete rules[cleanKey];
      delete rules[forbiddenKey];
    }
  });

  it('covers closed-circle detected and missing paths', () => {
    const analyzer = new SuspenseAnalyzer();

    const detected = analyzer.detectClosedCircle([
      { content: '孤岛 暴风雪 嫌疑人 在场 死了 被杀', chapterIndex: 1 },
    ]);
    expect(detected.detected).toBe(true);
    expect(detected.elements.length).toBeGreaterThanOrEqual(3);

    const missing = analyzer.detectClosedCircle([{ content: 'ordinary day', chapterIndex: 1 }]);
    expect(missing.detected).toBe(false);
    expect(missing.missing).toHaveLength(3);
  });

  it('covers empty narrative technique catalog branch', () => {
    const analyzer = new SuspenseAnalyzer();
    const techniques = NARRATIVE_TECHNIQUES as unknown as Record<string, unknown>;
    const saved = { ...techniques };

    try {
      for (const key of Object.keys(techniques)) delete techniques[key];

      expect(analyzer.detectNarrativeTechniques([])).toMatchObject({
        detections: [],
        overallScore: 0,
        techniqueDensity: 0,
      });
    } finally {
      Object.assign(techniques, saved);
    }
  });

  it('covers no-required genre beat scoring branch', () => {
    const analyzer = new SuspenseAnalyzer();
    const genreMap = GENRE_BEATS as unknown as Record<string, GenreBeatTemplate>;
    const genreKey = 'tail_no_required';

    genreMap[genreKey] = {
      genreType: genreKey as GenreBeatType,
      label: 'Tail Genre',
      description: 'tail branch genre',
      beatSequence: [
        { name: 'optional beat', position: 0.5, description: 'optional', required: false },
      ],
      characterArchetypes: [],
      keyScenes: [],
      typicalKeywords: [],
    };

    try {
      expect(analyzer.analyzeGenreBeats([], genreKey as GenreBeatType)).toMatchObject({
        overallAlignmentScore: 0,
        missingBeats: [],
      });
    } finally {
      delete genreMap[genreKey];
    }
  });

  it('covers Edson missing-template, empty-template, and good-alignment branches', () => {
    const analyzer = new SuspenseAnalyzer();
    const structures = STORY_STRUCTURES as Record<string, typeof STORY_STRUCTURES.edson_23_sequence | undefined>;
    const saved = structures.edson_23_sequence;

    try {
      delete structures.edson_23_sequence;
      expect(analyzer.analyzeEdsonSequence([])).toMatchObject({
        alignments: [],
        overallAlignmentScore: 0,
        missingBeats: [],
      });

      structures.edson_23_sequence = { name: 'Empty Edson', beats: [] };
      expect(analyzer.analyzeEdsonSequence([])).toMatchObject({
        alignments: [],
        overallAlignmentScore: 0,
      });

      structures.edson_23_sequence = saved;
      const chapters = saved?.beats.map((beat) => ({
        content: `${beat.name} ${beat.description}`,
        position: beat.position,
      })) ?? [];

      expect(analyzer.analyzeEdsonSequence(chapters).overallAlignmentScore).toBeGreaterThanOrEqual(0.7);
      expect(analyzer.analyzeEdsonSequence(chapters).suggestions.length).toBeGreaterThan(0);
    } finally {
      structures.edson_23_sequence = saved;
    }
  });

  it('covers warning anti-pattern suggestion branch', () => {
    const analyzer = new SuspenseAnalyzer();
    const warningKeyword = ANTI_PATTERNS[AntiPattern.ON_THE_NOSE_DIALOGUE].detectionKeywords[0];

    const result = analyzer.detectAntiPatterns([{ content: warningKeyword, chapterIndex: 1 }]);

    expect(result.warningCount).toBe(1);
    expect(result.criticalCount).toBe(0);
    expect(result.suggestions[0]).toContain('[警告]');
  });
});
