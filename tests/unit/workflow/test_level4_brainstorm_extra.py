# -*- coding: utf-8 -*-
"""Level4Brainstorm data classes and role tests."""

import pytest
from src.workflow.levels.level4_brainstorm import (
    BrainstormRole, RoleAnalysis, BrainstormSynthesis,
    GuidanceSpecification,
)


class TestBrainstormRole:
    def test_display_name(self):
        assert BrainstormRole.PRODUCT_MANAGER.display_name == "产品经理"
        assert BrainstormRole.DEVIL_ADVOCATE.display_name == "魔鬼代言人"

    def test_display_name_fallback(self):
        # All defined roles should have display names
        for role in BrainstormRole:
            assert role.display_name is not None

    def test_perspective(self):
        assert "产品" in BrainstormRole.PRODUCT_MANAGER.perspective
        assert "架构" in BrainstormRole.SYSTEM_ARCHITECT.perspective

    def test_perspective_fallback(self):
        for role in BrainstormRole:
            assert len(role.perspective) > 0

    def test_get_default_roles(self):
        roles = BrainstormRole.get_default_roles()
        assert len(roles) == 5
        assert BrainstormRole.PRODUCT_MANAGER in roles
        assert BrainstormRole.DEVIL_ADVOCATE in roles

    def test_get_creative_roles(self):
        roles = BrainstormRole.get_creative_roles()
        assert len(roles) == 5
        assert BrainstormRole.CREATIVE_DIRECTOR in roles
        assert BrainstormRole.STORYTELLER in roles

    def test_get_technical_roles(self):
        roles = BrainstormRole.get_technical_roles()
        assert len(roles) == 5
        assert BrainstormRole.SYSTEM_ARCHITECT in roles
        assert BrainstormRole.DATA_ARCHITECT in roles


class TestRoleAnalysis:
    def test_defaults(self):
        ra = RoleAnalysis(role=BrainstormRole.OPTIMIST, analysis_content="good")
        assert ra.key_points == []
        assert ra.score == 0.0

    def test_to_dict(self):
        ra = RoleAnalysis(
            role=BrainstormRole.REALIST,
            analysis_content="analysis",
            key_points=["p1"],
            recommendations=["r1"],
            concerns=["c1"],
            score=0.8,
        )
        d = ra.to_dict()
        assert d["role"] == "realist"
        assert d["role_name"] == "现实主义者"
        assert d["score"] == 0.8
        assert len(d["key_points"]) == 1


class TestBrainstormSynthesis:
    def test_defaults(self):
        s = BrainstormSynthesis(summary="test")
        assert s.consensus_points == []
        assert s.confidence_score == 0.0

    def test_to_dict(self):
        s = BrainstormSynthesis(
            summary="综合结果",
            consensus_points=["共识1"],
            divergent_points=["分歧1"],
            prioritized_recommendations=["建议1"],
            risk_assessment="低风险",
            next_steps=["步骤1"],
            confidence_score=0.85,
        )
        d = s.to_dict()
        assert d["summary"] == "综合结果"
        assert d["confidence_score"] == 0.85
        assert len(d["consensus_points"]) == 1


class TestGuidanceSpecification:
    def test_defaults(self):
        g = GuidanceSpecification(title="T", objective="O", scope="S")
        assert g.guidelines == []
        assert g.deliverables == []

    def test_to_dict(self):
        g = GuidanceSpecification(
            title="指导规范",
            objective="目标",
            scope="范围",
            guidelines=["g1"],
            constraints=["c1"],
        )
        d = g.to_dict()
        assert d["title"] == "指导规范"
        assert len(d["guidelines"]) == 1

    def test_to_markdown_basic(self):
        g = GuidanceSpecification(title="T", objective="O", scope="S")
        md = g.to_markdown()
        assert "# T" in md
        assert "## 目标" in md
        assert "## 范围" in md

    def test_to_markdown_full(self):
        g = GuidanceSpecification(
            title="完整规范",
            objective="完成目标",
            scope="全范围",
            guidelines=["g1", "g2"],
            constraints=["c1"],
            success_criteria=["s1"],
            quality_standards=["q1"],
            deliverables=["d1"],
        )
        md = g.to_markdown()
        assert "## 指导原则" in md
        assert "- g1" in md
        assert "## 约束条件" in md
        assert "## 成功标准" in md
        assert "## 质量标准" in md
        assert "## 交付物" in md

    def test_to_markdown_empty_sections(self):
        g = GuidanceSpecification(title="T", objective="O", scope="S")
        md = g.to_markdown()
        assert "## 指导原则" not in md
        assert "## 约束条件" not in md
