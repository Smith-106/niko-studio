"""
P7 服务测试套件

测试 LLM 和 Embedding 服务的核心功能。
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.knowledge.services.llm_service import LLMServiceImpl, with_retry
from src.knowledge.services.embedding_service import EmbeddingServiceImpl
from src.knowledge.services.models import (
    ProviderType,
    ModelTier,
    LLMRequest,
    LLMResponse,
    EmbeddingResponse,
    TokenUsage,
    StreamChunk,
    RateLimitError,
    ProviderUnavailableError,
    LLMError,
    EmbeddingError,
    TokenLimitError,
)


class TestLLMService:
    """LLM 服务测试"""

    @pytest.fixture
    def mock_provider(self):
        """Mock LLM Provider"""
        provider = MagicMock()
        provider.get_model_for_tier = MagicMock(return_value="gpt-4")
        provider.complete = AsyncMock(
            return_value=LLMResponse(
                content="Test response",
                model_used="gpt-4",
                provider=ProviderType.OPENAI,
                usage=TokenUsage(prompt_tokens=10, completion_tokens=20),
            )
        )
        provider.stream_complete = AsyncMock()
        return provider

    @pytest.fixture
    def llm_service(self, mock_provider):
        """LLM 服务实例"""
        return LLMServiceImpl(
            providers={ProviderType.OPENAI: mock_provider},
            default_provider=ProviderType.OPENAI,
        )

    @pytest.mark.asyncio
    async def test_generate_returns_content(self, llm_service, mock_provider):
        """测试 generate 返回文本内容"""
        result = await llm_service.generate("Hello")
        assert result == "Test response"
        mock_provider.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_with_model_tier(self, llm_service, mock_provider):
        """测试使用模型层级"""
        await llm_service.generate("Hello", model=ModelTier.POWERFUL)
        mock_provider.get_model_for_tier.assert_called_with(ModelTier.POWERFUL)

    @pytest.mark.asyncio
    async def test_generate_with_explicit_model(self, llm_service, mock_provider):
        """测试使用显式模型名"""
        await llm_service.generate("Hello", model="gpt-4-turbo")
        # 调用时应使用显式模型名，不调用 get_model_for_tier
        call_args = mock_provider.complete.call_args
        assert call_args.kwargs["model"] == "gpt-4-turbo"

    @pytest.mark.asyncio
    async def test_get_provider_fallback(self):
        """测试 Provider 降级"""
        mock_anthropic = MagicMock()
        mock_anthropic.get_model_for_tier = MagicMock(return_value="claude-3")
        mock_anthropic.complete = AsyncMock(
            return_value=LLMResponse(
                content="Anthropic response",
                model_used="claude-3",
                provider=ProviderType.ANTHROPIC,
                usage=TokenUsage(),
            )
        )

        # 配置默认为 OpenAI，但只有 Anthropic 可用
        service = LLMServiceImpl(
            providers={ProviderType.ANTHROPIC: mock_anthropic},
            default_provider=ProviderType.OPENAI,
        )

        result = await service.generate("Hello")
        assert result == "Anthropic response"

    @pytest.mark.asyncio
    async def test_no_providers_raises_error(self):
        """测试无 Provider 时抛出错误"""
        service = LLMServiceImpl(providers={}, default_provider=ProviderType.OPENAI)

        with pytest.raises(ProviderUnavailableError, match="No providers available"):
            await service.generate("Hello")

    @pytest.mark.asyncio
    async def test_batch_generate(self, llm_service, mock_provider):
        """测试批量生成"""
        prompts = ["Hello", "World", "Test"]
        results = await llm_service.batch_generate(prompts, max_concurrency=2)

        assert len(results) == 3
        assert all(r == "Test response" for r in results)

    @pytest.mark.asyncio
    async def test_generate_json_parses_response(self, llm_service, mock_provider):
        """测试 JSON 生成解析响应"""
        mock_provider.complete = AsyncMock(
            return_value=LLMResponse(
                content='{"key": "value"}',
                model_used="gpt-4",
                provider=ProviderType.OPENAI,
                usage=TokenUsage(),
            )
        )

        result = await llm_service.generate_json("Generate JSON")
        assert result == {"key": "value"}

    @pytest.mark.asyncio
    async def test_generate_json_invalid_response_raises_error(self, llm_service, mock_provider):
        """测试无效 JSON 响应抛出错误"""
        mock_provider.complete = AsyncMock(
            return_value=LLMResponse(
                content="not valid json",
                model_used="gpt-4",
                provider=ProviderType.OPENAI,
                usage=TokenUsage(),
            )
        )

        with pytest.raises(LLMError, match="Failed to parse JSON"):
            await llm_service.generate_json("Generate JSON")
    @pytest.mark.asyncio
    async def test_generate_with_metadata_uses_request_provider(self, llm_service, mock_provider):
        """测试 generate_with_metadata 调用重试路径��返回响应。"""
        request = LLMRequest(prompt="Hello")

        response = await llm_service.generate_with_metadata(request)

        assert response.content == "Test response"
        call_args = mock_provider.complete.call_args
        assert call_args.kwargs["model"] == "gpt-4"

    @pytest.mark.asyncio
    async def test_stream_yields_provider_chunks(self, llm_service, mock_provider):
        """测试 stream 透传 Provider 的流式输出。"""
        chunks = [
            StreamChunk(content="A", is_final=False),
            StreamChunk(content="B", is_final=True),
        ]

        async def fake_stream_complete(**kwargs):
            for chunk in chunks:
                yield chunk

        mock_provider.stream_complete = fake_stream_complete

        received = []
        async for chunk in llm_service.stream("Hello"):
            received.append(chunk)

        assert received == chunks


class TestLLMRetryDecorator:
    """LLM 重试装饰器测试"""

    @pytest.mark.asyncio
    async def test_retry_uses_retry_after_delay(self):
        """测试 retry_after 分支延迟。"""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise RateLimitError("Rate limited", retry_after=0.01)
            return "success"

        result = await flaky_function()
        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_retry_on_rate_limit(self):
        """测试限流时重试"""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise RateLimitError("Rate limited")
            return "success"

        result = await flaky_function()
        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_retry_exhausted_raises_last_error(self):
        """测试重试耗尽后抛出最后错误"""
        @with_retry(max_retries=2, base_delay=0.01)
        async def always_fail():
            raise ProviderUnavailableError("Provider down")

        with pytest.raises(ProviderUnavailableError):
            await always_fail()


class TestEmbeddingService:
    """Embedding 服务测试"""

    @pytest.fixture
    def mock_provider(self):
        """Mock Embedding Provider"""
        provider = MagicMock()
        provider.provider_type = ProviderType.OPENAI
        provider.embed = AsyncMock(
            return_value=EmbeddingResponse(
                embeddings=[[0.1, 0.2, 0.3]],
                model_used="text-embedding-3-small",
                provider=ProviderType.OPENAI,
                dimensions=3,
                usage=TokenUsage(prompt_tokens=5),
            )
        )
        provider.get_dimensions = MagicMock(return_value=3)
        return provider

    @pytest.fixture
    def embedding_service(self, mock_provider):
        """Embedding 服务实例"""
        return EmbeddingServiceImpl(
            providers={ProviderType.OPENAI: mock_provider},
            default_provider=ProviderType.OPENAI,
        )

    @pytest.mark.asyncio
    async def test_embed_single_text(self, embedding_service, mock_provider):
        """测试单文本嵌入"""
        result = await embedding_service.embed("Hello")
        assert result == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_embed_batch(self, embedding_service, mock_provider):
        """测试批量嵌入"""
        mock_provider.embed = AsyncMock(
            return_value=EmbeddingResponse(
                embeddings=[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                model_used="text-embedding-3-small",
                provider=ProviderType.OPENAI,
                dimensions=3,
                usage=TokenUsage(prompt_tokens=10),
            )
        )

        results = await embedding_service.embed_batch(["Hello", "World"])
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_embed_empty_list_returns_empty(self, embedding_service):
        """测试空列表返回空"""
        results = await embedding_service.embed_batch([])
        assert results == []

    @pytest.mark.asyncio
    async def test_no_providers_raises_error(self):
        """测试无 Provider 时抛出错误"""
        service = EmbeddingServiceImpl(providers={}, default_provider=ProviderType.OPENAI)

        with pytest.raises(EmbeddingError, match="No providers available"):
            await service.embed("Hello")

    def test_similarity_calculation(self, embedding_service):
        """测试相似度计算"""
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        assert embedding_service.similarity(vec1, vec2) == pytest.approx(1.0)

        vec3 = [0.0, 1.0, 0.0]
        assert embedding_service.similarity(vec1, vec3) == pytest.approx(0.0)

    def test_similarity_different_dimensions_raises_error(self, embedding_service):
        """测试维度不匹配抛出错误"""
        vec1 = [1.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]

        with pytest.raises(ValueError, match="same dimensions"):
            embedding_service.similarity(vec1, vec2)

    def test_similarity_zero_vector(self, embedding_service):
        """测试零向量相似度"""
        vec1 = [0.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        assert embedding_service.similarity(vec1, vec2) == 0.0

    def test_get_dimensions(self, embedding_service, mock_provider):
        """测试获取维度"""
        dims = embedding_service.get_dimensions()
        assert dims == 3


class TestModelErrors:
    """models.py error branch coverage tests"""

    def test_llm_error_str_without_provider(self):
        err = LLMError("plain")
        assert str(err) == "plain"

    def test_llm_error_str_with_provider(self):
        err = LLMError("oops", provider=ProviderType.OPENAI)
        assert str(err) == "[openai] oops"

    def test_token_limit_error_fields(self):
        err = TokenLimitError("too many", token_count=1200, token_limit=1000)
        assert err.token_count == 1200
        assert err.token_limit == 1000

    def test_embedding_error_str_with_provider(self):
        err = EmbeddingError("embed fail", provider=ProviderType.OPENAI)
        assert str(err) == "[openai] embed fail"


class TestEmbeddingCache:
    """Embedding 缓存测试"""

    @pytest.fixture
    def mock_cache(self):
        """Mock 缓存"""
        cache = MagicMock()
        cache.get_batch = AsyncMock(return_value={})
        cache.set_batch = AsyncMock()
        return cache

    @pytest.fixture
    def mock_provider(self):
        """Mock Provider"""
        provider = MagicMock()
        provider.provider_type = ProviderType.OPENAI
        provider.embed = AsyncMock(
            return_value=EmbeddingResponse(
                embeddings=[[0.1, 0.2, 0.3]],
                model_used="text-embedding-3-small",
                provider=ProviderType.OPENAI,
                dimensions=3,
                usage=TokenUsage(prompt_tokens=5),
            )
        )
        return provider

    @pytest.mark.asyncio
    async def test_cache_miss_calls_provider(self, mock_cache, mock_provider):
        """测试缓存未命中调用 Provider"""
        service = EmbeddingServiceImpl(
            providers={ProviderType.OPENAI: mock_provider},
            cache=mock_cache,
        )

        await service.embed("Hello")
        mock_provider.embed.assert_called_once()
        mock_cache.set_batch.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_hit_skips_provider(self, mock_cache, mock_provider):
        """测试缓存命中跳过 Provider"""
        mock_cache.get_batch = AsyncMock(
            return_value={"Hello": [0.1, 0.2, 0.3]}
        )

        service = EmbeddingServiceImpl(
            providers={ProviderType.OPENAI: mock_provider},
            cache=mock_cache,
        )

        result = await service.embed("Hello")
        assert result == [0.1, 0.2, 0.3]
        mock_provider.embed.assert_not_called()
