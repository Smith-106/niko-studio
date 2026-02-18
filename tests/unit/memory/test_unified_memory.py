"""
Unified Memory Tests

Tests for MemoryLayer, MemoryDimension, UnifiedMemory data model,
EmbeddingEngine, and UnifiedMemoryEngine (DB-backed operations).
"""

import pytest
import json
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock
from src.memory.unified_memory import (
    MemoryLayer,
    MemoryDimension,
    UnifiedMemory,
    EmbeddingEngine,
    UnifiedMemoryEngine,
    ConflictResolver,
)


# ============================================================
# Enum Tests
# ============================================================

class TestMemoryLayer:

    def test_all_values(self):
        assert MemoryLayer.EPHEMERAL.value == "ephemeral"
        assert MemoryLayer.SESSION.value == "session"
        assert MemoryLayer.USER.value == "user"
        assert MemoryLayer.PROJECT.value == "project"

    def test_four_layers(self):
        assert len(MemoryLayer) == 4


class TestMemoryDimension:

    def test_all_values(self):
        assert MemoryDimension.TIMELINE.value == "timeline"
        assert MemoryDimension.CONTEXT.value == "context"
        assert MemoryDimension.CHARACTER.value == "character"
        assert MemoryDimension.WORLDVIEW.value == "worldview"
        assert MemoryDimension.PREFERENCE.value == "preference"
        assert MemoryDimension.EXPERIENCE.value == "experience"

    def test_six_dimensions(self):
        assert len(MemoryDimension) == 6


# ============================================================
# UnifiedMemory Data Model Tests
# ============================================================

class TestUnifiedMemory:

    def test_defaults(self):
        m = UnifiedMemory(id="m1", content="test")
        assert m.layer == "session"
        assert m.dimension is None
        assert m.importance == 0.5
        assert m.confidence == 1.0
        assert m.source == "user"
        assert m.tags == []
        assert m.embedding == []

    def test_to_dict(self):
        m = UnifiedMemory(
            id="m1",
            content="test",
            layer="project",
            dimension="character",
            tags=["tag1", "tag2"],
        )
        d = m.to_dict()
        assert d["id"] == "m1"
        assert d["layer"] == "project"
        assert d["dimension"] == "character"
        # tags and embedding should be JSON strings
        assert isinstance(d["tags"], str)
        assert json.loads(d["tags"]) == ["tag1", "tag2"]
        assert isinstance(d["embedding"], str)

    def test_from_dict(self):
        data = {
            "id": "m1",
            "content": "test",
            "layer": "session",
            "tags": json.dumps(["a", "b"]),
            "embedding": json.dumps([1.0, 2.0]),
        }
        m = UnifiedMemory.from_dict(data)
        assert m.tags == ["a", "b"]
        assert m.embedding == [1.0, 2.0]

    def test_from_dict_native_lists(self):
        data = {
            "id": "m1",
            "content": "test",
            "layer": "session",
            "tags": ["a"],
            "embedding": [1.0],
        }
        m = UnifiedMemory.from_dict(data)
        assert m.tags == ["a"]
        assert m.embedding == [1.0]

    def test_roundtrip(self):
        original = UnifiedMemory(
            id="m1",
            content="test content",
            layer="user",
            dimension="worldview",
            entity_id="e1",
            importance=0.8,
            tags=["fantasy"],
        )
        d = original.to_dict()
        # Simulate DB round-trip
        restored = UnifiedMemory.from_dict(d)
        assert restored.id == original.id
        assert restored.layer == original.layer
        assert restored.dimension == original.dimension
        assert restored.tags == original.tags


# ============================================================
# EmbeddingEngine Tests
# ============================================================

