import { afterEach, describe, expect, it, vi } from 'vitest';

import { DefaultWorkflowRoutingStrategy } from '../../workflow/strategies/routing-strategy.js';
import { WorkflowLevel } from '../../workflow/types.js';

describe('workflow/strategies/routing-strategy tie-breaker coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to zero when legacy scores are missing during structured tie-break sorting', () => {
    const strategy = new DefaultWorkflowRoutingStrategy(() => [], (payload) => payload);
    const originalEntries = Object.entries;
    let entriesCallCount = 0;

    vi.spyOn(Object, 'entries').mockImplementation((obj: object) => {
      entriesCallCount += 1;

      // The third Object.entries call happens inside pickLevel(structuredScores).
      // Returning unknown keys with tied scores forces the comparator to evaluate
      // legacyScores[unknown] ?? 0 on both sides of the subtraction.
      if (entriesCallCount === 3) {
        return [
          ['999', 0],
          ['1000', 0],
        ];
      }

      return originalEntries(obj as never);
    });

    const diagnostics = (
      strategy as unknown as {
        router: {
          scoreRouteFeatures: (task: string) => {
            matched_level: number;
            legacy_level: number;
            structured_top_score: number;
            matched_features: Array<Record<string, unknown>>;
          };
        };
      }
    ).router.scoreRouteFeatures('扩写这一段内容');

    expect(entriesCallCount).toBeGreaterThanOrEqual(3);
    expect(diagnostics.legacy_level).toBe(WorkflowLevel.L2_LITE);
    expect(diagnostics.matched_level).toBe(WorkflowLevel.L2_LITE);
    expect(diagnostics.structured_top_score).toBe(0);
    expect(Array.isArray(diagnostics.matched_features)).toBe(true);
  });
});
