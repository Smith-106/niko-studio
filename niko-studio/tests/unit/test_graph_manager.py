"""
GraphManager 单元测试

测试知识图谱管理器的核心功能：
1. Cypher 查询执行
2. 实体统计
3. 关联实体查找
4. CRUD 操作
5. 图算法
"""

import json
import pytest
import tempfile
from pathlib import Path
from datetime import datetime

from src.graph.graph_manager import GraphManager, CypherParser
from docs.contracts.graph_contracts import (
    Entity,
    EntityStats,
    EntityType,
    GraphPath,
    Relationship,
    RelationType,
    SubGraph,
)


@pytest.fixture
def temp_db():
    """创建临时数据库"""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        yield f.name
    Path(f.name).unlink(missing_ok=True)


@pytest.fixture
def graph_manager(temp_db):
    """创建 GraphManager 实例"""
    manager = GraphManager(db_path=temp_db)
    yield manager
    manager.close()


@pytest.fixture
def sample_entities():
    """创建示例实体"""
    return [
        Entity(
            id="char-001",
            name="Zhang San",
            type=EntityType.CHARACTER,
            properties={"age": 25, "occupation": "detective"},
        ),
        Entity(
            id="char-002",
            name="Li Si",
            type=EntityType.CHARACTER,
            properties={"age": 30, "occupation": "doctor"},
        ),
        Entity(
            id="loc-001",
            name="Beijing",
            type=EntityType.LOCATION,
            properties={"country": "China"},
        ),
        Entity(
            id="event-001",
            name="Murder Case",
            type=EntityType.EVENT,
            properties={"date": "2026-01-15"},
        ),
    ]


@pytest.fixture
def sample_relationships():
    """创建示例关系"""
    return [
        Relationship(
            id="rel-001",
            source_id="char-001",
            target_id="char-002",
            type=RelationType.KNOWS,
            properties={"since": "2020"},
            weight=1.0,
        ),
        Relationship(
            id="rel-002",
            source_id="char-001",
            target_id="loc-001",
            type=RelationType.LOCATED_IN,
            properties={},
            weight=1.0,
        ),
        Relationship(
            id="rel-003",
            source_id="char-001",
            target_id="event-001",
            type=RelationType.PARTICIPATES,
            properties={"role": "investigator"},
            weight=1.0,
        ),
    ]


class TestCypherParser:
    """CypherParser 测试"""

    def test_parse_simple_match(self):
        """测试简单 MATCH 查询解析"""
        query = "MATCH (n:Character) RETURN n"
        parsed = CypherParser.parse(query)

        assert parsed["type"] == "MATCH"
        assert len(parsed["nodes"]) == 1
        assert parsed["nodes"][0]["label"] == "Character"
        assert parsed["nodes"][0]["alias"] == "n"

    def test_parse_match_with_where(self):
        """测试带 WHERE 的 MATCH 查询"""
        query = "MATCH (n:Character) WHERE n.name = 'Zhang San' RETURN n"
        parsed = CypherParser.parse(query)

        assert parsed["type"] == "MATCH"
        assert "n.name = 'Zhang San'" in parsed["where"]

    def test_parse_match_with_limit(self):
        """测试带 LIMIT 的查询"""
        query = "MATCH (n:Character) RETURN n LIMIT 10"
        parsed = CypherParser.parse(query)

        assert parsed["limit"] == 10

    def test_parse_relationship_pattern(self):
        """测试关系模式解析"""
        query = "MATCH (a:Character)-[r:KNOWS]->(b:Character) RETURN a, r, b"
        parsed = CypherParser.parse(query)

        assert parsed["type"] == "MATCH"
        assert len(parsed["nodes"]) == 2
        assert len(parsed["relationships"]) == 1
        assert parsed["relationships"][0]["type"] == "KNOWS"

    def test_parse_create(self):
        """测试 CREATE 查询解析"""
        query = "CREATE (n:Character {name: 'Test'})"
        parsed = CypherParser.parse(query)

        assert parsed["type"] == "CREATE"
        assert len(parsed["nodes"]) == 1

    def test_parse_props(self):
        """测试属性解析"""
        props_str = "name: 'John', age: 25, active: true"
        props = CypherParser._parse_props(props_str)

        assert props["name"] == "John"
        assert props["age"] == 25
        assert props["active"] is True


