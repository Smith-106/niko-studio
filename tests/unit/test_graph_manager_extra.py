# -*- coding: utf-8 -*-
"""Extra branch tests for src.graph.graph_manager."""

import sqlite3
from docs.contracts.graph_contracts import Entity, EntityType, RelationType, Relationship
from src.graph.graph_manager import CypherParser, GraphManager


def test_default_db_path_branch(tmp_path, monkeypatch):
    monkeypatch.setattr("src.graph.graph_manager.Path.home", lambda: tmp_path / "home")
    manager = GraphManager(db_path=None)
    try:
        assert str(manager.db_path).endswith("graph_manager.db")
    finally:
        manager.close()


def _seed_basic(manager: GraphManager):
    manager.create_entity(Entity(id="e1", name="A", type=EntityType.CHARACTER, properties={"tag": "x"}))
    manager.create_entity(Entity(id="e2", name="B", type=EntityType.CHARACTER, properties={"tag": "y"}))
    manager.create_relationship(
        Relationship(id="r1", source_id="e1", target_id="e2", type=RelationType.KNOWS, properties={"k": 1}, weight=2.0)
    )


def test_parser_unknown_order_and_empty_props_and_more_types():
    parsed = CypherParser.parse("FOO (n) ORDER BY n.name")
    assert parsed["type"] == "UNKNOWN"
    assert parsed["order_by"] == "n.name"

    delete_parsed = CypherParser.parse("DELETE (n)")
    assert delete_parsed["type"] == "DELETE"

    set_parsed = CypherParser.parse("SET n.name = 'x'")
    assert set_parsed["type"] == "SET"

    assert CypherParser._parse_props("") == {}
    props = CypherParser._parse_props("x: 1.5")
    assert props["x"] == 1.5


