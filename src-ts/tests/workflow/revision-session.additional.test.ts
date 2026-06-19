import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  analyzeRevisionText,
  compareRevisionAnalyses,
  deriveWeakPoints,
  generateRevisionSuggestions,
  type RevisionAnalysisResult,
  type RevisionDimension,
  type RevisionDimensionReport,
  type WeakPoint,
} from '../../workflow/revision-session.js';

function report(
  dimensionId: RevisionDimension,
  score: number,
  evidence: string[] = [],
  suggestions: string[] = [],
): RevisionDimensionReport {
  return {
    dimensionId,
    label: `${dimensionId} label`,
    score,
    evidence,
    suggestions,
    readerImpact: `${dimensionId} impact`,
    catalogReference: `catalog:${dimensionId}`,
    details: {},
  };
}

function analysis(reports: RevisionDimensionReport[]): RevisionAnalysisResult {
  return {
    reports,
    scores: Object.fromEntries(
      reports.map((item) => [item.dimensionId, item.score]),
    ) as RevisionAnalysisResult['scores'],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../../narrative/writing-craft/catalog-loader.js');
  vi.doUnmock('../../narrative/premise-validator.js');
  vi.doUnmock('../../narrative/reader-immersion-engine.js');
  vi.doUnmock('../../narrative/writing-craft/hook-cliffhanger-scorer.js');
  vi.doUnmock('../../narrative/writing-craft/emotion-craft.js');
  vi.doUnmock('../../narrative/show-tell-analyzer.js');
});

