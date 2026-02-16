"""
OpenKL Contract Tests

Tests for OpenKLPaths, DocumentMapping, OpenKLContract static methods,
and core file operations.
"""

import json
import pytest
from unittest.mock import patch
from pathlib import Path
from src.store.openkl_contract import (
    OpenKLPaths,
    DocumentMapping,
    OpenKLContract,
)


# ============================================================
# OpenKLPaths
# ============================================================

class TestOpenKLPaths:

    @pytest.fixture
    def paths(self, tmp_path):
        return OpenKLPaths(base_path=tmp_path / ".writing")

    def test_store(self, paths):
        assert paths.store == paths.base_path / "store"

    def test_sources(self, paths):
        assert paths.sources == paths.store / "sources"

    def test_normalized(self, paths):
        assert paths.normalized == paths.store / "normalized"

    def test_memories(self, paths):
        assert paths.memories == paths.base_path / "memories"

    def test_memories_by_date(self, paths):
        assert paths.memories_by_date == paths.memories / "by_date"

    def test_memories_topics(self, paths):
        assert paths.memories_topics == paths.memories / "topics"

    def test_citations(self, paths):
        assert paths.citations == paths.base_path / "citations"

    def test_sessions(self, paths):
        assert paths.sessions == paths.base_path / "sessions"

    def test_active_sessions(self, paths):
        assert paths.active_sessions == paths.sessions / "active"

    def test_archived_sessions(self, paths):
        assert paths.archived_sessions == paths.sessions / "archived"

    def test_ok_dir(self, paths):
        assert paths.ok_dir == paths.base_path / ".ok"

    def test_kuzu_dir(self, paths):
        assert paths.kuzu_dir == paths.ok_dir / "kuzu"

    def test_mapping_file(self, paths):
        assert paths.mapping_file == paths.ok_dir / "mapping.jsonl"

    def test_all_paths(self, paths):
        all_p = paths.all_paths()
        assert len(all_p) == 8
        assert paths.sources in all_p
        assert paths.kuzu_dir in all_p


# ============================================================
# DocumentMapping
# ============================================================

class TestDocumentMapping:

    def test_to_dict(self):
        m = DocumentMapping(
            doc_id="doc-001", path="store/sources/doc-001.md",
            sha256="abc123", source_type="general",
            created_at="2025-01-01", updated_at="2025-01-01",
            metadata={"key": "val"},
        )
        d = m.to_dict()
        assert d["doc_id"] == "doc-001"
        assert d["sha256"] == "abc123"
        assert d["metadata"] == {"key": "val"}

    def test_from_dict(self):
        data = {
            "doc_id": "doc-002",
            "path": "store/sources/doc-002.md",
            "sha256": "xyz789",
            "source_type": "chapter",
            "created_at": "2025-01-01",
            "updated_at": "2025-01-02",
            "metadata": {"ch": 1},
        }
        m = DocumentMapping.from_dict(data)
        assert m.doc_id == "doc-002"
        assert m.source_type == "chapter"
        assert m.metadata == {"ch": 1}

    def test_from_dict_defaults(self):
        data = {
            "doc_id": "d", "path": "p", "sha256": "h",
            "created_at": "t", "updated_at": "t",
        }
        m = DocumentMapping.from_dict(data)
        assert m.source_type == "general"
        assert m.metadata == {}

    def test_roundtrip(self):
        m = DocumentMapping(
            doc_id="doc-rt", path="p", sha256="h",
            source_type="test", created_at="t1", updated_at="t2",
            metadata={"x": 1},
        )
        m2 = DocumentMapping.from_dict(m.to_dict())
        assert m2.doc_id == m.doc_id
        assert m2.metadata == m.metadata


# ============================================================
# OpenKLContract Static Methods
# ============================================================

class TestStaticMethods:

    def test_compute_sha256_string(self):
        h = OpenKLContract.compute_sha256("hello")
        assert isinstance(h, str)
        assert len(h) == 64

    def test_compute_sha256_bytes(self):
        h = OpenKLContract.compute_sha256(b"hello")
        assert isinstance(h, str)
        assert len(h) == 64

    def test_compute_sha256_deterministic(self):
        h1 = OpenKLContract.compute_sha256("test")
        h2 = OpenKLContract.compute_sha256("test")
        assert h1 == h2

    def test_compute_sha256_different(self):
        h1 = OpenKLContract.compute_sha256("a")
        h2 = OpenKLContract.compute_sha256("b")
        assert h1 != h2

    def test_generate_doc_id(self, tmp_path):
        doc_id = OpenKLContract.generate_doc_id(tmp_path / "test.md")
        assert doc_id.startswith("doc-")
        assert len(doc_id) > 10

    def test_generate_doc_id_custom_prefix(self, tmp_path):
        doc_id = OpenKLContract.generate_doc_id(tmp_path / "t.md", prefix="mem")
        assert doc_id.startswith("mem-")


# ============================================================
# OpenKLContract Core Operations
# ============================================================

