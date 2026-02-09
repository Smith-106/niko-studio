"""
P6 知识层测试

测试 GraphEngine 和向量搜索核心功能。
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from src.graph.graph_engine import GraphEngine, Entity, Relation


class TestGraphEngineLifecycle:
    """GraphEngine 生命周期测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.fixture
    def engine(self, temp_db):
        """GraphEngine 实例"""
        engine = GraphEngine(db_path=temp_db)
        yield engine
        engine.close()

    def test_init_creates_schema(self, engine):
        """测试初始化创建 Schema"""
        # 检查 entities 表存在
        cursor = engine.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='entities'"
        )
        assert cursor.fetchone() is not None

        # 检查 relations 表存在
        cursor = engine.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='relations'"
        )
        assert cursor.fetchone() is not None

    def test_init_creates_indexes(self, engine):
        """测试初始化创建索引"""
        cursor = engine.db.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        )
        indexes = [row[0] for row in cursor.fetchall()]

        assert "idx_entities_type" in indexes
        assert "idx_entities_name" in indexes
        assert "idx_relations_from" in indexes

    @pytest.mark.asyncio
    async def test_health_check_returns_status(self, engine):
        """测试健康检查返回状态"""
        status = await engine.health_check()

        assert "engine" in status
        assert "db_ok" in status
        assert status["db_ok"] is True


class TestGraphEngineEntities:
    """GraphEngine 实体操作测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.fixture
    def engine(self, temp_db):
        """GraphEngine 实例"""
        engine = GraphEngine(db_path=temp_db)
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_create_entity(self, engine):
        """测试创建实体"""
        result = await engine.create_entity(
            entity_type="Character",
            name="张三",
            properties={"age": 25, "role": "主角"}
        )

        assert result["status"] == "created"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_create_entity_invalid_type(self, engine):
        """测试创建无效类型实体"""
        result = await engine.create_entity(
            entity_type="InvalidType",
            name="测试",
        )

        assert "error" in result

    @pytest.mark.asyncio
    async def test_get_character(self, engine):
        """测试获取角色"""
        await engine.create_entity("Character", "李四", {"age": 30})

        result = await engine.get_character("李四")

        assert result["name"] == "李四"
        assert result["type"] == "Character"
        assert result["properties"]["age"] == 30

    @pytest.mark.asyncio
    async def test_get_character_not_found(self, engine):
        """测试获取不存在的角色"""
        result = await engine.get_character("不存在的角色")

        assert "error" in result

    @pytest.mark.asyncio
    async def test_update_entity(self, engine):
        """测试更新实体"""
        await engine.create_entity("Character", "王五", {"age": 20})

        result = await engine.update_entity("王五", {"age": 21, "status": "active"})

        assert result["status"] == "updated"
        assert result["properties"]["age"] == 21
        assert result["properties"]["status"] == "active"

    @pytest.mark.asyncio
    async def test_delete_entity(self, engine):
        """测试删除实体"""
        await engine.create_entity("Character", "赵六", {})

        result = await engine.delete_entity("赵六")
        assert result["status"] == "deleted"

        # 验证已删除
        check = await engine.get_character("赵六")
        assert "error" in check


class TestGraphEngineRelations:
    """GraphEngine 关系操作测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.fixture
    def engine_with_entities(self, temp_db):
        """预填充实体的 Engine"""
        engine = GraphEngine(db_path=temp_db)

        async def setup():
            await engine.create_entity("Character", "角色A", {})
            await engine.create_entity("Character", "角色B", {})
            await engine.create_entity("Location", "地点X", {})

        import asyncio
        asyncio.get_event_loop().run_until_complete(setup())
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_create_relation(self, engine_with_entities):
        """测试创建关系"""
        result = await engine_with_entities.create_relation(
            from_name="角色A",
            to_name="角色B",
            relation_type="KNOWS",
            properties={"since": "2020"}
        )

        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_create_relation_missing_entity(self, engine_with_entities):
        """测试创建关系时实体不存在"""
        result = await engine_with_entities.create_relation(
            from_name="角色A",
            to_name="不存在",
            relation_type="KNOWS",
        )

        assert "error" in result

    @pytest.mark.asyncio
    async def test_get_relationships(self, engine_with_entities):
        """测试获取关系"""
        await engine_with_entities.create_relation("角色A", "角色B", "FRIEND")
        await engine_with_entities.create_relation("角色A", "地点X", "LIVES_IN")

        relations = await engine_with_entities.get_relationships("角色A")

        assert len(relations) == 2


