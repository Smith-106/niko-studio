"""
ServiceManager 生命周期测试

验证 ServiceManager 的初始化、健康检查和关闭流程。
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.knowledge.services.manager import ServiceManager
from src.knowledge.services.models import ServiceConfig, ProviderConfig, ProviderType


class TestServiceManagerLifecycle:
    """ServiceManager 生命周期测试"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """重置单例状态"""
        ServiceManager._instance = None
        yield
        ServiceManager._instance = None

    @pytest.fixture
    def minimal_config(self):
        """最小配置"""
        return ServiceConfig(
            providers=[],
            health_check_interval=60,
            embedding_cache_enabled=False,
        )

    @pytest.mark.asyncio
    async def test_initialize_sets_initialized_flag(self, minimal_config):
        """测试初始化设置 _initialized 标志"""
        manager = ServiceManager(minimal_config)
        assert manager._initialized is False

        await manager.initialize()
        assert manager._initialized is True

    @pytest.mark.asyncio
    async def test_initialize_is_idempotent(self, minimal_config):
        """测试重复初始化是幂等的"""
        manager = ServiceManager(minimal_config)

        await manager.initialize()
        first_health_task = manager._health_check_task

        await manager.initialize()
        second_health_task = manager._health_check_task

        # 应该是同一个任务，没有重新创建
        assert first_health_task is second_health_task

    @pytest.mark.asyncio
    async def test_singleton_pattern(self, minimal_config):
        """测试单例模式"""
        manager1 = ServiceManager(minimal_config)
        manager2 = ServiceManager(minimal_config)

        assert manager1 is manager2

    @pytest.mark.asyncio
    async def test_access_without_initialize_raises_error(self, minimal_config):
        """测试未初始化时访问服务抛出错误"""
        manager = ServiceManager(minimal_config)

        with pytest.raises(RuntimeError, match="not initialized"):
            _ = manager.llm

        with pytest.raises(RuntimeError, match="not initialized"):
            _ = manager.embedding

    @pytest.mark.asyncio
    async def test_shutdown_clears_state(self, minimal_config):
        """测试关闭清理状态"""
        manager = ServiceManager(minimal_config)
        await manager.initialize()

        assert manager._initialized is True

        await manager.shutdown()

        assert manager._initialized is False
        assert ServiceManager._instance is None

    @pytest.mark.asyncio
    async def test_health_check_task_started(self, minimal_config):
        """测试健康检查任务启动"""
        manager = ServiceManager(minimal_config)
        await manager.initialize()

        assert manager._health_check_task is not None
        assert not manager._health_check_task.done()

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_health_check_task_cancelled_on_shutdown(self, minimal_config):
        """测试关闭时取消健康检查任务"""
        manager = ServiceManager(minimal_config)
        await manager.initialize()

        health_task = manager._health_check_task
        await manager.shutdown()

        assert health_task.cancelled() or health_task.done()


class TestServiceManagerWithCache:
    """ServiceManager 缓存测试"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """重置单例状态"""
        ServiceManager._instance = None
        yield
        ServiceManager._instance = None

    @pytest.mark.asyncio
    async def test_cache_initialized_when_enabled(self):
        """测试启用缓存时初始化缓存"""
        config = ServiceConfig(
            providers=[],
            embedding_cache_enabled=True,
            embedding_cache_max_size=100,
            embedding_cache_ttl=3600,
        )

        manager = ServiceManager(config)
        await manager.initialize()

        assert manager._cache is not None

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_cache_not_initialized_when_disabled(self):
        """测试禁用缓存时不初始化缓存"""
        config = ServiceConfig(
            providers=[],
            embedding_cache_enabled=False,
        )

        manager = ServiceManager(config)
        await manager.initialize()

        assert manager._cache is None

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_get_cache_stats_returns_none_when_disabled(self):
        """测试禁用缓存时获取统计返回 None"""
        config = ServiceConfig(
            providers=[],
            embedding_cache_enabled=False,
        )

        manager = ServiceManager(config)
        await manager.initialize()

        stats = await manager.get_cache_stats()
        assert stats is None

        await manager.shutdown()


class TestServiceManagerHealthStatus:
    """ServiceManager 健康状态测试"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """重置单例状态"""
        ServiceManager._instance = None
        yield
        ServiceManager._instance = None

    @pytest.mark.asyncio
    async def test_is_healthy_returns_false_initially(self):
        """测试初始健康状态为 False"""
        config = ServiceConfig(providers=[])
        manager = ServiceManager(config)
        await manager.initialize()

        # 没有 Provider 时，健康状态为空
        assert manager.is_healthy() is False

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_get_health_status_returns_copy(self):
        """测试获取健康状态返回副本"""
        config = ServiceConfig(providers=[])
        manager = ServiceManager(config)
        await manager.initialize()

        status1 = manager.get_health_status()
        status2 = manager.get_health_status()

        assert status1 is not status2

        await manager.shutdown()
