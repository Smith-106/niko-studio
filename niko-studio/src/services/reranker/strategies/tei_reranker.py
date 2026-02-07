"""
TEI Reranker 实现

使用 Hugging Face Text Embeddings Inference (TEI) 进行文档重排。
https://github.com/huggingface/text-embeddings-inference
"""

import time
from typing import Any

import httpx

from ..models import RankedDocument, RerankerConfig, RerankerError, RerankerType
from ..base import RerankerStrategy


class TEIReranker(RerankerStrategy):
    """TEI (Text Embeddings Inference) Reranker 实现

    使用 Hugging Face 的 TEI 服务进行文档重排序。
    支持本地部署，可使用各种开源重排模型。
    """

    DEFAULT_BASE_URL = "http://localhost:8080"
    DEFAULT_MODEL = "BAAI/bge-reranker-v2-m3"

    def __init__(self, config: RerankerConfig):
        super().__init__(config)
        self._base_url = config.base_url or self.DEFAULT_BASE_URL
        self._model = config.model or self.DEFAULT_MODEL
        self._client: httpx.AsyncClient | None = None

    @property
    def reranker_type(self) -> RerankerType:
        return RerankerType.TEI

    async def _get_client(self) -> httpx.AsyncClient:
        """获取 HTTP 客户端"""
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            # TEI 本地部署可能不需要 API key
            if self._config.api_key:
                headers["Authorization"] = f"Bearer {self._config.api_key}"

            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._config.timeout,
                headers=headers,
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
        """使用 TEI Reranker 进行重排

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

        client = await self._get_client()

        # TEI rerank 接口格式
        payload = {
            "query": query,
            "texts": documents,
            "truncate": True,
        }

        start_time = time.time()
        try:
            response = await client.post("/rerank", json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RerankerError(
                f"TEI API request failed: {e.response.text}",
                reranker_type=self.reranker_type,
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise RerankerError(
                f"TEI API request error: {str(e)}",
                reranker_type=self.reranker_type,
            )

        latency_ms = int((time.time() - start_time) * 1000)
        data = response.json()

        # TEI 返回格式: [{"index": 0, "score": 0.95}, ...]
        # 已按分数降序排列
        scores = []
        indices = []

        for item in data:
            indices.append(item["index"])
            # TEI 分数可能超过 1.0，需要归一化
            raw_score = item.get("score", 0.0)
            # 使用 sigmoid 归一化到 0-1
            normalized_score = 1 / (1 + pow(2.718281828, -raw_score))
            scores.append(normalized_score)

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
