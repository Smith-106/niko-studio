"""
Embedding Service, Provider, and Cache Protocols

Defines protocols for Embedding services, providers, and caching.
Supports structural subtyping with runtime checking.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


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
        request: "EmbeddingRequest",
    ) -> "EmbeddingResponse":
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
# Embedding Provider Protocol
# ============================================================

@runtime_checkable
class EmbeddingProvider(Protocol):
    """Embedding Provider 适配器接口

    定义底层 Embedding 提供商的适配器接口，用于对接不同的 Embedding API。
    """

    @property
    def provider_type(self) -> "ProviderType":
        """提供商类型"""
        ...

    async def embed(
        self,
        texts: list[str],
        model: str,
        *,
        dimensions: int | None = None,
    ) -> "EmbeddingResponse":
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
