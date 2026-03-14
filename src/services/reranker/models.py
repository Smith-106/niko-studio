"""
Reranker 数据模型定义

定义重排服务所需的数据结构、配置和错误类型。
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class RerankerType(str, Enum):
    """重排器类型"""
    JINA = "jina"
    VOYAGE = "voyage"
    TEI = "tei"
    BAILIAN = "bailian"


class RankedDocument(BaseModel):
    """重排后的文档结果"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "doc_001",
                "content": "这是一段示例文档内容",
                "score": 0.95,
                "metadata": {"source": "chapter_1"},
                "original_index": 0,
            }
        }
    )
    id: str = Field(..., description="文档唯一标识")
    content: str = Field(..., description="文档内容")
    score: float = Field(..., ge=0.0, le=1.0, description="相关性分数 (0-1)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="文档元数据")
    original_index: int = Field(default=-1, description="原始列表中的索引位置")


class RerankerConfig(BaseModel):
    """重排器配置"""
    reranker_type: RerankerType = Field(
        default=RerankerType.JINA,
        description="重排器类型"
    )
    api_key: str | None = Field(default=None, description="API 密钥")
    base_url: str | None = Field(default=None, description="API 基础 URL")
    model: str | None = Field(default=None, description="模型名称")
    timeout: float = Field(default=30.0, gt=0, description="请求超时 (秒)")
    max_retries: int = Field(default=3, ge=0, description="最大重试次数")
    batch_size: int = Field(default=100, ge=1, description="批量处理大小")


class RerankerRequest(BaseModel):
    """重排请求"""
    query: str = Field(..., min_length=1, description="查询文本")
    documents: list[str] = Field(..., min_length=1, description="待重排的文档列表")
    document_ids: list[str] | None = Field(
        default=None,
        description="文档 ID 列表 (与 documents 一一对应)"
    )
    top_k: int = Field(default=10, ge=1, description="返回前 k 个结果")
    return_documents: bool = Field(default=True, description="是否返回文档内容")
    metadata_list: list[dict[str, Any]] | None = Field(
        default=None,
        description="文档元数据列表 (与 documents 一一对应)"
    )


class RerankerResponse(BaseModel):
    """重排响应"""
    results: list[RankedDocument] = Field(..., description="重排后的文档列表")
    model_used: str = Field(default="", description="使用的模型")
    reranker_type: RerankerType = Field(..., description="重排器类型")
    latency_ms: int = Field(default=0, ge=0, description="响应延迟 (毫秒)")
    total_documents: int = Field(default=0, ge=0, description="输入文档总数")


class RerankerError(Exception):
    """重排服务错误"""

    def __init__(
        self,
        message: str,
        reranker_type: RerankerType | None = None,
        status_code: int | None = None,
    ):
        self.message = message
        self.reranker_type = reranker_type
        self.status_code = status_code
        super().__init__(self.message)

    def __str__(self) -> str:
        prefix = f"[{self.reranker_type.value}]" if self.reranker_type else ""
        code = f" (HTTP {self.status_code})" if self.status_code else ""
        return f"{prefix}{code} {self.message}"
