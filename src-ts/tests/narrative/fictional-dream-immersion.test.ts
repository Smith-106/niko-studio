import { describe, expect, it, vi } from 'vitest';

import { ImmersionCatalyst } from '../../narrative/fictional_dream/immersion';

describe('narrative/fictional_dream/immersion', () => {
  it('detects moral dilemmas from overlapping conflict and moral markers', () => {
    const catalyst = new ImmersionCatalyst();

    expect(catalyst.detectMoralDilemma('她在良知与生存之间左右为难，不知道自己是否应该说出真相。')).toBe(true);
    expect(catalyst.detectMoralDilemma('她只是平静地回家睡觉。')).toBe(false);
  });

  it('produces a stable no-llm immersion analysis result with conflicts and suggestions', async () => {
    const catalyst = new ImmersionCatalyst();

    const result = await catalyst.analyze(
      '她在良知与生存之间左右为难，一方面想保全家人，另一方面又不愿背叛同伴。她不断自问这样做到底对不对。',
      undefined,
      60,
    );

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.internalConflicts.length).toBeGreaterThan(0);
    expect(result.carrieScene).toBeDefined();
    expect(result.raskolnikovWar).toBeDefined();
    expect(result.readerParticipation).toBeGreaterThanOrEqual(0);
    expect(result.choiceUrgency).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('merges llm conflict refinements into detected immersion conflicts when available', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        conflicts: [
          {
            dilemma: '她在良知与生存之间左右为难，一方面想保全家人，另一方面又不愿背叛同伴',
            option_a: '保全家人',
            option_b: '不背叛同伴',
            stakes: '失去家人或失去自我认同',
            honor_involved: true,
            dilemma_type: 'moral',
            intensity: 0.88,
          },
        ],
      })),
    };
    const catalyst = new ImmersionCatalyst(llm);

    const result = await catalyst.analyze(
      '她在良知与生存之间左右为难，一方面想保全家人，另一方面又不愿背叛同伴。她不断自问这样做到底对不对。',
      undefined,
      60,
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(result.internalConflicts[0]).toMatchObject({
      optionA: '保全家人',
      optionB: '不背叛同伴',
      stakes: '失去家人或失去自我认同',
      honorInvolved: true,
      dilemmaType: 'moral',
      intensity: 0.88,
    });
  });
});
