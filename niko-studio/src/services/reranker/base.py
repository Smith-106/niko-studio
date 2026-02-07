"""
RerankerStrategy 抽象基类

定义重排策略的统一接口。
"""

from abc import ABC, abstractmethod
from typing import Any

from .models import RankedDocument, RerankerConfig, RerankerType


class RerankerStrategy(ABC):
    """重排策略抽象基类

    所有重排器实现都必须继承此类并实现 rerank 方法。
    """

    def __init__(self, config: RerankerConfig):
        """初始化重排策略

        Args:
            config: 重排器配置
        """
        self._config = config

    @property
    @abstractmethod
    def reranker_type(self) -> RerankerType:
        """返回重排器类型"""
        ...

    @property
    def config(self) -> RerankerConfig:
        """返回配置"""
        return self._config

    @abstractmethod
    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 10,
        *,
        document_ids: list[str] | None = None,
        metadata_list: list[dict[str, Any]] | None = None,
    ) -> list[RankedDocument]:
        """对文档进行重排序

        Args:
            query: 查询文本
            documents: 待重排的文档内容列表
            top_k: 返回前 k 个结果
            document_ids: 文档 ID 列表 (与 documents 一一对应)
            metadata_list: 文档元数据列表 (与 documents 一一对应)

        Returns:
            按相关性降序排列的 RankedDocument 列表
        """
        ...

    async def health_check(self) -> bool:
        """检查服务健康状态

        Returns:
            True 表示服务可用
        """
        try:
            # 默认实现: 执行一次简单的重排测试
            results = await self.rerank(
                query="test",
                documents=["test document"],
                top_k=1,
            )
            return len(results) > 0
        except Exception:
            return False

    def _build_ranked_documents(
        self,
        documents: list[str],
        scores: list[float],
        indices: list[int],
        top_k: int,
        document_ids: list[str] | None = None,
        metadata_list: list[dict[str, Any]] | None = None,
    ) -> list[RankedDocument]:
        """构建 RankedDocument 列表

        Args:
            documents: 原始文档列表
            scores: 相关性分数列表
            indices: 排序后的原始索引列表
            top_k: 返回数量
            document_ids: 文档 ID 列表
            metadata_list: 元数据列表

        Returns:
            RankedDocument 列表
        """
        results = []
        for i, (score, idx) in enumerate(zip(scores, indices)):
            if i >= top_k:
                break

            doc_id = document_ids[idx] if document_ids else f"doc_{idx}"
            metadata = metadata_list[idx] if metadata_list else {}

            results.append(
                RankedDocument(
                    id=doc_id,
                    content=documents[idx],
                    score=score,
                    metadata=metadata,
                    original_index=idx,
                )
            )

        return results
