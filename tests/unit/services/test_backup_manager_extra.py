# -*- coding: utf-8 -*-
"""BackupManager extra tests - create, restore, list, delete, get, progress."""

import pytest
import json
import sys
import types
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


class TestBackupManagerAdditionalBranches:
    @pytest.fixture()
    def mgr(self, tmp_path):
        return BackupManager(backup_dir=str(tmp_path / "backups"))

    def test_create_backup_exception_cleans_up(self, mgr, tmp_path):
        source = tmp_path / "src"
        source.mkdir()
        (source / "a.txt").write_text("a", encoding="utf-8")

        with patch.object(mgr, "_collect_files", side_effect=RuntimeError("boom")):
            result = mgr.create_backup(str(source))

        assert result["success"] is False
        assert "boom" in result["error"]
        assert list(mgr.backup_dir.iterdir()) == [mgr.db_path]

    def test_restore_backup_data_missing(self, mgr, tmp_path):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)
        import shutil
        shutil.rmtree(Path(created["backup_path"]))

        result = mgr.restore_backup(created["backup_id"], target_path=str(tmp_path / "out"))
        assert result["success"] is False
        assert "Backup data missing" in result["error"]

    def test_restore_backup_default_target_and_checksum_mismatch_branch(self, mgr, tmp_path):
        source = tmp_path / "src"
        source.mkdir()
        (source / "a.txt").write_text("abc", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        with patch.object(mgr, "_compute_file_checksum", return_value="mismatch"):
            result = mgr.restore_backup(created["backup_id"], target_path=None, verify_checksum=True)

        assert result["success"] is True

    def test_restore_backup_exception_branch(self, mgr, tmp_path):
        source = tmp_path / "src"
        source.mkdir()
        (source / "a.txt").write_text("abc", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        with patch("src.services.backup_manager.shutil.copy2", side_effect=RuntimeError("copy-failed")):
            result = mgr.restore_backup(created["backup_id"], target_path=str(tmp_path / "restore"))

        assert result["success"] is False
        assert "copy-failed" in result["error"]

    def test_backup_to_webdav_backup_data_missing(self, mgr, tmp_path):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)
        import shutil
        shutil.rmtree(Path(created["backup_path"]))

        result = mgr.backup_to_webdav(created["backup_id"], {"url": "https://example.com"})
        assert result["success"] is False
        assert "Backup data missing" in result["error"]

    def test_backup_to_webdav_nested_parent_mkcol_branch(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "src"
        nested = source / "sub"
        nested.mkdir(parents=True)
        (nested / "a.txt").write_text("abc", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        calls = []

        class Response:
            def raise_for_status(self):
                return None

        req = types.SimpleNamespace()

        def request(method, url, **kwargs):
            calls.append((method, url))
            return Response()

        req.request = request
        req.put = lambda *args, **kwargs: Response()
        auth_mod = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

        monkeypatch.setitem(sys.modules, "requests", req)
        monkeypatch.setitem(sys.modules, "requests.auth", auth_mod)

        result = mgr.backup_to_webdav(
            created["backup_id"],
            {"url": "https://example.com", "username": "u", "password": "p", "remote_path": "/backup"},
        )

        assert result["success"] is True
        assert any(method == "MKCOL" and url.endswith("/sub") for method, url in calls)

    def test_backup_to_webdav_upload_exception(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        class Response:
            def raise_for_status(self):
                return None

        req = types.SimpleNamespace()
        req.request = lambda *args, **kwargs: Response()
        req.put = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("put-fail"))
        auth_mod = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

        monkeypatch.setitem(sys.modules, "requests", req)
        monkeypatch.setitem(sys.modules, "requests.auth", auth_mod)

        result = mgr.backup_to_webdav(created["backup_id"], {"url": "https://example.com"})
        assert result["success"] is False
        assert result["error"] == "WebDAV upload failed"
        assert "put-fail" not in result["error"]

    def test_restore_from_webdav_success(self, mgr, tmp_path, monkeypatch):
        class Response:
            def __init__(self, content=b"", text=""):
                self.content = content
                self.text = text

            def raise_for_status(self):
                return None

        xml = (
            b"<d:multistatus xmlns:d='DAV:'>"
            b"<d:response><d:href>/remote/path/</d:href></d:response>"
            b"<d:response><d:href>/remote/path/a.txt</d:href></d:response>"
            b"</d:multistatus>"
        )

        req = types.SimpleNamespace()
        req.request = lambda *args, **kwargs: Response(content=xml)
        req.get = lambda *args, **kwargs: Response(content=b"data")
        auth_mod = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

        monkeypatch.setitem(sys.modules, "requests", req)
        monkeypatch.setitem(sys.modules, "requests.auth", auth_mod)

        result = mgr.restore_from_webdav(
            "/remote/path",
            {"url": "https://example.com", "username": "u", "password": "p"},
            target_path=str(tmp_path / "webdav_restore"),
        )

        assert result["success"] is True
        assert result["file_count"] == 1
        assert (tmp_path / "webdav_restore" / "a.txt").read_bytes() == b"data"

    def test_restore_from_webdav_exception(self, mgr, monkeypatch):
        req = types.SimpleNamespace()
        req.request = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("propfind-fail"))
        req.get = lambda *args, **kwargs: None
        auth_mod = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

        monkeypatch.setitem(sys.modules, "requests", req)
        monkeypatch.setitem(sys.modules, "requests.auth", auth_mod)

        result = mgr.restore_from_webdav("/remote/path", {"url": "https://example.com"})
        assert result["success"] is False
        assert result["error"] == "WebDAV restore failed"
        assert "propfind-fail" not in result["error"]

    def test_restore_from_webdav_skips_response_without_href(self, mgr, tmp_path, monkeypatch):
        class Response:
            def __init__(self, content=b""):
                self.content = content

            def raise_for_status(self):
                return None

        xml = (
            b"<d:multistatus xmlns:d='DAV:'>"
            b"<d:response><d:propstat /></d:response>"
            b"<d:response><d:href>/remote/path/a.txt</d:href></d:response>"
            b"</d:multistatus>"
        )

        req = types.SimpleNamespace()
        req.request = lambda *args, **kwargs: Response(content=xml)
        req.get = lambda *args, **kwargs: Response(content=b"data")
        auth_mod = types.SimpleNamespace(HTTPBasicAuth=lambda u, p: (u, p))

        monkeypatch.setitem(sys.modules, "requests", req)
        monkeypatch.setitem(sys.modules, "requests.auth", auth_mod)

        result = mgr.restore_from_webdav(
            "/remote/path",
            {"url": "https://example.com"},
            target_path=str(tmp_path / "webdav_restore_skip"),
        )

        assert result["success"] is True
        assert result["file_count"] == 1

    def test_backup_to_s3_backup_data_missing(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)
        import shutil
        shutil.rmtree(Path(created["backup_path"]))

        boto3_mod = types.SimpleNamespace(client=lambda **kwargs: object())
        cfg_mod = types.SimpleNamespace(Config=object)
        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)
        monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
        monkeypatch.setitem(sys.modules, "botocore.config", cfg_mod)

        result = mgr.backup_to_s3(created["backup_id"], {"bucket": "b"})
        assert result["success"] is False
        assert "Backup data missing" in result["error"]

    def test_backup_to_s3_endpoint_and_exception_branch(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        captured = {}

        class BadClient:
            def upload_file(self, *args, **kwargs):
                raise RuntimeError("upload-fail")

        def fake_client(**kwargs):
            captured.update(kwargs)
            return BadClient()

        boto3_mod = types.SimpleNamespace(client=fake_client)
        cfg_mod = types.SimpleNamespace(Config=object)

        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)
        monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
        monkeypatch.setitem(sys.modules, "botocore.config", cfg_mod)

        result = mgr.backup_to_s3(
            created["backup_id"],
            {
                "bucket": "b",
                "endpoint_url": "http://minio:9000",
                "aws_access_key_id": "k",
                "aws_secret_access_key": "s",
            },
        )

        assert captured["endpoint_url"] == "http://minio:9000"
        assert result["success"] is False
        assert result["error"] == "S3 upload failed"
        assert "upload-fail" not in result["error"]

    def test_create_backup_exception_when_cleanup_target_already_missing(self, mgr, tmp_path):
        source = tmp_path / "src-missing-cleanup"
        source.mkdir()
        (source / "a.txt").write_text("a", encoding="utf-8")

        def boom_after_removing_backup_dir(_source):
            for item in mgr.backup_dir.iterdir():
                if item != mgr.db_path:
                    import shutil
                    shutil.rmtree(item)
            raise RuntimeError("boom-no-cleanup")

        with patch.object(mgr, "_collect_files", side_effect=boom_after_removing_backup_dir):
            result = mgr.create_backup(str(source))

        assert result["success"] is False
        assert "boom-no-cleanup" in result["error"]

    def test_restore_backup_without_checksum_verification(self, mgr, tmp_path):
        source = tmp_path / "plain.txt"
        source.write_text("abc", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        with patch.object(mgr, "_compute_file_checksum", side_effect=AssertionError("should not run")):
            result = mgr.restore_backup(
                created["backup_id"],
                target_path=str(tmp_path / "restore-no-verify"),
                verify_checksum=False,
            )

        assert result["success"] is True
        assert result["file_count"] == 1

    def test_delete_backup_when_directory_already_missing(self, mgr, tmp_path):
        source = tmp_path / "delete-missing.txt"
        source.write_text("abc", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)
        import shutil
        shutil.rmtree(Path(created["backup_path"]))

        assert mgr.delete_backup(created["backup_id"]) is True
        assert mgr.get_backup(created["backup_id"]) is None

    def test_backup_to_s3_success_skips_directories_during_walk(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "tree"
        (source / "nested").mkdir(parents=True)
        (source / "nested" / "a.txt").write_text("a", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        uploaded = []

        class GoodClient:
            def upload_file(self, file_path, bucket, key):
                uploaded.append((Path(file_path).name, bucket, key))

        boto3_mod = types.SimpleNamespace(client=lambda **kwargs: GoodClient())
        cfg_mod = types.SimpleNamespace(Config=object)
        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)
        monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
        monkeypatch.setitem(sys.modules, "botocore.config", cfg_mod)

        result = mgr.backup_to_s3(created["backup_id"], {"bucket": "b"})

        assert result["success"] is True
        assert result["file_count"] == 1
        assert uploaded == [("a.txt", "b", f"backups/{created['backup_id']}/nested\\a.txt")]

    def test_restore_from_s3_default_target_endpoint_and_exception(self, mgr, tmp_path, monkeypatch):
        captured = {}

        class Paginator:
            def paginate(self, **kwargs):
                return [{"Contents": [{"Key": "prefix/b1/a.txt"}]}]

        class BadClient:
            def get_paginator(self, name):
                assert name == "list_objects_v2"
                return Paginator()

            def download_file(self, *args, **kwargs):
                raise RuntimeError("download-fail")

        def fake_client(**kwargs):
            captured.update(kwargs)
            return BadClient()

        boto3_mod = types.SimpleNamespace(client=fake_client)

        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)

        result = mgr.restore_from_s3(
            "prefix/b1",
            {
                "bucket": "b",
                "endpoint_url": "http://minio:9000",
                "aws_access_key_id": "k",
                "aws_secret_access_key": "s",
            },
            target_path=None,
        )

        assert captured["endpoint_url"] == "http://minio:9000"
        assert result["success"] is False
        assert result["error"] == "S3 restore failed"
        assert "download-fail" not in result["error"]
        assert result.get("target_path") is None

    def test_validate_webdav_base_url_variants(self, mgr):
        assert mgr._validate_webdav_base_url("example.com") == "WebDAV URL must include scheme"
        assert mgr._validate_webdav_base_url("http://example.com") == (
            "WebDAV URL must use https (except localhost/127.0.0.1/::1 for local development)"
        )
        assert mgr._validate_webdav_base_url("http://127.0.0.1:8080") is None

    def test_backup_to_webdav_invalid_url(self, mgr, tmp_path):
        source = tmp_path / "f.txt"
        source.write_text("x", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        result = mgr.backup_to_webdav(created["backup_id"], {"url": "http://example.com"})

        assert result["success"] is False
        assert "must use https" in result["error"]

    def test_restore_from_webdav_invalid_url(self, mgr):
        result = mgr.restore_from_webdav("/remote/path", {"url": "http://example.com"})

        assert result["success"] is False
        assert "must use https" in result["error"]

    def test_restore_from_webdav_import_error(self, mgr):
        with patch.dict("sys.modules", {"requests": None}):
            with patch("builtins.__import__", side_effect=ImportError("no requests")):
                result = mgr.restore_from_webdav("/remote/path", {"url": "https://example.com"})

        assert result["success"] is False
        assert result["error"] == "requests library not installed"

    def test_backup_to_s3_import_error(self, mgr):
        with patch.dict("sys.modules", {"boto3": None, "botocore.config": None}):
            with patch("builtins.__import__", side_effect=ImportError("no boto3")):
                result = mgr.backup_to_s3("missing", {"bucket": "b"})

        assert result["success"] is False
        assert result["error"] == "boto3 library not installed"

    def test_backup_to_s3_backup_not_found(self, mgr, monkeypatch):
        boto3_mod = types.SimpleNamespace(client=lambda **kwargs: object())
        cfg_mod = types.SimpleNamespace(Config=object)
        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)
        monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
        monkeypatch.setitem(sys.modules, "botocore.config", cfg_mod)

        result = mgr.backup_to_s3("missing", {"bucket": "b"})

        assert result["success"] is False
        assert "Backup not found" in result["error"]

    def test_backup_to_s3_success_without_endpoint(self, mgr, tmp_path, monkeypatch):
        source = tmp_path / "src"
        source.mkdir()
        (source / "a.txt").write_text("a", encoding="utf-8")
        created = mgr.create_backup(str(source), compress=False)

        captured = {"uploads": []}

        class GoodClient:
            def upload_file(self, file_path, bucket, key):
                captured["uploads"].append((Path(file_path).name, bucket, key))

        def fake_client(**kwargs):
            captured["kwargs"] = kwargs
            return GoodClient()

        boto3_mod = types.SimpleNamespace(client=fake_client)
        cfg_mod = types.SimpleNamespace(Config=object)
        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)
        monkeypatch.setitem(sys.modules, "botocore", types.SimpleNamespace())
        monkeypatch.setitem(sys.modules, "botocore.config", cfg_mod)

        result = mgr.backup_to_s3(created["backup_id"], {"bucket": "b", "prefix": "custom"})

        assert result["success"] is True
        assert result["bucket"] == "b"
        assert result["prefix"] == f"custom/{created['backup_id']}"
        assert "endpoint_url" not in captured["kwargs"]
        assert captured["uploads"][0][1] == "b"

    def test_restore_from_s3_import_error(self, mgr):
        with patch.dict("sys.modules", {"boto3": None}):
            with patch("builtins.__import__", side_effect=ImportError("no boto3")):
                result = mgr.restore_from_s3("prefix/b1", {"bucket": "b"})

        assert result["success"] is False
        assert result["error"] == "boto3 library not installed"

    def test_restore_from_s3_success_without_endpoint(self, mgr, tmp_path, monkeypatch):
        captured = {"downloads": []}

        class Paginator:
            def paginate(self, **kwargs):
                captured["paginate"] = kwargs
                return [{"Contents": [{"Key": "prefix/b1/a.txt"}, {"Key": "prefix/b1/nested/b.txt"}]}]

        class GoodClient:
            def get_paginator(self, name):
                assert name == "list_objects_v2"
                return Paginator()

            def download_file(self, bucket, key, local_file):
                Path(local_file).write_text(key, encoding="utf-8")
                captured["downloads"].append((bucket, key, Path(local_file).name))

        def fake_client(**kwargs):
            captured["kwargs"] = kwargs
            return GoodClient()

        boto3_mod = types.SimpleNamespace(client=fake_client)
        monkeypatch.setitem(sys.modules, "boto3", boto3_mod)

        result = mgr.restore_from_s3(
            "prefix/b1",
            {"bucket": "b"},
            target_path=str(tmp_path / "s3_restore"),
        )

        assert result["success"] is True
        assert result["file_count"] == 2
        assert "endpoint_url" not in captured["kwargs"]
        assert captured["paginate"] == {"Bucket": "b", "Prefix": "prefix/b1"}
        assert (tmp_path / "s3_restore" / "a.txt").read_text(encoding="utf-8") == "prefix/b1/a.txt"
        assert (tmp_path / "s3_restore" / "nested" / "b.txt").read_text(encoding="utf-8") == "prefix/b1/nested/b.txt"

    def test_close_and_singleton_helpers(self, tmp_path):
        from src.services import backup_manager as backup_manager_module

        backup_manager_module.reset_backup_manager()
        singleton = backup_manager_module.get_backup_manager(str(tmp_path / "singleton"))
        assert backup_manager_module.get_backup_manager(str(tmp_path / "other")) is singleton
        assert singleton._db is not None

        singleton.close()
        assert singleton._db is None

        backup_manager_module.reset_backup_manager()
        assert backup_manager_module._backup_manager is None
