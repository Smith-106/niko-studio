import { afterEach, describe, expect, it, vi } from 'vitest';

const analyzeCoreMock = vi.hoisted(() =>
  vi.fn((telemetry) => ({
    telemetry,
    insights: [
      {
        pattern: 'steady_progress',
        confidence: 0.8,
        summary: '节奏稳定',
        suggestion: '保持推进',
      },
    ],
    clusterName: null,
  })),
);

const clusterSessionsMock = vi.hoisted(() =>
  vi.fn(() => [{ id: 'cluster-1', name: 'chapter-artifact' }]),
);

const closeMock = vi.hoisted(() => vi.fn());
const createClusterMock = vi.hoisted(() =>
  vi.fn(() => ({
    clusterSessions: clusterSessionsMock,
    close: closeMock,
  })),
);

vi.mock('../../analysis/writing-session-intelligence-core.js', () => ({
  analyzeWritingSessionIntelligenceCore: analyzeCoreMock,
}));

vi.mock('../../analysis/writing-session-cluster.js', () => ({
  createWritingSessionCluster: createClusterMock,
}));

describe('analysis/writing-session-intelligence', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds clustering input from telemetry and returns the detected cluster name', async () => {
    const { analyzeWritingSessionIntelligence } = await import(
      '../../analysis/writing-session-intelligence.js'
    );

    const telemetry = {
      sessionId: 'session-9',
      chapterId: 'chapter-3',
      startedAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:45:00.000Z',
      eventCount: 14,
      activeMinutes: 90,
      saveCount: 4,
      historyPanelOpenCount: 6,
      rewriteCount: 7,
      jumpEditCount: 2,
      recentActions: ['draft', 'revise'],
      characterFocus: ['Alice', 'Bob'],
      keywordFocus: ['artifact', 'gate'],
    };

    const result = analyzeWritingSessionIntelligence(telemetry);

    expect(analyzeCoreMock).toHaveBeenCalledWith(telemetry);
    expect(createClusterMock).toHaveBeenCalledWith(':memory:');
    expect(clusterSessionsMock).toHaveBeenCalledWith([
      {
        id: 'session-9',
        type: 'chapter',
        characters: ['Alice', 'Bob'],
        keywords: ['artifact', 'gate'],
        order: 14,
        relatedEntities: ['Alice', 'Bob'],
        styleVector: [1, 0.4, 0.7, 0.2, 0.6],
      },
    ]);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      telemetry,
      insights: [{ pattern: 'steady_progress' }],
      clusterName: 'chapter-artifact',
    });
  });

  it('falls back to a null cluster name when clustering fails', async () => {
    clusterSessionsMock.mockImplementationOnce(() => {
      throw new Error('cluster failed');
    });

    const { analyzeWritingSessionIntelligence } = await import(
      '../../analysis/writing-session-intelligence.js'
    );

    const result = analyzeWritingSessionIntelligence({
      sessionId: 'session-10',
      chapterId: null,
      startedAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:05:00.000Z',
      eventCount: 1,
      activeMinutes: 5,
      saveCount: 1,
      historyPanelOpenCount: 0,
      rewriteCount: 0,
      jumpEditCount: 0,
      recentActions: [],
      characterFocus: [],
      keywordFocus: [],
    });

    expect(result.clusterName).toBeNull();
  });

  it('returns a null cluster name when clustering yields no matches', async () => {
    clusterSessionsMock.mockImplementationOnce(() => []);

    const { analyzeWritingSessionIntelligence } = await import(
      '../../analysis/writing-session-intelligence.js'
    );

    const result = analyzeWritingSessionIntelligence({
      sessionId: 'session-11',
      chapterId: 'chapter-4',
      startedAt: '2026-06-01T01:00:00.000Z',
      updatedAt: '2026-06-01T01:10:00.000Z',
      eventCount: 2,
      activeMinutes: 10,
      saveCount: 1,
      historyPanelOpenCount: 0,
      rewriteCount: 0,
      jumpEditCount: 0,
      recentActions: ['draft'],
      characterFocus: ['Alice'],
      keywordFocus: ['artifact'],
    });

    expect(result.clusterName).toBeNull();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
