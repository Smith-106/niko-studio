# -*- coding: utf-8 -*-
"""VectorSearch extra tests - search_chunk_vectors, async methods, upsert_vector, delete_vector."""

import pytest
import json
import sqlite3
import numpy as np
from unittest.mock import MagicMock, patch, PropertyMock

from src.search.vector_search import (
    VectorSearch,
    SearchResult,
    VectorIndex,
    _normalize_search_result_fields,
    _normalize_loc,
    _build_search_metadata,
    _keyword_search,
    _like_search,
    hybrid_search,
    search_memory_vectors,
    search_chunk_vectors,
)


@pytest.fixture()
def vs(tmp_path):
    db = str(tmp_path / "vec.db")
    with patch("src.search.vector_search.sqlite_vec", None):
        v = VectorSearch(db_path=db)
    return v


class TestSearchChunkVectors:
    def test_delegates_to_search(self, vs):
        with patch.object(vs, "search", return_value=[{"id": "1"}]) as mock_s:
            result = vs.search_chunk_vectors("query", top_k=3)
        mock_s.assert_called_once_with("query", type_filter="chunk", top_k=3)
        assert result == [{"id": "1"}]


class TestSearchMemoryVectors:
    def test_delegates_to_search(self, vs):
        with patch.object(vs, "search", return_value=[{"id": "m1"}]) as mock_s:
            result = vs.search_memory_vectors("query", top_k=2)
        mock_s.assert_called_once_with("query", type_filter="memory", top_k=2)

    def test_exception_returns_empty(self, vs):
        with patch.object(vs, "search", side_effect=RuntimeError("fail")):
            result = vs.search_memory_vectors("query")
        assert result == []


class TestUpsertVector:
    def test_upsert_inserts_item(self, vs):
        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = iter([np.array([1.0, 0.0, 0.0], dtype=np.float32)])
        vs._embedder = mock_embedder

        # sqlite_vec is None, so the vec_items INSERT is skipped
        with patch("src.search.vector_search.sqlite_vec", None):
            vs.upsert_vector(id="item1", content="hello world", metadata={"tag": "test"}, type="chunk")

        conn = vs._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, content, type FROM items WHERE id = ?", ("item1",))
        row = cursor.fetchone()
        conn.close()
        assert row is not None
        assert row["id"] == "item1"
        assert row["content"] == "hello world"

    def test_upsert_replaces_existing(self, vs):
        mock_embedder = MagicMock()
        vs._embedder = mock_embedder

        with patch("src.search.vector_search.sqlite_vec", None):
            mock_embedder.embed.return_value = iter([np.array([1.0, 0.0], dtype=np.float32)])
            vs.upsert_vector(id="item1", content="v1")
            mock_embedder.embed.return_value = iter([np.array([0.0, 1.0], dtype=np.float32)])
            vs.upsert_vector(id="item1", content="v2")

        conn = vs._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM items WHERE id = ?", ("item1",))
        row = cursor.fetchone()
        conn.close()
        assert row["content"] == "v2"


class TestDeleteVector:
    def test_delete_existing(self, vs):
        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = iter([np.array([1.0], dtype=np.float32)])
        vs._embedder = mock_embedder

        with patch("src.search.vector_search.sqlite_vec", None):
            vs.upsert_vector(id="d1", content="to delete")
            vs.delete_vector("d1")

        conn = vs._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM items WHERE id = ?", ("d1",))
        assert cursor.fetchone() is None
        conn.close()

    def test_delete_nonexistent(self, vs):
        vs.delete_vector("nonexistent")


class TestVectorSearchSearch:
    def test_brute_force_path(self, vs):
        """Test search via brute force (sqlite_vec=None)."""
        mock_embedder = MagicMock()
        dim = 4
        emb1 = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
        emb2 = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32)
        query_emb = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)

        call_count = 0
        def embed_side_effect(texts):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([emb1])
            elif call_count == 2:
                return iter([emb2])
            return iter([query_emb])

        mock_embedder.embed.side_effect = embed_side_effect
        vs._embedder = mock_embedder

        with patch("src.search.vector_search.sqlite_vec", None):
            vs.upsert_vector(id="s1", content="similar", metadata={}, type="chunk")
            vs.upsert_vector(id="s2", content="different", metadata={}, type="chunk")

            mock_embedder.embed.side_effect = None
            mock_embedder.embed.return_value = iter([query_emb])

            results = vs.search("similar query", top_k=2, min_score=0.0)
        assert len(results) >= 1
        assert results[0]["id"] == "s1"


