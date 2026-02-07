# LLM / Embedding 服务层设计

**版本**: 1.0
**日期**: 2026-02-04
**状态**: 设计完成，待实现

---

## 1. 概述

### 1.1 设计目标

构建一个**统一接口、多 Provider 支持**的 LLM/Embedding 服务层：

- **LLM 服务**：支持 OpenAI/Anthropic/Local 等多种 Provider
- **Embedding 服务**：支持批量嵌入、自动缓存、相似度计算
- **统一管理**：模型路由、重试策略、健康检查

### 1.2 架构决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 接口设计 | Protocol 抽象 | Python 原生协议，类型安全 |
| 模型选择 | Tier 语义化 | fast/default/powerful 简化调用 |
| 缓存策略 | Embedding 缓存 | 减少重复调用，降低成本 |
| 重试机制 | 指数退避 | 处理 Rate Limit 和临时故障 |

### 1.3 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         应用层 (各业务模块)                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ 检索策略层   │ │ 质量保障层   │ │ Agent协作层  │ │ 存储适配层   │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
│         │                │                │                │           │
│         └────────────────┴────────────────┴────────────────┘           │
│                                   │                                     │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      LLM / Embedding 服务层                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │      LLMService             │  │     EmbeddingService        │      │
│  │  - generate()               │  │  - embed()                  │      │
│  │  - generate_json()          │  │  - embed_batch()            │      │
│  │  - stream()                 │  │  - similarity()             │      │
│  └──────────┬──────────────────┘  └──────────┬──────────────────┘      │
│             │                                 │                         │
│  ┌──────────┴──────────────────────────────────┴──────────────────┐    │
│  │                    ServiceManager (统一管理)                    │    │
│  │  - 模型路由 (fast/default/powerful)                            │    │
│  │  - 重试策略 (指数退避)                                          │    │
│  │  - 缓存层 (Embedding 缓存)                                      │    │
│  │  - 限流控制 (Rate Limiting)                                     │    │
│  │  - 健康检查                                                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                   │                                     │
│  ┌────────────────────────────────┴───────────────────────────────┐    │
│  │                        Provider Adapters                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │ OpenAI   │  │ Anthropic│  │  Local   │  │  Azure   │       │    │
│  │  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │       │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心数据结构

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol, AsyncIterator, Any, Literal

# ============================================================
# 模型层级定义
# ============================================================

class ModelTier(Enum):
    """模型层级 - 语义化模型选择"""
    FAST = "fast"           # 低延迟，简单任务 (Haiku, GPT-4o-mini)
    DEFAULT = "default"     # 平衡性能，常规任务 (Sonnet, GPT-4o)
    POWERFUL = "powerful"   # 最强能力，复杂任务 (Opus, GPT-4)

class ProviderType(Enum):
    """服务提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    LOCAL = "local"         # Ollama, vLLM 等本地部署

# ============================================================
# LLM 相关数据结构
# ============================================================

@dataclass
class LLMRequest:
    """LLM 请求"""
    prompt: str
    model_tier: ModelTier = ModelTier.DEFAULT
    model_override: str | None = None      # 直接指定模型名
    temperature: float = 0.7
    max_tokens: int = 2000
    stop_sequences: list[str] = field(default_factory=list)
    system_prompt: str | None = None
    response_format: Literal["text", "json"] = "text"

@dataclass
class LLMResponse:
    """LLM 响应"""
    content: str
    model_used: str
    provider: ProviderType
    usage: "TokenUsage"
    latency_ms: float
    cached: bool = False

@dataclass
class TokenUsage:
    """Token 使用统计"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float = 0.0     # 估算费用 (USD)

@dataclass
class StreamChunk:
    """流式响应块"""
    content: str
    is_final: bool = False
    usage: TokenUsage | None = None

# ============================================================
# Embedding 相关数据结构
# ============================================================

@dataclass
class EmbeddingRequest:
    """Embedding 请求"""
    texts: list[str]
    model_tier: ModelTier = ModelTier.DEFAULT
    model_override: str | None = None
    dimensions: int | None = None   # 部分模型支持降维

