import { describe, expect, it } from 'vitest';

import { CriticEngineAdapter } from '../../container/adapters';

describe('CriticEngineAdapter branch-gap coverage', () => {
  it('falls back to 0.0 when a strength score disappears between enumeration and formatting', async () => {
    let reads = 0;
    const moduleScores: Record<string, number | undefined> = {};
    Object.defineProperty(moduleScores, 'pacing', {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return reads === 1 ? 82 : undefined;
      },
    });

    const adapter = new CriticEngineAdapter({
      async quickScan() {
        return {
          overallScore: 82,
          moduleScores,
          top3Issues: [],
          allIssues: [],
        };
      },
    } as never);

    const result = await adapter.analyze('draft text');

    expect(result.strengths).toEqual(['pacing score 0.0']);
    expect(reads).toBeGreaterThanOrEqual(2);
  });
});
