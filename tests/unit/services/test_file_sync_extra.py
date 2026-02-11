# -*- coding: utf-8 -*-
"""FileSyncService, FileWatcher, _InternalHandler, AutoSyncHandler extra tests."""

import time
import json
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from pathlib import Path

from src.services.file_sync import (
    FileChangeEvent, FileWatcher, _InternalHandler,
    AutoSyncHandler, SyncResult, FileSyncService,
)


class TestFileChangeEvent:
    def test_init_defaults(self):
        e = FileChangeEvent("/tmp/a.md", "created")
        assert e.path == "/tmp/a.md"
        assert e.event_type == "created"
        assert e.content_hash is None

    def test_compute_hash_success(self, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        e = FileChangeEvent(str(f), "modified")
        h = e.compute_hash()
        assert h is not None
        assert e.content_hash == h

    def test_compute_hash_missing_file(self):
        e = FileChangeEvent("/nonexistent/file.md", "modified")
        assert e.compute_hash() is None


class TestFileWatcher:
    def test_on_change_and_remove(self):
        w = FileWatcher()
        cb = MagicMock()
        w.on_change(cb)
        assert cb in w._callbacks
        w.remove_callback(cb)
        assert cb not in w._callbacks

    def test_remove_nonexistent_callback(self):
        w = FileWatcher()
        w.remove_callback(MagicMock())  # no error

    def test_watch_nonexistent_dir(self):
        w = FileWatcher()
        assert w.watch("/nonexistent/dir/xyz") is False

    def test_is_relevant(self):
        w = FileWatcher(patterns=["*.md", "*.txt"])
        assert w._is_relevant("/tmp/test.md") is True
        assert w._is_relevant("/tmp/test.py") is False

    def test_is_relevant_exact_name(self):
        w = FileWatcher(patterns=["Makefile"])
        assert w._is_relevant("/tmp/Makefile") is True

    def test_should_debounce(self):
        w = FileWatcher(debounce_seconds=10)
        assert w._should_debounce("/tmp/a.md") is False  # first time
        assert w._should_debounce("/tmp/a.md") is True   # within debounce

    def test_notify_calls_callbacks(self):
        w = FileWatcher()
        cb = MagicMock()
        w.on_change(cb)
        event = FileChangeEvent("/tmp/a.md", "modified")
        w._notify(event)
        cb.assert_called_once_with(event)

    def test_notify_handles_callback_error(self):
        w = FileWatcher()
        cb = MagicMock(side_effect=RuntimeError("fail"))
        w.on_change(cb)
        event = FileChangeEvent("/tmp/a.md", "modified")
        w._notify(event)  # should not raise

    def test_watch_and_stop(self, tmp_path):
        w = FileWatcher()
        assert w.watch(str(tmp_path)) is True
        assert w.is_running() is True
        # watch same dir again
        assert w.watch(str(tmp_path)) is True
        w.stop()
        assert w.is_running() is False


class TestInternalHandler:
    def _make_event(self, src_path, is_dir=False):
        e = MagicMock()
        e.src_path = src_path
        e.is_directory = is_dir
        return e

    def test_on_modified_file(self, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("content", encoding="utf-8")
        w = FileWatcher(patterns=["*.md"], debounce_seconds=0)
        cb = MagicMock()
        w.on_change(cb)
        handler = _InternalHandler(w)
        handler.on_modified(self._make_event(str(f)))
        assert cb.called

    def test_on_modified_dir_ignored(self):
        w = FileWatcher()
        handler = _InternalHandler(w)
        handler.on_modified(self._make_event("/tmp", is_dir=True))
        # no error, just returns

    def test_on_modified_irrelevant(self):
        w = FileWatcher(patterns=["*.md"])
        cb = MagicMock()
        w.on_change(cb)
        handler = _InternalHandler(w)
        handler.on_modified(self._make_event("/tmp/test.py"))
        cb.assert_not_called()

    def test_on_created_file(self, tmp_path):
        f = tmp_path / "new.md"
        f.write_text("new", encoding="utf-8")
        w = FileWatcher(patterns=["*.md"], debounce_seconds=0)
        cb = MagicMock()
        w.on_change(cb)
        handler = _InternalHandler(w)
        handler.on_created(self._make_event(str(f)))
        assert cb.called

    def test_on_created_dir_ignored(self):
        w = FileWatcher()
        handler = _InternalHandler(w)
        handler.on_created(self._make_event("/tmp", is_dir=True))

    def test_on_deleted_file(self):
        w = FileWatcher(patterns=["*.md"], debounce_seconds=0)
        cb = MagicMock()
        w.on_change(cb)
        handler = _InternalHandler(w)
        handler.on_deleted(self._make_event("/tmp/test.md"))
        assert cb.called

    def test_on_deleted_dir_ignored(self):
        w = FileWatcher()
        handler = _InternalHandler(w)
        handler.on_deleted(self._make_event("/tmp", is_dir=True))

    def test_on_deleted_irrelevant(self):
        w = FileWatcher(patterns=["*.md"])
        cb = MagicMock()
        w.on_change(cb)
        handler = _InternalHandler(w)
        handler.on_deleted(self._make_event("/tmp/test.py"))
        cb.assert_not_called()


class TestAutoSyncHandler:
    def test_on_modified(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        e = MagicMock(is_directory=False, src_path="/tmp/test.md")
        h._debounce_seconds = 0
        h.on_modified(e)
        cb.assert_called_once_with("/tmp/test.md")

    def test_on_modified_dir_ignored(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h.on_modified(MagicMock(is_directory=True, src_path="/tmp"))
        cb.assert_not_called()

    def test_on_modified_irrelevant(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h.on_modified(MagicMock(is_directory=False, src_path="/tmp/test.py"))
        cb.assert_not_called()

    def test_on_created(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h._debounce_seconds = 0
        h.on_created(MagicMock(is_directory=False, src_path="/tmp/test.json"))
        cb.assert_called_once()

    def test_on_created_dir_ignored(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h.on_created(MagicMock(is_directory=True, src_path="/tmp"))
        cb.assert_not_called()

    def test_debounce(self):
        cb = MagicMock()
        h = AutoSyncHandler(cb)
        h._debounce_seconds = 100
        e = MagicMock(is_directory=False, src_path="/tmp/test.md")
        h.on_modified(e)
        cb.assert_called_once()
        cb.reset_mock()
        h.on_modified(e)  # debounced
        cb.assert_not_called()


class TestSyncResult:
    def test_to_dict(self):
        r = SyncResult("/tmp/a.md", True, "indexed", "ok")
        d = r.to_dict()
        assert d["path"] == "/tmp/a.md"
        assert d["success"] is True
        assert d["action"] == "indexed"


class TestFileSyncService:
    @pytest.fixture()
    def svc(self, tmp_path):
        kl = MagicMock()
        writing_root = tmp_path / ".writing"
        writing_root.mkdir()
        with patch("src.services.file_sync.Observer"):
            s = FileSyncService(kl, [str(tmp_path)], writing_root=str(writing_root))
        return s

    def test_load_hash_index(self, tmp_path):
        kl = MagicMock()
        writing_root = tmp_path / ".writing"
        idx_dir = writing_root / ".ok" / "index"
        idx_dir.mkdir(parents=True)
        (idx_dir / "file_hashes.json").write_text('{"a": "hash1"}', encoding="utf-8")
        with patch("src.services.file_sync.Observer"):
            s = FileSyncService(kl, [str(tmp_path)], writing_root=str(writing_root))
        assert s._file_hashes == {"a": "hash1"}

    def test_save_hash_index(self, svc, tmp_path):
        svc._file_hashes = {"b": "hash2"}
        svc._save_hash_index()
        idx = svc.writing_root / ".ok" / "index" / "file_hashes.json"
        assert idx.exists()
        data = json.loads(idx.read_text(encoding="utf-8"))
        assert data["b"] == "hash2"

    def test_compute_file_hash(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        h = svc._compute_file_hash(str(f))
        assert h is not None

    def test_compute_file_hash_missing(self, svc):
        assert svc._compute_file_hash("/nonexistent") is None

    def test_has_file_changed_new(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        assert svc._has_file_changed(str(f)) is True

    def test_has_file_changed_same(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc._file_hashes[str(f)] = svc._compute_file_hash(str(f))
        assert svc._has_file_changed(str(f)) is False

    def test_determine_target_dir(self, svc):
        assert svc._determine_target_dir(Path("/x/citations/a.md")) == "citations"
        assert svc._determine_target_dir(Path("/x/memories/a.md")) == "memories"
        assert svc._determine_target_dir(Path("/x/other/a.md")) == "store"

    def test_sync_file_deleted(self, svc):
        svc._file_hashes["/gone.md"] = "old"
        r = svc.sync_file("/gone.md")
        assert r.action == "deleted"
        assert "/gone.md" not in svc._file_hashes

    def test_sync_file_skipped(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc._file_hashes[str(f)] = svc._compute_file_hash(str(f))
        r = svc.sync_file(str(f))
        assert r.action == "skipped"

    def test_sync_file_indexed(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        r = svc.sync_file(str(f))
        assert r.action == "indexed"
        assert r.success is True

    def test_sync_file_updated(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc._file_hashes[str(f)] = "oldhash"
        r = svc.sync_file(str(f))
        assert r.action == "updated"

    def test_sync_file_force(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc._file_hashes[str(f)] = svc._compute_file_hash(str(f))
        r = svc.sync_file(str(f), force=True)
        assert r.action == "updated"

    def test_sync_file_error(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc.knowledge_layer.add_document.side_effect = RuntimeError("fail")
        r = svc.sync_file(str(f))
        assert r.success is False

    def test_sync_directory(self, svc, tmp_path):
        (tmp_path / "a.md").write_text("aaa", encoding="utf-8")
        (tmp_path / "b.txt").write_text("bbb", encoding="utf-8")
        results = svc.sync_directory(str(tmp_path), patterns=["*.md"])
        assert len(results) >= 1

    def test_sync_directory_nonexistent(self, svc):
        results = svc.sync_directory("/nonexistent/dir")
        assert results == []

    def test_get_sync_history(self, svc, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        svc.sync_file(str(f))
        history = svc.get_sync_history()
        assert len(history) >= 1

    def test_get_indexed_files(self, svc):
        svc._file_hashes = {"a": "h1"}
        assert svc.get_indexed_files() == {"a": "h1"}
