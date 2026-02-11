# -*- coding: utf-8 -*-
"""
VectorSearch Tests

Tests for helper functions, dataclasses, VectorIndex (with mocked DB),
VectorSearch, and hybrid/keyword search functions.
"""

import json
import sqlite3
import numpy as np
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from pathlib import Path

from src.search.vector_search import (
    SearchResult,
    SearchResultLocation,
    SearchResultMeta,
    HNSWConfig,
    VectorIndex,
    VectorSearch,
    hybrid_search,
    _normalize_loc,
    _build_search_metadata,
    _normalize_search_result_fields,
    _keyword_search,
    _like_search,
    create_vector_index,
    search_memory_vectors,
    search_chunk_vectors,
    get_vector_stats,
    build_search_result_snapshot,
    REQUIRED_SEARCH_RESULT_FIELDS,
    SAMPLE_SEARCH_QUERY,
    DEFAULT_EMBEDDING_DIM,
    LOC_KIND_LINE,
    LOC_KIND_CHAR,
    LOC_KIND_RANGE,
)


# ============================================================
# Constants
# ============================================================

class TestConstants:

    def test_default_dim(self):
        assert DEFAULT_EMBEDDING_DIM == 384

    def test_loc_kinds(self):
        assert LOC_KIND_LINE == "line"
        assert LOC_KIND_CHAR == "char"
        assert LOC_KIND_RANGE == "range"

    def test_required_fields(self):
        assert "id" in REQUIRED_SEARCH_RESULT_FIELDS
        assert "content" in REQUIRED_SEARCH_RESULT_FIELDS
        assert "score" in REQUIRED_SEARCH_RESULT_FIELDS


# ============================================================
# _normalize_loc
# ============================================================

class TestNormalizeLoc:

    def test_none(self):
        assert _normalize_loc(None) is None

    def test_empty_dict(self):
        assert _normalize_loc({}) is None

    def test_basic(self):
        result = _normalize_loc({"kind": "line", "start": 10, "end": 20})
        assert result["kind"] == "line"
        assert result["start"] == 10
        assert result["end"] == 20

    def test_defaults(self):
        result = _normalize_loc({"start": 5})
        assert result["kind"] == LOC_KIND_CHAR
        assert result["start"] == 5
        assert result["end"] is None

    def test_string_values(self):
        result = _normalize_loc({"kind": "range", "start": "3", "end": "7"})
        assert result["start"] == 3
        assert result["end"] == 7


# ============================================================
# _build_search_metadata
# ============================================================

class TestBuildSearchMetadata:

    def test_defaults(self):
        meta = _build_search_metadata()
        assert meta["path"] is None
        assert meta["doc_id"] is None
        assert meta["extra"] == {}

    def test_with_values(self):
        meta = _build_search_metadata(path="/a.md", doc_id="d1", surface="file")
        assert meta["path"] == "/a.md"
        assert meta["doc_id"] == "d1"
        assert meta["surface"] == "file"

    def test_with_loc(self):
        meta = _build_search_metadata(loc={"kind": "line", "start": 1})
        assert meta["loc"]["kind"] == "line"

    def test_with_extra(self):
        meta = _build_search_metadata(extra={"k": "v"})
        assert meta["extra"]["k"] == "v"


# ============================================================
# _normalize_search_result_fields
# ============================================================

class TestNormalizeSearchResultFields:

    def test_basic(self):
        result = _normalize_search_result_fields(
            result_id="r1", content="text", score=0.9,
            item_type="chunk", source="vector"
        )
        assert isinstance(result, SearchResult)
        assert result.id == "r1"
        assert result.score == 0.9
        assert result.snapshot_query == SAMPLE_SEARCH_QUERY

    def test_with_metadata(self):
        result = _normalize_search_result_fields(
            result_id="r2", content="c", score=0.5,
            item_type="memory", source="keyword",
            metadata={"path": "/x.md", "doc_id": "d2", "custom_key": "val"}
        )
        assert result.metadata["path"] == "/x.md"
        assert result.metadata["extra"]["custom_key"] == "val"

    def test_loc_fallback(self):
        result = _normalize_search_result_fields(
            result_id="r3", content="c", score=0.1,
            item_type="chunk", source="vector",
            metadata={"loc": {"kind": "line", "start": 5}}
        )
        assert result.loc["kind"] == "line"

    def test_explicit_loc_overrides(self):
        result = _normalize_search_result_fields(
            result_id="r4", content="c", score=0.1,
            item_type="chunk", source="vector",
            loc={"kind": "range", "start": 10, "end": 20},
            metadata={"loc": {"kind": "line", "start": 5}}
        )
        assert result.loc["kind"] == "range"


# ============================================================
# SearchResult
# ============================================================

