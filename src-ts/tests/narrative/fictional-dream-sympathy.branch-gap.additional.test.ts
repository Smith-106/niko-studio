import { describe, expect, it } from 'vitest';

import {
  SympathyAnalyzer,
  SympathyTrigger,
} from '../../narrative/fictional_dream/sympathy';

describe('narrative/fictional_dream/sympathy branch-gap coverage', () => {
  it('matches excerpt-only candidates through substring checks in both directions', () => {
    const analyzer = new SympathyAnalyzer();
    const isMatchingTriggerCandidate = (
      analyzer as unknown as {
        isMatchingTriggerCandidate: (
          trigger: {
            triggerType: SympathyTrigger;
            textExcerpt: string;
          },
          candidate: Record<string, unknown>,
          content: string,
        ) => boolean;
      }
    ).isMatchingTriggerCandidate.bind(analyzer);

    const trigger = {
      triggerType: SympathyTrigger.INJUSTICE,
      textExcerpt: '她被误解，却仍然想保护弟弟',
    };

    expect(
      isMatchingTriggerCandidate(trigger, { excerpt: '被误解' }, '无关全文'),
    ).toBe(true);
    expect(
      isMatchingTriggerCandidate(
        trigger,
        { excerpt: '她被误解，却仍然想保护弟弟和妹妹' },
        '无关全文',
      ),
    ).toBe(true);

    expect(
      isMatchingTriggerCandidate(
        trigger,
        { excerpt: '旧城区钟声' },
        '夜里回荡着旧城区钟声，但这句不在 trigger 摘录里。',
      ),
    ).toBe(true);
  });

  it('rejects candidates that provide neither trigger type nor excerpt', () => {
    const analyzer = new SympathyAnalyzer();
    const isMatchingTriggerCandidate = (
      analyzer as unknown as {
        isMatchingTriggerCandidate: (
          trigger: {
            triggerType: SympathyTrigger;
            textExcerpt: string;
          },
          candidate: Record<string, unknown>,
          content: string,
        ) => boolean;
      }
    ).isMatchingTriggerCandidate.bind(analyzer);

    expect(
      isMatchingTriggerCandidate(
        {
          triggerType: SympathyTrigger.DANGER,
          textExcerpt: '她逃进危险的旧城区',
        },
        {},
        '她逃进危险的旧城区',
      ),
    ).toBe(false);
  });
});
