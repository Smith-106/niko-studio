import { describe, expect, it, vi } from 'vitest';

import {
  AllowedDimensionsValidator,
  canProceed,
  ConstraintType,
  createNarrativeSkillConstraints,
  createSkillConstraint,
  getBlockingViolations,
  getDefaultEnforcer,
  MaxTokensValidator,
  RequiredContextValidator,
  RequiredSkillsValidator,
  SkillEnforcer,
  type IConstraintValidator,
  type SkillConstraint,
  type SkillExecutionContext,
} from '../../skills/skill-enforcer.js';

function createContext(
  overrides: Partial<SkillExecutionContext> = {},
): SkillExecutionContext {
  return {
    skillId: 'fictional-dream',
    inputText: 'draft scene',
    memoryContext: { scene_setting: 'rainy alley' },
    projectContext: { plot_outline: 'find the traitor' },
    activeDimensions: ['character'],
    tokenCount: 1200,
    qualityScores: { overall: 0.9 },
    previousSkills: ['outline-generator'],
    ...overrides,
  };
}

describe('skills/skill-enforcer', () => {
  it('creates constraints with default and custom values', () => {
    const defaultConstraint = createSkillConstraint({
      constraintType: ConstraintType.MAX_TOKENS,
      value: 2048,
    });
    const customConstraint = createSkillConstraint({
      constraintType: ConstraintType.REQUIRED_CONTEXT,
      value: ['scene_setting'],
      errorMessage: 'missing scene',
      isBlocking: false,
    });

    expect(defaultConstraint).toEqual({
      constraintType: ConstraintType.MAX_TOKENS,
      value: 2048,
      errorMessage: 'Constraint max_tokens not satisfied',
      isBlocking: true,
    });
    expect(customConstraint.errorMessage).toBe('missing scene');
    expect(customConstraint.isBlocking).toBe(false);
  });

  it('filters blocking violations and determines whether execution can continue', () => {
    const blockingConstraint = createSkillConstraint({
      constraintType: ConstraintType.MAX_TOKENS,
      value: 10,
    });
    const warningConstraint = createSkillConstraint({
      constraintType: ConstraintType.REQUIRED_CONTEXT,
      value: ['scene_setting'],
      isBlocking: false,
    });

    const result = {
      isValid: false,
      warnings: [],
      violations: [
        {
          constraint: blockingConstraint,
          actualValue: 20,
          skillId: 'demo',
          details: 'too many tokens',
        },
        {
          constraint: warningConstraint,
          actualValue: [],
          skillId: 'demo',
          details: 'missing context',
        },
      ],
    };

    expect(getBlockingViolations(result)).toHaveLength(1);
    expect(canProceed(result)).toBe(false);
    expect(canProceed({ ...result, violations: [result.violations[1]] })).toBe(true);
  });

  it('validates required context from both memory and project scopes', () => {
    const validator = new RequiredContextValidator();
    const arrayConstraint = createSkillConstraint({
      constraintType: ConstraintType.REQUIRED_CONTEXT,
      value: ['scene_setting', 'plot_outline'],
    });
    const scalarConstraint = createSkillConstraint({
      constraintType: ConstraintType.REQUIRED_CONTEXT,
      value: 'character_sheet',
    });

    expect(validator.validate(arrayConstraint, createContext())).toBeNull();

    const violation = validator.validate(
      scalarConstraint,
      createContext({
        memoryContext: null,
        projectContext: { plot_outline: 'only outline present' },
      }),
    );

    expect(violation).not.toBeNull();
    expect(violation?.actualValue).toEqual(['plot_outline']);
    expect(violation?.details).toContain('character_sheet');
  });

  it('validates token, dimension, and required-skill constraints', () => {
    const maxTokensValidator = new MaxTokensValidator();
    const allowedDimensionsValidator = new AllowedDimensionsValidator();
    const requiredSkillsValidator = new RequiredSkillsValidator();

    expect(
      maxTokensValidator.validate(
        createSkillConstraint({
          constraintType: ConstraintType.MAX_TOKENS,
          value: 2000,
        }),
        createContext({ tokenCount: 1500 }),
      ),
    ).toBeNull();

    const tokenViolation = maxTokensValidator.validate(
      createSkillConstraint({
        constraintType: ConstraintType.MAX_TOKENS,
        value: 1000,
      }),
      createContext({ tokenCount: 1501 }),
    );
    expect(tokenViolation?.details).toContain('1501');

    const dimensionViolation = allowedDimensionsValidator.validate(
      createSkillConstraint({
        constraintType: ConstraintType.ALLOWED_DIMENSIONS,
        value: ['plot'],
      }),
      createContext({ activeDimensions: ['plot', 'character'] }),
    );
    expect(dimensionViolation?.actualValue).toEqual(['plot', 'character']);
    expect(dimensionViolation?.details).toContain('character');

    expect(
      allowedDimensionsValidator.validate(
        createSkillConstraint({
          constraintType: ConstraintType.ALLOWED_DIMENSIONS,
          value: 'character',
        }),
        createContext({ activeDimensions: ['character'] }),
      ),
    ).toBeNull();

    expect(
      requiredSkillsValidator.validate(
        createSkillConstraint({
          constraintType: ConstraintType.REQUIRED_SKILLS,
          value: 'outline-generator',
        }),
        createContext(),
      ),
    ).toBeNull();

    const skillViolation = requiredSkillsValidator.validate(
      createSkillConstraint({
        constraintType: ConstraintType.REQUIRED_SKILLS,
        value: ['outline-generator', 'scene-planner'],
      }),
      createContext({ previousSkills: ['outline-generator'] }),
    );
    expect(skillViolation?.details).toContain('scene-planner');
  });

  it('registers constraints and validators, and reports warnings for unsupported constraint types', () => {
    const enforcer = new SkillEnforcer();
    const customValidator: IConstraintValidator = {
      validate: vi.fn((constraint, context) => ({
        constraint,
        actualValue: context.qualityScores,
        skillId: context.skillId,
        details: 'quality score too low',
      })),
    };

    enforcer.registerGlobalConstraint(
      createSkillConstraint({
        constraintType: ConstraintType.MAX_TOKENS,
        value: 1000,
      }),
    );
    enforcer.registerConstraint(
      'fictional-dream',
      createSkillConstraint({
        constraintType: ConstraintType.MIN_QUALITY_SCORE,
        value: 0.95,
      }),
    );
    enforcer.registerConstraint(
      'fictional-dream',
      createSkillConstraint({
        constraintType: ConstraintType.OUTPUT_FORMAT,
        value: 'markdown',
      }),
    );
    enforcer.registerValidator(ConstraintType.MIN_QUALITY_SCORE, customValidator);

    const result = enforcer.validateSkill(createContext({ tokenCount: 1500 }));

    expect(customValidator.validate).toHaveBeenCalledTimes(1);
    expect(result.isValid).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.warnings).toEqual([
      'No validator for constraint type: output_format',
    ]);
  });

  it('returns defensive copies and clears skill-specific or global constraints', () => {
    const enforcer = new SkillEnforcer();
    const localConstraint = createSkillConstraint({
      constraintType: ConstraintType.REQUIRED_CONTEXT,
      value: ['scene_setting'],
    });
    const globalConstraint = createSkillConstraint({
      constraintType: ConstraintType.MAX_TOKENS,
      value: 5000,
    });

    enforcer.registerConstraint('fictional-dream', localConstraint);
    enforcer.registerGlobalConstraint(globalConstraint);

    const firstRead = enforcer.getConstraints('fictional-dream');
    firstRead.push(
      createSkillConstraint({
        constraintType: ConstraintType.REQUIRED_SKILLS,
        value: ['outline-generator'],
      }),
    );

    expect(enforcer.getConstraints('fictional-dream')).toEqual([localConstraint]);

    enforcer.clearConstraints('fictional-dream');
    expect(enforcer.getConstraints('fictional-dream')).toEqual([]);

    const stillBlockedByGlobal = enforcer.validateSkill(createContext({ tokenCount: 6000 }));
    expect(stillBlockedByGlobal.isValid).toBe(false);
    expect(stillBlockedByGlobal.violations).toHaveLength(1);

    enforcer.clearConstraints();
    expect(enforcer.validateSkill(createContext({ tokenCount: 6000 })).isValid).toBe(true);
  });

  it('builds narrative defaults and default enforcer presets', () => {
    const narrativeConstraints = createNarrativeSkillConstraints();

    expect(Object.keys(narrativeConstraints)).toEqual([
      'fictional-dream',
      'character-forge',
      'suspense-craft',
    ]);
    expect(narrativeConstraints['fictional-dream'][1]).toMatchObject({
      constraintType: ConstraintType.MAX_TOKENS,
      isBlocking: false,
    });

    const enforcer = getDefaultEnforcer();
    const invalidResult = enforcer.validateSkill(
      createContext({
        tokenCount: 20001,
        memoryContext: null,
        projectContext: {},
      }),
    );

    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.violations).toHaveLength(3);
    expect(getBlockingViolations(invalidResult)).toHaveLength(2);

    const validResult = enforcer.validateSkill(
      createContext({
        skillId: 'character-forge',
        activeDimensions: ['character', 'psychology'],
        tokenCount: 900,
      }),
    );
    expect(validResult.isValid).toBe(true);
  });
});
