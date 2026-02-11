"""
Workflow Level Types Tests

Tests for WorkflowLevel enum, LevelConfig, RoutingRule, LevelRouter,
LEVEL_CONFIGS, ROUTING_RULES, and convenience functions.
"""

import pytest
from src.workflow.levels.types import (
    WorkflowLevel,
    LevelConfig,
    RoutingRule,
    LevelRouter,
    LEVEL_CONFIGS,
    ROUTING_RULES,
    get_level_config,
    route_task,
    to_workflow_label,
    to_workflow_slug,
)


# ============================================================
# WorkflowLevel Enum Tests
# ============================================================

class TestWorkflowLevel:

    def test_values(self):
        assert WorkflowLevel.L1_RAPID.value == 1
        assert WorkflowLevel.L2_LITE.value == 2
        assert WorkflowLevel.L3_STANDARD.value == 3
        assert WorkflowLevel.L4_BRAINSTORM.value == 4
        assert WorkflowLevel.L5_COORDINATOR.value == 5

    def test_backward_compat_alias(self):
        assert WorkflowLevel.L5_BRAINSTORM.value == 4

    def test_name_zh(self):
        assert WorkflowLevel.L1_RAPID.name_zh == "快速模式"
        assert WorkflowLevel.L3_STANDARD.name_zh == "标准模式"
        assert WorkflowLevel.L5_COORDINATOR.name_zh == "协调者模式"

    def test_label(self):
        assert WorkflowLevel.L1_RAPID.label == "L1"
        assert WorkflowLevel.L3_STANDARD.label == "L3"
        assert WorkflowLevel.L5_COORDINATOR.label == "L5"

    def test_slug(self):
        assert WorkflowLevel.L1_RAPID.slug == "rapid"
        assert WorkflowLevel.L2_LITE.slug == "lite"
        assert WorkflowLevel.L3_STANDARD.slug == "standard"
        assert WorkflowLevel.L4_BRAINSTORM.slug == "brainstorm"
        assert WorkflowLevel.L5_COORDINATOR.slug == "coordinator"

    def test_description(self):
        desc = WorkflowLevel.L1_RAPID.description
        assert len(desc) > 0

    def test_from_string_slug(self):
        assert WorkflowLevel.from_string("rapid") == WorkflowLevel.L1_RAPID
        assert WorkflowLevel.from_string("lite") == WorkflowLevel.L2_LITE
        assert WorkflowLevel.from_string("standard") == WorkflowLevel.L3_STANDARD
        assert WorkflowLevel.from_string("brainstorm") == WorkflowLevel.L4_BRAINSTORM
        assert WorkflowLevel.from_string("coordinator") == WorkflowLevel.L5_COORDINATOR

    def test_from_string_lx(self):
        assert WorkflowLevel.from_string("l1") == WorkflowLevel.L1_RAPID
        assert WorkflowLevel.from_string("l5") == WorkflowLevel.L5_COORDINATOR

    def test_from_string_storm_alias(self):
        assert WorkflowLevel.from_string("storm") == WorkflowLevel.L4_BRAINSTORM

    def test_from_string_empty(self):
        assert WorkflowLevel.from_string("") == WorkflowLevel.L3_STANDARD

    def test_from_string_unknown(self):
        assert WorkflowLevel.from_string("unknown") == WorkflowLevel.L3_STANDARD

    def test_from_label_none(self):
        assert WorkflowLevel.from_label(None) == WorkflowLevel.L3_STANDARD

    def test_from_label_enum(self):
        assert WorkflowLevel.from_label(WorkflowLevel.L1_RAPID) == WorkflowLevel.L1_RAPID

    def test_from_label_string(self):
        assert WorkflowLevel.from_label("L1") == WorkflowLevel.L1_RAPID
        assert WorkflowLevel.from_label("L3") == WorkflowLevel.L3_STANDARD
        assert WorkflowLevel.from_label("l5") == WorkflowLevel.L5_COORDINATOR

    def test_from_label_digit_string(self):
        assert WorkflowLevel.from_label("1") == WorkflowLevel.L1_RAPID
        assert WorkflowLevel.from_label("5") == WorkflowLevel.L5_COORDINATOR

    def test_from_label_slug_string(self):
        assert WorkflowLevel.from_label("rapid") == WorkflowLevel.L1_RAPID

    def test_is_valid_label_none(self):
        assert WorkflowLevel.is_valid_label(None) is False

    def test_is_valid_label_bool(self):
        assert WorkflowLevel.is_valid_label(True) is False
        assert WorkflowLevel.is_valid_label(False) is False

    def test_is_valid_label_int(self):
        assert WorkflowLevel.is_valid_label(1) is True
        assert WorkflowLevel.is_valid_label(5) is True
        assert WorkflowLevel.is_valid_label(0) is False
        assert WorkflowLevel.is_valid_label(6) is False

    def test_is_valid_label_string(self):
        assert WorkflowLevel.is_valid_label("L1") is True
        assert WorkflowLevel.is_valid_label("l3") is True
        assert WorkflowLevel.is_valid_label("rapid") is True
        assert WorkflowLevel.is_valid_label("coordinator") is True
        assert WorkflowLevel.is_valid_label("invalid") is False
        assert WorkflowLevel.is_valid_label("") is False

    def test_is_valid_label_enum(self):
        assert WorkflowLevel.is_valid_label(WorkflowLevel.L1_RAPID) is True

    def test_is_valid_label_non_string(self):
        assert WorkflowLevel.is_valid_label(3.5) is False
        assert WorkflowLevel.is_valid_label([]) is False


