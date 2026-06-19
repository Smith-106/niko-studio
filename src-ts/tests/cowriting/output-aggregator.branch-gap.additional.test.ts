import { describe, expect, it, vi } from 'vitest';

import { OutputAggregator } from '../../cowriting/OutputAggregator.js';
import type { ModelConfig } from '../../cowriting/ModelRouter.js';

const modelConfig: ModelConfig = {
  id: 'branch-gap-model',
  name: 'Branch Gap Model',
  provider: 'openai',
  maxTokens: 32_000,
  supportsStreaming: true,
};

describe('cowriting/OutputAggregator branch gap coverage', () => {
  it('skips repeated artifact headers while still preserving later content', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        '## Story Bible',
        '## Instructions',
        'The corridor answered with a colder silence.',
      ].join('\n'),
      'auto',
      modelConfig,
    );

    expect(result.text).toBe('The corridor answered with a colder silence.');
  });

  it('chooses a later guided option when it has the highest score', () => {
    const aggregator = new OutputAggregator();

    const result = aggregator.aggregate(
      [
        'Option 1:',
        'The first path is cautious and slow.',
        'Coherence: 40',
        'Creativity: 35',
        'Style Match: 45',
        '',
        'Option 2:',
        'The second path breaks open the hidden door.',
        'Coherence: 85',
        'Creativity: 90',
        'Style Match: 80',
      ].join('\n'),
      'guided',
      modelConfig,
    );

    expect(result.text).toBe('The second path breaks open the hidden door.');
    expect(result.options?.[1]).toMatchObject({
      overallScore: 85,
    });
  });

  it('covers the repeated artifact re-check branch at line 94', () => {
    const aggregator = new OutputAggregator();
    const originalTest = RegExp.prototype.test;
    let forcedCalls = 0;

    vi.spyOn(RegExp.prototype, 'test').mockImplementation(function (
      this: RegExp,
      value: string,
    ) {
      if (value === 'FORCED_ARTIFACT_REENTRY') {
        forcedCalls += 1;
        return forcedCalls === 6;
      }
      return originalTest.call(this, value);
    });

    const result = aggregator.aggregate(
      [
        '## Story Bible',
        'FORCED_ARTIFACT_REENTRY',
        'The real continuation survives after the forced re-check.',
      ].join('\n'),
      'auto',
      modelConfig,
    );

    expect(result.text).toBe('The real continuation survives after the forced re-check.');
    expect(forcedCalls).toBeGreaterThanOrEqual(6);
  });
});
