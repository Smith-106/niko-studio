# -*- coding: utf-8 -*-
"""Provider implementation tests for knowledge services."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.knowledge.services.models import (
    EmbeddingError,
    ModelTier,
    ProviderType,
    ProviderUnavailableError,
    RateLimitError,
    TokenLimitError,
)
from src.knowledge.services.providers.anthropic_llm import AnthropicLLMProvider
from src.knowledge.services.providers.local_embedding import LocalEmbeddingProvider
from src.knowledge.services.providers.openai_embedding import OpenAIEmbeddingProvider
from src.knowledge.services.providers.openai_llm import OpenAILLMProvider


class TestOpenAILLMProvider:
    @pytest.fixture()
    def provider(self):
        p = OpenAILLMProvider(api_key="k")
        p._client = MagicMock()
        p._client.chat = MagicMock()
        p._client.chat.completions = MagicMock()
        return p

    @pytest.mark.asyncio
    async def test_complete_with_options_and_usage(self, provider):
        usage = SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        message = SimpleNamespace(content="hello")
        choice = SimpleNamespace(message=message)
        response = SimpleNamespace(choices=[choice], usage=usage)

        provider._client.chat.completions.create = AsyncMock(return_value=response)

        result = await provider.complete(
            prompt="p",
            model="gpt-4o",
            temperature=0.2,
            max_tokens=99,
            system_prompt="sys",
            stop_sequences=["END"],
            response_format={"type": "json"},
        )

        assert result.content == "hello"
        assert result.provider == ProviderType.OPENAI
        assert result.usage.prompt_tokens == 10
        kwargs = provider._client.chat.completions.create.await_args.kwargs
        assert kwargs["response_format"] == {"type": "json_object"}
        assert kwargs["max_tokens"] == 99
        assert kwargs["stop"] == ["END"]
        assert kwargs["messages"][0]["role"] == "system"

    @pytest.mark.asyncio
    async def test_complete_without_optional_fields_and_no_usage(self, provider):
        message = SimpleNamespace(content=None)
        choice = SimpleNamespace(message=message)
        response = SimpleNamespace(choices=[choice], usage=None)
        provider._client.chat.completions.create = AsyncMock(return_value=response)

        result = await provider.complete(prompt="p", model="gpt-4o")

        assert result.content == ""
        kwargs = provider._client.chat.completions.create.await_args.kwargs
        assert "max_tokens" not in kwargs
        assert "stop" not in kwargs
        assert result.usage.total_tokens == 0

    @pytest.mark.asyncio
    async def test_complete_handles_rate_limit_error(self, provider):
        provider._client.chat.completions.create = AsyncMock(side_effect=Exception("rate limit exceeded"))
        with pytest.raises(RateLimitError):
            await provider.complete(prompt="p", model="gpt-4o")

    @pytest.mark.asyncio
    async def test_complete_handles_token_error(self, provider):
        provider._client.chat.completions.create = AsyncMock(side_effect=Exception("token length too long"))
        with pytest.raises(TokenLimitError):
            await provider.complete(prompt="p", model="gpt-4o")

    @pytest.mark.asyncio
    async def test_complete_handles_unknown_error(self, provider):
        provider._client.chat.completions.create = AsyncMock(side_effect=Exception("service unavailable"))
        with pytest.raises(ProviderUnavailableError):
            await provider.complete(prompt="p", model="gpt-4o")

    @pytest.mark.asyncio
    async def test_stream_complete_success(self, provider):
        chunk1 = SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="he"))],
            usage=None,
        )
        chunk2 = SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="llo"))],
            usage=None,
        )
        final = SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content=None))],
            usage=SimpleNamespace(prompt_tokens=3, completion_tokens=2, total_tokens=5),
        )

        async def _aiter():
            for item in [chunk1, chunk2, final]:
                yield item

        provider._client.chat.completions.create = AsyncMock(return_value=_aiter())

        chunks = []
        async for c in provider.stream_complete(prompt="p", model="gpt-4o"):
            chunks.append(c)

        assert [c.content for c in chunks[:-1]] == ["he", "llo"]
        assert chunks[-1].is_final is True
        assert chunks[-1].usage.total_tokens == 5

    @pytest.mark.asyncio
    async def test_stream_complete_with_optional_fields(self, provider):
        class _Stream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        provider._client.chat.completions.create = AsyncMock(return_value=_Stream())

        chunks = []
        async for c in provider.stream_complete(
            prompt="p",
            model="gpt-4o",
            system_prompt="sys",
            max_tokens=7,
            stop_sequences=["STOP"],
        ):
            chunks.append(c)

        assert chunks == []
        kwargs = provider._client.chat.completions.create.await_args.kwargs
        assert kwargs["messages"][0] == {"role": "system", "content": "sys"}
        assert kwargs["max_tokens"] == 7
        assert kwargs["stop"] == ["STOP"]

    @pytest.mark.asyncio
    async def test_stream_complete_error_mapping(self, provider):
        provider._client.chat.completions.create = AsyncMock(side_effect=Exception("service unavailable"))

        with pytest.raises(ProviderUnavailableError):
            async for _ in provider.stream_complete(prompt="p", model="gpt-4o"):
                pass

    @pytest.mark.asyncio
    async def test_health_check_true_false(self, provider):
        provider.complete = AsyncMock(return_value=MagicMock())
        assert await provider.health_check() is True

        provider.complete = AsyncMock(side_effect=Exception("x"))
        assert await provider.health_check() is False

    def test_model_and_pricing_and_provider_type(self, provider):
        assert provider.provider_type == ProviderType.OPENAI
        assert provider.get_model_for_tier(ModelTier.FAST) == "gpt-4o-mini"
        assert provider.get_model_for_tier(ModelTier.DEFAULT) == "gpt-4o"
        assert provider.get_model_for_tier(ModelTier.POWERFUL) == "gpt-4-turbo"
        assert provider._estimate_cost("unknown", 10, 20) == 0


class TestAnthropicLLMProvider:
    @pytest.fixture()
    def provider(self):
        with patch("src.knowledge.services.providers.anthropic_llm.AsyncAnthropic"):
            p = AnthropicLLMProvider(api_key="k")
        p._client = MagicMock()
        p._client.messages = MagicMock()
        return p

    @pytest.mark.asyncio
    async def test_complete_success_and_options(self, provider):
        block1 = SimpleNamespace(text="hello")
        block2 = SimpleNamespace(text=" world")
        usage = SimpleNamespace(input_tokens=10, output_tokens=5)
        response = SimpleNamespace(content=[block1, block2], usage=usage)
        provider._client.messages.create = AsyncMock(return_value=response)

        result = await provider.complete(
            prompt="p",
            model="claude-3-5-sonnet-20241022",
            system_prompt="sys",
            stop_sequences=["STOP"],
            max_tokens=8,
            temperature=0.1,
        )

        assert result.content == "hello world"
        kwargs = provider._client.messages.create.await_args.kwargs
        assert kwargs["system"] == "sys"
        assert kwargs["stop_sequences"] == ["STOP"]
        assert kwargs["max_tokens"] == 8
        assert result.usage.total_tokens == 15

    @pytest.mark.asyncio
    async def test_complete_handles_non_text_blocks(self, provider):
        block = SimpleNamespace(not_text="x")
        usage = SimpleNamespace(input_tokens=1, output_tokens=2)
        response = SimpleNamespace(content=[block], usage=usage)
        provider._client.messages.create = AsyncMock(return_value=response)

        result = await provider.complete(prompt="p", model="claude-3-haiku-20240307")
        assert result.content == ""

    @pytest.mark.asyncio
    async def test_complete_error_mapping(self, provider):
        provider._client.messages.create = AsyncMock(side_effect=Exception("token length"))
        with pytest.raises(TokenLimitError):
            await provider.complete(prompt="p", model="m")

        provider._client.messages.create = AsyncMock(side_effect=Exception("rate limited"))
        with pytest.raises(RateLimitError):
            await provider.complete(prompt="p", model="m")

    @pytest.mark.asyncio
    async def test_complete_error_mapping_unavailable(self, provider):
        provider._client.messages.create = AsyncMock(side_effect=Exception("service down"))
        with pytest.raises(ProviderUnavailableError):
            await provider.complete(prompt="p", model="m")

    @pytest.mark.asyncio
    async def test_stream_complete_with_optional_fields(self, provider):
        class _StreamCtx:
            def __init__(self):
                self.text_stream = self._gen()

            async def _gen(self):
                if False:
                    yield "never"

            async def get_final_message(self):
                return SimpleNamespace(usage=SimpleNamespace(input_tokens=1, output_tokens=1))

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

        provider._client.messages.stream = MagicMock(return_value=_StreamCtx())

        out = []
        async for c in provider.stream_complete(
            prompt="p",
            model="m",
            system_prompt="sys",
            stop_sequences=["STOP"],
            max_tokens=11,
        ):
            out.append(c)

        kwargs = provider._client.messages.stream.call_args.kwargs
        assert kwargs["system"] == "sys"
        assert kwargs["stop_sequences"] == ["STOP"]
        assert kwargs["max_tokens"] == 11
        assert out[-1].is_final is True
        assert out[-1].usage.total_tokens == 2

    @pytest.mark.asyncio
    async def test_stream_complete_success(self, provider):
        class _StreamCtx:
            def __init__(self):
                self.text_stream = self._gen()

            async def _gen(self):
                yield "a"
                yield "b"

            async def get_final_message(self):
                return SimpleNamespace(usage=SimpleNamespace(input_tokens=2, output_tokens=3))

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

        provider._client.messages.stream = MagicMock(return_value=_StreamCtx())

        out = []
        async for c in provider.stream_complete(prompt="p", model="m"):
            out.append(c)

        assert [x.content for x in out[:-1]] == ["a", "b"]
        assert out[-1].is_final is True
        assert out[-1].usage.total_tokens == 5

    @pytest.mark.asyncio
    async def test_stream_complete_error(self, provider):
        provider._client.messages.stream = MagicMock(side_effect=Exception("x"))
        with pytest.raises(ProviderUnavailableError):
            async for _ in provider.stream_complete(prompt="p", model="m"):
                pass

    @pytest.mark.asyncio
    async def test_health_check(self, provider):
        provider.complete = AsyncMock(return_value=MagicMock())
        assert await provider.health_check() is True
        provider.complete = AsyncMock(side_effect=Exception("x"))
        assert await provider.health_check() is False

    def test_model_and_pricing_and_provider_type(self, provider):
        assert provider.provider_type == ProviderType.ANTHROPIC
        assert provider.get_model_for_tier(ModelTier.FAST) == "claude-3-haiku-20240307"
        assert provider.get_model_for_tier(ModelTier.DEFAULT) == "claude-3-5-sonnet-20241022"
        assert provider.get_model_for_tier(ModelTier.POWERFUL) == "claude-3-opus-20240229"
        assert provider._estimate_cost("unknown", 100, 100) == 0


class TestOpenAIEmbeddingProvider:
    @pytest.fixture()
    def provider(self):
        p = OpenAIEmbeddingProvider(api_key="k")
        p._client = MagicMock()
        p._client.embeddings = MagicMock()
        return p

    @pytest.mark.asyncio
    async def test_embed_with_dimensions_branch(self, provider):
        usage = SimpleNamespace(prompt_tokens=10, total_tokens=10)
        data = [SimpleNamespace(embedding=[0.1, 0.2]), SimpleNamespace(embedding=[0.3, 0.4])]
        response = SimpleNamespace(data=data, usage=usage)
        provider._client.embeddings.create = AsyncMock(return_value=response)

        result = await provider.embed(
            texts=["a", "b"],
            model="text-embedding-3-small",
            dimensions=256,
        )

        kwargs = provider._client.embeddings.create.await_args.kwargs
        assert kwargs["dimensions"] == 256
        assert result.dimensions == 2
        assert result.usage.total_tokens == 10

    @pytest.mark.asyncio
    async def test_embed_without_dimensions_branch(self, provider):
        usage = SimpleNamespace(prompt_tokens=1, total_tokens=1)
        response = SimpleNamespace(data=[SimpleNamespace(embedding=[1.0])], usage=usage)
        provider._client.embeddings.create = AsyncMock(return_value=response)

        await provider.embed(texts=["a"], model="text-embedding-ada-002", dimensions=128)
        kwargs = provider._client.embeddings.create.await_args.kwargs
        assert "dimensions" not in kwargs

    @pytest.mark.asyncio
    async def test_embed_error(self, provider):
        provider._client.embeddings.create = AsyncMock(side_effect=Exception("bad"))
        with pytest.raises(EmbeddingError):
            await provider.embed(texts=["a"], model="text-embedding-3-small")

    @pytest.mark.asyncio
    async def test_health_check(self, provider):
        provider.embed = AsyncMock(return_value=MagicMock())
        assert await provider.health_check() is True
        provider.embed = AsyncMock(side_effect=Exception("x"))
        assert await provider.health_check() is False

    def test_provider_type_dimensions_and_cost(self, provider):
        assert provider.provider_type == ProviderType.OPENAI
        assert provider.get_dimensions("text-embedding-3-large") == 3072
        assert provider.get_dimensions("unknown") == 1536
        assert provider._estimate_cost("unknown", 100) == 0


class TestLocalEmbeddingProvider:
    @pytest.mark.asyncio
    async def test_get_dimensions_branches(self):
        p = LocalEmbeddingProvider(model_name="BAAI/bge-small-zh-v1.5")
        assert p.provider_type == ProviderType.LOCAL
        assert p.get_dimensions("BAAI/bge-small-zh-v1.5") == 512
        assert p.get_dimensions("bge-small") == 512
        assert p.get_dimensions("unknown-model") == 768

    @pytest.mark.asyncio
    async def test_ensure_model_fastembed_import_error(self):
        p = LocalEmbeddingProvider(backend="fastembed")

        import builtins
        original_import = builtins.__import__

        def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "fastembed":
                raise ImportError("missing")
            return original_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", side_effect=_fake_import):
            with pytest.raises(EmbeddingError, match="fastembed"):
                await p._ensure_model()

    @pytest.mark.asyncio
    async def test_ensure_model_sentence_transformers_import_error(self):
        p = LocalEmbeddingProvider(backend="sentence-transformers")

        import builtins
        original_import = builtins.__import__

        def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "sentence_transformers":
                raise ImportError("missing")
            return original_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", side_effect=_fake_import):
            with pytest.raises(EmbeddingError, match="sentence-transformers"):
                await p._ensure_model()

    @pytest.mark.asyncio
    async def test_ensure_model_unknown_backend(self):
        p = LocalEmbeddingProvider(backend="unknown")
        with pytest.raises(EmbeddingError, match="Unknown backend"):
            await p._ensure_model()

    @pytest.mark.asyncio
    async def test_ensure_model_fastembed_success(self):
        p = LocalEmbeddingProvider(backend="fastembed", model_name="demo-fastembed")

        fake_model = object()
        fake_fastembed = SimpleNamespace(TextEmbedding=MagicMock(return_value=fake_model))
        fake_loop = SimpleNamespace(run_in_executor=AsyncMock(side_effect=lambda _, fn: fn()))

        with patch.dict("sys.modules", {"fastembed": fake_fastembed}):
            with patch("src.knowledge.services.providers.local_embedding.asyncio.get_event_loop", return_value=fake_loop):
                await p._ensure_model()

        assert p._model is fake_model
        fake_fastembed.TextEmbedding.assert_called_once_with(model_name="demo-fastembed")
        fake_loop.run_in_executor.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ensure_model_sentence_transformers_success(self):
        p = LocalEmbeddingProvider(backend="sentence-transformers", model_name="demo-st")

        fake_model = object()
        fake_st_module = SimpleNamespace(SentenceTransformer=MagicMock(return_value=fake_model))
        fake_loop = SimpleNamespace(run_in_executor=AsyncMock(side_effect=lambda _, fn: fn()))

        with patch.dict("sys.modules", {"sentence_transformers": fake_st_module}):
            with patch("src.knowledge.services.providers.local_embedding.asyncio.get_event_loop", return_value=fake_loop):
                await p._ensure_model()

        assert p._model is fake_model
        fake_st_module.SentenceTransformer.assert_called_once_with("demo-st")
        fake_loop.run_in_executor.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ensure_model_returns_when_model_exists(self):
        p = LocalEmbeddingProvider(backend="fastembed")
        p._model = object()
        await p._ensure_model()

        p = LocalEmbeddingProvider(backend="fastembed")
        p._ensure_model = AsyncMock()

        emb1 = MagicMock()
        emb1.tolist.return_value = [0.1, 0.2]
        emb2 = MagicMock()
        emb2.tolist.return_value = [0.3, 0.4]
        p._model = MagicMock()
        p._model.embed = MagicMock(return_value=[emb1, emb2])

        result = await p.embed(texts=["a", "b"], model="m")

        assert result.provider == ProviderType.LOCAL
        assert result.dimensions == 2
        assert result.embeddings == [[0.1, 0.2], [0.3, 0.4]]

    @pytest.mark.asyncio
    async def test_embed_fastembed_success(self):
        p = LocalEmbeddingProvider(backend="fastembed")
        p._ensure_model = AsyncMock()

        emb1 = MagicMock()
        emb1.tolist.return_value = [0.1, 0.2]
        emb2 = MagicMock()
        emb2.tolist.return_value = [0.3, 0.4]
        p._model = MagicMock()
        p._model.embed = MagicMock(return_value=[emb1, emb2])

        result = await p.embed(texts=["a", "b"], model="m")

        assert result.provider == ProviderType.LOCAL
        assert result.dimensions == 2
        assert result.embeddings == [[0.1, 0.2], [0.3, 0.4]]

        p = LocalEmbeddingProvider(backend="sentence-transformers")
        p._ensure_model = AsyncMock()
        p._model = MagicMock()
        p._model.encode = MagicMock(return_value=SimpleNamespace(tolist=lambda: [[1.0, 2.0]]))

        result = await p.embed(texts=["a"], model="m")
        assert result.embeddings == [[1.0, 2.0]]
        assert result.dimensions == 2

    @pytest.mark.asyncio
    async def test_embed_error(self):
        p = LocalEmbeddingProvider(backend="fastembed")
        p._ensure_model = AsyncMock()
        p._model = MagicMock()
        p._model.embed = MagicMock(side_effect=RuntimeError("boom"))

        with pytest.raises(EmbeddingError):
            await p.embed(texts=["a"], model="m")

    @pytest.mark.asyncio
    async def test_health_check(self):
        p = LocalEmbeddingProvider()
        p.embed = AsyncMock(return_value=MagicMock())
        assert await p.health_check() is True
        p.embed = AsyncMock(side_effect=Exception("x"))
        assert await p.health_check() is False