class TestGraphManagerCRUD:
    """GraphManager CRUD 操作测试"""

    def test_create_entity(self, graph_manager, sample_entities):
        """测试创建实体"""
        entity = sample_entities[0]
        entity_id = graph_manager.create_entity(entity)

        assert entity_id == "char-001"

        # 验证实体已创建
        retrieved = graph_manager.get_entity(entity_id)
        assert retrieved is not None
        assert retrieved.name == "Zhang San"
        assert retrieved.type == EntityType.CHARACTER

    def test_get_entity_not_found(self, graph_manager):
        """测试获取不存在的实体"""
        entity = graph_manager.get_entity("non-existent-id")
        assert entity is None

    def test_update_entity(self, graph_manager, sample_entities):
        """测试更新实体"""
        entity = sample_entities[0]
        graph_manager.create_entity(entity)

        # 更新实体
        entity.name = "Zhang San Updated"
        entity.properties["age"] = 26
        success = graph_manager.update_entity(entity)

        assert success is True

        # 验证更新
        updated = graph_manager.get_entity(entity.id)
        assert updated.name == "Zhang San Updated"
        assert updated.properties["age"] == 26

    def test_delete_entity(self, graph_manager, sample_entities):
        """测试删除实体"""
        entity = sample_entities[0]
        graph_manager.create_entity(entity)

        success = graph_manager.delete_entity(entity.id)
        assert success is True

        # 验证删除
        deleted = graph_manager.get_entity(entity.id)
        assert deleted is None

    def test_delete_entity_cascades_relationships(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试删除实体时级联删除关系"""
        # 创建实体
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)

        # 创建关系
        graph_manager.create_relationship(sample_relationships[0])

        # 删除实体
        graph_manager.delete_entity("char-001")

        # 验证关系也被删除
        rels = graph_manager.get_relationships("char-002")
        assert len(rels) == 0


class TestGraphManagerRelationships:
    """GraphManager 关系操作测试"""

    def test_create_relationship(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试创建关系"""
        # 先创建实体
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)

        # 创建关系
        rel = sample_relationships[0]
        rel_id = graph_manager.create_relationship(rel)

        assert rel_id == "rel-001"

    def test_get_relationships_both_directions(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试获取双向关系"""
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)
        graph_manager.create_relationship(sample_relationships[0])

        # 从 source 获取
        rels = graph_manager.get_relationships("char-001", direction="both")
        assert len(rels) == 1

        # 从 target 获取
        rels = graph_manager.get_relationships("char-002", direction="both")
        assert len(rels) == 1

    def test_get_relationships_outgoing(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试获取出向关系"""
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)
        graph_manager.create_relationship(sample_relationships[0])

        rels = graph_manager.get_relationships("char-001", direction="out")
        assert len(rels) == 1

        rels = graph_manager.get_relationships("char-002", direction="out")
        assert len(rels) == 0

    def test_delete_relationship(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试删除关系"""
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)
        graph_manager.create_relationship(sample_relationships[0])

        success = graph_manager.delete_relationship("rel-001")
        assert success is True

        rels = graph_manager.get_relationships("char-001")
        assert len(rels) == 0


class TestRunCypher:
    """run_cypher 方法测试"""

    def test_run_cypher_match_all(self, graph_manager, sample_entities):
        """测试 MATCH 查询所有实体"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.run_cypher("MATCH (n:Character) RETURN n")

        assert len(results) == 2  # Zhang San and Li Si

    def test_run_cypher_match_with_where(self, graph_manager, sample_entities):
        """测试带 WHERE 条件的 MATCH"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.run_cypher(
            "MATCH (n:Character) WHERE n.name = 'Zhang San' RETURN n"
        )

        assert len(results) == 1
        assert results[0]["n"]["name"] == "Zhang San"

    def test_run_cypher_match_with_limit(self, graph_manager, sample_entities):
        """测试带 LIMIT 的 MATCH"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.run_cypher("MATCH (n:Character) RETURN n LIMIT 1")

        assert len(results) == 1

    def test_run_cypher_relationship_match(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试关系模式匹配"""
        for entity in sample_entities[:2]:
            graph_manager.create_entity(entity)
        graph_manager.create_relationship(sample_relationships[0])

        results = graph_manager.run_cypher(
            "MATCH (a:Character)-[r:KNOWS]->(b:Character) RETURN a, r, b"
        )

        assert len(results) == 1
        assert results[0]["source"]["name"] == "Zhang San"
        assert results[0]["target"]["name"] == "Li Si"
        assert results[0]["relationship"]["type"] == "KNOWS"

    def test_run_cypher_create(self, graph_manager):
        """测试 CREATE 查询"""
        results = graph_manager.run_cypher(
            "CREATE (n:Character {name: 'New Character'})"
        )

        assert len(results) == 1
        assert "created" in results[0]

        # 验证实体已创建
        stats = graph_manager.get_entity_stats()
        assert stats.total_entities == 1

    def test_run_cypher_invalid_query(self, graph_manager):
        """测试无效查询处理"""
        results = graph_manager.run_cypher("INVALID QUERY SYNTAX")

        assert len(results) == 1
        assert "error" in results[0]


class TestGetEntityStats:
    """get_entity_stats 方法测试"""

    def test_empty_stats(self, graph_manager):
        """测试空数据库统计"""
        stats = graph_manager.get_entity_stats()

        assert isinstance(stats, EntityStats)
        assert stats.total_entities == 0
        assert stats.total_relationships == 0
        assert stats.entities_by_type == {}
        assert stats.relationships_by_type == {}
        assert stats.avg_connections_per_entity == 0.0

    def test_stats_with_entities(self, graph_manager, sample_entities):
        """测试有实体时的统计"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        stats = graph_manager.get_entity_stats()

        assert stats.total_entities == 4
        assert stats.entities_by_type["character"] == 2
        assert stats.entities_by_type["location"] == 1
        assert stats.entities_by_type["event"] == 1

    def test_stats_with_relationships(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试有关系时的统计"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        stats = graph_manager.get_entity_stats()

        assert stats.total_relationships == 3
        assert stats.relationships_by_type["KNOWS"] == 1
        assert stats.relationships_by_type["LOCATED_IN"] == 1
        assert stats.relationships_by_type["PARTICIPATES"] == 1

    def test_avg_connections_calculation(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试平均连接数计算"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        stats = graph_manager.get_entity_stats()

        # 3 relationships * 2 (bidirectional) / 4 entities = 1.5
        expected_avg = (3 * 2) / 4
        assert stats.avg_connections_per_entity == round(expected_avg, 2)


class TestFindRelatedEntities:
    """find_related_entities 方法测试"""

    def test_find_direct_neighbors(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试查找直接邻居"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        related = graph_manager.find_related_entities("char-001", max_depth=1)

        assert len(related) == 3  # Li Si, Beijing, Murder Case

    def test_find_with_max_depth(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试深度限制"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        # depth=0 应该返回空
        related = graph_manager.find_related_entities("char-001", max_depth=0)
        assert len(related) == 0

    def test_find_with_limit(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试数量限制"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        related = graph_manager.find_related_entities(
            "char-001", max_depth=2, limit=2
        )

        assert len(related) <= 2

    def test_find_excludes_start_node(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试不包含起始节点"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        related = graph_manager.find_related_entities("char-001")

        # 起始节点不应在结果中
        related_ids = [e.id for e in related]
        assert "char-001" not in related_ids

    def test_find_no_duplicates(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试无重复节点"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        related = graph_manager.find_related_entities("char-001", max_depth=3)

        related_ids = [e.id for e in related]
        assert len(related_ids) == len(set(related_ids))


class TestGraphAlgorithms:
    """图算法测试"""

    def test_find_shortest_path(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试最短路径查找"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        # 创建路径: char-001 -> char-002 -> loc-001
        graph_manager.create_relationship(sample_relationships[0])  # char-001 -> char-002
        graph_manager.create_relationship(
            Relationship(
                id="rel-extra",
                source_id="char-002",
                target_id="loc-001",
                type=RelationType.LOCATED_IN,
                weight=1.0,
            )
        )

        path = graph_manager.find_shortest_path("char-001", "loc-001")

        assert path is not None
        assert isinstance(path, GraphPath)
        assert len(path.nodes) >= 2
        assert path.nodes[0].id == "char-001"
        assert path.nodes[-1].id == "loc-001"

    def test_find_shortest_path_same_node(self, graph_manager, sample_entities):
        """测试起点终点相同"""
        graph_manager.create_entity(sample_entities[0])

        path = graph_manager.find_shortest_path("char-001", "char-001")

        assert path is not None
        assert len(path.nodes) == 1
        assert len(path.edges) == 0
        assert path.total_weight == 0

    def test_find_shortest_path_no_path(
        self, graph_manager, sample_entities
    ):
        """测试无路径情况"""
        # 创建两个不连接的实体
        graph_manager.create_entity(sample_entities[0])
        graph_manager.create_entity(sample_entities[2])  # loc-001

        path = graph_manager.find_shortest_path("char-001", "loc-001")

        assert path is None

    def test_get_subgraph(
        self, graph_manager, sample_entities, sample_relationships
    ):
        """测试子图提取"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)
        for rel in sample_relationships:
            graph_manager.create_relationship(rel)

        subgraph = graph_manager.get_subgraph("char-001", radius=1)

        assert isinstance(subgraph, SubGraph)
        assert subgraph.center_entity_id == "char-001"
        assert len(subgraph.entities) >= 1  # 至少包含中心实体
        assert len(subgraph.relationships) >= 0


class TestSearchEntities:
    """实体搜索测试"""

    def test_search_by_name(self, graph_manager, sample_entities):
        """测试按名称搜索"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.search_entities("Zhang")

        assert len(results) >= 1
        assert any(e.name == "Zhang San" for e in results)

    def test_search_with_type_filter(self, graph_manager, sample_entities):
        """测试带类型过滤的搜索"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.search_entities(
            "Beijing", entity_type=EntityType.LOCATION
        )

        assert len(results) == 1
        assert results[0].type == EntityType.LOCATION

    def test_search_with_limit(self, graph_manager, sample_entities):
        """测试搜索数量限制"""
        for entity in sample_entities:
            graph_manager.create_entity(entity)

        results = graph_manager.search_entities("", limit=2)

        assert len(results) <= 2


class TestContextManager:
    """上下文管理器测试"""

    def test_context_manager(self, temp_db):
        """测试 with 语句"""
        with GraphManager(db_path=temp_db) as manager:
            entity = Entity(
                id="test-001",
                name="Test Entity",
                type=EntityType.CONCEPT,
            )
            manager.create_entity(entity)

            stats = manager.get_entity_stats()
            assert stats.total_entities == 1

        # 连接应该已关闭
        # 重新打开验证数据持久化
        with GraphManager(db_path=temp_db) as manager2:
            stats = manager2.get_entity_stats()
            assert stats.total_entities == 1


class TestIGraphServiceInterface:
    """验证 IGraphService 接口实现"""

    def test_implements_run_cypher(self, graph_manager):
        """验证 run_cypher 方法签名"""
        assert hasattr(graph_manager, "run_cypher")
        assert callable(graph_manager.run_cypher)

    def test_implements_get_entity_stats(self, graph_manager):
        """验证 get_entity_stats 方法签名"""
        assert hasattr(graph_manager, "get_entity_stats")
        assert callable(graph_manager.get_entity_stats)

        stats = graph_manager.get_entity_stats()
        assert isinstance(stats, EntityStats)

    def test_implements_find_related_entities(self, graph_manager):
        """验证 find_related_entities 方法签名"""
        assert hasattr(graph_manager, "find_related_entities")
        assert callable(graph_manager.find_related_entities)

    def test_implements_crud_methods(self, graph_manager):
        """验证 CRUD 方法"""
        assert hasattr(graph_manager, "create_entity")
        assert hasattr(graph_manager, "get_entity")
        assert hasattr(graph_manager, "update_entity")
        assert hasattr(graph_manager, "delete_entity")
        assert hasattr(graph_manager, "create_relationship")
        assert hasattr(graph_manager, "get_relationships")
        assert hasattr(graph_manager, "delete_relationship")

    def test_implements_graph_algorithms(self, graph_manager):
        """验证图算法方法"""
        assert hasattr(graph_manager, "find_shortest_path")
        assert hasattr(graph_manager, "get_subgraph")
        assert hasattr(graph_manager, "search_entities")
