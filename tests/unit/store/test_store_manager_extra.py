# -*- coding: utf-8 -*-
"""StoreManager extra tests - uncovered lines for yaml, binary, export, import_directory."""

import pytest
import json
import builtins
import importlib
from datetime import datetime
from unittest.mock import MagicMock, patch
from pathlib import Path

from src.store.store_manager import StoreManager, Document, DocumentFormat, DocumentFilter


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

    def test_pdf_extract_empty_pages_returns_empty_string(self, store, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"fake")

        page1 = MagicMock()
        page1.extract_text.return_value = None
        page2 = MagicMock()
        page2.extract_text.return_value = ""
        fake_reader = MagicMock()
        fake_reader.pages = [page1, page2]
        fake_pypdf = MagicMock()
        fake_pypdf.PdfReader.return_value = fake_reader

        with patch.dict("sys.modules", {"pypdf": fake_pypdf}):
            assert store._load_pdf_content(f) == ""


class TestLoadDocxContent:
    def test_no_docx(self, store, tmp_path):
        f = tmp_path / "test.docx"
        f.write_bytes(b"fake")
        with patch.dict("sys.modules", {"docx": None}):
            with pytest.raises(ImportError, match="python-docx"):
                store._load_docx_content(f)

    def test_docx_filters_blank_paragraphs(self, store, tmp_path):
        f = tmp_path / "test.docx"
        f.write_bytes(b"fake")

        p1 = MagicMock(text="line 1")
        p2 = MagicMock(text="   ")
        p3 = MagicMock(text="line 2")
        fake_doc = MagicMock(paragraphs=[p1, p2, p3])
        fake_docx = MagicMock()
        fake_docx.Document.return_value = fake_doc

        with patch.dict("sys.modules", {"docx": fake_docx}):
            assert store._load_docx_content(f) == "line 1\n\nline 2"



class TestDocumentFromDictBranches:
    def test_from_dict_defaults_created_updated_and_format_passthrough(self):
        fmt = DocumentFormat.MARKDOWN
        doc = Document.from_dict(
            {
                "id": "d-1",
                "content": "abc",
                "format": fmt,
                "metadata": {},
                "chunks": [],
                "created_at": None,
                "updated_at": None,
            }
        )

        assert doc.format == fmt
        assert doc.created_at is not None
        assert doc.updated_at is not None

    def test_from_dict_format_non_string_passthrough_branch(self):
        doc = Document.from_dict(
            {
                "id": "d-1b",
                "content": "abc",
                "format": 123,
                "metadata": {},
                "chunks": [],
                "created_at": None,
                "updated_at": None,
            }
        )

        assert doc.format == 123

class TestStoreManagerIndexErrorBranches:
    def test_load_index_logs_document_parse_error(self, tmp_path):
        base = tmp_path / "store"
        sm = StoreManager(base_path=str(base))
        sm.index_path.write_text(
            json.dumps(
                {
                    "documents": [
                        {"id": "bad-1", "content": "x", "format": "unknown-format"}
                    ]
                }
            ),
            encoding="utf-8",
        )

        sm._documents.clear()
        sm._load_index()

        assert sm.document_count == 0

    def test_load_index_logs_outer_error(self, store):
        with patch("src.store.store_manager.open", side_effect=OSError("read fail")):
            store._load_index()
        assert isinstance(store._documents, dict)

    def test_save_index_logs_error(self, store):
        with patch("src.store.store_manager.open", side_effect=OSError("write fail")):
            store._save_index()
        assert isinstance(store._documents, dict)


class TestStoreManagerMissBranches:
    def test_get_chunks_missing_returns_empty(self, store):
        assert store.get_chunks("missing") == []

    def test_get_normalized_content_missing_returns_none(self, store):
        assert store.get_normalized_content("missing") is None

    def test_import_file_not_found_raises(self, store, tmp_path):
        with pytest.raises(FileNotFoundError):
            store.import_file(tmp_path / "not-found.md")

    def test_search_by_content_respects_limit_break(self, store):
        for i in range(5):
            store.add_document(path=f"k-{i}.md", content="keyword")

        results = store.search_by_content("keyword", limit=2)
        assert len(results) == 2


