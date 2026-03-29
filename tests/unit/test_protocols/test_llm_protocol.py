"""
Tests for LLM Protocols

Verifies LLMService and LLMProvider protocol compliance.
"""

import pytest
from protocols import LLMService, LLMProvider
from typing import Any


class MockLLMService:
    """Mock implementation of LLMService for testing."""
    
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
        return "Generated text"
    
    async def generate_with_metadata(self, request: Any) -> Any:
        return {"content": "text", "metadata": {}}
    
    async def generate_json(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        return {"key": "value"}
    
    async def stream(self, prompt: str, **kwargs):
        yield {"content": "chunk"}
    
    async def batch_generate(
        self,
        prompts: list[str],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        max_concurrency: int = 5,
    ) -> list[str]:
        return ["result1", "result2"]


class MockLLMProvider:
    """Mock implementation of LLMProvider for testing."""
    
    @property
    def provider_type(self):
        from knowledge.services.models import ProviderType
        return ProviderType.OPENAI
    
    async def complete(self, prompt: str, model: str, **kwargs):
        return {"content": "text", "metadata": {}}
    
    async def stream_complete(self, prompt: str, model: str, **kwargs):
        yield {"content": "chunk"}
    
    async def health_check(self) -> bool:
        return True
    
    def get_model_for_tier(self, tier):
        return "gpt-4o"


class TestLLMServiceProtocol:
    """Tests for LLMService protocol compliance."""
    
    def test_llm_service_protocol_compliance(self):
        """Verify MockLLMService implements LLMService protocol."""
        service = MockLLMService()
        assert isinstance(service, LLMService)
    
    def test_llm_service_has_required_methods(self):
        """Verify LLMService has all required methods."""
        service = MockLLMService()
        assert hasattr(service, 'generate')
        assert hasattr(service, 'generate_with_metadata')
        assert hasattr(service, 'generate_json')
        assert hasattr(service, 'stream')
        assert hasattr(service, 'batch_generate')
    
    @pytest.mark.asyncio
    async def test_llm_service_generate(self):
        """Test LLMService.generate method."""
        service = MockLLMService()
        result = await service.generate("test prompt")
        assert result == "Generated text"


class TestLLMProviderProtocol:
    """Tests for LLMProvider protocol compliance."""
    
    def test_llm_provider_protocol_compliance(self):
        """Verify MockLLMProvider implements LLMProvider protocol."""
        provider = MockLLMProvider()
        assert isinstance(provider, LLMProvider)
    
    def test_llm_provider_has_required_methods(self):
        """Verify LLMProvider has all required methods."""
        provider = MockLLMProvider()
        assert hasattr(provider, 'provider_type')
        assert hasattr(provider, 'complete')
        assert hasattr(provider, 'stream_complete')
        assert hasattr(provider, 'health_check')
        assert hasattr(provider, 'get_model_for_tier')
    
    @pytest.mark.asyncio
    async def test_llm_provider_health_check(self):
        """Test LLMProvider.health_check method."""
        provider = MockLLMProvider()
        result = await provider.health_check()
        assert result is True
