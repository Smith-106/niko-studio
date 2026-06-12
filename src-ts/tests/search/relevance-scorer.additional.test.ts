import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCORING_CONFIG,
  RelevanceSignal,
  SearchRelevanceScorerImpl,
  createSearchRelevanceScorer,
} from '../../search/relevance-scorer.js';
import type { ScoredResult, ScoringConfig } from '../../search/relevance-scorer.js';

function makeResult(overrides: Partial<ScoredResult> = {}): ScoredResult {
  return {
    id: 'result',
    content: 'typescript search patterns',
    source: 'knowledge',
    baseScore: 0.5,
    relevanceScore: 0,
    signals: {},
    ...overrides,
  };
}

function configWithSignals(
  enabled: Partial<Record<RelevanceSignal, boolean>>,
  overrides: Partial<ScoringConfig> = {},
): ScoringConfig {
  return {
    ...DEFAULT_SCORING_CONFIG,
    signals: {
      [RelevanceSignal.RECENCY]: {
        ...DEFAULT_SCORING_CONFIG.signals[RelevanceSignal.RECENCY],
        enabled: enabled[RelevanceSignal.RECENCY] ?? false,
      },
      [RelevanceSignal.SOURCE_AUTHORITY]: {
        ...DEFAULT_SCORING_CONFIG.signals[RelevanceSignal.SOURCE_AUTHORITY],
        enabled: enabled[RelevanceSignal.SOURCE_AUTHORITY] ?? false,
      },
      [RelevanceSignal.QUERY_EXPANSION]: {
        ...DEFAULT_SCORING_CONFIG.signals[RelevanceSignal.QUERY_EXPANSION],
        enabled: enabled[RelevanceSignal.QUERY_EXPANSION] ?? false,
      },
      [RelevanceSignal.SELECTION]: {
        ...DEFAULT_SCORING_CONFIG.signals[RelevanceSignal.SELECTION],
        enabled: enabled[RelevanceSignal.SELECTION] ?? false,
      },
    },
    ...overrides,
  };
}

describe('SearchRelevanceScorerImpl additional coverage', () => {
  it('factory creates isolated scorers and repeated selections increment stats', () => {
    const scorer = createSearchRelevanceScorer();
    const isolated = createSearchRelevanceScorer();

    scorer.recordSelection('target', 'narrative pacing');
    scorer.recordSelection('target', 'narrative pacing');

    expect(scorer.getSelectionStats()).toEqual({
      target: { query: 'narrative pacing', selectedCount: 2 },
    });
    expect(isolated.getSelectionStats()).toEqual({});

    const [target] = scorer.score(
      [makeResult({ id: 'target' })],
      'narrative pacing',
      configWithSignals({ [RelevanceSignal.SELECTION]: true }),
    );

    expect(target?.signals[RelevanceSignal.SELECTION]).toBeGreaterThan(0);
  });

  it('handles unknown sources and empty query expansion terms', () => {
    const scorer = new SearchRelevanceScorerImpl();

    const [scored] = scorer.score(
      [makeResult({ source: 'private-vault', content: 'anything' })],
      'a i',
      configWithSignals({
        [RelevanceSignal.SOURCE_AUTHORITY]: true,
        [RelevanceSignal.QUERY_EXPANSION]: true,
      }),
    );

    expect(scored?.signals[RelevanceSignal.SOURCE_AUTHORITY]).toBe(0.5);
    expect(scored?.signals[RelevanceSignal.QUERY_EXPANSION]).toBe(0);
  });

  it('limits expansion terms before adding duplicate prefixes', () => {
    const scorer = new SearchRelevanceScorerImpl();

    const [scored] = scorer.score(
      [makeResult({ content: 'alpha beta gamma' })],
      'alpha beta gamma',
      configWithSignals(
        { [RelevanceSignal.QUERY_EXPANSION]: true },
        { maxExpansionTerms: 1 },
      ),
    );

    expect(scored?.signals[RelevanceSignal.QUERY_EXPANSION]).toBe(1);
  });

  it('falls back to the default max expansion term count when config leaves it undefined', () => {
    const scorer = new SearchRelevanceScorerImpl();

    const [scored] = scorer.score(
      [makeResult({ content: 'alpha beta gamma alp bet gam' })],
      'alpha beta gamma',
      configWithSignals(
        { [RelevanceSignal.QUERY_EXPANSION]: true },
        { maxExpansionTerms: undefined },
      ),
    );

    expect(scored?.signals[RelevanceSignal.QUERY_EXPANSION]).toBe(1);
  });

  it('applies selection only to exact, contained, or shared-word queries', () => {
    const scorer = new SearchRelevanceScorerImpl();
    const config = configWithSignals({ [RelevanceSignal.SELECTION]: true });

    scorer.recordSelection('exact', 'plot tension');
    scorer.recordSelection('contains', 'plot tension arc');
    scorer.recordSelection('shared', 'voice consistency');
    scorer.recordSelection('unrelated', 'romance chemistry');

    const scored = scorer.score(
      [
        makeResult({ id: 'exact' }),
        makeResult({ id: 'contains' }),
        makeResult({ id: 'shared' }),
        makeResult({ id: 'unrelated' }),
      ],
      'plot tension',
      config,
    );
    const byId = Object.fromEntries(scored.map((result) => [result.id, result]));

    expect(byId.exact?.signals[RelevanceSignal.SELECTION]).toBeGreaterThan(0);
    expect(byId.contains?.signals[RelevanceSignal.SELECTION]).toBeGreaterThan(0);
    expect(byId.shared?.signals[RelevanceSignal.SELECTION]).toBe(0);
    expect(byId.unrelated?.signals[RelevanceSignal.SELECTION]).toBe(0);

    const [shared] = scorer.score(
      [makeResult({ id: 'shared' })],
      'consistency score',
      config,
    );

    expect(shared?.signals[RelevanceSignal.SELECTION]).toBeGreaterThan(0);
  });
});
