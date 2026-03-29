"""
LLM Service and Provider Protocols

Defines protocols for LLM (Large Language Model) services and providers.
Supports structural subtyping with runtime checking.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable


# ============================================================
# LLM Service Protocol
# ============================================================

@runtime_checkable
class LLMService(Protocol):
    """LLM 服务抽象接口

    定义 LLM 服务的核心能力，包括文本生成、JSON 生成、流式输出和批量处理。
    """

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
    ) -> str:
        """生成文本响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表

        Returns:
            生成的文本内容
        """
        ...

    async def generate_with_metadata(
        self,
        request: "LLMRequest",
    ) -> "LLMResponse":
        """生成文本响应 (包含元数据)

        Args:
            request: LLM 请求对象

        Returns:
            包含内容和元数据的完整响应
        """
        ...

    async def generate_json(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        """生成 JSON 格式响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词

        Returns:
            解析后的 JSON 字典
        """
        ...

    async def stream(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
    ) -> AsyncIterator["StreamChunk"]:
        """流式生成文本响应

        Args:
            prompt: 用户提示词
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词

        Yields:
            StreamChunk 流式响应块
        """
        ...

    async def batch_generate(
        self,
        prompts: list[str],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        max_concurrency: int = 5,
    ) -> list[str]:
        """批量生成文本响应

        Args:
            prompts: 提示词列表
            model: 模型名称，None 使用默认模型
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            max_concurrency: 最大并发数

        Returns:
            生成的文本内容列表 (与输入顺序对应)
        """
        ...


# ============================================================
# LLM Provider Protocol
# ============================================================

@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider 适配器接口

    定义底层 LLM 提供商的适配器接口，用于对接不同的 LLM API。
    """

    @property
    def provider_type(self) -> "ProviderType":
        """提供商类型"""
        ...

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
    ) -> "LLMResponse":
        """执行补全请求

        Args:
            prompt: 用户提示词
            model: 模型名称
            temperature: 生成温度 (0.0-2.0)
            max_tokens: 最大生成 token 数
            system_prompt: 系统提示词
            stop_sequences: 停止序列列表
            response_format: 响应格式 (如 JSON schema)

        Returns:
            LLM 响应对象
        """
        ...

    async def stream_complete(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
        stop_sequences: list[str] | None = None,
    ) -> AsyncIterator["StreamChunk"]:
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
        ...

    async def health_check(self) -> bool:
        """检查提供商健康状态

        Returns:
            True 表示健康，False 表示不可用
        """
        ...

    def get_model_for_tier(self, tier: "ModelTier") -> str:
        """根据层级获取模型名称

        Args:
            tier: 模型层级

        Returns:
            对应的模型名称
        """
        ...
