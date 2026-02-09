"""
OpenAI Embedding Provider 实现

使用 OpenAI 官方 SDK，支持 text-embedding-3 系列模型。
"""

import time
from typing import Any

from openai import AsyncOpenAI

from ..models import (
    EmbeddingResponse,
    ProviderType,
    TokenUsage,
    EmbeddingError,
)


# 模型维度映射
MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}

# 模型价格 (USD per 1M tokens)
MODEL_PRICING: dict[str, float] = {
    "text-embedding-3-small": 0.02,
    "text-embedding-3-large": 0.13,
    "text-embedding-ada-002": 0.10,
}


class OpenAIEmbeddingProvider:
    """OpenAI Embedding Provider 实现

    支持 text-embedding-3 系列模型，包括自定义维度。
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        default_model: str = "text-embedding-3-small",
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        """初始化 OpenAI Embedding Provider"""
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._default_model = default_model

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.OPENAI

    def get_dimensions(self, model: str) -> int:
        return MODEL_DIMENSIONS.get(model, 1536)

    async def embed(
        self,
        texts: list[str],
        model: str,
        *,
        dimensions: int | None = None,
    ) -> EmbeddingResponse:
        """执行向量编码请求"""
        kwargs: dict[str, Any] = {
            "model": model or self._default_model,
            "input": texts,
        }

        # text-embedding-3 系列支持自定义维度
        if dimensions and model.startswith("text-embedding-3"):
            kwargs["dimensions"] = dimensions

        start_time = time.perf_counter()
        try:
            response = await self._client.embeddings.create(**kwargs)
        except Exception as e:
            raise EmbeddingError(str(e), provider=ProviderType.OPENAI) from e

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        embeddings = [item.embedding for item in response.data]
        actual_dimensions = len(embeddings[0]) if embeddings else 0

        usage = TokenUsage(
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=0,
            total_tokens=response.usage.total_tokens,
            estimated_cost=self._estimate_cost(model, response.usage.total_tokens),
        )

        return EmbeddingResponse(
            embeddings=embeddings,
            model_used=model,
            provider=ProviderType.OPENAI,
            dimensions=actual_dimensions,
            usage=usage,
            latency_ms=latency_ms,
        )

    async def health_check(self) -> bool:
        try:
            await self.embed(texts=["test"], model=self._default_model)
            return True
        except Exception:
            return False

    def _estimate_cost(self, model: str, token_count: int) -> float:
        price = MODEL_PRICING.get(model, 0)
        return token_count * price / 1_000_000
