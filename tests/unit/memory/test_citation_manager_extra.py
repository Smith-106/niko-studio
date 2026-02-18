# -*- coding: utf-8 -*-
"""CitationManager tests - TransientCitation, PersistedCitation, CitationManager CRUD, GC."""

import pytest
import time
import hashlib
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

from src.memory import citation_manager as citation_module
from src.memory.citation_manager import (
    TransientCitation,
    PersistedCitation,
    VerificationResult,
    CitationManager,
    get_citation_manager,
    reset_citation_manager,
)


@pytest.fixture()
def mgr(tmp_path):
    return CitationManager(base_path=str(tmp_path / "writing"))


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



def test_create_transient_citation_content_alias_and_custom_source_object(mgr):
    source_obj = MagicMock()
    source_obj.to_dict.return_value = {
        "content": "obj text",
        "metadata": {"path": "obj.txt", "surface": "chunk", "loc": {"start": "3", "end": "8"}},
        "score": 0.7,
        "id": "obj-id",
    }

    tc = mgr.create_transient_citation(content=source_obj)

    assert tc.source_text == "obj text"
    assert tc.citation_id == "obj-id"
    assert tc.source_location["loc"] == {"kind": "char", "start": 3, "end": 8}


def test_create_transient_citation_with_non_dict_source_becomes_empty(mgr):
    tc = mgr.create_transient_citation(source=object())

    assert tc.source_text == ""
    assert tc.source_location == {"path": None, "surface": None, "loc": None}


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({"loc": {"start": "2", "end": "6"}}, {"kind": "char", "start": 2, "end": 6}),
        ({"loc": {"kind": "token", "start": 5, "end": None}}, {"kind": "token", "start": 5, "end": None}),
    ],
)
def test_normalize_location_loc_variants(mgr, payload, expected):
    location = mgr._normalize_search_result_location(payload)
    assert location["loc"] == expected


@pytest.mark.parametrize("bad_loc", [{"loc": "not-dict"}, {"loc": [1, 2, 3]}])
def test_normalize_location_raises_on_non_mapping_loc(mgr, bad_loc):
    with pytest.raises(AttributeError):
        mgr._normalize_search_result_location(bad_loc)


def test_persist_citation_expired_transient_deleted(mgr):
    past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    tc = TransientCitation(
        citation_id="expired-id",
        source_text="x",
        source_location={},
        created_at=past,
        expires_at=past,
    )
    mgr._transient_cache[tc.citation_id] = tc

    persisted = mgr.persist_citation(tc.citation_id)

    assert persisted is None
    assert tc.citation_id not in mgr._transient_cache


def test_make_citation_with_and_without_context(mgr):
    no_ctx = TransientCitation(
        citation_id="no-ctx",
        source_text="hello",
        source_location={"surface": "doc"},
        created_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat(),
    )
    with_ctx = TransientCitation(
        citation_id="with-ctx",
        source_text="world",
        source_location={"surface": "doc"},
        created_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat(),
        context_before="before",
        context_after="after",
    )

    p1 = mgr.make_citation(no_ctx)
    p2 = mgr.make_citation(with_ctx)

    assert p1.context is None
    assert p2.context == {"before": "before", "after": "after"}


def test_verify_citation_not_found_and_missing_file_branch(mgr):
    missing = mgr.verify_citation_detailed("does-not-exist")
    assert missing["valid"] is False
    assert "error" in missing

    tc = mgr.create_citation(source_text="abc", location={"path": str(mgr.base_path / "missing.txt")})
    p = mgr.persist_citation(tc.citation_id)
    result = mgr.verify_citation_detailed(p.citation_id)

    assert result["valid"] is True
    assert result["current_hash"] == p.source_hash


def test_get_citation_bad_json_and_get_transient_expired(mgr):
    bad = mgr._get_citation_path("bad-json")
    bad.write_text("not-json", encoding="utf-8")
    assert mgr.get_citation("bad-json") is None

    past = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    expired = TransientCitation(
        citation_id="expired-transient",
        source_text="t",
        source_location={},
        created_at=past,
        expires_at=past,
    )
    mgr._transient_cache[expired.citation_id] = expired

    assert mgr.get_transient_citation(expired.citation_id) is None
    assert expired.citation_id not in mgr._transient_cache