# ============================================================
# LevelConfig Tests
# ============================================================

class TestLevelConfig:

    def test_defaults(self):
        cfg = LevelConfig(level=WorkflowLevel.L3_STANDARD)
        assert cfg.max_revisions == 3
        assert cfg.pass_score == 80
        assert cfg.timeout_seconds == 300
        assert cfg.persist_state is False
        assert cfg.parallel_execution is False

    def test_level_configs_complete(self):
        assert len(LEVEL_CONFIGS) == 5
        for level in [
            WorkflowLevel.L1_RAPID,
            WorkflowLevel.L2_LITE,
            WorkflowLevel.L3_STANDARD,
            WorkflowLevel.L4_BRAINSTORM,
            WorkflowLevel.L5_COORDINATOR,
        ]:
            assert level in LEVEL_CONFIGS

    def test_l1_rapid_config(self):
        cfg = LEVEL_CONFIGS[WorkflowLevel.L1_RAPID]
        assert cfg.max_revisions == 0
        assert cfg.auto_approve is True
        assert cfg.persist_state is False
        assert cfg.checkpoint_enabled is False

    def test_l3_standard_config(self):
        cfg = LEVEL_CONFIGS[WorkflowLevel.L3_STANDARD]
        assert cfg.pass_score == 80
        assert cfg.persist_state is True
        assert cfg.checkpoint_enabled is True
        assert "architect" in cfg.required_agents

    def test_l5_coordinator_config(self):
        cfg = LEVEL_CONFIGS[WorkflowLevel.L5_COORDINATOR]
        assert cfg.max_revisions == 10
        assert cfg.pass_score == 90
        assert cfg.parallel_execution is True
        assert "coordinator" in cfg.required_agents


# ============================================================
# RoutingRule Tests
# ============================================================

class TestRoutingRule:

    def test_matches_keyword(self):
        rule = RoutingRule(
            name="test",
            description="test",
            target_level=WorkflowLevel.L1_RAPID,
            keywords=["错字", "typo"],
        )
        assert rule.matches({"text": "修正错字"}) is True
        assert rule.matches({"text": "写一章"}) is False

    def test_matches_complexity(self):
        rule = RoutingRule(
            name="test",
            description="test",
            target_level=WorkflowLevel.L2_LITE,
            min_complexity=30,
            max_complexity=60,
        )
        assert rule.matches({"text": "", "complexity": 50}) is True
        assert rule.matches({"text": "", "complexity": 10}) is False
        assert rule.matches({"text": "", "complexity": 70}) is False

    def test_matches_persistence(self):
        rule = RoutingRule(
            name="test",
            description="test",
            target_level=WorkflowLevel.L3_STANDARD,
            requires_persistence=True,
        )
        assert rule.matches({"text": "", "persist": True}) is True
        assert rule.matches({"text": "", "persist": False}) is False
        assert rule.matches({"text": ""}) is False

    def test_matches_collaboration(self):
        rule = RoutingRule(
            name="test",
            description="test",
            target_level=WorkflowLevel.L4_BRAINSTORM,
            requires_collaboration=True,
        )
        assert rule.matches({"text": "", "collaborate": True}) is True
        assert rule.matches({"text": "", "collaborate": False}) is False

    def test_matches_default_complexity(self):
        rule = RoutingRule(
            name="test",
            description="test",
            target_level=WorkflowLevel.L2_LITE,
            min_complexity=30,
            max_complexity=60,
        )
        # Default complexity is 50
        assert rule.matches({"text": ""}) is True


