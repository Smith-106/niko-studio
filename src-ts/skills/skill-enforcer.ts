/**
 * Skills module - constraint enforcer
 *
 * Validates skill usage against predefined constraints.
 */

// ============================================================
// Enums
// ============================================================

export enum ConstraintType {
  REQUIRED_CONTEXT = 'required_context',
  MAX_TOKENS = 'max_tokens',
  ALLOWED_DIMENSIONS = 'allowed_dimensions',
  REQUIRED_SKILLS = 'required_skills',
  OUTPUT_FORMAT = 'output_format',
  MIN_QUALITY_SCORE = 'min_quality_score',
}

// ============================================================
// Data Classes
// ============================================================

export interface SkillConstraint {
  constraintType: ConstraintType;
  value: unknown;
  errorMessage: string;
  isBlocking: boolean;
}

export function createSkillConstraint(params: {
  constraintType: ConstraintType;
  value: unknown;
  errorMessage?: string;
  isBlocking?: boolean;
}): SkillConstraint {
  return {
    constraintType: params.constraintType,
    value: params.value,
    errorMessage: params.errorMessage ?? `Constraint ${params.constraintType} not satisfied`,
    isBlocking: params.isBlocking ?? true,
  };
}

export interface ConstraintViolation {
  constraint: SkillConstraint;
  actualValue: unknown;
  skillId: string;
  details: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
  warnings: string[];
}

export function getBlockingViolations(result: ValidationResult): ConstraintViolation[] {
  return result.violations.filter(v => v.constraint.isBlocking);
}

export function canProceed(result: ValidationResult): boolean {
  return getBlockingViolations(result).length === 0;
}

export interface SkillExecutionContext {
  skillId: string;
  inputText: string;
  memoryContext: Record<string, unknown> | null;
  projectContext: Record<string, unknown> | null;
  activeDimensions: string[];
  tokenCount: number;
  qualityScores: Record<string, number>;
  previousSkills: string[];
}

// ============================================================
// Validators
// ============================================================

export interface IConstraintValidator {
  validate(constraint: SkillConstraint, context: SkillExecutionContext): ConstraintViolation | null;
}

export class RequiredContextValidator implements IConstraintValidator {
  validate(constraint: SkillConstraint, context: SkillExecutionContext): ConstraintViolation | null {
    const requiredKeys = Array.isArray(constraint.value) ? constraint.value : [constraint.value];
    const allContext: Record<string, unknown> = {};
    if (context.memoryContext) Object.assign(allContext, context.memoryContext);
    if (context.projectContext) Object.assign(allContext, context.projectContext);

    const missing = requiredKeys.filter(k => !(k in allContext));
    if (missing.length > 0) {
      return {
        constraint,
        actualValue: Object.keys(allContext),
        skillId: context.skillId,
        details: `Missing required context keys: ${missing}`,
      };
    }
    return null;
  }
}

export class MaxTokensValidator implements IConstraintValidator {
  validate(constraint: SkillConstraint, context: SkillExecutionContext): ConstraintViolation | null {
    const maxTokens = constraint.value as number;
    if (context.tokenCount > maxTokens) {
      return {
        constraint,
        actualValue: context.tokenCount,
        skillId: context.skillId,
        details: `Token count ${context.tokenCount} exceeds limit ${maxTokens}`,
      };
    }
    return null;
  }
}

export class AllowedDimensionsValidator implements IConstraintValidator {
  validate(constraint: SkillConstraint, context: SkillExecutionContext): ConstraintViolation | null {
    const allowed = new Set(Array.isArray(constraint.value) ? constraint.value : [constraint.value]);
    const active = new Set(context.activeDimensions);
    const disallowed = [...active].filter(d => !allowed.has(d));

    if (disallowed.length > 0) {
      return {
        constraint,
        actualValue: [...active],
        skillId: context.skillId,
        details: `Disallowed dimensions active: ${disallowed}`,
      };
    }
    return null;
  }
}

