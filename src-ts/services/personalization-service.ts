/**
 * Personalization Service Implementation
 *
 * Builds personalized craft profiles and style recommendations
 * using the existing personalized-craft-profile module.
 * Records preference signals and accumulates a preference profile.
 * Preference signals are persisted via the KnowledgeMemoryEngineAdapter.
 */

import type {
  PersonalizedCraftProfile,
  PersonalizedCraftProfileInput,
} from '../analysis/personalized-craft-profile';

import { buildPersonalizedCraftProfile } from '../analysis/personalized-craft-profile';

import type {
  IPersonalizationService,
  StyleRecommendation,
  PreferenceSignal,
  PreferenceProfile,
} from '../protocols/personalization';

import type { KnowledgeMemoryEngineAdapter } from '../protocols/knowledge';

import { createLogger } from '../logger/index';

const log = createLogger('personalization');

const SOURCE_MAP: Record<string, StyleRecommendation['source']> = {
  revision: 'pattern',
  session: 'reference',
  preference: 'preference',
};

export class PersonalizationServiceImpl implements IPersonalizationService {
  private readonly signals: PreferenceSignal[] = [];
  private profile: PersonalizedCraftProfile | null = null;
  private initialized = false;
  private readonly persistenceBridge?: KnowledgeMemoryEngineAdapter;

  constructor(config?: { persistenceBridge?: KnowledgeMemoryEngineAdapter }) {
    this.persistenceBridge = config?.persistenceBridge;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Persistence: write-only via add(). The knowledge layer stores
    // preference signals for downstream retrieval by the knowledge
    // search API, not for direct load-back by this service.
    // Signal accumulation happens via recordPreferenceSignal() calls.

    log.info('Personalization service initialized');
    this.initialized = true;
  }

  buildProfile(chapterId?: string): PersonalizedCraftProfile {
    const preferenceProfile = this._buildPreferenceProfileInput();

    const input: PersonalizedCraftProfileInput = {
      preferenceProfile,
    };

    this.profile = buildPersonalizedCraftProfile(input);
    return this.profile;
  }

  getRecommendations(chapterId?: string): StyleRecommendation[] {
    if (!this.profile) {
      this.profile = this.buildProfile(chapterId);
    }

    const recommendations: StyleRecommendation[] = this.profile.recommendations.map((rec) => ({
      category: rec.dimensionId,
      title: rec.title,
      description: rec.summary,
      confidence: rec.confidence,
      source: SOURCE_MAP[rec.source] ?? 'pattern',
      relatedPatterns: rec.evidence,
    }));

    const preferenceRecs = this.derivePreferenceRecommendations();
    recommendations.push(...preferenceRecs);

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  recordPreferenceSignal(signal: PreferenceSignal): void {
    const enriched: PreferenceSignal = {
      ...signal,
      timestamp: signal.timestamp ?? new Date().toISOString(),
    };
    this.signals.push(enriched);
    log.info(`Recorded preference signal: ${signal.action} ${signal.category}=${signal.value}`);

    this.persistSignals();
  }

  getPreferenceProfile(): PreferenceProfile {
    const categories: PreferenceProfile['categories'] = {};

    for (const signal of this.signals) {
      if (!categories[signal.category]) {
        categories[signal.category] = { acceptedCount: 0, rejectedCount: 0, modifiedCount: 0, topValues: [] };
      }
      const cat = categories[signal.category];
      if (signal.action === 'accepted') cat.acceptedCount++;
      else if (signal.action === 'rejected') cat.rejectedCount++;
      else if (signal.action === 'modified') cat.modifiedCount++;

      if (!cat.topValues.includes(signal.value)) {
        cat.topValues.push(signal.value);
      }
    }

    const lastTimestamp = this.signals.length > 0
      ? this.signals[this.signals.length - 1].timestamp
      : undefined;

    return {
      categories,
      totalSignals: this.signals.length,
      lastUpdated: lastTimestamp ?? new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    await this.persistSignals();

    this.signals.length = 0;
    this.profile = null;
    this.initialized = false;
    log.info('Personalization service shut down');
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async persistSignals(): Promise<void> {
    if (!this.persistenceBridge?.add) return;
    try {
      await this.persistenceBridge.add({
        content: JSON.stringify(this.signals),
        layer: 'preference',
        dimension: 'signal-store',
        tags: ['preference-signal-persistence'],
        source: 'personalization-service',
        confidence: 1,
      });
    } catch {
      log.info('Failed to persist preference signals');
    }
  }

  private _buildPreferenceProfileInput(): Record<string, { accept: number; reject: number; modify: number; avgValue: number }> {
    const profile: Record<string, { accept: number; reject: number; modify: number; values: number[] }> = {};

    for (const signal of this.signals) {
      if (!profile[signal.category]) {
        profile[signal.category] = { accept: 0, reject: 0, modify: 0, values: [] };
      }
      const entry = profile[signal.category];
      if (signal.action === 'accepted') entry.accept++;
      else if (signal.action === 'rejected') entry.reject++;
      else if (signal.action === 'modified') entry.modify++;
      entry.values.push(signal.confidence);
    }

    const result: Record<string, { accept: number; reject: number; modify: number; avgValue: number }> = {};
    for (const [dim, entry] of Object.entries(profile)) {
      result[dim] = {
        accept: entry.accept,
        reject: entry.reject,
        modify: entry.modify,
        avgValue: entry.values.length > 0
          ? entry.values.reduce((s, v) => s + v, 0) / entry.values.length
          : 0,
      };
    }

    return result;
  }

  private derivePreferenceRecommendations(): StyleRecommendation[] {
    const profile = this.getPreferenceProfile();
    const recommendations: StyleRecommendation[] = [];

    for (const [category, data] of Object.entries(profile.categories)) {
      if (data.acceptedCount > data.rejectedCount && data.topValues.length > 0) {
        recommendations.push({
          category,
          title: `Continue with ${data.topValues[0]}`,
          description: `User consistently accepts ${category} suggestions with value "${data.topValues[0]}" (${data.acceptedCount} accepted, ${data.rejectedCount} rejected).`,
          confidence: Math.min(data.acceptedCount / (data.acceptedCount + data.rejectedCount + 0.001), 0.95),
          source: 'preference',
          relatedPatterns: [],
        });
      }
    }

    return recommendations;
  }
}