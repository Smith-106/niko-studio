# -*- coding: utf-8 -*-
"""SmartSearch extra tests - _select_mode, SmartSearchResult, SearchMode."""

import pytest
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
