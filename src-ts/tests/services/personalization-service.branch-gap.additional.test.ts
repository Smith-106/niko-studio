import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildProfileSpy = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    recommendations: [
      {
        dimensionId: 'clarity',
        title: 'Improve clarity',
        summary: 'Sentences tend to be too long.',
        confidence: 0.85,
        source: 'pattern',
        evidence: ['avg_sentence_length_35'],
      },
    ],
    overallScore: 0.78,
    dimensionScores: { clarity: 0.7 },
  }),
);

const logInfoSpy = vi.hoisted(() => vi.fn());

vi.mock('../../analysis/personalized-craft-profile', () => ({
  buildPersonalizedCraftProfile: buildProfileSpy,
}));

vi.mock('../../logger/index', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: logInfoSpy,
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { PersonalizationServiceImpl } from '../../services/personalization-service.js';
import type { KnowledgeMemoryEngineAdapter } from '../../protocols/knowledge.js';

describe('services/personalization-service branch-gap coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits repeated initialize calls after the first success', async () => {
    const service = new PersonalizationServiceImpl();

    await service.initialize();
    await service.initialize();

    expect(logInfoSpy).toHaveBeenCalledWith('Personalization service initialized');
    expect(logInfoSpy).toHaveBeenCalledTimes(1);
    expect(await service.healthCheck()).toBe(true);
  });

  it('tracks modified signals in both aggregated profile views and recommendation inputs', () => {
    const service = new PersonalizationServiceImpl();

    service.recordPreferenceSignal({
      category: 'tone',
      action: 'modified',
      value: 'balanced',
      confidence: 0.6,
      timestamp: '2026-06-09T00:00:00.000Z',
    });

    const profile = service.getPreferenceProfile();
    expect(profile.categories.tone).toMatchObject({
      acceptedCount: 0,
      rejectedCount: 0,
      modifiedCount: 1,
      topValues: ['balanced'],
    });

    service.buildProfile();
    expect(buildProfileSpy).toHaveBeenCalledWith({
      preferenceProfile: {
        tone: {
          accept: 0,
          reject: 0,
          modify: 1,
          avgValue: 0.6,
        },
      },
    });
  });

  it('swallows persistence failures from the knowledge bridge during shutdown', async () => {
    const persistenceBridge = {
      add: vi.fn().mockRejectedValue(new Error('persistence offline')),
    } as unknown as KnowledgeMemoryEngineAdapter;
    const service = new PersonalizationServiceImpl({ persistenceBridge });
    await service.initialize();

    service.recordPreferenceSignal({
      category: 'pace',
      action: 'accepted',
      value: 'fast',
      confidence: 0.9,
    });

    await service.shutdown();

    expect(persistenceBridge.add).toHaveBeenCalled();
    expect(logInfoSpy).toHaveBeenCalledWith('Failed to persist preference signals');
    expect(await service.healthCheck()).toBe(false);
  });
});
