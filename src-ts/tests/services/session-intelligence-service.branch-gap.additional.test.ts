import { beforeEach, describe, expect, it, vi } from 'vitest';

const { analyzeMock, clusterSessionsMock, closeMock, logInfoMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  clusterSessionsMock: vi.fn(),
  closeMock: vi.fn(),
  logInfoMock: vi.fn(),
}));

vi.mock('../../analysis/writing-session-intelligence-core', () => ({
  analyzeWritingSessionIntelligenceCore: analyzeMock,
}));

vi.mock('../../analysis/writing-session-cluster', () => ({
  createWritingSessionCluster: vi.fn(() => ({
    clusterSessions: clusterSessionsMock,
    close: closeMock,
  })),
}));

vi.mock('../../logger/index', () => ({
  createLogger: vi.fn(() => ({
    info: logInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { SessionIntelligenceServiceImpl } from '../../services/session-intelligence-service';

function makeTelemetry(sessionId: string) {
  return {
    sessionId,
    chapterId: 'ch-1',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    eventCount: 10,
    activeMinutes: 30,
    saveCount: 2,
    historyPanelOpenCount: 1,
    rewriteCount: 3,
    jumpEditCount: 0,
    recentActions: ['edit', 'save'],
    characterFocus: ['Alice'],
    keywordFocus: ['dialogue'],
  };
}

function makeVolatileInsight(stableAccessCount: number) {
  let accessCount = 0;

  return {
    get pattern() {
      accessCount += 1;
      return accessCount <= stableAccessCount ? 'rewrite_loop' : 'drifted_pattern';
    },
    confidence: 0.85,
    summary: 'High rewrite frequency.',
    suggestion: 'Freeze paragraph and note revision points.',
  };
}

describe('SessionIntelligenceServiceImpl branch-gap coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clusterSessionsMock.mockReturnValue([
      { id: 'cluster-1', name: 'Similar Sessions', members: [] },
    ]);
  });

  it('initializes only once when called repeatedly', async () => {
    const service = new SessionIntelligenceServiceImpl();

    await service.initialize();
    await service.initialize();

    expect(logInfoMock).toHaveBeenCalledTimes(1);
    expect(await service.healthCheck()).toBe(true);
  });

  it('falls back when extracted patterns drift before lookup', async () => {
    analyzeMock.mockImplementation(() => ({
      insights: [makeVolatileInsight(1)],
    }));

    const service = new SessionIntelligenceServiceImpl();
    await service.initialize();
    service.recordTelemetry(makeTelemetry('session-1'));
    service.recordTelemetry(makeTelemetry('session-2'));

    expect(service.minePatterns()).toEqual([
      {
        patternType: 'rewrite_loop',
        description: 'Detected rewrite_loop pattern across sessions',
        affectedSessions: 0,
        confidence: 0,
        recommendations: [],
        relatedPatterns: [],
      },
    ]);
  });

  it('defaults confidence and recommendations when matches lose the pattern later', async () => {
    analyzeMock.mockImplementation(() => ({
      insights: [makeVolatileInsight(4)],
    }));

    const service = new SessionIntelligenceServiceImpl();
    await service.initialize();
    service.recordTelemetry(makeTelemetry('session-1'));
    service.recordTelemetry(makeTelemetry('session-2'));

    expect(service.minePatterns()).toEqual([
      {
        patternType: 'rewrite_loop',
        description: 'Detected rewrite_loop pattern across sessions',
        affectedSessions: 2,
        confidence: 0.425,
        recommendations: [],
        relatedPatterns: [],
      },
    ]);
  });
});
