# -*- coding: utf-8 -*-
"""Extra branch tests for src.graph.graph_engine."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.graph.graph_engine import GraphEngine


@pytest.mark.asyncio
async def test_init_path_resolution_data_dir_and_home_fallback(tmp_path, monkeypatch):
    def _from_data_dir(key, default=None):
        if key == "graph.db_path":
            return None
        if key == "data_dir":
            return str(tmp_path / "data-dir")
        return default

    with patch("src.graph.graph_engine.get_config_value", side_effect=_from_data_dir):
        engine = GraphEngine(db_path=None)
    try:
        assert engine.db_path == Path(tmp_path / "data-dir" / "graph.db")
    finally:
        engine.close()

    monkeypatch.setattr("src.graph.graph_engine.Path.home", lambda: tmp_path / "home-dir")
    with patch("src.graph.graph_engine.get_config_value", return_value=None):
        engine2 = GraphEngine(db_path=None)
    try:
        assert engine2.db_path == Path(tmp_path / "home-dir" / ".niko" / "graph.db")
    finally:
        engine2.close()


@pytest.mark.asyncio
async def test_plugin_duplicate_load_error_and_health_error_paths(tmp_path):
    plugin = MagicMock()
    plugin.name = "p"
    plugin.load = AsyncMock(side_effect=RuntimeError("load boom"))
    plugin.health_check = AsyncMock(side_effect=RuntimeError("hc boom"))

    engine = GraphEngine(db_path=str(tmp_path / "g.db"), plugins=[plugin])
    try:
        engine._register_plugins([plugin])
        assert len(engine.plugins) == 1

        await engine.initialize()
        assert engine._plugin_health["p"]["status"] == "error"

        status = await engine.health_check()
        assert status["plugins"]["p"]["status"] == "error"
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_health_check_db_execute_error_branch(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        engine.close()
        status = await engine.health_check()
        assert status["db_ok"] is False
        assert status["error"]
    finally:
        try:
            engine.close()
        except Exception:
            pass


def test_from_config_uses_data_dir_fallback(tmp_path):
    def _cfg(key, default=None):
        if key == "graph.db_path":
            return None
        if key == "data_dir":
            return str(tmp_path / "cfg-dir")
        return default

    with patch("src.graph.graph_engine.get_config_value", side_effect=_cfg):
        engine = GraphEngine.from_config()
    try:
        assert engine.db_path == Path(tmp_path / "cfg-dir" / "graph.db")
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_execute_cypher_sql_success_and_error_paths(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        ok = await engine.execute_cypher("SELECT 1 AS x")
        assert ok[0]["x"] == 1

        bad = await engine.execute_cypher("SELECT * FROM no_such_table")
        assert "error" in bad[0]
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_execute_match_property_field_and_no_pattern_branch(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        await engine.create_entity("Character", "hero", {"role": "protagonist"})

        by_prop = await engine.execute_cypher("MATCH (n:Character) WHERE n.role = 'protagonist' RETURN n")
        assert len(by_prop) == 1
        assert by_prop[0]["name"] == "hero"

        no_pattern = await engine._execute_match("MATCH n RETURN n")
        assert no_pattern == []
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_search_entities_by_name_like_query_branch(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        await engine.create_entity("Character", "hero", {"role": "protagonist"})

        results = await engine.search_entities_by_name("Character", "%he%", limit=10)

        assert len(results) == 1
        assert results[0]["name"] == "hero"
        assert "created_at" in results[0]
        assert "updated_at" in results[0]
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_get_character_timeline_and_relationship_filter(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        await engine.create_entity("Character", "hero", {})
        await engine.create_entity("Character", "villain", {})
        await engine.create_entity("Event", "final", {"time": 2})

        await engine.create_relation("hero", "villain", "RIVAL")
        await engine.create_relation("hero", "final", "PARTICIPATES")

        ch = await engine.get_character("hero", include_relations=True, include_timeline=True)
        assert len(ch["timeline"]) == 1
        assert ch["timeline"][0]["event"] == "final"

        filtered = await engine.get_relationships("hero", relationship_type="RIVAL")
        assert len(filtered) == 2
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_relation_and_entity_not_found_branches(tmp_path):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        missing_char = await engine.get_relationships("nobody")
        assert missing_char == []

        await engine.create_entity("Character", "only_one", {})

        miss_from = await engine.create_relation("missing", "only_one", "KNOWS")
        assert "error" in miss_from and "missing" in miss_from["error"]

        miss_to = await engine.create_relation("only_one", "missing", "KNOWS")
        assert "error" in miss_to and "missing" in miss_to["error"]

        miss_update = await engine.update_entity("missing", {"x": 1})
        assert "error" in miss_update

        miss_delete = await engine.delete_entity("missing")
        assert "error" in miss_delete
    finally:
        engine.close()


@pytest.mark.asyncio
async def test_neo4j_projection_warning_branches(tmp_path, monkeypatch):
    engine = GraphEngine(db_path=str(tmp_path / "g.db"))
    try:
        graph_projection = MagicMock()
        graph_projection.project_entity = AsyncMock(side_effect=RuntimeError("entity boom"))
        graph_projection.project_relation = AsyncMock(side_effect=RuntimeError("relation boom"))

        engine._integration_adapters = MagicMock()
        engine._integration_adapters.flags.neo4j_enabled = True
        engine._integration_adapters.graph_projection = graph_projection

        warn_mock = MagicMock()
        monkeypatch.setattr("src.graph.graph_engine.logger.warning", warn_mock)

        await engine._run_neo4j_entity_projection({"id": "e1"})
        await engine._run_neo4j_relation_projection({"id": "r1"})

        assert warn_mock.call_count == 2
        args1, _ = warn_mock.call_args_list[0]
        args2, _ = warn_mock.call_args_list[1]
        assert "Neo4j entity projection failed" in args1[0]
        assert "Neo4j relation projection failed" in args2[0]
    finally:
        engine.close()
