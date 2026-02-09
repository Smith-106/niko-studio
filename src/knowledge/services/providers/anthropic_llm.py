"""
Anthropic LLM Provider 实现

使用 Anthropic 官方 SDK，支持 Claude 系列模型和流式响应。
"""

import time
from collections.abc import AsyncIterator
from typing import Any

from anthropic import AsyncAnthropic

from ..models import (
    LLMResponse,
    ModelTier,
    ProviderType,
    StreamChunk,
    TokenUsage,
    RateLimitError,
    TokenLimitError,
    ProviderUnavailableError,
)


# 默认模型映射
DEFAULT_MODEL_MAPPING: dict[ModelTier, str] = {
    ModelTier.FAST: "claude-3-haiku-20240307",
    ModelTier.DEFAULT: "claude-3-5-sonnet-20241022",
    ModelTier.POWERFUL: "claude-3-opus-20240229",
}

# Token 价格 (USD per 1M tokens)
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
    "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
}


class AnthropicLLMProvider:
    """Anthropic LLM Provider 实现

    实现 LLMProvider Protocol，使用 AsyncAnthropic 客户端与 Anthropic API 交互。
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model_mapping: dict[ModelTier, str] | None = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        """初始化 Anthropic LLM Provider"""
        self._client = AsyncAnthropic(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._model_mapping = model_mapping or DEFAULT_MODEL_MAPPING.copy()

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.ANTHROPIC

    def get_model_for_tier(self, tier: ModelTier) -> str:
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
        """执行补全请求"""
        request_params: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or 4096,
            "temperature": temperature,
        }

        if system_prompt:
            request_params["system"] = system_prompt
        if stop_sequences:
            request_params["stop_sequences"] = stop_sequences

        start_time = time.perf_counter()
        try:
            response = await self._client.messages.create(**request_params)
        except Exception as e:
            self._handle_api_error(e)

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        content = ""
        if response.content:
            for block in response.content:
                if hasattr(block, "text"):
                    content += block.text

        usage = TokenUsage(
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
            total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            estimated_cost=self._estimate_cost(
                model, response.usage.input_tokens, response.usage.output_tokens
            ),
        )

        return LLMResponse(
            content=content,
            model_used=model,
            provider=ProviderType.ANTHROPIC,
            usage=usage,
            latency_ms=latency_ms,
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
        """执行流式补全请求"""
        request_params: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or 4096,
            "temperature": temperature,
        }

        if system_prompt:
            request_params["system"] = system_prompt
        if stop_sequences:
            request_params["stop_sequences"] = stop_sequences

        try:
            async with self._client.messages.stream(**request_params) as stream:
                async for text in stream.text_stream:
                    yield StreamChunk(content=text, is_final=False)

                final_message = await stream.get_final_message()
                yield StreamChunk(
                    content="",
                    is_final=True,
                    usage=TokenUsage(
                        prompt_tokens=final_message.usage.input_tokens,
                        completion_tokens=final_message.usage.output_tokens,
                        total_tokens=final_message.usage.input_tokens + final_message.usage.output_tokens,
                    ),
                )
        except Exception as e:
            self._handle_api_error(e)

    async def health_check(self) -> bool:
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
        error_msg = str(error).lower()
        if "rate" in error_msg or "limit" in error_msg:
            raise RateLimitError(str(error), provider=ProviderType.ANTHROPIC)
        if "token" in error_msg or "length" in error_msg:
            raise TokenLimitError(str(error), provider=ProviderType.ANTHROPIC)
        raise ProviderUnavailableError(str(error), provider=ProviderType.ANTHROPIC) from error

    def _estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        pricing = MODEL_PRICING.get(model, {"input": 0, "output": 0})
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