def test_list_citations_filters_and_skips_corrupt_and_gc_paths(mgr):
    tc1 = mgr.create_citation(source_text="a", location={"path": "src-A"})
    tc2 = mgr.create_citation(source_text="b", location={"path": "src-B"})
    mgr.persist_citation(tc1.citation_id)
    mgr.persist_citation(tc2.citation_id)

    bad_file = mgr.citations_dir / "corrupt.json"
    bad_file.write_text("broken", encoding="utf-8")

    filtered = mgr.list_citations(source_id="src-A")
    assert len(filtered) == 1
    assert filtered[0].source_location.get("path") == "src-A"

    dry_deleted = mgr.gc_expired(dry_run=True)
    assert "corrupt" in dry_deleted
    assert bad_file.exists()

    real_deleted = mgr.gc_expired(dry_run=False)
    assert "corrupt" in real_deleted
    assert not bad_file.exists()


def test_gc_expired_ephemeral_age_and_invalid_created_at(mgr):
    tc_old = mgr.create_citation(source_text="old", location={})
    p_old = mgr.persist_citation(tc_old.citation_id, retention_class="ephemeral")
    old_file = mgr._get_citation_path(p_old.citation_id)
    old_data = json.loads(old_file.read_text(encoding="utf-8"))
    old_data["created_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    old_file.write_text(json.dumps(old_data), encoding="utf-8")

    tc_bad = mgr.create_citation(source_text="bad-date", location={})
    p_bad = mgr.persist_citation(tc_bad.citation_id, retention_class="ephemeral")
    bad_file = mgr._get_citation_path(p_bad.citation_id)
    bad_data = json.loads(bad_file.read_text(encoding="utf-8"))
    bad_data["created_at"] = "invalid-date"
    bad_file.write_text(json.dumps(bad_data), encoding="utf-8")

    deleted = mgr.gc_expired()

    assert p_old.citation_id in deleted
    assert p_bad.citation_id not in deleted


def test_gc_orphaned_variants_and_delete_missing(mgr):
    missing_path = mgr.base_path / "missing-src.txt"
    tc_orphan = mgr.create_citation(source_text="orphan", location={"path": str(missing_path)})
    p_orphan = mgr.persist_citation(tc_orphan.citation_id)

    tc_old = mgr.create_citation(source_text="old-ephemeral", location={"path": None})
    p_old = mgr.persist_citation(tc_old.citation_id, retention_class="ephemeral")
    old_file = mgr._get_citation_path(p_old.citation_id)
    old_data = json.loads(old_file.read_text(encoding="utf-8"))
    old_data["created_at"] = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    old_file.write_text(json.dumps(old_data), encoding="utf-8")

    tc_bad = mgr.create_citation(source_text="bad-ephemeral", location={})
    p_bad = mgr.persist_citation(tc_bad.citation_id, retention_class="ephemeral")
    bad_file = mgr._get_citation_path(p_bad.citation_id)
    bad_data = json.loads(bad_file.read_text(encoding="utf-8"))
    bad_data["created_at"] = "bad-ts"
    bad_file.write_text(json.dumps(bad_data), encoding="utf-8")

    corrupted = mgr.citations_dir / "broken-orphan.json"
    corrupted.write_text("bad", encoding="utf-8")

    dry = mgr.gc_orphaned_citations(dry_run=True, max_age_seconds=60)
    assert p_orphan.citation_id in dry
    assert p_old.citation_id in dry
    assert "broken-orphan" in dry

    real = mgr.gc_orphaned_citations(dry_run=False, max_age_seconds=60)
    assert p_orphan.citation_id in real
    assert p_old.citation_id in real
    assert "broken-orphan" in real
    assert not mgr._get_citation_path(p_orphan.citation_id).exists()

    assert mgr.delete_citation("not-existing") is False


class DummyMemory:
    def __init__(self, content):
        self.content = content
        self.topics = ["topic-a"]
        self.entity_id = "entity-1"
        self.importance = 0.5


def test_create_citation_from_memory_branches(mgr):
    assert mgr.create_citation_from_memory("m1", "excerpt") is None

    mm = MagicMock()
    mm.get.return_value = None
    mgr.set_memory_manager(mm)
    assert mgr.create_citation_from_memory("m1", "excerpt") is None

    mm.get.return_value = DummyMemory("abcdefg")
    citation = mgr.create_citation_from_memory("m1", "not-found-excerpt", context_chars=2)
    assert citation is not None
    assert citation.source_location["surface"] == "memory"
    assert citation.metadata["memory_id"] == "m1"




def test_persisted_citation_from_dict_maps_loc_surface_source_fields():
    payload = {
        "id": "legacy-id",
        "sha256": "legacy-hash",
        "path": "legacy.txt",
        "loc": {"start": 1, "end": 2},
        "surface": "chunk",
        "type": "memory",
        "source": {"author": "u"},
    }

    citation = PersistedCitation.from_dict(payload)

    assert citation.citation_id == "legacy-id"
    assert citation.source_hash == "legacy-hash"
    assert citation.source_location == {
        "path": "legacy.txt",
        "loc": {"start": 1, "end": 2},
        "surface": "chunk",
    }
    assert citation.source_type == "memory"
    assert citation.source_metadata == {"author": "u"}


def test_create_transient_citation_citation_id_equal_original_branch(mgr):
    source = {
        "content": "source text",
        "metadata": {"path": "doc.txt"},
        "id": "src-keep",
    }

    tc = mgr.create_transient_citation(source=source)

    assert tc.citation_id == "src-keep"
    assert "src-keep" in mgr._transient_cache


def test_create_transient_citation_equal_id_reinserts_missing_original_cache_key(mgr):
    tc = mgr.create_citation(source_text="equal-id-branch", location={})
    with mgr._lock:
        del mgr._transient_cache[tc.citation_id]

    rebuilt = mgr.create_transient_citation(source_text="equal-id-branch", location={}, citation_id=tc.citation_id)

    assert rebuilt.citation_id == tc.citation_id
    assert tc.citation_id in mgr._transient_cache



def test_get_transient_citation_returns_active_entry(mgr):
    tc = mgr.create_citation(source_text="alive", location={})

    found = mgr.get_transient_citation(tc.citation_id)

    assert found is not None
    assert found.citation_id == tc.citation_id


def test_gc_expired_removes_expired_transient_when_not_dry_run(mgr):
    past = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    expired = TransientCitation(
        citation_id="expired-gc",
        source_text="x",
        source_location={},
        created_at=past,
        expires_at=past,
    )
    mgr._transient_cache[expired.citation_id] = expired

    deleted = mgr.gc_expired(dry_run=False)

    assert "transient:expired-gc" in deleted
    assert "expired-gc" not in mgr._transient_cache




def test_create_transient_citation_with_legacy_loc_sets_location_loc(mgr):
    citation = mgr.create_transient_citation(
        quote="quoted",
        path="legacy-loc.txt",
        surface="chunk",
        loc={"start": 7, "end": 11},
    )

    assert citation.source_location["loc"] == {"kind": "char", "start": 7, "end": 11}
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(mgr, "_generate_citation_id", lambda _text: "same-id")
        citation = mgr.create_transient_citation(source_text="text", location={}, citation_id="same-id")

    assert citation.citation_id == "same-id"
    assert "same-id" in mgr._transient_cache


def test_calculate_file_hash_returns_empty_on_missing_file(mgr, tmp_path):
    missing = tmp_path / "definitely-missing-file.txt"

    assert mgr._calculate_file_hash(missing) == ""
    reset_citation_manager()
    base = tmp_path / "writing-singleton"

    cm1 = get_citation_manager(base_path=base)
    mm = MagicMock()
    cm2 = get_citation_manager(base_path=base, memory_manager=mm)

    assert cm1 is cm2
    assert cm2._memory_manager is mm

    stats = cm2.stats()
    assert stats["persisted_count"] >= 0
    assert stats["transient_count"] >= 0

    reset_citation_manager()
    assert citation_module._citation_manager is None