@dataclass
class EmbeddingResponse:
    """Embedding 响应"""
    embeddings: list[list[float]]
    model_used: str
    provider: ProviderType
    dimensions: int
    usage: TokenUsage
    latency_ms: float
    cache_hits: int = 0             # 命中缓存的数量

# ============================================================
# 配置结构
# ============================================================

@dataclass
class ProviderConfig:
    """单个 Provider 配置"""
    provider: ProviderType
    api_key: str | None = None
    base_url: str | None = None     # 自定义端点
    organization: str | None = None

    # 模型映射
    model_mapping: dict[ModelTier, str] = field(default_factory=dict)
    embedding_model: str = ""

    # 限制
    max_retries: int = 3
    timeout: float = 60.0
    rate_limit_rpm: int = 60        # Requests per minute

@dataclass
class ServiceConfig:
    """服务层完整配置"""
    # Provider 配置
    providers: dict[ProviderType, ProviderConfig] = field(default_factory=dict)

    # 默认 Provider
    default_llm_provider: ProviderType = ProviderType.OPENAI
    default_embedding_provider: ProviderType = ProviderType.OPENAI

    # 缓存配置
    embedding_cache_enabled: bool = True
    embedding_cache_ttl: int = 86400        # 24 小时
    embedding_cache_max_size: int = 100000  # 最大缓存条目

    # 重试配置
    retry_base_delay: float = 1.0
    retry_max_delay: float = 60.0
    retry_exponential_base: float = 2.0

    # 健康检查
    health_check_interval: float = 60.0

# ============================================================
# 错误类型
# ============================================================

class LLMError(Exception):
    """LLM 服务基础错误"""
    pass

class RateLimitError(LLMError):
    """速率限制错误"""
    retry_after: float = 0.0

class TokenLimitError(LLMError):
    """Token 超限错误"""
    pass

class ProviderUnavailableError(LLMError):
    """Provider 不可用"""
    pass

class EmbeddingError(Exception):
    """Embedding 服务错误"""
    pass
```

### 默认模型映射

| Tier | OpenAI | Anthropic | Azure |
|------|--------|-----------|-------|
| FAST | gpt-4o-mini | claude-3-haiku | gpt-4o-mini |
| DEFAULT | gpt-4o | claude-3-5-sonnet | gpt-4o |
| POWERFUL | gpt-4-turbo | claude-3-opus | gpt-4-turbo |

| Embedding | OpenAI | Local |
|-----------|--------|-------|
| DEFAULT | text-embedding-3-small | bge-large-zh-v1.5 |
| POWERFUL | text-embedding-3-large | - |

---

## 3. Protocol 接口定义

```python
from typing import Protocol, AsyncIterator, runtime_checkable

# ============================================================
# LLM Service Protocol
# ============================================================

@runtime_checkable
class LLMService(Protocol):
    """LLM 服务抽象接口"""

    async def generate(
        self,
        prompt: str,
        *,
        model: ModelTier | str = ModelTier.DEFAULT,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None
    ) -> str:
        """生成文本响应（最常用）"""
        ...

    async def generate_with_metadata(
        self,
        request: LLMRequest
    ) -> LLMResponse:
        """生成响应，包含完整元数据"""
        ...

    async def generate_json(
        self,
        prompt: str,
        *,
        model: ModelTier | str = ModelTier.DEFAULT,
        temperature: float = 0.3,      # JSON 生成通常用更低温度
        max_tokens: int = 2000,
        system_prompt: str | None = None
    ) -> dict:
        """生成 JSON 响应并解析"""
        ...

    async def stream(
        self,
        prompt: str,
        *,
        model: ModelTier | str = ModelTier.DEFAULT,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        system_prompt: str | None = None
    ) -> AsyncIterator[StreamChunk]:
        """流式生成"""
        ...

    async def batch_generate(
        self,
        prompts: list[str],
        *,
        model: ModelTier | str = ModelTier.DEFAULT,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        max_concurrency: int = 5
    ) -> list[str]:
        """批量生成（并发控制）"""
        ...

