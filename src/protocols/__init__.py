"""
Shared Protocols Module

This module provides shared protocol definitions for the application layer.
Protocols define interfaces using structural subtyping (duck typing) for:
- LLM services and providers
- Embedding services and providers  
- Agent abstractions
- Service layer abstractions

Migration Note:
    These protocols are extracted from src/knowledge/services/protocols.py
    to enable clean TypeScript interface migration and resolve circular
    dependencies between services and agents layers.

Version: 1.0.0
Deprecation Policy: Protocols are stable interfaces. Breaking changes require
                    migration path and deprecation warnings for 2 releases.
"""

from .llm import (
    LLMProvider,
    LLMService,
)

from .embedding import (
    EmbeddingCache,
    EmbeddingProvider,
    EmbeddingService,
)

from .agent import (
    AgentProtocol,
)

from .service import (
    ServiceProtocol,
)

__all__ = [
    # LLM Protocols
    "LLMService",
    "LLMProvider",
    # Embedding Protocols
    "EmbeddingService",
    "EmbeddingProvider",
    "EmbeddingCache",
    # Agent Protocol
    "AgentProtocol",
    # Service Protocol
    "ServiceProtocol",
]

__version__ = "1.0.0"
