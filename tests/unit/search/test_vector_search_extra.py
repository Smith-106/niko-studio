# -*- coding: utf-8 -*-
"""VectorSearch extra tests - search_chunk_vectors, async methods, upsert_vector, delete_vector."""

import pytest
import json
import numpy as np
from unittest.mock import MagicMock, patch, PropertyMock

from src.search.vector_search import (
    VectorSearch,
    SearchResult,
    _normalize_search_result_fields,
    _normalize_loc,
    _build_search_metadata,
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
