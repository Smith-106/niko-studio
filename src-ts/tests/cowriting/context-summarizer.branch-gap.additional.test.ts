import { describe, expect, it } from 'vitest';

import { ContextSummarizer } from '../../cowriting/ContextSummarizer.js';

describe('cowriting/ContextSummarizer branch-gap coverage', () => {
  it('keeps hierarchical chapter budgets unscaled when the weighted budget already fits', () => {
    const summarizer = new ContextSummarizer();
    const text = [
      'Old scar stays.',
      'Mid gate shakes.',
      'Late artifact burns.',
      'Now payoff lands hard.',
    ].join('\n\n');

    const result = summarizer.summarize({
      text,
      targetTokens: 15,
      strategy: 'hierarchical',
      importanceKeywords: ['artifact', 'payoff'],
    });

    expect(result.originalTokens).toBeGreaterThan(15);
    expect(result.summary).toContain('Now payoff lands hard.');
    expect(result.summary).toContain('\n\n');
    expect(result.summaryTokens).toBeLessThanOrEqual(result.originalTokens);
  });
});
