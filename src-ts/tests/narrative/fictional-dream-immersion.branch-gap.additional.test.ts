import { describe, expect, it, vi } from 'vitest';

import {
  DilemmaType,
  ImmersionCatalyst,
} from '../../narrative/fictional_dream/immersion';

const PERIOD = '\u3002';
const DEFAULT_PLACEHOLDER = '\u5f85\u5206\u6790';

describe('narrative/fictional_dream/immersion branch-gap coverage', () => {
  it('falls back to heuristic conflicts when llm returns a primitive response', async () => {
    const dilemma =
      '\u5979\u5728\u826f\u77e5\u4e0e\u751f\u5b58\u4e4b\u95f4\u5de6\u53f3\u4e3a\u96be\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u5bb6\u4eba\u53e6\u4e00\u65b9\u9762\u53c8\u4e0d\u613f\u80cc\u53db\u540c\u4f34';
    const llm = {
      generateJson: vi.fn(async () => 'not-json'),
    };

    const result = await new ImmersionCatalyst(llm).analyze(dilemma);

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(result.internalConflicts).toHaveLength(1);
    expect(result.internalConflicts[0]).toMatchObject({
      dilemma,
      optionA: DEFAULT_PLACEHOLDER,
      optionB: DEFAULT_PLACEHOLDER,
      stakes: DEFAULT_PLACEHOLDER,
      dilemmaType: DilemmaType.EMOTIONAL,
    });
  });

  it('keeps unmatched conflicts while matching later candidates with fallback dilemma types', async () => {
    const first =
      '\u4ed6\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u9762\u5b50\u53e6\u4e00\u65b9\u9762\u5185\u5fc3\u72b9\u8c6b\u662f\u5426\u79bb\u5f00';
    const second =
      '\u5979\u5728\u826f\u77e5\u4e0e\u751f\u5b58\u4e4b\u95f4\u5de6\u53f3\u4e3a\u96be\u4e00\u65b9\u9762\u60f3\u575a\u6301\u53e6\u4e00\u65b9\u9762\u53c8\u6000\u7591\u81ea\u5df1\u662f\u5426\u9519\u4e86';
    const llm = {
      generateJson: vi.fn(async () => ({
        conflicts: [
          {},
          { dilemma: '\u6beb\u4e0d\u76f8\u5173\u7684\u9009\u62e9', dilemma_type: 123 },
          {
            dilemma: second,
            option_a: 'persist',
            option_b: 'yield',
            stakes: 'lose trust',
            honor_involved: false,
            dilemma_type: 123,
            intensity: 0.5,
          },
        ],
      })),
    };

    const result = await new ImmersionCatalyst(llm).analyze(`${first}${PERIOD}${second}`);

    expect(result.internalConflicts).toHaveLength(2);
    expect(result.internalConflicts[0]).toMatchObject({
      dilemma: first,
      optionA: DEFAULT_PLACEHOLDER,
      dilemmaType: DilemmaType.EMOTIONAL,
    });
    expect(result.internalConflicts[1]).toMatchObject({
      dilemma: second,
      optionA: 'persist',
      optionB: 'yield',
      stakes: 'lose trust',
      honorInvolved: false,
      dilemmaType: DilemmaType.MORAL,
      intensity: 0.5,
    });
  });
});
