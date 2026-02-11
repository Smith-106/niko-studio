"""
Skill Enforcer Tests

Tests for ConstraintType, SkillConstraint, ConstraintViolation, ValidationResult,
SkillExecutionContext, validators, SkillEnforcer, and factory functions.
"""

import pytest
from src.skills.skill_enforcer import (
    ConstraintType,
    SkillConstraint,
    ConstraintViolation,
    ValidationResult,
    SkillExecutionContext,
    RequiredContextValidator,
    MaxTokensValidator,
    AllowedDimensionsValidator,
    RequiredSkillsValidator,
    SkillEnforcer,
    create_narrative_skill_constraints,
    get_default_enforcer,
)


# ============================================================
# Enums & Dataclasses
# ============================================================

class TestConstraintType:

    def test_values(self):
        assert ConstraintType.REQUIRED_CONTEXT.value == "required_context"
        assert ConstraintType.MAX_TOKENS.value == "max_tokens"
        assert ConstraintType.ALLOWED_DIMENSIONS.value == "allowed_dimensions"
        assert ConstraintType.REQUIRED_SKILLS.value == "required_skills"
        assert ConstraintType.OUTPUT_FORMAT.value == "output_format"
        assert ConstraintType.MIN_QUALITY_SCORE.value == "min_quality_score"

    def test_six_types(self):
        assert len(ConstraintType) == 6


class TestSkillConstraint:

    def test_required_fields(self):
        c = SkillConstraint(constraint_type=ConstraintType.MAX_TOKENS, value=1000)
        assert c.constraint_type == ConstraintType.MAX_TOKENS
        assert c.value == 1000

    def test_default_error_message(self):
        c = SkillConstraint(constraint_type=ConstraintType.MAX_TOKENS, value=1000)
        assert "max_tokens" in c.error_message

    def test_custom_error_message(self):
        c = SkillConstraint(
            constraint_type=ConstraintType.MAX_TOKENS,
            value=1000,
            error_message="Too many tokens",
        )
        assert c.error_message == "Too many tokens"

    def test_is_blocking_default(self):
        c = SkillConstraint(constraint_type=ConstraintType.MAX_TOKENS, value=1000)
        assert c.is_blocking is True

    def test_is_blocking_false(self):
        c = SkillConstraint(
            constraint_type=ConstraintType.MAX_TOKENS, value=1000, is_blocking=False
        )
        assert c.is_blocking is False


class TestConstraintViolation:

    def test_str(self):
        c = SkillConstraint(
            constraint_type=ConstraintType.MAX_TOKENS,
            value=1000,
            error_message="Token limit exceeded",
        )
        v = ConstraintViolation(constraint=c, actual_value=2000, skill_id="test-skill")
        s = str(v)
        assert "test-skill" in s
        assert "Token limit exceeded" in s
        assert "1000" in s
        assert "2000" in s


class TestValidationResult:

    def test_valid(self):
        r = ValidationResult(is_valid=True)
        assert r.violations == []
        assert r.warnings == []
        assert r.can_proceed is True

    def test_blocking_violations(self):
        blocking = SkillConstraint(ConstraintType.MAX_TOKENS, 100, is_blocking=True)
        non_blocking = SkillConstraint(ConstraintType.MAX_TOKENS, 200, is_blocking=False)
        violations = [
            ConstraintViolation(blocking, 150, "s1"),
            ConstraintViolation(non_blocking, 250, "s1"),
        ]
        r = ValidationResult(is_valid=False, violations=violations)
        assert len(r.blocking_violations) == 1
        assert r.can_proceed is False

    def test_can_proceed_non_blocking_only(self):
        non_blocking = SkillConstraint(ConstraintType.MAX_TOKENS, 200, is_blocking=False)
        violations = [ConstraintViolation(non_blocking, 250, "s1")]
        r = ValidationResult(is_valid=False, violations=violations)
        assert r.can_proceed is True


