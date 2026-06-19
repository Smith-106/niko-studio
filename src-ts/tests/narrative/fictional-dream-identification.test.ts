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

  it('falls back to the empty godfather contract when llm returns a non-object payload', async () => {
    const llm = {
      generateJson: vi.fn(async () => 'invalid-payload'),
    };
    const builder = new IdentificationBuilder(llm);

    const result = await builder.analyze(
      '她决心离开这里，但没有任何崇高价值绑定。',
      undefined,
      0,
    );

    expect(result.godfatherTechnique).toMatchObject({
      isDetected: false,
      moralFlaw: null,
      nobleGoal: null,
      sympathyTransferPath: null,
      effectiveness: 0,
    });
  });

  it('infers godfather detection from effectiveness even without explicit boolean fields', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        detected: false,
        score: 0.6,
        moral_flaw: 1,
        noble_goal: 2,
        sympathy_transfer_path: 3,
      })),
    };
    const builder = new IdentificationBuilder(llm);

    const result = await builder.analyze(
      '她必须保护同伴并继续前进。',
      undefined,
      20,
    );

    expect(result.godfatherTechnique).toMatchObject({
      isDetected: true,
      moralFlaw: null,
      nobleGoal: null,
      sympathyTransferPath: null,
      effectiveness: 0.6,
    });
  });

  it('infers godfather detection from sympathy transfer path when score normalization falls back', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        detected: false,
        score: 'not-a-number',
        sympathy_transfer_path: '通过受害者视角转移同情',
      })),
    };
    const builder = new IdentificationBuilder(llm);

    const result = await builder.analyze(
      '她必须保护同伴并继续前进。',
      undefined,
      20,
    );

    expect(result.godfatherTechnique).toMatchObject({
      isDetected: true,
      moralFlaw: null,
      nobleGoal: null,
      sympathyTransferPath: '通过受害者视角转移同情',
      effectiveness: 0,
    });
  });

  it('uses average goal worthiness and low-score suggestions when no noble value binding is detected', async () => {
    const builder = new IdentificationBuilder();

    const result = await builder.analyze(
      '她必须离开这里。',
      undefined,
      0,
    );

    expect(result.goalWorthiness).toBe(0.5);
    expect(result.godfatherTechnique.isDetected).toBe(false);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(4);
  });

  it('normalizes whitespace-only llm strings to null', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        detected: false,
        moral_flaw: '   ',
        noble_goal: ' ',
        sympathy_transfer_path: '\n\t',
        effectiveness: 0,
      })),
    };
    const builder = new IdentificationBuilder(llm);

    const result = await builder.analyze(
      '她必须继续前进。',
      undefined,
      0,
    );

    expect(result.godfatherTechnique).toMatchObject({
      isDetected: false,
      moralFlaw: null,
      nobleGoal: null,
      sympathyTransferPath: null,
      effectiveness: 0,
    });
  });
});
