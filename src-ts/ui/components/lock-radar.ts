/**
 * UI Components - Lock Radar
 *
 * LOCK system score visualization (Lead, Objective, Confrontation, Knockout).
 * Migrated from src/ui/components/lock_radar.py - logic only (no Streamlit/Plotly).
 */

import { translations } from '../translations';

export interface LockScores {
  L: number;
  O: number;
  C: number;
  K: number;
}

export interface LockRadarData {
  categories: string[];
  values: number[];
  valuesClosed: number[];
  categoriesClosed: string[];
  thresholdPerItem: number;
  total: number;
  passed: boolean;
  title: string;
}

export interface LockBreakdownItem {
  key: string;
  name: string;
  description: string;
  tooltip: string;
  score: number;
  isConflict: boolean;
  analysis: string | null;
}

/**
 * Extract a single LOCK dimension score from flexible score dict.
 */
function extractScore(scores: Record<string, number>, key: string): number {
  if (key in scores) return scores[key];
  const fullKey = `${key} (Lead)`;
  if (fullKey in scores) return scores[fullKey];
  for (const [k, v] of Object.entries(scores)) {
    if (k.startsWith(key)) return v;
  }
  return 0;
}

/**
 * Build radar chart data from LOCK scores.
 */
export function buildLockRadarData(
  scores: Record<string, number>,
  threshold = 28,
  title?: string,
  lang: 'en' | 'zh' = 'en',
): LockRadarData {
  const tr = translations[lang] ?? translations.en;
  const resolvedTitle = title ?? tr('lock_system_score');

  const categories = [
    tr('lock_L'),
    tr('lock_O'),
    tr('lock_C'),
    tr('lock_K'),
  ];

  const values = ['L', 'O', 'C', 'K'].map(k => extractScore(scores, k));
  const valuesClosed = [...values, values[0]];
  const categoriesClosed = [...categories, categories[0]];
  const thresholdPerItem = threshold / 4;
  const total = values.reduce((a, b) => a + b, 0);

  return {
    categories,
    values,
    valuesClosed,
    categoriesClosed,
    thresholdPerItem,
    total,
    passed: total >= threshold,
    title: resolvedTitle,
  };
}

/**
 * Build LOCK breakdown items with analysis.
 */
export function buildLockBreakdown(
  scores: Record<string, number>,
  analysis?: Record<string, string> | null,
  lang: 'en' | 'zh' = 'en',
): LockBreakdownItem[] {
  const tr = translations[lang] ?? translations.en;

  const dimensions: Array<{ key: string; nameKey: string; descKey: string; tooltipKey: string }> = [
    { key: 'L', nameKey: 'lock_L', descKey: 'lock_L_desc', tooltipKey: 'lock_L_tooltip' },
    { key: 'O', nameKey: 'lock_O', descKey: 'lock_O_desc', tooltipKey: 'lock_O_tooltip' },
    { key: 'C', nameKey: 'lock_C', descKey: 'lock_C_desc', tooltipKey: 'lock_C_tooltip' },
    { key: 'K', nameKey: 'lock_K', descKey: 'lock_K_desc', tooltipKey: 'lock_K_tooltip' },
  ];

  return dimensions.map(({ key, nameKey, descKey, tooltipKey }) => ({
    key,
    name: tr(nameKey),
    description: tr(descKey),
    tooltip: tr(tooltipKey),
    score: extractScore(scores, key),
    isConflict: key === 'C',
    analysis: analysis?.[key] ?? null,
  }));
}

/**
 * Normalize raw scores dict to typed LockScores.
 */
export function normalizeLockScores(scores: Record<string, number>): LockScores {
  return {
    L: extractScore(scores, 'L'),
    O: extractScore(scores, 'O'),
    C: extractScore(scores, 'C'),
    K: extractScore(scores, 'K'),
  };
}
