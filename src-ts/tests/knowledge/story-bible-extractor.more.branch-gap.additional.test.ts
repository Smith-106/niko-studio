import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoryBibleExtractor } from '../../knowledge/extraction/StoryBibleExtractor.js';

describe('knowledge/extraction/StoryBibleExtractor more branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips short world-rule descriptions before category resolution', () => {
    const extractor = new StoryBibleExtractor({ minConfidence: 0.1 });

    expect(extractor.extractWorldRules('这个世界abcde。', 'novel-short-rule')).toEqual([]);
  });

  it('skips forged plot-thread matches without a usable premise capture', () => {
    const extractor = new StoryBibleExtractor({ minConfidence: 0.1 });
    const originalExec = RegExp.prototype.exec;
    let injected = false;

    vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function mockedExec(this: RegExp, text: string) {
      if (!injected && this.source.includes('目标是')) {
        injected = true;
        const match = ['目标是伪造分支'] as unknown as RegExpExecArray;
        match.index = 0;
        match.input = text;
        return match;
      }

      return originalExec.call(this, text);
    });

    expect(
      extractor.extractPlotThreads(
        'plain text without any native plot-thread pattern matches',
        'novel-empty-premise',
      ),
    ).toEqual([]);
  });
});
