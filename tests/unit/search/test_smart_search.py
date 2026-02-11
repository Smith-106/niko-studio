# -*- coding: utf-8 -*-
"""
SmartSearch Tests

Tests for SearchMode, SmartSearchResult, SmartSearch (mode selection,
fuzzy/semantic/hybrid search, RRF merge, async).
"""

import pytest
import sqlite3
import json
import numpy as np
from unittest.mock import MagicMock, patch, PropertyMock
from pathlib import Path

from src.search.smart_search import (
    SearchMode,
    SmartSearchResult,
    SmartSearch,
    create_smart_search,
    create_smart_search_from_vector_search,
    SAMPLE_SEARCH_QUERY,
)
from src.search.vector_search import (
    SearchResult,
    VectorIndex,
    VectorSearch,
    HNSWConfig,
    _build_search_metadata,
)


# ============================================================
# SearchMode
# ============================================================

class TestSearchMode:

    def test_values(self):
        assert SearchMode.FUZZY.value == "fuzzy"
        assert SearchMode.SEMANTIC.value == "semantic"
        assert SearchMode.HYBRID.value == "hybrid"
        assert SearchMode.AUTO.value == "auto"

    def test_from_string(self):
        assert SearchMode("fuzzy") == SearchMode.FUZZY
        assert SearchMode("auto") == SearchMode.AUTO


# ============================================================
# SmartSearchResult
# ============================================================

class TestSmartSearchResult:

    def test_defaults(self):
        r = SmartSearchResult(id="1", content="text", score=0.5)
        assert r.type == "chunk"
        assert r.source == "smart"
        assert r.mode_used == "auto"

    def test_to_dict(self):
        r = SmartSearchResult(id="1", content="hello", score=0.12345)
        d = r.to_dict()
        assert d["id"] == "1"
        assert d["score"] == 0.1235
        assert "metadata" in d

    def test_getitem(self):
        r = SmartSearchResult(id="g1", content="c", score=0.5)
        assert r["id"] == "g1"
        assert r["content"] == "c"


# ============================================================
# SmartSearch._select_mode
# ============================================================

class TestSelectMode:

    def _make_ss(self):
        return SmartSearch(db_path=None)

    def test_quoted_phrase(self):
        ss = self._make_ss()
        assert ss._select_mode('"exact phrase"') == SearchMode.HYBRID

    def test_single_keyword(self):
        ss = self._make_ss()
        assert ss._select_mode("error") == SearchMode.FUZZY

    def test_two_keywords_no_stop(self):
        ss = self._make_ss()
        assert ss._select_mode("login bug") == SearchMode.FUZZY

    def test_stopword_question(self):
        ss = self._make_ss()
        assert ss._select_mode("what error") == SearchMode.SEMANTIC

    def test_question_prefix(self):
        ss = self._make_ss()
        assert ss._select_mode("how does auth work") == SearchMode.SEMANTIC

    def test_long_query(self):
        ss = self._make_ss()
        assert ss._select_mode("a b c d e f") == SearchMode.SEMANTIC

    def test_medium_query(self):
        ss = self._make_ss()
        assert ss._select_mode("fix login timeout issue") == SearchMode.HYBRID


# ============================================================
# SmartSearch._check_ripgrep
# ============================================================

class TestCheckRipgrep:

    @patch("subprocess.run")
    def test_available(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0)
        ss = SmartSearch.__new__(SmartSearch)
        assert ss._check_ripgrep() is True

    @patch("subprocess.run", side_effect=FileNotFoundError)
    def test_not_found(self, mock_run):
        ss = SmartSearch.__new__(SmartSearch)
        assert ss._check_ripgrep() is False


# ============================================================
# SmartSearch._get_connection
# ============================================================