class TestOpenKLContract:

    @pytest.fixture
    def contract(self, tmp_path):
        return OpenKLContract(base_path=tmp_path / ".writing")

    def test_init_creates_structure(self, contract):
        for path in contract.paths.all_paths():
            assert path.exists()
        assert contract.paths.mapping_file.exists()

    def test_ingest_content(self, contract):
        doc_id = contract.ingest_content("Hello world", source_type="test")
        assert doc_id.startswith("doc-")
        assert doc_id in contract._mappings

    def test_ingest_content_custom_id(self, contract):
        doc_id = contract.ingest_content("text", doc_id="custom-001")
        assert doc_id == "custom-001"

    def test_ingest_content_with_metadata(self, contract):
        doc_id = contract.ingest_content(
            "text", metadata={"chapter": 1, "title": "Intro"}
        )
        mapping = contract._mappings[doc_id]
        assert mapping.metadata == {"chapter": 1, "title": "Intro"}

    def test_ingest_content_normalized(self, contract):
        doc_id = contract.ingest_content("text", doc_id="norm-test")
        normalized = contract.get_normalized_content("norm-test")
        assert normalized is not None
        assert "ok.md" in normalized  # header contains format: ok.md

    def test_ingest_content_no_normalize(self, contract):
        doc_id = contract.ingest_content("text", doc_id="no-norm", normalize=False)
        normalized = contract.get_normalized_content("no-norm")
        assert normalized is None

    def test_get_document(self, contract):
        doc_id = contract.ingest_content("test content", doc_id="get-test")
        doc = contract.get_document("get-test")
        assert doc is not None
        assert doc["content"] == "test content"
        assert doc["doc_id"] == "get-test"

    def test_get_document_not_found(self, contract):
        assert contract.get_document("nonexistent") is None

    def test_delete_document(self, contract):
        doc_id = contract.ingest_content("delete me", doc_id="del-test")
        result = contract.delete_document("del-test")
        assert result is True
        assert contract.get_document("del-test") is None

    def test_delete_nonexistent(self, contract):
        assert contract.delete_document("nonexistent") is False

    def test_list_documents(self, contract):
        contract.ingest_content("a", doc_id="list-1", source_type="chapter")
        contract.ingest_content("b", doc_id="list-2", source_type="note")
        docs = contract.list_documents()
        assert len(docs) == 2

    def test_list_documents_filtered(self, contract):
        contract.ingest_content("a", doc_id="f-1", source_type="chapter")
        contract.ingest_content("b", doc_id="f-2", source_type="note")
        docs = contract.list_documents(source_type="chapter")
        assert len(docs) == 1
        assert docs[0]["source_type"] == "chapter"

    def test_list_documents_limit(self, contract):
        for i in range(5):
            contract.ingest_content(f"doc {i}", doc_id=f"lim-{i}")
        docs = contract.list_documents(limit=3)
        assert len(docs) == 3

    def test_ingest_file(self, contract, tmp_path):
        source = tmp_path / "test_source.md"
        source.write_text("file content", encoding="utf-8")
        doc_id = contract.ingest_file(source, source_type="manuscript")
        assert doc_id in contract._mappings
        doc = contract.get_document(doc_id)
        assert doc["content"] == "file content"

    def test_ingest_file_not_found(self, contract, tmp_path):
        with pytest.raises(FileNotFoundError):
            contract.ingest_file(tmp_path / "nonexistent.md")

    def test_ingest_file_unsupported(self, contract, tmp_path):
        source = tmp_path / "test.xyz"
        source.write_text("content", encoding="utf-8")
        with pytest.raises(ValueError, match="Unsupported"):
            contract.ingest_file(source)

    def test_normalize_content(self, contract):
        result = contract.normalize_content("hello\r\nworld", Path("test.md"))
        assert "hello\nworld" in result
        assert "format: ok.md" in result

    def test_save_and_get_citation(self, contract):
        data = {"source": "Book A", "page": 42}
        contract.save_citation("cite-001", data)
        retrieved = contract.get_citation("cite-001")
        assert retrieved == data

    def test_get_citation_not_found(self, contract):
        assert contract.get_citation("nonexistent") is None

    def test_verify_integrity_clean(self, contract):
        contract.ingest_content("test", doc_id="int-1")
        result = contract.verify_integrity()
        assert result["total_documents"] == 1
        assert len(result["missing_files"]) == 0
        assert len(result["hash_mismatches"]) == 0

    def test_verify_integrity_missing_file(self, contract):
        contract.ingest_content("test", doc_id="int-miss")
        # Delete the source file manually
        mapping = contract._mappings["int-miss"]
        source_path = contract.paths.base_path / mapping.path
        source_path.unlink()
        result = contract.verify_integrity()
        assert "int-miss" in result["missing_files"]

    def test_verify_integrity_hash_mismatch(self, contract):
        contract.ingest_content("original", doc_id="int-hash")
        mapping = contract._mappings["int-hash"]
        source_path = contract.paths.base_path / mapping.path
        source_path.write_text("modified", encoding="utf-8")
        result = contract.verify_integrity()
        assert len(result["hash_mismatches"]) == 1

    def test_create_memory(self, contract):
        path = contract.create_memory("mem-001", "Memory content")
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "Memory content" in content
        assert "mem-001" in content

    def test_iter_documents(self, contract):
        contract.ingest_content("a", doc_id="iter-1")
        contract.ingest_content("b", doc_id="iter-2")
        docs = list(contract.iter_documents())
        assert len(docs) == 2

    def test_iter_documents_filtered(self, contract):
        contract.ingest_content("a", doc_id="itf-1", source_type="x")
        contract.ingest_content("b", doc_id="itf-2", source_type="y")
        docs = list(contract.iter_documents(source_type="x"))
        assert len(docs) == 1

    def test_mapping_persistence(self, tmp_path):
        base = tmp_path / ".writing"
        c1 = OpenKLContract(base_path=base)
        c1.ingest_content("persist", doc_id="persist-1")
        # Create new contract pointing to same base
        c2 = OpenKLContract(base_path=base)
        assert "persist-1" in c2._mappings

    def test_load_mappings_missing_file_returns(self, tmp_path):
        contract = OpenKLContract(base_path=tmp_path / ".writing")
        contract.paths.mapping_file.unlink()

        contract._mappings.clear()
        contract._load_mappings()

        assert contract._mappings == {}

    def test_load_mappings_skips_blank_and_invalid_json(self, tmp_path):
        base = tmp_path / ".writing"
        contract = OpenKLContract(base_path=base)
        valid = DocumentMapping(
            doc_id="valid-1",
            path="store/sources/valid-1.md",
            sha256="x" * 64,
            source_type="general",
            created_at="2025-01-01T00:00:00",
            updated_at="2025-01-01T00:00:00",
            metadata={},
        )
        contract.paths.mapping_file.write_text(
            "\n"
            "{bad-json}\n"
            + json.dumps(valid.to_dict(), ensure_ascii=False)
            + "\n",
            encoding="utf-8",
        )

        contract._mappings.clear()
        contract._load_mappings()

        assert "valid-1" in contract._mappings

    def test_load_mappings_open_error_logs(self, tmp_path):
        contract = OpenKLContract(base_path=tmp_path / ".writing")
        with patch("src.store.openkl_contract.open", side_effect=OSError("boom")):
            contract._load_mappings()
        assert isinstance(contract._mappings, dict)

    def test_save_mappings_writes_jsonl_rows(self, tmp_path):
        contract = OpenKLContract(base_path=tmp_path / ".writing")
        contract._mappings["doc-1"] = DocumentMapping(
            doc_id="doc-1",
            path="store/sources/doc-1.md",
            sha256="z" * 64,
            source_type="general",
            created_at="2025-01-01T00:00:00",
            updated_at="2025-01-01T00:00:00",
            metadata={"k": "v"},
        )

        contract._save_mappings()

        rows = [
            json.loads(line)
            for line in contract.paths.mapping_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        assert len(rows) == 1
        assert rows[0]["doc_id"] == "doc-1"

    def test_save_mappings_open_error_logs(self, tmp_path):
        contract = OpenKLContract(base_path=tmp_path / ".writing")
        with patch("src.store.openkl_contract.open", side_effect=OSError("save failed")):
            contract._save_mappings()
        assert isinstance(contract._mappings, dict)

    def test_append_mapping_open_error_logs(self, tmp_path):
        contract = OpenKLContract(base_path=tmp_path / ".writing")
        mapping = DocumentMapping(
            doc_id="append-1",
            path="store/sources/append-1.md",
            sha256="y" * 64,
            source_type="general",
            created_at="2025-01-01T00:00:00",
            updated_at="2025-01-01T00:00:00",
            metadata={},
        )
        with patch("src.store.openkl_contract.open", side_effect=OSError("append failed")):
            contract._append_mapping(mapping)
        assert isinstance(contract._mappings, dict)

    def test_get_document_missing_file_returns_none(self, contract):
        contract.ingest_content("content", doc_id="missing-doc")
        mapping = contract._mappings["missing-doc"]
        doc_path = contract.paths.base_path / mapping.path
        doc_path.unlink()

        assert contract.get_document("missing-doc") is None

    def test_create_memory_symlink_oserror_swallowed(self, contract):
        with patch("pathlib.Path.symlink_to", side_effect=OSError("no symlink")):
            path = contract.create_memory("mem-link", "hello", topics=["topic-a"])

        assert path.exists()
        assert path.read_text(encoding="utf-8").endswith("hello")

    def test_verify_integrity_orphaned_files(self, contract):
        orphan = contract.paths.sources / "orphan.md"
        orphan.write_text("orphan content", encoding="utf-8")

        result = contract.verify_integrity()
        rel_path = str(orphan.relative_to(contract.paths.base_path))

        assert rel_path in result["orphaned_files"]
