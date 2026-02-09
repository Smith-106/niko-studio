"""
配置加载器模块

支持从 YAML 文件和环境变量加载服务配置。
环境变量格式: ${ENV_VAR} 或 ${ENV_VAR:default_value}
"""

import os
import re
from pathlib import Path
from typing import Any

import yaml

from .models import (
    ModelTier,
    ProviderConfig,
    ProviderType,
    ServiceConfig,
)


class ConfigError(Exception):
    """配置加载错误"""
    pass


class ConfigLoader:
    """配置加载器 - 支持 YAML 文件和环境变量"""

    # 环境变量模式: ${VAR} 或 ${VAR:default}
    _ENV_PATTERN = re.compile(r'\$\{([^}:]+)(?::([^}]*))?\}')

    @classmethod
    def from_yaml(cls, path: str | Path) -> ServiceConfig:
        """
        从 YAML 文件加载配置

        Args:
            path: YAML 配置文件路径

        Returns:
            ServiceConfig 实例

        Raises:
            ConfigError: 配置文件不存在或格式错误
        """
        path = Path(path)
        if not path.exists():
            raise ConfigError(f"配置文件不存在: {path}")

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ConfigError(f"YAML 解析错误: {e}")

        if data is None:
            data = {}

        # 递归替换环境变量
        data = cls._substitute_env_vars_recursive(data)

        return cls.from_dict(data)

    @classmethod
    def from_env(cls) -> ServiceConfig:
        """
        从环境变量加载配置

        支持的环境变量:
        - LLM_DEFAULT_PROVIDER: 默认 LLM 提供商
        - EMBEDDING_DEFAULT_PROVIDER: 默认 Embedding 提供商
        - OPENAI_API_KEY: OpenAI API 密钥
        - ANTHROPIC_API_KEY: Anthropic API 密钥
        - AZURE_OPENAI_API_KEY: Azure OpenAI API 密钥
        - LOCAL_LLM_BASE_URL: 本地 LLM 服务地址

        Returns:
            ServiceConfig 实例
        """
        providers = []

        # OpenAI 配置
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key:
            providers.append(ProviderConfig(
                provider=ProviderType.OPENAI,
                api_key=openai_key,
                base_url=os.getenv('OPENAI_BASE_URL'),
                model_mapping={
                    ModelTier.FAST: os.getenv('OPENAI_MODEL_FAST', 'gpt-4o-mini'),
                    ModelTier.DEFAULT: os.getenv('OPENAI_MODEL_DEFAULT', 'gpt-4o'),
                    ModelTier.POWERFUL: os.getenv('OPENAI_MODEL_POWERFUL', 'gpt-4-turbo'),
                },
                embedding_model=os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
            ))

        # Anthropic 配置
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        if anthropic_key:
            providers.append(ProviderConfig(
                provider=ProviderType.ANTHROPIC,
                api_key=anthropic_key,
                model_mapping={
                    ModelTier.FAST: os.getenv('ANTHROPIC_MODEL_FAST', 'claude-3-haiku-20240307'),
                    ModelTier.DEFAULT: os.getenv('ANTHROPIC_MODEL_DEFAULT', 'claude-3-5-sonnet-20241022'),
                    ModelTier.POWERFUL: os.getenv('ANTHROPIC_MODEL_POWERFUL', 'claude-3-opus-20240229'),
                },
            ))

        # Azure 配置
        azure_key = os.getenv('AZURE_OPENAI_API_KEY')
        if azure_key:
            providers.append(ProviderConfig(
                provider=ProviderType.AZURE,
                api_key=azure_key,
                base_url=os.getenv('AZURE_OPENAI_ENDPOINT'),
                model_mapping={
                    ModelTier.FAST: os.getenv('AZURE_MODEL_FAST', 'gpt-4o-mini'),
                    ModelTier.DEFAULT: os.getenv('AZURE_MODEL_DEFAULT', 'gpt-4o'),
                    ModelTier.POWERFUL: os.getenv('AZURE_MODEL_POWERFUL', 'gpt-4-turbo'),
                },
                embedding_model=os.getenv('AZURE_EMBEDDING_MODEL', 'text-embedding-3-small'),
            ))

        # 本地服务配置
        local_url = os.getenv('LOCAL_LLM_BASE_URL')
        if local_url:
            providers.append(ProviderConfig(
                provider=ProviderType.LOCAL,
                base_url=local_url,
                model_mapping={
                    ModelTier.FAST: os.getenv('LOCAL_MODEL_FAST', 'llama3'),
                    ModelTier.DEFAULT: os.getenv('LOCAL_MODEL_DEFAULT', 'llama3'),
                    ModelTier.POWERFUL: os.getenv('LOCAL_MODEL_POWERFUL', 'llama3'),
                },
                embedding_model=os.getenv('LOCAL_EMBEDDING_MODEL', 'bge-large-zh-v1.5'),
            ))

        # 默认提供商
        default_llm = os.getenv('LLM_DEFAULT_PROVIDER', 'openai')
        default_embedding = os.getenv('EMBEDDING_DEFAULT_PROVIDER', 'openai')

        return ServiceConfig(
            providers=providers,
            default_llm_provider=cls._parse_provider_type(default_llm),
            default_embedding_provider=cls._parse_provider_type(default_embedding),
            embedding_cache_enabled=os.getenv('EMBEDDING_CACHE_ENABLED', 'true').lower() == 'true',
            embedding_cache_ttl=int(os.getenv('EMBEDDING_CACHE_TTL', '86400')),
            embedding_cache_max_size=int(os.getenv('EMBEDDING_CACHE_MAX_SIZE', '10000')),
            retry_max_attempts=int(os.getenv('RETRY_MAX_ATTEMPTS', '3')),
            retry_initial_delay=float(os.getenv('RETRY_INITIAL_DELAY', '1.0')),
            retry_max_delay=float(os.getenv('RETRY_MAX_DELAY', '60.0')),
            retry_exponential_base=float(os.getenv('RETRY_EXPONENTIAL_BASE', '2.0')),
            health_check_interval=int(os.getenv('HEALTH_CHECK_INTERVAL', '60')),
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ServiceConfig:
        """
        从字典加载配置

        Args:
            data: 配置字典

        Returns:
            ServiceConfig 实例
        """
        providers = []
        providers_data = data.get('providers', {})

        for name, provider_data in providers_data.items():
            if provider_data is None:
                continue

            provider_type = cls._parse_provider_type(
                provider_data.get('type', name)
            )

            # 解析模型映射
            models = provider_data.get('models', {})
            model_mapping = {
                ModelTier.FAST: models.get('fast', ''),
                ModelTier.DEFAULT: models.get('default', ''),
                ModelTier.POWERFUL: models.get('powerful', ''),
            }

            providers.append(ProviderConfig(
                provider=provider_type,
                api_key=provider_data.get('api_key'),
                base_url=provider_data.get('base_url'),
                organization=provider_data.get('organization'),
                model_mapping=model_mapping,
                embedding_model=provider_data.get('embedding_model', ''),
                max_retries=provider_data.get('max_retries', 3),
                timeout=provider_data.get('timeout', 60.0),
                rate_limit_rpm=provider_data.get('rate_limit_rpm', 60),
            ))

        # 缓存配置
        cache_config = data.get('cache', {})

        # 重试配置
        retry_config = data.get('retry', {})

        return ServiceConfig(
            providers=providers,
            default_llm_provider=cls._parse_provider_type(
                data.get('default_llm_provider', 'openai')
            ),
            default_embedding_provider=cls._parse_provider_type(
                data.get('default_embedding_provider', 'openai')
            ),
            embedding_cache_enabled=cache_config.get('enabled', True),
            embedding_cache_ttl=cache_config.get('ttl', 86400),
            embedding_cache_max_size=cache_config.get('max_size', 10000),
            retry_max_attempts=retry_config.get('max_retries', 3),
            retry_initial_delay=retry_config.get('base_delay', 1.0),
            retry_max_delay=retry_config.get('max_delay', 60.0),
            retry_exponential_base=retry_config.get('exponential_base', 2.0),
            health_check_interval=int(data.get('health_check_interval', 60)),
        )

    @classmethod
    def _substitute_env_vars_recursive(cls, value: Any) -> Any:
        """
        递归替换配置值中的环境变量

        Args:
            value: 任意配置值

        Returns:
            替换后的值
        """
        if isinstance(value, str):
            return cls._substitute_env_vars(value)
        elif isinstance(value, dict):
            return {k: cls._substitute_env_vars_recursive(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [cls._substitute_env_vars_recursive(item) for item in value]
        return value

    @classmethod
    def _substitute_env_vars(cls, value: str) -> str | None:
        """
        替换字符串中的环境变量

        支持格式:
        - ${ENV_VAR}: 从环境变量获取，未设置则返回 None
        - ${ENV_VAR:default}: 从环境变量获取，未设置则使用默认值

        Args:
            value: 包含环境变量占位符的字符串

        Returns:
            替换后的字符串，如果整个值是单个未设置的环境变量则返回 None
        """
        # 检查是否整个值就是一个环境变量
        match = cls._ENV_PATTERN.fullmatch(value)
        if match:
            env_name, default = match.groups()
            env_value = os.getenv(env_name)
            if env_value is not None:
                return env_value
            if default is not None:
                return default
            return None

        # 部分替换
        def replace_match(m: re.Match) -> str:
            env_name, default = m.groups()
            env_value = os.getenv(env_name)
            if env_value is not None:
                return env_value
            if default is not None:
                return default
            return ''

        return cls._ENV_PATTERN.sub(replace_match, value)

    @staticmethod
    def _parse_provider_type(value: str) -> ProviderType:
        """
        解析 ProviderType 枚举

        Args:
            value: 提供商名称字符串

        Returns:
            ProviderType 枚举值

        Raises:
            ConfigError: 无效的提供商类型
        """
        value = value.lower().strip()
        try:
            return ProviderType(value)
        except ValueError:
            valid_types = [t.value for t in ProviderType]
            raise ConfigError(
                f"无效的提供商类型: '{value}'，有效值: {valid_types}"
            )

    @staticmethod
    def _parse_model_tier(value: str) -> ModelTier:
        """
        解析 ModelTier 枚举

        Args:
            value: 模型层级字符串

        Returns:
            ModelTier 枚举值

        Raises:
            ConfigError: 无效的模型层级
        """
        value = value.lower().strip()
        try:
            return ModelTier(value)
        except ValueError:
            valid_tiers = [t.value for t in ModelTier]
            raise ConfigError(
                f"无效的模型层级: '{value}'，有效值: {valid_tiers}"
            )


def load_config(
    path: str | Path | None = None,
    env_fallback: bool = True
) -> ServiceConfig:
    """
    便捷函数：加载服务配置

    Args:
        path: YAML 配置文件路径，None 则尝试默认路径
        env_fallback: 文件不存在时是否回退到环境变量

    Returns:
        ServiceConfig 实例
    """
    # 默认配置文件路径
    if path is None:
        # 尝试常见位置
        candidates = [
            Path('config/services.yaml'),
            Path('services.yaml'),
            Path.home() / '.config' / 'niko-studio' / 'services.yaml',
        ]
        for candidate in candidates:
            if candidate.exists():
                path = candidate
                break

    if path is not None:
        try:
            return ConfigLoader.from_yaml(path)
        except ConfigError:
            if not env_fallback:
                raise

    # 回退到环境变量
    return ConfigLoader.from_env()