class TestEmbeddingEngine:

    def test_dummy_embeddings(self):
        engine = EmbeddingEngine()
        # Force dummy mode
        engine._model = "dummy"
        embedding = engine.embed("test text")
        assert isinstance(embedding, list)
        assert len(embedding) > 0
        assert all(isinstance(x, float) for x in embedding)

    def test_dummy_consistent(self):
        engine = EmbeddingEngine()
        engine._model = "dummy"
        e1 = engine.embed("same text")
        e2 = engine.embed("same text")
        assert e1 == e2

    def test_dummy_different_text(self):
        engine = EmbeddingEngine()
        engine._model = "dummy"
        e1 = engine.embed("text a")
        e2 = engine.embed("text b")
        assert e1 != e2

    def test_embed_with_cache(self):
        engine = EmbeddingEngine()
        engine._model = "dummy"
        e1 = engine.embed("cached query", use_cache=True)
        e2 = engine.embed("cached query", use_cache=True)
        assert e1 == e2

    def test_embed_cached_method(self):
        engine = EmbeddingEngine()
        engine._model = "dummy"
        e = engine.embed_cached("test query")
        assert isinstance(e, list)

    def test_similarity_identical(self):
        engine = EmbeddingEngine()
        vec = [1.0, 0.0, 0.0]
        sim = engine.similarity(vec, vec)
        assert sim == pytest.approx(1.0)

    def test_similarity_orthogonal(self):
        engine = EmbeddingEngine()
        vec_a = [1.0, 0.0]
        vec_b = [0.0, 1.0]
        sim = engine.similarity(vec_a, vec_b)
        assert sim == pytest.approx(0.0)

    def test_similarity_empty(self):
        engine = EmbeddingEngine()
        assert engine.similarity([], []) == 0.0

    def test_similarity_one_empty(self):
        engine = EmbeddingEngine()
        assert engine.similarity([1.0], []) == 0.0

    def test_similarity_zero_vectors(self):
        engine = EmbeddingEngine()
        assert engine.similarity([0.0, 0.0], [0.0, 0.0]) == 0.0

    def test_cache_stats(self):
        engine = EmbeddingEngine()
        engine._model = "dummy"
        stats = engine.cache_stats
        assert "size" in stats


# ============================================================
# ConflictResolver (unified_memory version) Tests
# ============================================================