def test_row_to_entity_invalid_timestamps_and_batch_empty(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        manager._conn.execute(
            "INSERT INTO entities (id,name,type,properties,created_at,updated_at) VALUES (?,?,?,?,?,?)",
            ("e_bad", "Bad", "character", "{}", "not-iso", "not-iso"),
        )
        manager._conn.commit()

        row = manager._conn.execute("SELECT * FROM entities WHERE id='e_bad'").fetchone()
        ent = manager._row_to_entity(row)
        assert ent.created_at is None
        assert ent.updated_at is None

        assert manager.get_entities_batch([]) == {}
    finally:
        manager.close()


def test_run_cypher_sql_select_and_rowcount_branch(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        selected = manager.run_cypher("SELECT 1 as x")
        assert selected[0]["x"] == 1

        changed = manager.run_cypher("UPDATE entities SET name = name")
        assert "affected_rows" in changed[0]
    finally:
        manager.close()


def test_execute_match_alias_none_relationship_no_type_and_where_ops(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        _seed_basic(manager)

        alias_none = manager.run_cypher("MATCH (:Character) RETURN n")
        assert alias_none
        assert "n" in alias_none[0]

        no_type = manager.run_cypher("MATCH (a:Character)-[r]->(b:Character) RETURN a, r, b")
        assert len(no_type) == 1

        limited = manager.run_cypher("MATCH (a:Character)-[r]->(b:Character) RETURN a, r, b LIMIT 1")
        assert len(limited) == 1

        by_id = manager.run_cypher("MATCH (n:Character) WHERE n.id = 'e1' RETURN n")
        assert len(by_id) == 1

        by_type = manager.run_cypher("MATCH (n:Character) WHERE n.type = 'CHARACTER' RETURN n")
        assert len(by_type) == 2

        by_gt = manager.run_cypher("MATCH (n:Character) WHERE n.rank > 1 RETURN n")
        assert by_gt == []

        by_contains = manager.run_cypher("MATCH (n:Character) WHERE n.tag CONTAINS 'x' RETURN n")
        assert len(by_contains) == 1
    finally:
        manager.close()


def test_execute_create_invalid_label_falls_back_to_concept_and_anon_name(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        out = manager.run_cypher("CREATE (n:NotAType {name: 'X'})")
        created_id = out[0]["created"]
        created = manager.get_entity(created_id)
        assert created.type == EntityType.CONCEPT

        out2 = manager.run_cypher("CREATE (n:Character {})")
        created2 = manager.get_entity(out2[0]["created"])
        assert created2.name.startswith("Entity_")
    finally:
        manager.close()


def test_create_entity_and_relationship_generate_id_branches(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        e = Entity(id="", name="Auto", type=EntityType.CONCEPT)
        eid = manager.create_entity(e)
        assert eid

        e2 = Entity(id="e2", name="Auto2", type=EntityType.CONCEPT)
        manager.create_entity(e2)

        r = Relationship(id="", source_id=eid, target_id="e2", type=RelationType.RELATED_TO)
        rid = manager.create_relationship(r)
        assert rid
    finally:
        manager.close()


def test_update_delete_relationship_and_entity_false_branches(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        missing_entity = Entity(id="nope", name="x", type=EntityType.CONCEPT)
        assert manager.update_entity(missing_entity) is False

        assert manager.delete_entity("nope") is False
        assert manager.delete_relationship("nope-rel") is False
    finally:
        manager.close()


def test_get_relationships_in_direction_branch(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        _seed_basic(manager)
        incoming = manager.get_relationships("e2", direction="in")
        assert len(incoming) == 1
        assert incoming[0].target_id == "e2"
    finally:
        manager.close()


def test_find_related_entities_visited_continue_branch(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        manager.create_entity(Entity(id="n1", name="N1", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="n2", name="N2", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="n3", name="N3", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="n4", name="N4", type=EntityType.CONCEPT))

        manager.create_relationship(Relationship(id="r12", source_id="n1", target_id="n2", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="r13", source_id="n1", target_id="n3", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="r24", source_id="n2", target_id="n4", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="r34", source_id="n3", target_id="n4", type=RelationType.RELATED_TO))

        related = manager.find_related_entities("n1", max_depth=3)
        ids = [e.id for e in related]
        assert len(ids) == len(set(ids))
        assert "n4" in ids
    finally:
        manager.close()


def test_find_shortest_path_visited_continue_branch(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        manager.create_entity(Entity(id="a", name="A", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="b", name="B", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="c", name="C", type=EntityType.CONCEPT))

        manager.create_relationship(Relationship(id="ab", source_id="a", target_id="b", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="ba", source_id="b", target_id="a", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="bc", source_id="b", target_id="c", type=RelationType.RELATED_TO))

        path = manager.find_shortest_path("a", "c")
        assert path is not None
        assert path.nodes[-1].id == "c"
    finally:
        manager.close()


def test_find_shortest_path_self_missing_and_get_subgraph_repeat_visit(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        assert manager.find_shortest_path("missing", "missing") is None

        manager.create_entity(Entity(id="a", name="A", type=EntityType.CONCEPT))
        manager.create_entity(Entity(id="b", name="B", type=EntityType.CONCEPT))
        manager.create_relationship(Relationship(id="ab", source_id="a", target_id="b", type=RelationType.RELATED_TO))
        manager.create_relationship(Relationship(id="ba", source_id="b", target_id="a", type=RelationType.RELATED_TO))

        sg = manager.get_subgraph("a", radius=2)
        assert sg.center_entity_id == "a"
        assert len(sg.entities) >= 1
    finally:
        manager.close()


def test_search_entities_like_fallback_and_alias_methods(tmp_path):
    manager = GraphManager(db_path=str(tmp_path / "gm.db"))
    try:
        manager.create_entity(Entity(id="c1", name="FindMe", type=EntityType.CHARACTER, properties={"bio": "needle"}))

        real_conn = manager._conn

        class _ConnWrapper:
            def __init__(self, conn):
                self._conn = conn

            def execute(self, sql, params=()):
                if "entities_fts" in sql:
                    raise sqlite3.OperationalError("fts disabled")
                return self._conn.execute(sql, params)

            def __getattr__(self, item):
                return getattr(self._conn, item)

        manager._conn = _ConnWrapper(real_conn)
        found = manager.search_entities("Find", limit=5)
        assert found and found[0].name == "FindMe"

        manager.create_entity(Entity(id="l1", name="Loc", type=EntityType.LOCATION, properties={"k": "v"}))
        fallback_typed = manager.search_entities("Loc", entity_type=EntityType.LOCATION, limit=5)
        assert len(fallback_typed) == 1

        manager._conn = real_conn
        manager.create_entity(Entity(id="c2", name="Alias", type=EntityType.CONCEPT))
        out_id = manager.add_entity(Entity(id="", name="Alias2", type=EntityType.CONCEPT))
        assert out_id

        rel_id = manager.add_relation(Relationship(id="", source_id="c2", target_id=out_id, type=RelationType.RELATED_TO))
        assert rel_id
    finally:
        manager.close()


def test_context_manager_close_sets_conn_none(tmp_path):
    path = str(tmp_path / "ctx.db")
    with GraphManager(db_path=path) as manager:
        manager.create_entity(Entity(id="x", name="X", type=EntityType.CONCEPT))

    reopened = GraphManager(db_path=path)
    try:
        stats = reopened.get_entity_stats()
        assert stats.total_entities >= 1
        reopened.close()
        assert reopened._conn is None
    finally:
        if reopened._conn is not None:
            reopened.close()
