# -*- coding: utf-8 -*-
"""
SessionManager Tests

Tests for SessionStatus, ContentType, PATH_ROUTES, SessionInfo,
SessionManager (init, list, read, write, archive, restore, delete,
create_session, list_sessions, stats).
"""

import json
import pytest
from pathlib import Path
from unittest.mock import patch
from src.workflow.session.session_manager import (
    SessionStatus,
    ContentType,
    PATH_ROUTES,
    SessionInfo,
    SessionManager,
)


# ============================================================
# SessionStatus
# ============================================================

class TestSessionStatus:

    def test_values(self):
        assert SessionStatus.ACTIVE.value == "active"
        assert SessionStatus.ARCHIVED.value == "archived"

    def test_from_value(self):
        assert SessionStatus("active") == SessionStatus.ACTIVE
        assert SessionStatus("archived") == SessionStatus.ARCHIVED


# ============================================================
# ContentType
# ============================================================

class TestContentType:

    def test_values(self):
        assert ContentType.CHAPTER.value == "chapter"
        assert ContentType.OUTLINE.value == "outline"
        assert ContentType.CHARACTER.value == "character"
        assert ContentType.WORLDVIEW.value == "worldview"
        assert ContentType.PLAN.value == "plan"
        assert ContentType.TODO.value == "todo"
        assert ContentType.SUMMARY.value == "summary"
        assert ContentType.STATE.value == "state"
        assert ContentType.SNAPSHOT_INDEX.value == "snapshot_index"
        assert ContentType.REVISION_CHECKPOINT.value == "revision_checkpoint"
        assert ContentType.GENERATION_SNAPSHOT.value == "generation_snapshot"

    def test_all_in_path_routes(self):
        for ct in ContentType:
            assert ct in PATH_ROUTES


# ============================================================
# PATH_ROUTES
# ============================================================

class TestPathRoutes:

    def test_chapter_template(self):
        t = PATH_ROUTES[ContentType.CHAPTER]
        assert "{base}" in t
        assert "{id}" in t

    def test_outline_no_id(self):
        t = PATH_ROUTES[ContentType.OUTLINE]
        assert "{id}" not in t
        assert "OUTLINE.md" in t

    def test_state_path(self):
        t = PATH_ROUTES[ContentType.STATE]
        assert "state.json" in t

    def test_revision_checkpoint_path(self):
        t = PATH_ROUTES[ContentType.REVISION_CHECKPOINT]
        assert "revision-checkpoints" in t
        assert "{id}" in t

    def test_generation_snapshot_path(self):
        t = PATH_ROUTES[ContentType.GENERATION_SNAPSHOT]
        assert "generation-snapshots" in t
        assert "{id}" in t


# ============================================================
# SessionInfo
# ============================================================

class TestSessionInfo:

    def test_defaults(self):
        info = SessionInfo(id="s1", type="standard", status="active")
        assert info.project_name == ""
        assert info.created_at == ""
        assert info.task_count == 0
        assert info.chapter_count == 0
        assert info.domain == "novel"

    def test_custom_fields(self):
        info = SessionInfo(
            id="s1", type="rapid", status="archived",
            project_name="proj", domain="code",
        )
        assert info.type == "rapid"
        assert info.domain == "code"


# ============================================================
# SessionManager.init
# ============================================================

