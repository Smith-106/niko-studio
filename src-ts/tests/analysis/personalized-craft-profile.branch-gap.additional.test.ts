import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPersonalizedCraftProfile } from '../../analysis/personalized-craft-profile.js';

describe('analysis/personalized-craft-profile branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers fallback branches for sparse comparisons, session signals, and skipped preferences', () => {
    const originalGet = Map.prototype.get;
    let injectedHole = false;
    vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
    ) {
      if (!injectedHole && key === 'hole-delta') {
        injectedHole = true;
        return {
          baselines: [],
          deltas: new Array(1),
          evidence: [],
          occurrences: 0,
        };
      }
      return originalGet.call(this, key);
    });

    const profile = buildPersonalizedCraftProfile({
      revisionSessions: [
        {
          chapterId: 'ch-gap',
          iterations: [
            {
              weakPoints: [
                {
                  dimensionId: 'hole-delta',
                  baselineScore: 4.4,
                  evidence: ['missing delta falls back'],
                },
              ],
              suggestions: [],
            },
            {
              weakPoints: [
                {
                  dimensionId: 'no-compare',
                  baselineScore: 4.1,
                  evidence: ['no comparison branch'],
                },
              ],
              suggestions: [],
            },
            {
              weakPoints: [],
              suggestions: [
                {
                  sourceDimensionId: 'strategy-only',
                  rationale: '',
                  expectedOutcome: '',
                  strategy: 'fallback-strategy',
                },
              ],
              comparison: {
                iterationNumber: 1,
                resultScores: {},
                delta: {
                  glitch: 0.5,
                  'strategy-only': 'invalid' as unknown as number,
                },
              },
            },
          ],
          lastComparison: undefined,
        },
      ],
      sessionIntelligence: [
        {
          telemetry: {
            sessionId: 'steady-session',
            chapterId: 'ch-steady',
            startedAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:05:00.000Z',
            eventCount: 1,
            activeMinutes: 5,
            saveCount: 0,
            historyPanelOpenCount: 0,
            rewriteCount: 0,
            jumpEditCount: 0,
            recentActions: ['draft'],
            characterFocus: [],
            keywordFocus: [],
          },
          insights: [
            {
              pattern: 'steady_progress',
              confidence: 0.4,
              summary: 'steady',
              suggestion: 'keep going',
            },
          ],
        },
        {
          telemetry: {
            sessionId: 'fatigue-session',
            chapterId: undefined,
            startedAt: '2026-05-01T00:10:00.000Z',
            updatedAt: '2026-05-01T00:20:00.000Z',
            eventCount: 2,
            activeMinutes: 10,
            saveCount: 0,
            historyPanelOpenCount: 0,
            rewriteCount: 0,
            jumpEditCount: 0,
            recentActions: ['pause'],
            characterFocus: [],
            keywordFocus: [],
          },
          insights: [
            {
              pattern: 'fatigue_risk',
              confidence: 0.6,
              summary: 'fatigue',
              suggestion: 'rest',
            },
          ],
        },
      ],
      preferenceProfile: {
        calm: { accept: 2, reject: 0, modify: 0, avgValue: 0.4 },
      },
    });

    expect(profile.dataCompleteness).toBe('partial');
    expect(profile.growthTrajectory.points).toEqual([
      { label: 'session:fatigue-session', score: 7, trend: 'flat' },
    ]);
    expect(profile.preferenceProfile).toEqual([
      expect.objectContaining({
        dimension: 'calm',
        reject: 0,
        modify: 0,
      }),
    ]);
    expect(profile.dominantWeaknesses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionId: 'hole-delta',
          latestDelta: 0,
          latestStatus: 'stable',
        }),
        expect.objectContaining({
          dimensionId: 'glitch',
          latestDelta: 0.5,
          latestStatus: 'improving',
        }),
        expect.objectContaining({
          dimensionId: 'strategy-only',
          latestDelta: 0,
          supportingEvidence: ['fallback-strategy'],
        }),
      ]),
    );
    expect(profile.recommendations.some((item) => item.id === 'preference-calm')).toBe(false);
  });
});
