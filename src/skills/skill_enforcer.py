# -*- coding: utf-8 -*-
"""
Skill Enforcer - 技能约束执行器

基于技能定义强制执行约束规则，确保技能使用符合预定义的规范。
支持上下文要求、令牌限制、维度约束等验证。
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Protocol, runtime_checkable

logger = logging.getLogger("niko-skills")


class ConstraintType(Enum):
    """约束类型枚举"""
    REQUIRED_CONTEXT = "required_context"  # 必需上下文
    MAX_TOKENS = "max_tokens"              # 最大令牌数
    ALLOWED_DIMENSIONS = "allowed_dimensions"  # 允许的维度
    REQUIRED_SKILLS = "required_skills"    # 前置技能要求
    OUTPUT_FORMAT = "output_format"        # 输出格式约束
    MIN_QUALITY_SCORE = "min_quality_score"  # 最低质量分数


@dataclass
class SkillConstraint:
    """技能约束定义"""
    constraint_type: ConstraintType
    value: Any
    error_message: str = ""
    is_blocking: bool = True  # 是否阻塞执行

    def __post_init__(self):
        if not self.error_message:
            self.error_message = f"Constraint {self.constraint_type.value} not satisfied"


@dataclass
class ConstraintViolation:
    """约束违反记录"""
    constraint: SkillConstraint
    actual_value: Any
    skill_id: str
    details: str = ""

    def __str__(self) -> str:
        return f"[{self.skill_id}] {self.constraint.error_message}: expected {self.constraint.value}, got {self.actual_value}"


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    violations: List[ConstraintViolation] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def blocking_violations(self) -> List[ConstraintViolation]:
        """获取阻塞性违规"""
        return [v for v in self.violations if v.constraint.is_blocking]

    @property
    def can_proceed(self) -> bool:
        """是否可以继续执行（无阻塞性违规）"""
        return len(self.blocking_violations) == 0


@dataclass
class SkillExecutionContext:
    """技能执行上下文"""
    skill_id: str
    input_text: str
    memory_context: Optional[Dict[str, Any]] = None
    project_context: Optional[Dict[str, Any]] = None
    active_dimensions: List[str] = field(default_factory=list)
    token_count: int = 0
    quality_scores: Dict[str, float] = field(default_factory=dict)
    previous_skills: List[str] = field(default_factory=list)


@runtime_checkable
class IConstraintValidator(Protocol):
    """约束验证器协议"""

    def validate(
        self,
        constraint: SkillConstraint,
        context: SkillExecutionContext
    ) -> Optional[ConstraintViolation]:
        """验证约束，返回违规信息或 None"""
        ...


class RequiredContextValidator:
    """必需上下文验证器"""

    def validate(
        self,
        constraint: SkillConstraint,
        context: SkillExecutionContext
    ) -> Optional[ConstraintViolation]:
        required_keys = constraint.value if isinstance(constraint.value, list) else [constraint.value]

        all_context = {}
        if context.memory_context:
            all_context.update(context.memory_context)
        if context.project_context:
            all_context.update(context.project_context)

        missing_keys = [k for k in required_keys if k not in all_context]

        if missing_keys:
            return ConstraintViolation(
                constraint=constraint,
                actual_value=list(all_context.keys()),
                skill_id=context.skill_id,
                details=f"Missing required context keys: {missing_keys}"
            )
        return None


class MaxTokensValidator:
    """最大令牌数验证器"""

    def validate(
        self,
        constraint: SkillConstraint,
        context: SkillExecutionContext
    ) -> Optional[ConstraintViolation]:
        max_tokens = constraint.value

        if context.token_count > max_tokens:
            return ConstraintViolation(
                constraint=constraint,
                actual_value=context.token_count,
                skill_id=context.skill_id,
                details=f"Token count {context.token_count} exceeds limit {max_tokens}"
            )
        return None


class AllowedDimensionsValidator:
    """允许维度验证器"""

    def validate(
        self,
        constraint: SkillConstraint,
        context: SkillExecutionContext
    ) -> Optional[ConstraintViolation]:
        allowed = set(constraint.value) if isinstance(constraint.value, list) else {constraint.value}
        active = set(context.active_dimensions)

        disallowed = active - allowed

        if disallowed:
            return ConstraintViolation(
                constraint=constraint,
                actual_value=list(active),
                skill_id=context.skill_id,
                details=f"Disallowed dimensions active: {disallowed}"
            )
        return None


class RequiredSkillsValidator:
    """前置技能验证器"""

    def validate(
        self,
        constraint: SkillConstraint,
        context: SkillExecutionContext
    ) -> Optional[ConstraintViolation]:
        required = set(constraint.value) if isinstance(constraint.value, list) else {constraint.value}
        previous = set(context.previous_skills)

        missing = required - previous

        if missing:
            return ConstraintViolation(
                constraint=constraint,
                actual_value=list(previous),
                skill_id=context.skill_id,
                details=f"Required skills not executed: {missing}"
            )
        return None


class SkillEnforcer:
    """
    技能约束执行器

    负责验证技能使用是否符合预定义约束，支持多种约束类型。
    与 SkillRouter 和 SkillLoader 协同工作。

    使用示例:
        enforcer = SkillEnforcer()

        # 注册技能约束
        enforcer.register_constraint("fictional-dream", SkillConstraint(
            constraint_type=ConstraintType.REQUIRED_CONTEXT,
            value=["character_profile", "scene_setting"]
        ))

        # 验证技能使用
        context = SkillExecutionContext(
            skill_id="fictional-dream",
            input_text="...",
            memory_context={"character_profile": {...}}
        )
        result = enforcer.validate_skill(context)

        if result.can_proceed:
            # 执行技能
            pass
    """

    def __init__(self):
        self._constraints: Dict[str, List[SkillConstraint]] = {}
        self._validators: Dict[ConstraintType, IConstraintValidator] = {
            ConstraintType.REQUIRED_CONTEXT: RequiredContextValidator(),
            ConstraintType.MAX_TOKENS: MaxTokensValidator(),
            ConstraintType.ALLOWED_DIMENSIONS: AllowedDimensionsValidator(),
            ConstraintType.REQUIRED_SKILLS: RequiredSkillsValidator(),
        }
        self._global_constraints: List[SkillConstraint] = []

    def register_constraint(
        self,
        skill_id: str,
        constraint: SkillConstraint
    ) -> None:
        """
        注册技能约束

        Args:
            skill_id: 技能标识符
            constraint: 约束定义
        """
        if skill_id not in self._constraints:
            self._constraints[skill_id] = []
        self._constraints[skill_id].append(constraint)
        logger.debug(f"Registered constraint {constraint.constraint_type.value} for skill {skill_id}")

    def register_global_constraint(self, constraint: SkillConstraint) -> None:
        """注册全局约束（适用于所有技能）"""
        self._global_constraints.append(constraint)
        logger.debug(f"Registered global constraint {constraint.constraint_type.value}")

    def register_validator(
        self,
        constraint_type: ConstraintType,
        validator: IConstraintValidator
    ) -> None:
        """注册自定义验证器"""
        self._validators[constraint_type] = validator

    def validate_skill(
        self,
        context: SkillExecutionContext
    ) -> ValidationResult:
        """
        验证技能执行上下文

        Args:
            context: 技能执行上下文

        Returns:
            验证结果，包含违规和警告信息
        """
        violations: List[ConstraintViolation] = []
        warnings: List[str] = []

        # 收集适用的约束
        applicable_constraints = list(self._global_constraints)
        if context.skill_id in self._constraints:
            applicable_constraints.extend(self._constraints[context.skill_id])

        # 逐一验证
        for constraint in applicable_constraints:
            validator = self._validators.get(constraint.constraint_type)

            if validator is None:
                warnings.append(f"No validator for constraint type: {constraint.constraint_type.value}")
                continue

            violation = validator.validate(constraint, context)
            if violation:
                violations.append(violation)

        is_valid = len([v for v in violations if v.constraint.is_blocking]) == 0

        return ValidationResult(
            is_valid=is_valid,
            violations=violations,
            warnings=warnings
        )

    def get_constraints(self, skill_id: str) -> List[SkillConstraint]:
        """获取技能的所有约束"""
        return self._constraints.get(skill_id, []).copy()

    def clear_constraints(self, skill_id: Optional[str] = None) -> None:
        """清除约束"""
        if skill_id:
            self._constraints.pop(skill_id, None)
        else:
            self._constraints.clear()
            self._global_constraints.clear()


# ============ 预定义约束模板 ============

def create_narrative_skill_constraints() -> Dict[str, List[SkillConstraint]]:
    """创建叙事技能的标准约束"""
    return {
        "fictional-dream": [
            SkillConstraint(
                constraint_type=ConstraintType.REQUIRED_CONTEXT,
                value=["scene_setting"],
                error_message="Fictional dream requires scene setting context"
            ),
            SkillConstraint(
                constraint_type=ConstraintType.MAX_TOKENS,
                value=8000,
                error_message="Scene content exceeds token limit",
                is_blocking=False
            ),
        ],
        "character-forge": [
            SkillConstraint(
                constraint_type=ConstraintType.ALLOWED_DIMENSIONS,
                value=["character", "psychology", "background"],
                error_message="Character forge only works with character dimensions"
            ),
        ],
        "suspense-craft": [
            SkillConstraint(
                constraint_type=ConstraintType.REQUIRED_CONTEXT,
                value=["plot_outline"],
                error_message="Suspense craft requires plot outline"
            ),
        ],
    }


def get_default_enforcer() -> SkillEnforcer:
    """获取预配置的默认执行器"""
    enforcer = SkillEnforcer()

    # 注册全局令牌限制
    enforcer.register_global_constraint(SkillConstraint(
        constraint_type=ConstraintType.MAX_TOKENS,
        value=16000,
        error_message="Global token limit exceeded",
        is_blocking=True
    ))

    # 注册叙事技能约束
    for skill_id, constraints in create_narrative_skill_constraints().items():
        for constraint in constraints:
            enforcer.register_constraint(skill_id, constraint)

    return enforcer
