"""
Memory Layers Tests

Tests for LayerEntry, LayerConfig, LayerType, LayerStats,
BaseMemoryLayer, EphemeralLayer, SessionLayer, UserLayer, ProjectLayer,
LayerManager, and create_layer factory.
"""

import pytest
from datetime import datetime, timedelta
from src.memory.memory_layers import (
    LayerType,
    LayerConfig,
    LayerEntry,
    LayerStats,
    BaseMemoryLayer,
    EphemeralLayer,
    SessionLayer,
    UserLayer,
    ProjectLayer,
    LayerManager,
    LAYER_CONFIGS,
    create_layer,
)


# ============================================================
# Data Model Tests
# ============================================================

class TestLayerType:

    def test_all_values(self):
        assert LayerType.EPHEMERAL.value == "ephemeral"
        assert LayerType.SESSION.value == "session"
        assert LayerType.USER.value == "user"
        assert LayerType.PROJECT.value == "project"

    def test_four_types(self):
        assert len(LayerType) == 4


class TestLayerConfig:

    def test_defaults(self):
        lc = LayerConfig(layer_type=LayerType.EPHEMERAL)
        assert lc.default_ttl_seconds is None
        assert lc.max_entries == 10000
        assert lc.auto_expire is True
        assert lc.persist_on_close is True


class TestLayerEntry:

    def test_defaults(self):
        entry = LayerEntry(id="e1", content="test")
        assert entry.importance == 0.5
        assert entry.access_count == 0
        assert entry.expires_at is None
        assert entry.metadata == {}
        assert entry.last_accessed is None

    def test_is_expired_no_expiry(self):
        entry = LayerEntry(id="e1", content="test")
        assert entry.is_expired() is False

    def test_is_expired_future(self):
        entry = LayerEntry(
            id="e1", content="test",
            expires_at=datetime.now() + timedelta(hours=1)
        )
        assert entry.is_expired() is False

    def test_is_expired_past(self):
        entry = LayerEntry(
            id="e1", content="test",
            expires_at=datetime.now() - timedelta(hours=1)
        )
        assert entry.is_expired() is True

    def test_touch(self):
        entry = LayerEntry(id="e1", content="test")
        assert entry.access_count == 0
        assert entry.last_accessed is None
        entry.touch()
        assert entry.access_count == 1
        assert entry.last_accessed is not None
        entry.touch()
        assert entry.access_count == 2


class TestLayerConfigs:

    def test_ephemeral_config(self):
        cfg = LAYER_CONFIGS[LayerType.EPHEMERAL]
        assert cfg.default_ttl_seconds == 3600
        assert cfg.max_entries == 1000
        assert cfg.persist_on_close is False

    def test_session_config(self):
        cfg = LAYER_CONFIGS[LayerType.SESSION]
        assert cfg.default_ttl_seconds == 86400
        assert cfg.persist_on_close is True

    def test_user_config(self):
        cfg = LAYER_CONFIGS[LayerType.USER]
        assert cfg.default_ttl_seconds is None
        assert cfg.auto_expire is False

    def test_project_config(self):
        cfg = LAYER_CONFIGS[LayerType.PROJECT]
        assert cfg.default_ttl_seconds is None
        assert cfg.max_entries == 50000


# ============================================================
# BaseMemoryLayer Tests
# ============================================================

