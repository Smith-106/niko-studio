import { describe, expect, it } from 'vitest';

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
});
