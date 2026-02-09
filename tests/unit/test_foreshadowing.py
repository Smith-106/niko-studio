# -*- coding: utf-8 -*-
"""
伏笔生命周期追踪 - 单元测试

测试内容:
1. 伏笔状态机 (PLANTED -> HINTED -> HARVESTED)
2. 回收提醒触发规则
3. GraphManager 集成
"""

import pytest
import tempfile
import os
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.narrative.foreshadowing import (
    ForeshadowState,
    Foreshadow,
    ForeshadowHint,
    HarvestReminder,
    ForeshadowingManager,
    EnhancedForeshadowingManager,
    ReminderRuleEngine,
    SceneCountRule,
    NoHintRule,
    HighImportanceRule,
    ChapterBoundaryRule,
    ForeshadowGraphIntegration,
)


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def temp_db():
    """创建临时数据库"""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    yield db_path
    # 清理
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture
def manager(temp_db):
    """创建 ForeshadowingManager 实例"""
    mgr = ForeshadowingManager(db_path=temp_db)
    yield mgr
    mgr.close()


@pytest.fixture
def enhanced_manager(temp_db):
    """创建 EnhancedForeshadowingManager 实例"""
    mgr = EnhancedForeshadowingManager(db_path=temp_db)
    yield mgr
    mgr.close()


@pytest.fixture
def sample_foreshadow():
    """创建示例伏笔"""
    return Foreshadow(
        id="test-001",
        description="神秘的金色钥匙",
        state=ForeshadowState.PLANTED,
        planted_at="scene-001",
        planted_time=datetime.now() - timedelta(days=5),
        importance=7,
        tags=["mystery", "key"],
    )


# ============================================================
# 状态机测试
# ============================================================

class TestForeshadowStateMachine:
    """伏笔状态机测试"""

    def test_plant_creates_planted_state(self, manager):
        """测试埋设伏笔创建 PLANTED 状态"""
        foreshadow = manager.plant(
            description="主角的神秘项链",
            scene_id="chapter1-scene3",
            importance=8,
            tags=["artifact", "mystery"],
        )

        assert foreshadow.state == ForeshadowState.PLANTED
        assert foreshadow.description == "主角的神秘项链"
        assert foreshadow.planted_at == "chapter1-scene3"
        assert foreshadow.importance == 8
        assert "artifact" in foreshadow.tags
        assert foreshadow.harvested_at is None

    def test_hint_transitions_to_hinted(self, manager):
        """测试添加暗示转变为 HINTED 状态"""
        # 先埋设
        foreshadow = manager.plant(
            description="古老的预言书",
            scene_id="scene-001",
        )

        # 添加暗示
        updated = manager.hint(
            foreshadow_id=foreshadow.id,
            scene_id="scene-005",
            hint_description="角色瞥见书架上的那本书",
        )

        assert updated is not None
        assert updated.state == ForeshadowState.HINTED
        assert len(updated.hints) == 1
        assert updated.hints[0].scene_id == "scene-005"

    def test_multiple_hints_accumulate(self, manager):
        """测试多次暗示累积"""
        foreshadow = manager.plant(
            description="失踪的王冠",
            scene_id="scene-001",
        )

        # 添加多次暗示
        manager.hint(foreshadow.id, "scene-003", "仆人提到王冠")
        manager.hint(foreshadow.id, "scene-007", "发现王冠的碎片")
        updated = manager.hint(foreshadow.id, "scene-012", "找到线索")

        assert len(updated.hints) == 3
        assert updated.state == ForeshadowState.HINTED

    def test_harvest_transitions_to_harvested(self, manager):
        """测试回收转变为 HARVESTED 状态"""
        foreshadow = manager.plant(
            description="被诅咒的戒指",
            scene_id="scene-001",
        )
        manager.hint(foreshadow.id, "scene-005")

        # 回收
        harvested = manager.harvest(foreshadow.id, "scene-020")

        assert harvested is not None
        assert harvested.state == ForeshadowState.HARVESTED
        assert harvested.harvested_at == "scene-020"
        assert harvested.harvested_time is not None

    def test_cannot_hint_harvested_foreshadow(self, manager):
        """测试不能对已回收的伏笔添加暗示"""
        foreshadow = manager.plant("测试伏笔", "scene-001")
        manager.harvest(foreshadow.id, "scene-010")

        result = manager.hint(foreshadow.id, "scene-015")
        assert result is None

    def test_harvest_idempotent(self, manager):
        """测试重复回收是幂等的"""
        foreshadow = manager.plant("测试伏笔", "scene-001")
        first_harvest = manager.harvest(foreshadow.id, "scene-010")
        second_harvest = manager.harvest(foreshadow.id, "scene-020")

        assert first_harvest.harvested_at == second_harvest.harvested_at
        assert first_harvest.state == second_harvest.state