describe('workflow/revision-session pure helpers', () => {
  it('derives weak points with direct, compact, and fallback locations', () => {
    const text = 'Opening beat appears here. AlphaBeta appears later.';
    const result = deriveWeakPoints(
      text,
      analysis([
        report('structure', 3.5, ['Opening beat'], ['Use stronger causality']),
        report('character', 5.5, ['Alpha;Beta'], []),
        report('dialogue', 6.5, [], []),
      ]),
      7,
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.severity)).toEqual([
      'critical',
      'major',
      'minor',
    ]);
    expect(result[0]?.location).toMatchObject({
      start: 0,
      excerpt: expect.stringContaining('Opening beat'),
    });
    expect(result[0]?.description).toBe('Use stronger causality');
    expect(result[1]?.location).toMatchObject({
      start: text.indexOf('AlphaBeta'),
      excerpt: expect.stringContaining('AlphaBeta'),
    });
    expect(result[1]?.description).toBe('Alpha;Beta');
    expect(result[2]?.location).toMatchObject({
      start: 0,
      end: Math.min(text.length, 120),
    });
    expect(result[2]?.description).toContain('dialogue label');
  });

  it('skips blank and punctuation-only fragments before falling back to default weak-point location', () => {
    const text = 'No matching fragments exist in this short text.';
    const result = deriveWeakPoints(
      text,
      analysis([
        report('structure', 3.5, ['   '], []),
        report('character', 5.5, ['：；。'], []),
      ]),
      7,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.location).toMatchObject({
      start: 0,
      end: Math.min(text.length, 120),
      excerpt: text,
    });
    expect(result[1]?.location).toMatchObject({
      start: 0,
      end: Math.min(text.length, 120),
      excerpt: text,
    });
  });

  it('generates suggestions from report, catalog, and severity fallbacks', () => {
    const weakPoints: WeakPoint[] = [
      {
        id: 'weak-1',
        dimensionId: 'structure',
        location: { start: 0, end: 4, excerpt: 'text' },
        severity: 'critical',
        description: 'needs structure',
        readerImpact: 'structure impact',
        baselineScore: 3,
        evidence: [],
        catalogReference: '',
      },
      {
        id: 'weak-2',
        dimensionId: 'show_tell',
        location: { start: 0, end: 4, excerpt: 'text' },
        severity: 'major',
        description: 'needs showing',
        readerImpact: 'show impact',
        baselineScore: 5,
        evidence: [],
        catalogReference: 'custom:show',
      },
      {
        id: 'weak-3',
        dimensionId: 'hook',
        location: { start: 0, end: 4, excerpt: 'text' },
        severity: 'minor',
        description: 'needs hook',
        readerImpact: 'hook impact',
        baselineScore: 6,
        evidence: [],
        catalogReference: '',
      },
    ];

    const suggestions = generateRevisionSuggestions(
      weakPoints,
      analysis([report('structure', 3, [], ['Use a sharper midpoint'])]),
    );

    expect(suggestions[0]).toMatchObject({
      weakPointId: 'weak-1',
      strategy: 'Use a sharper midpoint',
      priority: 'high',
    });
    expect(suggestions[1]).toMatchObject({
      weakPointId: 'weak-2',
      catalogReference: 'custom:show',
      priority: 'medium',
    });
    expect(suggestions[2]).toMatchObject({
      weakPointId: 'weak-3',
      priority: 'low',
    });
  });

  it('compares improved, regressed, unchanged, and no-change revisions', () => {
    const comparison = compareRevisionAnalyses({
      sessionId: 'session-1',
      iterationNumber: 2,
      baseline: analysis([
        report('structure', 5),
        report('character', 6),
        report('suspense', 7),
      ]),
      revised: analysis([
        report('structure', 5.3),
        report('character', 5.7),
        report('suspense', 7.1),
      ]),
    });

    expect(comparison.delta).toMatchObject({
      structure: 0.3,
      character: -0.3,
      suspense: 0.1,
    });
    expect(comparison.improvedDimensions).toEqual(['structure']);
    expect(comparison.regressedDimensions).toEqual(['character']);
    expect(comparison.unchangedDimensions).toEqual(['suspense']);
    expect(comparison.summary).toContain('structure');
    expect(comparison.summary).toContain('character');

    const unchangedOnly = compareRevisionAnalyses({
      sessionId: 'session-2',
      iterationNumber: 1,
      baseline: analysis([report('hook', 6)]),
      revised: analysis([report('hook', 6.1)]),
    });
    expect(unchangedOnly.summary).toContain('weak points');
  });

  it('analyzes webnovel dimensions with empty curve data', () => {
    const result = analyzeRevisionText('', ['webnovel']);

    expect(result.reports).toHaveLength(1);
    expect(result.scores.webnovel).toEqual(expect.any(Number));
  });

  it('falls back to zero scores and low-score guidance for structure, webnovel, hook, and cliffhanger', async () => {
    vi.resetModules();
    vi.doMock('../../narrative/premise-validator.js', () => ({
      assessOutlineQuality: () => ({
        overallQualityScore: Number.NaN,
        actionableSuggestions: [],
      }),
    }));
    vi.doMock('../../narrative/reader-immersion-engine.js', () => ({
      analyzeReaderImmersion: () => ({
        averageImmersion: 0,
        averageDropoutRisk: 1,
        trajectory: [],
        highRiskChapters: [],
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/hook-cliffhanger-scorer.js', () => ({
      scoreHook: () => ({
        overall: 20,
        evidence: [],
        dimensions: {},
      }),
      scoreCliffhanger: () => ({
        overall: 25,
        evidence: [],
        dimensions: {},
      }),
    }));

    const { CharacterDepthSystem } = await import('../../narrative/character-depth.js');
    const { SuspenseAnalyzer } = await import('../../narrative/suspense-analyzer.js');
    const { ReaderSatisfactionAnalyzer } = await import('../../narrative/reader-satisfaction-analyzer.js');

    vi.spyOn(CharacterDepthSystem.prototype, 'assessCharacterCreation').mockReturnValue({
      overallScore: 5,
      dimensions: [],
    } as never);
    vi.spyOn(CharacterDepthSystem.prototype, 'evaluatePlotCharacterBalance').mockReturnValue({
      overallScore: 5,
      weakPoints: [],
      suggestions: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeEdsonSequence').mockReturnValue({
      overallAlignmentScore: Number.NaN,
      missingBeats: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectAntiPatterns').mockReturnValue({
      overallHealthScore: 0,
      detections: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeThreeActStructure').mockReturnValue({
      overallStructureScore: -1,
      missingBeats: [],
    } as never);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'detectUpgradePattern').mockReturnValue([]);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'analyzeGoldenFinger').mockReturnValue([]);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'analyzeWebNovelCurve').mockReturnValue({
      curveData: [],
      suggestions: [],
    } as never);

    const module = await import('../../workflow/revision-session.js');
    const result = module.analyzeRevisionText('plain text', [
      'structure',
      'webnovel',
      'hook',
      'cliffhanger',
    ]);

    expect(result.scores.structure).toBe(0);
    expect(result.scores.webnovel).toBe(0);
    expect(result.reports.find((item) => item.dimensionId === 'hook')?.suggestions[0]).toContain('200');
    expect(result.reports.find((item) => item.dimensionId === 'cliffhanger')?.suggestions[0]).toBeTruthy();
  });

  it('falls back to zero scores for suspense and emotion when analyzers provide no positive finite signal', async () => {
    vi.resetModules();
    vi.doMock('../../narrative/writing-craft/emotion-craft.js', () => ({
      analyzeEmotionCraft: () => ({
        score: 0,
        detections: [],
        suggestions: [],
        showRatio: 0,
      }),
      analyzeEmotionLayers: () => ({
        layerDiversityScore: Number.NaN,
        overallRichness: 0,
      }),
      assessDescriptionQuality: () => ({
        overallScore: -1,
        dimensions: [],
        suggestions: [],
      }),
    }));

    const { SuspenseAnalyzer } = await import('../../narrative/suspense-analyzer.js');

    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTechniques').mockReturnValue({
      overallScore: 0,
      detections: [],
      recommendations: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTricks').mockReturnValue({
      overallTrickScore: Number.NaN,
      tricks: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeDeductionChain').mockReturnValue({
      chainScore: -1,
      suggestions: [],
    } as never);

    const module = await import('../../workflow/revision-session.js');
    const result = module.analyzeRevisionText('plain text', ['suspense', 'emotion']);

    expect(result.scores.suspense).toBe(0);
    expect(result.scores.emotion).toBe(0);
  });

  it('covers remaining dimension routes and catalog fallbacks with non-low-score analyzer outputs', async () => {
    vi.resetModules();
    vi.doMock('../../narrative/premise-validator.js', () => ({
      assessOutlineQuality: () => ({
        overallQualityScore: 5,
        actionableSuggestions: [],
      }),
    }));
    vi.doMock('../../narrative/reader-immersion-engine.js', () => ({
      analyzeReaderImmersion: () => ({
        averageImmersion: 0.5,
        averageDropoutRisk: 0.2,
        trajectory: [],
        highRiskChapters: [],
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/hook-cliffhanger-scorer.js', () => ({
      scoreHook: () => ({
        overall: 35,
        evidence: [],
        dimensions: {},
      }),
      scoreCliffhanger: () => ({
        overall: 40,
        evidence: [],
        dimensions: {},
      }),
    }));
    vi.doMock('../../narrative/writing-craft/emotion-craft.js', () => ({
      analyzeEmotionCraft: () => ({
        score: 80,
        detections: [],
        suggestions: [],
        showRatio: 0.6,
      }),
      analyzeEmotionLayers: () => ({
        layerDiversityScore: 7,
        overallRichness: 0.9,
      }),
      assessDescriptionQuality: () => ({
        overallScore: 6,
        dimensions: [],
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/show-tell-analyzer.js', () => ({
      analyzeShowTell: () => ({
        showTellRatio: 0.8,
        showCount: 4,
        tellCount: 1,
        sensoryCoverage: { overall: 0.75 },
        suggestions: [],
      }),
    }));
    vi.doMock(
      '../../narrative/writing-craft/catalog-loader.js',
      async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../narrative/writing-craft/catalog-loader.js')
        >();
        return {
          ...actual,
          getDialogueRules: () => ({
            mckeeThreeFunctions: { functions: [] },
            characterVoiceDifferentiation: { dimensions: [] },
            showDontTell: {
              goodPatterns: [],
              badPatterns: [],
            },
          }),
          getGenreBeats: () => ({
            noir: {},
          }),
          getNarrativePrinciples: () => ({}),
          getNarrativeTechniques: () => ({}),
          getStoryStructures: () => ({}),
          getWebNovelPsychology: () => ({
            retentionRules: [],
            chapterHooks: {},
          }),
        };
      },
    );

    const { CharacterDepthSystem } = await import('../../narrative/character-depth.js');
    const { DialogueAnalyzer } = await import('../../narrative/dialogue-analyzer.js');
    const { SuspenseAnalyzer } = await import('../../narrative/suspense-analyzer.js');
    const { ReaderSatisfactionAnalyzer } = await import('../../narrative/reader-satisfaction-analyzer.js');

    vi.spyOn(CharacterDepthSystem.prototype, 'assessCharacterCreation').mockReturnValue({
      overallScore: 6.2,
      dimensions: [{ dimension: 'arc', score: 6, evidence: ['arc evidence'] }],
      suggestions: [],
    } as never);
    vi.spyOn(CharacterDepthSystem.prototype, 'evaluatePlotCharacterBalance').mockReturnValue({
      balanceScore: 5.5,
    } as never);
    vi.spyOn(DialogueAnalyzer.prototype, 'analyzeDialogue').mockReturnValue({
      overallScore: 7,
      qualityScores: [],
      suggestions: [],
      subtextRatio: 0.4,
      voiceDistinctness: 0.5,
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeEdsonSequence').mockReturnValue({
      overallAlignmentScore: 0.8,
      missingBeats: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectAntiPatterns').mockReturnValue({
      overallHealthScore: 7,
      detections: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeThreeActStructure').mockReturnValue({
      overallStructureScore: 6,
      missingBeats: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTechniques').mockReturnValue({
      overallScore: 0.6,
      detections: [],
      recommendations: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTricks').mockReturnValue({
      overallTrickScore: 7,
      tricks: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeDeductionChain').mockReturnValue({
      chainScore: 8,
      suggestions: [],
    } as never);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'detectUpgradePattern').mockReturnValue([]);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'analyzeGoldenFinger').mockReturnValue([]);
    vi.spyOn(ReaderSatisfactionAnalyzer.prototype, 'analyzeWebNovelCurve').mockReturnValue({
      curveData: [{ hookStrength: 7 }],
      suggestions: [],
    } as never);

    const module = await import('../../workflow/revision-session.js');
    const result = module.analyzeRevisionText('plain text', [
      'structure',
      'character',
      'suspense',
      'emotion',
      'dialogue',
      'webnovel',
      'hook',
      'cliffhanger',
      'show_tell',
    ]);

    expect(result.reports).toHaveLength(9);
    expect(result.scores.structure).toBeGreaterThan(0);
    expect(result.scores.character).toBeGreaterThan(0);
    expect(result.scores.suspense).toBeGreaterThan(0);
    expect(result.scores.emotion).toBeGreaterThan(0);
    expect(result.scores.dialogue).toBeGreaterThan(0);
    expect(result.scores.webnovel).toBeGreaterThan(0);
    expect(result.reports.find((item) => item.dimensionId === 'hook')?.suggestions[0]).toContain('200');
    expect(result.reports.find((item) => item.dimensionId === 'cliffhanger')?.suggestions).toEqual([]);
    expect(result.reports.find((item) => item.dimensionId === 'show_tell')?.details).toMatchObject({
      showCount: 4,
      tellCount: 1,
    });
  });

  it('uses populated catalog hints and dialogue detail mapping for character, suspense, emotion, and dialogue', async () => {
    vi.resetModules();
    vi.doMock(
      '../../narrative/writing-craft/catalog-loader.js',
      async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../narrative/writing-craft/catalog-loader.js')
        >();
        return {
          ...actual,
          getDialogueRules: () => ({
            mckeeThreeFunctions: { functions: ['推进情节'] },
            characterVoiceDifferentiation: { dimensions: ['角色辨识'] },
            showDontTell: {
              goodPatterns: ['动作承载情绪'],
              badPatterns: ['直接说明情绪'],
            },
          }),
          getGenreBeats: () => ({
            noir: {
              beatSequence: [
                { name: 'Hook', description: 'Start with risk' },
              ],
            },
          }),
          getNarrativePrinciples: () => ({
            p1: { label: '原则一', description: '强化动机' },
            p2: { label: undefined, description: undefined },
          }),
          getNarrativeTechniques: () => ({
            t1: { label: '技巧一', description: '延迟信息释放' },
            t2: { label: undefined, description: undefined },
          }),
          getStoryStructures: () => ({
            s1: {
              beats: [{ name: 'Inciting', description: 'introduce conflict' }],
            },
          }),
          getWebNovelPsychology: () => ({
            retentionRules: ['keep tension'],
            chapterHooks: { one: 'end on threat' },
          }),
        };
      },
    );
    vi.doMock('../../narrative/writing-craft/emotion-craft.js', () => ({
      analyzeEmotionCraft: () => ({
        score: 80,
        detections: [],
        suggestions: [],
        showRatio: 0.6,
      }),
      analyzeEmotionLayers: () => ({
        layerDiversityScore: 7,
        overallRichness: 0.9,
      }),
      assessDescriptionQuality: () => ({
        overallScore: 6,
        dimensions: [],
        suggestions: [],
      }),
    }));

    const { CharacterDepthSystem } = await import('../../narrative/character-depth.js');
    const { DialogueAnalyzer } = await import('../../narrative/dialogue-analyzer.js');
    const { SuspenseAnalyzer } = await import('../../narrative/suspense-analyzer.js');

    vi.spyOn(CharacterDepthSystem.prototype, 'assessCharacterCreation').mockReturnValue({
      overallScore: 6.2,
      dimensions: [{ dimension: 'arc', score: 6, evidence: ['arc evidence'] }],
      suggestions: [],
    } as never);
    vi.spyOn(CharacterDepthSystem.prototype, 'evaluatePlotCharacterBalance').mockReturnValue({
      balanceScore: 5.5,
    } as never);
    vi.spyOn(DialogueAnalyzer.prototype, 'analyzeDialogue').mockReturnValue({
      overallScore: 7,
      qualityScores: [{ dimension: 'subtext', score: 8, evidence: ['dialogue evidence'] }],
      suggestions: [],
      subtextRatio: 0.4,
      voiceDistinctness: 0.5,
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTechniques').mockReturnValue({
      overallScore: 0.6,
      detections: [],
      recommendations: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'detectNarrativeTricks').mockReturnValue({
      overallTrickScore: 7,
      tricks: [],
    } as never);
    vi.spyOn(SuspenseAnalyzer.prototype, 'analyzeDeductionChain').mockReturnValue({
      chainScore: 8,
      suggestions: [],
    } as never);

    const module = await import('../../workflow/revision-session.js');
    const result = module.analyzeRevisionText('plain text', [
      'character',
      'suspense',
      'emotion',
      'dialogue',
    ]);

    expect(result.reports.find((item) => item.dimensionId === 'character')?.suggestions).toEqual(
      expect.arrayContaining(['原则一: 强化动机', '角色原则:']),
    );
    expect(result.reports.find((item) => item.dimensionId === 'suspense')?.suggestions).toEqual(
      expect.arrayContaining(['技巧一: 延迟信息释放', '叙事技巧:']),
    );
    expect(result.reports.find((item) => item.dimensionId === 'emotion')?.suggestions).toEqual(
      expect.arrayContaining(['原则一: 强化动机', '叙事原则:']),
    );
    expect(result.reports.find((item) => item.dimensionId === 'dialogue')?.suggestions).toEqual(
      expect.arrayContaining(['推进情节', '角色辨识']),
    );
    expect(result.reports.find((item) => item.dimensionId === 'dialogue')?.details).toMatchObject({
      dimensionScores: [{ dimension: 'subtext', score: 8 }],
    });
  });

  it('falls back to generated strategy when catalog hints are unavailable', async () => {
    vi.resetModules();
    vi.doMock(
      '../../narrative/writing-craft/catalog-loader.js',
      async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../narrative/writing-craft/catalog-loader.js')
        >();
        return {
          ...actual,
          getDialogueRules: () => ({
            mckeeThreeFunctions: { functions: [] },
            characterVoiceDifferentiation: { dimensions: [] },
            showDontTell: {
              goodPatterns: [],
              badPatterns: [],
            },
          }),
          getGenreBeats: () => ({}),
          getNarrativePrinciples: () => ({}),
          getNarrativeTechniques: () => ({}),
          getStoryStructures: () => ({}),
          getWebNovelPsychology: () => ({
            retentionRules: [],
            chapterHooks: {},
          }),
        };
      },
    );

    const module = await import('../../workflow/revision-session.js');
    const suggestions = module.generateRevisionSuggestions(
      [
        {
          id: 'weak-empty-catalog',
          dimensionId: 'show_tell',
          location: { start: 0, end: 0, excerpt: '' },
          severity: 'minor',
          description: 'empty catalog',
          readerImpact: 'impact',
          baselineScore: 6,
          evidence: [],
          catalogReference: '',
        },
      ],
      { reports: [], scores: {} },
    );

    expect(suggestions[0]?.strategy).toContain('show_tell');
  });

  it('uses the report label in generated strategy fallback when catalog hints are unavailable', async () => {
    vi.resetModules();
    vi.doMock(
      '../../narrative/writing-craft/catalog-loader.js',
      async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../narrative/writing-craft/catalog-loader.js')
        >();
        return {
          ...actual,
          getDialogueRules: () => ({
            mckeeThreeFunctions: { functions: [] },
            characterVoiceDifferentiation: { dimensions: [] },
            showDontTell: {
              goodPatterns: [],
              badPatterns: [],
            },
          }),
          getGenreBeats: () => ({}),
          getNarrativePrinciples: () => ({}),
          getNarrativeTechniques: () => ({}),
          getStoryStructures: () => ({}),
          getWebNovelPsychology: () => ({
            retentionRules: [],
            chapterHooks: {},
          }),
        };
      },
    );

    const module = await import('../../workflow/revision-session.js');
    const suggestions = module.generateRevisionSuggestions(
      [
        {
          id: 'weak-empty-report-label',
          dimensionId: 'show_tell',
          location: { start: 0, end: 0, excerpt: '' },
          severity: 'minor',
          description: 'empty catalog',
          readerImpact: 'impact',
          baselineScore: 6,
          evidence: [],
          catalogReference: '',
        },
      ],
      {
        reports: [
          {
            ...report('show_tell', 6),
            label: 'Show Label',
            suggestions: [],
          },
        ],
        scores: { show_tell: 6 },
      },
    );

    expect(suggestions[0]?.strategy).toContain('Show Label');
  });
});
