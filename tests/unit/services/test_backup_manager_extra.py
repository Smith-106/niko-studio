# -*- coding: utf-8 -*-
"""BackupManager extra tests - create, restore, list, delete, get, progress."""

import pytest
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.services.backup_manager import BackupManager, BackupProgress, BackupInfo


class TestBackupProgress:
    def test_percent_zero(self):
        p = BackupProgress(total_files=0, completed_files=0, total_bytes=0, completed_bytes=0)
        assert p.percent == 0.0

    def test_percent_half(self):
        p = BackupProgress(total_files=2, completed_files=1, total_bytes=100, completed_bytes=50)
        assert p.percent == 50.0


class TestBackupManager:
    @pytest.fixture()
    def mgr(self, tmp_path):
        return BackupManager(backup_dir=str(tmp_path / "backups"))

    def test_init(self, mgr):
        assert mgr.backup_dir.exists()
        assert mgr.db_path.exists()

    def test_create_backup_source_not_found(self, mgr):
        result = mgr.create_backup("/nonexistent/path")
        assert result["success"] is False

    def test_create_backup_single_file(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello world", encoding="utf-8")
        result = mgr.create_backup(str(f))
        assert result["success"] is True
        assert result["file_count"] == 1

    def test_create_backup_directory(self, mgr, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("aaa", encoding="utf-8")
        (d / "b.txt").write_text("bbb", encoding="utf-8")
        result = mgr.create_backup(str(d), backup_name="test_backup")
        assert result["success"] is True
        assert result["file_count"] == 2

    def test_create_backup_no_compress(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        result = mgr.create_backup(str(f), compress=False)
        assert result["success"] is True

    def test_create_backup_with_progress(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        progress_calls = []
        mgr.set_progress_callback(lambda p: progress_calls.append(p.status))
        result = mgr.create_backup(str(f))
        assert result["success"] is True
        assert "completed" in progress_calls

    def test_progress_callback_error(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        mgr.set_progress_callback(MagicMock(side_effect=RuntimeError("fail")))
        result = mgr.create_backup(str(f))
        assert result["success"] is True  # should not fail

    def test_list_backups(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        mgr.create_backup(str(f))
        backups = mgr.list_backups()
        assert len(backups) == 1
        assert "id" in backups[0]

    def test_get_backup(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        result = mgr.create_backup(str(f))
        info = mgr.get_backup(result["backup_id"])
        assert isinstance(info, BackupInfo)
        assert info.id == result["backup_id"]

    def test_get_backup_not_found(self, mgr):
        assert mgr.get_backup("nonexistent") is None

    def test_delete_backup(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        result = mgr.create_backup(str(f))
        assert mgr.delete_backup(result["backup_id"]) is True
        assert mgr.get_backup(result["backup_id"]) is None

    def test_delete_backup_not_found(self, mgr):
        assert mgr.delete_backup("nonexistent") is False

    def test_restore_backup(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello world", encoding="utf-8")
        result = mgr.create_backup(str(f), compress=False)
        restore_dir = tmp_path / "restored"
        restore_result = mgr.restore_backup(result["backup_id"], str(restore_dir))
        assert restore_result["success"] is True
        assert restore_result["file_count"] == 1

    def test_restore_backup_not_found(self, mgr):
        result = mgr.restore_backup("nonexistent")
        assert result["success"] is False

    def test_restore_backup_compressed(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("compressed content", encoding="utf-8")
        result = mgr.create_backup(str(f), compress=True)
        restore_dir = tmp_path / "restored"
        restore_result = mgr.restore_backup(result["backup_id"], str(restore_dir))
        assert restore_result["success"] is True

    def test_collect_files_single(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("x", encoding="utf-8")
        files = mgr._collect_files(f)
        assert len(files) == 1

    def test_collect_files_dir(self, mgr, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("a", encoding="utf-8")
        (d / "b.md").write_text("b", encoding="utf-8")
        files = mgr._collect_files(d)
        assert len(files) == 2

    def test_compute_file_checksum(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        cs = mgr._compute_file_checksum(f)
        assert isinstance(cs, str)
        assert len(cs) == 64  # sha256 hex

    def test_webdav_no_requests(self, mgr, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("hello", encoding="utf-8")
        result = mgr.create_backup(str(f))
        with patch.dict("sys.modules", {"requests": None}):
            with patch("builtins.__import__", side_effect=ImportError("no requests")):
                r = mgr.backup_to_webdav(result["backup_id"], {})
                assert r["success"] is False

    def test_webdav_backup_not_found(self, mgr):
        r = mgr.backup_to_webdav("nonexistent", {"url": "http://x"})
        assert r["success"] is False