class TestBatchBranches:
    def test_import_directory_binary_branch(self, store, tmp_path):
        docs = tmp_path / "docs"
        docs.mkdir()
        pdf = docs / "a.pdf"
        pdf.write_bytes(b"fake")

        with patch.object(store, "import_binary_file", return_value="doc-pdf") as binary_mock:
            result = store.import_directory(docs, recursive=False, extensions=[".pdf"])

        assert result["imported"] == 1
        binary_mock.assert_called_once_with(pdf)

    def test_import_directory_accumulates_binary_errors(self, store, tmp_path):
        docs = tmp_path / "docs"
        docs.mkdir()
        pdf = docs / "a.pdf"
        pdf.write_bytes(b"fake")

        with patch.object(store, "import_binary_file", side_effect=RuntimeError("binary fail")):
            result = store.import_directory(docs, recursive=False, extensions=[".pdf"])

        assert result["imported"] == 0
        assert result["total_files"] == 1
        assert len(result["errors"]) == 1
        assert result["errors"][0]["file"].endswith("a.pdf")

    def test_export_all_filter_skip(self, store, tmp_path):
        d1 = store.add_document(path="a.md", content="a", metadata={"kind": "x"})
        _d2 = store.add_document(path="b.md", content="b", metadata={"kind": "y"})

        filter_x = MagicMock()
        filter_x.matches.side_effect = lambda doc: doc.metadata.get("kind") == "x"

        with patch.object(store, "export_document", wraps=store.export_document) as export_mock:
            count = store.export_all(tmp_path / "out", filter=filter_x)

        assert count == 1
        called_doc_ids = [call.args[0] for call in export_mock.call_args_list]
        assert d1 in called_doc_ids

    def test_export_all_skips_failed_export(self, store, tmp_path):
        d1 = store.add_document(path="a.md", content="a")
        d2 = store.add_document(path="b.md", content="b")

        def _fake_export(doc_id, output_path, normalized=False):
            return doc_id == d1

        with patch.object(store, "export_document", side_effect=_fake_export):
            count = store.export_all(tmp_path / "out")