class TestBaseMemoryLayer:

    @pytest.mark.asyncio
    async def test_store_and_retrieve(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        entry = await layer.store("e1", "hello world")
        assert entry.id == "e1"
        assert entry.content == "hello world"
        result = await layer.retrieve("e1")
        assert result is not None
        assert result.content == "hello world"
        assert result.access_count == 1  # touched on retrieve

    @pytest.mark.asyncio
    async def test_retrieve_not_found(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        result = await layer.retrieve("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_store_with_ttl(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        entry = await layer.store("e1", "test", ttl_seconds=3600)
        assert entry.expires_at is not None

    @pytest.mark.asyncio
    async def test_store_with_metadata(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        entry = await layer.store("e1", "test", metadata={"key": "val"})
        assert entry.metadata == {"key": "val"}

    @pytest.mark.asyncio
    async def test_store_with_importance(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        entry = await layer.store("e1", "test", importance=0.9)
        assert entry.importance == 0.9

    @pytest.mark.asyncio
    async def test_retrieve_expired_auto_expire(self):
        cfg = LayerConfig(
            layer_type=LayerType.EPHEMERAL,
            auto_expire=True,
        )
        layer = BaseMemoryLayer(cfg)
        entry = await layer.store("e1", "test", ttl_seconds=1)
        # Manually set expiry to past
        entry.expires_at = datetime.now() - timedelta(seconds=1)
        result = await layer.retrieve("e1")
        assert result is None

    @pytest.mark.asyncio
    async def test_expire(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        await layer.store("e1", "test")
        result = await layer.expire("e1")
        assert result is True
        assert await layer.retrieve("e1") is None

    @pytest.mark.asyncio
    async def test_expire_not_found(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        result = await layer.expire("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_expire_all(self):
        cfg = LayerConfig(
            layer_type=LayerType.EPHEMERAL,
            default_ttl_seconds=1,
        )
        layer = BaseMemoryLayer(cfg)
        entry1 = await layer.store("e1", "old", ttl_seconds=1)
        await layer.store("e2", "fresh", ttl_seconds=7200)
        # Expire e1
        entry1.expires_at = datetime.now() - timedelta(seconds=1)
        expired_count = await layer.expire_all()
        assert expired_count == 1

    @pytest.mark.asyncio
    async def test_expire_all_none_expired(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER])
        await layer.store("e1", "test")
        expired = await layer.expire_all()
        assert expired == 0

    @pytest.mark.asyncio
    async def test_stats_empty(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        stats = await layer.stats()
        assert stats.total_entries == 0
        assert stats.avg_importance == 0.0
        assert stats.oldest_entry is None
        assert stats.newest_entry is None

    @pytest.mark.asyncio
    async def test_stats_with_entries(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        await layer.store("e1", "test1", importance=0.6)
        await layer.store("e2", "test2", importance=0.8)
        stats = await layer.stats()
        assert stats.total_entries == 2
        assert stats.avg_importance == pytest.approx(0.7, abs=0.01)
        assert stats.oldest_entry is not None
        assert stats.newest_entry is not None

    @pytest.mark.asyncio
    async def test_list_entries(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        await layer.store("e1", "test1", importance=0.3)
        await layer.store("e2", "test2", importance=0.9)
        entries = await layer.list_entries()
        assert len(entries) == 2
        # Sorted by importance desc
        assert entries[0].importance >= entries[1].importance

    @pytest.mark.asyncio
    async def test_list_entries_limit(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        for i in range(5):
            await layer.store(f"e{i}", f"test{i}")
        entries = await layer.list_entries(limit=2)
        assert len(entries) == 2

    @pytest.mark.asyncio
    async def test_list_entries_exclude_expired(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        e1 = await layer.store("e1", "old", ttl_seconds=1)
        e1.expires_at = datetime.now() - timedelta(seconds=1)
        await layer.store("e2", "fresh", ttl_seconds=7200)
        entries = await layer.list_entries(include_expired=False)
        assert len(entries) == 1
        assert entries[0].id == "e2"

    @pytest.mark.asyncio
    async def test_list_entries_include_expired(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        e1 = await layer.store("e1", "old", ttl_seconds=1)
        e1.expires_at = datetime.now() - timedelta(seconds=1)
        await layer.store("e2", "fresh", ttl_seconds=7200)
        entries = await layer.list_entries(include_expired=True)
        assert len(entries) == 2

    @pytest.mark.asyncio
    async def test_clear(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        await layer.store("e1", "test1")
        await layer.store("e2", "test2")
        count = await layer.clear()
        assert count == 2
        assert await layer.retrieve("e1") is None

    @pytest.mark.asyncio
    async def test_clear_empty(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.SESSION])
        count = await layer.clear()
        assert count == 0

    @pytest.mark.asyncio
    async def test_evict_oldest(self):
        cfg = LayerConfig(
            layer_type=LayerType.EPHEMERAL,
            max_entries=2,
        )
        layer = BaseMemoryLayer(cfg)
        await layer.store("e1", "first")
        await layer.store("e2", "second")
        await layer.store("e3", "third")  # Should evict e1
        assert await layer.retrieve("e1") is None
        assert await layer.retrieve("e2") is not None
        assert await layer.retrieve("e3") is not None

    @pytest.mark.asyncio
    async def test_layer_type_property(self):
        layer = BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER])
        assert layer.layer_type == LayerType.USER

    @pytest.mark.asyncio
    async def test_config_property(self):
        cfg = LAYER_CONFIGS[LayerType.PROJECT]
        layer = BaseMemoryLayer(cfg)
        assert layer.config is cfg


# ============================================================
# EphemeralLayer Tests
# ============================================================

class TestEphemeralLayer:

    @pytest.mark.asyncio
    async def test_default_config(self):
        layer = EphemeralLayer()
        assert layer.layer_type == LayerType.EPHEMERAL

    @pytest.mark.asyncio
    async def test_max_ttl_enforcement(self):
        layer = EphemeralLayer()
        # Try to store with TTL > 1 hour
        entry = await layer.store("e1", "test", ttl_seconds=7200)
        # Should be capped at 3600
        assert entry.expires_at is not None
        max_allowed = datetime.now() + timedelta(seconds=3601)
        assert entry.expires_at <= max_allowed

    @pytest.mark.asyncio
    async def test_default_ttl_applied(self):
        layer = EphemeralLayer()
        entry = await layer.store("e1", "test")
        assert entry.expires_at is not None


# ============================================================
# SessionLayer Tests
# ============================================================

class TestSessionLayer:

    @pytest.mark.asyncio
    async def test_default_config(self):
        layer = SessionLayer()
        assert layer.layer_type == LayerType.SESSION

    @pytest.mark.asyncio
    async def test_session_id_in_metadata(self):
        layer = SessionLayer(session_id="sess-001")
        entry = await layer.store("e1", "test")
        assert entry.metadata["session_id"] == "sess-001"

    @pytest.mark.asyncio
    async def test_no_session_id(self):
        layer = SessionLayer()
        entry = await layer.store("e1", "test")
        assert "session_id" not in entry.metadata


# ============================================================
# UserLayer Tests
# ============================================================

class TestUserLayer:

    @pytest.mark.asyncio
    async def test_default_config(self):
        layer = UserLayer()
        assert layer.layer_type == LayerType.USER

    @pytest.mark.asyncio
    async def test_no_expiration(self):
        layer = UserLayer()
        entry = await layer.store("e1", "test")
        assert entry.expires_at is None

    @pytest.mark.asyncio
    async def test_user_id_in_metadata(self):
        layer = UserLayer(user_id="user-001")
        entry = await layer.store("e1", "test")
        assert entry.metadata["user_id"] == "user-001"


# ============================================================
# ProjectLayer Tests
# ============================================================

class TestProjectLayer:

    @pytest.mark.asyncio
    async def test_default_config(self):
        layer = ProjectLayer()
        assert layer.layer_type == LayerType.PROJECT

    @pytest.mark.asyncio
    async def test_project_id_in_metadata(self):
        layer = ProjectLayer(project_id="proj-001")
        entry = await layer.store("e1", "test")
        assert entry.metadata["project_id"] == "proj-001"


# ============================================================
# LayerManager Tests
# ============================================================

class TestLayerManager:

    @pytest.mark.asyncio
    async def test_get_layer(self):
        mgr = LayerManager()
        layer = mgr.get_layer(LayerType.EPHEMERAL)
        assert isinstance(layer, EphemeralLayer)

    @pytest.mark.asyncio
    async def test_store_and_retrieve(self):
        mgr = LayerManager()
        entry = await mgr.store(LayerType.SESSION, "e1", "hello")
        assert entry.content == "hello"
        result = await mgr.retrieve("e1", LayerType.SESSION)
        assert result is not None
        assert result.content == "hello"

    @pytest.mark.asyncio
    async def test_retrieve_search_all_layers(self):
        mgr = LayerManager()
        await mgr.store(LayerType.PROJECT, "e1", "project data")
        # Retrieve without specifying layer
        result = await mgr.retrieve("e1")
        assert result is not None
        assert result.content == "project data"

    @pytest.mark.asyncio
    async def test_retrieve_not_found(self):
        mgr = LayerManager()
        result = await mgr.retrieve("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_expire_all_layers(self):
        mgr = LayerManager()
        results = await mgr.expire_all_layers()
        assert len(results) == 4
        for lt in LayerType:
            assert lt in results

    @pytest.mark.asyncio
    async def test_stats_all(self):
        mgr = LayerManager()
        await mgr.store(LayerType.SESSION, "e1", "test")
        stats = await mgr.stats_all()
        assert len(stats) == 4
        assert stats[LayerType.SESSION].total_entries == 1

    @pytest.mark.asyncio
    async def test_layer_manager_with_ids(self):
        mgr = LayerManager(
            session_id="s1",
            user_id="u1",
            project_id="p1"
        )
        session_layer = mgr.get_layer(LayerType.SESSION)
        assert isinstance(session_layer, SessionLayer)
        assert session_layer.session_id == "s1"


# ============================================================
# create_layer Factory Tests
# ============================================================

class TestCreateLayer:

    def test_create_ephemeral(self):
        layer = create_layer(LayerType.EPHEMERAL)
        assert isinstance(layer, EphemeralLayer)

    def test_create_session(self):
        layer = create_layer(LayerType.SESSION, session_id="s1")
        assert isinstance(layer, SessionLayer)

    def test_create_user(self):
        layer = create_layer(LayerType.USER, user_id="u1")
        assert isinstance(layer, UserLayer)

    def test_create_project(self):
        layer = create_layer(LayerType.PROJECT, project_id="p1")
        assert isinstance(layer, ProjectLayer)

    def test_create_invalid(self):
        with pytest.raises(ValueError):
            create_layer("invalid")