# ============================================================
# Embedding Service Protocol
# ============================================================

@runtime_checkable
class EmbeddingService(Protocol):
    """Embedding 服务抽象接口"""

    async def embed(
        self,
        text: str,
        *,
        model: ModelTier | str = ModelTier.DEFAULT
    ) -> list[float]:
        """单文本嵌入"""
        ...

    async def embed_batch(
        self,
        texts: list[str],
        *,
        model: ModelTier | str = ModelTier.DEFAULT,
        batch_size: int = 100
    ) -> list[list[float]]:
        """批量嵌入（自动分批）"""
        ...

    async def embed_with_metadata(
        self,
        request: EmbeddingRequest
    ) -> EmbeddingResponse:
        """嵌入，包含完整元数据"""
        ...

    def similarity(
        self,
        embedding1: list[float],
        embedding2: list[float]
    ) -> float:
        """计算余弦相似度"""
        ...

    def get_dimensions(self, model: ModelTier | str = ModelTier.DEFAULT) -> int:
        """获取模型输出维度"""
        ...

# ============================================================
# Provider Adapter Protocol
# ============================================================

@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider 适配器接口"""

    provider_type: ProviderType

    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None,
        stop_sequences: list[str] | None,
        response_format: Literal["text", "json"]
    ) -> LLMResponse:
        """执行补全"""
        ...

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None
    ) -> AsyncIterator[StreamChunk]:
        """流式补全"""
        ...

    async def health_check(self) -> bool:
        """健康检查"""
        ...

    def get_model_for_tier(self, tier: ModelTier) -> str:
        """获取 Tier 对应的模型名"""
        ...

@runtime_checkable
class EmbeddingProvider(Protocol):
    """Embedding Provider 适配器接口"""

    provider_type: ProviderType

    async def embed(
        self,
        texts: list[str],
        model: str,
        dimensions: int | None
    ) -> EmbeddingResponse:
        """执行嵌入"""
        ...

    async def health_check(self) -> bool:
        """健康检查"""
        ...

    def get_dimensions(self, model: str) -> int:
        """获取模型输出维度"""
        ...

# ============================================================
# Cache Protocol
# ============================================================

@runtime_checkable
class EmbeddingCache(Protocol):
    """Embedding 缓存接口"""

    async def get(self, text: str, model: str) -> list[float] | None:
        """获取缓存"""
        ...

    async def set(
        self,
        text: str,
        model: str,
        embedding: list[float],
        ttl: int | None = None
    ) -> None:
        """设置缓存"""
        ...

    async def get_batch(
        self,
        texts: list[str],
        model: str
    ) -> dict[str, list[float] | None]:
        """批量获取"""
        ...

    async def set_batch(
        self,
        items: dict[str, list[float]],
        model: str,
        ttl: int | None = None
    ) -> None:
        """批量设置"""
        ...

    async def clear(self) -> None:
        """清空缓存"""
        ...

    async def stats(self) -> dict:
        """缓存统计"""
        ...
```

### 接口设计要点

| 特性 | 说明 |
|------|------|
| **简化 API** | `generate()` 直接返回 `str`，满足 90% 场景 |
| **完整 API** | `generate_with_metadata()` 返回完整响应对象 |
| **JSON 专用** | `generate_json()` 自动解析，降低温度 |
| **流式支持** | `stream()` 返回 `AsyncIterator` |
| **批量处理** | `batch_generate()` / `embed_batch()` 内置并发控制 |
| **缓存抽象** | `EmbeddingCache` Protocol 支持多种缓存后端 |

---

## 4. Provider 适配器实现

### 4.1 基础 Provider 抽象类

```python
from abc import ABC, abstractmethod

class BaseLLMProvider(ABC):
    """LLM Provider 基类"""

    def __init__(self, config: ProviderConfig):
        self.config = config
        self._client = None
        self._last_health_check: float = 0
        self._is_healthy: bool = True

    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        ...

    def get_model_for_tier(self, tier: ModelTier) -> str:
        """获取 Tier 对应的模型名"""
        return self.config.model_mapping.get(tier, self.config.model_mapping[ModelTier.DEFAULT])

    async def health_check(self) -> bool:
        """健康检查 - 简单请求测试"""
        try:
            await self.complete(
                prompt="Hi",
                model=self.get_model_for_tier(ModelTier.FAST),
                temperature=0,
                max_tokens=5,
                system_prompt=None,
                stop_sequences=None,
                response_format="text"
            )
            self._is_healthy = True
            return True
        except Exception:
            self._is_healthy = False
            return False
```

### 4.2 OpenAI Provider

```python
class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM Provider"""

    provider_type = ProviderType.OPENAI

    DEFAULT_MODELS = {
        ModelTier.FAST: "gpt-4o-mini",
        ModelTier.DEFAULT: "gpt-4o",
        ModelTier.POWERFUL: "gpt-4-turbo",
    }

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            organization=config.organization,
            timeout=config.timeout
        )

        for tier, model in self.DEFAULT_MODELS.items():
            if tier not in self.config.model_mapping:
                self.config.model_mapping[tier] = model

    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None,
        stop_sequences: list[str] | None,
        response_format: Literal["text", "json"]
    ) -> LLMResponse:

        start_time = time.perf_counter()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if stop_sequences:
            kwargs["stop"] = stop_sequences

        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        response = await self._client.chat.completions.create(**kwargs)

        latency_ms = (time.perf_counter() - start_time) * 1000

        usage = TokenUsage(
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            estimated_cost=self._estimate_cost(model, response.usage)
        )

        return LLMResponse(
            content=response.choices[0].message.content,
            model_used=model,
            provider=self.provider_type,
            usage=usage,
            latency_ms=latency_ms
        )

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None
    ) -> AsyncIterator[StreamChunk]:

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True}
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield StreamChunk(
                    content=chunk.choices[0].delta.content,
                    is_final=False
                )

            if chunk.usage:
                yield StreamChunk(
                    content="",
                    is_final=True,
                    usage=TokenUsage(
                        prompt_tokens=chunk.usage.prompt_tokens,
                        completion_tokens=chunk.usage.completion_tokens,
                        total_tokens=chunk.usage.total_tokens
                    )
                )

    def _estimate_cost(self, model: str, usage) -> float:
        """估算费用 (USD)"""
        prices = {
            "gpt-4o-mini": (0.15, 0.60),
            "gpt-4o": (2.50, 10.00),
            "gpt-4-turbo": (10.00, 30.00),
        }
        input_price, output_price = prices.get(model, (0, 0))
        return (usage.prompt_tokens * input_price + usage.completion_tokens * output_price) / 1_000_000