class TestUnifiedConflictResolver:

    @pytest.fixture
    def resolver(self, tmp_path):
        db = sqlite3.connect(str(tmp_path / "test.db"))
        db.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT,
                entity_id TEXT,
                valid_from TEXT,
                valid_until TEXT,
                superseded_by TEXT
            )
        """)
        db.commit()
        return ConflictResolver(db)

    def test_is_contradictory_chinese(self, resolver):
        assert resolver._is_contradictory("他是勇士", "他不是勇士") is True

    def test_is_contradictory_english(self, resolver):
        assert resolver._is_contradictory("He is alive", "He is dead") is True

    def test_is_not_contradictory(self, resolver):
        assert resolver._is_contradictory("天空是蓝的", "草地是绿的") is False

    @pytest.mark.asyncio
    async def test_check_no_entity(self, resolver):
        result = await resolver.check("content")
        assert result == []

    @pytest.mark.asyncio
    async def test_resolve_auto(self, resolver):
        conflicts = [{"id": "m1", "content": "old"}]
        result = await resolver.resolve("new", conflicts, strategy="auto")
        assert result["action"] == "update"
        assert "m1" in result["obsolete_ids"]

    @pytest.mark.asyncio
    async def test_resolve_keep_old(self, resolver):
        conflicts = [{"id": "m1", "content": "old"}]
        result = await resolver.resolve("new", conflicts, strategy="keep_old")
        assert result["action"] == "reject"

    @pytest.mark.asyncio
    async def test_resolve_merge(self, resolver):
        conflicts = [{"id": "m1", "content": "old content"}]
        result = await resolver.resolve("new content", conflicts, strategy="merge")
        assert result["action"] == "merge"
        assert "old content" in result["merged_content"]




class TestUnifiedConflictResolverExtra:

    @pytest.mark.asyncio
    async def test_resolve_unknown_strategy_defaults_update(self, tmp_path):
        db = sqlite3.connect(str(tmp_path / "resolver.db"))
        resolver = ConflictResolver(db)
        out = await resolver.resolve("new", [{"id": "x", "content": "old"}], strategy="unknown")
        assert out == {"action": "update", "obsolete_ids": []}


class TestEmbeddingEngineExtra:

    def test_model_import_error_falls_back_dummy(self):
        engine = EmbeddingEngine()
        with patch("builtins.__import__", side_effect=ImportError("no fastembed")):
            assert engine.model == "dummy"


    @pytest.fixture
    def engine(self, tmp_path):
        db_path = str(tmp_path / "test_memory.db")
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=db_path)
        return eng

    def test_init(self, engine):
        assert engine.is_primary_engine is True
        assert engine.db is not None

    @pytest.mark.asyncio
    async def test_add_memory(self, engine):
        result = await engine.add(
            content="Test memory content",
            layer="session",
            dimension="character",
        )
        assert result["status"] == "created"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_add_memory_with_entity(self, engine):
        result = await engine.add(
            content="Alice is brave",
            layer="project",
            entity_id="alice",
        )
        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_search(self, engine):
        await engine.add(content="The hero fought bravely", layer="session")
        await engine.add(content="The villain escaped", layer="session")
        results = await engine.search("hero")
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_get_temporal_facts(self, engine):
        await engine.add(
            content="Alice is brave",
            entity_id="alice",
            layer="project",
        )
        facts = await engine.get_temporal_facts("alice")
        assert isinstance(facts, list)

    @pytest.mark.asyncio
    async def test_get_temporal_facts_no_entity(self, engine):
        facts = await engine.get_temporal_facts("nonexistent")
        assert facts == []

    @pytest.mark.asyncio
    async def test_detect_conflicts(self, engine):
        # Insert two contradictory facts directly into DB to bypass auto-resolution
        engine.db.execute(
            "INSERT INTO memories (id, content, entity_id, layer, superseded_by) VALUES (?, ?, ?, ?, ?)",
            ("m1", "He is alive", "king", "project", None),
        )
        engine.db.execute(
            "INSERT INTO memories (id, content, entity_id, layer, superseded_by) VALUES (?, ?, ?, ?, ?)",
            ("m2", "He is dead", "king", "project", None),
        )
        engine.db.commit()
        conflicts = await engine.detect_conflicts("king")
        assert len(conflicts) >= 1

    @pytest.mark.asyncio
    async def test_resolve_conflict(self, engine):
        r1 = await engine.add(content="fact A", entity_id="e1", layer="session")
        r2 = await engine.add(content="fact B", entity_id="e1", layer="session")
        result = await engine.resolve_conflict(r1["id"], r2["id"])
        assert result["status"] == "resolved"

    @pytest.mark.asyncio
    async def test_resolve_conflict_keep_a(self, engine):
        r1 = await engine.add(content="fact A", entity_id="e1", layer="session")
        r2 = await engine.add(content="fact B", entity_id="e1", layer="session")
        result = await engine.resolve_conflict(r1["id"], r2["id"], resolution="keep_a")
        assert result["kept"] == r1["id"]

    @pytest.mark.asyncio
    async def test_resolve_conflict_keep_b(self, engine):
        r1 = await engine.add(content="fact A", entity_id="e1", layer="session")
        r2 = await engine.add(content="fact B", entity_id="e1", layer="session")
        result = await engine.resolve_conflict(r1["id"], r2["id"], resolution="keep_b")
        assert result["kept"] == r2["id"]

    @pytest.mark.asyncio
    async def test_health_check_db_error(self, tmp_path):
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u-db-error.db"))

        class BadDB:
            def execute(self, *_args, **_kwargs):
                raise RuntimeError("db down")

        eng.db = BadDB()
        out = await eng.health_check()
        assert out["db_ok"] is False
        assert "db down" in out["error"]

    def test_close(self, engine):
        engine.close()
        # Should not raise

    @pytest.mark.asyncio
    async def test_add_with_conflict_resolution(self, engine):
        """Add conflicting content to same entity triggers resolution."""
        await engine.add(
            content="The king is alive",
            entity_id="king",
            layer="project",
        )
        result = await engine.add(
            content="The king is dead",
            entity_id="king",
            layer="project",
        )
        # Should still create (auto resolution = update)
        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_search_with_filters(self, engine):
        await engine.add(
            content="Character info",
            layer="project",
            dimension="character",
        )
        await engine.add(
            content="World info",
            layer="project",
            dimension="worldview",
        )
        results = await engine.search(
            "info",
            layer="project",
            dimensions=["character"],
        )
        # Only character dimension should match
        for r in results:
            assert r["dimension"] == "character"


class TestUnifiedMemoryEngineExtra:

    @pytest.mark.asyncio
    async def test_initialize_plugin_error_records_health(self, tmp_path):
        class BadPlugin:
            name = "bad"

            async def load(self, engine):
                raise RuntimeError("load failed")

            async def health_check(self):
                return {"status": "ok"}

            async def on_memory_added(self, memory):
                return None

        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u1.db"), plugins=[BadPlugin()])

        await eng.initialize()
        assert eng._plugin_health["bad"]["status"] == "error"
        eng.close()

    @pytest.mark.asyncio
    async def test_health_check_plugin_error(self, tmp_path):
        class BadHealthPlugin:
            name = "p"

            async def load(self, engine):
                return None

            async def health_check(self):
                raise RuntimeError("boom")

            async def on_memory_added(self, memory):
                return None

        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u2.db"), plugins=[BadHealthPlugin()])

        out = await eng.health_check()
        assert out["plugins"]["p"]["status"] == "error"
        eng.close()

    @pytest.mark.asyncio
    async def test_add_rejected_by_conflict_resolution(self, tmp_path):
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u3.db"))

        eng.conflict_resolver.check = AsyncMock(return_value=[{"id": "old", "content": "x"}])
        eng.conflict_resolver.resolve = AsyncMock(return_value={"action": "reject", "reason": "keep old"})

        result = await eng.add(content="new", entity_id="e1")
        assert result == {"status": "rejected", "reason": "keep old"}
        eng.close()

    @pytest.mark.asyncio
    async def test_add_merge_and_plugin_callback_error(self, tmp_path):
        class Plugin:
            name = "bad_callback"

            async def load(self, engine):
                return None

            async def health_check(self):
                return {"status": "ok"}

            async def on_memory_added(self, memory):
                raise RuntimeError("callback failed")

        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u4.db"), plugins=[Plugin()])

        eng.conflict_resolver.check = AsyncMock(return_value=[{"id": "old", "content": "old text"}])
        eng.conflict_resolver.resolve = AsyncMock(
            return_value={"action": "merge", "merged_content": "merged", "obsolete_ids": ["old"]}
        )

        result = await eng.add(content="new", entity_id="e1")
        assert result["status"] == "created"
        eng.close()

    @pytest.mark.asyncio
    async def test_search_with_all_filters_and_at_time(self, tmp_path):
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u5.db"))

        eng.embedder._model = "dummy"
        await eng.add(content="hero memory", layer="project", dimension="character", entity_id="hero", valid_from="2020-01-01T00:00:00")
        await eng.add(content="villain memory", layer="project", dimension="worldview", entity_id="villain")

        out = await eng.search(
            query="hero",
            layer="project",
            dimensions=["character"],
            entity_id="hero",
            at_time="2030-01-01T00:00:00",
            limit=5,
        )
        assert len(out) <= 1
        if out:
            assert out[0]["entity_id"] == "hero"
            assert out[0]["dimension"] == "character"
        eng.close()

    @pytest.mark.asyncio
    async def test_search_filters_by_similarity_threshold(self, tmp_path):
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u6.db"))

        await eng.add(content="A", layer="session")
        await eng.add(content="B", layer="session")

        scores = iter([0.2, 0.9])
        eng.embedder.embed_cached = MagicMock(return_value=[1.0])
        eng.embedder.similarity = MagicMock(side_effect=lambda *_: next(scores))

        out = await eng.search("q")
        assert len(out) == 1
        assert out[0]["score"] == 0.9
        eng.close()

    def test_register_plugins_deduplicates(self, tmp_path):
        plugin = MagicMock()
        plugin.name = "p"
        with patch("src.memory.unified_memory.get_config_value", return_value=None):
            eng = UnifiedMemoryEngine(db_path=str(tmp_path / "u7.db"))
        eng._register_plugins([plugin, plugin])
        assert len(eng.plugins) == 1
        eng.close()

    def test_constructor_prefers_data_dir_when_db_path_missing(self, tmp_path):
        def fake_get(key, default=None):
            if key == "memory.db_path":
                return None
            if key == "data_dir":
                return str(tmp_path / "data")
            return default

        with patch("src.memory.unified_memory.get_config_value", side_effect=fake_get):
            eng = UnifiedMemoryEngine(db_path=None)
        try:
            assert str(eng.db_path).endswith("memory.db")
            assert "data" in str(eng.db_path)
        finally:
            eng.close()

    def test_constructor_falls_back_to_home(self, tmp_path):
        with (
            patch("src.memory.unified_memory.get_config_value", return_value=None),
            patch("src.memory.unified_memory.Path.home", return_value=tmp_path / "home")
        ):
            eng = UnifiedMemoryEngine(db_path=None)
        try:
            assert str(eng.db_path).endswith("memory.db")
        finally:
            eng.close()

    def test_from_config_prefers_data_dir(self, tmp_path):
        def fake_get(key, default=None):
            if key == "memory.db_path":
                return None
            if key == "data_dir":
                return str(tmp_path / "d")
            if key == "memory.vector_db_path":
                return None
            return default

        with patch("src.memory.unified_memory.get_config_value", side_effect=fake_get):
            eng = UnifiedMemoryEngine.from_config()
        try:
            assert str(eng.db_path).endswith("memory.db")
            assert "d" in str(eng.db_path)
        finally:
            eng.close()

    def test_from_config_prefers_vector_db_path(self, tmp_path):
        def fake_get(key, default=None):
            if key == "memory.db_path":
                return None
            if key == "data_dir":
                return None
            if key == "memory.vector_db_path":
                return str(tmp_path / "vector-memory.db")
            return default

        with patch("src.memory.unified_memory.get_config_value", side_effect=fake_get):
            eng = UnifiedMemoryEngine.from_config()
        try:
            assert str(eng.db_path).endswith("vector-memory.db")
        finally:
            eng.close()

