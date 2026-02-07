"""
LLM/Embedding 服务层

提供统一的 LLM 和 Embedding 服务接口，支持多 Provider 和缓存。

使用示例:
    from knowledge.services import init_services, get_llm, get_embedding

    # 初始化服务
    await init_services()

    # 使用 LLM 服务
    llm = get_llm()
    response = await llm.generate("Hello, world!")

    # 使用 Embedding 服务
    embedding = get_embedding()
    vector = await embedding.embed("Hello, world!")

    # 关闭服务
    await shutdown_services()
"""

from .models import (
    ModelTier,
    ProviderType,
    LLMRequest,
    LLMResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    TokenUsage,
    StreamChunk,
    ProviderConfig,
    ServiceConfig,
    LLMError,
    RateLimitError,
    TokenLimitError,
    ProviderUnavailableError,
    EmbeddingError,
)
from .protocols import (
    LLMService,
    EmbeddingService,
    LLMProvider,
    EmbeddingProvider,
    EmbeddingCache,
)
from .config import ConfigLoader
from .cache import InMemoryEmbeddingCache
from .llm_service import LLMServiceImpl
from .embedding_service import EmbeddingServiceImpl
from .manager import ServiceManager


# 全局服务管理器实例
_service_manager: ServiceManager | None = None


async def init_services(
    config: ServiceConfig | str | None = None,
) -> ServiceManager:
    """初始化服务

    Args:
        config: 服务配置对象、YAML 文件路径或 None (使用环境变量)

    Returns:
        ServiceManager 实例
    """
    global _service_manager

    if _service_manager is not None:
        return _service_manager

    # 加载配置
    if config is None:
        service_config = ConfigLoader.from_env()
    elif isinstance(config, str):
        service_config = ConfigLoader.from_yaml(config)
    else:
        service_config = config

    _service_manager = ServiceManager(service_config)
    await _service_manager.initialize()

    return _service_manager


def get_services() -> ServiceManager:
    """获取服务管理器

    Returns:
        ServiceManager 实例

    Raises:
        RuntimeError: 服务未初始化
    """
    if _service_manager is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _service_manager


def get_llm() -> LLMServiceImpl:
    """获取 LLM 服务

    Returns:
        LLMServiceImpl 实例
    """
    return get_services().llm


def get_embedding() -> EmbeddingServiceImpl:
    """获取 Embedding 服务

    Returns:
        EmbeddingServiceImpl 实例
    """
    return get_services().embedding


async def shutdown_services() -> None:
    """关闭所有服务"""
    global _service_manager

    if _service_manager:
        await _service_manager.shutdown()
        _service_manager = None


__all__ = [
    # 便捷函数
    "init_services",
    "get_services",
    "get_llm",
    "get_embedding",
    "shutdown_services",
    # 数据模型
    "ModelTier",
    "ProviderType",
    "LLMRequest",
    "LLMResponse",
    "EmbeddingRequest",
    "EmbeddingResponse",
    "TokenUsage",
    "StreamChunk",
    "ProviderConfig",
    "ServiceConfig",
    # 错误类型
    "LLMError",
    "RateLimitError",
    "TokenLimitError",
    "ProviderUnavailableError",
    "EmbeddingError",
    # Protocol
    "LLMService",
    "EmbeddingService",
    "LLMProvider",
    "EmbeddingProvider",
    "EmbeddingCache",
    # 实现类
    "LLMServiceImpl",
    "EmbeddingServiceImpl",
    "InMemoryEmbeddingCache",
    "ServiceManager",
    "ConfigLoader",
]
