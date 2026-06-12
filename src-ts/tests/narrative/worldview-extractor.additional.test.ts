import { describe, expect, it, vi } from 'vitest';

import { WorldviewExtractor } from '../../narrative/worldview-extractor';

describe('WorldviewExtractor additional coverage', () => {
  it('splits large chapter content into chunks and keeps only array-shaped llm results', async () => {
    const firstParagraph = 'first paragraph '.repeat(40);
    const secondParagraph = 'second paragraph '.repeat(40);
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce([
          {
            term: 'Sky Gate',
            nature: 'general',
            detail: 'A portal regulated by an ancient ritual.',
          },
        ])
        .mockResolvedValueOnce({ ignored: true }),
    };
    const extractor = new WorldviewExtractor({ llmClient: llmClient as never });

    const settings = await extractor.extract([
      {
        chapterNumber: 7,
        title: 'Storm Gate',
        content: `${firstParagraph}\n\n${secondParagraph}`,
      },
    ]);

    expect(llmClient.generateJson).toHaveBeenCalledTimes(2);
    expect(llmClient.generateJson.mock.calls[0]?.[0]).toContain('Text:\nfirst paragraph');
    expect(llmClient.generateJson.mock.calls[1]?.[0]).toContain('Text:\nsecond paragraph');
    expect(llmClient.generateJson.mock.calls[0]?.[1]).toMatchObject({
      temperature: 0.3,
      systemPrompt: expect.stringContaining('Extract only fictional world-building elements'),
    });
    expect(settings).toEqual([
      {
        term: 'Sky Gate',
        nature: 'general',
        detail: 'A portal regulated by an ancient ritual.',
        source: 'Ch.7: Storm Gate',
      },
    ]);
  });

  it('falls back to rule-based extraction when llm extraction fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const extractor = new WorldviewExtractor({ llmClient: llmClient as never });
    const fallback = vi
      .spyOn(extractor as never, 'ruleBasedExtraction' as never)
      .mockReturnValue([
        {
          term: 'Fallback Rule',
          nature: 'general',
          detail: 'Recovered from the rule-based extractor.',
        },
      ]);

    const result = await (extractor as never).extractFromChunk('chunk text');

    expect(fallback).toHaveBeenCalledWith('chunk text');
    expect(result).toEqual([
      {
        term: 'Fallback Rule',
        nature: 'general',
        detail: 'Recovered from the rule-based extractor.',
      },
    ]);
  });

  it('merges repeated clustered settings into a single worldview entry', () => {
    const extractor = new WorldviewExtractor();

    const clustered = (extractor as never).clusterExtractions([
      {
        term: 'Sky Gate',
        nature: 'general',
        detail: 'Opens at dusk.',
        source: 'Ch.1: Gate',
      },
      {
        term: 'Sky Gate',
        nature: 'general',
        detail: 'Guarded at dawn.',
        source: 'Ch.1: Gate',
      },
    ]);

    expect(clustered).toEqual([
      {
        term: 'Sky Gate',
        nature: 'general',
        detail: 'Opens at dusk.\nGuarded at dawn.',
        source: 'Ch.1: Gate',
      },
    ]);
  });

  it('returns false for unrelated non-empty terms in similarity checks', () => {
    const extractor = new WorldviewExtractor();

    expect((extractor as never).isSimilar('Sky Gate', 'Moon Harbor')).toBe(false);
  });
});
