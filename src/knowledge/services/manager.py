"""
服务管理器

统一管理 LLM 和 Embedding 服务的生命周期，支持健康检查和热重载。
"""

import asyncio
from typing import Any

from .models import (
    ProviderConfig,
    ProviderType,
    ServiceConfig,
)
from .cache import InMemoryEmbeddingCache
from .llm_service import LLMServiceImpl
from .embedding_service import EmbeddingServiceImpl
from .providers import (
    OpenAILLMProvider,
    AnthropicLLMProvider,
    OpenAIEmbeddingProvider,
    LocalEmbeddingProvider,
)


class ServiceManager:
    """服务管理器

    单例模式管理所有 LLM/Embedding 服务实例，支持:
    - 服务初始化和关闭
    - 健康检查
    - 配置热重载
    """

    _instance: "ServiceManager | None" = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, config: ServiceConfig | None = None):
        """初始化服务管理器

        Args:
            config: 服务配置
        """
        if hasattr(self, "_initialized") and self._initialized:
            return

        self._config = config or ServiceConfig()
        self._llm_providers: dict[ProviderType, Any] = {}
        self._embedding_providers: dict[ProviderType, Any] = {}
        self._llm_service: LLMServiceImpl | None = None
        self._embedding_service: EmbeddingServiceImpl | None = None
        self._cache: InMemoryEmbeddingCache | None = None
        self._health_status: dict[str, bool] = {}
        self._health_check_task: asyncio.Task | None = None
        self._initialized = False

    async def initialize(self) -> None:
        """初始化所有服务"""
        if self._initialized:
            return

        # 初始化缓存
        if self._config.embedding_cache_enabled:
            self._cache = InMemoryEmbeddingCache(
                max_size=self._config.embedding_cache_max_size,
                default_ttl=self._config.embedding_cache_ttl,
            )

        # 初始化 Providers
        for provider_config in self._config.providers:
            await self._init_provider(provider_config)

        # 初始化服务
        self._llm_service = LLMServiceImpl(
            providers=self._llm_providers,
            default_provider=self._config.default_llm_provider,
            max_retries=self._config.retry_max_attempts,
            retry_base_delay=self._config.retry_initial_delay,
        )

        self._embedding_service = EmbeddingServiceImpl(
            providers=self._embedding_providers,
            default_provider=self._config.default_embedding_provider,
            cache=self._cache,
        )

        # 启动健康检查
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        self._initialized = True

    async def _init_provider(self, config: ProviderConfig) -> None:
        """初始化单个 Provider"""
        ptype = config.provider

        if ptype == ProviderType.OPENAI:
            self._llm_providers[ptype] = OpenAILLMProvider(
                api_key=config.api_key,
                base_url=config.base_url,
                organization=config.organization,
                model_mapping=config.model_mapping,
                timeout=config.timeout,
                max_retries=config.max_retries,
            )
            self._embedding_providers[ptype] = OpenAIEmbeddingProvider(
                api_key=config.api_key,
                base_url=config.base_url,
                organization=config.organization,
                default_model=config.embedding_model,
                timeout=config.timeout,
                max_retries=config.max_retries,
            )

        elif ptype == ProviderType.ANTHROPIC:
            self._llm_providers[ptype] = AnthropicLLMProvider(
                api_key=config.api_key,
                base_url=config.base_url,
                model_mapping=config.model_mapping,
                timeout=config.timeout,
                max_retries=config.max_retries,
            )

        elif ptype == ProviderType.LOCAL:
            self._embedding_providers[ptype] = LocalEmbeddingProvider(
                model_name=config.embedding_model,
                backend=config.base_url or "fastembed",
            )

    async def shutdown(self) -> None:
        """关闭所有服务"""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        if self._cache:
            await self._cache.clear()

        self._llm_providers.clear()
        self._embedding_providers.clear()
        self._initialized = False
        ServiceManager._instance = None

    @property
    def llm(self) -> LLMServiceImpl:
        """获取 LLM 服务"""
        if not self._llm_service:
            raise RuntimeError("ServiceManager not initialized. Call initialize() first.")
        return self._llm_service

    @property
    def embedding(self) -> EmbeddingServiceImpl:
        """获取 Embedding 服务"""
        if not self._embedding_service:
            raise RuntimeError("ServiceManager not initialized. Call initialize() first.")
        return self._embedding_service

    async def check_health(self) -> dict[str, bool]:
        """检查所有 Provider 健康状态"""
        checks: dict[str, bool] = {}

        for ptype, provider in self._llm_providers.items():
            checks[f"llm_{ptype.value}"] = await provider.health_check()

        for ptype, provider in self._embedding_providers.items():
            checks[f"embedding_{ptype.value}"] = await provider.health_check()

        self._health_status = checks
        return checks

    async def _health_check_loop(self) -> None:
        """健康检查循环"""
        while True:
            try:
                await asyncio.sleep(self._config.health_check_interval)
                await self.check_health()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    def is_healthy(self) -> bool:
        """检查服务是否健康"""
        return any(self._health_status.values())

    def get_health_status(self) -> dict[str, bool]:
        """获取健康状态"""
        return self._health_status.copy()

    async def get_cache_stats(self) -> dict[str, Any] | None:
        """获取缓存统计"""
        if self._cache:
            return await self._cache.stats()
        return None
