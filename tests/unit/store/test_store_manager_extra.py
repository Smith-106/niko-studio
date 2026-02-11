# -*- coding: utf-8 -*-
"""StoreManager extra tests - uncovered lines for yaml, binary, export, import_directory."""

import pytest
import json
from unittest.mock import MagicMock, patch
from pathlib import Path

from src.store.store_manager import StoreManager, Document, DocumentFormat


@pytest.fixture()
def store(tmp_path):
    return StoreManager(base_path=str(tmp_path / "store"))


class TestLoadYamlContent:
    def test_yaml_available(self, store, tmp_path):
        f = tmp_path / "test.yaml"
        f.write_text("key: value\nlist:\n  - a\n  - b\n", encoding="utf-8")
        content = store._load_yaml_content(f)
        assert "key" in content
        assert "value" in content

    def test_yaml_fallback(self, store, tmp_path):
        f = tmp_path / "test.yaml"
        f.write_text("raw: content\n", encoding="utf-8")
        with patch.dict("sys.modules", {"yaml": None}):
            with patch("builtins.__import__", side_effect=ImportError("no yaml")):
                # Fallback reads plain text
                content = store._load_yaml_content(f)
                assert "raw" in content


class TestLoadFileContent:
    def test_text_file(self, store, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("# Hello", encoding="utf-8")
        content = store._load_file_content(f)
        assert content == "# Hello"

    def test_yaml_file(self, store, tmp_path):
        f = tmp_path / "test.yaml"
        f.write_text("key: val\n", encoding="utf-8")
        content = store._load_file_content(f)
        assert "key" in content

    def test_pdf_dispatch(self, store, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"fake pdf")
        with patch.object(store, "_load_pdf_content", return_value="pdf text") as mock_pdf:
            content = store._load_file_content(f)
            mock_pdf.assert_called_once_with(f)
            assert content == "pdf text"

    def test_docx_dispatch(self, store, tmp_path):
        f = tmp_path / "test.docx"
        f.write_bytes(b"fake docx")
        with patch.object(store, "_load_docx_content", return_value="docx text") as mock_docx:
            content = store._load_file_content(f)
            mock_docx.assert_called_once_with(f)
            assert content == "docx text"


class TestExportDocument:
    def test_export_existing(self, store, tmp_path):
        doc_id = store.add_document(path="test.md", content="hello world")
        out = tmp_path / "out.md"
        result = store.export_document(doc_id, out)
        assert result is True
        assert out.read_text(encoding="utf-8") == "hello world"

    def test_export_not_found(self, store, tmp_path):
        out = tmp_path / "out.md"
        result = store.export_document("nonexistent", out)
        assert result is False

    def test_export_normalized(self, store, tmp_path):
        doc_id = store.add_document(path="test.md", content="hello world")
        # Write a normalized file
        norm_file = store.normalized_path / f"{doc_id}.ok.md"
        norm_file.parent.mkdir(parents=True, exist_ok=True)
        norm_file.write_text("normalized content", encoding="utf-8")

        out = tmp_path / "out.md"
        result = store.export_document(doc_id, out, normalized=True)
        assert result is True
        assert out.read_text(encoding="utf-8") == "normalized content"


class TestImportBinaryFile:
    def test_file_not_found(self, store, tmp_path):
        with pytest.raises(FileNotFoundError):
            store.import_binary_file(tmp_path / "nonexistent.pdf")

    def test_import_text_binary(self, store, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("markdown content", encoding="utf-8")
        doc_id = store.import_binary_file(f)
        doc = store.get_document(doc_id)
        assert doc is not None
        assert "markdown content" in doc.content

    def test_import_pdf_binary(self, store, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"fake pdf")
        with patch.object(store, "_load_file_content", return_value="extracted pdf text"):
            doc_id = store.import_binary_file(f)
            doc = store.get_document(doc_id)
            assert doc is not None


class TestImportDirectory:
    def test_not_a_directory(self, store, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("x", encoding="utf-8")
        with pytest.raises(ValueError):
            store.import_directory(f)

    def test_recursive(self, store, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("aaa", encoding="utf-8")
        sub = d / "sub"
        sub.mkdir()
        (sub / "b.md").write_text("bbb", encoding="utf-8")

        result = store.import_directory(d, recursive=True, extensions=[".md"])
        assert result["imported"] == 2
        assert result["total_files"] == 2

    def test_non_recursive(self, store, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("aaa", encoding="utf-8")
        sub = d / "sub"
        sub.mkdir()
        (sub / "b.md").write_text("bbb", encoding="utf-8")

        result = store.import_directory(d, recursive=False, extensions=[".md"])
        assert result["imported"] == 1
        assert result["total_files"] == 1

    def test_import_error_handling(self, store, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("aaa", encoding="utf-8")

        with patch.object(store, "import_file", side_effect=RuntimeError("fail")):
            result = store.import_directory(d, extensions=[".md"])
            assert result["imported"] == 0
            assert len(result["errors"]) == 1


class TestLoadPdfContent:
    def test_no_pypdf(self, store, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"fake")
        with patch.dict("sys.modules", {"pypdf": None}):
            with pytest.raises(ImportError, match="pypdf"):
                store._load_pdf_content(f)


class TestLoadDocxContent:
    def test_no_docx(self, store, tmp_path):
        f = tmp_path / "test.docx"
        f.write_bytes(b"fake")
        with patch.dict("sys.modules", {"docx": None}):
            with pytest.raises(ImportError, match="python-docx"):
                store._load_docx_content(f)
