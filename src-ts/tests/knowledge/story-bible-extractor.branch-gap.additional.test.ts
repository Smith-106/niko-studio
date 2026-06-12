import { describe, expect, it } from 'vitest';

import { StoryBibleExtractor } from '../../knowledge/extraction/StoryBibleExtractor.js';
import { WorldRuleCategory } from '../../knowledge/entities/story-bible-types.js';

describe('knowledge/extraction/StoryBibleExtractor branch-gap coverage', () => {
  it('keeps short or missing descriptions while deduplicating long matches', () => {
    const extractor = new StoryBibleExtractor();

    const deduped = (extractor as unknown as {
      deduplicateByDescription: (
        items: Array<Record<string, unknown>>,
        keyField?: string,
      ) => Array<Record<string, unknown>>;
    }).deduplicateByDescription([
      {},
      { description: 'short' },
      { description: 'A long duplicate description that should only survive once in the result set.' },
      { description: 'A long duplicate description that should only survive once in the result set.' },
    ]);

    expect(deduped).toHaveLength(3);
    expect(deduped[0]).toEqual({});
    expect(deduped[1]).toEqual({ description: 'short' });
  });

  it('falls back to the default social category when no category keyword matches', () => {
    const extractor = new StoryBibleExtractor({ minConfidence: 0.2 });
    const manuscript = '只有遵守古老礼仪的人才能进入王厅并获得长老许可。';

    const rules = extractor.extractWorldRules(manuscript, 'novel-social-rules');

    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe(WorldRuleCategory.SOCIAL);
    expect(rules[0].description).toContain('只有遵守古老礼仪的人才能进入王厅');
  });
});
