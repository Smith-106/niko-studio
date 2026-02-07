"""
Local Embedding Provider 实现

支持本地 Embedding 模型，包括 FastEmbed 和 Sentence-Transformers。
"""

import asyncio
import time

from ..models import (
    EmbeddingResponse,
    ProviderType,
    TokenUsage,
    EmbeddingError,
)


# 模型维度映射
MODEL_DIMENSIONS: dict[str, int] = {
    "BAAI/bge-small-zh-v1.5": 512,
    "BAAI/bge-base-zh-v1.5": 768,
    "BAAI/bge-large-zh-v1.5": 1024,
    "BAAI/bge-small-en-v1.5": 384,
    "BAAI/bge-base-en-v1.5": 768,
    "BAAI/bge-large-en-v1.5": 1024,
    "sentence-transformers/all-MiniLM-L6-v2": 384,
    "sentence-transformers/all-mpnet-base-v2": 768,
}


class LocalEmbeddingProvider:
    """Local Embedding Provider 实现

    支持 FastEmbed 和 Sentence-Transformers 后端。
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-zh-v1.5",
        backend: str = "fastembed",
    ) -> None:
        """初始化 Local Embedding Provider

        Args:
            model_name: 模型名称
            backend: 后端类型 ('fastembed' 或 'sentence-transformers')
        """
        self._model_name = model_name
        self._backend = backend
        self._model = None

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.LOCAL

    def get_dimensions(self, model: str) -> int:
        if model in MODEL_DIMENSIONS:
            return MODEL_DIMENSIONS[model]
        for key, dim in MODEL_DIMENSIONS.items():
            if model in key or key in model:
                return dim
        return 768

    async def _ensure_model(self) -> None:
        """确保模型已加载"""
        if self._model is not None:
            return

        loop = asyncio.get_event_loop()

        if self._backend == "fastembed":
            try:
                from fastembed import TextEmbedding
            except ImportError as e:
                raise EmbeddingError(
                    "fastembed package not installed. Run: pip install fastembed",
                    provider=ProviderType.LOCAL,
                ) from e
            self._model = await loop.run_in_executor(
                None, lambda: TextEmbedding(model_name=self._model_name)
            )
        elif self._backend == "sentence-transformers":
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as e:
                raise EmbeddingError(
                    "sentence-transformers package not installed. Run: pip install sentence-transformers",
                    provider=ProviderType.LOCAL,
                ) from e
            self._model = await loop.run_in_executor(
                None, lambda: SentenceTransformer(self._model_name)
            )
        else:
            raise EmbeddingError(
                f"Unknown backend: {self._backend}",
                provider=ProviderType.LOCAL,
            )

    async def embed(
        self,
        texts: list[str],
        model: str,
        *,
        dimensions: int | None = None,
    ) -> EmbeddingResponse:
        """执行向量编码请求"""
        await self._ensure_model()
        start_time = time.perf_counter()
        loop = asyncio.get_event_loop()

        try:
            if self._backend == "fastembed":
                embeddings_gen = await loop.run_in_executor(
                    None, lambda: list(self._model.embed(texts))
                )
                embeddings = [emb.tolist() for emb in embeddings_gen]
            else:
                embeddings_np = await loop.run_in_executor(
                    None, lambda: self._model.encode(texts)
                )
                embeddings = embeddings_np.tolist()
        except Exception as e:
            raise EmbeddingError(str(e), provider=ProviderType.LOCAL) from e

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        actual_dimensions = len(embeddings[0]) if embeddings else 0

        return EmbeddingResponse(
            embeddings=embeddings,
            model_used=model or self._model_name,
            provider=ProviderType.LOCAL,
            dimensions=actual_dimensions,
            usage=TokenUsage(),
            latency_ms=latency_ms,
        )

    async def health_check(self) -> bool:
        try:
            await self.embed(texts=["test"], model=self._model_name)
            return True
        except Exception:
            return False
