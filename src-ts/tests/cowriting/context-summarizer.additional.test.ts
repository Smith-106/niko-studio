import { describe, expect, it } from 'vitest';

import { ContextSummarizer } from '../../cowriting/ContextSummarizer.js';

describe('cowriting/ContextSummarizer additional coverage', () => {
  it('falls back to a hard extractive character slice when no sentence fits the budget', () => {
    const summarizer = new ContextSummarizer();

    const result = summarizer.summarize({
      text: 'This single sentence is intentionally long enough to overflow the tiny extractive budget.',
      targetTokens: 1,
      strategy: 'extractive',
    });

    expect(result.summary).toBe('Thi');
    expect(result.summaryTokens).toBeGreaterThan(0);
  });

  it('handles zero-token edge cases and preserves raw text when sentence splitting yields nothing', () => {
    const summarizer = new ContextSummarizer();

    const whitespaceResult = summarizer.summarize({
      text: '    ',
      targetTokens: 0,
      strategy: 'extractive',
    });
    const emptyResult = summarizer.summarize({
      text: '',
      targetTokens: -1,
      strategy: 'extractive',
    });

    expect(whitespaceResult.summary).toBe('    ');
    expect(whitespaceResult.originalTokens).toBeGreaterThan(0);
    expect(emptyResult).toMatchObject({
      summary: '',
      originalTokens: 0,
      summaryTokens: 0,
      compressionRatio: 0,
      strategy: 'extractive',
    });
  });

  it('keeps already-budgeted recent chapters intact during hierarchical summarization', () => {
    const summarizer = new ContextSummarizer();
    const recentChapter = 'Go.';
    const result = summarizer.summarize({
      text: [
        'Older chapter spends many lines on political history, old borders, lost alliances, background artifact lore, and slow exposition that can be compressed safely.',
        recentChapter,
      ].join('\n\n---\n\n'),
      targetTokens: 22,
      strategy: 'hierarchical',
      importanceKeywords: ['artifact', 'payoff'],
    });

    expect(result.summary).toContain(recentChapter);
    expect(result.summary).toContain('\n\n---\n\n');
    expect(result.summaryTokens).toBeLessThanOrEqual(result.originalTokens);
  });

  it('falls back from hierarchical mode to extractive mode for single-block text', () => {
    const summarizer = new ContextSummarizer();

    const result = summarizer.summarize({
      text: 'Artifact pressure rises steadily while the gate weakens and every sentence points to the same urgent payoff.',
      targetTokens: 8,
      strategy: 'hierarchical',
      importanceKeywords: ['artifact', 'payoff'],
    });

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeLessThanOrEqual(
      'Artifact pressure rises steadily while the gate weakens and every sentence points to the same urgent payoff.'.length,
    );
  });

  it('uses paragraph fallback and older recency weights when hierarchical budgets do not need scaling', () => {
    const summarizer = new ContextSummarizer();

    const result = summarizer.summarize({
      text: [
        'Old chapter lingers on archive rituals and artifact history with enough detail to justify heavy compression later.',
        'Second chapter keeps the gate in focus while the team crosses the valley and tests the artifact again.',
        'Third chapter sharpens the artifact stakes and keeps the pressure moving toward the next reveal.',
        'Latest chapter lands the payoff in one calm, direct paragraph with the clearest consequence.',
      ].join('\n\n'),
      targetTokens: 30,
      strategy: 'hierarchical',
      importanceKeywords: ['artifact', 'payoff'],
    });

    expect(result.summary).toContain('\n\n');
    expect(result.summary).toContain('Latest chapter lands the payoff');
    expect(result.summaryTokens).toBeLessThanOrEqual(result.originalTokens);
  });

  it('applies the strongest short-sentence penalty during extractive summarization', () => {
    const summarizer = new ContextSummarizer();

    const result = summarizer.summarize({
      text: [
        'Tiny.',
        'Artifact payoff lands with clear stakes for everyone in the hall tonight.',
        'Go.',
      ].join(' '),
      targetTokens: 11,
      strategy: 'extractive',
      importanceKeywords: ['artifact', 'stakes'],
    });

    expect(result.summary).toBe('Tiny. Go.');
    expect(result.summaryTokens).toBeGreaterThan(0);
  });
});
