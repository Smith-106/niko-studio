import { describe, expect, it } from 'vitest';

import { CriticEngineAdapter } from '../../container/adapters';

describe('CriticEngineAdapter', () => {
  it('returns real quick-scan analysis instead of stub output', async () => {
    const adapter = new CriticEngineAdapter();

    const result = await adapter.analyze(
      '她突然站起。突然回头。突然又沉默。房间里没有明确冲突，也没有足够细节。',
    );

    expect(typeof result.score).toBe('number');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).not.toContain('CriticAgent not configured');
  });

  it('returns recommendations through getSuggestions', () => {
    const adapter = new CriticEngineAdapter();
    const suggestions = adapter.getSuggestions({
      score: 62,
      issues: ['issue-a'],
      strengths: ['strength-a'],
      recommendations: ['improve detail', 'improve conflict'],
    });

    expect(suggestions).toEqual(['improve detail', 'improve conflict']);
  });
});
