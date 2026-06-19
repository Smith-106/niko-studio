import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assessOutlineQuality,
  computeValidationResult,
  OutlineQualityDimension,
  PremiseType,
  PremiseValidator,
} from '../../narrative/premise-validator';

describe('PremiseValidator additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers empty validation aggregates and additional premise-type mapping branches', async () => {
    const emptyResult = computeValidationResult(
      {
        characterTrait: '',
        conflict: '',
        conclusion: '',
        premiseType: PremiseType.REVERSAL,
        fullStatement: 'fallback',
      },
      [],
    );

    expect(emptyResult).toMatchObject({
      overallAlignment: 0,
      driftCount: 0,
      proofProgress: 0,
    });

    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          character_trait: 'trait-a',
          conflict: 'conflict-a',
          conclusion: 'conclusion-a',
          premise_type: 'chain_reaction',
        })
        .mockResolvedValueOnce({
          character_trait: 'trait-b',
          conflict: 'conflict-b',
          conclusion: 'conclusion-b',
          premise_type: 'unknown-type',
        }),
    };
    const validator = new PremiseValidator(llmClient as never);

    await expect(validator.parsePremise('statement-a')).resolves.toMatchObject({
      premiseType: PremiseType.CHAIN_REACTION,
    });
    await expect(validator.parsePremise('statement-b')).resolves.toMatchObject({
      premiseType: PremiseType.REVERSAL,
    });
  });

  it('covers validateScene fallbacks and trackPremiseProgress premise guard', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          character_trait: 'trait',
          conflict: 'conflict',
          conclusion: 'conclusion',
          premise_type: 'reversal',
        })
        .mockResolvedValueOnce({
          alignment_score: 0.7,
          contribution: 'focused',
        }),
    };
    const validator = new PremiseValidator(llmClient as never);

    await validator.parsePremise('main statement');
    const alignment = await validator.validateScene('scene-fallback', 'content', 'goal');
    expect(alignment).toMatchObject({
      evidence: [],
      driftDetected: false,
      driftDescription: null,
    });

    const guardValidator = new PremiseValidator();
    await expect(
      guardValidator.trackPremiseProgress('scene summary'),
    ).rejects.toThrow('parsePremise');
  });

  it('covers suggestRealignment non-drift and missing-premise fallback branches', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          character_trait: 'trait',
          conflict: 'conflict',
          conclusion: 'conclusion',
          premise_type: 'reversal',
        })
        .mockResolvedValueOnce({
          alignment_score: 0.9,
          contribution: 'on-track',
          evidence: ['proof'],
          drift_detected: false,
          drift_description: null,
        }),
    };
    const validator = new PremiseValidator(llmClient as never);
    await validator.parsePremise('stable premise');
    await validator.validateScene('scene-stable', 'content');

    expect(validator.suggestRealignment('scene-stable')).toEqual([
      '\u573a\u666f\u4e0e\u9884\u8bbe\u5bf9\u9f50\u826f\u597d\uff0c\u65e0\u9700\u4fee\u6539',
    ]);

    const validatorAny = validator as any;
    validatorAny.currentPremise = null;
    validatorAny.sceneAlignments = [
      {
        sceneId: 'scene-drift',
        alignmentScore: 0.2,
        contribution: 'off-track',
        evidence: [],
        driftDetected: true,
        driftDescription: 'drifted away',
      },
    ];

    const suggestions = validator.suggestRealignment('scene-drift');
    expect(suggestions[1]).toContain('drifted away');
    expect(suggestions[3]).toBe('- \u786e\u4fdd\u573a\u666f\u63a8\u8fdb\u9884\u8bbe: ');
  });

  it('covers outline quality zero-weight, good, adequate, and low-priority branches', () => {
    const originalValues = Object.values;
    vi.spyOn(Object, 'values').mockImplementation((obj: object) => {
      if (obj === OutlineQualityDimension) {
        return [];
      }
      return originalValues(obj as any);
    });

    const zeroWeightResult = assessOutlineQuality('ignored');
    expect(zeroWeightResult).toMatchObject({
      overallQualityScore: 0,
      qualityLevel: 'WEAK',
      dimensions: [],
    });

    vi.restoreAllMocks();

    const goodOutline = [
      '\u6210\u957f',
      '\u6539\u53d8',
      '\u8f6c\u53d8',
      '\u6210\u4e3a',
      '\u5bf9\u6297',
      '\u51b2\u7a81',
      '\u77db\u76fe',
      '\u963b\u788d',
      '\u60ac\u5ff5',
      '\u610f\u5916',
      '\u53d1\u73b0',
      '\u8c1c\u56e2',
      '\u9ad8\u6f6e',
      '\u8f6c\u6298',
      '\u4f0f\u7b14',
      '\u4e3b\u9898',
      '\u6838\u5fc3',
      '\u4e3b\u7ebf',
    ].join(' ');
    const adequateOutline = [
      '\u6210\u957f',
      '\u6539\u53d8',
      '\u8f6c\u53d8',
      '\u6210\u4e3a',
      '\u5bf9\u6297',
      '\u51b2\u7a81',
      '\u77db\u76fe',
      '\u9ad8\u6f6e',
      '\u8f6c\u6298',
      '\u4e3b\u9898',
      '\u6838\u5fc3',
      '\u60ac\u5ff5',
    ].join(' ');
    const lowPriorityOutline = [
      '\u6210\u957f',
      '\u6539\u53d8',
      '\u8f6c\u53d8',
      '\u6210\u4e3a',
      '\u7167\u65e7',
      '\u5bf9\u6297',
      '\u51b2\u7a81',
      '\u77db\u76fe',
      '\u9ad8\u6f6e',
      '\u8f6c\u6298',
      '\u4e3b\u9898',
      '\u6838\u5fc3',
      '\u60ac\u5ff5',
    ].join(' ');

    expect(assessOutlineQuality(goodOutline).qualityLevel).toBe('GOOD');
    expect(assessOutlineQuality(adequateOutline).qualityLevel).toBe('ADEQUATE');
    expect(
      assessOutlineQuality(lowPriorityOutline).actionableSuggestions.some(
        (item) => item.priority === 'low',
      ),
    ).toBe(true);
  });
});
