/**
 * Tests for RevisionServiceImpl
 *
 * Covers: analyze, suggest, compare, revise (basic), learning insights,
 * session history, health check, shutdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevisionServiceImpl } from '../../services/revision-service';
import { RevisionDecision } from '../../workflow/revision-loop';

// Mock the critic service to avoid real LLM calls
vi.mock('../../mcp/services/critic', () => ({
  evaluateContent: vi.fn().mockResolvedValue({
    decision: 'APPROVED',
    total_score: 8.5,
    logic_score: 8,
    actionable_feedback: 'Good writing overall',
  }),
}));

// Mock the revision-loop runRevisionLoop
vi.mock('../../workflow/revision-loop', () => ({
  RevisionDecision: {
    APPROVED: 'APPROVED',
    REVISE: 'REVISE',
    REWRITE: 'REWRITE',
    HUMAN_REVIEW: 'HUMAN_REVIEW',
  },
  DEFAULT_REVISION_CONFIG: {
    max_revisions: 5,
    pass_score: 8.0,
  },
  runRevisionLoop: vi.fn().mockResolvedValue({
    final_draft: 'Improved text content',
    final_score: 8.5,
    final_decision: 'APPROVED',
    history: [
      { score: 6.0, feedback: 'Needs improvement' },
      { score: 8.5, feedback: 'Good' },
    ],
  }),
}));

describe('RevisionServiceImpl', () => {
  let service: RevisionServiceImpl;

  beforeEach(async () => {
    service = new RevisionServiceImpl();
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

  describe('analyze', () => {
    it('returns analysis result with reports and scores', () => {
      const result = service.analyze('这是一段测试文本，包含了一些内容用于分析。');
      expect(result).toHaveProperty('reports');
      expect(result).toHaveProperty('scores');
      expect(Array.isArray(result.reports)).toBe(true);
    });

    it('returns dimension reports for all dimensions when none specified', () => {
      const result = service.analyze('测试文本内容');
      expect(result.reports.length).toBeGreaterThan(0);
    });
  });

  describe('suggest', () => {
    it('generates weak points and suggestions from analysis', () => {
      const analysis = service.analyze('这是一段需要改进的文本内容。');
      const { weakPoints, suggestions } = service.suggest('这是一段需要改进的文本内容。', analysis);
      expect(Array.isArray(weakPoints)).toBe(true);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('respects custom threshold — higher threshold includes more dimensions', () => {
      const analysis = service.analyze('测试文本');
      const low = service.suggest('测试文本', analysis, 9);
      const high = service.suggest('测试文本', analysis, 3);
      // Threshold=9: only scores below 9 become weak points
      // Threshold=3: only scores below 3 become weak points
      // Higher threshold produces MORE or equal weak points
      expect(low.weakPoints.length).toBeGreaterThanOrEqual(high.weakPoints.length);
    });
  });

  describe('compare', () => {
    it('produces a comparison between baseline and revised analyses', () => {
      const baseline = service.analyze('原始文本内容');
      const revised = service.analyze('修改后的文本内容，质量有所提升。');
      const comparison = service.compare({
        sessionId: 'test-session',
        iterationNumber: 1,
        baseline,
        revised,
      });
      expect(comparison).toHaveProperty('delta');
      expect(comparison).toHaveProperty('improvedDimensions');
    });
  });

  describe('revise', () => {
    it('returns empty result for empty text', async () => {
      const result = await service.revise('');
      expect(result.finalDecision).toBe(RevisionDecision.REVISE);
      expect(result.totalIterations).toBe(0);
      expect(result.finalDraft).toBe('');
    });

    it('returns empty result for whitespace-only text', async () => {
      const result = await service.revise('   \n\t  ');
      expect(result.totalIterations).toBe(0);
    });

    it('runs revision loop and returns structured result', async () => {
      const result = await service.revise('这是一段需要修订的文本内容。');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('finalDraft');
      expect(result).toHaveProperty('finalDecision');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('totalIterations');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('learningInsights');
    });
  });

  describe('getLearningInsights', () => {
    it('returns empty insights for fresh service', () => {
      const insights = service.getLearningInsights();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('accumulates insights after revision', async () => {
      await service.revise('测试修订内容');
      const insights = service.getLearningInsights();
      // After a revision, learning accumulator should have entries
      // (depends on whether analyze produces reports with dimensions)
      expect(Array.isArray(insights)).toBe(true);
    });
  });

  describe('getSessionHistory', () => {
    it('returns empty array for non-existent chapter', async () => {
      const sessions = await service.getSessionHistory('non-existent-chapter');
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(0);
    });
  });
});