# ============================================================
# 回收提醒测试
# ============================================================

class TestHarvestReminders:
    """回收提醒测试"""

    def test_get_pending_returns_unharvested(self, manager):
        """测试获取待回收伏笔"""
        manager.plant("伏笔1", "scene-001", importance=5)
        manager.plant("伏笔2", "scene-002", importance=8)
        f3 = manager.plant("伏笔3", "scene-003", importance=3)
        manager.harvest(f3.id, "scene-010")

        pending = manager.get_pending()
        assert len(pending) == 2
        # 按重要性排序
        assert pending[0].importance >= pending[1].importance

    def test_get_overdue_with_threshold(self, manager):
        """测试获取过期伏笔"""
        # 注册场景顺序
        for i in range(20):
            manager.register_scene("default", f"scene-{i:03d}", i)

        # 埋设伏笔
        manager.plant("重要伏笔", "scene-001", importance=10)
        manager.plant("普通伏笔", "scene-005", importance=5)

        # 获取过期提醒
        reminders = manager.get_overdue(
            threshold=5,
            current_scene_id="scene-015",
        )

        assert len(reminders) >= 1
        assert all(r.urgency in ["critical", "high", "medium", "low"] for r in reminders)

    def test_overdue_urgency_calculation(self, manager):
        """测试过期紧急程度计算"""
        for i in range(50):
            manager.register_scene("default", f"scene-{i:03d}", i)

        # 埋设高重要性伏笔
        f = manager.plant("紧急伏笔", "scene-001", importance=10)

        reminders = manager.get_overdue(
            current_scene_id="scene-040",
        )

        # 应该有 critical 级别的提醒
        critical_reminders = [r for r in reminders if r.urgency == "critical"]
        assert len(critical_reminders) > 0


# ============================================================
# 规则引擎测试
# ============================================================

class TestRuleEngine:
    """规则引擎测试"""

    def test_scene_count_rule(self, sample_foreshadow):
        """测试场景计数规则"""
        rule = SceneCountRule(threshold_multiplier=1.0)

        # 超过阈值
        reminder = rule.evaluate(sample_foreshadow, 30, 0)
        assert reminder is not None
        assert reminder.urgency in ["critical", "high", "medium"]

        # 未超过阈值
        reminder = rule.evaluate(sample_foreshadow, 5, 0)
        assert reminder is None

    def test_no_hint_rule(self):
        """测试无暗示规则"""
        foreshadow = Foreshadow(
            id="test-002",
            description="无暗示伏笔",
            state=ForeshadowState.PLANTED,
            planted_at="scene-001",
            planted_time=datetime.now(),
            importance=5,
        )

        rule = NoHintRule(min_scenes_without_hint=5)

        # 超过阈值
        reminder = rule.evaluate(foreshadow, 10, 0)
        assert reminder is not None
        assert "暗示" in reminder.suggestion

        # 未超过阈值
        reminder = rule.evaluate(foreshadow, 3, 0)
        assert reminder is None

    def test_no_hint_rule_ignores_hinted(self):
        """测试无暗示规则忽略已暗示的伏笔"""
        foreshadow = Foreshadow(
            id="test-003",
            description="已暗示伏笔",
            state=ForeshadowState.HINTED,
            planted_at="scene-001",
            planted_time=datetime.now(),
            importance=5,
            hints=[ForeshadowHint("scene-005", "暗示", datetime.now())],
        )

        rule = NoHintRule()
        reminder = rule.evaluate(foreshadow, 20, 0)
        assert reminder is None

    def test_high_importance_rule(self):
        """测试高重要性规则"""
        high_importance = Foreshadow(
            id="test-004",
            description="核心伏笔",
            state=ForeshadowState.PLANTED,
            planted_at="scene-001",
            planted_time=datetime.now(),
            importance=9,
        )

        low_importance = Foreshadow(
            id="test-005",
            description="次要伏笔",
            state=ForeshadowState.PLANTED,
            planted_at="scene-001",
            planted_time=datetime.now(),
            importance=3,
        )

        rule = HighImportanceRule(importance_threshold=8, scene_threshold=3)

        # 高重要性触发
        reminder = rule.evaluate(high_importance, 5, 0)
        assert reminder is not None

        # 低重要性不触发
        reminder = rule.evaluate(low_importance, 5, 0)
        assert reminder is None

    def test_chapter_boundary_rule(self):
        """测试章节边界规则"""
        foreshadow = Foreshadow(
            id="test-006",
            description="跨章节伏笔",
            state=ForeshadowState.PLANTED,
            planted_at="scene-001",
            planted_time=datetime.now(),
            importance=5,
            metadata={"planted_chapter": 1, "current_chapter": 4},
        )

        rule = ChapterBoundaryRule(max_chapters_pending=2)

        reminder = rule.evaluate(foreshadow, 30, 0)
        assert reminder is not None
        assert "章节" in reminder.reason

    def test_rule_engine_default_rules(self):
        """测试规则引擎默认规则"""
        engine = ReminderRuleEngine()

        assert len(engine.rules) == 4
        rule_names = [r.name for r in engine.rules]
        assert "scene_count" in rule_names
        assert "no_hint" in rule_names
        assert "high_importance" in rule_names
        assert "chapter_boundary" in rule_names

    def test_rule_engine_add_remove(self):
        """测试规则引擎添加删除"""
        engine = ReminderRuleEngine()
        initial_count = len(engine.rules)

        # 添加规则
        custom_rule = SceneCountRule(threshold_multiplier=0.5, name="custom_scene")
        engine.add_rule(custom_rule)
        assert len(engine.rules) == initial_count + 1

        # 删除规则
        result = engine.remove_rule("custom_scene")
        assert result is True
        assert len(engine.rules) == initial_count

        # 删除不存在的规则
        result = engine.remove_rule("nonexistent")
        assert result is False


