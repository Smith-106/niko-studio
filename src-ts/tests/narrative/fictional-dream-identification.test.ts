import { describe, expect, it, vi } from 'vitest';

import {
  IdentificationBuilder,
  IdentificationElement,
} from '../../narrative/fictional_dream/identification';

describe('narrative/fictional_dream/identification', () => {
  it('detects when a morally flawed character goal can use the godfather technique', () => {
    const builder = new IdentificationBuilder();

    expect(builder.detectGodfatherPotential(true, '为了正义与保护家人不惜一切')).toBe(true);
    expect(builder.detectGodfatherPotential(false, '为了正义与保护家人不惜一切')).toBe(false);
    expect(builder.detectGodfatherPotential(true, '只是想赚钱')).toBe(false);
  });

  it('produces a stable no-llm identification result with elements, scores, and suggestions', async () => {
    const builder = new IdentificationBuilder();

    const result = await builder.analyze(
      '她决心保护妹妹，为了正义不惜冒险。即使背负污点，也一定要查出真相。',
      { role: 'morally gray detective' },
      65,
    );

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.goalClarity).toBeGreaterThan(0);
    expect(result.goalWorthiness).toBeGreaterThan(0);
    expect(result.godfatherTechnique).toMatchObject({
      isDetected: false,
      effectiveness: 0,
    });
    expect(
      result.elementsDetected.some(
        element => element.elementType === IdentificationElement.GOAL_SUPPORT,
      ),
    ).toBe(true);
    expect(
      result.elementsDetected.some(
        element => element.elementType === IdentificationElement.NOBLE_VALUE_BINDING,
      ),
    ).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('hydrates godfather technique details from llm analysis when available', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        is_detected: true,
        moral_flaw: '她曾参与走私',
        noble_goal: '保护妹妹并揭露真相',
        sympathy_transfer_path: '通过妹妹的依赖让读者先站在她这一边',
        effectiveness: 0.82,
      })),
    };
    const builder = new IdentificationBuilder(llm);

    const result = await builder.analyze(
      '她决心保护妹妹，为了正义不惜冒险。即使背负污点，也一定要查出真相。',
      { role: 'morally gray detective' },
      65,
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(result.godfatherTechnique).toMatchObject({
      isDetected: true,
      moralFlaw: '她曾参与走私',
      nobleGoal: '保护妹妹并揭露真相',
      sympathyTransferPath: '通过妹妹的依赖让读者先站在她这一边',
      effectiveness: 0.82,
    });
  });
});
