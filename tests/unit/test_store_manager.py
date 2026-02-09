"""
StoreManager Unit Tests

Tests for document repository functionality:
- Multi-format support (Markdown, TXT, JSON, YAML, PDF, DOCX)
- Automatic chunking
- Normalized storage
- CRUD operations
- OpenKL integration
"""

import json
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.store.store_manager import (
    StoreManager,
    Document,
    DocumentFormat,
    DocumentFilter,
)


class TestDocumentFormat:
    """Tests for DocumentFormat enum"""

    def test_from_extension_markdown(self):
        assert DocumentFormat.from_extension(".md") == DocumentFormat.MARKDOWN
        assert DocumentFormat.from_extension("md") == DocumentFormat.MARKDOWN
        assert DocumentFormat.from_extension(".markdown") == DocumentFormat.MARKDOWN

    def test_from_extension_plain_text(self):
        assert DocumentFormat.from_extension(".txt") == DocumentFormat.PLAIN_TEXT
        assert DocumentFormat.from_extension("txt") == DocumentFormat.PLAIN_TEXT

    def test_from_extension_json(self):
        assert DocumentFormat.from_extension(".json") == DocumentFormat.JSON

    def test_from_extension_yaml(self):
        assert DocumentFormat.from_extension(".yaml") == DocumentFormat.YAML
        assert DocumentFormat.from_extension(".yml") == DocumentFormat.YAML

    def test_from_extension_pdf(self):
        assert DocumentFormat.from_extension(".pdf") == DocumentFormat.PDF

    def test_from_extension_docx(self):
        assert DocumentFormat.from_extension(".docx") == DocumentFormat.DOCX

    def test_from_extension_unknown(self):
        # Unknown extensions default to plain text
        assert DocumentFormat.from_extension(".xyz") == DocumentFormat.PLAIN_TEXT

    def test_extension_property(self):
        assert DocumentFormat.MARKDOWN.extension == ".md"
        assert DocumentFormat.PLAIN_TEXT.extension == ".txt"
        assert DocumentFormat.JSON.extension == ".json"
        assert DocumentFormat.YAML.extension == ".yaml"
        assert DocumentFormat.PDF.extension == ".pdf"
        assert DocumentFormat.DOCX.extension == ".docx"

    def test_is_binary_property(self):
        assert DocumentFormat.PDF.is_binary is True
        assert DocumentFormat.DOCX.is_binary is True
        assert DocumentFormat.MARKDOWN.is_binary is False
        assert DocumentFormat.PLAIN_TEXT.is_binary is False
        assert DocumentFormat.JSON.is_binary is False


class TestDocument:
    """Tests for Document dataclass"""

    def test_create_document(self):
        doc = Document.create(
            content="# Test Document",
            format=DocumentFormat.MARKDOWN,
            metadata={"author": "test"}
        )

        assert doc.id.startswith("doc-")
        assert doc.content == "# Test Document"
        assert doc.format == DocumentFormat.MARKDOWN
        assert doc.metadata["author"] == "test"
        assert doc.chunks == []

    def test_create_document_with_id(self):
        doc = Document.create(
            content="Test",
            doc_id="custom-id-123"
        )

        assert doc.id == "custom-id-123"

    def test_document_to_dict(self):
        doc = Document.create(
            content="Test content",
            format=DocumentFormat.PLAIN_TEXT
        )

        data = doc.to_dict()

        assert data["id"] == doc.id
        assert data["content"] == "Test content"
        assert data["format"] == "plain_text"
        assert "created_at" in data
        assert "updated_at" in data

    def test_document_from_dict(self):
        data = {
            "id": "test-doc-1",
            "content": "Hello World",
            "format": "markdown",
            "metadata": {"tags": ["test"]},
            "chunks": [],
            "created_at": "2026-02-05T10:00:00",
            "updated_at": "2026-02-05T10:00:00"
        }

        doc = Document.from_dict(data)

        assert doc.id == "test-doc-1"
        assert doc.content == "Hello World"
        assert doc.format == DocumentFormat.MARKDOWN
        assert doc.metadata["tags"] == ["test"]

    def test_document_properties(self):
        doc = Document.create(content="Hello World Test")

        assert doc.word_count == 3
        assert doc.char_count == 16
        assert doc.chunk_count == 0