# ============================================================
# GraphManager 集成测试
# ============================================================

class TestGraphIntegration:
    """GraphManager 集成测试"""

    def test_integration_without_graph_manager(self, manager):
        """测试无 GraphManager 时的行为"""
        integration = ForeshadowGraphIntegration(manager)

        foreshadow = manager.plant("测试伏笔", "scene-001")
        result = integration.sync_foreshadow_to_graph(foreshadow)

        assert result is None

    def test_set_graph_manager(self, manager):
        """测试设置 GraphManager"""
        integration = ForeshadowGraphIntegration(manager)
        mock_gm = MagicMock()

        integration.set_graph_manager(mock_gm)
        assert integration.gm == mock_gm

    def test_find_related_without_graph_manager(self, manager):
        """测试无 GraphManager 时查找相关伏笔"""
        integration = ForeshadowGraphIntegration(manager)

        result = integration.find_related_foreshadows("entity-001")
        assert result == []

    def test_get_network_without_graph_manager(self, manager):
        """测试无 GraphManager 时获取网络"""
        integration = ForeshadowGraphIntegration(manager)

        result = integration.get_foreshadow_network("test-id")
        assert "error" in result


# ============================================================
# EnhancedForeshadowingManager 测试
# ============================================================

class TestEnhancedManager:
    """增强型管理器测试"""

    def test_plant_with_sync_disabled(self, enhanced_manager):
        """测试禁用同步的埋设"""
        foreshadow = enhanced_manager.plant(
            description="测试伏笔",
            scene_id="scene-001",
            sync_to_graph=False,
        )

        assert foreshadow is not None
        assert foreshadow.state == ForeshadowState.PLANTED

    def test_get_reminders_with_rules(self, enhanced_manager):
        """测试使用规则引擎获取提醒"""
        # 注册场景
        for i in range(30):
            enhanced_manager.register_scene("default", f"scene-{i:03d}", i)

        # 埋设伏笔
        enhanced_manager.plant(
            "重要伏笔",
            "scene-001",
            importance=9,
        )
        enhanced_manager.plant(
            "普通伏笔",
            "scene-005",
            importance=5,
        )

        reminders = enhanced_manager.get_reminders_with_rules(
            current_scene_id="scene-025",
        )

        assert isinstance(reminders, list)

    def test_analyze_foreshadow_health(self, enhanced_manager):
        """测试健康分析"""
        # 创建一些伏笔
        f1 = enhanced_manager.plant("伏笔1", "scene-001", importance=8)
        f2 = enhanced_manager.plant("伏笔2", "scene-002", importance=5)
        enhanced_manager.hint(f1.id, "scene-005")
        enhanced_manager.harvest(f2.id, "scene-010")

        health = enhanced_manager.analyze_foreshadow_health()

        assert "health_score" in health
        assert "stats" in health
        assert "metrics" in health
        assert "recommendations" in health
        assert 0 <= health["health_score"] <= 100


# ============================================================
# 数据序列化测试
# ============================================================