```

### 4.3 Anthropic Provider

```python
class AnthropicProvider(BaseLLMProvider):
    """Anthropic LLM Provider"""

    provider_type = ProviderType.ANTHROPIC

    DEFAULT_MODELS = {
        ModelTier.FAST: "claude-3-haiku-20240307",
        ModelTier.DEFAULT: "claude-3-5-sonnet-20241022",
        ModelTier.POWERFUL: "claude-3-opus-20240229",
    }

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=config.timeout
        )

        for tier, model in self.DEFAULT_MODELS.items():
            if tier not in self.config.model_mapping:
                self.config.model_mapping[tier] = model

    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None,
        stop_sequences: list[str] | None,
        response_format: Literal["text", "json"]
    ) -> LLMResponse:

        start_time = time.perf_counter()

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}]
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        if stop_sequences:
            kwargs["stop_sequences"] = stop_sequences

        response = await self._client.messages.create(**kwargs)

        latency_ms = (time.perf_counter() - start_time) * 1000

        usage = TokenUsage(
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
            total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            estimated_cost=self._estimate_cost(model, response.usage)
        )

        content = response.content[0].text if response.content else ""

        return LLMResponse(
            content=content,
            model_used=model,
            provider=self.provider_type,
            usage=usage,
            latency_ms=latency_ms
        )

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: str | None
    ) -> AsyncIterator[StreamChunk]:

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}]
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield StreamChunk(content=text, is_final=False)

            final_message = await stream.get_final_message()
            yield StreamChunk(
                content="",
                is_final=True,
                usage=TokenUsage(
                    prompt_tokens=final_message.usage.input_tokens,
                    completion_tokens=final_message.usage.output_tokens,
                    total_tokens=final_message.usage.input_tokens + final_message.usage.output_tokens
                )
            )
