import gzip
import sys
import types
from pathlib import Path

from src.services.backup_manager import BackupManager


def test_create_and_restore_backup_roundtrip(tmp_path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    (source_dir / "note.txt").write_text("hello backup", encoding="utf-8")
    (source_dir / "archive.zip").write_bytes(b"PKFAKE")

    manager = BackupManager(backup_dir=str(tmp_path / "backups"))

    result = manager.create_backup(str(source_dir), compress=True)
    assert result["success"] is True
    assert result["file_count"] == 2

    backup = manager.get_backup(result["backup_id"])
    assert backup is not None
    assert backup.file_count == 2

    backup_path = Path(result["backup_path"])
    assert (backup_path / "note.txt.gz").exists()
    assert (backup_path / "archive.zip").exists()

    restored_dir = tmp_path / "restored"
    restored = manager.restore_backup(result["backup_id"], target_path=str(restored_dir))

    assert restored["success"] is True
    assert (restored_dir / "note.txt").read_text(encoding="utf-8") == "hello backup"
    assert (restored_dir / "archive.zip").read_bytes() == b"PKFAKE"

    manager.close()


def test_create_backup_with_missing_source_returns_error(tmp_path):
    manager = BackupManager(backup_dir=str(tmp_path / "backups"))

    result = manager.create_backup(str(tmp_path / "does-not-exist"))

    assert result["success"] is False
    assert "Source not found" in result["error"]
    manager.close()


def test_delete_backup_removes_files_and_records(tmp_path):
    source_file = tmp_path / "single.txt"
    source_file.write_text("single", encoding="utf-8")

    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    created = manager.create_backup(str(source_file), compress=False)
    backup_id = created["backup_id"]

    assert manager.get_backup(backup_id) is not None
    assert manager.delete_backup(backup_id) is True
    assert manager.get_backup(backup_id) is None

    manager.close()


def test_progress_callback_reports_completion(tmp_path):
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    for idx in range(3):
        (source_dir / f"f{idx}.txt").write_text(f"data-{idx}", encoding="utf-8")

    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    statuses = []

    def _callback(progress):
        statuses.append(progress.status)

    manager.set_progress_callback(_callback)
    result = manager.create_backup(str(source_dir), compress=True)

    assert result["success"] is True
    assert "in_progress" in statuses
    assert statuses[-1] == "completed"
    manager.close()


def test_backup_to_webdav_with_mock_requests(tmp_path, monkeypatch):
    source_file = tmp_path / "webdav.txt"
    source_file.write_text("webdav", encoding="utf-8")
    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    created = manager.create_backup(str(source_file), compress=False)

    requests_module = types.SimpleNamespace()

    class _Response:
        def raise_for_status(self):
            return None

    calls = {"mkcol": 0, "put": 0}

    def _request(method, *_args, **_kwargs):
        if method == "MKCOL":
            calls["mkcol"] += 1
        return _Response()

    def _put(*_args, **_kwargs):
        calls["put"] += 1
        return _Response()

    requests_module.request = _request
    requests_module.put = _put

    auth_module = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

    monkeypatch.setitem(sys.modules, "requests", requests_module)
    monkeypatch.setitem(sys.modules, "requests.auth", auth_module)

    result = manager.backup_to_webdav(
        created["backup_id"],
        {
            "url": "https://example.com/dav",
            "username": "u",
            "password": "p",
            "remote_path": "/backups",
        },
    )

    assert result["success"] is True
    assert result["file_count"] >= 1
    assert calls["mkcol"] >= 1
    assert calls["put"] >= 1
    manager.close()


def test_backup_to_webdav_rejects_non_loopback_http(tmp_path):
    source_file = tmp_path / "webdav-http.txt"
    source_file.write_text("webdav", encoding="utf-8")
    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    created = manager.create_backup(str(source_file), compress=False)

    result = manager.backup_to_webdav(
        created["backup_id"],
        {
            "url": "http://example.com/dav",
            "username": "u",
            "password": "p",
            "remote_path": "/backups",
        },
    )

    assert result["success"] is False
    assert "must use https" in result["error"]
    manager.close()


def test_backup_to_webdav_allows_loopback_http(tmp_path, monkeypatch):
    source_file = tmp_path / "webdav-local.txt"
    source_file.write_text("webdav", encoding="utf-8")
    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    created = manager.create_backup(str(source_file), compress=False)

    requests_module = types.SimpleNamespace()

    class _Response:
        def raise_for_status(self):
            return None

    calls = {"mkcol": 0, "put": 0}

    def _request(method, *_args, **_kwargs):
        if method == "MKCOL":
            calls["mkcol"] += 1
        return _Response()

    def _put(*_args, **_kwargs):
        calls["put"] += 1
        return _Response()

    requests_module.request = _request
    requests_module.put = _put

    auth_module = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

    monkeypatch.setitem(sys.modules, "requests", requests_module)
    monkeypatch.setitem(sys.modules, "requests.auth", auth_module)

    result = manager.backup_to_webdav(
        created["backup_id"],
        {
            "url": "http://localhost:8080/dav",
            "username": "u",
            "password": "p",
            "remote_path": "/backups",
        },
    )

    assert result["success"] is True
    assert calls["put"] >= 1
    manager.close()


def test_backup_to_and_restore_from_s3_with_mock_boto3(tmp_path, monkeypatch):
    source_file = tmp_path / "s3.txt"
    source_file.write_text("s3-content", encoding="utf-8")

    manager = BackupManager(backup_dir=str(tmp_path / "backups"))
    created = manager.create_backup(str(source_file), compress=False)

    downloaded = []

    class _Paginator:
        def paginate(self, **_kwargs):
            return [{"Contents": [{"Key": "prefix/backup-id/s3.txt"}]}]

    class _S3Client:
        def upload_file(self, *_args, **_kwargs):
            return None

        def get_paginator(self, name):
            assert name == "list_objects_v2"
            return _Paginator()

        def download_file(self, _bucket, key, path):
            Path(path).write_text(f"downloaded:{key}", encoding="utf-8")
            downloaded.append(path)

    boto3_module = types.SimpleNamespace(client=lambda **_kwargs: _S3Client())
    monkeypatch.setitem(sys.modules, "boto3", boto3_module)
    monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
    monkeypatch.setitem(sys.modules, "botocore.config", types.SimpleNamespace(Config=object))

    upload_result = manager.backup_to_s3(
        created["backup_id"],
        {
            "bucket": "bucket-a",
            "prefix": "prefix",
            "aws_access_key_id": "k",
            "aws_secret_access_key": "s",
        },
    )
    assert upload_result["success"] is True

    restore_result = manager.restore_from_s3(
        "prefix/backup-id",
        {
            "bucket": "bucket-a",
            "aws_access_key_id": "k",
            "aws_secret_access_key": "s",
        },
        target_path=str(tmp_path / "s3-restore"),
    )

    assert restore_result["success"] is True
    assert restore_result["file_count"] == 1
    assert downloaded
    manager.close()