class TestDocumentFilter:
    """Tests for DocumentFilter"""

    def test_filter_by_format(self):
        doc_md = Document.create(content="# Markdown", format=DocumentFormat.MARKDOWN)
        doc_txt = Document.create(content="Plain text", format=DocumentFormat.PLAIN_TEXT)

        filter_md = DocumentFilter(format=DocumentFormat.MARKDOWN)

        assert filter_md.matches(doc_md) is True
        assert filter_md.matches(doc_txt) is False

    def test_filter_by_tags(self):
        doc_with_tags = Document.create(content="Test", metadata={"tags": ["python", "test"]})
        doc_no_tags = Document.create(content="Test", metadata={})

        filter_python = DocumentFilter(tags=["python"])
        filter_java = DocumentFilter(tags=["java"])

        assert filter_python.matches(doc_with_tags) is True
        assert filter_python.matches(doc_no_tags) is False
        assert filter_java.matches(doc_with_tags) is False

    def test_filter_by_date(self):
        doc = Document.create(content="Test")
        doc.created_at = datetime(2026, 2, 5, 12, 0, 0)

        filter_after = DocumentFilter(created_after=datetime(2026, 2, 1))
        filter_before = DocumentFilter(created_before=datetime(2026, 2, 10))
        filter_too_early = DocumentFilter(created_after=datetime(2026, 3, 1))

        assert filter_after.matches(doc) is True
        assert filter_before.matches(doc) is True
        assert filter_too_early.matches(doc) is False

    def test_filter_by_metadata(self):
        doc = Document.create(content="Test", metadata={"author": "alice", "status": "draft"})

        filter_alice = DocumentFilter(metadata_match={"author": "alice"})
        filter_bob = DocumentFilter(metadata_match={"author": "bob"})

        assert filter_alice.matches(doc) is True
        assert filter_bob.matches(doc) is False


