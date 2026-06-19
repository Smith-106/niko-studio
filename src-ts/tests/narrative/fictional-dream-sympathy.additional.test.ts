import { describe, expect, it, vi } from 'vitest';

import {
  SympathyAnalyzer,
  SympathyTrigger,
} from '../../narrative/fictional_dream/sympathy';

describe('narrative/fictional_dream/sympathy additional coverage', () => {
  it('returns all low-score suggestions when no sympathy triggers are detected', async () => {
    const analyzer = new SympathyAnalyzer();

    const result = await analyzer.analyze('清晨的街道很安静。阳光很好。她只是慢慢走回家。');

    expect(result.overallScore).toBe(0);
    expect(result.triggersDetected).toEqual([]);
    expect(result.vulnerabilityDisplay).toBe(0);
    expect(result.universalPredicament).toBe(false);
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        '同情元素严重不足！建议在开篇展示角色的普遍性困境',
        '未检测到明显的同情触发器，考虑添加：',
        '- 危险困境：让角色面临生命威胁',
        '- 羞辱处境：让角色在公开场合受辱',
        '- 孤独排挤：让角色成为"天鹅中的丑小鸭"',
        '脆弱性展示不足，建议：',
        '- 展示角色的内心恐惧和不安',
        '- 描写角色在困境中的无力感',
        '困境的普遍性不够，读者可能难以共情',
        '建议使用更普遍的困境类型（如被误解、失去所爱）',
        '\n大师案例参考：',
      ]),
    );
  });

  it('keeps detected triggers unchanged when llm refinement returns no usable entries', async () => {
    const llm = {
      generateJson: vi.fn(async () => 'not-a-json-shape'),
    };
    const analyzer = new SympathyAnalyzer(llm as never);

    const result = await analyzer.analyze('她被误解，只能独自逃离危险，最终失去家人。');

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(result.triggersDetected.length).toBeGreaterThan(0);
    expect(result.triggersDetected.every((trigger) => trigger.effectiveness === 0.5)).toBe(true);
    expect(result.triggersDetected.every((trigger) => trigger.vulnerabilityLevel === 0.5)).toBe(true);
    expect(result.triggersDetected.every((trigger) => trigger.universality === 0.5)).toBe(true);
  });

  it('merges llm refinement scores from the results field using excerpt matching', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        results: [
          {
            excerpt: '被误解',
            score: '1.2',
            vulnerability_level: '-0.1',
            universal_score: 'not-a-number',
          },
        ],
      })),
    };
    const analyzer = new SympathyAnalyzer(llm as never);

    const result = await analyzer.analyze('她被误解，却仍然想保护弟弟。');
    const injustice = result.triggersDetected.find(
      (trigger) => trigger.triggerType === SympathyTrigger.INJUSTICE,
    );

    expect(injustice).toMatchObject({
      effectiveness: 1,
      vulnerabilityLevel: 0,
      universality: 0.5,
    });
  });

  it('merges llm refinement scores from array responses with excerpt-only candidates', async () => {
    const llm = {
      generateJson: vi.fn(async () => [
        {
          excerpt: '危险的旧城区',
          score: '0.6',
          vulnerabilityLevel: '0.4',
          universality: '0.9',
        },
      ]),
    };
    const analyzer = new SympathyAnalyzer(llm as never);

    const result = await analyzer.analyze('她逃进危险的旧城区，害怕自己再也回不去了。');
    const danger = result.triggersDetected.find(
      (trigger) => trigger.triggerType === SympathyTrigger.DANGER,
    );

    expect(danger).toMatchObject({
      effectiveness: 0.6,
      vulnerabilityLevel: 0.4,
      universality: 0.9,
    });
    expect(result.universalPredicament).toBe(true);
  });
});
