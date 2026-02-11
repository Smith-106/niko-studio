"""
RerankerStrategy Base Tests

Tests for RerankerStrategy abstract base class and _build_ranked_documents helper.
"""

import pytest
from src.services.reranker.models import RankedDocument, RerankerConfig, RerankerType
from src.services.reranker.base import RerankerStrategy


# ============================================================
# Concrete stub for testing the ABC
# ============================================================

class _StubReranker(RerankerStrategy):

    @property
    def reranker_type(self) -> RerankerType:
        return RerankerType.JINA

    async def rerank(self, query, documents, top_k=10, *, document_ids=None, metadata_list=None):
        # Simple stub: returns documents in original order with decreasing scores
        scores = [1.0 - i * 0.1 for i in range(len(documents))]
        indices = list(range(len(documents)))
        return self._build_ranked_documents(
            documents, scores, indices, top_k,
            document_ids=document_ids, metadata_list=metadata_list,
        )


# ============================================================
# RerankerStrategy Tests
# ============================================================

class TestRerankerStrategy:

    @pytest.fixture
    def config(self):
        return RerankerConfig(reranker_type=RerankerType.JINA, api_key="test-key")

    @pytest.fixture
    def reranker(self, config):
        return _StubReranker(config)

    def test_config_property(self, reranker, config):
        assert reranker.config is config

    def test_config_type(self, reranker):
        assert reranker.config.reranker_type == RerankerType.JINA

    def test_reranker_type_abstract(self, reranker):
        assert reranker.reranker_type == RerankerType.JINA


# ============================================================
# _build_ranked_documents Tests
# ============================================================

class TestBuildRankedDocuments:

    @pytest.fixture
    def reranker(self):
        config = RerankerConfig()
        return _StubReranker(config)

    def test_basic(self, reranker):
        docs = ["doc A", "doc B", "doc C"]
        scores = [0.9, 0.7, 0.5]
        indices = [0, 1, 2]
        results = reranker._build_ranked_documents(docs, scores, indices, top_k=3)
        assert len(results) == 3
        assert results[0].content == "doc A"
        assert results[0].score == 0.9
        assert results[1].content == "doc B"

    def test_top_k_limits(self, reranker):
        docs = ["a", "b", "c", "d"]
        scores = [0.9, 0.8, 0.7, 0.6]
        indices = [0, 1, 2, 3]
        results = reranker._build_ranked_documents(docs, scores, indices, top_k=2)
        assert len(results) == 2

    def test_reordered_indices(self, reranker):
        docs = ["first", "second", "third"]
        scores = [0.5, 0.9, 0.7]
        indices = [2, 0, 1]  # third, first, second
        results = reranker._build_ranked_documents(docs, scores, indices, top_k=3)
        assert results[0].content == "third"
        assert results[0].original_index == 2
        assert results[1].content == "first"
        assert results[1].original_index == 0

    def test_auto_doc_ids(self, reranker):
        docs = ["x"]
        results = reranker._build_ranked_documents(docs, [0.5], [0], top_k=1)
        assert results[0].id == "doc_0"

    def test_custom_doc_ids(self, reranker):
        docs = ["x", "y"]
        results = reranker._build_ranked_documents(
            docs, [0.9, 0.8], [1, 0], top_k=2,
            document_ids=["id_a", "id_b"],
        )
        # indices = [1, 0], so first result gets document_ids[1] = "id_b"
        assert results[0].id == "id_b"
        assert results[1].id == "id_a"

    def test_metadata_mapping(self, reranker):
        docs = ["a", "b"]
        metadata = [{"src": "ch1"}, {"src": "ch2"}]
        results = reranker._build_ranked_documents(
            docs, [0.9, 0.8], [1, 0], top_k=2,
            metadata_list=metadata,
        )
        assert results[0].metadata == {"src": "ch2"}
        assert results[1].metadata == {"src": "ch1"}

    def test_no_metadata(self, reranker):
        docs = ["a"]
        results = reranker._build_ranked_documents(docs, [0.5], [0], top_k=1)
        assert results[0].metadata == {}

    def test_empty_input(self, reranker):
        results = reranker._build_ranked_documents([], [], [], top_k=5)
        assert results == []

    def test_top_k_larger_than_input(self, reranker):
        docs = ["only"]
        results = reranker._build_ranked_documents(docs, [0.5], [0], top_k=100)
        assert len(results) == 1

    def test_result_types(self, reranker):
        docs = ["text"]
        results = reranker._build_ranked_documents(docs, [0.5], [0], top_k=1)
        assert isinstance(results[0], RankedDocument)


# ============================================================
# health_check Tests
# ============================================================

class TestHealthCheck:

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        config = RerankerConfig()
        reranker = _StubReranker(config)
        result = await reranker.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """health_check returns False when rerank raises."""
        config = RerankerConfig()

        class _FailReranker(RerankerStrategy):
            @property
            def reranker_type(self):
                return RerankerType.JINA

            async def rerank(self, query, documents, top_k=10, **kwargs):
                raise RuntimeError("unavailable")

        reranker = _FailReranker(config)
        result = await reranker.health_check()
        assert result is False
