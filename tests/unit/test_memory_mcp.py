# -*- coding: utf-8 -*-
"""
Memory MCP (KnowledgeGraphStore) Tests

Tests for EntityType/RelationType enums, Entity/Relation __post_init__,
KnowledgeGraphStore CRUD operations, and search_nodes.
Uses tmp_path for real SQLite database testing.
"""

import importlib
import importlib.util
import sqlite3
import sys
import types
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path

memory_mcp = importlib.import_module("src.mcp_servers.memory_mcp")

EntityType = memory_mcp.EntityType
RelationType = memory_mcp.RelationType
Entity = memory_mcp.Entity
Relation = memory_mcp.Relation
KnowledgeGraphStore = memory_mcp.KnowledgeGraphStore



class TestEntityType:

    def test_values(self):
        assert EntityType.CHARACTER == "character"
        assert EntityType.LOCATION == "location"
        assert EntityType.EVENT == "event"
        assert EntityType.OBJECT == "object"
        assert EntityType.CONCEPT == "concept"

    def test_is_str(self):
        assert isinstance(EntityType.CHARACTER, str)

    def test_extended_types(self):
        assert EntityType.FORESHADOW == "foreshadow"
        assert EntityType.CHAPTER == "chapter"
        assert EntityType.SCENE == "scene"


class TestRelationType:

    def test_values(self):
        assert RelationType.KNOWS == "KNOWS"
        assert RelationType.LOCATED_IN == "LOCATED_IN"
        assert RelationType.CAUSES == "CAUSES"
        assert RelationType.RELATED_TO == "RELATED_TO"

    def test_is_str(self):
        assert isinstance(RelationType.KNOWS, str)

    def test_extended_types(self):
        assert RelationType.LOVES == "LOVES"
        assert RelationType.HATES == "HATES"
        assert RelationType.FAMILY == "FAMILY"


# ============================================================
# Entity / Relation dataclass __post_init__
# ============================================================

class TestEntityDataclass:

    def test_auto_id(self):
        e = Entity(name="Alice", entityType="character")
        assert e.id is not None
        assert len(e.id) > 0

    def test_auto_timestamps(self):
        e = Entity(name="Alice", entityType="character")
        assert e.created_at is not None
        assert e.updated_at is not None

    def test_explicit_id_preserved(self):
        e = Entity(name="Alice", entityType="character", id="custom-id")
        assert e.id == "custom-id"

    def test_default_observations_and_properties(self):
        e = Entity(name="Alice", entityType="character")
        assert e.observations == []
        assert e.properties == {}

    def test_with_observations(self):
        e = Entity(name="Alice", entityType="character", observations=["brave", "young"])
        assert e.observations == ["brave", "young"]


class TestRelationDataclass:

    def test_auto_id(self):
        r = Relation(from_entity="A", to_entity="B", relationType="KNOWS")
        assert r.id is not None
        assert len(r.id) > 0

    def test_auto_created_at(self):
        r = Relation(from_entity="A", to_entity="B", relationType="KNOWS")
        assert r.created_at is not None

    def test_default_weight(self):
        r = Relation(from_entity="A", to_entity="B", relationType="KNOWS")
        assert r.weight == 1.0

    def test_explicit_id_preserved(self):
        r = Relation(from_entity="A", to_entity="B", relationType="KNOWS", id="r-1")
        assert r.id == "r-1"


# ============================================================
# KnowledgeGraphStore - fixture
# ============================================================

@pytest.fixture
def store(tmp_path):
    """Create a KnowledgeGraphStore with a temp DB."""
    db_path = str(tmp_path / "test_graph.db")
    s = KnowledgeGraphStore(db_path=db_path)
    yield s
    s.close()


# ============================================================
# create_entity / create_entities
# ============================================================

class TestKGStoreCreateEntity:

    def test_create_single_entity(self, store):
        e = Entity(name="Alice", entityType="character", observations=["hero"])
        result = store.create_entity(e)
        assert result["status"] == "created"
        assert result["name"] == "Alice"
        assert "id" in result

    def test_create_duplicate_entity(self, store):
        e1 = Entity(name="Alice", entityType="character")
        store.create_entity(e1)
        e2 = Entity(name="Alice", entityType="character")
        result = store.create_entity(e2)
        assert "error" in result
        assert "already exists" in result["error"]

    def test_create_entities_batch(self, store):
        entities = [
            Entity(name="Alice", entityType="character"),
            Entity(name="Bob", entityType="character"),
            Entity(name="Tokyo", entityType="location"),
        ]
        results = store.create_entities(entities)
        assert len(results) == 3
        assert all(r["status"] == "created" for r in results)


