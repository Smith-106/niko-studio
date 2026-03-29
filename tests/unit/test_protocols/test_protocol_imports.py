"""
Tests for Shared Protocols Module

Verifies protocol imports and module structure.
"""

import pytest


class TestProtocolImports:
    """Tests for protocol module imports."""
    
    def test_import_llm_protocols(self):
        """Test importing LLM protocols."""
        from protocols import LLMService, LLMProvider
        assert LLMService is not None
        assert LLMProvider is not None
    
    def test_import_embedding_protocols(self):
        """Test importing Embedding protocols."""
        from protocols import EmbeddingService, EmbeddingProvider, EmbeddingCache
        assert EmbeddingService is not None
        assert EmbeddingProvider is not None
        assert EmbeddingCache is not None
    
    def test_import_agent_protocol(self):
        """Test importing Agent protocol."""
        from protocols import AgentProtocol
        assert AgentProtocol is not None
    
    def test_import_service_protocol(self):
        """Test importing Service protocol."""
        from protocols import ServiceProtocol
        assert ServiceProtocol is not None
    
    def test_import_all_protocols(self):
        """Test importing all protocols via __all__."""
        from protocols import __all__
        
        expected_protocols = [
            "LLMService",
            "LLMProvider",
            "EmbeddingService",
            "EmbeddingProvider",
            "EmbeddingCache",
            "AgentProtocol",
            "ServiceProtocol",
        ]
        
        for protocol in expected_protocols:
            assert protocol in __all__, f"{protocol} not in __all__"
    
    def test_no_circular_dependencies(self):
        """Test that protocols module has no circular dependencies."""
        # This test verifies the module can be imported without errors
        import protocols
        assert protocols is not None
        
        # Verify we can import from protocols without circular import
        from protocols.llm import LLMService, LLMProvider
        from protocols.embedding import EmbeddingService, EmbeddingProvider, EmbeddingCache
        from protocols.agent import AgentProtocol
        from protocols.service import ServiceProtocol
        
        # All imports should succeed
        assert all([
            LLMService, LLMProvider,
            EmbeddingService, EmbeddingProvider, EmbeddingCache,
            AgentProtocol, ServiceProtocol
        ])
