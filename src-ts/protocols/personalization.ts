/**
 * Personalization Protocol
 *
 * Defines the contract for the style personalization service.
 * Produces personalized craft profiles and style recommendations
 * based on user writing patterns and preference signals.
 */

import type { PersonalizedCraftProfile } from '../analysis/personalized-craft-profile';

// ============================================================
// Protocol interfaces
// ============================================================

/**
 * A style recommendation produced by the personalization engine.
 */
export interface StyleRecommendation {
  category: string;
  title: string;
  description: string;
  confidence: number;
  source: 'pattern' | 'preference' | 'reference';
  relatedPatterns: string[];
}

/**
 * IPersonalizationService — Protocol for the style personalization service.
 *
 * Builds personalized craft profiles from session history and preference
 * signals, and produces actionable style recommendations.
 */
export interface IPersonalizationService {
  /**
   * Initialize the service.
   */
  initialize(): Promise<void>;

  /**
   * Build a personalized craft profile for the given chapter or session.
   */
  buildProfile(chapterId?: string): PersonalizedCraftProfile;

  /**
   * Generate style recommendations based on the user's profile and patterns.
   */
  getRecommendations(chapterId?: string): StyleRecommendation[];

  /**
   * Record a preference signal (e.g., user accepted/rejected a suggestion).
   */
  recordPreferenceSignal(signal: PreferenceSignal): void;

  /**
   * Get the user's accumulated preference profile.
   */
  getPreferenceProfile(): PreferenceProfile;

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the service.
   */
  shutdown(): Promise<void>;
}

/**
 * A raw preference signal from user interaction.
 */
export interface PreferenceSignal {
  category: string;
  action: 'accepted' | 'rejected' | 'modified';
  value: string;
  confidence: number;
  timestamp?: string;
}

/**
 * Accumulated preference profile derived from signals.
 */
export interface PreferenceProfile {
  categories: Record<string, {
    acceptedCount: number;
    rejectedCount: number;
    modifiedCount: number;
    topValues: string[];
  }>;
  totalSignals: number;
  lastUpdated: string;
}
