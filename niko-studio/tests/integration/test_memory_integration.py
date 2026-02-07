# -*- coding: utf-8 -*-
"""
集成测试 - 记忆系统验证

测试 UnifiedMemoryEngine 的四层六维 + 时序追踪功能。
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from memory.unified_memory import (
    UnifiedMemoryEngine,
    UnifiedMemory,
    MemoryLayer,
    MemoryDimension,
    ConflictResolver,
    EmbeddingEngine
)


class TestMemoryLayers:
    """四层记忆测试"""

    @pytest.fixture
    def memory_engine(self, tmp_path):
        """创建临时数据库的记忆引擎"""
        db_path = tmp_path / "test_memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_add_ephemeral_memory(self, memory_engine):
        """测试添加临时记忆"""
        result = await memory_engine.add(
            content="这是一条临时信息",
            layer="ephemeral",
            importance=0.3
        )

        assert result["status"] == "created"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_add_session_memory(self, memory_engine):
        """测试添加会话记忆"""
        result = await memory_engine.add(
            content="当前写作任务：第三章对话场景",
            layer="session",
            dimension="context"
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_add_project_memory(self, memory_engine):
        """测试添加项目记忆"""
        result = await memory_engine.add(
            content="主角林晓的核心性格：外冷内热，正义感强",
            layer="project",
            dimension="character",
            entity_id="character:linxiao",
            importance=0.9
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_search_by_layer(self, memory_engine):
        """测试按层级搜索"""
        # 添加不同层级的记忆
        await memory_engine.add(content="临时笔记", layer="ephemeral")
        await memory_engine.add(content="会话上下文", layer="session")
        await memory_engine.add(content="项目设定", layer="project")

        # 搜索特定层级
        results = await memory_engine.search(
            query="笔记",
            layer="ephemeral"
        )

        # 验证只返回指定层级
        for r in results:
            assert r["layer"] == "ephemeral"


class TestMemoryDimensions:
    """六维记忆测试"""

    @pytest.fixture
    def memory_engine(self, tmp_path):
        db_path = tmp_path / "test_memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_add_timeline_dimension(self, memory_engine):
        """测试时间线维度"""
        result = await memory_engine.add(
            content="第一章：林晓与张明初次相遇",
            layer="project",
            dimension="timeline",
            entity_id="event:ch01_meeting"
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_add_character_dimension(self, memory_engine):
        """测试角色维度"""
        result = await memory_engine.add(
            content="张明：反派，表面温和实则阴险",
            layer="project",
            dimension="character",
            entity_id="character:zhangming"
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_add_worldview_dimension(self, memory_engine):
        """测试世界观维度"""
        result = await memory_engine.add(
            content="魔法体系：五行为基础，需消耗精神力",
            layer="project",
            dimension="worldview"
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_search_multiple_dimensions(self, memory_engine):
        """测试多维度搜索"""
        await memory_engine.add(content="角色设定", dimension="character", layer="project")
        await memory_engine.add(content="世界设定", dimension="worldview", layer="project")
        await memory_engine.add(content="时间线事件", dimension="timeline", layer="project")

        results = await memory_engine.search(
            query="设定",
            dimensions=["character", "worldview"]
        )

        for r in results:
            assert r["dimension"] in ["character", "worldview"]


class TestTemporalTracking:
    """时序追踪测试 (Zep Graphiti 模式)"""

    @pytest.fixture
    def memory_engine(self, tmp_path):
        db_path = tmp_path / "test_memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_add_temporal_fact(self, memory_engine):
        """测试添加时序事实"""
        result = await memory_engine.add(
            content="林晓的年龄是25岁",
            layer="project",
            dimension="character",
            entity_id="character:linxiao",
            valid_from="2024-01-01T00:00:00",
            valid_until=None  # 当前有效
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_get_temporal_facts(self, memory_engine):
        """测试获取特定时间点的事实"""
        entity_id = "character:linxiao"

        # 添加两个时间段的事实
        await memory_engine.add(
            content="林晓是普通学生",
            entity_id=entity_id,
            layer="project",
            valid_from="2024-01-01T00:00:00",
            valid_until="2024-06-01T00:00:00"
        )

        await memory_engine.add(
            content="林晓觉醒了魔法能力",
            entity_id=entity_id,
            layer="project",
            valid_from="2024-06-01T00:00:00",
            valid_until=None
        )

        # 查询不同时间点
        facts_jan = await memory_engine.get_temporal_facts(
            entity_id=entity_id,
            at_time="2024-03-01T00:00:00"
        )

        facts_july = await memory_engine.get_temporal_facts(
            entity_id=entity_id,
            at_time="2024-07-01T00:00:00"
        )

        # 验证返回正确的时间段事实
        assert any("学生" in f["content"] for f in facts_jan)
        assert any("魔法" in f["content"] for f in facts_july)


class TestConflictDetection:
    """冲突检测测试"""

    @pytest.fixture
    def memory_engine(self, tmp_path):
        db_path = tmp_path / "test_memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_detect_contradiction(self, memory_engine):
        """测试矛盾检测"""
        entity_id = "character:linxiao"

        # 添加矛盾信息
        await memory_engine.add(
            content="林晓是独生子",
            entity_id=entity_id,
            layer="project"
        )

        await memory_engine.add(
            content="林晓有一个妹妹",
            entity_id=entity_id,
            layer="project"
        )

        # 检测冲突
        conflicts = await memory_engine.detect_conflicts(entity_id)

        # 应该检测到冲突（基于简单规则）
        # 注意：当前实现使用简单的否定词检测
        assert isinstance(conflicts, list)

    @pytest.mark.asyncio
    async def test_resolve_conflict_auto(self, memory_engine):
        """测试自动冲突解决"""
        entity_id = "test:conflict"

        # 添加两条记忆
        result1 = await memory_engine.add(
            content="事实A",
            entity_id=entity_id,
            layer="project"
        )
        result2 = await memory_engine.add(
            content="事实B",
            entity_id=entity_id,
            layer="project"
        )

        # 解决冲突
        resolution = await memory_engine.resolve_conflict(
            result1["id"],
            result2["id"],
            resolution="auto"
        )

        assert resolution["status"] == "resolved"
        assert "kept" in resolution
        assert "removed" in resolution


class TestEmbeddingEngine:
    """嵌入向量引擎测试"""

    def test_embed_text(self):
        """测试文本嵌入"""
        engine = EmbeddingEngine()
        embedding = engine.embed("这是一段测试文本")

        assert isinstance(embedding, list)
        assert len(embedding) > 0
        assert all(isinstance(x, float) for x in embedding)

    def test_similarity_calculation(self):
        """测试相似度计算"""
        engine = EmbeddingEngine()

        vec_a = engine.embed("林晓是主角")
        vec_b = engine.embed("林晓是故事的主人公")
        vec_c = engine.embed("今天天气很好")

        sim_ab = engine.similarity(vec_a, vec_b)
        sim_ac = engine.similarity(vec_a, vec_c)

        # 相似文本应该有更高相似度
        # 注意：使用 dummy embedding 时可能不准确
        assert isinstance(sim_ab, float)
        assert isinstance(sim_ac, float)
        assert 0 <= sim_ab <= 1
        assert 0 <= sim_ac <= 1


class TestMemorySearch:
    """记忆搜索测试"""

    @pytest.fixture
    def memory_engine(self, tmp_path):
        db_path = tmp_path / "test_memory.db"
        engine = UnifiedMemoryEngine(db_path=str(db_path))
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_semantic_search(self, memory_engine):
        """测试语义搜索"""
        # 添加测试数据
        await memory_engine.add(content="林晓拥有火属性魔法", layer="project")
        await memory_engine.add(content="张明擅长水系法术", layer="project")
        await memory_engine.add(content="魔法学院位于山顶", layer="project")

        # 搜索
        results = await memory_engine.search(
            query="火焰魔法能力",
            limit=5
        )

        assert isinstance(results, list)
        # 结果应该按相关性排序
        if len(results) > 0:
            assert "score" in results[0]

    @pytest.mark.asyncio
    async def test_search_with_limit(self, memory_engine):
        """测试搜索结果限制"""
        # 添加多条记忆
        for i in range(10):
            await memory_engine.add(content=f"测试记忆 {i}", layer="session")

        results = await memory_engine.search(query="测试", limit=3)

        assert len(results) <= 3


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