class TestSearchResult:

    def test_defaults(self):
        sr = SearchResult(id="1", content="hello", score=0.8)
        assert sr.type == "chunk"
        assert sr.source == "vector"

    def test_to_dict(self):
        sr = SearchResult(id="1", content="text", score=0.12345)
        d = sr.to_dict()
        assert d["id"] == "1"
        assert d["score"] == 0.1235  # rounded to 4 decimal
        assert d["snapshot_query"] == SAMPLE_SEARCH_QUERY
        assert "metadata" in d

    def test_to_dict_fields(self):
        sr = SearchResult(id="x", content="c", score=0.5, mode_used="semantic")
        d = sr.to_dict()
        for field_name in REQUIRED_SEARCH_RESULT_FIELDS:
            assert field_name in d


# ============================================================
# HNSWConfig
# ============================================================

class TestHNSWConfig:

    def test_defaults(self):
        cfg = HNSWConfig()
        assert cfg.dimension == 384
        assert cfg.ef_construction == 200
        assert cfg.ef_search == 100
        assert cfg.m == 16

    def test_custom(self):
        cfg = HNSWConfig(dimension=768, m=32)
        assert cfg.dimension == 768
        assert cfg.m == 32


# ============================================================
# VectorIndex (with in-memory SQLite, no sqlite-vec)
# ============================================================