```

### 4.4 Embedding Providers

```python
class OpenAIEmbeddingProvider:
    """OpenAI Embedding Provider"""

    provider_type = ProviderType.OPENAI

    DEFAULT_MODELS = {
        ModelTier.DEFAULT: "text-embedding-3-small",
        ModelTier.POWERFUL: "text-embedding-3-large",
    }

    MODEL_DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(self, config: ProviderConfig):
        self.config = config
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=config.timeout
        )

    async def embed(
        self,
        texts: list[str],
        model: str,
        dimensions: int | None
    ) -> EmbeddingResponse:

        start_time = time.perf_counter()

        kwargs = {"model": model, "input": texts}
        if dimensions and model.startswith("text-embedding-3"):
            kwargs["dimensions"] = dimensions

        response = await self._client.embeddings.create(**kwargs)

        latency_ms = (time.perf_counter() - start_time) * 1000

        embeddings = [item.embedding for item in response.data]
        actual_dimensions = len(embeddings[0]) if embeddings else 0

        return EmbeddingResponse(
            embeddings=embeddings,
            model_used=model,
            provider=self.provider_type,
            dimensions=actual_dimensions,
            usage=TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=0,
                total_tokens=response.usage.total_tokens
            ),
            latency_ms=latency_ms
        )

    def get_dimensions(self, model: str) -> int:
        return self.MODEL_DIMENSIONS.get(model, 1536)


class LocalEmbeddingProvider:
    """本地 Embedding Provider (支持 Ollama 和 Sentence-Transformers)"""

    provider_type = ProviderType.LOCAL

    def __init__(self, config: ProviderConfig):
        self.config = config
        self._model = None
        self._model_name = config.embedding_model or "bge-large-zh-v1.5"
        self._backend = config.base_url or "sentence-transformers"

    async def _ensure_model(self):
        """延迟加载模型"""
        if self._model is not None:
            return

        if self._backend == "sentence-transformers":
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
        elif self._backend == "ollama":
            import httpx
            self._client = httpx.AsyncClient(base_url=self.config.base_url or "http://localhost:11434")

    async def embed(
        self,
        texts: list[str],
        model: str,
        dimensions: int | None
    ) -> EmbeddingResponse:

        await self._ensure_model()
        start_time = time.perf_counter()

        if self._backend == "sentence-transformers":
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None,
                lambda: self._model.encode(texts).tolist()
            )
        else:  # ollama
            embeddings = []
            for text in texts:
                resp = await self._client.post("/api/embeddings", json={
                    "model": model or self._model_name,
                    "prompt": text
                })
                embeddings.append(resp.json()["embedding"])

        latency_ms = (time.perf_counter() - start_time) * 1000

        return EmbeddingResponse(
            embeddings=embeddings,
            model_used=model or self._model_name,
            provider=self.provider_type,
            dimensions=len(embeddings[0]) if embeddings else 0,
            usage=TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            latency_ms=latency_ms
        )

    def get_dimensions(self, model: str) -> int:
        dims = {
            "bge-large-zh-v1.5": 1024,
            "bge-base-zh-v1.5": 768,
            "m3e-base": 768,
            "nomic-embed-text": 768,
        }
        return dims.get(model, 768)
