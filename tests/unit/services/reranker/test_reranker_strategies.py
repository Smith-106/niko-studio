# -*- coding: utf-8 -*-
"""
Reranker Strategies Tests

Tests for BailianReranker, JinaReranker, TEIReranker, VoyageReranker:
init, reranker_type, _get_client, rerank (empty/no key/success/errors), close.
"""

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.reranker.models import (
    RerankerConfig,
    RerankerType,
    RerankerError,
    RankedDocument,
)
from src.services.reranker.strategies.bailian_reranker import BailianReranker
from src.services.reranker.strategies.jina_reranker import JinaReranker
from src.services.reranker.strategies.tei_reranker import TEIReranker
from src.services.reranker.strategies.voyage_reranker import VoyageReranker


# ============================================================
# Helper
# ============================================================

def _make_config(**kwargs) -> RerankerConfig:
    defaults = {
        "reranker_type": RerankerType.JINA,
        "api_key": "test-key",
        "timeout": 10.0,
    }
    defaults.update(kwargs)
    return RerankerConfig(**defaults)


def _mock_response(json_data, status_code=200):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.text = "error"
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


# ============================================================
# BailianReranker
# ============================================================

class TestBailianReranker:

    def test_init(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        assert r.reranker_type == RerankerType.BAILIAN
        assert r._base_url == BailianReranker.DEFAULT_BASE_URL
        assert r._model == BailianReranker.DEFAULT_MODEL

    def test_custom_base_url(self):
        cfg = _make_config(
            reranker_type=RerankerType.BAILIAN,
            base_url="http://custom:8080",
            model="custom-model",
        )
        r = BailianReranker(cfg)
        assert r._base_url == "http://custom:8080"
        assert r._model == "custom-model"

    @pytest.mark.asyncio
    async def test_rerank_empty(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        result = await r.rerank("query", [])
        assert result == []

    @pytest.mark.asyncio
    async def test_rerank_no_key(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN, api_key=None)
        r = BailianReranker(cfg)
        with pytest.raises(RerankerError, match="API key"):
            await r.rerank("query", ["doc1"])

    @pytest.mark.asyncio
    async def test_rerank_success(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        resp_data = {
            "output": {
                "results": [
                    {"index": 0, "relevance_score": 0.9},
                    {"index": 1, "relevance_score": 0.5},
                ]
            }
        }
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank("query", ["doc a", "doc b"], top_k=2)
        assert len(results) == 2
        assert isinstance(results[0], RankedDocument)
        assert results[0].score == 0.9

    @pytest.mark.asyncio
    async def test_rerank_api_error_code(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        resp_data = {"code": "400", "message": "bad request"}
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        with pytest.raises(RerankerError, match="bad request"):
            await r.rerank("query", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_http_error(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response({}, status_code=500))
        r._client = mock_client

        with pytest.raises(RerankerError, match="request failed"):
            await r.rerank("query", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_request_error(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(side_effect=httpx.RequestError("timeout"))
        r._client = mock_client

        with pytest.raises(RerankerError, match="request error"):
            await r.rerank("query", ["doc"])

    @pytest.mark.asyncio
    async def test_get_client_creates(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        r._client = None
        client = await r._get_client()
        assert client is not None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_close(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        mock_client = MagicMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        r._client = mock_client
        await r.close()
        mock_client.aclose.assert_called_once()
        assert r._client is None

    @pytest.mark.asyncio
    async def test_close_already_closed(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        r._client = None
        await r.close()  # should not raise

    @pytest.mark.asyncio
    async def test_rerank_with_ids_and_metadata(self):
        cfg = _make_config(reranker_type=RerankerType.BAILIAN)
        r = BailianReranker(cfg)
        resp_data = {
            "output": {"results": [{"index": 0, "relevance_score": 0.8}]}
        }
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank(
            "query", ["doc"],
            document_ids=["id1"],
            metadata_list=[{"key": "val"}],
        )
        assert results[0].id == "id1"
        assert results[0].metadata == {"key": "val"}


# ============================================================
# JinaReranker
# ============================================================

class TestJinaReranker:

    def test_init(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        assert r.reranker_type == RerankerType.JINA
        assert r._base_url == JinaReranker.DEFAULT_BASE_URL

    @pytest.mark.asyncio
    async def test_rerank_empty(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        assert await r.rerank("q", []) == []

    @pytest.mark.asyncio
    async def test_rerank_no_key(self):
        cfg = _make_config(reranker_type=RerankerType.JINA, api_key=None)
        r = JinaReranker(cfg)
        with pytest.raises(RerankerError, match="API key"):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_success(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        resp_data = {
            "results": [
                {"index": 1, "relevance_score": 0.95},
                {"index": 0, "relevance_score": 0.3},
            ]
        }
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank("q", ["a", "b"], top_k=2)
        assert len(results) == 2
        assert results[0].score == 0.95

    @pytest.mark.asyncio
    async def test_rerank_http_error(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response({}, status_code=401))
        r._client = mock_client

        with pytest.raises(RerankerError):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_request_error(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(side_effect=httpx.RequestError("conn"))
        r._client = mock_client

        with pytest.raises(RerankerError, match="request error"):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_get_client_creates(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        r._client = None
        client = await r._get_client()
        assert client is not None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_close(self):
        cfg = _make_config(reranker_type=RerankerType.JINA)
        r = JinaReranker(cfg)
        mock_client = MagicMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        r._client = mock_client
        await r.close()
        mock_client.aclose.assert_called_once()


# ============================================================
# TEIReranker
# ============================================================

class TestTEIReranker:

    def test_init(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        assert r.reranker_type == RerankerType.TEI
        assert r._base_url == TEIReranker.DEFAULT_BASE_URL

    @pytest.mark.asyncio
    async def test_rerank_empty(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        assert await r.rerank("q", []) == []

    @pytest.mark.asyncio
    async def test_rerank_success(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        # TEI returns raw list, not nested
        resp_data = [
            {"index": 0, "score": 2.5},
            {"index": 1, "score": -0.5},
        ]
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank("q", ["a", "b"], top_k=2)
        assert len(results) == 2
        # sigmoid(2.5) ≈ 0.924
        assert results[0].score > 0.9

    @pytest.mark.asyncio
    async def test_rerank_no_api_key_still_works(self):
        """TEI can work without API key (local deployment)."""
        cfg = _make_config(reranker_type=RerankerType.TEI, api_key=None)
        r = TEIReranker(cfg)
        resp_data = [{"index": 0, "score": 1.0}]
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank("q", ["doc"])
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_rerank_http_error(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response({}, status_code=503))
        r._client = mock_client

        with pytest.raises(RerankerError):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_request_error(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(side_effect=httpx.RequestError("fail"))
        r._client = mock_client

        with pytest.raises(RerankerError):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_get_client_with_api_key(self):
        cfg = _make_config(reranker_type=RerankerType.TEI, api_key="key123")
        r = TEIReranker(cfg)
        r._client = None
        client = await r._get_client()
        assert client is not None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_get_client_without_api_key(self):
        cfg = _make_config(reranker_type=RerankerType.TEI, api_key=None)
        r = TEIReranker(cfg)
        r._client = None
        client = await r._get_client()
        assert client is not None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_close(self):
        cfg = _make_config(reranker_type=RerankerType.TEI)
        r = TEIReranker(cfg)
        mock_client = MagicMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        r._client = mock_client
        await r.close()
        mock_client.aclose.assert_called_once()


# ============================================================
# VoyageReranker
# ============================================================

class TestVoyageReranker:

    def test_init(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        assert r.reranker_type == RerankerType.VOYAGE
        assert r._base_url == VoyageReranker.DEFAULT_BASE_URL

    @pytest.mark.asyncio
    async def test_rerank_empty(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        assert await r.rerank("q", []) == []

    @pytest.mark.asyncio
    async def test_rerank_no_key(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE, api_key=None)
        r = VoyageReranker(cfg)
        with pytest.raises(RerankerError, match="API key"):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_success(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        resp_data = {
            "data": [
                {"index": 0, "relevance_score": 0.88},
                {"index": 1, "relevance_score": 0.45},
            ]
        }
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank("q", ["a", "b"], top_k=2)
        assert len(results) == 2
        assert results[0].score == 0.88

    @pytest.mark.asyncio
    async def test_rerank_http_error(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response({}, status_code=429))
        r._client = mock_client

        with pytest.raises(RerankerError):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_rerank_request_error(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(side_effect=httpx.RequestError("timeout"))
        r._client = mock_client

        with pytest.raises(RerankerError):
            await r.rerank("q", ["doc"])

    @pytest.mark.asyncio
    async def test_get_client_creates(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        r._client = None
        client = await r._get_client()
        assert client is not None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_close(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        mock_client = MagicMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        r._client = mock_client
        await r.close()
        mock_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_rerank_with_ids_and_metadata(self):
        cfg = _make_config(reranker_type=RerankerType.VOYAGE)
        r = VoyageReranker(cfg)
        resp_data = {
            "data": [{"index": 0, "relevance_score": 0.7}]
        }
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.post = AsyncMock(return_value=_mock_response(resp_data))
        r._client = mock_client

        results = await r.rerank(
            "q", ["doc"],
            document_ids=["myid"],
            metadata_list=[{"src": "test"}],
        )
        assert results[0].id == "myid"
        assert results[0].metadata == {"src": "test"}
