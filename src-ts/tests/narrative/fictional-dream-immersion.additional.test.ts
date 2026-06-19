import { describe, expect, it, vi } from 'vitest';

import {
  DilemmaType,
  ImmersionCatalyst,
} from '../../narrative/fictional_dream/immersion';

const PERIOD = '\u3002';
const DEFAULT_PLACEHOLDER = '\u5f85\u5206\u6790';

describe('narrative/fictional_dream/immersion additional coverage', () => {
  it('reports low immersion and no reader participation for neutral text', async () => {
    const result = await new ImmersionCatalyst().analyze('plain calm paragraph');

    expect(result.internalConflicts).toEqual([]);
    expect(result.readerParticipation).toBe(0);
    expect(result.choiceUrgency).toBe(0);
    expect(result.overallScore).toBeLessThan(40);
    expect(result.suggestions.length).toBeGreaterThan(4);
  });

  it('detects honor-driven emotional conflicts without moral keywords', async () => {
    const content = [
      '\u4ed6\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u9762\u5b50',
      '\u53e6\u4e00\u65b9\u9762\u5185\u5fc3\u72b9\u8c6b\u662f\u5426\u79bb\u5f00',
    ].join('');
    const result = await new ImmersionCatalyst().analyze(content);

    expect(result.internalConflicts).toHaveLength(1);
    expect(result.internalConflicts[0]).toMatchObject({
      honorInvolved: true,
      dilemmaType: DilemmaType.EMOTIONAL,
      optionA: DEFAULT_PLACEHOLDER,
      optionB: DEFAULT_PLACEHOLDER,
      stakes: DEFAULT_PLACEHOLDER,
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('combines Carrie waiting tension, Raskolnikov moral war, and urgency caps', async () => {
    const content = [
      '\u5e0c\u671b\u62c5\u5fc3\u826f\u77e5\u96be\u9053\u5e94\u8be5\u4e00\u65b9\u9762\u53e6\u4e00\u65b9\u9762',
      '\u5fc5\u987b\u7acb\u523b\u9a6c\u4e0a\u73b0\u5728\u4e0d\u80fd\u7b49\u6765\u4e0d\u53ca\u6700\u540e\u552f\u4e00\u53ea\u6709\u5426\u5219',
    ].join(PERIOD);

    const result = await new ImmersionCatalyst().analyze(content, undefined, 200);

    expect(result.internalConflicts.length).toBeGreaterThan(0);
    expect(result.carrieScene.isDetected).toBe(true);
    expect(result.raskolnikovWar.isDetected).toBe(true);
    expect(result.choiceUrgency).toBe(1);
    expect(result.readerParticipation).toBeLessThanOrEqual(100);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('keeps heuristic conflicts when LLM refinement throws', async () => {
    const llm = {
      generateJson: vi.fn(async () => {
        throw new Error('llm unavailable');
      }),
    };
    const content = '\u5979\u5728\u826f\u77e5\u4e0e\u751f\u5b58\u4e4b\u95f4\u5de6\u53f3\u4e3a\u96be\u5e94\u8be5\u5982\u4f55\u9009\u62e9\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u5bb6\u4eba\u53e6\u4e00\u65b9\u9762\u53c8\u4e0d\u613f\u80cc\u53db\u540c\u4f34';

    const result = await new ImmersionCatalyst(llm).analyze(content);

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(result.internalConflicts[0]).toMatchObject({
      optionA: DEFAULT_PLACEHOLDER,
      optionB: DEFAULT_PLACEHOLDER,
      stakes: DEFAULT_PLACEHOLDER,
      dilemmaType: DilemmaType.MORAL,
    });
  });

  it('normalizes top-level array LLM refinements and clamps intensity', async () => {
    const dilemma = '\u5979\u5728\u826f\u77e5\u4e0e\u751f\u5b58\u4e4b\u95f4\u5de6\u53f3\u4e3a\u96be\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u5bb6\u4eba\u53e6\u4e00\u65b9\u9762\u53c8\u4e0d\u613f\u80cc\u53db\u540c\u4f34';
    const llm = {
      generateJson: vi.fn(async () => [
        {
          dilemma,
          optionA: 'protect family',
          optionB: 'keep conscience',
          stakes: 'lose part of the self',
          honorInvolved: true,
          dilemmaType: DilemmaType.TRUST,
          intensity: '1.4',
        },
      ]),
    };

    const result = await new ImmersionCatalyst(llm).analyze(dilemma);

    expect(result.internalConflicts[0]).toMatchObject({
      dilemma,
      optionA: 'protect family',
      optionB: 'keep conscience',
      stakes: 'lose part of the self',
      honorInvolved: true,
      dilemmaType: DilemmaType.TRUST,
      intensity: 1,
    });
  });

  it('ignores invalid and already-used LLM candidates while keeping stable fallbacks', async () => {
    const first = '\u4ed6\u4e00\u65b9\u9762\u60f3\u4fdd\u5168\u9762\u5b50\u53e6\u4e00\u65b9\u9762\u5185\u5fc3\u72b9\u8c6b\u662f\u5426\u79bb\u5f00';
    const second = '\u5979\u5728\u826f\u77e5\u4e0e\u751f\u5b58\u4e4b\u95f4\u5de6\u53f3\u4e3a\u96be\u4e00\u65b9\u9762\u60f3\u575a\u6301\u53e6\u4e00\u65b9\u9762\u53c8\u6000\u7591\u81ea\u5df1\u662f\u5426\u9519\u4e86';
    const llm = {
      generateJson: vi.fn(async () => ({
        conflicts: [
          { dilemma: '', option_a: 'ignored' },
          { dilemma: first, option_a: ' ', honor_involved: 'yes', dilemma_type: 'unknown', intensity: 'NaN' },
          { dilemma: first, option_a: 'duplicate should stay unused' },
          {
            dilemma: second,
            option_a: 'persist',
            option_b: 'yield',
            stakes: 'lose trust',
            honor_involved: false,
            dilemma_type: 'moral',
            intensity: -0.2,
          },
        ],
      })),
    };

    const result = await new ImmersionCatalyst(llm).analyze(`${first}${PERIOD}${second}`);

    expect(result.internalConflicts).toHaveLength(2);
    expect(result.internalConflicts[0]).toMatchObject({
      dilemma: first,
      honorInvolved: true,
      dilemmaType: DilemmaType.EMOTIONAL,
    });
    expect(result.internalConflicts[0]?.optionA).not.toBe('duplicate should stay unused');
    expect(result.internalConflicts[1]).toMatchObject({
      dilemma: second,
      optionA: 'persist',
      optionB: 'yield',
      stakes: 'lose trust',
      honorInvolved: false,
      dilemmaType: DilemmaType.MORAL,
      intensity: 0,
    });
  });
});
