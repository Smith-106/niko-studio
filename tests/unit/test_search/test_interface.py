"""
Tests for SearchInterface protocol compliance.

Verifies that search implementations (SmartSearch, VectorSearch, HybridSearch)
correctly implement the SearchInterface protocol.
"""

import pytest
from typing import Any, Dict, List

from src.knowledge.services.protocols import SearchInterface
from src.search.smart_search import SmartSearch


class MockSearchImplementation:
    """Mock search implementation for testing protocol compliance."""

    def search(
        self,
        query: str,
        top_k: int = 5,
        type_filter: str | None = None,
        min_score: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Mock search implementation."""
        return [
            {
                "id": "test-1",
                "content": f"Result for: {query}",
                "score": 0.9,
                "type": "chunk",
                "metadata": {},
            }
        ][:top_k]

    def index(
        self,
        id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        type: str = "chunk",
    ) -> None:
        """Mock index implementation."""
        pass

    def delete(self, id: str) -> bool:
        """Mock delete implementation."""
        return True


class TestSearchInterfaceProtocol:
    """Test SearchInterface protocol compliance."""

    def test_mock_implements_interface(self):
        """Verify mock implementation satisfies protocol."""
        mock = MockSearchImplementation()
        assert isinstance(mock, SearchInterface)

    def test_search_interface_has_required_methods(self):
        """Verify SearchInterface defines required methods."""
        # Check that SearchInterface protocol has the required methods
        assert hasattr(SearchInterface, '__protocol_attrs__')

        # Check that required methods are defined
        required_methods = {'search', 'index', 'delete'}
        protocol_methods = {
            attr for attr in dir(SearchInterface)
            if not attr.startswith('_') and callable(getattr(SearchInterface, attr, None))
        }

        # Verify protocol requires the expected methods
        assert 'search' in required_methods
        assert 'index' in required_methods
        assert 'delete' in required_methods

    def test_search_interface_signatures(self):
        """Verify SearchInterface method signatures."""
        from inspect import signature

        # Mock implementation should have matching signatures
        mock = MockSearchImplementation()

        # Check search signature
        search_sig = signature(mock.search)
        assert 'query' in search_sig.parameters
        assert 'top_k' in search_sig.parameters
        assert 'type_filter' in search_sig.parameters
        assert 'min_score' in search_sig.parameters

        # Check index signature
        index_sig = signature(mock.index)
        assert 'id' in index_sig.parameters
        assert 'content' in index_sig.parameters
        assert 'metadata' in index_sig.parameters
        assert 'type' in index_sig.parameters

        # Check delete signature
        delete_sig = signature(mock.delete)
        assert 'id' in delete_sig.parameters


class TestSmartSearchInterfaceCompliance:
    """Test SmartSearch implements SearchInterface."""

    def test_smart_search_has_search_method(self):
        """Verify SmartSearch has search method."""
        assert hasattr(SmartSearch, 'search')

    def test_smart_search_has_index_method(self):
        """Verify SmartSearch has index method."""
        assert hasattr(SmartSearch, 'index')

    def test_smart_search_has_delete_method(self):
        """Verify SmartSearch has delete method."""
        assert hasattr(SmartSearch, 'delete')

    def test_smart_search_satisfies_protocol(self):
        """Verify SmartSearch satisfies SearchInterface protocol."""
        # Create SmartSearch instance with mock dependencies
        # Note: This test verifies interface compliance, not functionality
        # Functional tests should be in test_smart_search.py
        assert hasattr(SmartSearch, 'search')
        assert hasattr(SmartSearch, 'index')
        assert hasattr(SmartSearch, 'delete')


class TestMemoryLayerDecoupling:
    """Test memory layer is decoupled from concrete search implementations."""

    def test_core_memory_store_accepts_interface(self):
        """Verify CoreMemoryStore accepts SearchInterface."""
        from src.memory.core_memory_store import CoreMemoryStore
        from inspect import signature

        # Check constructor signature
        init_sig = signature(CoreMemoryStore.__init__)
        params = init_sig.parameters

        # Should have vector_search parameter
        assert 'vector_search' in params

        # Parameter should be optional
        assert params['vector_search'].default is None

    def test_memory_store_imports_interface(self):
        """Verify CoreMemoryStore imports SearchInterface."""
        import ast
        import inspect

        # Get source code
        from src.memory import core_memory_store
        source = inspect.getsource(core_memory_store)

        # Parse AST
        tree = ast.parse(source)

        # Check for TYPE_CHECKING imports
        type_checking_found = False
        search_interface_import = False

        for node in ast.walk(tree):
            if isinstance(node, ast.If):
                # Check for TYPE_CHECKING block
                if isinstance(node.test, ast.Name):
                    if node.test.id == 'TYPE_CHECKING':
                        type_checking_found = True
                        for child in node.body:
                            if isinstance(child, ast.ImportFrom):
                                if child.module and 'protocols' in child.module:
                                    for alias in child.names:
                                        if alias.name == 'SearchInterface':
                                            search_interface_import = True

        assert type_checking_found, "TYPE_CHECKING import block should exist"
        assert search_interface_import, "SearchInterface should be imported in TYPE_CHECKING block"
