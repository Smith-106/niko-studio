import os
import json
import time
import hashlib
import threading
import pytest
from pathlib import Path
from src.memory.citation_manager import CitationManager, PersistedCitation, TransientCitation

class TestCitationManager:

    @pytest.fixture
    def citation_manager(self, tmp_path):
        return CitationManager(base_path=tmp_path)

    @pytest.fixture
    def sample_file(self, tmp_path):
        file_path = tmp_path / "source.txt"
        file_path.write_text("Hello World Content", encoding="utf-8")
        return file_path

    def test_add_citation_success(self, citation_manager, sample_file):
        citation = PersistedCitation(
            id="cite-1",
            type="doc",
            path=str(sample_file),
            sha256="dummy_hash",
            loc={"start": 0, "end": 5},
            quote="Hello"
        )
        citation_manager.add_citation(citation)

        saved = citation_manager.get_citation("cite-1")
        assert saved is not None
        assert saved.id == "cite-1"
        assert saved.quote == "Hello"
        assert saved.created_at is not None

    def test_sha256_verification(self, citation_manager, sample_file):
        # Calculate real hash
        content = sample_file.read_bytes()
        real_hash = hashlib.sha256(content).hexdigest()

        citation = PersistedCitation(
            id="cite-verify",
            type="doc",
            path=str(sample_file),
            sha256=real_hash,
            loc={"start": 0, "end": 5},
            quote="Hello"
        )
        citation_manager.add_citation(citation)

        # Verify success
        result = citation_manager.verify_citation("cite-verify")
        assert result["valid"] is True
        assert result["current_hash"] == real_hash

        # Modify file
        sample_file.write_text("Modified Content", encoding="utf-8")

        # Verify failure
        result = citation_manager.verify_citation("cite-verify")
        assert result["valid"] is False
        assert result["current_hash"] != real_hash

    def test_citation_chain_tracking(self, citation_manager, sample_file):
        # Add
        citation = PersistedCitation(
            id="cite-chain",
            type="doc",
            path=str(sample_file),
            sha256="hash",
            loc={},
            quote="Original"
        )
        citation_manager.add_citation(citation)
        assert citation_manager.get_citation("cite-chain") is not None

        # Update
        citation.quote = "Updated"
        citation_manager.update_citation(citation)
        updated = citation_manager.get_citation("cite-chain")
        assert updated.quote == "Updated"

        # Delete
        citation_manager.delete_citation("cite-chain")
        assert citation_manager.get_citation("cite-chain") is None

    def test_orphaned_gc(self, citation_manager, sample_file):
        # 1. Valid citation
        valid_citation = PersistedCitation(
            id="valid",
            type="doc",
            path=str(sample_file),
            sha256="hash",
            loc={},
            quote="Valid"
        )
        citation_manager.add_citation(valid_citation)

        # 2. Orphaned citation (file missing)
        missing_file = citation_manager.base_path / "missing.txt"
        orphaned_citation = PersistedCitation(
            id="orphaned",
            type="doc",
            path=str(missing_file),
            sha256="hash",
            loc={},
            quote="Orphaned"
        )
        citation_manager.add_citation(orphaned_citation)

        # Run GC
        deleted = citation_manager.gc_orphaned_citations()

        assert "orphaned" in deleted
        assert "valid" not in deleted
        assert citation_manager.get_citation("orphaned") is None
        assert citation_manager.get_citation("valid") is not None

    def test_concurrent_access(self, citation_manager, sample_file):
        def worker(idx):
            cid = f"thread-{idx}"
            citation = PersistedCitation(
                id=cid,
                type="doc",
                path=str(sample_file),
                sha256="hash",
                loc={},
                quote=f"Quote {idx}"
            )
            citation_manager.add_citation(citation)
            # Read back immediately
            retrieved = citation_manager.get_citation(cid)
            assert retrieved is not None
            citation_manager.verify_citation(cid)

        threads = []
        for i in range(10):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Verify all created
        for i in range(10):
            assert citation_manager.get_citation(f"thread-{i}") is not None
