# -*- coding: utf-8 -*-
"""
Root-level shared test fixtures.

Provides make_mock_llm factory for all test modules that need
to test LLM-dependent code paths.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from dataclasses import dataclass


@dataclass
class MockLLMResponse:
    """Mimics LLM response with .content attribute."""
    content: str


def make_mock_llm(response_content: str = "{}"):
    """
    Factory: create a mock LLM whose ainvoke() returns
    a MockLLMResponse with the given content string.
    """
    mock = MagicMock()
    mock.ainvoke = AsyncMock(return_value=MockLLMResponse(content=response_content))
    return mock