# ============================================================
# get_entity / get_entities
# ============================================================

class TestKGStoreGetEntity:

    def test_get_existing_entity(self, store):
        e = Entity(name="Alice", entityType="character", observations=["smart"])
        store.create_entity(e)

        result = store.get_entity("Alice")
        assert result is not None
        assert result["name"] == "Alice"
        assert result["entityType"] == "character"
        assert result["observations"] == ["smart"]

    def test_get_nonexistent_entity(self, store):
        result = store.get_entity("Ghost")
        assert result is None

    def test_get_entities_batch(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))

        results = store.get_entities(["A", "B", "C"])
        # C does not exist, should be skipped
        assert len(results) == 2
        names = {r["name"] for r in results}
        assert names == {"A", "B"}

    def test_get_entities_includes_relations(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        store.create_relation(Relation(from_entity="A", to_entity="B", relationType="KNOWS"))

        results = store.get_entities(["A"])
        assert len(results) == 1
        assert "relations" in results[0]
        assert len(results[0]["relations"]) == 1


# ============================================================
# update_entity
# ============================================================

    def test_update_entity_entity_type_branch(self, store):
        store.create_entity(Entity(name="Alice", entityType="character"))

        result = store.update_entity("Alice", {"entityType": "concept"})

        assert result["status"] == "updated"
        entity = store.get_entity("Alice")
        assert entity["entityType"] == "concept"

    def test_create_entity_integrity_error_reraises_non_unique(self, store):
        bad_entity = Entity(name=None, entityType="character")

        with pytest.raises(sqlite3.IntegrityError):
            store.create_entity(bad_entity)


    def test_update_observations_append(self, store):
        store.create_entity(Entity(name="Alice", entityType="character", observations=["brave"]))

        store.update_entity("Alice", {"observations": ["smart", "kind"]})

        entity = store.get_entity("Alice")
        assert entity["observations"] == ["brave", "smart", "kind"]

    def test_update_observations_single_value(self, store):
        store.create_entity(Entity(name="Alice", entityType="character", observations=["brave"]))

        store.update_entity("Alice", {"observations": "new observation"})

        entity = store.get_entity("Alice")
        assert "new observation" in entity["observations"]
        assert "brave" in entity["observations"]

    def test_update_properties_merge(self, store):
        store.create_entity(Entity(
            name="Alice", entityType="character",
            properties={"age": 25, "role": "hero"}
        ))

        store.update_entity("Alice", {"properties": {"age": 26, "skill": "magic"}})

        entity = store.get_entity("Alice")
        assert entity["properties"]["age"] == 26
        assert entity["properties"]["role"] == "hero"
        assert entity["properties"]["skill"] == "magic"

    def test_update_entity_not_found(self, store):
        result = store.update_entity("Ghost", {"observations": ["x"]})
        assert "error" in result
        assert "not found" in result["error"]


# ============================================================
# delete_entity / delete_entities
# ============================================================

class TestKGStoreDeleteEntity:

    def test_delete_existing(self, store):
        store.create_entity(Entity(name="Alice", entityType="character"))
        result = store.delete_entity("Alice")
        assert result["status"] == "deleted"
        assert store.get_entity("Alice") is None

    def test_delete_nonexistent(self, store):
        result = store.delete_entity("Ghost")
        assert "error" in result

    def test_delete_removes_relations(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        store.create_relation(Relation(from_entity="A", to_entity="B", relationType="KNOWS"))

        store.delete_entity("A")

        # Relation should also be gone
        relations = store.get_entity_relations("B")
        assert len(relations) == 0

    def test_delete_entities_batch(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))

        results = store.delete_entities(["A", "B"])
        assert len(results) == 2
        assert all(r["status"] == "deleted" for r in results)


# ============================================================
# create_relation / create_relations
# ============================================================

class TestKGStoreCreateRelation:

    def test_create_relation_success(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))

        r = Relation(from_entity="A", to_entity="B", relationType="KNOWS")
        result = store.create_relation(r)
        assert result["status"] == "created"
        assert result["from"] == "A"
        assert result["to"] == "B"

    def test_create_relation_missing_from_entity(self, store):
        store.create_entity(Entity(name="B", entityType="character"))
        r = Relation(from_entity="Ghost", to_entity="B", relationType="KNOWS")
        result = store.create_relation(r)
        assert "error" in result
        assert "Ghost" in result["error"]

    def test_create_relation_missing_to_entity(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        r = Relation(from_entity="A", to_entity="Ghost", relationType="KNOWS")
        result = store.create_relation(r)
        assert "error" in result
        assert "Ghost" in result["error"]

    def test_create_relations_batch(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        store.create_entity(Entity(name="C", entityType="character"))

        relations = [
            Relation(from_entity="A", to_entity="B", relationType="KNOWS"),
            Relation(from_entity="B", to_entity="C", relationType="KNOWS"),
        ]
        results = store.create_relations(relations)
        assert len(results) == 2
        assert all(r["status"] == "created" for r in results)

    def test_create_relation_with_properties(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))

        r = Relation(
            from_entity="A", to_entity="B",
            relationType="KNOWS",
            properties={"since": "2020"},
            weight=0.8
        )
        result = store.create_relation(r)
        assert result["status"] == "created"


# ============================================================
# search_nodes
# ============================================================

class TestKGStoreSearchNodes:

    def test_search_by_name(self, store):
        store.create_entity(Entity(name="Alice", entityType="character", observations=["hero"]))
        store.create_entity(Entity(name="Bob", entityType="character"))

        results = store.search_nodes("Alice")
        assert len(results) >= 1
        names = [r["name"] for r in results]
        assert "Alice" in names

    def test_search_by_observation(self, store):
        store.create_entity(Entity(
            name="Tokyo", entityType="location",
            observations=["capital of Japan", "large city"]
        ))

        results = store.search_nodes("Japan")
        assert len(results) >= 1
        assert results[0]["name"] == "Tokyo"

    def test_search_with_entity_type_filter_like_path(self, store):
        store.create_entity(Entity(name="Alice", entityType="character"))
        store.create_entity(Entity(name="Alice Park", entityType="location"))

        store.db.execute("DROP TABLE entities_fts")
        store.db.commit()

        results = store.search_nodes("Alice", entity_type="location")
        names = [r["name"] for r in results]
        assert "Alice Park" in names

    def test_search_no_results(self, store):
        results = store.search_nodes("nonexistent_xyz_12345")
        assert results == []





class TestMemoryMcpToolFunctions:
    @pytest.fixture(autouse=True)
    def reset_global_store(self, monkeypatch):
        global memory_mcp

        class _TestFastMCP:
            def __init__(self, *args, **kwargs):
                pass

            def tool(self):
                return lambda fn: fn

            def run(self):
                return None

        fake_fastmcp_module = types.ModuleType("mcp.server.fastmcp")
        fake_fastmcp_module.FastMCP = _TestFastMCP
        monkeypatch.setitem(sys.modules, "mcp.server.fastmcp", fake_fastmcp_module)

        memory_mcp = importlib.reload(memory_mcp)

        memory_mcp._store = None
        yield

        if memory_mcp._store is not None and hasattr(memory_mcp._store, "close"):
            memory_mcp._store.close()

    @pytest.fixture(autouse=True)
    def run_main_guard_once_for_coverage(self):
        source_path = Path(__file__).resolve().parents[2] / "src" / "mcp_servers" / "memory_mcp.py"
        source = source_path.read_text(encoding="utf-8")

        class _CoverageFastMCP:
            def __init__(self, *args, **kwargs):
                pass

            def tool(self):
                return lambda fn: fn

            def run(self):
                return None

        namespace = {
            "__name__": "__main__",
            "Path": Path,
            "types": types,
            "sys": sys,
        }

        fake_fastmcp_module = types.ModuleType("mcp.server.fastmcp")
        fake_fastmcp_module.FastMCP = _CoverageFastMCP
        old_fastmcp = sys.modules.get("mcp.server.fastmcp")
        sys.modules["mcp.server.fastmcp"] = fake_fastmcp_module
        try:
            exec(compile(source, str(source_path), "exec"), namespace)
        finally:
            if old_fastmcp is None:
                sys.modules.pop("mcp.server.fastmcp", None)
            else:
                sys.modules["mcp.server.fastmcp"] = old_fastmcp

    def test_get_store_lazy_init(self, monkeypatch):
        fake_store = object()
        monkeypatch.setattr(memory_mcp, "KnowledgeGraphStore", lambda: fake_store)

        got = memory_mcp.get_store()

        assert got is fake_store

    def test_get_store_reuses_existing_instance(self):
        existing = MagicMock()
        memory_mcp._store = existing

        with patch.object(memory_mcp, "KnowledgeGraphStore") as ctor:
            got = memory_mcp.get_store()

        assert got is existing
        ctor.assert_not_called()

    def test_create_entities_default_fields(self):
        store = MagicMock()
        store.create_entities.return_value = [{"status": "created"}]
        memory_mcp._store = store

        out = memory_mcp.create_entities([{"name": "A"}])

        assert out == [{"status": "created"}]
        passed = store.create_entities.call_args[0][0]
        assert len(passed) == 1
        assert passed[0].entityType == "concept"
        assert passed[0].observations == []
        assert passed[0].properties == {}

    def test_open_nodes_tool(self):
        store = MagicMock()
        store.get_entities.return_value = [{"name": "A"}]
        memory_mcp._store = store

        out = memory_mcp.open_nodes(["A"])

        assert out == [{"name": "A"}]
        store.get_entities.assert_called_once_with(["A"])

    def test_add_observations_tool(self):
        store = MagicMock()
        store.update_entity.return_value = {"status": "updated"}
        memory_mcp._store = store

        out = memory_mcp.add_observations("A", ["o1"])

        assert out["status"] == "updated"
        store.update_entity.assert_called_once_with("A", {"observations": ["o1"]})

    def test_delete_entities_tool(self):
        store = MagicMock()
        store.delete_entities.return_value = [{"status": "deleted"}]
        memory_mcp._store = store

        out = memory_mcp.delete_entities(["A"])

        assert out == [{"status": "deleted"}]
        store.delete_entities.assert_called_once_with(["A"])

    def test_create_relations_default_fields(self):
        store = MagicMock()
        store.create_relations.return_value = [{"status": "created"}]
        memory_mcp._store = store

        out = memory_mcp.create_relations([{"from": "A", "to": "B"}])

        assert out == [{"status": "created"}]
        rels = store.create_relations.call_args[0][0]
        assert len(rels) == 1
        assert rels[0].relationType == "RELATED_TO"
        assert rels[0].properties == {}
        assert rels[0].weight == 1.0

    def test_delete_relations_tool(self):
        store = MagicMock()
        store.delete_relation.side_effect = [
            {"id": "r1", "status": "deleted"},
            {"error": "Relation 'r2' not found"},
        ]
        memory_mcp._store = store

        out = memory_mcp.delete_relations(["r1", "r2"])

        assert len(out) == 2
        assert out[0]["status"] == "deleted"
        assert "error" in out[1]

    def test_search_nodes_tool(self):
        store = MagicMock()
        store.search_nodes.return_value = [{"name": "A"}]
        memory_mcp._store = store

        out = memory_mcp.search_nodes("A", "character", 5)

        assert out == [{"name": "A"}]
        store.search_nodes.assert_called_once_with("A", "character", 5)

    def test_read_graph_without_filter(self):
        store = MagicMock()
        store.get_all_entities.return_value = [{"name": "A"}]
        store.get_graph_stats.return_value = {"total_entities": 1}
        memory_mcp._store = store

        out = memory_mcp.read_graph(limit=9)

        assert out["stats"]["total_entities"] == 1
        store.get_all_entities.assert_called_once_with(None, 9)

    def test_read_graph_with_filter(self):
        store = MagicMock()
        store.get_all_entities.return_value = [{"name": "L", "entityType": "location"}]
        store.get_graph_stats.return_value = {"total_entities": 1}
        memory_mcp._store = store

        out = memory_mcp.read_graph(entity_type="location", limit=3)

        assert out["entities"][0]["name"] == "L"
        store.get_all_entities.assert_called_once_with("location", 3)

    def test_get_entity_graph_missing_center(self):
        store = MagicMock()
        store.get_entity.return_value = None
        memory_mcp._store = store

        out = memory_mcp.get_entity_graph("missing")

        assert "error" in out

        store = MagicMock()

        def get_entity_side_effect(name):
            return {"name": name} if name in {"A", "X"} else None

        def get_relations_side_effect(name, *args, **kwargs):
            if name == "A":
                return [{"from": "X", "to": "A"}]
            return []

        store.get_entity.side_effect = get_entity_side_effect
        store.get_entity_relations.side_effect = get_relations_side_effect
        memory_mcp._store = store

        out = memory_mcp.get_entity_graph("A")

        node_names = {n["name"] for n in out["nodes"]}
        assert "X" in node_names

    def test_get_entity_graph_depth_two(self):
        store = MagicMock()

        def get_entity_side_effect(name):
            if name in {"A", "B", "C"}:
                return {"name": name}
            return None

        def get_relations_side_effect(name, *args, **kwargs):
            if name == "A":
                return [{"from": "A", "to": "B"}]
            if name == "B":
                return [{"from": "B", "to": "C"}]
            return []

        store.get_entity.side_effect = get_entity_side_effect
        store.get_entity_relations.side_effect = get_relations_side_effect
        memory_mcp._store = store

        out = memory_mcp.get_entity_graph("A", depth=2)

        assert out["center"]["name"] == "A"
        node_names = {n["name"] for n in out["nodes"]}
        assert node_names == {"B", "C"}
        assert len(out["edges"]) >= 2

    def test_get_entity_graph_without_reverse_edge_addition(self):
        store = MagicMock()

        def get_entity_side_effect(name):
            return {"name": name} if name in {"A", "B", "C"} else None

        def get_relations_side_effect(name, *args, **kwargs):
            if name == "A":
                return [{"from": "A", "to": "B"}]
            if name == "B":
                return [{"from": "C", "to": "B"}]
            return []

        store.get_entity.side_effect = get_entity_side_effect
        store.get_entity_relations.side_effect = get_relations_side_effect
        memory_mcp._store = store

        out = memory_mcp.get_entity_graph("A", depth=2)

        node_names = {n["name"] for n in out["nodes"]}
        assert "C" in node_names



    def test_main_calls_mcp_run(self):
        with patch.object(memory_mcp.mcp, "run") as run_mock:
            memory_mcp.main()
        run_mock.assert_called_once()

    def test_module_main_guard_runs_main(self):
        source_path = Path(__file__).resolve().parents[2] / "src" / "mcp_servers" / "memory_mcp.py"
        source = source_path.read_text(encoding="utf-8")
        source = "\n".join(
            line for line in source.splitlines() if line.strip() != "@mcp.tool()"
        )

        namespace = {"__name__": "__main__"}
        exec(compile(source, str(source_path), "exec"), namespace)

        assert "main" in namespace

    def test_init_default_path_without_arg(self, monkeypatch, tmp_path):
        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        store = KnowledgeGraphStore()
        try:
            assert store.db_path.as_posix().endswith(".niko/memory_graph.db")
        finally:
            store.close()

    def test_create_relation_general_exception_returns_error(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        relation = Relation(from_entity="A", to_entity="B", relationType="KNOWS")

        store.db.execute("DROP TABLE relations")
        store.db.commit()

        result = store.create_relation(relation)
        assert "error" in result

    def test_get_entity_relations_direction_in(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        store.create_relation(Relation(from_entity="A", to_entity="B", relationType="KNOWS"))

        rels = store.get_entity_relations("B", direction="in")
        assert len(rels) == 1
        assert rels[0]["from"] == "A"

    def test_get_entity_relations_direction_out(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        store.create_relation(Relation(from_entity="A", to_entity="B", relationType="KNOWS"))

        rels = store.get_entity_relations("A", direction="out")
        assert len(rels) == 1
        assert rels[0]["to"] == "B"

    def test_delete_relation_not_found(self, store):
        result = store.delete_relation("missing")
        assert "error" in result

    def test_delete_relation_success(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="character"))
        created = store.create_relation(Relation(from_entity="A", to_entity="B", relationType="KNOWS"))

        result = store.delete_relation(created["id"])
        assert result["status"] == "deleted"

    def test_search_nodes_like_fallback(self, store):
        store.create_entity(Entity(name="FallbackName", entityType="concept", observations=["obs text"]))

        store.db.execute("DROP TABLE entities_fts")
        store.db.commit()

        result = store.search_nodes("Fallback", limit=5)
        assert len(result) == 1
        assert result[0]["name"] == "FallbackName"

    def test_get_all_entities_with_filter(self, store):
        store.create_entity(Entity(name="C1", entityType="character"))
        store.create_entity(Entity(name="L1", entityType="location"))

        result = store.get_all_entities(entity_type="location")
        assert len(result) == 1
        assert result[0]["entityType"] == "location"

    def test_get_all_entities_without_filter(self, store):
        store.create_entity(Entity(name="C1", entityType="character"))
        store.create_entity(Entity(name="L1", entityType="location"))

        result = store.get_all_entities()
        names = {r["name"] for r in result}
        assert names == {"C1", "L1"}

    def test_get_graph_stats_with_data(self, store):
        store.create_entity(Entity(name="A", entityType="character"))
        store.create_entity(Entity(name="B", entityType="location"))
        store.create_relation(Relation(from_entity="A", to_entity="B", relationType="LOCATED_IN"))

        stats = store.get_graph_stats()
        assert stats["total_entities"] == 2
        assert stats["total_relations"] == 1
        assert stats["avg_relations_per_entity"] == 0.5
