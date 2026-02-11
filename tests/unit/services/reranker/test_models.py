"""
Reranker Models Tests

Tests for RerankerType enum, RankedDocument, RerankerConfig,
RerankerRequest, RerankerResponse, and RerankerError.
"""

import pytest
from pydantic import ValidationError
from src.services.reranker.models import (
    RerankerType,
    RankedDocument,
    RerankerConfig,
    RerankerRequest,
    RerankerResponse,
    RerankerError,
)


# ============================================================
# RerankerType Enum
# ============================================================

class TestRerankerType:

    def test_values(self):
        assert RerankerType.JINA.value == "jina"
        assert RerankerType.VOYAGE.value == "voyage"
        assert RerankerType.TEI.value == "tei"
        assert RerankerType.BAILIAN.value == "bailian"

    def test_four_types(self):
        assert len(RerankerType) == 4

    def test_is_str_enum(self):
        assert isinstance(RerankerType.JINA, str)
        assert RerankerType.JINA == "jina"

    def test_from_value(self):
        assert RerankerType("jina") == RerankerType.JINA
        assert RerankerType("voyage") == RerankerType.VOYAGE


# ============================================================
# RankedDocument
# ============================================================

class TestRankedDocument:

    def test_required_fields(self):
        doc = RankedDocument(id="doc_0", content="hello", score=0.9)
        assert doc.id == "doc_0"
        assert doc.content == "hello"
        assert doc.score == 0.9

    def test_defaults(self):
        doc = RankedDocument(id="d", content="c", score=0.5)
        assert doc.metadata == {}
        assert doc.original_index == -1

    def test_all_fields(self):
        doc = RankedDocument(
            id="doc_1",
            content="text",
            score=0.8,
            metadata={"source": "ch1"},
            original_index=3,
        )
        assert doc.metadata == {"source": "ch1"}
        assert doc.original_index == 3

    def test_score_bounds_low(self):
        doc = RankedDocument(id="d", content="c", score=0.0)
        assert doc.score == 0.0

    def test_score_bounds_high(self):
        doc = RankedDocument(id="d", content="c", score=1.0)
        assert doc.score == 1.0

    def test_score_below_zero_rejected(self):
        with pytest.raises(ValidationError):
            RankedDocument(id="d", content="c", score=-0.1)

    def test_score_above_one_rejected(self):
        with pytest.raises(ValidationError):
            RankedDocument(id="d", content="c", score=1.1)


# ============================================================
# RerankerConfig
# ============================================================

class TestRerankerConfig:

    def test_defaults(self):
        config = RerankerConfig()
        assert config.reranker_type == RerankerType.JINA
        assert config.api_key is None
        assert config.base_url is None
        assert config.model is None
        assert config.timeout == 30.0
        assert config.max_retries == 3
        assert config.batch_size == 100

    def test_custom_values(self):
        config = RerankerConfig(
            reranker_type=RerankerType.VOYAGE,
            api_key="key123",
            base_url="https://api.example.com",
            model="voyage-rerank-2",
            timeout=60.0,
            max_retries=5,
            batch_size=50,
        )
        assert config.reranker_type == RerankerType.VOYAGE
        assert config.api_key == "key123"
        assert config.base_url == "https://api.example.com"
        assert config.model == "voyage-rerank-2"
        assert config.timeout == 60.0
        assert config.max_retries == 5
        assert config.batch_size == 50

    def test_timeout_must_be_positive(self):
        with pytest.raises(ValidationError):
            RerankerConfig(timeout=0)

    def test_max_retries_non_negative(self):
        config = RerankerConfig(max_retries=0)
        assert config.max_retries == 0

    def test_batch_size_min_one(self):
        with pytest.raises(ValidationError):
            RerankerConfig(batch_size=0)


# ============================================================
# RerankerRequest
# ============================================================

class TestRerankerRequest:

    def test_required_fields(self):
        req = RerankerRequest(query="test", documents=["doc1"])
        assert req.query == "test"
        assert req.documents == ["doc1"]

    def test_defaults(self):
        req = RerankerRequest(query="q", documents=["d"])
        assert req.document_ids is None
        assert req.top_k == 10
        assert req.return_documents is True
        assert req.metadata_list is None

    def test_custom_values(self):
        req = RerankerRequest(
            query="search",
            documents=["a", "b"],
            document_ids=["id1", "id2"],
            top_k=5,
            return_documents=False,
            metadata_list=[{"k": "v1"}, {"k": "v2"}],
        )
        assert req.document_ids == ["id1", "id2"]
        assert req.top_k == 5
        assert req.return_documents is False

    def test_empty_query_rejected(self):
        with pytest.raises(ValidationError):
            RerankerRequest(query="", documents=["d"])

    def test_empty_documents_rejected(self):
        with pytest.raises(ValidationError):
            RerankerRequest(query="q", documents=[])

    def test_top_k_min_one(self):
        with pytest.raises(ValidationError):
            RerankerRequest(query="q", documents=["d"], top_k=0)


# ============================================================
# RerankerResponse
# ============================================================

class TestRerankerResponse:

    def test_required_fields(self):
        doc = RankedDocument(id="d", content="c", score=0.5)
        resp = RerankerResponse(results=[doc], reranker_type=RerankerType.JINA)
        assert len(resp.results) == 1
        assert resp.reranker_type == RerankerType.JINA

    def test_defaults(self):
        resp = RerankerResponse(results=[], reranker_type=RerankerType.TEI)
        assert resp.model_used == ""
        assert resp.latency_ms == 0
        assert resp.total_documents == 0

    def test_custom_values(self):
        resp = RerankerResponse(
            results=[],
            reranker_type=RerankerType.BAILIAN,
            model_used="model-v2",
            latency_ms=150,
            total_documents=20,
        )
        assert resp.model_used == "model-v2"
        assert resp.latency_ms == 150
        assert resp.total_documents == 20


# ============================================================
# RerankerError
# ============================================================

class TestRerankerError:

    def test_basic(self):
        err = RerankerError("something went wrong")
        assert err.message == "something went wrong"
        assert err.reranker_type is None
        assert err.status_code is None

    def test_with_type(self):
        err = RerankerError("fail", reranker_type=RerankerType.JINA)
        assert err.reranker_type == RerankerType.JINA
        assert "[jina]" in str(err)

    def test_with_status_code(self):
        err = RerankerError("fail", status_code=429)
        assert err.status_code == 429
        assert "(HTTP 429)" in str(err)

    def test_full_str(self):
        err = RerankerError(
            "rate limited",
            reranker_type=RerankerType.VOYAGE,
            status_code=429,
        )
        s = str(err)
        assert "[voyage]" in s
        assert "(HTTP 429)" in s
        assert "rate limited" in s

    def test_plain_str(self):
        err = RerankerError("plain error")
        s = str(err)
        assert s.strip() == "plain error"

    def test_is_exception(self):
        err = RerankerError("test")
        assert isinstance(err, Exception)
