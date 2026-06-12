import { describe, expect, it, vi } from 'vitest';

import {
  computeSuspenseResult,
  SuspenseAnalyzer,
  SuspensePillar,
  type SuspenseAnalysisResult,
  type SuspenseScore,
} from '../../narrative/suspense-analyzer';
import {
  GenreBeatType,
  SuspenseSubgenre,
} from '../../narrative/writing-craft/craft-catalog';

function score(pillar: SuspensePillar, value: number, suggestions: string[] = []): SuspenseScore {
  return {
    pillar,
    score: value,
    elements: [],
    issues: [],
    suggestions,
  };
}

function baseResult(overrides: Partial<SuspenseAnalysisResult> = {}): SuspenseAnalysisResult {
  return {
    storyQuestions: score(SuspensePillar.STORY_QUESTION, 8),
    threatSituations: score(SuspensePillar.THREAT_SITUATION, 8),
    litFuses: score(SuspensePillar.LIT_FUSE, 8),
    overallScore: 80,
    suspenseLevel: 'HIGH',
    suspenseCurve: [],
    ...overrides,
  };
}

describe('SuspenseAnalyzer additional branch coverage', () => {
  it('covers suspense level threshold boundaries', () => {
    expect(computeSuspenseResult(
      score(SuspensePillar.STORY_QUESTION, 8.5),
      score(SuspensePillar.THREAT_SITUATION, 8.5),
      score(SuspensePillar.LIT_FUSE, 8.5),
    ).suspenseLevel).toBe('GRIPPING');

    expect(computeSuspenseResult(
      score(SuspensePillar.STORY_QUESTION, 5),
      score(SuspensePillar.THREAT_SITUATION, 5),
      score(SuspensePillar.LIT_FUSE, 5),
    ).suspenseLevel).toBe('MODERATE');

    expect(computeSuspenseResult(
      score(SuspensePillar.STORY_QUESTION, 4.9),
      score(SuspensePillar.THREAT_SITUATION, 4.9),
      score(SuspensePillar.LIT_FUSE, 4.9),
    ).suspenseLevel).toBe('LOW');
  });

  it('maps direct LLM empty responses with default arrays', async () => {
    const llmClient = {
      generateJson: vi.fn(async () => ({})),
    };
    const analyzer = new SuspenseAnalyzer(llmClient as never);

    await expect(analyzer.detectStoryQuestions('content')).resolves.toMatchObject({
      pillar: SuspensePillar.STORY_QUESTION,
      elements: [],
      issues: [],
      suggestions: [],
    });
    await expect(analyzer.analyzeThreatSituations('content', {})).resolves.toMatchObject({
      pillar: SuspensePillar.THREAT_SITUATION,
      elements: [],
      issues: [],
      suggestions: [],
    });
    await expect(analyzer.findLitFuses('content')).resolves.toMatchObject({
      pillar: SuspensePillar.LIT_FUSE,
      elements: [],
      issues: [],
      suggestions: [],
    });
  });

  it('aggregates enhancement suggestions from weak pillars and optional analyses', () => {
    const analyzer = new SuspenseAnalyzer();
    const suggestions = analyzer.suggestSuspenseEnhancement(baseResult({
      storyQuestions: score(SuspensePillar.STORY_QUESTION, 5, ['story fix']),
      threatSituations: score(SuspensePillar.THREAT_SITUATION, 5, ['threat fix']),
      litFuses: score(SuspensePillar.LIT_FUSE, 5, ['fuse fix']),
      threeAct: {
        beats: [],
        act1Score: 0,
        act2Score: 0,
        act3Score: 0,
        overallStructureScore: 0,
        missingBeats: [],
        suggestions: ['three act fix'],
      },
      satisfactionDensity: {
        points: [],
        density: 1.4,
        averageInterval: 0,
        balanceScore: 0,
        suggestions: [],
      },
    }));

    expect(suggestions).toEqual(expect.arrayContaining([
      'story fix',
      'threat fix',
      'fuse fix',
      'three act fix',
    ]));
    expect(suggestions.some((item) => item.includes('1000'))).toBe(true);
    expect(analyzer.suggestSuspenseEnhancement(baseResult())).toEqual([]);
  });

  it('covers setup-payoff empty, unresolved, and wide interval branches', () => {
    const analyzer = new SuspenseAnalyzer();

    expect(analyzer.detectSetupPayoffCycles([])).toMatchObject({
      cycles: [],
      unresolvedCount: 0,
      averageSetupToPayoff: 0,
      cycleScore: 0,
      suggestions: [],
    });

    const unresolved = analyzer.detectSetupPayoffCycles([
      { content: '\u79d8\u5bc6 \u8c1c\u56e2', position: 0.05 },
      { content: '\u5947\u602a \u7591\u70b9', position: 0.1 },
      { content: '\u5371\u9669 \u903c\u8fd1', position: 0.2 },
      { content: '\u66f4\u52a0 \u5347\u7ea7', position: 0.3 },
    ]);
    expect(unresolved.unresolvedCount).toBe(4);
    expect(unresolved.cycleScore).toBe(0);
    expect(unresolved.suggestions.length).toBeGreaterThanOrEqual(2);

    const wide = analyzer.detectSetupPayoffCycles([
      { content: '\u79d8\u5bc6', position: 0.05 },
      { content: '\u771f\u76f8 \u7ec8\u4e8e\u660e\u767d', position: 0.9 },
    ]);
    expect(wide.averageSetupToPayoff).toBeGreaterThan(30);
    expect(wide.cycleScore).toBeGreaterThan(0);
    expect(wide.suggestions.some((item) => item.includes('\u95f4\u9694'))).toBe(true);
  });

  it('covers satisfaction-density empty and setup-heavy branches', () => {
    const analyzer = new SuspenseAnalyzer();

    const empty = analyzer.analyzeSatisfactionDensity('');
    expect(empty).toMatchObject({
      points: [],
      density: 0,
      averageInterval: 0,
      balanceScore: 0,
    });
    expect(empty.suggestions[0]).toContain('\u6781\u4f4e');

    const setupHeavy = analyzer.analyzeSatisfactionDensity(
      `${'\u771f\u76f8'}${'x'.repeat(1200)}${'\u79d8\u5bc6 \u9690\u85cf \u4f20\u8bf4'}`,
    );
    expect(setupHeavy.points.length).toBeGreaterThan(1);
    expect(setupHeavy.averageInterval).toBeGreaterThan(0);
    expect(setupHeavy.suggestions.some((item) => item.includes('\u94fa\u57ab'))).toBe(true);
  });

  it('covers unknown subgenre and genre template branches', () => {
    const analyzer = new SuspenseAnalyzer();

    expect(analyzer.checkSubgenreRules([], 'unknown' as SuspenseSubgenre)).toEqual({
      violations: [],
      suggestions: ['\u672a\u77e5\u6d41\u6d3e'],
      ruleScore: 0,
    });

    expect(analyzer.analyzeGenreBeats([], 'unknown' as GenreBeatType)).toMatchObject({
      genreType: 'unknown',
      label: '\u672a\u77e5\u7c7b\u578b',
      alignments: [],
      overallAlignmentScore: 0,
      missingBeats: [],
      suggestions: ['\u672a\u627e\u5230\u8be5\u7c7b\u578b\u7684\u8282\u62cd\u6a21\u677f'],
    });
  });

  it('covers narrative technique and position-only beat fallbacks', () => {
    const analyzer = new SuspenseAnalyzer();

    const emptyTechniques = analyzer.detectNarrativeTechniques([]);
    expect(emptyTechniques.techniqueDensity).toBe(0);
    expect(emptyTechniques.overallScore).toBe(0);
    expect(emptyTechniques.recommendations.length).toBeGreaterThan(1);

    const genre = analyzer.analyzeGenreBeats(
      [{ content: 'plain beat placeholder', position: 0.01 }],
      GenreBeatType.MONSTER_IN_THE_HOUSE,
    );
    expect(genre.alignments[0]).toMatchObject({
      actualPosition: 0.01,
      aligned: true,
      evidence: '',
      deviation: 0,
    });

    const edson = analyzer.analyzeEdsonSequence([
      { content: 'plain sequence placeholder', position: 0.01 },
    ]);
    expect(edson.alignments[0]).toMatchObject({
      actualPosition: 0.01,
      aligned: true,
      evidence: '',
      deviation: 0,
    });
  });
});
