# -*- coding: utf-8 -*-
"""CitationManager tests - TransientCitation, PersistedCitation, CitationManager CRUD, GC."""

import pytest
import time
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

from src.memory.citation_manager import (
    TransientCitation,
    PersistedCitation,
    VerificationResult,
    CitationManager,
)


class TestTransientCitation:
    def test_defaults(self):
        tc = TransientCitation(
            citation_id="c1", source_text="hello",
            source_location={"path": "a.txt"},
            created_at="2025-01-01T00:00:00+00:00",
            expires_at="2025-12-31T00:00:00+00:00",
        )
        assert tc.context_before == ""
        assert tc.context_after == ""
        assert tc.score is None
        assert tc.metadata == {}

    def test_is_expired_false(self):
        now = datetime.now(timezone.utc)
        future = (now + timedelta(hours=1)).isoformat()
        tc = TransientCitation(
            citation_id="c1", source_text="t",
            source_location={}, created_at=now.isoformat(),
            expires_at=future,
        )
        assert tc.is_expired() is False

    def test_is_expired_true(self):
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        tc = TransientCitation(
            citation_id="c1", source_text="t",
            source_location={}, created_at="2025-01-01T00:00:00+00:00",
            expires_at=past,
        )
        assert tc.is_expired() is True

    def test_is_expired_invalid(self):
        tc = TransientCitation(
            citation_id="c1", source_text="t",
            source_location={}, created_at="x",
            expires_at="not-a-date",
        )
        assert tc.is_expired() is True

    def test_to_dict(self):
        tc = TransientCitation(
            citation_id="c1", source_text="hello",
            source_location={"path": "a.txt"},
            created_at="2025-01-01T00:00:00", expires_at="2025-12-31T00:00:00",
            score=0.95,
        )
        d = tc.to_dict()
        assert d["citation_id"] == "c1"
        assert d["score"] == 0.95

    def test_from_dict(self):
        d = {
            "citation_id": "c2", "source_text": "text",
            "source_location": {"path": "b.txt"},
            "created_at": "2025-01-01T00:00:00",
            "expires_at": "2025-12-31T00:00:00",
        }
        tc = TransientCitation.from_dict(d)
        assert tc.citation_id == "c2"


class TestPersistedCitation:
    def test_basic(self):
        pc = PersistedCitation(
            citation_id="p1", source_hash="abc123",
            source_location={"path": "doc.txt"},
            quote="some text",
        )
        assert pc.citation_id == "p1"
        assert pc.source_hash == "abc123"
        assert pc.quote == "some text"

    def test_legacy_fields(self):
        pc = PersistedCitation(id="p2", sha256="hash1", path="f.txt", loc={"line": 1}, surface="chapter")
        assert pc.citation_id == "p2"
        assert pc.source_hash == "hash1"
        assert pc.source_location == {"path": "f.txt", "loc": {"line": 1}, "surface": "chapter"}

    def test_properties(self):
        pc = PersistedCitation(
            citation_id="p3", source_hash="h",
            source_location={"path": "x.txt", "loc": {"line": 5}},
            source_type="chunk",
        )
        assert pc.id == "p3"
        assert pc.type == "chunk"
        assert pc.path == "x.txt"
        assert pc.sha256 == "h"
        assert pc.loc == {"line": 5}

    def test_to_dict(self):
        pc = PersistedCitation(citation_id="p4", source_hash="h", source_location={})
        d = pc.to_dict()
        assert d["citation_id"] == "p4"

    def test_from_dict(self):
        d = {"citation_id": "p5", "source_hash": "h", "source_location": {"path": "a.txt"}}
        pc = PersistedCitation.from_dict(d)
        assert pc.citation_id == "p5"

    def test_from_dict_legacy(self):
        d = {"id": "p6", "sha256": "hash2", "path": "b.txt", "type": "memory"}
        pc = PersistedCitation.from_dict(d)
        assert pc.citation_id == "p6"
        assert pc.source_hash == "hash2"
        assert pc.source_type == "memory"

    def test_defaults(self):
        pc = PersistedCitation()
        assert pc.citation_id == ""
        assert pc.source_hash == ""
        assert pc.retention_class == "standard"
        assert pc.tags == []


class TestVerificationResult:
    def test_truthy(self):
        vr = VerificationResult(valid=True)
        assert bool(vr) is True

    def test_falsy(self):
        vr = VerificationResult(valid=False)
        assert bool(vr) is False

    def test_empty(self):
        vr = VerificationResult()
        assert bool(vr) is False


class TestCitationManager:
    @pytest.fixture()
    def mgr(self, tmp_path):
        return CitationManager(base_path=str(tmp_path / "writing"))

    def test_init(self, mgr):
        assert mgr.citations_dir.exists()

    def test_set_memory_manager(self, mgr):
        mm = MagicMock()
        mgr.set_memory_manager(mm)
        assert mgr._memory_manager is mm

    def test_create_citation(self, mgr):
        tc = mgr.create_citation(
            source_text="hello world",
            location={"path": "doc.txt"},
            context_before="before",
            context_after="after",
            score=0.9,
        )
        assert tc.source_text == "hello world"
        assert tc.score == 0.9
        assert tc.is_expired() is False

    def test_create_citation_with_metadata_id(self, mgr):
        tc = mgr.create_citation(
            source_text="text",
            location={},
            metadata={"citation_id": "custom-id"},
        )
        assert tc.citation_id == "custom-id"

    def test_create_transient_citation_basic(self, mgr):
        tc = mgr.create_transient_citation(source_text="test", location={"path": "a.txt"})
        assert tc.source_text == "test"

    def test_create_transient_citation_from_source_dict(self, mgr):
        source = {
            "content": "source text",
            "metadata": {"path": "doc.txt", "surface": "ch1"},
            "score": 0.8,
            "id": "src-1",
        }
        tc = mgr.create_transient_citation(source=source)
        assert tc.source_text == "source text"
        assert tc.citation_id == "src-1"

    def test_create_transient_citation_legacy_args(self, mgr):
        tc = mgr.create_transient_citation(
            quote="quoted text", path="file.txt", surface="section1", id="leg-1"
        )
        assert tc.source_text == "quoted text"
        assert tc.citation_id == "leg-1"

    def test_get_transient(self, mgr):
        tc = mgr.create_citation(source_text="find me", location={})
        found = mgr._transient_cache.get(tc.citation_id)
        assert found is not None
        assert found.source_text == "find me"

    def test_persist_citation(self, mgr):
        tc = mgr.create_citation(source_text="persist me", location={"path": "a.txt"})
        pc = mgr.persist_citation(tc.citation_id)
        assert pc is not None
        assert pc.quote == "persist me"

    def test_persist_citation_not_found(self, mgr):
        result = mgr.persist_citation("nonexistent")
        assert result is None

    def test_gc_expired(self, mgr):
        # Create a citation with very short TTL
        mgr2 = CitationManager(base_path=str(mgr.base_path), transient_ttl=0)
        tc = mgr2.create_citation(source_text="expire me", location={})
        time.sleep(0.1)
        count = mgr2.gc_expired()
        # gc_expired may return list or int
        expired = len(count) if isinstance(count, list) else count
        assert expired >= 1
        assert tc.citation_id not in mgr2._transient_cache