export class RequiredSkillsValidator implements IConstraintValidator {
  validate(constraint: SkillConstraint, context: SkillExecutionContext): ConstraintViolation | null {
    const required = new Set(Array.isArray(constraint.value) ? constraint.value : [constraint.value]);
    const previous = new Set(context.previousSkills);
    const missing = [...required].filter(s => !previous.has(s));

    if (missing.length > 0) {
      return {
        constraint,
        actualValue: [...previous],
        skillId: context.skillId,
        details: `Required skills not executed: ${missing}`,
      };
    }
    return null;
  }
}

// ============================================================
// Skill Enforcer
// ============================================================

export class SkillEnforcer {
  private _constraints: Map<string, SkillConstraint[]> = new Map();
  private _validators: Map<ConstraintType, IConstraintValidator> = new Map([
    [ConstraintType.REQUIRED_CONTEXT, new RequiredContextValidator()],
    [ConstraintType.MAX_TOKENS, new MaxTokensValidator()],
    [ConstraintType.ALLOWED_DIMENSIONS, new AllowedDimensionsValidator()],
    [ConstraintType.REQUIRED_SKILLS, new RequiredSkillsValidator()],
  ]);
  private _globalConstraints: SkillConstraint[] = [];

  registerConstraint(skillId: string, constraint: SkillConstraint): void {
    const list = this._constraints.get(skillId) ?? [];
    list.push(constraint);
    this._constraints.set(skillId, list);
  }

  registerGlobalConstraint(constraint: SkillConstraint): void {
    this._globalConstraints.push(constraint);
  }

  registerValidator(constraintType: ConstraintType, validator: IConstraintValidator): void {
    this._validators.set(constraintType, validator);
  }

  validateSkill(context: SkillExecutionContext): ValidationResult {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    const applicable = [...this._globalConstraints, ...(this._constraints.get(context.skillId) ?? [])];

    for (const constraint of applicable) {
      const validator = this._validators.get(constraint.constraintType);
      if (!validator) {
        warnings.push(`No validator for constraint type: ${constraint.constraintType}`);
        continue;
      }
      const violation = validator.validate(constraint, context);
      if (violation) violations.push(violation);
    }

    const isValid = violations.filter(v => v.constraint.isBlocking).length === 0;
    return { isValid, violations, warnings };
  }

  getConstraints(skillId: string): SkillConstraint[] {
    return [...(this._constraints.get(skillId) ?? [])];
  }

  clearConstraints(skillId?: string): void {
    if (skillId) { this._constraints.delete(skillId); }
    else { this._constraints.clear(); this._globalConstraints = []; }
  }
}

// ============================================================
// Preset Constraints
// ============================================================

export function createNarrativeSkillConstraints(): Record<string, SkillConstraint[]> {
  return {
    'fictional-dream': [
      createSkillConstraint({
        constraintType: ConstraintType.REQUIRED_CONTEXT,
        value: ['scene_setting'],
        errorMessage: 'Fictional dream requires scene setting context',
      }),
      createSkillConstraint({
        constraintType: ConstraintType.MAX_TOKENS,
        value: 8000,
        errorMessage: 'Scene content exceeds token limit',
        isBlocking: false,
      }),
    ],
    'character-forge': [
      createSkillConstraint({
        constraintType: ConstraintType.ALLOWED_DIMENSIONS,
        value: ['character', 'psychology', 'background'],
        errorMessage: 'Character forge only works with character dimensions',
      }),
    ],
    'suspense-craft': [
      createSkillConstraint({
        constraintType: ConstraintType.REQUIRED_CONTEXT,
        value: ['plot_outline'],
        errorMessage: 'Suspense craft requires plot outline',
      }),
    ],
  };
}

export function getDefaultEnforcer(): SkillEnforcer {
  const enforcer = new SkillEnforcer();
  enforcer.registerGlobalConstraint(createSkillConstraint({
    constraintType: ConstraintType.MAX_TOKENS,
    value: 16000,
    errorMessage: 'Global token limit exceeded',
  }));

  const constraints = createNarrativeSkillConstraints();
  for (const [skillId, skillConstraints] of Object.entries(constraints)) {
    for (const constraint of skillConstraints) {
      enforcer.registerConstraint(skillId, constraint);
    }
  }
  return enforcer;
}