class TestNormalizeLoc:
    def test_none(self):
        assert _normalize_loc(None) is None

    def test_empty_dict(self):
        assert _normalize_loc({}) is None

    def test_dict_with_kind(self):
        result = _normalize_loc({"kind": "char", "start": 10, "end": 20})
        assert result["kind"] == "char"
        assert result["start"] == 10
        assert result["end"] == 20

    def test_dict_defaults(self):
        result = _normalize_loc({"kind": "line"})
        assert result["kind"] == "line"
        assert result["start"] == 0
        assert result["end"] is None


class TestBuildSearchMetadata:
    def test_basic(self):
        meta = _build_search_metadata(path="/test.md", doc_id="d1")
        assert meta["path"] == "/test.md"
        assert meta["doc_id"] == "d1"
        assert meta["extra"] == {}

    def test_with_loc(self):
        meta = _build_search_metadata(
            loc={"kind": "char", "start": 0, "end": 100},
            chunk_index=3,
        )
        assert meta["loc"]["kind"] == "char"
        assert meta["chunk_index"] == 3

    def test_with_extra(self):
        meta = _build_search_metadata(extra={"custom": "value"})
        assert meta["extra"]["custom"] == "value"

    def test_all_none(self):
        meta = _build_search_metadata()
        assert meta["path"] is None
        assert meta["doc_id"] is None
        assert meta["surface"] is None
        assert meta["loc"] is None
        assert meta["chunk_index"] is None




class TestVectorIndexExtraBranches:
    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_connection_creates_parent_directory(self, tmp_path):
        nested = tmp_path / "x" / "y" / "z.db"
        vi = VectorIndex(db_path=str(nested))
        conn = vi._get_connection()
        conn.close()
        assert nested.parent.exists()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_embedder_property_loads_text_embedding(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "emb.db"), model_name="mock-model")
        fake_embedder = MagicMock()
        with patch("src.search.vector_search.TextEmbedding", return_value=fake_embedder) as mock_te:
            assert vi.embedder is fake_embedder
            mock_te.assert_called_once_with(model_name="mock-model")

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_keyword_search_falls_back_to_like_on_sql_error(self, tmp_path):
        db_path = str(tmp_path / "kw_fallback.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.2] * 384
        vi.add(id="k1", content="fallback keyword content", embedding=emb)

        original_get = vi._get_connection

        class WrapperCursor:
            def __init__(self, real_cursor):
                self._real = real_cursor

            def execute(self, sql, params=None):
                if "vector_items_fts" in sql:
                    raise sqlite3.OperationalError("fts broken")
                if params is None:
                    return self._real.execute(sql)
                return self._real.execute(sql, params)

            def __iter__(self):
                return iter(self._real)

            def __getattr__(self, name):
                return getattr(self._real, name)

        class WrapperConn:
            def __init__(self, real_conn):
                self._real = real_conn

            def cursor(self):
                return WrapperCursor(self._real.cursor())

            def close(self):
                self._real.close()

        def fake_conn():
            return WrapperConn(original_get())

        with patch.object(vi, "_get_connection", side_effect=fake_conn):
            results = _keyword_search(vi, "fallback", top_k=3)

        assert len(results) == 1
        assert results[0].id == "k1"


class TestVectorSearchExtraBranches:
    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_connection_creates_parent_directory(self, tmp_path):
        db_path = tmp_path / "nested" / "vs.db"
        vs_local = VectorSearch(db_path=str(db_path))
        conn = vs_local._get_connection()
        conn.close()
        assert db_path.parent.exists()

    @patch("src.search.vector_search.sqlite_vec", None)
    @pytest.mark.asyncio
    async def test_search_async_without_cache_uses_embedder(self, tmp_path):
        with patch("src.search.vector_search.get_query_cache", None):
            vs_local = VectorSearch(db_path=str(tmp_path / "no_cache.db"))
            fake_embedder = MagicMock()
            fake_embedder.embed.return_value = iter([np.array([0.4, 0.6], dtype=np.float32)])
            vs_local._embedder = fake_embedder

            with patch.object(vs_local, "search", return_value=[{"id": "r"}]) as mock_search:
                result = await vs_local.search_async("q")

        assert result == [{"id": "r"}]
        mock_search.assert_called_once_with("q", None, 5, 0.5)

    @patch("src.search.vector_search.sqlite_vec", MagicMock())
    def test_search_with_sqlite_vec_fallback_to_bruteforce(self, tmp_path):
        db_path = str(tmp_path / "vec_fallback.db")
        vs_local = VectorSearch(db_path=db_path)
        fake_embedder = MagicMock()
        fake_embedder.embed.return_value = iter([np.array([1.0, 0.0], dtype=np.float32)])
        vs_local._embedder = fake_embedder

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("m1", "c1", "{}", np.array([1.0, 0.0], dtype=np.float32).tobytes(), "chunk", 1.0),
        )
        conn.commit()
        conn.close()

        class BrokenCursor:
            def execute(self, *args, **kwargs):
                raise RuntimeError("vec broken")

            def __iter__(self):
                return iter([])

        class BrokenConn:
            def __init__(self, path):
                self._real = sqlite3.connect(path)
                self._real.row_factory = sqlite3.Row

            def cursor(self):
                return BrokenCursor()

            def close(self):
                self._real.close()

        with patch.object(vs_local, "_get_connection", return_value=BrokenConn(db_path)):
            with patch.object(vs_local, "_brute_force_search", return_value=[{"id": "m1"}]) as bf:
                results = vs_local.search("query", top_k=1, min_score=0.0)

        bf.assert_called_once()
        assert results == [{"id": "m1"}]


