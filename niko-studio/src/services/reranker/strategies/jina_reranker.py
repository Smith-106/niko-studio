"""
Jina Reranker 实现

使用 Jina AI Reranker API 进行文档重排。
https://jina.ai/reranker/
"""

import time
from typing import Any

import httpx

from ..models import RankedDocument, RerankerConfig, RerankerError, RerankerType
from ..base import RerankerStrategy


class JinaReranker(RerankerStrategy):
    """Jina Reranker 实现

    使用 Jina AI 的 Reranker API 对文档进行重排序。
    支持多语言，针对中文有较好的效果。
    """

    DEFAULT_BASE_URL = "https://api.jina.ai/v1"
    DEFAULT_MODEL = "jina-reranker-v2-base-multilingual"

    def __init__(self, config: RerankerConfig):
        super().__init__(config)
        self._base_url = config.base_url or self.DEFAULT_BASE_URL
        self._model = config.model or self.DEFAULT_MODEL
        self._client: httpx.AsyncClient | None = None

    @property
    def reranker_type(self) -> RerankerType:
        return RerankerType.JINA

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP 客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._config.timeout,
                headers={
                    "Authorization": f"Bearer {self._config.api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 10,
        *,
        document_ids: list[str] | None = None,
        metadata_list: list[dict[str, Any]] | None = None,
    ) -> list[RankedDocument]:
        """使用 Jina Reranker 进行重排

        Args:
            query: 查询文本
            documents: 待重排的文档列表
            top_k: 返回前 k 个结果
            document_ids: 文档 ID 列表
            metadata_list: 文档元数据列表

        Returns:
            重排后的文档列表
        """
        if not documents:
            return []

        if not self._config.api_key:
            raise RerankerError(
                "Jina API key is required",
                reranker_type=self.reranker_type,
            )

        client = await self._get_client()

        # 构建请求
        payload = {
            "model": self._model,
            "query": query,
            "documents": documents,
            "top_n": min(top_k, len(documents)),
            "return_documents": False,  # 我们已有文档内容
        }

        start_time = time.time()
        try:
            response = await client.post("/rerank", json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RerankerError(
                f"Jina API request failed: {e.response.text}",
                reranker_type=self.reranker_type,
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise RerankerError(
                f"Jina API request error: {str(e)}",
                reranker_type=self.reranker_type,
            )

        latency_ms = int((time.time() - start_time) * 1000)
        data = response.json()

        # 解析结果
        results_data = data.get("results", [])
        scores = []
        indices = []

        for item in results_data:
            indices.append(item["index"])
            # Jina 返回 relevance_score，范围通常是 0-1
            scores.append(min(1.0, max(0.0, item.get("relevance_score", 0.0))))

        return self._build_ranked_documents(
            documents=documents,
            scores=scores,
            indices=indices,
            top_k=top_k,
            document_ids=document_ids,
            metadata_list=metadata_list,
        )

    async def close(self) -> None:
        """关闭 HTTP 客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
