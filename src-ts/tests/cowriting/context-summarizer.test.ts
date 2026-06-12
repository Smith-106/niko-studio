import { describe, expect, it } from 'vitest';

import {
  ContextSummarizer,
  createContextSummarizer,
  createDefaultContextSummarizer,
} from '../../cowriting/ContextSummarizer.js';

describe('cowriting/ContextSummarizer', () => {
  it('returns unchanged text when the request already fits within budget', () => {
    const summarizer = createDefaultContextSummarizer();
    const result = summarizer.summarize({
      text: 'Short text.',
      targetTokens: 50,
      strategy: 'truncation',
    });

    expect(result).toEqual({
      summary: 'Short text.',
      originalTokens: result.originalTokens,
      summaryTokens: result.originalTokens,
      compressionRatio: 1,
      strategy: 'truncation',
    });
    expect(createContextSummarizer()).toBeInstanceOf(ContextSummarizer);
  });

  it('truncates at sentence boundaries and falls back to a hard character cut', () => {
    const summarizer = new ContextSummarizer();
    const text =
      'Alpha clue emerges. Beta conflict grows dramatically. Gamma ending lands cleanly.';

    const boundary = summarizer.summarize({
      text,
      targetTokens: 6,
      strategy: 'truncation',
    });
    const hardCut = summarizer.summarize({
      text: 'UnbrokenTextWithoutPunctuation',
      targetTokens: 1,
      strategy: 'truncation',
    });

    expect(boundary.summary.trim()).toBe('Alpha clue emerges.');
    expect(hardCut.summary).toBe('Unb');
  });

  it('supports extractive, hierarchical, and unknown-strategy fallback paths', () => {
    const summarizer = new ContextSummarizer();

    const extractive = summarizer.summarize({
      text: [
        'Opening setup stays quiet.',
        'The artifact artifact artifact matters deeply to the team.',
        'A routine bridge passes by.',
        'Closing artifact echo returns.',
      ].join(' '),
      targetTokens: 18,
      strategy: 'extractive',
      importanceKeywords: ['artifact'],
    });

    const hierarchical = summarizer.summarize({
      text: [
        'Old chapter artifact seed grows slowly and stays distant.',
        'Middle chapter conflict forms around the artifact and the gate.',
        'Recent chapter artifact payoff lands immediately with clear stakes.',
      ].join('\n\n---\n\n'),
      targetTokens: 18,
      strategy: 'hierarchical',
      importanceKeywords: ['artifact', 'payoff'],
    });

    const fallback = summarizer.summarize({
      text: 'Alpha clue emerges. Beta conflict grows dramatically.',
      targetTokens: 6,
      strategy: 'unknown' as never,
    });

    expect(extractive.summary).toContain('The artifact artifact artifact matters deeply to the team.');
    expect(extractive.summary.length).toBeLessThan(
      [
        'Opening setup stays quiet.',
        'The artifact artifact artifact matters deeply to the team.',
        'A routine bridge passes by.',
        'Closing artifact echo returns.',
      ].join(' ').length,
    );

    expect(hierarchical.summary).toContain('---');
    expect(hierarchical.summary).toContain('Recent chapter artifact payoff');
    expect(hierarchical.summaryTokens).toBeLessThanOrEqual(
      hierarchical.originalTokens,
    );

    expect(fallback.summary.trim()).toBe('Alpha clue emerges.');
  });
});
