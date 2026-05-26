/**
 * Tests for SessionIntelligenceServiceImpl
 *
 * Covers: initialize, recordTelemetry, analyzeSession, minePatterns,
 * getRecordedSessions, getPatterns, getClusters, healthCheck, shutdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionIntelligenceServiceImpl } from '../../services/session-intelligence-service';

// Mock the analysis module to avoid real computation
vi.mock('../../analysis/writing-session-intelligence-core', () => ({
  analyzeWritingSessionIntelligenceCore: vi.fn().mockReturnValue({
    insights: [
      { pattern: 'rewrite_loop', confidence: 0.85, summary: 'High rewrite frequency.', suggestion: 'Freeze paragraph and note revision points.' },
      { pattern: 'stalling', confidence: 0.72, summary: 'Long session without stable output.', suggestion: 'Set a minimum paragraph goal.' },
    ],
  }),
}));

// Mock the cluster module (class-based, needs factory function)
vi.mock('../../analysis/writing-session-cluster', () => ({
  createWritingSessionCluster: vi.fn().mockReturnValue({
    clusterSessions: vi.fn().mockReturnValue([
      { id: 'cluster-1', name: 'Similar Sessions', members: [] },
    ]),
    close: vi.fn(),
  }),
}));

// Mock logger
vi.mock('../../logger/index', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

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

describe('SessionIntelligenceServiceImpl', () => {
  let service: SessionIntelligenceServiceImpl;

  beforeEach(async () => {
    service = new SessionIntelligenceServiceImpl();
    await service.initialize();
  });

  describe('initialize + healthCheck + shutdown', () => {
    it('initializes and reports healthy', async () => {
      expect(await service.healthCheck()).toBe(true);
    });

    it('reports unhealthy after shutdown', async () => {
      await service.shutdown();
      expect(await service.healthCheck()).toBe(false);
    });
  });

  describe('recordTelemetry', () => {
    it('records a telemetry event', () => {
      const event = makeTelemetry('session-1');
      service.recordTelemetry(event);
      const sessions = service.getRecordedSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe('session-1');
    });

    it('records multiple telemetry events', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      expect(service.getRecordedSessions().length).toBe(2);
    });
  });

  describe('analyzeSession', () => {
    it('returns insights for a telemetry event', () => {
      const telemetry = makeTelemetry('session-1');
      const insights = service.analyzeSession(telemetry);
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toHaveProperty('pattern');
      expect(insights[0]).toHaveProperty('confidence');
    });
  });

  describe('minePatterns', () => {
    it('returns empty array with fewer than 2 sessions', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      const insights = service.minePatterns();
      expect(insights).toEqual([]);
    });

    it('returns cross-session insights with 2+ sessions', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      const insights = service.minePatterns();
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toHaveProperty('patternType');
      expect(insights[0]).toHaveProperty('description');
      expect(insights[0]).toHaveProperty('affectedSessions');
      expect(insights[0]).toHaveProperty('confidence');
      expect(insights[0]).toHaveProperty('recommendations');
    });

    it('sorts insights by confidence descending', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      const insights = service.minePatterns();
      for (let i = 1; i < insights.length; i++) {
        expect(insights[i - 1].confidence).toBeGreaterThanOrEqual(insights[i].confidence);
      }
    });
  });

  describe('getPatterns', () => {
    it('returns empty patterns before mining', () => {
      expect(service.getPatterns()).toEqual([]);
    });

    it('returns patterns after mining', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      service.minePatterns();
      const patterns = service.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('getClusters', () => {
    it('returns empty clusters before mining', () => {
      expect(service.getClusters()).toEqual([]);
    });

    it('returns clusters after mining', () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      service.minePatterns();
      const clusters = service.getClusters();
      expect(clusters.length).toBeGreaterThan(0);
    });
  });

  describe('shutdown', () => {
    it('clears all stored data', async () => {
      service.recordTelemetry(makeTelemetry('session-1'));
      service.recordTelemetry(makeTelemetry('session-2'));
      service.minePatterns();
      await service.shutdown();
      expect(service.getRecordedSessions()).toEqual([]);
      expect(service.getPatterns()).toEqual([]);
      expect(service.getClusters()).toEqual([]);
    });
  });
});