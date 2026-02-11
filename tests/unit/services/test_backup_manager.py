# -*- coding: utf-8 -*-
"""
BackupManager Tests

Tests for BackupInfo, BackupProgress, BackupManager
(local backup, restore, list, delete, get_backup).
WebDAV/S3 methods tested with mocked requests/boto3.
"""

import json
import gzip
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from datetime import datetime

from src.services.backup_manager import (
    BackupInfo,
    BackupProgress,
    BackupManager,
    get_backup_manager,
    reset_backup_manager,
)


# ============================================================
# BackupInfo
# ============================================================

class TestBackupInfo:

    def test_basic(self):
        info = BackupInfo(
            id="b1", name="test", source_path="/src", backup_path="/bak",
            size_bytes=100, file_count=5, checksum="abc",
            created_at=datetime.now()
        )
        assert info.id == "b1"
        assert info.file_count == 5

    def test_default_metadata(self):
        info = BackupInfo(
            id="b2", name="test", source_path="/src", backup_path="/bak",
            size_bytes=0, file_count=0, checksum="",
            created_at=datetime.now()
        )
        assert info.metadata == {}


# ============================================================
# BackupProgress
# ============================================================

class TestBackupProgress:

    def test_percent_zero(self):
        p = BackupProgress(total_files=0, completed_files=0, total_bytes=0, completed_bytes=0)
        assert p.percent == 0.0

    def test_percent_partial(self):
        p = BackupProgress(total_files=10, completed_files=5, total_bytes=1000, completed_bytes=500)
        assert p.percent == 50.0

    def test_percent_complete(self):
        p = BackupProgress(total_files=10, completed_files=10, total_bytes=1000, completed_bytes=1000)
        assert p.percent == 100.0

    def test_status_default(self):
        p = BackupProgress(total_files=0, completed_files=0, total_bytes=0, completed_bytes=0)
        assert p.status == "pending"


# ============================================================
# BackupManager init
# ============================================================

class TestBackupManagerInit:

    def test_creates_directory(self, tmp_path):
        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        assert backup_dir.exists()
        bm.close()

    def test_creates_db(self, tmp_path):
        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        assert (backup_dir / "backups.db").exists()
        bm.close()


# ============================================================
# create_backup
# ============================================================

