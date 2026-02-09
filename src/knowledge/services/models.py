"""
LLM/Embedding 服务层数据结构定义

定义服务层所需的所有请求/响应模型、配置和错误类型。
使用 Pydantic BaseModel 支持验证和序列化。
"""

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


# ============================================================
# Enums
# ============================================================

class ModelTier(str, Enum):
    """模型层级 - 根据任务复杂度选择"""
    FAST = "fast"          # 低延迟，简单任务 (如 haiku, gpt-4o-mini)
    DEFAULT = "default"    # 平衡性能 (如 sonnet, gpt-4o)
    POWERFUL = "powerful"  # 最强能力 (如 opus, o1)


class ProviderType(str, Enum):
    """服务提供商类型"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    LOCAL = "local"


# ============================================================
# Token Usage
# ============================================================

class TokenUsage(BaseModel):
    """Token 使用统计"""
    prompt_tokens: int = Field(default=0, description="输入 token 数量")
    completion_tokens: int = Field(default=0, description="输出 token 数量")
    total_tokens: int = Field(default=0, description="总 token 数量")
    estimated_cost: float = Field(default=0.0, description="估算费用 (USD)")


# ============================================================
# LLM Request/Response
# ============================================================

class LLMRequest(BaseModel):
    """LLM 请求模型"""
    prompt: str = Field(..., description="用户提示词")
    model_tier: ModelTier = Field(
        default=ModelTier.DEFAULT,
        description="模型层级选择"
    )
    model_override: str | None = Field(
        default=None,
        description="直接指定模型名称，覆盖 tier 选择"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="生成温度"
    )
    max_tokens: int | None = Field(
        default=None,
        ge=1,
        description="最大生成 token 数"
    )
    stop_sequences: list[str] = Field(
        default_factory=list,
        description="停止序列"
    )
    system_prompt: str | None = Field(
        default=None,
        description="系统提示词"
    )
    response_format: dict[str, Any] | None = Field(
        default=None,
        description="响应格式 (如 JSON schema)"
    )


class LLMResponse(BaseModel):
    """LLM 响应模型"""
    content: str = Field(..., description="生成的内容")
    model_used: str = Field(..., description="实际使用的模型")
    provider: ProviderType = Field(..., description="服务提供商")
    usage: TokenUsage = Field(
        default_factory=TokenUsage,
        description="Token 使用统计"
    )
    latency_ms: int = Field(default=0, ge=0, description="响应延迟 (毫秒)")
    cached: bool = Field(default=False, description="是否来自缓存")


class StreamChunk(BaseModel):
    """流式响应块"""
    content: str = Field(default="", description="内容片段")
    is_final: bool = Field(default=False, description="是否为最后一块")
    usage: TokenUsage | None = Field(
        default=None,
        description="Token 使用统计 (仅在 is_final=True 时提供)"
    )


# ============================================================
# Embedding Request/Response
# ============================================================

class EmbeddingRequest(BaseModel):
    """Embedding 请求模型"""
    texts: list[str] = Field(..., min_length=1, description="待编码的文本列表")
    model_tier: ModelTier = Field(
        default=ModelTier.DEFAULT,
        description="模型层级选择"
    )
    model_override: str | None = Field(
        default=None,
        description="直接指定模型名称，覆盖 tier 选择"
    )
    dimensions: int | None = Field(
        default=None,
        ge=1,
        description="输出向量维度 (部分模型支持)"
    )


class EmbeddingResponse(BaseModel):
    """Embedding 响应模型"""
    embeddings: list[list[float]] = Field(..., description="向量列表")
    model_used: str = Field(..., description="实际使用的模型")
    provider: ProviderType = Field(..., description="服务提供商")
    dimensions: int = Field(..., ge=1, description="向量维度")
    usage: TokenUsage = Field(
        default_factory=TokenUsage,
        description="Token 使用统计"
    )
    latency_ms: int = Field(default=0, ge=0, description="响应延迟 (毫秒)")
    cache_hits: int = Field(default=0, ge=0, description="缓存命中数量")


# ============================================================
# Provider Configuration
# ============================================================

class ProviderConfig(BaseModel):
    """Provider 配置"""
    provider: ProviderType = Field(..., description="提供商类型")
    api_key: str | None = Field(default=None, description="API 密钥")
    base_url: str | None = Field(default=None, description="API 基础 URL")
    organization: str | None = Field(default=None, description="组织 ID")
    model_mapping: dict[ModelTier, str] = Field(
        default_factory=lambda: {
            ModelTier.FAST: "",
            ModelTier.DEFAULT: "",
            ModelTier.POWERFUL: "",
        },
        description="层级到模型名称的映射"
    )
    embedding_model: str = Field(
        default="",
        description="Embedding 模型名称"
    )
    max_retries: int = Field(default=3, ge=0, description="最大重试次数")
    timeout: float = Field(default=60.0, gt=0, description="请求超时 (秒)")
    rate_limit_rpm: int = Field(
        default=60,
        ge=1,
        description="每分钟请求限制"
    )


# ============================================================
# Service Configuration
# ============================================================

class ServiceConfig(BaseModel):
    """服务层配置"""
    # Provider 配置
    providers: list[ProviderConfig] = Field(
        default_factory=list,
        description="可用的 Provider 列表"
    )
    default_llm_provider: ProviderType = Field(
        default=ProviderType.OPENAI,
        description="默认 LLM 提供商"
    )
    default_embedding_provider: ProviderType = Field(
        default=ProviderType.OPENAI,
        description="默认 Embedding 提供商"
    )

    # Embedding 缓存配置
    embedding_cache_enabled: bool = Field(
        default=True,
        description="是否启用 Embedding 缓存"
    )
    embedding_cache_ttl: int = Field(
        default=86400,
        ge=0,
        description="缓存 TTL (秒)，0 表示永不过期"
    )
    embedding_cache_max_size: int = Field(
        default=10000,
        ge=1,
        description="缓存最大条目数"
    )

    # 重试配置
    retry_max_attempts: int = Field(
        default=3,
        ge=1,
        description="最大重试次数"
    )
    retry_initial_delay: float = Field(
        default=1.0,
        gt=0,
        description="初始重试延迟 (秒)"
    )
    retry_max_delay: float = Field(
        default=60.0,
        gt=0,
        description="最大重试延迟 (秒)"
    )
    retry_exponential_base: float = Field(
        default=2.0,
        gt=1,
        description="指数退避基数"
    )

    # 健康检查
    health_check_interval: int = Field(
        default=60,
        ge=10,
        description="健康检查间隔 (秒)"
    )


# ============================================================
# Error Types
# ============================================================

class LLMError(Exception):
    """LLM 服务基础错误"""

    def __init__(self, message: str, provider: ProviderType | None = None):
        self.message = message
        self.provider = provider
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.provider:
            return f"[{self.provider.value}] {self.message}"
        return self.message


class RateLimitError(LLMError):
    """速率限制错误"""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        provider: ProviderType | None = None,
        retry_after: float | None = None
    ):
        super().__init__(message, provider)
        self.retry_after = retry_after


class TokenLimitError(LLMError):
    """Token 限制错误"""

    def __init__(
        self,
        message: str = "Token limit exceeded",
        provider: ProviderType | None = None,
        token_count: int | None = None,
        token_limit: int | None = None
    ):
        super().__init__(message, provider)
        self.token_count = token_count
        self.token_limit = token_limit


class ProviderUnavailableError(LLMError):
    """Provider 不可用错误"""

    def __init__(
        self,
        message: str = "Provider unavailable",
        provider: ProviderType | None = None,
        fallback_available: bool = False
    ):
        super().__init__(message, provider)
        self.fallback_available = fallback_available


class EmbeddingError(Exception):
    """Embedding 服务错误"""

    def __init__(self, message: str, provider: ProviderType | None = None):
        self.message = message
        self.provider = provider
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.provider:
            return f"[{self.provider.value}] {self.message}"
        return self.message
