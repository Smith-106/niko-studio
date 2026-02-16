import pytest
from unittest.mock import MagicMock, patch
import sys
import os
import importlib.util
import types
from pathlib import Path

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src")))

# Import from the new utility module
from src.ui.file_utils import process_uploaded_file

class TestRagIntegration:
    def test_process_uploaded_file_success(self):
        # Setup mocks
        mock_file = MagicMock()
        mock_file.name = "test.txt"

        mock_indexing_service = MagicMock()

        # Mock DocumentLoader to return predictable text
        # Note: We are mocking src.ui.file_utils.DocumentLoader
        with patch("src.ui.file_utils.DocumentLoader") as mock_loader:
            # Return text that is short enough for one chunk
            mock_loader.load_file.return_value = "Short content."

            # Call function
            callback = MagicMock()
            num_chunks = process_uploaded_file(mock_file, "session123", mock_indexing_service, progress_callback=callback)

            # Verify DocumentLoader called
            mock_loader.load_file.assert_called_once_with(mock_file, "test.txt")

            # Verify IndexingService called
            assert mock_indexing_service.add_document.call_count == 1

            # Verify callback called
            callback.assert_called_once()

            # Verify arguments to add_document
            args, kwargs = mock_indexing_service.add_document.call_args
            assert kwargs["source_type"] == "uploaded_material"
            assert "session123_test.txt_part_0" == kwargs["doc_id"]
            assert kwargs["content"] == "Short content."

    def test_process_uploaded_file_chunking(self):
        # Test that splitting actually happens
        mock_file = MagicMock()
        mock_file.name = "test.md"

        mock_indexing_service = MagicMock()

        with patch("src.ui.file_utils.DocumentLoader") as mock_loader:
            # Create text larger than chunk size (1000)
            mock_loader.load_file.return_value = "1234567890" * 200

            num_chunks = process_uploaded_file(mock_file, "sess", mock_indexing_service)

            # Should be multiple chunks
            assert num_chunks > 1
            assert mock_indexing_service.add_document.call_count == num_chunks

    def test_process_uploaded_file_filename_sanitization(self):
        mock_file = MagicMock()
        mock_file.name = "Bad Name @!.txt"

        mock_indexing_service = MagicMock()

        with patch("src.ui.file_utils.DocumentLoader") as mock_loader:
            mock_loader.load_file.return_value = "content"

            process_uploaded_file(mock_file, "sess", mock_indexing_service)

            # Check doc_id in call args
            args, kwargs = mock_indexing_service.add_document.call_args
            doc_id = kwargs["doc_id"]

            # Should not contain @ or !
            assert "@" not in doc_id
            assert "!" not in doc_id
            assert "Bad_Name_.txt" in doc_id


def test_file_utils_importerror_fallback(monkeypatch):
    module_path = Path(__file__).resolve().parents[2] / "src" / "ui" / "file_utils.py"
    module_name = "src.ui.file_utils_import_fallback_test"

    fake_splitter_module = types.ModuleType("langchain.text_splitter")

    class _FallbackSplitter:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def split_text(self, text):
            return [text]

    fake_splitter_module.RecursiveCharacterTextSplitter = _FallbackSplitter
    monkeypatch.setitem(sys.modules, "langchain.text_splitter", fake_splitter_module)

    fake_document_loader_module = types.ModuleType("src.services.document_loader")

    class _DocLoader:
        @staticmethod
        def load_file(_uploaded_file, _filename):
            return "fallback text"

    fake_document_loader_module.DocumentLoader = _DocLoader
    monkeypatch.setitem(sys.modules, "src.services.document_loader", fake_document_loader_module)

    fake_indexing_module = types.ModuleType("src.services.indexing_service")

    class _IndexingService:
        pass

    fake_indexing_module.IndexingService = _IndexingService
    monkeypatch.setitem(sys.modules, "src.services.indexing_service", fake_indexing_module)

    original_import = __import__
    state = {"raised": False}

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "langchain_text_splitters" and not state["raised"]:
            state["raised"] = True
            raise ImportError("simulated missing langchain_text_splitters")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr("builtins.__import__", fake_import)

    sys.modules.pop(module_name, None)
    try:
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)

        assert state["raised"] is True
        assert module.RecursiveCharacterTextSplitter is _FallbackSplitter
    finally:
        sys.modules.pop(module_name, None)