class TestSkillExecutionContext:

    def test_defaults(self):
        ctx = SkillExecutionContext(skill_id="test", input_text="hello")
        assert ctx.memory_context is None
        assert ctx.project_context is None
        assert ctx.active_dimensions == []
        assert ctx.token_count == 0
        assert ctx.quality_scores == {}
        assert ctx.previous_skills == []


# ============================================================
# Validators
# ============================================================

class TestRequiredContextValidator:

    def test_pass(self):
        v = RequiredContextValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, ["key1"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", memory_context={"key1": "val"}
        )
        assert v.validate(c, ctx) is None

    def test_fail_missing(self):
        v = RequiredContextValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, ["key1", "key2"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", memory_context={"key1": "val"}
        )
        result = v.validate(c, ctx)
        assert result is not None
        assert "key2" in result.details

    def test_project_context(self):
        v = RequiredContextValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, ["pkey"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", project_context={"pkey": "val"}
        )
        assert v.validate(c, ctx) is None

    def test_no_context(self):
        v = RequiredContextValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, ["key1"])
        ctx = SkillExecutionContext(skill_id="s", input_text="t")
        result = v.validate(c, ctx)
        assert result is not None

    def test_single_value(self):
        v = RequiredContextValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, "key1")
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", memory_context={"key1": "v"}
        )
        assert v.validate(c, ctx) is None


class TestMaxTokensValidator:

    def test_within_limit(self):
        v = MaxTokensValidator()
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        ctx = SkillExecutionContext(skill_id="s", input_text="t", token_count=500)
        assert v.validate(c, ctx) is None

    def test_at_limit(self):
        v = MaxTokensValidator()
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        ctx = SkillExecutionContext(skill_id="s", input_text="t", token_count=1000)
        assert v.validate(c, ctx) is None

    def test_over_limit(self):
        v = MaxTokensValidator()
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        ctx = SkillExecutionContext(skill_id="s", input_text="t", token_count=1001)
        result = v.validate(c, ctx)
        assert result is not None
        assert result.actual_value == 1001


