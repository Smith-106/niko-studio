import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BrainstormRole,
  Level4Brainstorm,
  getRoleDisplayName,
  getRolePerspective,
  type RoleAnalysis,
} from '../../workflow/levels/level4-brainstorm.js';

function makeAnalysis(role: BrainstormRole, overrides: Partial<RoleAnalysis> = {}): RoleAnalysis {
  return {
    role,
    analysisContent: 'analysis',
    keyPoints: [],
    recommendations: [],
    concerns: [],
    score: 80,
    metadata: {},
    ...overrides,
  };
}

describe('workflow/level4-brainstorm branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back for unknown brainstorm role helpers', () => {
    expect(getRoleDisplayName('unknown-role' as BrainstormRole)).toBe('unknown-role');
    expect(getRolePerspective('unknown-role' as BrainstormRole)).not.toBe('');
  });

  it('uses empty request and context defaults plus fallback verification score', async () => {
    const brainstorm = new Level4Brainstorm();
    vi.spyOn(brainstorm, 'generateArtifactsAsync').mockResolvedValue([
      makeAnalysis(BrainstormRole.PRODUCT_MANAGER),
    ]);
    vi.spyOn(brainstorm, 'synthesize').mockReturnValue({
      summary: 'summary',
      consensusPoints: [],
      divergentPoints: [],
      prioritizedRecommendations: [],
      riskAssessment: 'low',
      nextSteps: [],
      confidenceScore: 50,
    });
    vi.spyOn(brainstorm, 'generateSpecification').mockReturnValue({
      title: 'spec',
      objective: 'objective',
      scope: 'scope',
      guidelines: ['g1', 'g2'],
      constraints: [],
      successCriteria: ['done'],
      qualityStandards: ['quality'],
      deliverables: ['artifact'],
    });
    vi.spyOn(brainstorm as never, '_verifySpecification' as never).mockReturnValue({
      valid: true,
      score: undefined,
      issues: [],
      suggestions: [],
    });

    const result = await brainstorm.execute({} as never);

    expect(brainstorm.generateArtifactsAsync).toHaveBeenCalledWith('', expect.any(Array), '');
    expect(result.score).toBe(85);
    expect(result.decision).toBe('APPROVED');
  });

  it('routes non-passing verification to HUMAN_REVIEW', async () => {
    const brainstorm = new Level4Brainstorm();
    vi.spyOn(brainstorm, 'generateArtifactsAsync').mockResolvedValue([
      makeAnalysis(BrainstormRole.PRODUCT_MANAGER),
    ]);
    vi.spyOn(brainstorm, 'synthesize').mockReturnValue({
      summary: 'summary',
      consensusPoints: [],
      divergentPoints: [],
      prioritizedRecommendations: [],
      riskAssessment: 'low',
      nextSteps: [],
      confidenceScore: 40,
    });
    vi.spyOn(brainstorm, 'generateSpecification').mockReturnValue({
      title: 'spec',
      objective: 'objective',
      scope: 'scope',
      guidelines: ['g1', 'g2'],
      constraints: [],
      successCriteria: ['done'],
      qualityStandards: ['quality'],
      deliverables: ['artifact'],
    });
    vi.spyOn(brainstorm as never, '_verifySpecification' as never).mockReturnValue({
      valid: false,
      score: 70,
      issues: ['needs review'],
      suggestions: ['review it'],
    });

    const result = await brainstorm.execute({ errors: [] } as never);

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect(result.score).toBe(70);
  });

  it('stringifies execute failures and initializes the errors array when absent', async () => {
    const brainstorm = new Level4Brainstorm();
    vi.spyOn(brainstorm, 'generateArtifactsAsync').mockRejectedValue('string boom');

    const result = await brainstorm.execute({} as never);

    expect(result.decision).toBe('FAILED');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('string boom');
  });

  it('stringifies sync artifact failures that are thrown as plain strings', () => {
    const brainstorm = new Level4Brainstorm();
    vi.spyOn(brainstorm as never, '_analyzeAsRole' as never).mockImplementation(() => {
      throw 'sync string failure';
    });

    const analyses = brainstorm.generateArtifacts('topic', [BrainstormRole.PRODUCT_MANAGER]);

    expect(analyses[0]?.score).toBe(0);
    expect(analyses[0]?.analysisContent).toContain('sync string failure');
  });

  it('returns zero-score sync analyses when writer.run omits content', () => {
    const brainstorm = new Level4Brainstorm(
      {},
      {
        getAgent() {
          return {
            run() {
              return {};
            },
          };
        },
      } as never,
    );

    const analysis = (brainstorm as any)._analyzeAsRole(
      BrainstormRole.PRODUCT_MANAGER,
      'topic',
      'context',
    ) as RoleAnalysis;

    expect(analysis.analysisContent).toBe('');
    expect(analysis.score).toBe(0);
  });

  it('stringifies sync role analysis failures thrown as plain strings', () => {
    const brainstorm = new Level4Brainstorm(
      {},
      {
        getAgent() {
          return {
            run() {
              throw 'writer sync string failure';
            },
          };
        },
      } as never,
    );

    const analysis = (brainstorm as any)._analyzeAsRole(
      BrainstormRole.PRODUCT_MANAGER,
      'topic',
      'context',
    ) as RoleAnalysis;

    expect(analysis.score).toBe(0);
    expect(analysis.analysisContent).toContain('writer sync string failure');
  });

  it('returns zero-score async analyses when generated objects omit content', async () => {
    const brainstorm = new Level4Brainstorm(
      {},
      {
        getAgent() {
          return {
            async generate() {
              return {};
            },
            run: vi.fn(),
          };
        },
      } as never,
    );

    const analysis = (await (brainstorm as any)._analyzeAsRoleAsync(
      BrainstormRole.PRODUCT_MANAGER,
      'topic',
      'context',
    )) as RoleAnalysis;

    expect(analysis.analysisContent).toBe('');
    expect(analysis.score).toBe(0);
  });

  it('uses raw string content returned by writer.generate', async () => {
    const brainstorm = new Level4Brainstorm(
      {},
      {
        getAgent() {
          return {
            async generate() {
              return 'raw generated content';
            },
            run: vi.fn(),
          };
        },
      } as never,
    );
    const parseSpy = vi
      .spyOn(brainstorm as never, '_parseAnalysisResult' as never)
      .mockReturnValue(makeAnalysis(BrainstormRole.PRODUCT_MANAGER, {
        analysisContent: 'parsed raw string',
      }));

    const analysis = (await (brainstorm as any)._analyzeAsRoleAsync(
      BrainstormRole.PRODUCT_MANAGER,
      'topic',
      'context',
    )) as RoleAnalysis;

    expect(parseSpy).toHaveBeenCalledWith(
      BrainstormRole.PRODUCT_MANAGER,
      'raw generated content',
    );
    expect(analysis.analysisContent).toBe('parsed raw string');
  });

  it('stringifies async role failures thrown as plain strings', async () => {
    const brainstorm = new Level4Brainstorm(
      {},
      {
        getAgent() {
          return {
            async generate() {
              throw 'writer async string failure';
            },
            run: vi.fn(),
          };
        },
      } as never,
    );

    const analysis = (await (brainstorm as any)._analyzeAsRoleAsync(
      BrainstormRole.PRODUCT_MANAGER,
      'topic',
      'context',
    )) as RoleAnalysis;

    expect(analysis.score).toBe(0);
    expect(analysis.analysisContent).toContain('writer async string failure');
  });

  it('covers direct empty-path helpers for consensus, recommendations, and risks', () => {
    const brainstorm = new Level4Brainstorm();

    expect((brainstorm as any)._findConsensus([])).toEqual([]);
    expect((brainstorm as any)._prioritizeRecommendations([], [])).toEqual([]);
    expect((brainstorm as any)._assessRisks([])).not.toBe('');
  });

  it('verifies specifications with missing guidelines explicitly', () => {
    const brainstorm = new Level4Brainstorm();

    const verification = (brainstorm as any)._verifySpecification({
      title: 'spec',
      objective: 'objective',
      scope: 'scope',
      guidelines: [],
      constraints: [],
      successCriteria: ['done'],
      qualityStandards: ['quality'],
      deliverables: ['artifact'],
    }) as {
      valid: boolean;
      score: number;
      issues: string[];
      suggestions: string[];
    };

    expect(verification.valid).toBe(false);
    expect(verification.issues).toHaveLength(2);
    expect(verification.issues.every((issue) => issue.length > 0)).toBe(true);
  });
});