@pytest.mark.asyncio
class TestAsyncMethods:
    async def test_search_memory_vectors_async(self):
        with patch("src.search.vector_search.sqlite_vec", None):
            vs = VectorSearch(db_path=":memory:")
        with patch.object(vs, "search_async", return_value=[{"id": "m1"}]) as mock_sa:
            result = await vs.search_memory_vectors_async("query", top_k=3)
        mock_sa.assert_called_once_with("query", type_filter="memory", top_k=3)
        assert result == [{"id": "m1"}]

    async def test_search_chunk_vectors_async(self):
        with patch("src.search.vector_search.sqlite_vec", None):
            vs = VectorSearch(db_path=":memory:")
        with patch.object(vs, "search_async", return_value=[{"id": "c1"}]) as mock_sa:
            result = await vs.search_chunk_vectors_async("query", top_k=2)
        mock_sa.assert_called_once_with("query", type_filter="chunk", top_k=2)


class TestVectorSearchHighGapBranches:
    def test_module_import_fallback_branches(self, monkeypatch):
        import builtins
        import importlib
        import src.search.vector_search as vector_search_mod

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name in {"fastembed", "sqlite_vec", "src.db.pool"}:
                raise ImportError(name)
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        reloaded = importlib.reload(vector_search_mod)
        assert reloaded.TextEmbedding is None
        assert reloaded.sqlite_vec is None
        assert reloaded.get_pool is None
        assert reloaded.AsyncConnectionPool is None

    def test_import_fallback_query_cache_branch(self, monkeypatch):
        import builtins
        import importlib
        import src.search.vector_search as vector_search_mod

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "src.memory.query_cache":
                raise ImportError(name)
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        reloaded = importlib.reload(vector_search_mod)
        assert reloaded.get_query_cache is None

        monkeypatch.setattr(builtins, "__import__", real_import)
        importlib.reload(vector_search_mod)

    def test_vectorindex_get_connection_sqlite_vec_load_exception(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_vec_load_exc.db"))
        fake_vec = MagicMock()
        fake_vec.load.side_effect = RuntimeError("load-fail")

        with patch("src.search.vector_search.sqlite_vec", fake_vec):
            conn = vi._get_connection()
            conn.close()

        vi = VectorIndex(db_path=str(tmp_path / "vi_add_vec.db"))
        vi._embedder = MagicMock(embed=MagicMock(return_value=iter([np.array([1.0, 0.0], dtype=np.float32)])))

        class FakeCursor:
            def __init__(self):
                self.lastrowid = 9
                self._count = 0

            def execute(self, sql, params=None):
                if "SELECT rowid FROM vector_items" in sql:
                    self._count += 1
                return None

            def fetchone(self):
                return {"rowid": 7}

        class FakeConn:
            def __init__(self):
                self.cur = FakeCursor()

            def cursor(self):
                return self.cur

            def commit(self):
                return None

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vi, "_get_connection", return_value=FakeConn()):
                vi.add(id="x1", content="x")

    def test_vectorindex_search_sqlite_vec_and_fallback_branches(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_search_vec.db"))
        vi._embedder = MagicMock(
            embed=MagicMock(side_effect=lambda _: iter([np.array([1.0, 0.0], dtype=np.float32)]))
        )
        class OkCursor:
            def __init__(self):
                self.rows = iter([
                    {"id": "a", "content": "A", "metadata": "{}", "type": "chunk", "distance": 0.1},
                    {"id": "b", "content": "B", "metadata": "{}", "type": "memory", "distance": 0.2},
                ])

            def execute(self, sql, params=None):
                return None

            def __iter__(self):
                return self.rows

        class OkConn:
            def cursor(self):
                return OkCursor()

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vi, "_get_connection", return_value=OkConn()):
                out = vi.search("q", top_k=1, min_score=0.0, type_filter="chunk")
        assert len(out) == 1

        class BadCursor:
            def execute(self, sql, params=None):
                raise RuntimeError("vec-error")

            def __iter__(self):
                return iter([])

        class BadConn:
            def cursor(self):
                return BadCursor()

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vi, "_get_connection", return_value=BadConn()):
                with patch.object(vi, "_brute_force_search", return_value=[]) as bf:
                    vi.search("q", top_k=1, min_score=0.0)
        bf.assert_called_once()

    def test_vectorindex_bruteforce_zero_norm_branch(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_bf_zero.db"))
        conn = vi._get_connection()
        conn.execute(
            "INSERT INTO vector_items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("z1", "zero", "{}", np.array([0.0, 0.0], dtype=np.float32).tobytes(), "chunk", 1.0),
        )
        conn.commit()
        result = vi._brute_force_search(conn, np.array([0.0, 0.0], dtype=np.float32), 5, 0.0)
        conn.close()
        assert result

    def test_hybrid_search_keyword_only_and_min_score_continue(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_hybrid.db"))
        kw = SearchResult(id="k1", content="kw", score=0.8)

        with patch.object(vi, "search", return_value=[]), patch("src.search.vector_search._keyword_search", return_value=[kw]):
            low = hybrid_search(vi, "q", top_k=5, min_score=0.0)
            high = hybrid_search(vi, "q", top_k=5, min_score=1.0)

        assert len(low) == 1
        assert high == []

    def test_like_search_type_filter_branch(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_like_filter.db"))
        emb = [0.1] * 384
        vi.add(id="l1", content="hello filter", embedding=emb, type="memory")
        out = _like_search(vi, "hello", top_k=5, type_filter="memory")
        assert out

    def test_wrapper_search_memory_and_chunk_functions(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_wrap.db"))
        with patch.object(vi, "search", return_value=[] ) as mock_s:
            search_memory_vectors(vi, "q", top_k=2)
            search_chunk_vectors(vi, "q", top_k=3)
        assert mock_s.call_count == 2

    def test_vectorsearch_sqlite_vec_exception_and_vector_branches(self, tmp_path):
        vs_local = VectorSearch(db_path=str(tmp_path / "vs_vec.db"))
        vs_local._embedder = MagicMock(
            embed=MagicMock(side_effect=lambda _: iter([np.array([1.0, 0.0], dtype=np.float32)]))
        )

        fake_vec = MagicMock()
        fake_vec.load.side_effect = RuntimeError("load-fail")

        class VecCursor:
            def __init__(self):
                self.lastrowid = 11
                self.rows = iter([
                    {"id": "v1", "content": "c", "metadata": "{}", "type": "chunk", "distance": 0.1},
                ])

            def execute(self, sql, params=None):
                return None

            def fetchone(self):
                return {"rowid": 5}

            def __iter__(self):
                return self.rows

        class VecConn:
            def __init__(self):
                self.cur = VecCursor()

            def cursor(self):
                return self.cur

            def commit(self):
                return None

            def close(self):
                return None

            def enable_load_extension(self, _flag):
                return None

        with patch("src.search.vector_search.sqlite_vec", fake_vec):
            with patch.object(vs_local, "_get_connection", return_value=VecConn()):
                conn = vs_local._get_connection()
                conn.close()
                vs_local.upsert_vector("u1", "hello")
                out = vs_local.search("hello", top_k=1, min_score=0.0)
                vs_local.delete_vector("u1")
        assert len(out) == 1

    def test_vectorsearch_get_connection_sqlite_vec_load_exception_branch(self, tmp_path):
        vs_local = VectorSearch(db_path=str(tmp_path / "vs_conn_vec_load_exc.db"))
        fake_vec = MagicMock()
        fake_vec.load.side_effect = RuntimeError("vec-load-fail")

        with patch("src.search.vector_search.sqlite_vec", fake_vec):
            conn = vs_local._get_connection()
            conn.close()

        vs_local = VectorSearch(db_path=str(tmp_path / "vs_dim.db"))

        class FakeCursor:
            def execute(self, sql, params=None):
                return None

        class FakeConn:
            def cursor(self):
                return FakeCursor()

            def commit(self):
                return None

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vs_local, "_get_connection", return_value=FakeConn()):
                vs_local._embedder = object()
                vs_local._init_vector_db()

        class BadEmbedder:
            @property
            def embedding_size(self):
                raise RuntimeError("bad-dim")

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vs_local, "_get_connection", return_value=FakeConn()):
                vs_local._embedder = BadEmbedder()
                vs_local._init_vector_db()

    def test_vectorindex_search_type_filter_continue_branch(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_type_continue.db"))
        vi._embedder = MagicMock(
            embed=MagicMock(side_effect=lambda _: iter([np.array([1.0, 0.0], dtype=np.float32)]))
        )

        class Cursor:
            def __iter__(self):
                return iter([
                    {"id": "m1", "content": "M", "metadata": "{}", "type": "memory", "distance": 0.1},
                    {"id": "c1", "content": "C", "metadata": "{}", "type": "chunk", "distance": 0.2},
                ])

            def execute(self, sql, params=None):
                return None

        class Conn:
            def cursor(self):
                return Cursor()

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vi, "_get_connection", return_value=Conn()):
                out = vi.search("q", top_k=2, min_score=0.0, type_filter="chunk")

        assert len(out) == 1
        assert out[0].id == "c1"

    def test_vectorindex_delete_sqlite_vec_branch(self, tmp_path):
        vi = VectorIndex(db_path=str(tmp_path / "vi_delete_vec.db"))

        class Cursor:
            def __init__(self):
                self.deleted_vec = False

            def execute(self, sql, params=None):
                if "DELETE FROM vec_index" in sql:
                    self.deleted_vec = True
                return None

            def fetchone(self):
                return {"rowid": 3}

        class Conn:
            def __init__(self):
                self.cur = Cursor()

            def cursor(self):
                return self.cur

            def commit(self):
                return None

            def close(self):
                return None

        conn = Conn()
        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vi, "_get_connection", return_value=conn):
                ok = vi.delete("d1")

        assert ok is True
        assert conn.cur.deleted_vec is True

    def test_vectorsearch_init_vector_db_returns_when_sqlite_vec_missing(self, tmp_path):
        vs_local = VectorSearch(db_path=str(tmp_path / "vs_no_vec.db"))
        with patch("src.search.vector_search.sqlite_vec", None):
            vs_local._init_vector_db()

    def test_vectorsearch_search_type_filter_continue_branch(self, tmp_path):
        vs_local = VectorSearch(db_path=str(tmp_path / "vs_type_continue.db"))
        vs_local._embedder = MagicMock(
            embed=MagicMock(side_effect=lambda _: iter([np.array([1.0, 0.0], dtype=np.float32)]))
        )

        class Cursor:
            def execute(self, sql, params=None):
                return None

            def __iter__(self):
                return iter([
                    {"id": "m1", "content": "M", "metadata": "{}", "type": "memory", "distance": 0.1},
                    {"id": "c1", "content": "C", "metadata": "{}", "type": "chunk", "distance": 0.2},
                ])

        class Conn:
            def cursor(self):
                return Cursor()

            def close(self):
                return None

        with patch("src.search.vector_search.sqlite_vec", MagicMock()):
            with patch.object(vs_local, "_get_connection", return_value=Conn()):
                out = vs_local.search("q", type_filter="chunk", top_k=2, min_score=0.0)

        assert len(out) == 1
        assert out[0]["id"] == "c1"

    @pytest.mark.asyncio
    async def test_vectorsearch_search_async_cache_miss_branch(self, tmp_path):
        vs_local = VectorSearch(db_path=str(tmp_path / "vs_cache.db"))
        cache = MagicMock()
        cache.get.return_value = None
        vs_local._embedder = MagicMock(embed=MagicMock(return_value=iter([np.array([1.0, 0.0], dtype=np.float32)])))

        with patch("src.search.vector_search.get_query_cache", return_value=cache):
            with patch.object(vs_local, "search", return_value=[]):
                out = await vs_local.search_async("query", top_k=1)

        assert out == []
        cache.put.assert_called_once()
