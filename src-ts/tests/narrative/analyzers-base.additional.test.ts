import { describe, expect, it } from 'vitest';

import {
  AnalysisResult,
  AnalysisType,
} from '../../narrative/analyzers/base';

describe('narrative/analyzers/base additional coverage', () => {
  it('serializes object items through their toDict helper when exporting', () => {
    const result = new AnalysisResult(
      'StructuredAnalyzer',
      AnalysisType.PACING,
      [
        {
          toDict() {
            return { id: 'item-1', score: 0.8 };
          },
        },
      ],
      { source: 'unit-test' },
      'structured summary',
    );

    expect(result.toDict()).toMatchObject({
      items: [{ id: 'item-1', score: 0.8 }],
      metadata: { source: 'unit-test' },
      summary: 'structured summary',
    });
  });
});