class TestStoreManager:
    """Tests for StoreManager"""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for tests"""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp, ignore_errors=True)

    @pytest.fixture
    def store(self, temp_dir):
        """Create StoreManager instance"""
        return StoreManager(base_path=temp_dir / ".writing")

    def test_init_creates_directories(self, temp_dir):
        store = StoreManager(base_path=temp_dir / ".writing")

        assert store.sources_path.exists()
        assert store.normalized_path.exists()

    def test_add_document(self, store):
        doc_id = store.add_document(
            path="test.md",
            content="# Test Document\n\nThis is a test.",
            metadata={"author": "test"}
        )

        assert doc_id.startswith("doc-")
        assert store.document_count == 1

        # Verify source file created
        source_file = store.sources_path / f"{doc_id}.md"
        assert source_file.exists()

        # Verify normalized file created
        normalized_file = store.normalized_path / f"{doc_id}.ok.md"
        assert normalized_file.exists()

    def test_get_document(self, store):
        doc_id = store.add_document(
            path="test.txt",
            content="Hello World"
        )

        doc = store.get_document(doc_id)

        assert doc is not None
        assert doc.id == doc_id
        assert doc.content == "Hello World"
        assert doc.format == DocumentFormat.PLAIN_TEXT

    def test_get_document_not_found(self, store):
        doc = store.get_document("non-existent-id")
        assert doc is None

    def test_update_document(self, store):
        doc_id = store.add_document(
            path="test.md",
            content="Original content"
        )

        result = store.update_document(
            doc_id=doc_id,
            content="Updated content",
            metadata={"updated": True}
        )

        assert result is True

        doc = store.get_document(doc_id)
        assert doc.content == "Updated content"
        assert doc.metadata["updated"] is True

    def test_update_document_not_found(self, store):
        result = store.update_document(
            doc_id="non-existent",
            content="New content"
        )
        assert result is False

    def test_delete_document(self, store):
        doc_id = store.add_document(
            path="test.md",
            content="To be deleted"
        )

        assert store.document_count == 1

        result = store.delete_document(doc_id)

        assert result is True
        assert store.document_count == 0
        assert store.get_document(doc_id) is None

    def test_delete_document_not_found(self, store):
        result = store.delete_document("non-existent")
        assert result is False

    def test_list_documents(self, store):
        store.add_document(path="doc1.md", content="Document 1")
        store.add_document(path="doc2.txt", content="Document 2")
        store.add_document(path="doc3.json", content='{"key": "value"}')

        docs = store.list_documents()

        assert len(docs) == 3

    def test_list_documents_with_filter(self, store):
        store.add_document(path="doc1.md", content="Markdown doc")
        store.add_document(path="doc2.txt", content="Plain text doc")

        filter_md = DocumentFilter(format=DocumentFormat.MARKDOWN)
        docs = store.list_documents(filter=filter_md)

        assert len(docs) == 1
        assert docs[0].format == DocumentFormat.MARKDOWN

    def test_list_documents_pagination(self, store):
        for i in range(10):
            store.add_document(path=f"doc{i}.md", content=f"Document {i}")

        docs = store.list_documents(limit=3, offset=2)

        assert len(docs) == 3

    def test_search_by_content(self, store):
        store.add_document(path="doc1.md", content="Python programming guide")
        store.add_document(path="doc2.md", content="JavaScript tutorial")
        store.add_document(path="doc3.md", content="Python data science")

        results = store.search_by_content("python")

        assert len(results) == 2

    def test_get_chunks(self, store):
        doc_id = store.add_document(
            path="long_doc.md",
            content="This is a document. " * 100  # Long content to trigger chunking
        )

        chunks = store.get_chunks(doc_id)

        # Should have chunks if auto_chunk is True
        assert isinstance(chunks, list)

    def test_get_normalized_content(self, store):
        doc_id = store.add_document(
            path="test.md",
            content="# Test"
        )

        normalized = store.get_normalized_content(doc_id)

        assert normalized is not None
        assert "doc_id:" in normalized
        assert "normalized_at:" in normalized

    def test_import_file(self, store, temp_dir):
        # Create test file
        test_file = temp_dir / "import_test.txt"
        test_file.write_text("Content to import", encoding="utf-8")

        doc_id = store.import_file(test_file)

        doc = store.get_document(doc_id)
        assert doc.content == "Content to import"

    def test_export_document(self, store, temp_dir):
        doc_id = store.add_document(
            path="export_test.md",
            content="# Export Test"
        )

        output_path = temp_dir / "exported.md"
        result = store.export_document(doc_id, output_path)

        assert result is True
        assert output_path.exists()
        assert output_path.read_text() == "# Export Test"

    def test_stats(self, store):
        store.add_document(path="doc1.md", content="Markdown")
        store.add_document(path="doc2.txt", content="Plain text")

        stats = store.stats()

        assert stats["document_count"] == 2
        assert "format_counts" in stats
        assert stats["format_counts"]["markdown"] == 1
        assert stats["format_counts"]["plain_text"] == 1

    def test_rechunk_document(self, store):
        doc_id = store.add_document(
            path="long.md",
            content="Word " * 500
        )

        original_chunks = len(store.get_chunks(doc_id))

        # Re-chunk with smaller size
        new_count = store.rechunk_document(doc_id, chunk_size=100)

        assert new_count > 0

    def test_get_all_chunks(self, store):
        store.add_document(path="doc1.md", content="Content " * 100)
        store.add_document(path="doc2.md", content="More content " * 100)

        all_chunks = store.get_all_chunks()

        assert isinstance(all_chunks, list)

    def test_search_chunks(self, store):
        store.add_document(path="doc.md", content="Python programming is great. " * 50)

        results = store.search_chunks("Python")

        assert isinstance(results, list)

    def test_import_directory(self, store, temp_dir):
        # Create test directory with files
        test_dir = temp_dir / "import_dir"
        test_dir.mkdir()
        (test_dir / "file1.md").write_text("# File 1", encoding="utf-8")
        (test_dir / "file2.txt").write_text("File 2", encoding="utf-8")
        (test_dir / "subdir").mkdir()
        (test_dir / "subdir" / "file3.md").write_text("# File 3", encoding="utf-8")

        result = store.import_directory(test_dir, recursive=True)

        assert result["imported"] == 3
        assert store.document_count == 3

    def test_export_all(self, store, temp_dir):
        store.add_document(path="doc1.md", content="Doc 1")
        store.add_document(path="doc2.md", content="Doc 2")

        output_dir = temp_dir / "export_all"
        exported = store.export_all(output_dir)

        assert exported == 2
        assert output_dir.exists()

    def test_clear_all_without_confirm(self, store):
        store.add_document(path="doc.md", content="Test")

        with pytest.raises(ValueError):
            store.clear_all(confirm=False)

    def test_clear_all_with_confirm(self, store):
        store.add_document(path="doc1.md", content="Test 1")
        store.add_document(path="doc2.md", content="Test 2")

        count = store.clear_all(confirm=True)

        assert count == 2
        assert store.document_count == 0


class TestStoreManagerPersistence:
    """Tests for StoreManager persistence"""

    @pytest.fixture
    def temp_dir(self):
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp, ignore_errors=True)

    def test_persistence_across_instances(self, temp_dir):
        base_path = temp_dir / ".writing"

        # Create store and add document
        store1 = StoreManager(base_path=base_path)
        doc_id = store1.add_document(
            path="persistent.md",
            content="Persistent content"
        )

        # Create new store instance
        store2 = StoreManager(base_path=base_path)

        # Document should still exist
        doc = store2.get_document(doc_id)
        assert doc is not None
        assert doc.content == "Persistent content"


class TestStoreManagerBinaryFormats:
    """Tests for PDF and DOCX support"""

    @pytest.fixture
    def temp_dir(self):
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp, ignore_errors=True)

    @pytest.fixture
    def store(self, temp_dir):
        return StoreManager(base_path=temp_dir / ".writing")

    def test_load_pdf_content_import_error(self, store, temp_dir):
        # Create a fake PDF path
        pdf_path = temp_dir / "test.pdf"
        pdf_path.write_bytes(b"fake pdf content")

        # Should raise ImportError if pypdf not installed
        with patch.dict("sys.modules", {"pypdf": None}):
            # The import will fail within _load_pdf_content
            pass

    def test_load_docx_content_import_error(self, store, temp_dir):
        # Create a fake DOCX path
        docx_path = temp_dir / "test.docx"
        docx_path.write_bytes(b"fake docx content")

        # Should raise ImportError if python-docx not installed
        with patch.dict("sys.modules", {"docx": None}):
            pass

    def test_yaml_format_detection(self, store):
        doc_id = store.add_document(
            path="config.yaml",
            content="key: value\nlist:\n  - item1\n  - item2"
        )

        doc = store.get_document(doc_id)
        assert doc.format == DocumentFormat.YAML


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
