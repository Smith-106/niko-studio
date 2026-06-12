import { describe, expect, it, vi } from 'vitest';

import {
  buildPersonalizedCraftProfile,
  type PersonalizedCraftProfileInput,
} from '../../analysis/personalized-craft-profile.js';

function buildInput(): PersonalizedCraftProfileInput {
  return {
    revisionSessions: [
      {
        chapterId: 'ch-1',
        iterations: [
          {
            weakPoints: [
              {
                dimensionId: 'clarity',
                baselineScore: 4.12,
                evidence: ['句子过长', '段落转折弱'],
              },
              {
                dimensionId: 'pacing',
                baselineScore: 5.41,
                evidence: ['推进偏慢'],
              },
            ],
            suggestions: [
              {
                sourceDimensionId: 'clarity',
                rationale: '先拆长句',
                expectedOutcome: '阅读阻力下降',
                strategy: '逐段拆分',
              },
            ],
            comparison: {
              iterationNumber: 1,
              resultScores: {
                clarity: 4.8,
                pacing: 5.2,
              },
              delta: {
                clarity: 0.68,
                pacing: -0.21,
              },
            },
          },
        ],
        lastComparison: {
          iterationNumber: 1,
          resultScores: {
            clarity: 4.8,
            pacing: 5.2,
          },
          delta: {
            clarity: 0.68,
            pacing: -0.21,
          },
        },
      },
      {
        chapterId: 'ch-2',
        iterations: [
          {
            weakPoints: [
              {
                dimensionId: 'clarity',
                baselineScore: 3.78,
                evidence: ['措辞重复', '主语漂移'],
              },
            ],
            suggestions: [
              {
                sourceDimensionId: 'clarity',
                rationale: '',
                expectedOutcome: '指代更稳定',
                strategy: '统一视角',
              },
            ],
            comparison: {
              iterationNumber: 2,
              resultScores: {
                clarity: 5.6,
              },
              delta: {
                clarity: 0.8,
              },
            },
          },
        ],
        lastComparison: {
          iterationNumber: 2,
          resultScores: {
            clarity: 5.6,
          },
          delta: {
            clarity: 0.8,
          },
        },
      },
    ],
    sessionIntelligence: [
      {
        telemetry: {
          sessionId: 'session-1',
          chapterId: 'ch-2',
          startedAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:30:00.000Z',
          eventCount: 12,
          activeMinutes: 30,
          saveCount: 0,
          historyPanelOpenCount: 2,
          rewriteCount: 1,
          jumpEditCount: 0,
          recentActions: ['draft', 'pause', 'outline'],
          characterFocus: ['Alice'],
          keywordFocus: ['artifact'],
        },
        insights: [
          {
            pattern: 'stalling',
            confidence: 0.72,
            summary: '本轮写作停滞。',
            suggestion: '先设定一个最小段落目标。',
          },
        ],
      },
      {
        telemetry: {
          sessionId: 'session-2',
          chapterId: 'ch-3',
          startedAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:50:00.000Z',
          eventCount: 20,
          activeMinutes: 50,
          saveCount: 2,
          historyPanelOpenCount: 1,
          rewriteCount: 2,
          jumpEditCount: 0,
          recentActions: ['edit', 'save'],
          characterFocus: ['Bob'],
          keywordFocus: ['gate'],
        },
        insights: [
          {
            pattern: 'fatigue_risk',
            confidence: 0.68,
            summary: '本轮有疲劳风险。',
            suggestion: '先休息后再继续。',
          },
        ],
      },
    ],
    preferenceProfile: {
      pacing: { accept: 1, reject: 3, modify: 2, avgValue: 0.335 },
      clarity: { accept: 4, reject: 0, modify: 1, avgValue: 0.876 },
    },
  };
}