class TestGetConnection:

    def test_from_vector_search(self):
        mock_vs = MagicMock()
        mock_vs._get_connection.return_value = MagicMock(spec=sqlite3.Connection)
        ss = SmartSearch(vector_search=mock_vs)
        conn = ss._get_connection()
        mock_vs._get_connection.assert_called_once()

    def test_from_vector_index(self):
        mock_vi = MagicMock()
        mock_vi._get_connection.return_value = MagicMock(spec=sqlite3.Connection)
        ss = SmartSearch(vector_index=mock_vi)
        conn = ss._get_connection()
        mock_vi._get_connection.assert_called_once()

    def test_from_db_path(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        conn = sqlite3.connect(db_path)
        conn.close()
        ss = SmartSearch(db_path=db_path)
        conn = ss._get_connection()
        assert conn is not None
        conn.close()

    def test_no_source_raises(self):
        ss = SmartSearch()
        with pytest.raises(ValueError, match="No database"):
            ss._get_connection()


# ============================================================
# SmartSearch._rrf_merge
# ============================================================

class TestRrfMerge:

    def _make_ss(self):
        return SmartSearch(rrf_k=60, semantic_weight=0.6, fuzzy_weight=0.4)

    def test_merge_deduplication(self):
        ss = self._make_ss()
        sem = [SmartSearchResult(id="1", content="a", score=0.9, source="semantic")]
        fuz = [SmartSearchResult(id="1", content="a", score=0.8, source="fuzzy")]
        merged = ss._rrf_merge(sem, fuz)
        assert len(merged) == 1
        assert merged[0].source == "hybrid"

    def test_merge_ordering(self):
        ss = self._make_ss()
        sem = [
            SmartSearchResult(id="s1", content="a", score=0.9),
            SmartSearchResult(id="s2", content="b", score=0.7),
        ]
        fuz = [
            SmartSearchResult(id="f1", content="c", score=0.8),
        ]
        merged = ss._rrf_merge(sem, fuz)
        scores = [r.score for r in merged]
        assert scores == sorted(scores, reverse=True)

    def test_merge_empty(self):
        ss = self._make_ss()
        merged = ss._rrf_merge([], [])
        assert merged == []


# ============================================================
# SmartSearch.search mode routing
# ============================================================

class TestSmartSearchModeRouting:

    def test_fuzzy_mode(self):
        ss = SmartSearch()
        with patch.object(ss, 'fuzzy_search', return_value=[]) as mock:
            ss.search("test", mode=SearchMode.FUZZY)
            mock.assert_called_once()

    def test_semantic_mode_fallback_to_fuzzy(self):
        ss = SmartSearch()
        with patch.object(ss, 'semantic_search', return_value=[]) as sem_mock, \
             patch.object(ss, 'fuzzy_search', return_value=[]) as fuz_mock:
            ss.search("test", mode=SearchMode.SEMANTIC)
            sem_mock.assert_called_once()
            fuz_mock.assert_called_once()

    def test_semantic_mode_no_fallback_when_results(self):
        ss = SmartSearch()
        result = SmartSearchResult(id="1", content="c", score=0.5)
        with patch.object(ss, 'semantic_search', return_value=[result]) as sem_mock, \
             patch.object(ss, 'fuzzy_search') as fuz_mock:
            ss.search("test", mode=SearchMode.SEMANTIC)
            sem_mock.assert_called_once()
            fuz_mock.assert_not_called()

    def test_hybrid_mode(self):
        ss = SmartSearch()
        with patch.object(ss, 'hybrid_search', return_value=[]) as mock:
            ss.search("test", mode=SearchMode.HYBRID)
            mock.assert_called_once()

    def test_auto_mode(self):
        ss = SmartSearch()
        with patch.object(ss, '_select_mode', return_value=SearchMode.FUZZY) as sel, \
             patch.object(ss, 'fuzzy_search', return_value=[]):
            ss.search("test", mode=SearchMode.AUTO)
            sel.assert_called_once()

    def test_string_mode(self):
        ss = SmartSearch()
        with patch.object(ss, 'fuzzy_search', return_value=[]):
            ss.search("test", mode="fuzzy")

    def test_min_score_filter(self):
        ss = SmartSearch()
        r1 = SmartSearchResult(id="1", content="a", score=0.1)
        r2 = SmartSearchResult(id="2", content="b", score=0.9)
        with patch.object(ss, 'fuzzy_search', return_value=[r1, r2]):
            results = ss.search("test", mode=SearchMode.FUZZY, min_score=0.5)
            assert len(results) == 1
            assert results[0].id == "2"


# ============================================================
# SmartSearch.fuzzy_search
# ============================================================

class TestFuzzySearch:

    def test_deduplication(self):
        ss = SmartSearch()
        r1 = SmartSearchResult(id="d1", content="a", score=0.5)
        r2 = SmartSearchResult(id="d1", content="a", score=0.9)
        with patch.object(ss, '_fts5_search', return_value=[r1]):
            ss._ripgrep_available = True
            ss.ripgrep_paths = ["/tmp"]
            with patch.object(ss, '_ripgrep_search', return_value=[r2]):
                results = ss.fuzzy_search("test")
                assert len(results) == 1
                assert results[0].score == 0.9


# ============================================================
# SmartSearch.hybrid_search error handling
# ============================================================

class TestHybridSearchErrors:

    def test_fuzzy_error(self):
        ss = SmartSearch()
        with patch.object(ss, 'fuzzy_search', side_effect=RuntimeError("fail")), \
             patch.object(ss, 'semantic_search', return_value=[]):
            results = ss.hybrid_search("test")
            assert results == []

    def test_semantic_error(self):
        ss = SmartSearch()
        with patch.object(ss, 'fuzzy_search', return_value=[]), \
             patch.object(ss, 'semantic_search', side_effect=RuntimeError("fail")):
            results = ss.hybrid_search("test")
            assert results == []


# ============================================================
# SmartSearch.semantic_search
# ============================================================

class TestSemanticSearch:

    def test_vector_index_path(self):
        mock_vi = MagicMock()
        sr = SearchResult(id="vs1", content="c", score=0.8, type="chunk",
                          metadata={"path": None, "doc_id": None, "surface": None, "loc": None, "chunk_index": None, "extra": {}},
                          loc=None)
        mock_vi.search.return_value = [sr]
        ss = SmartSearch(vector_index=mock_vi)
        results = ss.semantic_search("query")
        assert len(results) == 1
        assert results[0].id == "vs1"

    def test_vector_search_path(self):
        mock_vs = MagicMock()
        mock_vs.search.return_value = [
            {"id": "vs2", "content": "c", "score": 0.7, "type": "chunk", "metadata": {}}
        ]
        ss = SmartSearch(vector_search=mock_vs)
        ss._vector_index = None
        ss._db_path = None
        results = ss.semantic_search("query")
        assert len(results) == 1

    def test_vector_index_error(self):
        mock_vi = MagicMock()
        mock_vi.search.side_effect = RuntimeError("fail")
        ss = SmartSearch(vector_index=mock_vi)
        results = ss.semantic_search("query")
        assert results == []


# ============================================================
# SmartSearch._build_snapshot
# ============================================================

class TestBuildSnapshot:

    def test_snapshot(self):
        ss = SmartSearch()
        r = SmartSearchResult(id="1", content="c", score=0.5)
        snap = ss._build_snapshot([r])
        assert snap["query"] == SAMPLE_SEARCH_QUERY
        assert len(snap["results"]) == 1


# ============================================================
# SmartSearch._like_search
# ============================================================

class TestLikeSearchSmart:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_like_search_via_vector_items(self, tmp_path):
        db_path = str(tmp_path / "like.db")
        vi = VectorIndex(db_path=db_path)
        emb = [0.1] * 384
        vi.add(id="ls1", content="unique text here", embedding=emb)

        ss = SmartSearch(vector_index=vi)
        conn = ss._get_connection()
        cursor = conn.cursor()
        results = ss._like_search(cursor, "unique", top_k=5)
        conn.close()
        assert len(results) >= 1

    def test_like_search_empty_query(self):
        ss = SmartSearch()
        mock_cursor = MagicMock()
        results = ss._like_search(mock_cursor, "", top_k=5)
        assert results == []


# ============================================================
# Factory functions
# ============================================================

class TestFactoryFunctions:

    @patch("src.search.vector_search.sqlite_vec", None)
    def test_create_smart_search(self, tmp_path):
        db_path = str(tmp_path / "factory.db")
        ss = create_smart_search(db_path=db_path)
        assert isinstance(ss, SmartSearch)
        assert ss.vector_index is not None

    def test_create_from_vector_search(self):
        mock_vs = MagicMock(spec=VectorSearch)
        ss = create_smart_search_from_vector_search(mock_vs)
        assert isinstance(ss, SmartSearch)
        assert ss.vector_search is mock_vs


# ============================================================
# SmartSearch._ripgrep_search
# ============================================================

class TestRipgrepSearch:

    def test_not_available(self):
        ss = SmartSearch()
        ss._ripgrep_available = False
        assert ss._ripgrep_search("test") == []

    def test_no_paths(self):
        ss = SmartSearch()
        ss._ripgrep_available = True
        ss.ripgrep_paths = []
        assert ss._ripgrep_search("test") == []

    @patch("src.search.smart_search.LOC_KIND_LINE", "line", create=True)
    @patch("subprocess.run")
    def test_parse_json_output(self, mock_run, tmp_path):
        search_dir = tmp_path / "src"
        search_dir.mkdir()

        match_data = {
            "type": "match",
            "data": {
                "path": {"text": str(search_dir / "test.py")},
                "lines": {"text": "found line"},
                "line_number": 42,
            }
        }
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(match_data)
        )

        ss = SmartSearch()
        ss._ripgrep_available = True
        ss.ripgrep_paths = [str(search_dir)]
        results = ss._ripgrep_search("found")
        assert len(results) == 1
        assert results[0].source == "ripgrep"
        assert "42" in results[0].id

    def test_error_handling(self, tmp_path):
        search_dir = tmp_path / "src"
        search_dir.mkdir()
        ss = SmartSearch()
        ss._ripgrep_available = True
        ss.ripgrep_paths = [str(search_dir)]
        with patch("subprocess.run", side_effect=Exception("timeout")):
            results = ss._ripgrep_search("test")
            assert results == []