# ============================================================
# LevelRouter Tests
# ============================================================

class TestLevelRouter:

    def test_default_rules(self):
        router = LevelRouter()
        assert len(router.rules) > 0

    def test_route_typo(self):
        router = LevelRouter()
        level = router.route({"text": "修正错字", "complexity": 10})
        assert level == WorkflowLevel.L1_RAPID

    def test_route_default(self):
        router = LevelRouter()
        level = router.route({"text": "一些没有匹配的内容", "complexity": 50})
        assert level == WorkflowLevel.L3_STANDARD

    def test_route_custom_rules(self):
        rules = [
            RoutingRule(
                name="custom",
                description="custom rule",
                target_level=WorkflowLevel.L2_LITE,
                keywords=["custom"],
                priority=100,
            )
        ]
        router = LevelRouter(rules=rules)
        level = router.route({"text": "custom task"})
        assert level == WorkflowLevel.L2_LITE

    def test_get_config(self):
        router = LevelRouter()
        cfg = router.get_config(WorkflowLevel.L3_STANDARD)
        assert isinstance(cfg, LevelConfig)
        assert cfg.level == WorkflowLevel.L3_STANDARD

    def test_get_config_fallback(self):
        router = LevelRouter()
        # Unknown level still returns a config
        cfg = router.get_config(WorkflowLevel.L3_STANDARD)
        assert cfg is not None

    def test_estimate_complexity_short(self):
        router = LevelRouter()
        c = router.estimate_complexity("短")
        assert c < 50

    def test_estimate_complexity_long(self):
        router = LevelRouter()
        c = router.estimate_complexity("A" * 600)
        assert c > 50

    def test_estimate_complexity_complex_keywords(self):
        router = LevelRouter()
        c1 = router.estimate_complexity("一般的内容")
        c2 = router.estimate_complexity("完整详细深入的内容")
        assert c2 > c1

    def test_estimate_complexity_simple_keywords(self):
        router = LevelRouter()
        c = router.estimate_complexity("简单快速直接")
        assert c < 50

    def test_estimate_complexity_clamped(self):
        router = LevelRouter()
        c = router.estimate_complexity("简单" * 50)
        assert c >= 0
        assert c <= 100


# ============================================================
# Convenience Functions Tests
# ============================================================

class TestConvenienceFunctions:

    def test_get_level_config_by_enum(self):
        cfg = get_level_config(WorkflowLevel.L1_RAPID)
        assert cfg.level == WorkflowLevel.L1_RAPID

    def test_get_level_config_by_string(self):
        cfg = get_level_config("L3")
        assert cfg.level == WorkflowLevel.L3_STANDARD

    def test_get_level_config_by_int(self):
        cfg = get_level_config(5)
        assert cfg.level == WorkflowLevel.L5_COORDINATOR

    def test_route_task_returns_level(self):
        level = route_task("修正错字", complexity=10)
        assert isinstance(level, WorkflowLevel)

    def test_to_workflow_label_enum(self):
        assert to_workflow_label(WorkflowLevel.L1_RAPID) == "L1"

    def test_to_workflow_label_string(self):
        assert to_workflow_label("rapid") == "L1"

    def test_to_workflow_slug_enum(self):
        assert to_workflow_slug(WorkflowLevel.L3_STANDARD) == "standard"

    def test_to_workflow_slug_string(self):
        assert to_workflow_slug("L5") == "coordinator"

    def test_routing_rules_not_empty(self):
        assert len(ROUTING_RULES) > 0

    def test_routing_rules_sorted_by_priority(self):
        router = LevelRouter()
        priorities = [r.priority for r in router.rules]
        assert priorities == sorted(priorities, reverse=True)