```

---

## 5. ServiceManager 统一管理器

### 5.1 Embedding 缓存

```python
class InMemoryEmbeddingCache:
    """内存 Embedding 缓存"""

    def __init__(self, max_size: int = 100000, default_ttl: int = 86400):
        self._cache: dict[str, tuple[list[float], float]] = {}
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def _make_key(self, text: str, model: str) -> str:
        content = f"{model}:{text}"
        return hashlib.md5(content.encode()).hexdigest()

    async def get(self, text: str, model: str) -> list[float] | None:
        key = self._make_key(text, model)
        if key in self._cache:
            embedding, expire_time = self._cache[key]
            if time.time() < expire_time:
                self._hits += 1
                return embedding
            else:
                del self._cache[key]
        self._misses += 1
        return None

    async def set(
        self,
        text: str,
        model: str,
        embedding: list[float],
        ttl: int | None = None
    ) -> None:
        if len(self._cache) >= self._max_size:
            items = sorted(self._cache.items(), key=lambda x: x[1][1])
            for key, _ in items[:len(items) // 10]:
                del self._cache[key]

        key = self._make_key(text, model)
        expire_time = time.time() + (ttl or self._default_ttl)
        self._cache[key] = (embedding, expire_time)

    async def get_batch(self, texts: list[str], model: str) -> dict[str, list[float] | None]:
        results = {}
        for text in texts:
            results[text] = await self.get(text, model)
        return results

    async def set_batch(self, items: dict[str, list[float]], model: str, ttl: int | None = None) -> None:
        for text, embedding in items.items():
            await self.set(text, model, embedding, ttl)

    async def clear(self) -> None:
        self._cache.clear()
        self._hits = 0
        self._misses = 0

    async def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / total if total > 0 else 0
        }
