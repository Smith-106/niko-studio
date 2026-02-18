# -*- coding: utf-8 -*-
"""Extra tests for knowledge.services package-level helpers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import src.knowledge.services as services_module
from src.knowledge.services.models import ServiceConfig


@pytest.fixture(autouse=True)
def reset_service_manager_global():
    services_module._service_manager = None
    yield
    services_module._service_manager = None


@pytest.mark.asyncio
async def test_init_services_returns_existing_singleton():
    existing = MagicMock()
    services_module._service_manager = existing

    result = await services_module.init_services()

    assert result is existing


@pytest.mark.asyncio
async def test_init_services_uses_from_env_when_config_none():
    fake_config = ServiceConfig(providers=[])
    fake_manager = MagicMock()
    fake_manager.initialize = AsyncMock()

    with patch("src.knowledge.services.ConfigLoader.from_env", return_value=fake_config) as from_env:
        with patch("src.knowledge.services.ServiceManager", return_value=fake_manager) as manager_cls:
            result = await services_module.init_services(config=None)

    assert result is fake_manager
    from_env.assert_called_once()
    manager_cls.assert_called_once_with(fake_config)
    fake_manager.initialize.assert_awaited_once()


@pytest.mark.asyncio
async def test_init_services_uses_from_yaml_when_config_is_path():
    fake_config = ServiceConfig(providers=[])
    fake_manager = MagicMock()
    fake_manager.initialize = AsyncMock()

    with patch("src.knowledge.services.ConfigLoader.from_yaml", return_value=fake_config) as from_yaml:
        with patch("src.knowledge.services.ServiceManager", return_value=fake_manager):
            result = await services_module.init_services(config="/tmp/services.yaml")

    assert result is fake_manager
    from_yaml.assert_called_once_with("/tmp/services.yaml")


def test_get_services_raises_when_uninitialized():
    with pytest.raises(RuntimeError, match="Services not initialized"):
        services_module.get_services()


def test_get_llm_and_get_embedding_delegate_to_manager():
    manager = MagicMock()
    manager.llm = object()
    manager.embedding = object()
    services_module._service_manager = manager

    assert services_module.get_llm() is manager.llm
    assert services_module.get_embedding() is manager.embedding




@pytest.mark.asyncio
async def test_init_services_uses_given_service_config_object():
    cfg = ServiceConfig(providers=[])
    fake_manager = MagicMock()
    fake_manager.initialize = AsyncMock()

    with patch("src.knowledge.services.ServiceManager", return_value=fake_manager) as manager_cls:
        result = await services_module.init_services(config=cfg)



@pytest.mark.asyncio
async def test_shutdown_services_clears_global_manager():
    manager = MagicMock()
    manager.shutdown = AsyncMock()
    services_module._service_manager = manager

    await services_module.shutdown_services()

    manager.shutdown.assert_awaited_once()
    assert services_module._service_manager is None
