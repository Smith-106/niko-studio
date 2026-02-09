"""
RerankerFactory - 重排器工厂

根据配置创建对应的重排器实例。
"""

import os
from typing import Any

from .models import RerankerConfig, RerankerError, RerankerType
from .base import RerankerStrategy
from .strategies import (
    JinaReranker,
    VoyageReranker,
    TEIReranker,
    BailianReranker,
)


class RerankerFactory:
    """重排器工厂

    根据配置创建对应类型的重排器实例。
    支持从配置对象、字典或环境变量创建。
    """

    # 重排器类型到实现类的映射
    _RERANKER_CLASSES: dict[RerankerType, type[RerankerStrategy]] = {
        RerankerType.JINA: JinaReranker,
        RerankerType.VOYAGE: VoyageReranker,
        RerankerType.TEI: TEIReranker,
        RerankerType.BAILIAN: BailianReranker,
    }

    # 环境变量到重排器类型的映射
    _ENV_KEY_MAPPING: dict[str, RerankerType] = {
        "JINA_API_KEY": RerankerType.JINA,
        "VOYAGE_API_KEY": RerankerType.VOYAGE,
        "TEI_BASE_URL": RerankerType.TEI,
        "DASHSCOPE_API_KEY": RerankerType.BAILIAN,
    }

    @classmethod
    def create(cls, config: RerankerConfig) -> RerankerStrategy:
        """根据配置创建重排器

        Args:
            config: 重排器配置

        Returns:
            RerankerStrategy 实例

        Raises:
            RerankerError: 不支持的重排器类型
        """
        reranker_class = cls._RERANKER_CLASSES.get(config.reranker_type)
        if reranker_class is None:
            raise RerankerError(
                f"Unsupported reranker type: {config.reranker_type}",
                reranker_type=config.reranker_type,
            )

        return reranker_class(config)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RerankerStrategy:
        """从字典创建重排器

        Args:
            data: 配置字典，包含以下字段:
                - type: 重排器类型 (jina, voyage, tei, bailian)
                - api_key: API 密钥 (可选)
                - base_url: API 基础 URL (可选)
                - model: 模型名称 (可选)
                - timeout: 超时时间 (可选)
                - max_retries: 最大重试次数 (可选)

        Returns:
            RerankerStrategy 实例
        """
        reranker_type_str = data.get("type", "jina")
        try:
            reranker_type = RerankerType(reranker_type_str.lower())
        except ValueError:
            valid_types = [t.value for t in RerankerType]
            raise RerankerError(
                f"Invalid reranker type: '{reranker_type_str}', valid types: {valid_types}"
            )

        config = RerankerConfig(
            reranker_type=reranker_type,
            api_key=data.get("api_key"),
            base_url=data.get("base_url"),
            model=data.get("model"),
            timeout=data.get("timeout", 30.0),
            max_retries=data.get("max_retries", 3),
            batch_size=data.get("batch_size", 100),
        )

        return cls.create(config)

    @classmethod
    def from_env(
        cls,
        reranker_type: RerankerType | str | None = None,
    ) -> RerankerStrategy:
        """从环境变量创建重排器

        支持的环境变量:
        - RERANKER_TYPE: 重排器类型 (jina, voyage, tei, bailian)
        - JINA_API_KEY: Jina API 密钥
        - VOYAGE_API_KEY: Voyage API 密钥
        - TEI_BASE_URL: TEI 服务地址
        - DASHSCOPE_API_KEY: 百炼 API 密钥
        - RERANKER_MODEL: 模型名称 (可选)
        - RERANKER_TIMEOUT: 超时时间 (可选)

        Args:
            reranker_type: 指定重排器类型，None 则从环境变量读取或自动检测

        Returns:
            RerankerStrategy 实例
        """
        # 确定重排器类型
        if reranker_type is None:
            env_type = os.getenv("RERANKER_TYPE")
            if env_type:
                reranker_type = RerankerType(env_type.lower())
            else:
                # 自动检测：根据可用的 API key 选择
                reranker_type = cls._detect_reranker_type()
        elif isinstance(reranker_type, str):
            reranker_type = RerankerType(reranker_type.lower())

        # 获取对应的配置
        api_key = cls._get_api_key_for_type(reranker_type)
        base_url = cls._get_base_url_for_type(reranker_type)

        config = RerankerConfig(
            reranker_type=reranker_type,
            api_key=api_key,
            base_url=base_url,
            model=os.getenv("RERANKER_MODEL"),
            timeout=float(os.getenv("RERANKER_TIMEOUT", "30.0")),
            max_retries=int(os.getenv("RERANKER_MAX_RETRIES", "3")),
        )

        return cls.create(config)

    @classmethod
    def _detect_reranker_type(cls) -> RerankerType:
        """根据环境变量自动检测可用的重排器类型"""
        for env_key, reranker_type in cls._ENV_KEY_MAPPING.items():
            if os.getenv(env_key):
                return reranker_type

        # 默认使用 Jina
        return RerankerType.JINA

    @classmethod
    def _get_api_key_for_type(cls, reranker_type: RerankerType) -> str | None:
        """获取指定类型的 API 密钥"""
        key_mapping = {
            RerankerType.JINA: "JINA_API_KEY",
            RerankerType.VOYAGE: "VOYAGE_API_KEY",
            RerankerType.TEI: "TEI_API_KEY",  # TEI 通常不需要
            RerankerType.BAILIAN: "DASHSCOPE_API_KEY",
        }
        env_key = key_mapping.get(reranker_type)
        return os.getenv(env_key) if env_key else None

    @classmethod
    def _get_base_url_for_type(cls, reranker_type: RerankerType) -> str | None:
        """获取指定类型的 base URL"""
        url_mapping = {
            RerankerType.JINA: "JINA_BASE_URL",
            RerankerType.VOYAGE: "VOYAGE_BASE_URL",
            RerankerType.TEI: "TEI_BASE_URL",
            RerankerType.BAILIAN: "DASHSCOPE_BASE_URL",
        }
        env_key = url_mapping.get(reranker_type)
        return os.getenv(env_key) if env_key else None

    @classmethod
    def available_types(cls) -> list[RerankerType]:
        """返回所有支持的重排器类型"""
        return list(cls._RERANKER_CLASSES.keys())
