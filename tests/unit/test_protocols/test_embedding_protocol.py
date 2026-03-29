"""
Tests for Embedding Protocols

Verifies EmbeddingService, EmbeddingProvider, and EmbeddingCache protocol compliance.
"""

import pytest
from protocols import EmbeddingService, EmbeddingProvider, EmbeddingCache
from typing import Any


class MockEmbeddingService:
    """Mock implementation of EmbeddingService for testing."""
    
    async def embed(self, text: str, *, model: str | None = None) -> list[float]:
        return [0.1, 0.2, 0.3]
    
    async def embed_batch(
        self,
        texts: list[str],
        *,
        model: str | None = None,
        batch_size: int = 100,
    ) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]
    
    async def embed_with_metadata(self, request: Any) -> Any:
        return {"embedding": [0.1, 0.2, 0.3], "metadata": {}}
    
    def similarity(self, embedding1: list[float], embedding2: list[float]) -> float:
        return 0.95
    
    def get_dimensions(self, model: str | None = None) -> int:
        return 1536


class MockEmbeddingProvider:
    """Mock implementation of EmbeddingProvider for testing."""
    
    @property
    def provider_type(self):
        from knowledge.services.models import ProviderType
        return ProviderType.OPENAI
    
    async def embed(
        self,
        texts: list[str],
        model: str,
        *,
        dimensions: int | None = None,
    ) -> Any:
        return {"embeddings": [[0.1, 0.2, 0.3] for _ in texts]}
    
    async def health_check(self) -> bool:
        return True
    
    def get_dimensions(self, model: str) -> int:
        return 1536


class MockEmbeddingCache:
    """Mock implementation of EmbeddingCache for testing."""
    
    async def get(self, text: str, model: str) -> list[float] | None:
        return [0.1, 0.2, 0.3]
    
    async def set(
        self,
        text: str,
        model: str,
        embedding: list[float],
        ttl: int | None = None,
    ) -> None:
        pass
    
    async def get_batch(
        self,
        texts: list[str],
        model: str,
    ) -> dict[str, list[float] | None]:
        return {text: [0.1, 0.2, 0.3] for text in texts}
    
    async def set_batch(
        self,
        items: dict[str, list[float]],
        model: str,
        ttl: int | None = None,
    ) -> None:
        pass
    
    async def clear(self) -> None:
        pass
    
    async def stats(self) -> dict[str, Any]:
        return {"hits": 10, "misses": 2, "size": 100}


class TestEmbeddingServiceProtocol:
    """Tests for EmbeddingService protocol compliance."""
    
    def test_embedding_service_protocol_compliance(self):
        """Verify MockEmbeddingService implements EmbeddingService protocol."""
        service = MockEmbeddingService()
        assert isinstance(service, EmbeddingService)
    
    def test_embedding_service_has_required_methods(self):
        """Verify EmbeddingService has all required methods."""
        service = MockEmbeddingService()
        assert hasattr(service, 'embed')
        assert hasattr(service, 'embed_batch')
        assert hasattr(service, 'embed_with_metadata')
        assert hasattr(service, 'similarity')
        assert hasattr(service, 'get_dimensions')
    
    @pytest.mark.asyncio
    async def test_embedding_service_embed(self):
        """Test EmbeddingService.embed method."""
        service = MockEmbeddingService()
        result = await service.embed("test text")
        assert result == [0.1, 0.2, 0.3]


class TestEmbeddingProviderProtocol:
    """Tests for EmbeddingProvider protocol compliance."""
    
    def test_embedding_provider_protocol_compliance(self):
        """Verify MockEmbeddingProvider implements EmbeddingProvider protocol."""
        provider = MockEmbeddingProvider()
        assert isinstance(provider, EmbeddingProvider)
    
    def test_embedding_provider_has_required_methods(self):
        """Verify EmbeddingProvider has all required methods."""
        provider = MockEmbeddingProvider()
        assert hasattr(provider, 'provider_type')
        assert hasattr(provider, 'embed')
        assert hasattr(provider, 'health_check')
        assert hasattr(provider, 'get_dimensions')


class TestEmbeddingCacheProtocol:
    """Tests for EmbeddingCache protocol compliance."""
    
    def test_embedding_cache_protocol_compliance(self):
        """Verify MockEmbeddingCache implements EmbeddingCache protocol."""
        cache = MockEmbeddingCache()
        assert isinstance(cache, EmbeddingCache)
    
    def test_embedding_cache_has_required_methods(self):
        """Verify EmbeddingCache has all required methods."""
        cache = MockEmbeddingCache()
        assert hasattr(cache, 'get')
        assert hasattr(cache, 'set')
        assert hasattr(cache, 'get_batch')
        assert hasattr(cache, 'set_batch')
        assert hasattr(cache, 'clear')
        assert hasattr(cache, 'stats')
    
    @pytest.mark.asyncio
    async def test_embedding_cache_get_set(self):
        """Test EmbeddingCache get/set methods."""
        cache = MockEmbeddingCache()
        await cache.set("text", "model", [0.1, 0.2])
        result = await cache.get("text", "model")
        assert result is not None