```

### 5.2 重试装饰器

```python
def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    retryable_exceptions: tuple = (RateLimitError, ProviderUnavailableError)
):
    """重试装饰器 - 指数退避"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == max_retries:
                        break

                    if isinstance(e, RateLimitError) and e.retry_after > 0:
                        delay = e.retry_after
                    else:
                        delay = min(base_delay * (exponential_base ** attempt), max_delay)

                    await asyncio.sleep(delay)

            raise last_exception
        return wrapper
    return decorator
```

### 5.3 ServiceManager 实现

```python
class ServiceManager:
    """LLM/Embedding 服务统一管理器"""

    def __init__(self, config: ServiceConfig):
        self.config = config
        self._llm_providers: dict[ProviderType, BaseLLMProvider] = {}
        self._embedding_providers: dict[ProviderType, Any] = {}
        self._llm_service: LLMServiceImpl | None = None
        self._embedding_service: EmbeddingServiceImpl | None = None
        self._cache: EmbeddingCache | None = None
        self._initialized = False
        self._health_status: dict[str, bool] = {}

    async def initialize(self) -> None:
        """初始化所有服务"""
        if self._initialized:
            return

        if self.config.embedding_cache_enabled:
            self._cache = InMemoryEmbeddingCache(
                max_size=self.config.embedding_cache_max_size,
                default_ttl=self.config.embedding_cache_ttl
            )

        for ptype, pconfig in self.config.providers.items():
            await self._init_provider(ptype, pconfig)

        self._llm_service = LLMServiceImpl(
            providers=self._llm_providers,
            default_provider=self.config.default_llm_provider,
            config=self.config
        )

        self._embedding_service = EmbeddingServiceImpl(
            providers=self._embedding_providers,
            default_provider=self.config.default_embedding_provider,
            cache=self._cache,
            config=self.config
        )

        asyncio.create_task(self._health_check_loop())
        self._initialized = True

    async def shutdown(self) -> None:
        """优雅关闭"""
        if self._cache:
            await self._cache.clear()
        self._initialized = False

    @property
    def llm(self) -> LLMServiceImpl:
        if not self._llm_service:
            raise RuntimeError("ServiceManager not initialized")
        return self._llm_service

    @property
    def embedding(self) -> EmbeddingServiceImpl:
        if not self._embedding_service:
            raise RuntimeError("ServiceManager not initialized")
        return self._embedding_service

    async def check_health(self) -> dict[str, bool]:
        checks = {}
        for ptype, provider in self._llm_providers.items():
            checks[f"llm_{ptype.value}"] = await provider.health_check()
        for ptype, provider in self._embedding_providers.items():
            checks[f"embedding_{ptype.value}"] = await provider.health_check()
        self._health_status = checks
        return checks

    async def _health_check_loop(self) -> None:
        while self._initialized:
            await self.check_health()
            await asyncio.sleep(self.config.health_check_interval)

    def is_healthy(self) -> bool:
        return any(self._health_status.values())
```

---

## 6. 便捷函数与全局单例

```python
_service_manager: ServiceManager | None = None

async def init_services(config: LLMEmbeddingConfig | str | None = None) -> ServiceManager:
    """初始化服务（全局单例）"""
    global _service_manager

    if _service_manager is not None:
        return _service_manager

    if config is None:
        config = ConfigLoader.from_env()
    elif isinstance(config, str):
        config = ConfigLoader.from_yaml(config)

    service_config = ServiceConfig(
        providers={
            ProviderType(k) if isinstance(k, str) else k: v
            for k, v in config.providers.items()
        },
        default_llm_provider=ProviderType(config.default_llm_provider),
        default_embedding_provider=ProviderType(config.default_embedding_provider),
        embedding_cache_enabled=config.embedding_cache_enabled,
        embedding_cache_ttl=config.embedding_cache_ttl,
        embedding_cache_max_size=config.embedding_cache_max_size,
        retry_base_delay=config.retry_base_delay,
        retry_max_delay=config.retry_max_delay,
        health_check_interval=config.health_check_interval
    )

    _service_manager = ServiceManager(service_config)
    await _service_manager.initialize()

    return _service_manager

async def get_services() -> ServiceManager:
    """获取服务管理器"""
    if _service_manager is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _service_manager

async def shutdown_services() -> None:
    """关闭服务"""
    global _service_manager
    if _service_manager:
        await _service_manager.shutdown()
        _service_manager = None

async def llm() -> LLMServiceImpl:
    """获取 LLM 服务"""
    manager = await get_services()
    return manager.llm

async def embedding() -> EmbeddingServiceImpl:
    """获取 Embedding 服务"""
    manager = await get_services()
    return manager.embedding
```

---

## 7. 配置文件

```yaml
# config/llm_embedding.yaml

# === Provider 配置 ===
providers:
  openai:
    type: openai
    api_key: ${OPENAI_API_KEY}
    base_url: null
    models:
      fast: gpt-4o-mini
      default: gpt-4o
      powerful: gpt-4-turbo
    embedding_model: text-embedding-3-small
    rate_limit_rpm: 60
    timeout: 60.0

  anthropic:
    type: anthropic
    api_key: ${ANTHROPIC_API_KEY}
    models:
      fast: claude-3-haiku-20240307
      default: claude-3-5-sonnet-20241022
      powerful: claude-3-opus-20240229
    rate_limit_rpm: 40
    timeout: 90.0

  local:
    type: local
    base_url: http://localhost:11434
    embedding_model: bge-large-zh-v1.5

# === 默认 Provider ===
default_llm_provider: openai
default_embedding_provider: openai

# === 缓存配置 ===
cache:
  enabled: true
  ttl: 86400
  max_size: 100000

# === 重试配置 ===
retry:
  max_retries: 3
  base_delay: 1.0
  max_delay: 60.0
  exponential_base: 2.0

# === 健康检查 ===
health_check_interval: 60.0
```

---

## 8. 使用示例

### 8.1 基础使用

```python
async def basic_usage():
    await init_services()

    llm_svc = (await get_services()).llm
    emb_svc = (await get_services()).embedding

    # 简单生成
    response = await llm_svc.generate(
        "介绍一下 Python",
        model=ModelTier.FAST
    )

    # JSON 生成
    data = await llm_svc.generate_json(
        "列出 3 个编程语言，返回 JSON 数组",
        model=ModelTier.DEFAULT
    )

    # 流式生成
    async for chunk in llm_svc.stream("写一首诗"):
        print(chunk.content, end="", flush=True)

    # 嵌入
    embedding = await emb_svc.embed("Hello, world!")

    # 批量嵌入
    texts = ["文本1", "文本2", "文本3"]
    embeddings = await emb_svc.embed_batch(texts)

    # 相似度计算
    sim = emb_svc.similarity(embeddings[0], embeddings[1])

    await shutdown_services()
```

### 8.2 与其他层集成

```python
# 与存储层集成
class ChromaAdapterWithService(ChromaAdapter):
    def __init__(self, config, embedding_service):
        super().__init__(config)
        self._embedding_service = embedding_service

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        return await self._embedding_service.embed_batch(texts)

# 与检索层集成
class QueryAnalyzerWithService:
    def __init__(self, llm: LLMServiceImpl):
        self._llm = llm

    async def analyze(self, query: str) -> QueryAnalysis:
        result = await self._llm.generate_json(
            f"分析查询意图: {query}",
            model=ModelTier.FAST,
            temperature=0.3
        )
        return QueryAnalysis(**result)

# 与质量保障层集成
class RelevanceGraderWithService:
    def __init__(self, llm: LLMServiceImpl):
        self._llm = llm

    async def grade(self, query: str, doc: Document) -> GradedDocument:
        result = await self._llm.generate_json(
            self.GRADER_PROMPT.format(query=query, content=doc.content),
            model=ModelTier.FAST
        )
        return GradedDocument(
            document=doc,
            grade=RelevanceGrade(result["grade"]),
            confidence=result["confidence"],
            reason=result["reason"]
        )
```

---

## 9. 目录结构

```
niko-studio/
├── src/
│   └── knowledge/
│       └── services/                 # LLM/Embedding 服务层
│           ├── __init__.py           # 便捷函数导出
│           ├── models.py             # 数据结构定义
│           ├── protocols.py          # Protocol 接口
│           ├── providers/            # Provider 实现
│           │   ├── __init__.py
│           │   ├── base.py           # 基础抽象类
│           │   ├── openai.py
│           │   ├── anthropic.py
│           │   └── local.py
│           ├── cache.py              # Embedding 缓存
│           ├── llm_service.py        # LLM 服务实现
│           ├── embedding_service.py  # Embedding 服务实现
│           ├── manager.py            # ServiceManager
│           └── config.py             # 配置加载
│
├── config/
│   └── llm_embedding.yaml            # 配置文件
```

---

## 10. 模块总结

| 模块 | 职责 |
|------|------|
| **LLMService** | 文本生成、JSON 生成、流式、批量 |
| **EmbeddingService** | 单文本/批量嵌入、相似度计算 |
| **LLMProvider** | OpenAI/Anthropic/Local 适配器 |
| **EmbeddingProvider** | OpenAI/Local Embedding 适配器 |
| **EmbeddingCache** | 内存缓存，LRU 淘汰 |
| **ServiceManager** | 统一管理、健康检查、生命周期 |
| **ConfigLoader** | YAML/环境变量配置加载 |

---

## 11. 实现优先级

| 阶段 | 模块 | 依赖 |
|------|------|------|
| P0-01 | 数据结构定义 | - |
| P0-02 | Protocol 接口 | P0-01 |
| P0-03 | OpenAI Provider | P0-02 |
| P0-04 | Anthropic Provider | P0-02 |
| P0-05 | OpenAI Embedding Provider | P0-02 |
| P0-06 | Local Embedding Provider | P0-02 |
| P0-07 | Embedding 缓存 | - |
| P0-08 | LLM Service 实现 | P0-03, P0-04 |
| P0-09 | Embedding Service 实现 | P0-05, P0-06, P0-07 |
| P0-10 | ServiceManager | P0-08, P0-09 |
| P0-11 | 配置加载 | - |
| P0-12 | 便捷函数与全局单例 | P0-10, P0-11 |

---

*文档版本: 1.0 | 创建时间: 2026-02-04*
