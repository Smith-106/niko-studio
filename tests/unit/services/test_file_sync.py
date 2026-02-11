# -*- coding: utf-8 -*-
"""
File Sync Tests

Tests for FileChangeEvent, FileWatcher (callback/relevance/debounce/notify),
AutoSyncHandler, SyncResult, FileSyncService (hash/sync_file/sync_directory/
history/indexed_files).
"""

import time
import hashlib
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from src.services.file_sync import (
    FileChangeEvent,
    FileWatcher,
    AutoSyncHandler,
    SyncResult,
    FileSyncService,
)


# ============================================================
# FileChangeEvent
# ============================================================

class TestFileChangeEvent:

    def test_basic(self):
        ev = FileChangeEvent("/tmp/test.md", "created")
        assert ev.path == "/tmp/test.md"
        assert ev.event_type == "created"
        assert ev.timestamp > 0
        assert ev.content_hash is None

    def test_custom_timestamp(self):
        ev = FileChangeEvent("/tmp/a.txt", "modified", timestamp=1000.0)
        assert ev.timestamp == 1000.0

    def test_compute_hash_real_file(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("hello world", encoding="utf-8")
        ev = FileChangeEvent(str(f), "modified")
        h = ev.compute_hash()
        assert h is not None
        assert ev.content_hash == h
        # Verify hash correctness
        expected = hashlib.sha256(b"hello world").hexdigest()
        assert h == expected

    def test_compute_hash_nonexistent(self):
        ev = FileChangeEvent("/nonexistent/file.txt", "created")
        assert ev.compute_hash() is None


# ============================================================
# FileWatcher - Callback Management
# ============================================================

class TestFileWatcherCallbacks:

    def test_on_change_registers_callback(self):
        fw = FileWatcher()
        cb = MagicMock()
        fw.on_change(cb)
        assert cb in fw._callbacks

    def test_remove_callback(self):
        fw = FileWatcher()
        cb = MagicMock()
        fw.on_change(cb)
        fw.remove_callback(cb)
        assert cb not in fw._callbacks

    def test_remove_nonexistent_callback(self):
        fw = FileWatcher()
        cb = MagicMock()
        fw.remove_callback(cb)  # Should not raise

    def test_notify_calls_callbacks(self):
        fw = FileWatcher()
        cb1 = MagicMock()
        cb2 = MagicMock()
        fw.on_change(cb1)
        fw.on_change(cb2)

        ev = FileChangeEvent("/test.md", "modified")
        fw._notify(ev)

        cb1.assert_called_once_with(ev)
        cb2.assert_called_once_with(ev)

    def test_notify_handles_callback_error(self):
        fw = FileWatcher()
        cb_bad = MagicMock(side_effect=RuntimeError("boom"))
        cb_good = MagicMock()
        fw.on_change(cb_bad)
        fw.on_change(cb_good)

        ev = FileChangeEvent("/test.md", "modified")
        fw._notify(ev)  # Should not raise

        cb_good.assert_called_once_with(ev)


# ============================================================
# FileWatcher - Pattern Matching
# ============================================================

class TestFileWatcherRelevance:

    def test_relevant_md(self):
        fw = FileWatcher(patterns=["*.md", "*.txt"])
        assert fw._is_relevant("/path/to/file.md") is True

    def test_relevant_txt(self):
        fw = FileWatcher(patterns=["*.md", "*.txt"])
        assert fw._is_relevant("/path/to/file.txt") is True

    def test_irrelevant_py(self):
        fw = FileWatcher(patterns=["*.md", "*.txt"])
        assert fw._is_relevant("/path/to/file.py") is False

    def test_default_patterns(self):
        fw = FileWatcher()
        assert fw._is_relevant("test.md") is True
        assert fw._is_relevant("test.txt") is True
        assert fw._is_relevant("test.json") is True
        assert fw._is_relevant("test.py") is False

    def test_exact_name_match(self):
        fw = FileWatcher(patterns=["Makefile"])
        assert fw._is_relevant("/path/to/Makefile") is True
        assert fw._is_relevant("/path/to/other") is False

    def test_case_insensitive_suffix(self):
        fw = FileWatcher(patterns=["*.MD"])
        # .MD pattern matches .md suffix (suffix is lowered, pattern check is suffix == pattern[1:])
        # pattern[1:] = ".MD", suffix = ".md" -> won't match because pattern isn't lowered
        # This documents current behavior
        assert fw._is_relevant("test.md") is False  # Pattern ".MD" != ".md"


# ============================================================
# FileWatcher - Debounce
# ============================================================

class TestFileWatcherDebounce:

    def test_first_event_not_debounced(self):
        fw = FileWatcher(debounce_seconds=1.0)
        assert fw._should_debounce("/test.md") is False

    def test_rapid_second_event_debounced(self):
        fw = FileWatcher(debounce_seconds=1.0)
        fw._should_debounce("/test.md")  # First event
        assert fw._should_debounce("/test.md") is True  # Too fast

    def test_different_files_independent(self):
        fw = FileWatcher(debounce_seconds=1.0)
        fw._should_debounce("/a.md")
        assert fw._should_debounce("/b.md") is False

    def test_after_debounce_period(self):
        fw = FileWatcher(debounce_seconds=0.01)
        fw._should_debounce("/test.md")
        time.sleep(0.02)
        assert fw._should_debounce("/test.md") is False


# ============================================================
# FileWatcher - Watch/Stop
# ============================================================

class TestFileWatcherWatchStop:

    def test_watch_nonexistent_dir(self):
        fw = FileWatcher()
        assert fw.watch("/nonexistent/dir/xyz") is False

    def test_watch_real_dir(self, tmp_path):
        fw = FileWatcher()
        assert fw.watch(str(tmp_path)) is True
        assert fw.is_running() is True
        fw.stop()
        assert fw.is_running() is False

    def test_watch_same_dir_twice(self, tmp_path):
        fw = FileWatcher()
        fw.watch(str(tmp_path))
        assert fw.watch(str(tmp_path)) is True  # Returns True, already watching
        fw.stop()

    def test_stop_without_start(self):
        fw = FileWatcher()
        fw.stop()  # Should not raise
        assert fw.is_running() is False


# ============================================================
# AutoSyncHandler
# ============================================================

class TestAutoSyncHandler:

    def test_is_relevant(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        assert h._is_relevant("/path/test.md") is True
        assert h._is_relevant("/path/test.txt") is True
        assert h._is_relevant("/path/test.py") is False

    def test_debounce(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        assert h._should_debounce("/test.md") is False
        assert h._should_debounce("/test.md") is True  # Too fast

    def test_on_modified_calls_callback(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h._debounce_seconds = 0  # Disable debounce

        event = MagicMock()
        event.is_directory = False
        event.src_path = "/tmp/test.md"

        h.on_modified(event)
        cb.assert_called_once_with("/tmp/test.md")

    def test_on_modified_skips_directory(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)

        event = MagicMock()
        event.is_directory = True
        event.src_path = "/tmp/dir/"

        h.on_modified(event)
        cb.assert_not_called()

    def test_on_modified_skips_irrelevant(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)

        event = MagicMock()
        event.is_directory = False
        event.src_path = "/tmp/test.py"

        h.on_modified(event)
        cb.assert_not_called()

    def test_on_created_calls_callback(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h._debounce_seconds = 0

        event = MagicMock()
        event.is_directory = False
        event.src_path = "/tmp/new.txt"

        h.on_created(event)
        cb.assert_called_once_with("/tmp/new.txt")


# ============================================================
# SyncResult
# ============================================================

class TestSyncResult:

    def test_basic(self):
        r = SyncResult("/path/test.md", True, "indexed", "ok")
        assert r.path == "/path/test.md"
        assert r.success is True
        assert r.action == "indexed"
        assert r.message == "ok"
        assert r.content_hash is None

    def test_to_dict(self):
        r = SyncResult("/test.md", True, "updated")
        r.content_hash = "abc123"
        d = r.to_dict()
        assert d["path"] == "/test.md"
        assert d["success"] is True
        assert d["action"] == "updated"
        assert d["content_hash"] == "abc123"
        assert "timestamp" in d


# ============================================================
# FileSyncService - Hash & Change Detection
# ============================================================

class TestFileSyncServiceHash:

    @pytest.fixture
    def sync_service(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        watch_dir = tmp_path / "watched"
        watch_dir.mkdir()
        writing_root = tmp_path / ".writing"
        return FileSyncService(
            knowledge_layer=kl,
            watch_paths=[str(watch_dir)],
            writing_root=str(writing_root)
        )

    def test_compute_file_hash(self, sync_service, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("hello", encoding="utf-8")
        h = sync_service._compute_file_hash(str(f))
        expected = hashlib.sha256(b"hello").hexdigest()
        assert h == expected

    def test_compute_file_hash_nonexistent(self, sync_service):
        h = sync_service._compute_file_hash("/nonexistent/file.txt")
        assert h is None

    def test_has_file_changed_new_file(self, sync_service, tmp_path):
        f = tmp_path / "new.txt"
        f.write_text("content", encoding="utf-8")
        assert sync_service._has_file_changed(str(f)) is True

    def test_has_file_changed_same(self, sync_service, tmp_path):
        f = tmp_path / "same.txt"
        f.write_text("content", encoding="utf-8")
        h = hashlib.sha256(b"content").hexdigest()
        sync_service._file_hashes[str(f)] = h
        assert sync_service._has_file_changed(str(f)) is False

    def test_determine_target_dir(self, sync_service, tmp_path):
        assert sync_service._determine_target_dir(Path("/a/citations/b.md")) == "citations"
        assert sync_service._determine_target_dir(Path("/a/memories/b.md")) == "memories"
        assert sync_service._determine_target_dir(Path("/a/other/b.md")) == "store"


# ============================================================
# FileSyncService - sync_file
# ============================================================

class TestFileSyncServiceSyncFile:

    @pytest.fixture
    def sync_env(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        watch_dir = tmp_path / "watched"
        watch_dir.mkdir()
        writing_root = tmp_path / ".writing"
        svc = FileSyncService(
            knowledge_layer=kl,
            watch_paths=[str(watch_dir)],
            writing_root=str(writing_root)
        )
        return svc, kl, watch_dir

    def test_sync_new_file(self, sync_env):
        svc, kl, watch_dir = sync_env
        f = watch_dir / "test.md"
        f.write_text("# Hello", encoding="utf-8")

        result = svc.sync_file(str(f))
        assert result.success is True
        assert result.action == "indexed"
        kl.add_document.assert_called_once()

    def test_sync_unchanged_file_skipped(self, sync_env):
        svc, kl, watch_dir = sync_env
        f = watch_dir / "test.md"
        f.write_text("content", encoding="utf-8")

        # First sync
        svc.sync_file(str(f))
        kl.add_document.reset_mock()

        # Second sync - unchanged
        result = svc.sync_file(str(f))
        assert result.action == "skipped"
        kl.add_document.assert_not_called()

    def test_sync_force(self, sync_env):
        svc, kl, watch_dir = sync_env
        f = watch_dir / "test.md"
        f.write_text("content", encoding="utf-8")

        # First sync
        svc.sync_file(str(f))
        kl.add_document.reset_mock()

        # Force sync
        result = svc.sync_file(str(f), force=True)
        assert result.action == "updated"
        kl.add_document.assert_called_once()

    def test_sync_deleted_file(self, sync_env):
        svc, kl, watch_dir = sync_env
        path = str(watch_dir / "gone.md")
        svc._file_hashes[path] = "oldhash"

        result = svc.sync_file(path)
        assert result.success is True
        assert result.action == "deleted"
        assert path not in svc._file_hashes

    def test_sync_updated_file(self, sync_env):
        svc, kl, watch_dir = sync_env
        f = watch_dir / "test.md"
        f.write_text("v1", encoding="utf-8")
        svc.sync_file(str(f))
        kl.add_document.reset_mock()

        # Modify file
        f.write_text("v2", encoding="utf-8")
        result = svc.sync_file(str(f))
        assert result.action == "updated"
        kl.add_document.assert_called_once()


# ============================================================
# FileSyncService - sync_directory
# ============================================================

class TestFileSyncServiceSyncDir:

    def test_sync_directory(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        watch_dir = tmp_path / "docs"
        watch_dir.mkdir()
        (watch_dir / "a.md").write_text("# A", encoding="utf-8")
        (watch_dir / "b.txt").write_text("B", encoding="utf-8")
        (watch_dir / "c.py").write_text("print()", encoding="utf-8")

        svc = FileSyncService(kl, [str(watch_dir)],
                              writing_root=str(tmp_path / ".writing"))

        results = svc.sync_directory(str(watch_dir))
        # Should sync .md and .txt but not .py (default patterns)
        synced_paths = [r.path for r in results]
        assert any("a.md" in p for p in synced_paths)
        assert any("b.txt" in p for p in synced_paths)
        assert not any("c.py" in p for p in synced_paths)

    def test_sync_directory_nonexistent(self, tmp_path):
        kl = MagicMock()
        svc = FileSyncService(kl, [], writing_root=str(tmp_path / ".writing"))
        results = svc.sync_directory("/nonexistent/dir")
        assert results == []

    def test_sync_directory_custom_patterns(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        d = tmp_path / "src"
        d.mkdir()
        (d / "a.py").write_text("code", encoding="utf-8")
        (d / "b.md").write_text("doc", encoding="utf-8")

        svc = FileSyncService(kl, [str(d)],
                              writing_root=str(tmp_path / ".writing"))
        results = svc.sync_directory(str(d), patterns=["*.py"])
        assert len(results) == 1
        assert "a.py" in results[0].path


# ============================================================
# FileSyncService - History & Index
# ============================================================

class TestFileSyncServiceHistory:

    def test_get_sync_history(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        d = tmp_path / "data"
        d.mkdir()
        (d / "a.md").write_text("A", encoding="utf-8")

        svc = FileSyncService(kl, [str(d)],
                              writing_root=str(tmp_path / ".writing"))
        svc.sync_file(str(d / "a.md"))

        history = svc.get_sync_history()
        assert len(history) >= 1
        assert history[0]["action"] == "indexed"

    def test_get_indexed_files(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        d = tmp_path / "data"
        d.mkdir()
        (d / "a.md").write_text("A", encoding="utf-8")

        svc = FileSyncService(kl, [str(d)],
                              writing_root=str(tmp_path / ".writing"))
        svc.sync_file(str(d / "a.md"))

        indexed = svc.get_indexed_files()
        assert len(indexed) == 1

    def test_hash_index_persistence(self, tmp_path):
        kl = MagicMock()
        kl.add_document = MagicMock()
        d = tmp_path / "data"
        d.mkdir()
        (d / "a.md").write_text("A", encoding="utf-8")
        writing = tmp_path / ".writing"

        svc = FileSyncService(kl, [str(d)], writing_root=str(writing))
        svc.sync_file(str(d / "a.md"))

        # Hash index should be saved
        index_path = writing / ".ok" / "index" / "file_hashes.json"
        assert index_path.exists()

        data = json.loads(index_path.read_text(encoding="utf-8"))
        assert len(data) == 1
