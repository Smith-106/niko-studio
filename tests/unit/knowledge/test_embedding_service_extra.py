# -*- coding: utf-8 -*-
"""Extra branch tests for EmbeddingServiceImpl metadata and provider defaults."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.knowledge.services.embedding_service import EmbeddingServiceImpl
from src.knowledge.services.models import (
    EmbeddingRequest,
    EmbeddingResponse,
    ProviderType,
    TokenUsage,
)


def _build_provider(provider_type: ProviderType, embeddings=None):
    provider = MagicMock()
    provider.provider_type = provider_type
    provider.embed = AsyncMock(
        return_value=EmbeddingResponse(
            embeddings=embeddings or [[0.11, 0.22]],
            model_used="model-x",
            provider=provider_type,
            dimensions=len((embeddings or [[0.11, 0.22]])[0]),
            usage=TokenUsage(prompt_tokens=3),
            latency_ms=12,
        )
    )
    provider.get_dimensions = MagicMock(return_value=2)
    return provider


@pytest.mark.asyncio
async def test_get_provider_falls_back_to_first_available():
    local_provider = _build_provider(ProviderType.LOCAL)
    service = EmbeddingServiceImpl(
        providers={ProviderType.LOCAL: local_provider},
        default_provider=ProviderType.OPENAI,
    )

    result = await service.embed("hello")

    assert result == [0.11, 0.22]


@pytest.mark.asyncio
async def test_get_default_model_for_local_provider_without_override():
    local_provider = _build_provider(ProviderType.LOCAL)
    service = EmbeddingServiceImpl(
        providers={ProviderType.LOCAL: local_provider},
        default_provider=ProviderType.LOCAL,
    )

    await service.embed("hello")

    call_args = local_provider.embed.call_args
    assert call_args.args[1] == "BAAI/bge-small-zh-v1.5"


@pytest.mark.asyncio
async def test_get_default_model_prefers_service_override():
    provider = _build_provider(ProviderType.OPENAI)
    service = EmbeddingServiceImpl(
        providers={ProviderType.OPENAI: provider},
        default_provider=ProviderType.OPENAI,
        default_model="custom-embedding-model",
    )

    await service.embed("hello")

    call_args = provider.embed.call_args
    assert call_args.args[1] == "custom-embedding-model"


@pytest.mark.asyncio
async def test_embed_with_metadata_all_cache_hits_path():
    provider = _build_provider(ProviderType.OPENAI)
    cache = MagicMock()
    cache.get_batch = AsyncMock(return_value={"a": [0.1, 0.2], "b": [0.3, 0.4]})
    cache.set_batch = AsyncMock()

    service = EmbeddingServiceImpl(
        providers={ProviderType.OPENAI: provider},
        default_provider=ProviderType.OPENAI,
        cache=cache,
    )

    request = EmbeddingRequest(texts=["a", "b"])
    response = await service.embed_with_metadata(request)

    assert response.embeddings == [[0.1, 0.2], [0.3, 0.4]]
    assert response.cache_hits == 2
    assert response.latency_ms == 0
    provider.embed.assert_not_called()




@pytest.mark.asyncio
async def test_default_model_fallback_branch_for_non_openai_local_provider():
    provider = _build_provider(ProviderType.ANTHROPIC)
    service = EmbeddingServiceImpl(
        providers={ProviderType.ANTHROPIC: provider},
        default_provider=ProviderType.ANTHROPIC,
    )

    await service.embed("hello")

    call_args = provider.embed.call_args
    assert call_args.args[1] == "text-embedding-3-small"




@pytest.mark.asyncio
async def test_embed_with_metadata_partial_cache_miss_path():
    provider = _build_provider(ProviderType.OPENAI, embeddings=[[0.9, 0.8]])
    cache = MagicMock()
    cache.get_batch = AsyncMock(return_value={"a": [0.1, 0.2], "b": None})
    cache.set_batch = AsyncMock()

    service = EmbeddingServiceImpl(
        providers={ProviderType.OPENAI: provider},
        default_provider=ProviderType.OPENAI,
        cache=cache,
    )

    request = EmbeddingRequest(texts=["a", "b"], dimensions=2)
    response = await service.embed_with_metadata(request)

    assert response.embeddings == [[0.1, 0.2], [0.9, 0.8]]
    assert response.cache_hits == 1
    provider.embed.assert_awaited_once()
    cache.set_batch.assert_awaited_once()