class TestAllowedDimensionsValidator:

    def test_all_allowed(self):
        v = AllowedDimensionsValidator()
        c = SkillConstraint(ConstraintType.ALLOWED_DIMENSIONS, ["a", "b", "c"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", active_dimensions=["a", "b"]
        )
        assert v.validate(c, ctx) is None

    def test_disallowed(self):
        v = AllowedDimensionsValidator()
        c = SkillConstraint(ConstraintType.ALLOWED_DIMENSIONS, ["a", "b"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", active_dimensions=["a", "c"]
        )
        result = v.validate(c, ctx)
        assert result is not None

    def test_empty_active(self):
        v = AllowedDimensionsValidator()
        c = SkillConstraint(ConstraintType.ALLOWED_DIMENSIONS, ["a"])
        ctx = SkillExecutionContext(skill_id="s", input_text="t")
        assert v.validate(c, ctx) is None


class TestRequiredSkillsValidator:

    def test_all_present(self):
        v = RequiredSkillsValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_SKILLS, ["skill-a"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", previous_skills=["skill-a", "skill-b"]
        )
        assert v.validate(c, ctx) is None

    def test_missing(self):
        v = RequiredSkillsValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_SKILLS, ["skill-a", "skill-b"])
        ctx = SkillExecutionContext(
            skill_id="s", input_text="t", previous_skills=["skill-a"]
        )
        result = v.validate(c, ctx)
        assert result is not None
        assert "skill-b" in result.details

    def test_empty_previous(self):
        v = RequiredSkillsValidator()
        c = SkillConstraint(ConstraintType.REQUIRED_SKILLS, ["skill-a"])
        ctx = SkillExecutionContext(skill_id="s", input_text="t")
        result = v.validate(c, ctx)
        assert result is not None


# ============================================================
# SkillEnforcer
# ============================================================

class TestSkillEnforcer:

    @pytest.fixture
    def enforcer(self):
        return SkillEnforcer()

    def test_init(self, enforcer):
        assert len(enforcer._validators) == 4
        assert len(enforcer._constraints) == 0
        assert len(enforcer._global_constraints) == 0

    def test_register_constraint(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("skill-1", c)
        assert len(enforcer.get_constraints("skill-1")) == 1

    def test_register_multiple(self, enforcer):
        c1 = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        c2 = SkillConstraint(ConstraintType.REQUIRED_CONTEXT, ["key1"])
        enforcer.register_constraint("skill-1", c1)
        enforcer.register_constraint("skill-1", c2)
        assert len(enforcer.get_constraints("skill-1")) == 2

    def test_register_global(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 5000)
        enforcer.register_global_constraint(c)
        assert len(enforcer._global_constraints) == 1

    def test_register_validator(self, enforcer):
        class Custom:
            def validate(self, constraint, context):
                return None
        enforcer.register_validator(ConstraintType.OUTPUT_FORMAT, Custom())
        assert ConstraintType.OUTPUT_FORMAT in enforcer._validators

    def test_validate_pass(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("skill-1", c)
        ctx = SkillExecutionContext(skill_id="skill-1", input_text="t", token_count=500)
        result = enforcer.validate_skill(ctx)
        assert result.is_valid is True
        assert result.can_proceed is True

    def test_validate_fail(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("skill-1", c)
        ctx = SkillExecutionContext(skill_id="skill-1", input_text="t", token_count=2000)
        result = enforcer.validate_skill(ctx)
        assert result.is_valid is False

    def test_validate_global_applied(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 500)
        enforcer.register_global_constraint(c)
        ctx = SkillExecutionContext(skill_id="any-skill", input_text="t", token_count=600)
        result = enforcer.validate_skill(ctx)
        assert result.is_valid is False

    def test_validate_no_validator_warning(self, enforcer):
        c = SkillConstraint(ConstraintType.OUTPUT_FORMAT, "json")
        enforcer.register_constraint("skill-1", c)
        ctx = SkillExecutionContext(skill_id="skill-1", input_text="t")
        result = enforcer.validate_skill(ctx)
        assert len(result.warnings) == 1

    def test_validate_unknown_skill(self, enforcer):
        ctx = SkillExecutionContext(skill_id="unknown", input_text="t")
        result = enforcer.validate_skill(ctx)
        assert result.is_valid is True

    def test_get_constraints_empty(self, enforcer):
        assert enforcer.get_constraints("nonexistent") == []

    def test_get_constraints_returns_copy(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("s1", c)
        copy = enforcer.get_constraints("s1")
        copy.append(SkillConstraint(ConstraintType.MAX_TOKENS, 2000))
        assert len(enforcer.get_constraints("s1")) == 1

    def test_clear_constraints_specific(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("s1", c)
        enforcer.register_constraint("s2", c)
        enforcer.clear_constraints("s1")
        assert enforcer.get_constraints("s1") == []
        assert len(enforcer.get_constraints("s2")) == 1

    def test_clear_constraints_all(self, enforcer):
        c = SkillConstraint(ConstraintType.MAX_TOKENS, 1000)
        enforcer.register_constraint("s1", c)
        enforcer.register_global_constraint(c)
        enforcer.clear_constraints()
        assert enforcer.get_constraints("s1") == []
        assert len(enforcer._global_constraints) == 0


# ============================================================
# Factory Functions
# ============================================================

class TestFactoryFunctions:

    def test_create_narrative_constraints(self):
        constraints = create_narrative_skill_constraints()
        assert "fictional-dream" in constraints
        assert "character-forge" in constraints
        assert "suspense-craft" in constraints
        assert len(constraints["fictional-dream"]) == 2

    def test_get_default_enforcer(self):
        enforcer = get_default_enforcer()
        assert isinstance(enforcer, SkillEnforcer)
        # Has global constraint
        assert len(enforcer._global_constraints) == 1
        # Has skill-specific constraints
        assert len(enforcer.get_constraints("fictional-dream")) == 2
        assert len(enforcer.get_constraints("character-forge")) == 1
        assert len(enforcer.get_constraints("suspense-craft")) == 1
