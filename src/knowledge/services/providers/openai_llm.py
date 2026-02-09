"""
OpenAI LLM Provider 实现

使用 OpenAI 官方 SDK 实现 LLMProvider Protocol，支持流式响应。
"""

import time
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from ..models import (
    LLMResponse,
    ModelTier,
    ProviderType,
    StreamChunk,
    TokenUsage,
    LLMError,
    RateLimitError,
    TokenLimitError,
    ProviderUnavailableError,
)


# 默认模型映射
DEFAULT_MODEL_MAPPING: dict[ModelTier, str] = {
    ModelTier.FAST: "gpt-4o-mini",
    ModelTier.DEFAULT: "gpt-4o",
    ModelTier.POWERFUL: "gpt-4-turbo",
}

# Token 价格 (USD per 1K tokens) - 用于成本估算
MODEL_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
}


class OpenAILLMProvider:
    """OpenAI LLM Provider 实现

    实现 LLMProvider Protocol，使用 AsyncOpenAI 客户端与 OpenAI API 交互。
    支持同步补全和流式响应。
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        model_mapping: dict[ModelTier, str] | None = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        """初始化 OpenAI LLM Provider

        Args:
            api_key: OpenAI API 密钥，None 时从环境变量读取
            base_url: API 基础 URL，用于自定义端点
            organization: 组织 ID
            model_mapping: 自定义模型层级映射
            timeout: 请求超时时间 (秒)
            max_retries: 最大重试次数
        """
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._model_mapping = model_mapping or DEFAULT_MODEL_MAPPING.copy()

    @property
    def provider_type(self) -> ProviderType:
        """提供商类型"""
        return ProviderType.OPENAI

    def get_model_for_tier(self, tier: ModelTier) -> str:
        """根据层级获取模型名称

        Args:
            tier: 模型层级

        Returns:
            对应的模型名称
        """
        return self._model_mapping.get(tier, self._model_mapping[ModelTier.DEFAULT])

    async def complete(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResponse:
        """执行补全请求

        Args:
            prompt: 用户提示词
            model: 模型名称
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表
            response_format: 响应格式 (如 {"type": "json"})

        Returns:
            LLM 响应对象
        """
        # 构建 messages 数组
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # 构建请求参数
        request_params: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }

        if max_tokens is not None:
            request_params["max_tokens"] = max_tokens

        if stop_sequences:
            request_params["stop"] = stop_sequences

        # 处理 JSON 响应格式
        if response_format and response_format.get("type") == "json":
            request_params["response_format"] = {"type": "json_object"}

        # 执行请求并计时
        start_time = time.perf_counter()
        try:
            response = await self._client.chat.completions.create(**request_params)
        except Exception as e:
            self._handle_api_error(e)

        end_time = time.perf_counter()
        latency_ms = int((end_time - start_time) * 1000)

        # 提取响应内容
        content = response.choices[0].message.content or ""

        # 构建 Token 使用统计
        usage = TokenUsage(
            prompt_tokens=response.usage.prompt_tokens if response.usage else 0,
            completion_tokens=response.usage.completion_tokens if response.usage else 0,
            total_tokens=response.usage.total_tokens if response.usage else 0,
            estimated_cost=self._estimate_cost(
                model,
                response.usage.prompt_tokens if response.usage else 0,
                response.usage.completion_tokens if response.usage else 0,
            ),
        )

        return LLMResponse(
            content=content,
            model_used=model,
            provider=ProviderType.OPENAI,
            usage=usage,
            latency_ms=latency_ms,
            cached=False,
        )

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """执行流式补全请求

        Args:
            prompt: 用户提示词
            model: 模型名称
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表

        Yields:
            StreamChunk 流式响应块
        """
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        request_params: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        if max_tokens is not None:
            request_params["max_tokens"] = max_tokens
        if stop_sequences:
            request_params["stop"] = stop_sequences

        try:
            stream = await self._client.chat.completions.create(**request_params)
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield StreamChunk(
                        content=chunk.choices[0].delta.content,
                        is_final=False,
                    )
                if hasattr(chunk, "usage") and chunk.usage:
                    yield StreamChunk(
                        content="",
                        is_final=True,
                        usage=TokenUsage(
                            prompt_tokens=chunk.usage.prompt_tokens,
                            completion_tokens=chunk.usage.completion_tokens,
                            total_tokens=chunk.usage.total_tokens,
                        ),
                    )
        except Exception as e:
            self._handle_api_error(e)

    async def health_check(self) -> bool:
        """检查提供商健康状态"""
        try:
            await self.complete(
                prompt="Hi",
                model=self.get_model_for_tier(ModelTier.FAST),
                temperature=0,
                max_tokens=5,
            )
            return True
        except Exception:
            return False

    def _handle_api_error(self, error: Exception) -> None:
        """处理 API 错误并转换为统一错误类型"""
        error_msg = str(error).lower()
        if "rate" in error_msg or "limit" in error_msg:
            raise RateLimitError(str(error), provider=ProviderType.OPENAI)
        if "token" in error_msg or "length" in error_msg:
            raise TokenLimitError(str(error), provider=ProviderType.OPENAI)
        raise ProviderUnavailableError(str(error), provider=ProviderType.OPENAI) from error

    def _estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """估算请求费用"""
        pricing = MODEL_PRICING.get(model, {"input": 0, "output": 0})
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1000