class TestCreateBackup:

    def test_backup_single_file(self, tmp_path):
        # Setup
        source = tmp_path / "source.txt"
        source.write_text("hello world", encoding="utf-8")
        backup_dir = tmp_path / "backups"

        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source), compress=False)

        assert result["success"] is True
        assert result["file_count"] == 1
        assert "backup_id" in result
        bm.close()

    def test_backup_directory(self, tmp_path):
        # Setup directory with files
        source_dir = tmp_path / "source"
        source_dir.mkdir()
        (source_dir / "a.txt").write_text("file a", encoding="utf-8")
        (source_dir / "b.txt").write_text("file b", encoding="utf-8")
        sub = source_dir / "sub"
        sub.mkdir()
        (sub / "c.txt").write_text("file c", encoding="utf-8")

        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source_dir), compress=False)

        assert result["success"] is True
        assert result["file_count"] == 3
        bm.close()

    def test_backup_with_compression(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("compress me", encoding="utf-8")
        backup_dir = tmp_path / "backups"

        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source), compress=True)

        assert result["success"] is True
        # Verify compressed file exists
        backup_path = Path(result["backup_path"])
        gz_files = list(backup_path.rglob("*.gz"))
        assert len(gz_files) >= 1
        bm.close()

    def test_backup_nonexistent_source(self, tmp_path):
        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(tmp_path / "nonexistent"))
        assert result["success"] is False
        assert "not found" in result["error"].lower() or "Source not found" in result["error"]
        bm.close()

    def test_backup_custom_name(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        backup_dir = tmp_path / "backups"

        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source), backup_name="my_backup")
        assert result["success"] is True
        assert result["name"] == "my_backup"
        bm.close()

    def test_progress_callback(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        backup_dir = tmp_path / "backups"

        bm = BackupManager(backup_dir=str(backup_dir))
        progress_updates = []
        bm.set_progress_callback(lambda p: progress_updates.append(p.status))
        bm.create_backup(str(source), compress=False)

        assert "in_progress" in progress_updates
        assert "completed" in progress_updates
        bm.close()


# ============================================================
# restore_backup
# ============================================================

class TestRestoreBackup:

    def _create_and_backup(self, tmp_path):
        source = tmp_path / "source"
        source.mkdir()
        (source / "data.txt").write_text("original data", encoding="utf-8")

        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source), compress=False)
        return bm, result

    def test_restore_to_target(self, tmp_path):
        bm, result = self._create_and_backup(tmp_path)
        target = tmp_path / "restored"

        restore = bm.restore_backup(result["backup_id"], target_path=str(target))
        assert restore["success"] is True
        assert restore["file_count"] == 1
        assert (target / "data.txt").read_text(encoding="utf-8") == "original data"
        bm.close()

    def test_restore_compressed(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("compressed data", encoding="utf-8")
        backup_dir = tmp_path / "backups"

        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.create_backup(str(source), compress=True)

        target = tmp_path / "restored"
        restore = bm.restore_backup(result["backup_id"], target_path=str(target))
        assert restore["success"] is True
        bm.close()

    def test_restore_nonexistent_id(self, tmp_path):
        backup_dir = tmp_path / "backups"
        bm = BackupManager(backup_dir=str(backup_dir))
        result = bm.restore_backup("nonexistent-id")
        assert result["success"] is False
        bm.close()


# ============================================================
# list_backups
# ============================================================

class TestListBackups:

    def test_empty(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        assert bm.list_backups() == []
        bm.close()

    def test_after_backup(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        bm.create_backup(str(source), compress=False)

        backups = bm.list_backups()
        assert len(backups) == 1
        assert "id" in backups[0]
        assert "name" in backups[0]
        bm.close()

    def test_limit(self, tmp_path):
        source = tmp_path / "s.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))

        for _ in range(5):
            bm.create_backup(str(source), compress=False)

        backups = bm.list_backups(limit=2)
        assert len(backups) == 2
        bm.close()


# ============================================================
# delete_backup
# ============================================================

class TestDeleteBackup:

    def test_delete_existing(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        result = bm.create_backup(str(source), compress=False)

        assert bm.delete_backup(result["backup_id"]) is True
        assert bm.list_backups() == []
        # Backup directory should be removed
        assert not Path(result["backup_path"]).exists()
        bm.close()

    def test_delete_nonexistent(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        assert bm.delete_backup("nonexistent") is False
        bm.close()


# ============================================================
# get_backup
# ============================================================

class TestGetBackup:

    def test_get_existing(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        result = bm.create_backup(str(source), compress=False)

        info = bm.get_backup(result["backup_id"])
        assert isinstance(info, BackupInfo)
        assert info.id == result["backup_id"]
        assert info.file_count == 1
        bm.close()

    def test_get_nonexistent(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        assert bm.get_backup("nonexistent") is None
        bm.close()


# ============================================================
# WebDAV (mocked)
# ============================================================

class TestWebDAV:

    def test_backup_to_webdav_no_requests(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        result = bm.create_backup(str(source), compress=False)

        with patch.dict("sys.modules", {"requests": None}):
            webdav_result = bm.backup_to_webdav(result["backup_id"], {})
            assert webdav_result["success"] is False
        bm.close()

    def test_backup_to_webdav_not_found(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        # Mock requests import
        mock_requests = MagicMock()
        with patch.dict("sys.modules", {"requests": mock_requests, "requests.auth": MagicMock()}):
            result = bm.backup_to_webdav("nonexistent", {"url": "http://test"})
            assert result["success"] is False
        bm.close()

    def test_restore_from_webdav_no_requests(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        with patch.dict("sys.modules", {"requests": None}):
            result = bm.restore_from_webdav("/path", {})
            assert result["success"] is False
        bm.close()


# ============================================================
# S3 (mocked)
# ============================================================

class TestS3:

    def test_backup_to_s3_no_boto3(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        result = bm.create_backup(str(source), compress=False)

        with patch.dict("sys.modules", {"boto3": None, "botocore": None, "botocore.config": None}):
            s3_result = bm.backup_to_s3(result["backup_id"], {})
            assert s3_result["success"] is False
        bm.close()

    def test_backup_to_s3_not_found(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        mock_boto = MagicMock()
        with patch.dict("sys.modules", {"boto3": mock_boto, "botocore": MagicMock(), "botocore.config": MagicMock()}):
            result = bm.backup_to_s3("nonexistent", {"bucket": "test"})
            assert result["success"] is False
        bm.close()

    def test_restore_from_s3_no_boto3(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        with patch.dict("sys.modules", {"boto3": None}):
            result = bm.restore_from_s3("key", {})
            assert result["success"] is False
        bm.close()


# ============================================================
# Singleton functions
# ============================================================

class TestSingleton:

    def test_get_and_reset(self, tmp_path):
        reset_backup_manager()
        bm = get_backup_manager(backup_dir=str(tmp_path / "backups"))
        assert isinstance(bm, BackupManager)

        bm2 = get_backup_manager()
        assert bm is bm2

        reset_backup_manager()
        bm3 = get_backup_manager(backup_dir=str(tmp_path / "backups2"))
        assert bm3 is not bm


# ============================================================
# _compute_file_checksum
# ============================================================

class TestComputeChecksum:

    def test_deterministic(self, tmp_path):
        f = tmp_path / "check.txt"
        f.write_text("hello", encoding="utf-8")

        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        cs1 = bm._compute_file_checksum(f)
        cs2 = bm._compute_file_checksum(f)
        assert cs1 == cs2
        assert len(cs1) == 64  # SHA-256 hex digest
        bm.close()


# ============================================================
# _collect_files
# ============================================================

class TestCollectFiles:

    def test_single_file(self, tmp_path):
        f = tmp_path / "single.txt"
        f.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        files = bm._collect_files(f)
        assert len(files) == 1
        bm.close()

    def test_directory(self, tmp_path):
        d = tmp_path / "dir"
        d.mkdir()
        (d / "a.txt").write_text("a", encoding="utf-8")
        (d / "b.txt").write_text("b", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        files = bm._collect_files(d)
        assert len(files) == 2
        bm.close()


# ============================================================
# progress callback error handling
# ============================================================

class TestProgressCallbackError:

    def test_callback_error_does_not_crash(self, tmp_path):
        source = tmp_path / "source.txt"
        source.write_text("data", encoding="utf-8")
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))

        def bad_callback(progress):
            raise RuntimeError("callback error")

        bm.set_progress_callback(bad_callback)
        result = bm.create_backup(str(source), compress=False)
        assert result["success"] is True
        bm.close()

    def test_close_idempotent(self, tmp_path):
        bm = BackupManager(backup_dir=str(tmp_path / "backups"))
        bm.close()
        bm.close()  # Should not raise
