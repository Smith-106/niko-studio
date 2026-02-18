# -*- coding: utf-8 -*-
"""SmartSearch extra tests - _select_mode, SmartSearchResult, SearchMode."""

import pytest
import json
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.search.smart_search import (
    SmartSearch, SmartSearchResult, SearchMode, SearchResultSnapshot,
)


class TestSearchMode:
    def test_values(self):
        assert SearchMode.FUZZY.value == "fuzzy"
        assert SearchMode.SEMANTIC.value == "semantic"
        assert SearchMode.HYBRID.value == "hybrid"
        assert SearchMode.AUTO.value == "auto"


class TestSmartSearchResult:
    def test_defaults(self):
        r = SmartSearchResult(id="1", content="text", score=0.9)
        assert r.type == "chunk"
        assert r.source == "smart"
        assert r.mode_used == "auto"

    def test_to_dict(self):
        r = SmartSearchResult(id="1", content="text", score=0.85)
        d = r.to_dict()
        assert d["id"] == "1"
        assert d["score"] == 0.85
        assert "metadata" in d

    def test_getitem(self):
        r = SmartSearchResult(id="1", content="text", score=0.9)
        assert r["id"] == "1"
        assert r["content"] == "text"


class TestSelectMode:
    @pytest.fixture()
    def ss(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            return SmartSearch()

    def test_quoted_hybrid(self, ss):
        assert ss._select_mode('"exact phrase"') == SearchMode.HYBRID

    def test_short_keyword_fuzzy(self, ss):
        assert ss._select_mode("character") == SearchMode.FUZZY

    def test_two_keywords_fuzzy(self, ss):
        assert ss._select_mode("张三 角色") == SearchMode.FUZZY

    def test_question_semantic(self, ss):
        assert ss._select_mode("what is the main character") == SearchMode.SEMANTIC

    def test_how_question_semantic(self, ss):
        assert ss._select_mode("how does the plot develop") == SearchMode.SEMANTIC

    def test_long_query_semantic(self, ss):
        assert ss._select_mode("a b c d e f g h") == SearchMode.SEMANTIC

    def test_medium_hybrid(self, ss):
        assert ss._select_mode("find the character arc") == SearchMode.HYBRID

    def test_short_with_stopword(self, ss):
        # "the" is a stopword, so not pure keyword
        result = ss._select_mode("the character")
        assert result in (SearchMode.HYBRID, SearchMode.FUZZY)


class TestSmartSearchInit:
    def test_defaults(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        assert ss.rrf_k == 60
        assert ss.semantic_weight == 0.6
        assert ss.fuzzy_weight == 0.4
        assert ss.ripgrep_paths == []

    def test_custom_params(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=True):
            ss = SmartSearch(rrf_k=30, semantic_weight=0.7, fuzzy_weight=0.3, ripgrep_paths=["/tmp"])
        assert ss.rrf_k == 30
        assert ss.ripgrep_paths == ["/tmp"]

    def test_check_ripgrep_not_found(self):
        with patch("subprocess.run", side_effect=FileNotFoundError):
            ss = SmartSearch()
        assert ss._ripgrep_available is False

    def test_vector_search_property(self):
        mock_vs = MagicMock()
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch(vector_search=mock_vs)
        assert ss.vector_search is mock_vs

    def test_vector_index_lazy(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch(db_path="/tmp/test.db")
        with patch("src.search.smart_search.VectorIndex") as mock_vi:
            mock_vi.return_value = MagicMock()
            idx = ss.vector_index
            assert idx is not None

    def test_get_connection_no_db(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        with pytest.raises(ValueError, match="No database"):
            ss._get_connection()

    def test_search_invalid_mode_string_raises(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        with pytest.raises(ValueError):
            ss.search("q", mode="invalid-mode")

    def test_search_semantic_mode_falls_back_to_fuzzy_when_empty(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        with patch.object(ss, "semantic_search", return_value=[]), patch.object(
            ss, "fuzzy_search", return_value=[SmartSearchResult(id="1", content="x", score=0.9)]
        ):
            results = ss.search("q", mode=SearchMode.SEMANTIC, top_k=1)
        assert len(results) == 1

    def test_search_else_branch_uses_hybrid(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        class FakeMode:
            value = "fake"

        with patch.object(ss, "hybrid_search", return_value=[]):
            results = ss.search("q", mode=FakeMode(), top_k=1)
        assert results == []

    def test_fts5_search_type_filter_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE vector_items (id TEXT, content TEXT, metadata TEXT, type TEXT)")
        conn.execute("CREATE TABLE vector_items_fts (id TEXT, content TEXT, type TEXT)")
        conn.execute(
            "INSERT INTO vector_items VALUES (?, ?, ?, ?)",
            ("id1", "hello world", json.dumps({}), "chunk"),
        )
        conn.execute("INSERT INTO vector_items_fts VALUES (?, ?, ?)", ("id1", "hello world", "chunk"))
        conn.commit()

        class CursorProxy:
            def __init__(self, cur):
                self._cur = cur

            def execute(self, sql, params=None):
                if "bm25(vector_items_fts)" in sql:
                    sql = sql.replace("bm25(vector_items_fts) as rank", "-1.0 as rank")
                if params is None:
                    return self._cur.execute(sql)
                return self._cur.execute(sql, params)

            def __iter__(self):
                return iter(self._cur)

            def __getattr__(self, name):
                return getattr(self._cur, name)

        class ConnProxy:
            def __init__(self, real_conn):
                self._conn = real_conn

            def cursor(self):
                return CursorProxy(self._conn.cursor())

            def close(self):
                self._conn.close()

        with patch.object(ss, "_get_connection", return_value=ConnProxy(conn)):
            results = ss._fts5_search("hello", top_k=5, type_filter="chunk")

        assert len(results) == 1
        assert results[0].id == "id1"

    def test_fts5_search_iter_row_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        class FakeCursor:
            def execute(self, sql, params=None):
                return None

            def __iter__(self):
                return iter([
                    {
                        "id": "id2",
                        "content": "world hello",
                        "metadata": json.dumps({}),
                        "type": "chunk",
                        "rank": -2.0,
                    }
                ])

        class FakeConn:
            def cursor(self):
                return FakeCursor()

            def close(self):
                return None

        with patch.object(ss, "_get_connection", return_value=FakeConn()):
            results = ss._fts5_search("hello", top_k=5)

        assert len(results) == 1
        assert results[0].id == "id2"

    def test_like_search_core_memories_memory_filter_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("CREATE TABLE core_memories (id TEXT, content TEXT, metadata TEXT)")
        cur.execute("INSERT INTO core_memories VALUES (?, ?, ?)", ("m2", "hello memory", json.dumps({})))
        conn.commit()

        results = ss._like_search(cur, "hello", top_k=5, type_filter="memory")
        assert len(results) == 1
        assert results[0].id == "m2"
        conn.close()

    def test_like_search_core_memories_operational_error_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        results = ss._like_search(cur, "hello", top_k=5)
        assert results == []
        conn.close()

    def test_ripgrep_search_blank_line_branch(self, tmp_path):
        p = tmp_path / "dir"
        p.mkdir()
        with patch.object(SmartSearch, '_check_ripgrep', return_value=True):
            ss = SmartSearch(ripgrep_paths=[str(p)])

        fake_proc = MagicMock(returncode=0, stdout="\n")
        with patch("subprocess.run", return_value=fake_proc):
            assert ss._ripgrep_search("abc", top_k=3) == []

    @pytest.mark.asyncio
    async def test_search_async_hybrid_second_exception_log_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        async def fake_gather(*args, **kwargs):
            return [[], RuntimeError("s")]

        with patch("asyncio.gather", side_effect=fake_gather), patch.object(ss, "_rrf_merge", return_value=[]):
            out = await ss.search_async("q", mode=SearchMode.HYBRID, top_k=1)
        assert out == []

    def test_ripgrep_search_missing_path_branch(self, tmp_path):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=True):
            ss = SmartSearch(ripgrep_paths=[str(tmp_path / "missing")])
        assert ss._ripgrep_search("abc", top_k=3) == []

    def test_ripgrep_search_skip_nonzero_returncode_branch(self, tmp_path):
        p = tmp_path / "dir"
        p.mkdir()
        with patch.object(SmartSearch, '_check_ripgrep', return_value=True):
            ss = SmartSearch(ripgrep_paths=[str(p)])

        fake_proc = MagicMock(returncode=2, stdout="")
        with patch("subprocess.run", return_value=fake_proc):
            assert ss._ripgrep_search("abc", top_k=3) == []

    def test_ripgrep_search_json_decode_error_branch(self, tmp_path):
        p = tmp_path / "dir"
        p.mkdir()
        with patch.object(SmartSearch, '_check_ripgrep', return_value=True):
            ss = SmartSearch(ripgrep_paths=[str(p)])

        fake_proc = MagicMock(returncode=0, stdout="not-json\n")
        with patch("subprocess.run", return_value=fake_proc):
            assert ss._ripgrep_search("abc", top_k=3) == []

    @pytest.mark.asyncio
    async def test_search_async_auto_select_mode_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        with patch.object(ss, "_select_mode", return_value=SearchMode.FUZZY), patch.object(
            ss, "search", return_value=[SmartSearchResult(id="1", content="c", score=1.0)]
        ):
            out = await ss.search_async("q", mode=SearchMode.AUTO, top_k=1)
        assert len(out) == 1

    @pytest.mark.asyncio
    async def test_search_async_hybrid_logs_exception_branches(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()

        async def fake_gather(*args, **kwargs):
            return [RuntimeError("f"), RuntimeError("s")]

        with patch("asyncio.gather", side_effect=fake_gather), patch.object(ss, "_rrf_merge", return_value=[]):
            out = await ss.search_async("q", mode=SearchMode.HYBRID, top_k=1)
        assert out == []

    def test_legacy_keyword_search_type_filter_branch(self):
        with patch.object(SmartSearch, '_check_ripgrep', return_value=False):
            ss = SmartSearch()
        with patch.object(ss, "fuzzy_search", return_value=[] ) as mock_f:
            out = ss._keyword_search("q", type_filter="chunk", top_k=2)
        mock_f.assert_called_once_with("q", top_k=2, type_filter="chunk")
        assert out == []
