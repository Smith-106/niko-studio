# -*- coding: utf-8 -*-
"""
Memory MCP (KnowledgeGraphStore) Tests

Tests for EntityType/RelationType enums, Entity/Relation __post_init__,
KnowledgeGraphStore CRUD operations, and search_nodes.
Uses tmp_path for real SQLite database testing.
"""

import json
import pytest
from pathlib import Path

from src.mcp_servers.memory_mcp import (
    EntityType,
    RelationType,
    Entity,
    Relation,
    KnowledgeGraphStore,
)


# ============================================================
# EntityType / RelationType enums
# ============================================================

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

class TestKGStoreUpdateEntity:

    def test_update_nonexistent(self, store):
        result = store.update_entity("Ghost", {"observations": ["new"]})
        assert "error" in result

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

    def test_update_returns_status(self, store):
        store.create_entity(Entity(name="Alice", entityType="character"))
        result = store.update_entity("Alice", {"observations": ["new"]})
        assert result["status"] == "updated"
        assert result["name"] == "Alice"


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

    def test_search_with_entity_type_filter(self, store):
        store.create_entity(Entity(name="Alice", entityType="character"))
        store.create_entity(Entity(name="Alice Park", entityType="location"))

        results = store.search_nodes("Alice", entity_type="location")
        names = [r["name"] for r in results]
        assert "Alice Park" in names

    def test_search_no_results(self, store):
        results = store.search_nodes("nonexistent_xyz_12345")
        assert results == []

    def test_search_with_limit(self, store):
        for i in range(10):
            store.create_entity(Entity(name=f"Item{i}", entityType="object", observations=["searchable"]))

        results = store.search_nodes("searchable", limit=3)
        assert len(results) <= 3
