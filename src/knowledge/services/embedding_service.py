"""
Embedding 服务实现

统一封装多 Provider，支持缓存、批量处理和相似度计算。
"""

import asyncio
import math

from .models import (
    EmbeddingRequest,
    EmbeddingResponse,
    ModelTier,
    ProviderType,
    TokenUsage,
    EmbeddingError,
)
from .protocols import EmbeddingProvider, EmbeddingCache


class EmbeddingServiceImpl:
    """Embedding 服务实现

    提供统一的 Embedding 调用接口，支持:
    - 多 Provider 管理
    - Embedding 缓存
    - 批量处理
    - 相似度计算
    """

    def __init__(
        self,
        providers: dict[ProviderType, EmbeddingProvider],
        default_provider: ProviderType = ProviderType.OPENAI,
        cache: EmbeddingCache | None = None,
        default_model: str | None = None,
    ):
        """初始化 Embedding 服务

        Args:
            providers: Provider 实例映射
            default_provider: 默认 Provider 类型
            cache: 可选的缓存实现
            default_model: 默认模型名称
        """
        self._providers = providers
        self._default_provider = default_provider
        self._cache = cache
        self._default_model = default_model

    def _get_provider(self, provider_type: ProviderType | None = None) -> EmbeddingProvider:
        """获取 Provider 实例"""
        ptype = provider_type or self._default_provider
        if ptype not in self._providers:
            available = list(self._providers.keys())
            if not available:
                raise EmbeddingError("No providers available")
            ptype = available[0]
        return self._providers[ptype]

    def _get_default_model(self, provider: EmbeddingProvider) -> str:
        """获取默认模型"""
        if self._default_model:
            return self._default_model
        # 根据 Provider 类型返回默认模型
        if provider.provider_type == ProviderType.OPENAI:
            return "text-embedding-3-small"
        if provider.provider_type == ProviderType.LOCAL:
            return "BAAI/bge-small-zh-v1.5"
        return "text-embedding-3-small"

    async def embed(
        self,
        text: str,
        *,
        model: str | None = None,
        provider: ProviderType | None = None,
    ) -> list[float]:
        """生成单个文本的向量表示

        Args:
            text: 待编码的文本
            model: 模型名称
            provider: 指定 Provider

        Returns:
            向量表示
        """
        embeddings = await self.embed_batch([text], model=model, provider=provider)
        return embeddings[0]

    async def embed_batch(
        self,
        texts: list[str],
        *,
        model: str | None = None,
        batch_size: int = 100,
        provider: ProviderType | None = None,
    ) -> list[list[float]]:
        """批量生成文本的向量表示

        Args:
            texts: 待编码的文本列表
            model: 模型名称
            batch_size: 每批次处理的文本数量
            provider: 指定 Provider

        Returns:
            向量表示列表
        """
        if not texts:
            return []

        emb_provider = self._get_provider(provider)
        model_name = model or self._get_default_model(emb_provider)

        # 检查缓存
        cache_results: dict[str, list[float] | None] = {}
        texts_to_embed: list[str] = []
        text_indices: dict[str, int] = {}

        if self._cache:
            cache_results = await self._cache.get_batch(texts, model_name)
            for i, text in enumerate(texts):
                text_indices[text] = i
                if cache_results.get(text) is None:
                    texts_to_embed.append(text)
        else:
            texts_to_embed = texts
            for i, text in enumerate(texts):
                text_indices[text] = i

        # 分批处理未缓存的文本
        new_embeddings: dict[str, list[float]] = {}
        for i in range(0, len(texts_to_embed), batch_size):
            batch = texts_to_embed[i:i + batch_size]
            response = await emb_provider.embed(batch, model_name)
            for text, embedding in zip(batch, response.embeddings):
                new_embeddings[text] = embedding

        # 更新缓存
        if self._cache and new_embeddings:
            await self._cache.set_batch(new_embeddings, model_name)

        # 合并结果，保持原始顺序
        results: list[list[float]] = [[] for _ in texts]
        for text in texts:
            idx = text_indices[text]
            if text in new_embeddings:
                results[idx] = new_embeddings[text]
            elif cache_results.get(text):
                results[idx] = cache_results[text]

        return results

    async def embed_with_metadata(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """生成向量表示，包含完整元数据"""
        emb_provider = self._get_provider()
        model_name = request.model_override or self._get_default_model(emb_provider)

        # 检查缓存
        cache_hits = 0
        texts_to_embed = request.texts
        cached_embeddings: dict[str, list[float]] = {}

        if self._cache:
            cache_results = await self._cache.get_batch(request.texts, model_name)
            texts_to_embed = []
            for text in request.texts:
                if cache_results.get(text):
                    cached_embeddings[text] = cache_results[text]
                    cache_hits += 1
                else:
                    texts_to_embed.append(text)

        # 调用 Provider
        if texts_to_embed:
            response = await emb_provider.embed(
                texts_to_embed,
                model_name,
                dimensions=request.dimensions,
            )

            # 更新缓存
            if self._cache:
                new_items = dict(zip(texts_to_embed, response.embeddings))
                await self._cache.set_batch(new_items, model_name)
                cached_embeddings.update(new_items)

            # 合并结果
            embeddings = [cached_embeddings.get(t, []) for t in request.texts]

            return EmbeddingResponse(
                embeddings=embeddings,
                model_used=model_name,
                provider=emb_provider.provider_type,
                dimensions=response.dimensions,
                usage=response.usage,
                latency_ms=response.latency_ms,
                cache_hits=cache_hits,
            )
        else:
            # 全部命中缓存
            embeddings = [cached_embeddings[t] for t in request.texts]
            dimensions = len(embeddings[0]) if embeddings else 0

            return EmbeddingResponse(
                embeddings=embeddings,
                model_used=model_name,
                provider=emb_provider.provider_type,
                dimensions=dimensions,
                usage=TokenUsage(),
                latency_ms=0,
                cache_hits=cache_hits,
            )

    def similarity(
        self,
        embedding1: list[float],
        embedding2: list[float],
    ) -> float:
        """计算两个向量的余弦相似度

        Args:
            embedding1: 第一个向量
            embedding2: 第二个向量

        Returns:
            余弦相似度 (-1 到 1)
        """
        if len(embedding1) != len(embedding2):
            raise ValueError("Embeddings must have the same dimensions")

        dot_product = sum(a * b for a, b in zip(embedding1, embedding2))
        norm1 = math.sqrt(sum(a * a for a in embedding1))
        norm2 = math.sqrt(sum(b * b for b in embedding2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def get_dimensions(self, model: str | None = None) -> int:
        """获取模型的向量维度"""
        provider = self._get_provider()
        model_name = model or self._get_default_model(provider)
        return provider.get_dimensions(model_name)
