# -*- coding: utf-8 -*-
"""Extra branch tests for ServiceManager provider setup and health loop."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.knowledge.services.manager import ServiceManager
from src.knowledge.services.models import (
    ModelTier,
    ProviderConfig,
    ProviderType,
    ServiceConfig,
)


@pytest.fixture(autouse=True)
def reset_singleton():
    ServiceManager._instance = None
    yield
    ServiceManager._instance = None


def _provider_config(provider: ProviderType, base_url: str | None = None) -> ProviderConfig:
    return ProviderConfig(
        provider=provider,
        api_key="k",
        base_url=base_url,
        model_mapping={
            ModelTier.FAST: "m-fast",
            ModelTier.DEFAULT: "m-def",
            ModelTier.POWERFUL: "m-pow",
        },
        embedding_model="emb-model",
        timeout=3.0,
        max_retries=1,
    )


@pytest.mark.asyncio
async def test_init_provider_openai_and_anthropic_and_local_branches():
    config = ServiceConfig(providers=[])
    manager = ServiceManager(config)

    with patch("src.knowledge.services.manager.OpenAILLMProvider", return_value=MagicMock()) as openai_llm:
        with patch("src.knowledge.services.manager.OpenAIEmbeddingProvider", return_value=MagicMock()) as openai_emb:
            with patch("src.knowledge.services.manager.AnthropicLLMProvider", return_value=MagicMock()) as anthropic_llm:
                with patch("src.knowledge.services.manager.LocalEmbeddingProvider", return_value=MagicMock()) as local_emb:
                    await manager._init_provider(_provider_config(ProviderType.OPENAI))
                    await manager._init_provider(_provider_config(ProviderType.ANTHROPIC))
                    await manager._init_provider(_provider_config(ProviderType.LOCAL, base_url=None))

    assert ProviderType.OPENAI in manager._llm_providers
    assert ProviderType.OPENAI in manager._embedding_providers
    assert ProviderType.ANTHROPIC in manager._llm_providers
    assert ProviderType.LOCAL in manager._embedding_providers

    openai_llm.assert_called_once()
    openai_emb.assert_called_once()
    anthropic_llm.assert_called_once()
    local_emb.assert_called_once_with(model_name="emb-model", backend="fastembed")


@pytest.mark.asyncio
async def test_initialize_calls_init_provider_for_each_config():
    provider_a = _provider_config(ProviderType.OPENAI)
    provider_b = _provider_config(ProviderType.ANTHROPIC)
    config = ServiceConfig(providers=[provider_a, provider_b], embedding_cache_enabled=False)

    manager = ServiceManager(config)

    def _fake_create_task(coro):
        coro.close()
        return MagicMock()

    with patch.object(manager, "_init_provider", new_callable=AsyncMock) as init_provider:
        with patch("src.knowledge.services.manager.LLMServiceImpl", return_value=MagicMock()):
            with patch("src.knowledge.services.manager.EmbeddingServiceImpl", return_value=MagicMock()):
                with patch("src.knowledge.services.manager.asyncio.create_task", side_effect=_fake_create_task):
                    await manager.initialize()

    assert init_provider.await_count == 2


@pytest.mark.asyncio
async def test_check_health_collects_both_provider_types():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._llm_providers = {ProviderType.OPENAI: MagicMock(health_check=AsyncMock(return_value=True))}
    manager._embedding_providers = {ProviderType.LOCAL: MagicMock(health_check=AsyncMock(return_value=False))}

    checks = await manager.check_health()

    assert checks == {"llm_openai": True, "embedding_local": False}


@pytest.mark.asyncio
async def test_health_check_loop_handles_exception_then_cancelled():
    manager = ServiceManager(ServiceConfig(providers=[], health_check_interval=10))

    with patch("src.knowledge.services.manager.asyncio.sleep", side_effect=[None, asyncio.CancelledError()]):
        with patch.object(manager, "check_health", new_callable=AsyncMock, side_effect=[RuntimeError("boom")]):
            await manager._health_check_loop()


@pytest.mark.asyncio
async def test_get_cache_stats_returns_cache_stats_when_cache_exists():
    manager = ServiceManager(ServiceConfig(providers=[]))
    cache = MagicMock()
    cache.stats = AsyncMock(return_value={"size": 3})
    manager._cache = cache

    stats = await manager.get_cache_stats()

    assert stats == {"size": 3}


def test_init_returns_early_when_already_initialized():
    cfg1 = ServiceConfig(providers=[])
    manager1 = ServiceManager(cfg1)
    manager1._initialized = True

    cfg2 = ServiceConfig(providers=[], health_check_interval=999)
    manager2 = ServiceManager(cfg2)

    assert manager2 is manager1
    assert manager2._config is cfg1


@pytest.mark.asyncio
async def test_initialize_creates_cache_when_enabled():
    manager = ServiceManager(
        ServiceConfig(
            providers=[],
            embedding_cache_enabled=True,
            embedding_cache_max_size=10,
            embedding_cache_ttl=120,
        )
    )

    def _fake_create_task(coro):
        coro.close()
        return MagicMock()

    with patch("src.knowledge.services.manager.asyncio.create_task", side_effect=_fake_create_task):
        await manager.initialize()

    assert manager._cache is not None
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._initialized = True

    with patch.object(manager, "_init_provider", new_callable=AsyncMock) as init_provider:
        await manager.initialize()

    init_provider.assert_not_awaited()


@pytest.mark.asyncio
async def test_shutdown_cancels_task_clears_cache_and_resets_state():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._health_check_task = asyncio.create_task(asyncio.sleep(3600))
    manager._cache = MagicMock()
    manager._cache.clear = AsyncMock()
    manager._llm_providers = {ProviderType.OPENAI: MagicMock()}
    manager._embedding_providers = {ProviderType.LOCAL: MagicMock()}
    manager._initialized = True

    await manager.shutdown()

    manager._cache.clear.assert_awaited_once()
    assert manager._llm_providers == {}
    assert manager._embedding_providers == {}
    assert manager._initialized is False
    assert ServiceManager._instance is None


@pytest.mark.asyncio
async def test_shutdown_without_task_and_cache_still_resets_state():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._health_check_task = None
    manager._cache = None
    manager._llm_providers = {ProviderType.OPENAI: MagicMock()}
    manager._embedding_providers = {ProviderType.LOCAL: MagicMock()}
    manager._initialized = True

    await manager.shutdown()

    assert manager._llm_providers == {}
    assert manager._embedding_providers == {}
    assert manager._initialized is False
    assert ServiceManager._instance is None


def test_llm_and_embedding_properties_raise_when_uninitialized():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._llm_service = None
    manager._embedding_service = None

    with pytest.raises(RuntimeError, match="ServiceManager not initialized"):
        _ = manager.llm

    with pytest.raises(RuntimeError, match="ServiceManager not initialized"):
        _ = manager.embedding


def test_is_healthy_handles_empty_and_true_values():
    manager = ServiceManager(ServiceConfig(providers=[]))

    manager._health_status = {}
    assert manager.is_healthy() is False

    manager._health_status = {"llm_openai": True}
    assert manager.is_healthy() is True


def test_get_health_status_returns_copy_not_reference():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._health_status = {"llm_openai": False}

    status = manager.get_health_status()
    status["llm_openai"] = True

    assert manager._health_status["llm_openai"] is False


@pytest.mark.asyncio
async def test_get_cache_stats_returns_none_when_cache_missing():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._cache = None

    stats = await manager.get_cache_stats()

    assert stats is None


@pytest.mark.asyncio
async def test_llm_and_embedding_properties_return_services():
    manager = ServiceManager(ServiceConfig(providers=[]))
    manager._llm_service = MagicMock()
    manager._embedding_service = MagicMock()

    assert manager.llm is manager._llm_service
    assert manager.embedding is manager._embedding_service
