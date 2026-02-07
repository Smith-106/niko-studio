"""
LLM/Embedding 服务层 Protocol 定义

使用 typing.Protocol 定义运行时协议，支持 structural subtyping。
所有 Protocol 使用 @runtime_checkable 装饰器，允许运行时类型检查。
"""

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable

from .models import (
    EmbeddingRequest,
    EmbeddingResponse,
    LLMRequest,
    LLMResponse,
    ModelTier,
    ProviderType,
    StreamChunk,
)


# ============================================================
# LLM Service Protocol
# ============================================================

@runtime_checkable
class LLMService(Protocol):
    """LLM 服务抽象接口

    定义 LLM 服务的核心能力，包括文本生成、JSON 生成、流式输出和批量处理。
    """

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
    ) -> str:
        """生成文本响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表

        Returns:
            生成的文本内容
        """
        ...

    async def generate_with_metadata(
        self,
        request: LLMRequest,
    ) -> LLMResponse:
        """生成文本响应 (包含元数据)

        Args:
            request: LLM 请求对象

        Returns:
            包含内容和元数据的完整响应
        """
        ...

    async def generate_json(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        """生成 JSON 格式响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词

        Returns:
            解析后的 JSON 字典
        """
        ...

    async def stream(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """流式生成文本响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词

        Yields:
            StreamChunk 流式响应块
        """
        ...

    async def batch_generate(
        self,
        prompts: list[str],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        max_concurrency: int = 5,
    ) -> list[str]:
        """批量生成文本响应

        Args:
            prompts: 提示词列表
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            max_concurrency: 最大并发数

        Returns:
            生成的文本内容列表 (与输入顺序对应)
        """
        ...


# ============================================================
# Embedding Service Protocol
# ============================================================

@runtime_checkable
class EmbeddingService(Protocol):
    """Embedding 服务抽象接口

    定义 Embedding 服务的核心能力，包括文本编码、批量编码和相似度计算。
    """

    async def embed(
        self,
        text: str,
        *,
        model: str | None = None,
    ) -> list[float]:
        """生成单个文本的向量表示

        Args:
            text: 待编码的文本
            model: 模型名称，None 使用默认模型

        Returns:
            向量表示 (浮点数列表)
        """
        ...

    async def embed_batch(
        self,
        texts: list[str],
        *,
        model: str | None = None,
        batch_size: int = 100,
    ) -> list[list[float]]:
        """批量生成文本的向量表示

        Args:
            texts: 待编码的文本列表
            model: 模型名称，None 使用默认模型
            batch_size: 每批次处理的文本数量

        Returns:
            向量表示列表 (与输入顺序对应)
        """
        ...

    async def embed_with_metadata(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResponse:
        """生成向量表示 (包含元数据)

        Args:
            request: Embedding 请求对象

        Returns:
            包含向量和元数据的完整响应
        """
        ...

    def similarity(
        self,
        embedding1: list[float],
        embedding2: list[float],
    ) -> float:
        """计算两个向量的相似度

        Args:
            embedding1: 第一个向量
            embedding2: 第二个向量

        Returns:
            相似度分数 (通常为余弦相似度，范围 -1 到 1)
        """
        ...

    def get_dimensions(
        self,
        model: str | None = None,
    ) -> int:
        """获取模型的向量维度

        Args:
            model: 模型名称，None 使用默认模型

        Returns:
            向量维度
        """
        ...


# ============================================================
# LLM Provider Protocol
# ============================================================

@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider 适配器接口

    定义底层 LLM 提供商的适配器接口，用于对接不同的 LLM API。
    """

    @property
    def provider_type(self) -> ProviderType:
        """提供商类型"""
        ...

    async def complete(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResponse:
        """执行补全请求

        Args:
            prompt: 用户提示词
            model: 模型名称
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表
            response_format: 响应格式 (如 JSON schema)

        Returns:
            LLM 响应对象
        """
        ...

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """执行流式补全请求

        Args:
            prompt: 用户提示词
            model: 模型名称
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表

        Yields:
            StreamChunk 流式响应块
        """
        ...

    async def health_check(self) -> bool:
        """检查提供商健康状态

        Returns:
            True 表示健康，False 表示不可用
        """
        ...

    def get_model_for_tier(self, tier: ModelTier) -> str:
        """根据层级获取模型名称

        Args:
            tier: 模型层级

        Returns:
            对应的模型名称
        """
        ...


# ============================================================
# Embedding Provider Protocol
# ============================================================

@runtime_checkable
class EmbeddingProvider(Protocol):
    """Embedding Provider 适配器接口

    定义底层 Embedding 提供商的适配器接口，用于对接不同的 Embedding API。
    """

    @property
    def provider_type(self) -> ProviderType:
        """提供商类型"""
        ...

    async def embed(
        self,
        texts: list[str],
        model: str,
        *,
        dimensions: int | None = None,
    ) -> EmbeddingResponse:
        """执行向量编码请求

        Args:
            texts: 待编码的文本列表
            model: 模型名称
            dimensions: 输出向量维度 (部分模型支持)

        Returns:
            Embedding 响应对象
        """
        ...

    async def health_check(self) -> bool:
        """检查提供商健康状态

        Returns:
            True 表示健康，False 表示不可用
        """
        ...

    def get_dimensions(self, model: str) -> int:
        """获取模型的向量维度

        Args:
            model: 模型名称

        Returns:
            向量维度
        """
        ...


# ============================================================
# Embedding Cache Protocol
# ============================================================

@runtime_checkable
class EmbeddingCache(Protocol):
    """Embedding 缓存接口

    定义 Embedding 缓存的核心能力，支持单条和批量操作。
    """

    async def get(
        self,
        text: str,
        model: str,
    ) -> list[float] | None:
        """获取缓存的向量

        Args:
            text: 文本内容
            model: 模型名称

        Returns:
            缓存的向量，未命中返回 None
        """
        ...

    async def set(
        self,
        text: str,
        model: str,
        embedding: list[float],
        ttl: int | None = None,
    ) -> None:
        """设置缓存

        Args:
            text: 文本内容
            model: 模型名称
            embedding: 向量表示
            ttl: 过期时间 (秒)，None 使用默认值
        """
        ...

    async def get_batch(
        self,
        texts: list[str],
        model: str,
    ) -> dict[str, list[float] | None]:
        """批量获取缓存的向量

        Args:
            texts: 文本内容列表
            model: 模型名称

        Returns:
            文本到向量的映射，未命中的值为 None
        """
        ...

    async def set_batch(
        self,
        items: dict[str, list[float]],
        model: str,
        ttl: int | None = None,
    ) -> None:
        """批量设置缓存

        Args:
            items: 文本到向量的映射
            model: 模型名称
            ttl: 过期时间 (秒)，None 使用默认值
        """
        ...

    async def clear(self) -> None:
        """清空所有缓存"""
        ...

    async def stats(self) -> dict[str, Any]:
        """获取缓存统计信息

        Returns:
            包含缓存统计的字典，如 hits, misses, size 等
        """
        ...
