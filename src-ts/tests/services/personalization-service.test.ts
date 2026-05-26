/**
 * Tests for PersonalizationServiceImpl
 *
 * Covers: initialize, buildProfile, getRecommendations,
 * recordPreferenceSignal, getPreferenceProfile, healthCheck, shutdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonalizationServiceImpl } from '../../services/personalization-service';
import type { KnowledgeMemoryEngineAdapter } from '../../protocols/knowledge';

// Mock the personalized-craft-profile module
vi.mock('../../analysis/personalized-craft-profile', () => ({
  buildPersonalizedCraftProfile: vi.fn().mockReturnValue({
    recommendations: [
      {
        dimensionId: 'clarity',
        title: 'Improve clarity',
        summary: 'Sentences tend to be too long.',
        confidence: 0.85,
        source: 'pattern',
        evidence: ['avg_sentence_length_35'],
      },
      {
        dimensionId: 'coherence',
        title: 'Strengthen coherence',
        summary: 'Paragraph transitions need work.',
        confidence: 0.72,
        source: 'reference',
        evidence: ['transition_score_low'],
      },
    ],
    overallScore: 0.78,
    dimensionScores: { clarity: 0.7, coherence: 0.65 },
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

describe('PersonalizationServiceImpl', () => {
  let service: PersonalizationServiceImpl;

  beforeEach(async () => {
    service = new PersonalizationServiceImpl();
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

  describe('buildProfile', () => {
    it('returns a personalized craft profile', () => {
      const profile = service.buildProfile();
      expect(profile).toHaveProperty('recommendations');
      expect(profile).toHaveProperty('overallScore');
      expect(profile.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations', () => {
    it('returns style recommendations from profile', () => {
      const recs = service.getRecommendations();
      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0]).toHaveProperty('category');
      expect(recs[0]).toHaveProperty('title');
      expect(recs[0]).toHaveProperty('description');
      expect(recs[0]).toHaveProperty('confidence');
      expect(recs[0]).toHaveProperty('source');
    });

    it('includes preference-based recommendations after recording signals', () => {
      service.recordPreferenceSignal({ category: 'clarity', action: 'accepted', value: 'short_sentences', confidence: 0.8 });
      service.recordPreferenceSignal({ category: 'clarity', action: 'accepted', value: 'short_sentences', confidence: 0.9 });
      service.recordPreferenceSignal({ category: 'clarity', action: 'rejected', value: 'long_paragraphs', confidence: 0.5 });

      const recs = service.getRecommendations();
      const prefRec = recs.find((r) => r.source === 'preference');
      expect(prefRec).toBeDefined();
      expect(prefRec!.category).toBe('clarity');
    });

    it('sorts recommendations by confidence descending', () => {
      const recs = service.getRecommendations();
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].confidence).toBeGreaterThanOrEqual(recs[i].confidence);
      }
    });
  });

  describe('recordPreferenceSignal + getPreferenceProfile', () => {
    it('records signals and returns aggregated profile', () => {
      service.recordPreferenceSignal({ category: 'clarity', action: 'accepted', value: 'concise', confidence: 0.8 });
      service.recordPreferenceSignal({ category: 'clarity', action: 'rejected', value: 'verbose', confidence: 0.3 });
      service.recordPreferenceSignal({ category: 'tone', action: 'accepted', value: 'formal', confidence: 0.9 });

      const profile = service.getPreferenceProfile();
      expect(profile.totalSignals).toBe(3);
      expect(profile.categories['clarity']).toBeDefined();
      expect(profile.categories['clarity'].acceptedCount).toBe(1);
      expect(profile.categories['clarity'].rejectedCount).toBe(1);
      expect(profile.categories['tone'].acceptedCount).toBe(1);
    });

    it('returns empty profile for fresh service', () => {
      const profile = service.getPreferenceProfile();
      expect(profile.totalSignals).toBe(0);
      expect(Object.keys(profile.categories).length).toBe(0);
    });

    it('auto-assigns timestamp if missing', () => {
      service.recordPreferenceSignal({ category: 'test', action: 'accepted', value: 'x', confidence: 0.5 });
      const profile = service.getPreferenceProfile();
      expect(profile.lastUpdated).toBeTruthy();
    });
  });

  describe('shutdown', () => {
    it('clears all stored data', async () => {
      service.recordPreferenceSignal({ category: 'clarity', action: 'accepted', value: 'concise', confidence: 0.8 });
      service.buildProfile();
      await service.shutdown();
      expect(service.getPreferenceProfile().totalSignals).toBe(0);
      expect(await service.healthCheck()).toBe(false);
    });
  });

  describe('persistence bridge', () => {
    it('uses persistence bridge when provided', async () => {
      const mockBridge = {
        add: vi.fn().mockResolvedValue({ id: 'test-id' }),
      } as unknown as KnowledgeMemoryEngineAdapter;

      const persistedService = new PersonalizationServiceImpl({ persistenceBridge: mockBridge });
      await persistedService.initialize();

      persistedService.recordPreferenceSignal({ category: 'tone', action: 'accepted', value: 'formal', confidence: 0.9 });

      // add() should be called for persistence
      expect(mockBridge.add).toHaveBeenCalled();
    });

    it('works without persistence bridge', async () => {
      const noBridgeService = new PersonalizationServiceImpl();
      await noBridgeService.initialize();
      noBridgeService.recordPreferenceSignal({ category: 'tone', action: 'accepted', value: 'formal', confidence: 0.9 });
      expect(noBridgeService.getPreferenceProfile().totalSignals).toBe(1);
    });
  });
});