class TestVectorIndex:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_init_creates_db(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        assert vi.db_path == Path(db_path)
        assert vi.config.dimension == DEFAULT_EMBEDDING_DIM

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_connection(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        conn = vi._get_connection()
        assert conn is not None
        conn.close()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_add_with_embedding(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="item1", content="hello world", embedding=emb)

        conn = vi._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vector_items WHERE id = ?", ("item1",))
        row = cursor.fetchone()
        assert row is not None
        assert row["content"] == "hello world"
        conn.close()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_delete(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="del1", content="to delete", embedding=emb)
        assert vi.delete("del1") is True
        assert vi.delete("nonexistent") is False

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_stats(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="s1", content="c1", embedding=emb, type="chunk")
        vi.add(id="s2", content="c2", embedding=emb, type="memory")
        stats = vi.get_stats()
        assert stats["total_items"] == 2
        assert stats["by_type"]["chunk"] == 1
        assert stats["by_type"]["memory"] == 1
        assert stats["sqlite_vec_available"] is False

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_save_default(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        assert vi.save() == db_path

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_save_to_path(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        backup = str(tmp_path / "backup" / "copy.db")
        result = vi.save(backup)
        assert result == backup
        assert Path(backup).exists()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_load(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="l1", content="load test", embedding=emb)

        backup = str(tmp_path / "backup.db")
        vi.save(backup)

        db_path2 = str(tmp_path / "test2.db")
        vi2 = VectorIndex(db_path=db_path2)
        vi2.load(backup)
        stats = vi2.get_stats()
        assert stats["total_items"] == 1

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_load_not_found(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        with pytest.raises(FileNotFoundError):
            vi.load(str(tmp_path / "nonexistent.db"))

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_brute_force_search(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb1 = np.random.rand(384).astype(np.float32).tolist()
        emb2 = np.random.rand(384).astype(np.float32).tolist()
        vi.add(id="bf1", content="brute force 1", embedding=emb1)
        vi.add(id="bf2", content="brute force 2", embedding=emb2)

        conn = vi._get_connection()
        query_vec = np.array(emb1, dtype=np.float32)
        results = vi._brute_force_search(conn, query_vec, 5, 0.0)
        conn.close()
        assert len(results) >= 1
        assert results[0].id == "bf1"

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_brute_force_search_with_type_filter(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        emb = np.random.rand(384).astype(np.float32).tolist()
        vi.add(id="t1", content="c1", embedding=emb, type="chunk")
        vi.add(id="t2", content="c2", embedding=emb, type="memory")

        conn = vi._get_connection()
        query_vec = np.array(emb, dtype=np.float32)
        results = vi._brute_force_search(conn, query_vec, 5, 0.0, type_filter="memory")
        conn.close()
        assert all(r.type == "memory" for r in results)

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_add_batch(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)

        mock_embedder = MagicMock()
        emb = np.random.rand(384).astype(np.float32)
        mock_embedder.embed = MagicMock(return_value=[emb, emb])
        vi._embedder = mock_embedder

        items = [
            {"id": "b1", "content": "batch item 1"},
            {"id": "b2", "content": "batch item 2"},
        ]
        count = vi.add_batch(items, batch_size=2)
        assert count == 2

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_embedder_lazy_load_import_error(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        vi = VectorIndex(db_path=db_path)
        with patch("src.search.vector_search.TextEmbedding", None):
            with pytest.raises(ImportError, match="fastembed"):
                _ = vi.embedder


# ============================================================
# _keyword_search and _like_search
# ============================================================

class TestKeywordSearch:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_keyword_search_basic(self, tmp_path):
        db_path = str(tmp_path / "kw.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="kw1", content="hello world test", embedding=emb)
        vi.add(id="kw2", content="another document", embedding=emb)

        results = _keyword_search(vi, "hello", top_k=5)
        assert len(results) >= 1
        assert results[0].id == "kw1"

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_keyword_search_empty_query(self, tmp_path):
        db_path = str(tmp_path / "kw.db")
        vi = VectorIndex(db_path=db_path)
        results = _keyword_search(vi, "", top_k=5)
        assert results == []

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_keyword_search_with_type_filter(self, tmp_path):
        db_path = str(tmp_path / "kw.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="f1", content="memory data", embedding=emb, type="memory")
        vi.add(id="f2", content="memory other", embedding=emb, type="chunk")

        results = _keyword_search(vi, "memory", top_k=5, type_filter="memory")
        assert all(r.type == "memory" for r in results)


class TestLikeSearch:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_like_search_basic(self, tmp_path):
        db_path = str(tmp_path / "like.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="l1", content="unique test content", embedding=emb)

        results = _like_search(vi, "unique", top_k=5)
        assert len(results) >= 1

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_like_search_empty(self, tmp_path):
        db_path = str(tmp_path / "like.db")
        vi = VectorIndex(db_path=db_path)
        results = _like_search(vi, "", top_k=5)
        assert results == []


# ============================================================
# hybrid_search
# ============================================================

class TestHybridSearch:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_hybrid_returns_results(self, tmp_path):
        db_path = str(tmp_path / "hybrid.db")
        vi = VectorIndex(db_path=db_path)
        emb = np.random.rand(384).astype(np.float32).tolist()
        vi.add(id="h1", content="hybrid test content", embedding=emb)

        mock_embedder = MagicMock()
        mock_embedder.embed = MagicMock(return_value=iter([np.array(emb, dtype=np.float32)]))
        vi._embedder = mock_embedder

        results = hybrid_search(vi, "hybrid", top_k=5)
        assert isinstance(results, list)


# ============================================================
# Convenience functions
# ============================================================

class TestConvenienceFunctions:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_create_vector_index(self, tmp_path):
        db_path = str(tmp_path / "conv.db")
        vi = create_vector_index(db_path=db_path)
        assert isinstance(vi, VectorIndex)

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_vector_stats(self, tmp_path):
        db_path = str(tmp_path / "conv.db")
        vi = create_vector_index(db_path=db_path)
        stats = get_vector_stats(vi)
        assert "total_items" in stats

    def test_build_search_result_snapshot(self):
        sr = SearchResult(id="snap1", content="c", score=0.5)
        snapshot = build_search_result_snapshot([sr])
        assert snapshot["query"] == SAMPLE_SEARCH_QUERY
        assert len(snapshot["results"]) == 1


# ============================================================
# VectorSearch class
# ============================================================

class TestVectorSearchClass:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_init(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)
        assert vs.db_path == Path(db_path)

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_get_connection(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)
        conn = vs._get_connection()
        assert conn is not None
        conn.close()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_delete_vector(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)

        conn = vs._get_connection()
        conn.execute(
            "INSERT INTO items (id, content, metadata, type, created_at) VALUES (?, ?, ?, ?, ?)",
            ("dv1", "content", "{}", "chunk", 123.0)
        )
        conn.commit()
        conn.close()

        vs.delete_vector("dv1")
        conn = vs._get_connection()
        cursor = conn.execute("SELECT * FROM items WHERE id = ?", ("dv1",))
        assert cursor.fetchone() is None
        conn.close()

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_delete_vector_nonexistent(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)
        vs.delete_vector("nonexistent")  # should not raise

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_brute_force_search(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)

        emb = np.random.rand(384).astype(np.float32)
        conn = vs._get_connection()
        conn.execute(
            "INSERT INTO items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("bf1", "brute force", '{"path": "/test.md"}', emb.tobytes(), "chunk", 123.0)
        )
        conn.commit()

        results = vs._brute_force_search(conn, emb, None, 5, 0.0)
        conn.close()
        assert len(results) >= 1
        assert results[0]["id"] == "bf1"

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_brute_force_search_with_filter(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)

        emb = np.random.rand(384).astype(np.float32)
        conn = vs._get_connection()
        conn.execute(
            "INSERT INTO items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("ft1", "content", "{}", emb.tobytes(), "memory", 123.0)
        )
        conn.execute(
            "INSERT INTO items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("ft2", "content", "{}", emb.tobytes(), "chunk", 124.0)
        )
        conn.commit()

        results = vs._brute_force_search(conn, emb, "memory", 5, 0.0)
        conn.close()
        assert all(r["type"] == "memory" for r in results)

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_search_memory_vectors_exception(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)
        with patch.object(vs, 'search', side_effect=RuntimeError("fail")):
            result = vs.search_memory_vectors("query")
            assert result == []

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_embedder_import_error(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)
        with patch("src.search.vector_search.TextEmbedding", None):
            with pytest.raises(ImportError):
                _ = vs.embedder

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_brute_force_no_embedding(self, tmp_path):
        db_path = str(tmp_path / "vs.db")
        vs = VectorSearch(db_path=db_path)

        conn = vs._get_connection()
        conn.execute(
            "INSERT INTO items (id, content, metadata, embedding, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("ne1", "no emb", "{}", None, "chunk", 123.0)
        )
        conn.commit()

        emb = np.random.rand(384).astype(np.float32)
        results = vs._brute_force_search(conn, emb, None, 5, 0.0)
        conn.close()
        assert len(results) == 0