class TestSessionManagerInit:

    def test_creates_directories(self, tmp_path):
        base = str(tmp_path / "sessions")
        sm = SessionManager(base_path=base)
        assert (tmp_path / "sessions" / "active").is_dir()
        assert (tmp_path / "sessions" / "archived").is_dir()

    def test_init_session(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        info = sm.init("sess-001", session_type="lite", project_name="p1")
        assert info.id == "sess-001"
        assert info.type == "lite"
        assert info.status == "active"
        assert info.project_name == "p1"
        # session.json should exist
        sj = tmp_path / "sessions" / "active" / "sess-001" / "session.json"
        assert sj.exists()

    def test_init_creates_subdirs(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-002")
        base = tmp_path / "sessions" / "active" / "sess-002"
        assert (base / "chapters").is_dir()
        assert (base / ".data").is_dir()
        assert (base / ".data" / "characters").is_dir()

    def test_init_domain(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        info = sm.init("sess-003", domain="code")
        assert info.domain == "code"


# ============================================================
# SessionManager.read / write
# ============================================================

class TestSessionManagerReadWrite:

    @pytest.fixture
    def sm(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-rw")
        return sm

    def test_write_and_read_outline(self, sm):
        sm.write("sess-rw", ContentType.OUTLINE, "# My Outline")
        content = sm.read("sess-rw", ContentType.OUTLINE)
        assert content == "# My Outline"

    def test_write_and_read_chapter(self, sm):
        sm.write("sess-rw", ContentType.CHAPTER, "Chapter 1 text", id="01")
        content = sm.read("sess-rw", ContentType.CHAPTER, id="01")
        assert "Chapter 1" in content

    def test_read_nonexistent(self, sm):
        content = sm.read("sess-rw", ContentType.SUMMARY)
        assert content == ""

    def test_write_returns_true(self, sm):
        result = sm.write("sess-rw", ContentType.PLAN, "plan content")
        assert result is True

    def test_write_updates_timestamp(self, sm):
        info_before = sm._load_session_info("sess-rw")
        ts_before = info_before.updated_at
        sm.write("sess-rw", ContentType.TODO, "todo content")
        info_after = sm._load_session_info("sess-rw")
        assert info_after.updated_at >= ts_before

    def test_write_appends_snapshot_index(self, sm):
        sm.write("sess-rw", ContentType.TODO, "todo content")
        snapshot_raw = sm.read("sess-rw", ContentType.SNAPSHOT_INDEX)
        assert snapshot_raw
        snapshot_index = json.loads(snapshot_raw)
        assert isinstance(snapshot_index, list)
        assert snapshot_index[-1]["content_type"] == ContentType.TODO.value
        assert "TODO_LIST.md" in snapshot_index[-1]["path"]

    def test_write_with_invalid_snapshot_index_restarts_list(self, sm):
        index_path = sm._resolve_path("sess-rw", ContentType.SNAPSHOT_INDEX)
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text("{bad", encoding="utf-8")

        sm.write("sess-rw", ContentType.PLAN, "plan")

        snapshot_index = json.loads(sm.read("sess-rw", ContentType.SNAPSHOT_INDEX))
        assert isinstance(snapshot_index, list)
        assert len(snapshot_index) == 1

    def test_write_with_non_list_snapshot_index_restarts_list(self, sm):
        index_path = sm._resolve_path("sess-rw", ContentType.SNAPSHOT_INDEX)
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps({"bad": True}), encoding="utf-8")

        sm.write("sess-rw", ContentType.PLAN, "plan")

        snapshot_index = json.loads(sm.read("sess-rw", ContentType.SNAPSHOT_INDEX))
        assert isinstance(snapshot_index, list)
        assert len(snapshot_index) == 1
    def test_append_audit_writes_jsonl(self, sm):
        event = {"kind": "sync", "status": "ok"}

        assert sm.append_audit("sess-rw", event) is True

        audit_content = sm.read("sess-rw", ContentType.AUDIT)
        lines = [line for line in audit_content.splitlines() if line]
        assert len(lines) == 1
        parsed = json.loads(lines[0])
        assert parsed["kind"] == "sync"

    def test_write_revision_checkpoint_creates_json_artifact(self, sm):
        payload = '{"checkpoint_id":"revision-round-1"}'
        assert sm.write("sess-rw", ContentType.REVISION_CHECKPOINT, payload, id="revision-round-1") is True

        checkpoint_content = sm.read("sess-rw", ContentType.REVISION_CHECKPOINT, id="revision-round-1")
        assert "revision-round-1" in checkpoint_content

    def test_write_generation_snapshot_creates_json_artifact(self, sm):
        payload = '{"artifact_type":"quality_revision"}'
        assert sm.write("sess-rw", ContentType.GENERATION_SNAPSHOT, payload, id="plan-generate_draft") is True

        snapshot_content = sm.read("sess-rw", ContentType.GENERATION_SNAPSHOT, id="plan-generate_draft")
        assert "quality_revision" in snapshot_content


class TestSessionManagerArchiveRestore:

    @pytest.fixture
    def sm(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-ar")
        return sm

    def test_archive(self, sm):
        result = sm.archive("sess-ar")
        assert result is True
        # Should be in archived, not active
        assert not (sm.active_path / "sess-ar").exists()
        assert (sm.archived_path / "sess-ar").exists()

    def test_archive_updates_status(self, sm):
        sm.archive("sess-ar")
        info = sm._load_session_info("sess-ar", sm.archived_path)
        assert info.status == "archived"

    def test_archive_nonexistent(self, sm):
        result = sm.archive("nonexistent")
        assert result is False

    def test_restore(self, sm):
        sm.archive("sess-ar")
        result = sm.restore("sess-ar")
        assert result is True
        assert (sm.active_path / "sess-ar").exists()
        assert not (sm.archived_path / "sess-ar").exists()

    def test_restore_updates_status(self, sm):
        sm.archive("sess-ar")
        sm.restore("sess-ar")
        info = sm._load_session_info("sess-ar")
        assert info.status == "active"

    def test_restore_nonexistent(self, sm):
        result = sm.restore("nonexistent")
        assert result is False


# ============================================================
# SessionManager.delete
# ============================================================

class TestSessionManagerDelete:

    @pytest.fixture
    def sm(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-del")
        return sm

    def test_delete_soft(self, sm):
        # Soft delete = archive
        result = sm.delete("sess-del")
        assert result is True
        assert (sm.archived_path / "sess-del").exists()

    def test_delete_force(self, sm):
        result = sm.delete("sess-del", force=True)
        assert result is True
        assert not (sm.active_path / "sess-del").exists()
        assert not (sm.archived_path / "sess-del").exists()

    def test_delete_archived(self, sm):
        sm.archive("sess-del")
        result = sm.delete("sess-del", force=True)
        assert result is True
        assert not (sm.archived_path / "sess-del").exists()

    def test_delete_nonexistent(self, sm):
        result = sm.delete("nonexistent", force=True)
        assert result is False


# ============================================================
# SessionManager.list
# ============================================================

class TestSessionManagerList:

    @pytest.fixture
    def sm(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-a", project_name="proj1", domain="novel")
        sm.init("sess-b", project_name="proj2", domain="code")
        return sm

    def test_list_active(self, sm):
        sessions = sm.list(location="active")
        assert len(sessions) == 2

    def test_list_archived_empty(self, sm):
        sessions = sm.list(location="archived")
        assert len(sessions) == 0

    def test_list_all(self, sm):
        sm.archive("sess-a")
        sessions = sm.list(location="all")
        assert len(sessions) == 2

    def test_domain_filter(self, sm):
        sessions = sm.list(domain_filter="code")
        assert len(sessions) == 1
        assert sessions[0].id == "sess-b"

    def test_project_filter(self, sm):
        sessions = sm.list(project_filter="proj1")
        assert len(sessions) == 1
        assert sessions[0].id == "sess-a"

    def test_sorted_by_updated_at(self, sm):
        sessions = sm.list()
        assert len(sessions) >= 2
        assert sessions[0].updated_at >= sessions[1].updated_at

    def test_list_skips_missing_base_path(self, sm):
        with patch.object(sm, "active_path") as active:
            active.exists.return_value = False
            sessions = sm.list(location="active")

        assert sessions == []

    def test_list_skips_non_dirs_and_none_info(self, sm):
        marker = sm.active_path / "note.txt"
        marker.write_text("x", encoding="utf-8")

        with patch.object(sm, "_load_session_info", return_value=None):
            sessions = sm.list(location="all")

        assert sessions == []


class TestSessionManagerSyncLifecycle:

    @pytest.fixture
    def sm(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-life")
        return sm

    def test_sync_running_updates_active_state(self, sm):
        result = sm.sync_lifecycle("sess-life", runner_state="running", checkpoint_id="cp-1")

        assert result["status"] == "active"
        assert result["runner_state"] == "running"
        assert result["last_checkpoint_id"] == "cp-1"

    def test_sync_archived_moves_session(self, sm):
        result = sm.sync_lifecycle("sess-life", runner_state="stopped")

        assert result["status"] == "archived"
        assert (sm.archived_path / "sess-life").exists()

    def test_sync_checkpointed_restores_archived_session(self, sm):
        sm.archive("sess-life")

        result = sm.sync_lifecycle("sess-life", runner_state="paused")

        assert result["status"] == "checkpointed"
        assert (sm.active_path / "sess-life").exists()

    def test_sync_archived_initializes_when_missing(self, sm):
        sm.delete("sess-life", force=True)

        result = sm.sync_lifecycle("sess-life", runner_state="stopped")

        assert result["status"] == "archived"
        assert (sm.archived_path / "sess-life").exists()

    def test_sync_running_restores_archived_session(self, sm):
        sm.archive("sess-life")

        result = sm.sync_lifecycle("sess-life", runner_state="running")

        assert result["status"] == "active"
        assert (sm.active_path / "sess-life").exists()

    def test_sync_unknown_runner_state_defaults_to_active_and_init(self, sm):
        sm.delete("sess-life", force=True)

        result = sm.sync_lifecycle("sess-life", runner_state="mystery")

        assert result["status"] == "active"
        assert (sm.active_path / "sess-life").exists()

    def test_sync_with_custom_status_map(self, sm):
        result = sm.sync_lifecycle("sess-life", runner_state="idle", status_map={"idle": "archived"})

        assert result["status"] == "archived"
        assert (sm.archived_path / "sess-life").exists()

    def test_sync_checkpointed_initializes_when_missing(self, sm):
        sm.delete("sess-life", force=True)

        result = sm.sync_lifecycle("sess-life", runner_state="paused")

        assert result["status"] == "checkpointed"
        assert (sm.active_path / "sess-life").exists()

    def test_sync_returns_minimal_when_info_missing(self, sm):
        with patch.object(sm, "_load_session_info", return_value=None):
            result = sm.sync_lifecycle("sess-life", runner_state="running")

        assert result == {"session_id": "sess-life", "status": "active"}

class TestCreateSession:

    def test_basic(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        result = sm.create_session("myproj", goal="write novel")
        assert "session_id" in result
        assert result["project_id"] == "myproj"
        assert result["goal"] == "write novel"
        assert result["status"] == "active"

    def test_session_id_format(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        result = sm.create_session("proj")
        assert result["session_id"].startswith("proj-")

    def test_create_session_generates_unique_ids(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        first = sm.create_session("proj")
        second = sm.create_session("proj")
        assert first["session_id"] != second["session_id"]

    def test_create_session_with_namespace_prefix(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        result = sm.create_session("proj", namespace="novel-a")
        assert result["session_id"].startswith("novel-a--proj-")
        assert result["namespace"] == "novel-a"


# ============================================================
# SessionManager.list_sessions (legacy)
# ============================================================

class TestListSessions:

    def test_returns_dicts(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-ls")
        result = sm.list_sessions()
        assert isinstance(result, list)
        assert len(result) == 1
        assert "session_id" in result[0]
        assert "project_id" in result[0]


# ============================================================
# SessionManager.stats
# ============================================================

class TestSessionManagerStats:

    def test_basic(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-stats", session_type="rapid")
        stats = sm.stats("sess-stats")
        assert stats["session_id"] == "sess-stats"
        assert stats["type"] == "rapid"
        assert stats["chapter_count"] == 0
        assert stats["total_words"] == 0

    def test_with_chapters(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-ch")
        sm.write("sess-ch", ContentType.CHAPTER, "Hello World", id="01")
        sm.write("sess-ch", ContentType.CHAPTER, "Second Chapter", id="02")
        stats = sm.stats("sess-ch")
        assert stats["chapter_count"] == 2
        assert stats["total_words"] > 0

    def test_nonexistent(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        stats = sm.stats("nonexistent")
        assert stats == {}


# ============================================================
# SessionManager._get_session_path
# ============================================================

class TestGetSessionPath:

    def test_active(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-gsp")
        path = sm._get_session_path("sess-gsp")
        assert "active" in str(path)

    def test_archived(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-gsp2")
        sm.archive("sess-gsp2")
        path = sm._get_session_path("sess-gsp2")
        assert "archived" in str(path)

    def test_default_active(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        path = sm._get_session_path("nonexistent")
        assert "active" in str(path)


class TestSessionIdValidation:

    def test_init_rejects_invalid_session_id(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        with pytest.raises(ValueError):
            sm.init("../escape")

    def test_resolve_path_rejects_invalid_session_id(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        with pytest.raises(ValueError):
            sm._resolve_path("../escape", ContentType.OUTLINE)

    def test_resolve_path_rejects_path_escape_from_kwargs(self, tmp_path):
        sm = SessionManager(base_path=str(tmp_path / "sessions"))
        sm.init("sess-safe")

        class _BoundaryEscapeContentType:
            value = "escape"

        with patch(
            "src.workflow.session.session_manager.PATH_ROUTES",
            {**PATH_ROUTES, _BoundaryEscapeContentType: "{base}/{id}"},
        ):
            with pytest.raises(ValueError, match="escapes session boundary"):
                sm._resolve_path("sess-safe", _BoundaryEscapeContentType, id="../outside")
