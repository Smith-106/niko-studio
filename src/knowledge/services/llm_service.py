"""
LLM 服务实现

统一封装多 Provider，支持模型层级路由、重试和降级。
"""

import asyncio
import json
from collections.abc import AsyncIterator
from functools import wraps
from typing import Any, Callable

from .models import (
    LLMRequest,
    LLMResponse,
    ModelTier,
    ProviderType,
    StreamChunk,
    LLMError,
    RateLimitError,
    ProviderUnavailableError,
)
from .protocols import LLMProvider


def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
):
    """重试装饰器 - 指数退避"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except (RateLimitError, ProviderUnavailableError) as e:
                    last_exception = e
                    if attempt == max_retries:
                        break
                    if isinstance(e, RateLimitError) and e.retry_after:
                        delay = e.retry_after
                    else:
                        delay = min(base_delay * (exponential_base ** attempt), max_delay)
                    await asyncio.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


class LLMServiceImpl:
    """LLM 服务实现

    提供统一的 LLM 调用接口，支持:
    - 多 Provider 管理
    - 模型层级路由 (FAST/DEFAULT/POWERFUL)
    - 自动重试和降级
    - 流式响应
    - JSON 生成
    """

    def __init__(
        self,
        providers: dict[ProviderType, LLMProvider],
        default_provider: ProviderType = ProviderType.OPENAI,
        max_retries: int = 3,
        retry_base_delay: float = 1.0,
    ):
        """初始化 LLM 服务

        Args:
            providers: Provider 实例映射
            default_provider: 默认 Provider 类型
            max_retries: 最大重试次数
            retry_base_delay: 重试基础延迟
        """
        self._providers = providers
        self._default_provider = default_provider
        self._max_retries = max_retries
        self._retry_base_delay = retry_base_delay

    def _get_provider(self, provider_type: ProviderType | None = None) -> LLMProvider:
        """获取 Provider 实例"""
        ptype = provider_type or self._default_provider
        if ptype not in self._providers:
            available = list(self._providers.keys())
            if not available:
                raise ProviderUnavailableError("No providers available")
            ptype = available[0]
        return self._providers[ptype]

    def _resolve_model(
        self,
        model: str | ModelTier | None,
        provider: LLMProvider,
    ) -> str:
        """解析模型名称"""
        if model is None:
            return provider.get_model_for_tier(ModelTier.DEFAULT)
        if isinstance(model, ModelTier):
            return provider.get_model_for_tier(model)
        return model

    async def generate(
        self,
        prompt: str,
        *,
        model: str | ModelTier | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
        provider: ProviderType | None = None,
    ) -> str:
        """生成文本响应

        Args:
            prompt: 用户提示词
            model: 模型名称或层级
            temperature: 生成温度
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列
            provider: 指定 Provider

        Returns:
            生成的文本内容
        """
        response = await self._generate_with_retry(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt,
            stop_sequences=stop_sequences,
            provider=provider,
        )
        return response.content

    @with_retry(max_retries=3)
    async def _generate_with_retry(
        self,
        prompt: str,
        model: str | ModelTier | None,
        temperature: float,
        max_tokens: int | None,
        system_prompt: str | None,
        stop_sequences: list[str] | None,
        provider: ProviderType | None,
    ) -> LLMResponse:
        """带重试的生成"""
        llm_provider = self._get_provider(provider)
        model_name = self._resolve_model(model, llm_provider)

        return await llm_provider.complete(
            prompt=prompt,
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt,
            stop_sequences=stop_sequences,
        )

    async def generate_with_metadata(self, request: LLMRequest) -> LLMResponse:
        """生成响应，包含完整元数据"""
        return await self._generate_with_retry(
            prompt=request.prompt,
            model=request.model_override or request.model_tier,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            system_prompt=request.system_prompt,
            stop_sequences=request.stop_sequences,
            provider=None,
        )

    async def generate_json(
        self,
        prompt: str,
        *,
        model: str | ModelTier | None = None,
        temperature: float = 0.3,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        provider: ProviderType | None = None,
    ) -> dict[str, Any]:
        """生成 JSON 格式响应

        Args:
            prompt: 用户提示词
            model: 模型名称或层级
            temperature: 生成温度 (默认较低以确保结构)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            provider: 指定 Provider

        Returns:
            解析后的 JSON 字典
        """
        llm_provider = self._get_provider(provider)
        model_name = self._resolve_model(model, llm_provider)

        # 添加 JSON 格式提示
        json_system = system_prompt or ""
        if "json" not in json_system.lower():
            json_system = (json_system + "\n\nRespond with valid JSON only.").strip()

        response = await llm_provider.complete(
            prompt=prompt,
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=json_system,
            response_format={"type": "json"},
        )

        try:
            return json.loads(response.content)
        except json.JSONDecodeError as e:
            raise LLMError(f"Failed to parse JSON response: {e}") from e

    async def stream(
        self,
        prompt: str,
        *,
        model: str | ModelTier | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        provider: ProviderType | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """流式生成文本响应

        Yields:
            StreamChunk 流式响应块
        """
        llm_provider = self._get_provider(provider)
        model_name = self._resolve_model(model, llm_provider)

        async for chunk in llm_provider.stream_complete(
            prompt=prompt,
            model=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt,
        ):
            yield chunk

    async def batch_generate(
        self,
        prompts: list[str],
        *,
        model: str | ModelTier | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        max_concurrency: int = 5,
        provider: ProviderType | None = None,
    ) -> list[str]:
        """批量生成文本响应

        Args:
            prompts: 提示词列表
            model: 模型名称或层级
            temperature: 生成温度
            max_tokens: 最大生成 token 数
            max_concurrency: 最大并发数
            provider: 指定 Provider

        Returns:
            生成的文本列表 (与输入顺序对应)
        """
        semaphore = asyncio.Semaphore(max_concurrency)

        async def generate_one(prompt: str) -> str:
            async with semaphore:
                return await self.generate(
                    prompt=prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    provider=provider,
                )

        return await asyncio.gather(*[generate_one(p) for p in prompts])