class TestSerialization:
    """数据序列化测试"""

    def test_foreshadow_to_dict(self, sample_foreshadow):
        """测试伏笔转字典"""
        data = sample_foreshadow.to_dict()

        assert data["id"] == "test-001"
        assert data["description"] == "神秘的金色钥匙"
        assert data["state"] == "planted"
        assert data["importance"] == 7
        assert "mystery" in data["tags"]

    def test_foreshadow_from_dict(self):
        """测试从字典创建伏笔"""
        data = {
            "id": "test-from-dict",
            "description": "从字典创建的伏笔",
            "state": "hinted",
            "planted_at": "scene-001",
            "planted_time": "2024-01-15T10:30:00",
            "hints": [
                {
                    "scene_id": "scene-005",
                    "description": "暗示内容",
                    "timestamp": "2024-01-16T14:00:00",
                }
            ],
            "importance": 6,
            "tags": ["test"],
        }

        foreshadow = Foreshadow.from_dict(data)

        assert foreshadow.id == "test-from-dict"
        assert foreshadow.state == ForeshadowState.HINTED
        assert len(foreshadow.hints) == 1

    def test_lifecycle_summary(self, manager):
        """测试生命周期摘要"""
        f = manager.plant("完整生命周期伏笔", "scene-001", importance=7)
        manager.hint(f.id, "scene-005", "第一次暗示")
        manager.hint(f.id, "scene-010", "第二次暗示")
        manager.harvest(f.id, "scene-020")

        summary = manager.get_lifecycle_summary(f.id)

        assert summary is not None
        assert summary["current_state"] == "harvested"
        assert len(summary["lifecycle"]) == 4  # planted + 2 hints + harvested


# ============================================================
# 场景管理测试
# ============================================================

class TestSceneManagement:
    """场景管理测试"""

    def test_register_scene(self, manager):
        """测试注册场景"""
        manager.register_scene("story-001", "scene-001", 1)
        manager.register_scene("story-001", "scene-002", 2)

        # 验证注册
        seq = manager._get_scene_sequence("story-001", "scene-001")
        assert seq == 1

    def test_get_foreshadows_at_scene(self, manager):
        """测试获取场景相关伏笔"""
        # 在场景1埋设
        f1 = manager.plant("伏笔1", "scene-001")
        f2 = manager.plant("伏笔2", "scene-001")

        # 在场景5暗示
        manager.hint(f1.id, "scene-005")

        # 在场景10回收
        manager.harvest(f2.id, "scene-010")

        # 获取场景1的伏笔
        scene1_foreshadows = manager.get_foreshadows_at_scene("scene-001")
        assert len(scene1_foreshadows["planted"]) == 2

        # 获取场景5的伏笔
        scene5_foreshadows = manager.get_foreshadows_at_scene("scene-005")
        assert len(scene5_foreshadows["hinted"]) == 1

        # 获取场景10的伏笔
        scene10_foreshadows = manager.get_foreshadows_at_scene("scene-010")
        assert len(scene10_foreshadows["harvested"]) == 1


# ============================================================
# 统计测试
# ============================================================

class TestStatistics:
    """统计测试"""

    def test_get_stats(self, manager):
        """测试获取统计信息"""
        # 创建伏笔
        f1 = manager.plant("伏笔1", "scene-001", importance=8)
        f2 = manager.plant("伏笔2", "scene-002", importance=5)
        manager.hint(f1.id, "scene-005")
        manager.harvest(f2.id, "scene-010")

        stats = manager.get_stats()

        assert stats["total"] == 2
        assert stats["by_state"]["hinted"] == 1
        assert stats["by_state"]["harvested"] == 1
        assert stats["total_hints"] == 1
        assert 0 <= stats["harvest_rate"] <= 100


# ============================================================
# 边界条件测试
# ============================================================

class TestEdgeCases:
    """边界条件测试"""

    def test_get_nonexistent_foreshadow(self, manager):
        """测试获取不存在的伏笔"""
        result = manager.get("nonexistent-id")
        assert result is None

    def test_hint_nonexistent_foreshadow(self, manager):
        """测试对不存在的伏笔添加暗示"""
        result = manager.hint("nonexistent-id", "scene-001")
        assert result is None

    def test_harvest_nonexistent_foreshadow(self, manager):
        """测试回收不存在的伏笔"""
        result = manager.harvest("nonexistent-id", "scene-001")
        assert result is None

    def test_importance_clamping(self, manager):
        """测试重要程度边界值"""
        f1 = manager.plant("低重要性", "scene-001", importance=-5)
        f2 = manager.plant("高重要性", "scene-002", importance=100)

        assert f1.importance == 1  # 最小值
        assert f2.importance == 10  # 最大值

    def test_delete_foreshadow(self, manager):
        """测试删除伏笔"""
        f = manager.plant("待删除伏笔", "scene-001")
        manager.hint(f.id, "scene-005")

        result = manager.delete(f.id)
        assert result is True

        # 验证已删除
        assert manager.get(f.id) is None

    def test_search_foreshadows(self, manager):
        """测试搜索伏笔"""
        manager.plant("神秘的钥匙", "scene-001", tags=["mystery"])
        manager.plant("魔法书籍", "scene-002", tags=["magic"])
        manager.plant("神秘的项链", "scene-003", tags=["mystery"])

        # 按关键词搜索
        results = manager.search("神秘")
        assert len(results) == 2

        # 按标签搜索
        results = manager.search("", tags=["mystery"])
        assert len(results) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
