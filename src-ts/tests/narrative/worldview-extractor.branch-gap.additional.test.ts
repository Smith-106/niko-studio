import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorldviewExtractor, WorldviewNature } from '../../narrative/worldview-extractor.js';

describe('WorldviewExtractor branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to an empty rule term when regex capture groups are missing', () => {
    const extractor = new WorldviewExtractor();
    const originalExec = RegExp.prototype.exec;
    let injected = false;

    vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (
      this: RegExp,
      input: string,
    ) {
      if (!injected && input === '这里有一段规则描述' && this.global) {
        injected = true;
        return Object.assign(['失去捕获组的规则描述'], {
          index: 0,
          input,
        }) as unknown as RegExpExecArray;
      }
      return originalExec.call(this, input);
    });

    const result = (extractor as never).ruleBasedExtraction('这里有一段规则描述');

    expect(result).toContainEqual({
      term: '',
      nature: WorldviewNature.SOCIAL_NORM,
      detail: '失去捕获组的规则描述',
    });
  });

  it('filters out empty details and text matched by ignore patterns', () => {
    const extractor = new WorldviewExtractor();

    const filtered = (extractor as never).filterExtractions([
      { term: 'empty', nature: 'general', detail: '', source: 'Ch.1' },
      { term: 'short', nature: 'general', detail: 'abc', source: 'Ch.1' },
      { term: 'dialogue', nature: 'general', detail: '他们说要立刻离开', source: 'Ch.1' },
      { term: 'valid', nature: 'general', detail: '这是一条有效的世界观设定', source: 'Ch.1' },
    ]);

    expect(filtered).toEqual([
      { term: 'valid', nature: 'general', detail: '这是一条有效的世界观设定', source: 'Ch.1' },
    ]);
  });

  it('covers clustering fallbacks for empty terms, empty keys, alias misses, and general nature fallback', () => {
    const extractor = new WorldviewExtractor();

    const clustered = (extractor as never).clusterExtractions([
      { term: '', nature: 'custom-nature', detail: '使用 nature 作为 key', source: 'Ch.1' },
      { term: '', nature: '', detail: '这个条目会因为空 key 被跳过', source: 'Ch.1' },
      { term: 'Mystery', nature: undefined, detail: '缺少 nature 时退回 GENERAL', source: 'Ch.2' },
      { term: 'Sky Gate', nature: 'general', detail: '第一次描述', source: 'Ch.3' },
      { term: 'Sky', nature: 'general', detail: '子串命中时合并', source: 'Ch.3' },
    ]);

    expect(clustered).toEqual([
      {
        term: '',
        nature: 'custom-nature',
        detail: '使用 nature 作为 key',
        source: 'Ch.1',
      },
      {
        term: 'Mystery',
        nature: WorldviewNature.GENERAL,
        detail: '缺少 nature 时退回 GENERAL',
        source: 'Ch.2',
      },
      {
        term: 'Sky Gate',
        nature: 'general',
        detail: '第一次描述',
        source: 'Ch.3',
      },
      {
        term: 'Sky',
        nature: 'general',
        detail: '子串命中时合并',
        source: 'Ch.3',
      },
    ]);
  });

  it('returns false for empty similarity input and true for reverse substring matches', () => {
    const extractor = new WorldviewExtractor();

    expect((extractor as never).isSimilar('', 'Sky Gate')).toBe(false);
    expect((extractor as never).isSimilar('Sky', 'Sky Gate')).toBe(true);
  });
});
