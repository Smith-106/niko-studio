/**
 * Spoiler Gate — CAP-003 component
 *
 * Chapter-gated extraction tier: determines what extraction is allowed
 * based on the reader's current progress to avoid spoilers.
 */

import { ExtractionTier, type SpoilerGateResult, type ReadingSession } from './learning-types';

const ALLOWED_CATEGORIES_BY_TIER: Record<ExtractionTier, string[]> = {
  [ExtractionTier.LIGHT]: ['character', 'location', 'setting'],
  [ExtractionTier.HEAVY]: ['character', 'location', 'setting', 'event', 'concept', 'rule', 'culture'],
  [ExtractionTier.BLOCKED]: [],
};

export function determineExtractionTier(session: ReadingSession): SpoilerGateResult {
  const progress = session.totalChapters > 0
    ? session.currentChapter / session.totalChapters
    : 1;

  if (progress >= 0.8) {
    return {
      tier: ExtractionTier.HEAVY,
      allowedCategories: ALLOWED_CATEGORIES_BY_TIER[ExtractionTier.HEAVY],
      reason: `Reader at ${(progress * 100).toFixed(0)}% — full extraction allowed`,
    };
  }

  if (progress >= 0.3) {
    return {
      tier: ExtractionTier.LIGHT,
      allowedCategories: ALLOWED_CATEGORIES_BY_TIER[ExtractionTier.LIGHT],
      reason: `Reader at ${(progress * 100).toFixed(0)}% — light extraction only`,
    };
  }

  return {
    tier: ExtractionTier.BLOCKED,
    allowedCategories: ALLOWED_CATEGORIES_BY_TIER[ExtractionTier.BLOCKED],
    reason: `Reader at ${(progress * 100).toFixed(0)}% — extraction blocked to avoid spoilers`,
  };
}
