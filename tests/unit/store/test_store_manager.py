# -*- coding: utf-8 -*-
"""
StoreManager Tests

Tests for DocumentFormat, Document, StoreManager CRUD operations,
stats, chunking, search, batch operations, OpenKL integration stubs.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from datetime import datetime

from src.store.store_manager import (
    DocumentFormat,
    Document,
    StoreManager,
)


# ============================================================
# DocumentFormat
# ============================================================

class TestDocumentFormat:

    def test_values(self):
        assert DocumentFormat.MARKDOWN.value == "markdown"
        assert DocumentFormat.PLAIN_TEXT.value == "plain_text"
        assert DocumentFormat.JSON.value == "json"
        assert DocumentFormat.YAML.value == "yaml"
        assert DocumentFormat.PDF.value == "pdf"
        assert DocumentFormat.DOCX.value == "docx"

    def test_from_extension(self):
        assert DocumentFormat.from_extension(".md") == DocumentFormat.MARKDOWN
        assert DocumentFormat.from_extension("txt") == DocumentFormat.PLAIN_TEXT
        assert DocumentFormat.from_extension(".json") == DocumentFormat.JSON
        assert DocumentFormat.from_extension("yaml") == DocumentFormat.YAML
        assert DocumentFormat.from_extension(".yml") == DocumentFormat.YAML
        assert DocumentFormat.from_extension(".pdf") == DocumentFormat.PDF
        assert DocumentFormat.from_extension(".docx") == DocumentFormat.DOCX

    def test_from_extension_unknown(self):
        assert DocumentFormat.from_extension(".xyz") == DocumentFormat.PLAIN_TEXT

    def test_extension_property(self):
        assert DocumentFormat.MARKDOWN.extension == ".md"
        assert DocumentFormat.PLAIN_TEXT.extension == ".txt"
        assert DocumentFormat.JSON.extension == ".json"
        assert DocumentFormat.PDF.extension == ".pdf"

    def test_is_binary(self):
        assert DocumentFormat.PDF.is_binary is True
        assert DocumentFormat.DOCX.is_binary is True
        assert DocumentFormat.MARKDOWN.is_binary is False
        assert DocumentFormat.JSON.is_binary is False


# ============================================================
# Document
# ============================================================

class TestDocument:

    def test_basic(self):
        doc = Document(
            id="d1",
            content="hello world",
            format=DocumentFormat.MARKDOWN,
        )
        assert doc.id == "d1"
        assert doc.format == DocumentFormat.MARKDOWN

    def test_chunk_count(self):
        doc = Document(
            id="d2",
            content="text",
            format=DocumentFormat.PLAIN_TEXT,
            chunks=[MagicMock(), MagicMock()],
        )
        assert doc.chunk_count == 2


# ============================================================
# StoreManager init
# ============================================================

class TestStoreManagerInit:

    def test_creates_directories(self, tmp_path):
        base = tmp_path / "writing"
        sm = StoreManager(base_path=str(base))
        assert (base / "store").exists()
        assert (base / "store" / "sources").exists()
        assert (base / "store" / "normalized").exists()

    def test_default_chunker(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "writing"))
        assert sm.chunker is not None


# ============================================================
# add_document
# ============================================================

class TestAddDocument:

    def test_add_from_string(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(
            path="test.md",
            content="# Hello\n\nWorld",
        )
        assert doc_id is not None
        assert sm.document_count == 1

    def test_add_from_file(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))

        source = tmp_path / "input.md"
        source.write_text("# Title\n\nContent here", encoding="utf-8")

        doc_id = sm.add_document(path=str(source), content=source.read_text(encoding="utf-8"))
        assert doc_id is not None
        assert sm.document_count == 1

    def test_add_with_metadata(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(
            path="meta.md",
            content="content",
            metadata={"author": "test"},
        )
        doc = sm.get_document(doc_id)
        assert doc.metadata["author"] == "test"

    def test_add_with_custom_id(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(
            path="custom.md",
            content="content",
            doc_id="my-custom-id",
        )
        assert doc_id == "my-custom-id"

    def test_add_json_format(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        data = json.dumps({"key": "value"})
        doc_id = sm.add_document(
            path="data.json",
            content=data,
        )
        doc = sm.get_document(doc_id)
        assert doc.format == DocumentFormat.JSON


# ============================================================
# get_document
# ============================================================

class TestGetDocument:

    def test_get_existing(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(path="test.md", content="content")
        doc = sm.get_document(doc_id)
        assert doc is not None
        assert doc.content == "content"

    def test_get_nonexistent(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc = sm.get_document("nonexistent")
        assert doc is None


# ============================================================
# delete_document
# ============================================================

class TestDeleteDocument:

    def test_delete_existing(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(path="del.md", content="to delete")
        assert sm.delete_document(doc_id) is True
        assert sm.document_count == 0

    def test_delete_nonexistent(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm.delete_document("nonexistent") is False


# ============================================================
# list_documents
# ============================================================

class TestListDocuments:

    def test_empty(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm.list_documents() == []

    def test_after_add(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="a")
        sm.add_document(path="b.md", content="b")
        docs = sm.list_documents()
        assert len(docs) == 2


# ============================================================
# update_document
# ============================================================

class TestUpdateDocument:

    def test_update_content(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(path="upd.md", content="old")
        sm.update_document(doc_id, content="new")
        doc = sm.get_document(doc_id)
        assert doc.content == "new"

    def test_update_nonexistent(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        result = sm.update_document("nonexistent", content="x")
        assert result is False


# ============================================================
# stats
# ============================================================

class TestStats:

    def test_stats(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="text " * 100)
        stats = sm.stats()
        assert stats["document_count"] == 1
        assert "format_counts" in stats
        assert "markdown" in stats["format_counts"]


# ============================================================
# search_chunks
# ============================================================

class TestSearchChunks:

    def test_search_basic(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="search.md", content="This is a unique searchable text. " * 50)
        results = sm.search_chunks("unique")
        assert len(results) >= 1
        assert results[0]["doc_id"] is not None

    def test_search_no_match(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="search.md", content="content")
        results = sm.search_chunks("nonexistent_term_xyz")
        assert len(results) == 0

    def test_search_limit(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="big.md", content="keyword appears here. " * 200)
        results = sm.search_chunks("keyword", limit=2)
        assert len(results) <= 2


# ============================================================
# rechunk_document
# ============================================================

class TestRechunkDocument:

    def test_rechunk(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        doc_id = sm.add_document(path="chunk.md", content="text " * 500)

        new_count = sm.rechunk_document(doc_id, chunk_size=100)
        assert new_count > 0

    def test_rechunk_nonexistent(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm.rechunk_document("nonexistent") == 0


# ============================================================
# properties
# ============================================================

class TestProperties:

    def test_document_count(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm.document_count == 0
        sm.add_document(path="a.md", content="a")
        assert sm.document_count == 1

    def test_total_chunks(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="text " * 500)
        assert sm.total_chunks > 0


# ============================================================
# _detect_format
# ============================================================

class TestDetectFormat:

    def test_markdown(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm._detect_format(Path("test.md")) == DocumentFormat.MARKDOWN

    def test_json(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm._detect_format(Path("data.json")) == DocumentFormat.JSON

    def test_yaml(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm._detect_format(Path("config.yaml")) == DocumentFormat.YAML
        assert sm._detect_format(Path("config.yml")) == DocumentFormat.YAML

    def test_pdf(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        assert sm._detect_format(Path("doc.pdf")) == DocumentFormat.PDF


# ============================================================
# _load_yaml_content
# ============================================================

class TestLoadYaml:

    def test_load_yaml(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text("key: value\nlist:\n  - a\n  - b\n", encoding="utf-8")

        content = sm._load_yaml_content(yaml_file)
        assert "key" in content
        assert "value" in content

    def test_load_yaml_no_module(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text("key: value", encoding="utf-8")

        with patch.dict("sys.modules", {"yaml": None}):
            content = sm._load_yaml_content(yaml_file)
            assert "key" in content


# ============================================================
# sync_with_openkl
# ============================================================

class TestSyncOpenKL:

    def test_sync(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="content")

        mock_contract = MagicMock()
        result = sm.sync_with_openkl(mock_contract)
        assert result["synced"] == 1
        assert result["total"] == 1

    def test_sync_error(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="content")

        mock_contract = MagicMock()
        mock_contract.ingest_content.side_effect = RuntimeError("fail")
        result = sm.sync_with_openkl(mock_contract)
        assert result["synced"] == 0
        assert len(result["errors"]) == 1


# ============================================================
# import_from_openkl
# ============================================================

class TestImportOpenKL:

    def test_import(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))

        mock_contract = MagicMock()
        mock_contract.iter_documents.return_value = [
            {"doc_id": "ok1", "content": "imported content", "path": "ok.md", "metadata": {}},
        ]

        count = sm.import_from_openkl(mock_contract)
        assert count == 1
        assert sm.document_count == 1

    def test_import_skip_existing(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="existing.md", content="existing", doc_id="existing")

        mock_contract = MagicMock()
        mock_contract.iter_documents.return_value = [
            {"doc_id": "existing", "content": "duplicate", "path": "dup.md", "metadata": {}},
        ]

        count = sm.import_from_openkl(mock_contract)
        assert count == 0


# ============================================================
# get_all_chunks
# ============================================================

class TestGetAllChunks:

    def test_all_chunks(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        sm.add_document(path="a.md", content="text " * 200)
        sm.add_document(path="b.md", content="more " * 200)

        chunks = sm.get_all_chunks()
        assert len(chunks) > 0

    def test_all_chunks_empty(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"))
        chunks = sm.get_all_chunks()
        assert chunks == []