describe('analysis/personalized-craft-profile', () => {
  it('returns an insufficient profile for empty signals', () => {
    const fixedNow = new Date('2026-06-04T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const profile = buildPersonalizedCraftProfile({});

    expect(profile).toMatchObject({
      profileId: `personalized-craft-${fixedNow.getTime()}`,
      generatedAt: '2026-06-04T10:00:00.000Z',
      dominantWeaknesses: [],
      preferenceProfile: [],
      recommendations: [],
      dataCompleteness: 'insufficient',
    });
    expect(profile.growthTrajectory).toMatchObject({
      overallTrend: 'stable',
      points: [],
    });
    expect(profile.growthTrajectory.summary.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('aggregates weaknesses, preferences, growth, and recommendations from all signal sources', () => {
    const fixedNow = new Date('2026-06-04T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const profile = buildPersonalizedCraftProfile(buildInput());

    expect(profile.profileId).toBe(`personalized-craft-${fixedNow.getTime()}`);
    expect(profile.generatedAt).toBe('2026-06-04T10:00:00.000Z');
    expect(profile.dataCompleteness).toBe('sufficient');

    expect(profile.dominantWeaknesses[0]).toMatchObject({
      dimensionId: 'clarity',
      occurrences: 2,
      averageBaselineScore: 3.95,
      latestDelta: 0.8,
      latestStatus: 'improving',
      supportingEvidence: ['句子过长', '段落转折弱', '先拆长句', '措辞重复'],
    });
    expect(profile.dominantWeaknesses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionId: 'pacing',
          latestStatus: 'declining',
          latestDelta: -0.21,
        }),
      ]),
    );

    expect(profile.preferenceProfile.map((item) => item.dimension)).toEqual([
      'pacing',
      'clarity',
    ]);
    expect(profile.preferenceProfile[0]).toMatchObject({
      modify: 2,
      reject: 3,
      avgValue: 0.34,
    });

    expect(profile.growthTrajectory).toMatchObject({
      overallTrend: 'improving',
      points: [
        { label: 'ch-1#1', score: 5, trend: 'flat' },
        { label: 'ch-2#2', score: 5.6, trend: 'up' },
        { label: 'ch-2:session-1', score: 6.4, trend: 'flat' },
        { label: 'ch-3:session-2', score: 6.6, trend: 'flat' },
      ],
    });
    expect(profile.growthTrajectory.summary.length).toBeGreaterThan(0);

    expect(profile.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'personalized-craft-clarity',
          source: 'revision',
          confidence: 0.4,
        }),
        expect.objectContaining({
          id: 'preference-pacing',
          source: 'preference',
          dimensionId: 'pacing',
        }),
        expect.objectContaining({
          id: 'session-session-1',
          source: 'session',
          dimensionId: 'stalling',
          evidence: ['先设定一个最小段落目标。', 'pause', 'outline'],
        }),
      ]),
    );
    expect(profile.recommendations).toHaveLength(5);

    vi.useRealTimers();
  });

  it('caps recommendations to five items and upgrades completeness when six or more signals exist', () => {
    const input = buildInput();
    input.revisionSessions?.push({
      chapterId: 'ch-3',
      iterations: [
        {
          weakPoints: [
            {
              dimensionId: 'dialogue',
              baselineScore: 4.2,
              evidence: ['对白太平'],
            },
          ],
          suggestions: [],
        },
      ],
      lastComparison: {
        iterationNumber: 1,
        resultScores: {
          dialogue: 4.2,
        },
        delta: {
          dialogue: 0,
        },
      },
    });
    input.preferenceProfile = {
      ...input.preferenceProfile,
      dialogue: { accept: 0, reject: 2, modify: 2, avgValue: 0.4 },
    };

    const profile = buildPersonalizedCraftProfile(input);

    expect(profile.dataCompleteness).toBe('sufficient');
    expect(profile.recommendations).toHaveLength(5);
  });

  it('marks partial completeness and declining growth while keeping delta-only dimensions', () => {
    const fixedNow = new Date('2026-06-04T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const profile = buildPersonalizedCraftProfile({
      revisionSessions: [
        {
          chapterId: 'ch-a',
          iterations: [
            {
              weakPoints: [
                {
                  dimensionId: 'clarity',
                  baselineScore: 4.5,
                  evidence: ['句子偏长'],
                },
              ],
              suggestions: [
                {
                  sourceDimensionId: 'imagery',
                  rationale: '',
                  expectedOutcome: '画面更具体',
                  strategy: '补充环境细节',
                },
              ],
              comparison: {
                iterationNumber: 1,
                resultScores: {
                  clarity: 6,
                },
                delta: {
                  clarity: 0.1,
                  imagery: -0.4,
                },
              },
            },
          ],
          lastComparison: {
            iterationNumber: 1,
            resultScores: {
              clarity: 6,
            },
            delta: {
              clarity: 0.1,
              imagery: -0.4,
            },
          },
        },
        {
          chapterId: 'ch-b',
          iterations: [
            {
              weakPoints: [
                {
                  dimensionId: 'clarity',
                  baselineScore: 4.2,
                  evidence: ['转折发硬'],
                },
              ],
              suggestions: [],
              comparison: {
                iterationNumber: 2,
                resultScores: {
                  clarity: 5.5,
                },
                delta: {
                  clarity: -0.3,
                },
              },
            },
          ],
          lastComparison: {
            iterationNumber: 2,
            resultScores: {
              clarity: 5.5,
            },
            delta: {
              clarity: -0.3,
            },
          },
        },
        {
          chapterId: 'ch-c',
          iterations: [
            {
              weakPoints: [
                {
                  dimensionId: 'clarity',
                  baselineScore: 4.1,
                  evidence: ['信息略重复'],
                },
              ],
              suggestions: [],
              comparison: {
                iterationNumber: 3,
                resultScores: {
                  clarity: 5.45,
                },
                delta: {
                  clarity: -0.05,
                },
              },
            },
          ],
          lastComparison: {
            iterationNumber: 3,
            resultScores: {
              clarity: 5.45,
            },
            delta: {
              clarity: -0.05,
            },
          },
        },
      ],
    });

    expect(profile.dataCompleteness).toBe('partial');
    expect(profile.growthTrajectory.overallTrend).toBe('declining');
    expect(profile.growthTrajectory.points).toEqual([
      { label: 'ch-a#1', score: 6, trend: 'flat' },
      { label: 'ch-b#2', score: 5.5, trend: 'down' },
      { label: 'ch-c#3', score: 5.45, trend: 'flat' },
    ]);
    expect(profile.growthTrajectory.summary.length).toBeGreaterThan(0);
    expect(profile.dominantWeaknesses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionId: 'imagery',
          occurrences: 0,
          latestDelta: -0.4,
          latestStatus: 'declining',
          supportingEvidence: ['画面更具体'],
        }),
      ]),
    );

    vi.useRealTimers();
  });
});