class TestGraphEngineCypher:
    """GraphEngine Cypher 查询测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.fixture
    def engine_with_data(self, temp_db):
        """预填充数据的 Engine"""
        engine = GraphEngine(db_path=temp_db)

        async def setup():
            await engine.create_entity("Character", "主角", {"role": "protagonist"})
            await engine.create_entity("Character", "反派", {"role": "antagonist"})

        import asyncio
        asyncio.get_event_loop().run_until_complete(setup())
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_execute_cypher_match_by_type(self, engine_with_data):
        """测试 Cypher MATCH 按类型查询"""
        result = await engine_with_data.execute_cypher(
            "MATCH (n:Character) RETURN n"
        )

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_execute_cypher_match_by_name(self, engine_with_data):
        """测试 Cypher MATCH 按名称查询"""
        result = await engine_with_data.execute_cypher(
            "MATCH (n:Character) WHERE n.name = '主角' RETURN n"
        )

        assert len(result) == 1
        assert result[0]["name"] == "主角"

    @pytest.mark.asyncio
    async def test_execute_cypher_empty_result(self, engine_with_data):
        """测试 Cypher 空结果"""
        result = await engine_with_data.execute_cypher(
            "MATCH (n:Character) WHERE n.name = '不存在' RETURN n"
        )

        assert len(result) == 0


class TestGraphEnginePlugins:
    """GraphEngine 插件系统测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.mark.asyncio
    async def test_plugin_registered(self, temp_db):
        """测试插件注册"""
        mock_plugin = MagicMock()
        mock_plugin.name = "test_plugin"
        mock_plugin.load = AsyncMock()
        mock_plugin.health_check = AsyncMock(return_value={"status": "ok"})

        engine = GraphEngine(db_path=temp_db, plugins=[mock_plugin])

        assert len(engine.plugins) == 1
        assert engine.plugins[0].name == "test_plugin"

        engine.close()

    @pytest.mark.asyncio
    async def test_plugin_load_called(self, temp_db):
        """测试插件加载被调用"""
        mock_plugin = MagicMock()
        mock_plugin.name = "test_plugin"
        mock_plugin.load = AsyncMock()
        mock_plugin.health_check = AsyncMock(return_value={"status": "ok"})

        engine = GraphEngine(db_path=temp_db, plugins=[mock_plugin])
        await engine.initialize()

        mock_plugin.load.assert_called_once_with(engine)

        engine.close()

    @pytest.mark.asyncio
    async def test_plugin_health_check(self, temp_db):
        """测试插件健康检查"""
        mock_plugin = MagicMock()
        mock_plugin.name = "test_plugin"
        mock_plugin.load = AsyncMock()
        mock_plugin.health_check = AsyncMock(return_value={"status": "healthy"})

        engine = GraphEngine(db_path=temp_db, plugins=[mock_plugin])
        await engine.initialize()

        status = await engine.health_check()

        assert "plugins" in status
        assert "test_plugin" in status["plugins"]
        assert status["plugins"]["test_plugin"]["status"] == "healthy"

        engine.close()


class TestGraphEngineForeshadows:
    """GraphEngine 伏笔系统测试"""

    @pytest.fixture
    def temp_db(self):
        """临时数据库"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        yield db_path
        if os.path.exists(db_path):
            os.unlink(db_path)

    @pytest.fixture
    def engine_with_foreshadows(self, temp_db):
        """预填充伏笔的 Engine"""
        engine = GraphEngine(db_path=temp_db)

        async def setup():
            await engine.create_entity("Foreshadow", "伏笔1", {
                "status": "pending",
                "planted_chapter": 1
            })
            await engine.create_entity("Foreshadow", "伏笔2", {
                "status": "resolved",
                "planted_chapter": 2
            })
            await engine.create_entity("Foreshadow", "伏笔3", {
                "status": "pending",
                "planted_chapter": 5
            })

        import asyncio
        asyncio.get_event_loop().run_until_complete(setup())
        yield engine
        engine.close()

    @pytest.mark.asyncio
    async def test_get_pending_foreshadows(self, engine_with_foreshadows):
        """测试获取待处理伏笔"""
        foreshadows = await engine_with_foreshadows.get_foreshadows(status="pending")

        assert len(foreshadows) == 2

    @pytest.mark.asyncio
    async def test_get_foreshadows_by_chapter(self, engine_with_foreshadows):
        """测试按章节获取伏笔"""
        foreshadows = await engine_with_foreshadows.get_foreshadows(
            status="pending",
            chapter=3
        )

        # 只有 planted_chapter <= 3 的
        assert len(foreshadows) == 1
        assert foreshadows[0]["name"] == "伏笔1"