class TestStoreManagerAdditionalCoverage:
    def test_document_from_dict_parses_string_timestamps(self):
        now = datetime.now().replace(microsecond=0)
        data = {
            "id": "d-2",
            "content": "abc",
            "format": "markdown",
            "metadata": {},
            "chunks": [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        doc = Document.from_dict(data)
        assert doc.created_at == now
        assert doc.updated_at == now

    def test_document_word_and_char_count(self):
        doc = Document.create(content="hello world")
        assert doc.word_count == 2
        assert doc.char_count == len("hello world")

    def test_document_filter_matches_all_branches(self):
        now = datetime.now()
        doc = Document.create(
            content="x",
            format=DocumentFormat.MARKDOWN,
            metadata={"tags": ["a"], "k": "v"},
        )
        doc.created_at = now

        assert DocumentFilter(format=DocumentFormat.JSON).matches(doc) is False
        assert DocumentFilter(tags=["b"]).matches(doc) is False
        assert DocumentFilter(created_after=now.replace(year=now.year + 1)).matches(doc) is False
        assert DocumentFilter(created_before=now.replace(year=now.year - 1)).matches(doc) is False
        assert DocumentFilter(metadata_match={"k": "no"}).matches(doc) is False
        assert DocumentFilter(
            format=DocumentFormat.MARKDOWN,
            tags=["a"],
            created_after=now.replace(second=max(now.second - 1, 0)),
            created_before=now.replace(second=min(now.second + 1, 59)),
            metadata_match={"k": "v"},
        ).matches(doc) is True

    def test_load_index_success_branch_loads_document(self, tmp_path):
        base = tmp_path / "store"
        sm = StoreManager(base_path=str(base))
        sm.index_path.write_text(
            json.dumps(
                {
                    "documents": [
                        {
                            "id": "ok-1",
                            "content": "ok",
                            "format": "markdown",
                            "metadata": {},
                            "chunks": [],
                            "created_at": datetime.now().isoformat(),
                            "updated_at": datetime.now().isoformat(),
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

        sm._documents.clear()
        sm._load_index()
        assert "ok-1" in sm._documents

    def test_load_index_open_error_when_file_exists(self, store):
        store.index_path.write_text("{}", encoding="utf-8")
        with patch("src.store.store_manager.open", side_effect=OSError("read fail")):
            store._load_index()
        assert isinstance(store._documents, dict)

    def test_chunk_document_returns_empty_when_auto_chunk_disabled(self, tmp_path):
        sm = StoreManager(base_path=str(tmp_path / "store"), auto_chunk=False)
        doc = Document.create(content="abc")
        assert sm._chunk_document(doc) == []

    def test_update_document_merges_metadata(self, store):
        doc_id = store.add_document(path="meta.md", content="x", metadata={"a": 1})
        ok = store.update_document(doc_id, "y", metadata={"b": 2})
        assert ok is True
        assert store.get_document(doc_id).metadata["b"] == 2

    def test_list_documents_filter_continue_branch(self, store):
        store.add_document(path="a.md", content="x", metadata={"kind": "x"})
        docs = store.list_documents(filter=DocumentFilter(metadata_match={"kind": "y"}))
        assert docs == []

    def test_get_chunks_existing(self, store):
        doc_id = store.add_document(path="a.md", content="abc")
        assert isinstance(store.get_chunks(doc_id), list)

    def test_export_document_normalized_fallback_when_missing(self, store, tmp_path):
        doc_id = store.add_document(path="a.md", content="abc", normalize=False)
        out = tmp_path / "n.md"
        ok = store.export_document(doc_id, out, normalized=True)
        assert ok is True
        assert "doc_id:" in out.read_text(encoding="utf-8")

    def test_load_pdf_content_appends_non_empty_page(self, store, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"fake")

        page = MagicMock()
        page.extract_text.return_value = "hello"
        fake_reader = MagicMock()
        fake_reader.pages = [page]
        fake_pypdf = MagicMock()
        fake_pypdf.PdfReader.return_value = fake_reader

        with patch.dict("sys.modules", {"pypdf": fake_pypdf}):
            assert store._load_pdf_content(f) == "hello"

    def test_get_all_chunks_filter_continue_branch(self, store):
        store.add_document(path="a.md", content="x", metadata={"kind": "x"})
        chunks = store.get_all_chunks(filter=DocumentFilter(metadata_match={"kind": "y"}))
        assert chunks == []

    def test_import_directory_uses_default_extensions(self, store, tmp_path):
        docs = tmp_path / "docs"
        docs.mkdir()
        (docs / "a.md").write_text("aaa", encoding="utf-8")

        result = store.import_directory(docs, recursive=False, extensions=None)
        assert result["total_files"] >= 1
        assert result["imported"] >= 1

    def test_clear_all_requires_confirm_and_then_clears(self, store):
        store.add_document(path="a.md", content="a")
        store.add_document(path="b.md", content="b")

        with pytest.raises(ValueError):
            store.clear_all(confirm=False)

        deleted = store.clear_all(confirm=True)
        assert deleted == 2
        assert store.document_count == 0


class TestStoreManagerImportFallback:
    def test_fallback_import_branch_on_reload(self):
        import src.store.store_manager as sm

        original_import = builtins.__import__

        first_memory_import = {"raised": False}

        def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "memory.memory_chunk" and not first_memory_import["raised"]:
                first_memory_import["raised"] = True
                raise ImportError("force fallback")
            if name == "memory.memory_chunk":
                class _DummyChunk:
                    @staticmethod
                    def from_dict(_):
                        return MagicMock()

                    def to_dict(self):
                        return {}

                class _DummyChunker:
                    def __init__(self, chunk_size=512, chunk_overlap=50):
                        self.chunk_size = chunk_size
                        self.chunk_overlap = chunk_overlap

                    def chunk_text(self, text, source_id, metadata):
                        return []

                module = type("M", (), {})
                module.MemoryChunk = _DummyChunk
                module.TextChunker = _DummyChunker
                return module
            return original_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", side_effect=_fake_import):
            reloaded = importlib.reload(sm)
            assert hasattr(reloaded, "StoreManager")

        importlib.reload(sm)
