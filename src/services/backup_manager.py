"""
BackupManager - 备份服务

支持：
- 本地文件备份与恢复
- WebDAV 协议支持 (坚果云/Nextcloud)
- S3 对象存储支持
- 进度追踪
- 断点续传
"""

import gzip
import hashlib
import json
import logging
import shutil
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class BackupInfo:
    """备份信息"""
    id: str
    name: str
    source_path: str
    backup_path: str
    size_bytes: int
    file_count: int
    checksum: str
    created_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BackupProgress:
    """备份进度"""
    total_files: int
    completed_files: int
    total_bytes: int
    completed_bytes: int
    current_file: str = ""
    status: str = "pending"  # pending, in_progress, completed, failed

    @property
    def percent(self) -> float:
        if self.total_bytes == 0:
            return 0.0
        return (self.completed_bytes / self.total_bytes) * 100


class BackupManager:
    """
    备份管理服务

    支持本地备份、WebDAV 远程备份、S3 对象存储备份。

    Usage:
        manager = BackupManager()
        result = manager.create_backup(".writing/memories")
        manager.restore_backup(result["backup_id"], "./restored")
    """

    def __init__(
        self,
        backup_dir: str = ".writing/backups",
        config: Optional[Any] = None
    ):
        """
        初始化 BackupManager

        Args:
            backup_dir: 备份存储目录
            config: 可选的配置对象
        """
        self._config = config
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        # 数据库
        self.db_path = self.backup_dir / "backups.db"
        self._db: Optional[sqlite3.Connection] = None
        self._init_db()

        # 进度回调
        self._progress_callback: Optional[Callable[[BackupProgress], None]] = None

        logger.info(f"BackupManager initialized: {self.backup_dir}")

    def _get_db(self) -> sqlite3.Connection:
        """获取数据库连接"""
        if self._db is None:
            self._db = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._db.row_factory = sqlite3.Row
        return self._db

    def _init_db(self):
        """初始化数据库"""
        db = self._get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS backups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_path TEXT NOT NULL,
                backup_path TEXT NOT NULL,
                size_bytes INTEGER DEFAULT 0,
                file_count INTEGER DEFAULT 0,
                checksum TEXT,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS backup_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                size_bytes INTEGER DEFAULT 0,
                checksum TEXT,
                FOREIGN KEY (backup_id) REFERENCES backups(id)
            );

            CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);
            CREATE INDEX IF NOT EXISTS idx_backup_files_backup ON backup_files(backup_id);
        """)
        db.commit()

    def set_progress_callback(self, callback: Callable[[BackupProgress], None]) -> None:
        """设置进度回调函数"""
        self._progress_callback = callback

    def _notify_progress(self, progress: BackupProgress) -> None:
        """通知进度更新"""
        if self._progress_callback:
            try:
                self._progress_callback(progress)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

    def _compute_file_checksum(self, file_path: Path) -> str:
        """计算文件校验和"""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _collect_files(self, source_path: Path) -> List[Path]:
        """收集需要备份的文件"""
        if source_path.is_file():
            return [source_path]
        files = []
        for item in source_path.rglob('*'):
            if item.is_file():
                files.append(item)
        return files

    # ============================================================
    # 本地备份
    # ============================================================

    def create_backup(
        self,
        source_path: str,
        backup_name: Optional[str] = None,
        compress: bool = True
    ) -> Dict[str, Any]:
        """
        创建本地备份

        Args:
            source_path: 源文件/目录路径
            backup_name: 备份名称（可选）
            compress: 是否压缩

        Returns:
            备份结果 {"success": bool, "backup_id": str, ...}
        """
        source = Path(source_path)
        if not source.exists():
            return {"success": False, "error": f"Source not found: {source_path}"}

        # 生成备份 ID 和名称
        backup_id = str(uuid.uuid4())
        if backup_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{source.name}_{timestamp}"

        # 创建备份目录
        backup_path = self.backup_dir / backup_id
        backup_path.mkdir(parents=True, exist_ok=True)

        try:
            # 收集文件
            files = self._collect_files(source)
            total_bytes = sum(f.stat().st_size for f in files)

            progress = BackupProgress(
                total_files=len(files),
                completed_files=0,
                total_bytes=total_bytes,
                completed_bytes=0,
                status="in_progress"
            )
            self._notify_progress(progress)

            # 复制文件
            db = self._get_db()
            checksums = []

            for file in files:
                progress.current_file = str(file)
                self._notify_progress(progress)

                # 计算相对路径
                if source.is_file():
                    relative_path = file.name
                else:
                    relative_path = str(file.relative_to(source))

                # 目标路径
                dest_path = backup_path / relative_path
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                # 复制并可选压缩
                if compress and file.suffix not in ['.gz', '.zip', '.7z', '.rar']:
                    dest_path = dest_path.with_suffix(dest_path.suffix + '.gz')
                    with open(file, 'rb') as f_in:
                        with gzip.open(dest_path, 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                else:
                    shutil.copy2(file, dest_path)

                # 计算校验和
                file_checksum = self._compute_file_checksum(file)
                checksums.append(file_checksum)

                # 记录文件
                db.execute("""
                    INSERT INTO backup_files (backup_id, file_path, relative_path, size_bytes, checksum)
                    VALUES (?, ?, ?, ?, ?)
                """, (backup_id, str(dest_path), relative_path, file.stat().st_size, file_checksum))

                progress.completed_files += 1
                progress.completed_bytes += file.stat().st_size
                self._notify_progress(progress)

            # 计算总校验和
            total_checksum = hashlib.sha256(''.join(checksums).encode()).hexdigest()

            # 记录备份
            db.execute("""
                INSERT INTO backups (id, name, source_path, backup_path, size_bytes, file_count, checksum, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                backup_id, backup_name, str(source), str(backup_path),
                total_bytes, len(files), total_checksum, datetime.now().isoformat()
            ))
            db.commit()

            progress.status = "completed"
            self._notify_progress(progress)

            logger.info(f"Backup created: {backup_id} ({len(files)} files, {total_bytes} bytes)")
            return {
                "success": True,
                "backup_id": backup_id,
                "name": backup_name,
                "file_count": len(files),
                "size_bytes": total_bytes,
                "checksum": total_checksum,
                "backup_path": str(backup_path)
            }

        except Exception as e:
            logger.error(f"Backup failed: {e}")
            # 清理失败的备份
            if backup_path.exists():
                shutil.rmtree(backup_path)
            return {"success": False, "error": str(e)}

    def restore_backup(
        self,
        backup_id: str,
        target_path: Optional[str] = None,
        verify_checksum: bool = True
    ) -> Dict[str, Any]:
        """
        恢复备份

        Args:
            backup_id: 备份 ID
            target_path: 目标路径（可选，默认恢复到原始位置）
            verify_checksum: 是否验证校验和

        Returns:
            恢复结果 {"success": bool, ...}
        """
        db = self._get_db()
        cursor = db.execute("SELECT * FROM backups WHERE id = ?", (backup_id,))
        row = cursor.fetchone()

        if not row:
            return {"success": False, "error": f"Backup not found: {backup_id}"}

        backup_path = Path(row['backup_path'])
        if not backup_path.exists():
            return {"success": False, "error": f"Backup data missing: {backup_path}"}

        # 确定目标路径
        if target_path is None:
            target_path = row['source_path']
        target = Path(target_path)
        target.mkdir(parents=True, exist_ok=True)

        try:
            # 获取备份文件列表
            cursor = db.execute(
                "SELECT * FROM backup_files WHERE backup_id = ?",
                (backup_id,)
            )
            files = cursor.fetchall()

            progress = BackupProgress(
                total_files=len(files),
                completed_files=0,
                total_bytes=row['size_bytes'],
                completed_bytes=0,
                status="in_progress"
            )
            self._notify_progress(progress)

            restored_files = []
            for file_row in files:
                src_path = Path(file_row['file_path'])
                relative_path = file_row['relative_path']

                # 处理压缩文件
                if src_path.suffix == '.gz':
                    dest_path = target / relative_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    with gzip.open(src_path, 'rb') as f_in:
                        with open(dest_path, 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                else:
                    dest_path = target / relative_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_path, dest_path)

                # 验证校验和
                if verify_checksum:
                    restored_checksum = self._compute_file_checksum(dest_path)
                    if restored_checksum != file_row['checksum']:
                        logger.warning(f"Checksum mismatch: {relative_path}")

                restored_files.append(str(dest_path))
                progress.completed_files += 1
                progress.completed_bytes += file_row['size_bytes']
                self._notify_progress(progress)

            progress.status = "completed"
            self._notify_progress(progress)

            logger.info(f"Backup restored: {backup_id} -> {target_path}")
            return {
                "success": True,
                "backup_id": backup_id,
                "target_path": str(target),
                "file_count": len(restored_files),
                "files": restored_files
            }

        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return {"success": False, "error": str(e)}

    def list_backups(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        列出备份

        Args:
            limit: 返回数量限制

        Returns:
            备份列表
        """
        db = self._get_db()
        cursor = db.execute("""
            SELECT * FROM backups ORDER BY created_at DESC LIMIT ?
        """, (limit,))

        backups = []
        rows = cursor.fetchall()
        for row in rows:
            backups.append({
                "id": row['id'],
                "name": row['name'],
                "source_path": row['source_path'],
                "size_bytes": row['size_bytes'],
                "file_count": row['file_count'],
                "checksum": row['checksum'],
                "created_at": row['created_at']
            })
        return backups

    def delete_backup(self, backup_id: str) -> bool:
        """
        删除备份

        Args:
            backup_id: 备份 ID

        Returns:
            是否删除成功
        """
        db = self._get_db()
        cursor = db.execute("SELECT backup_path FROM backups WHERE id = ?", (backup_id,))
        row = cursor.fetchone()

        if not row:
            return False

        # 删除文件
        backup_path = Path(row['backup_path'])
        if backup_path.exists():
            shutil.rmtree(backup_path)

        # 删除数据库记录
        db.execute("DELETE FROM backup_files WHERE backup_id = ?", (backup_id,))
        db.execute("DELETE FROM backups WHERE id = ?", (backup_id,))
        db.commit()

        logger.info(f"Backup deleted: {backup_id}")
        return True

    def get_backup(self, backup_id: str) -> Optional[BackupInfo]:
        """获取备份信息"""
        db = self._get_db()
        cursor = db.execute("SELECT * FROM backups WHERE id = ?", (backup_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return BackupInfo(
            id=row['id'],
            name=row['name'],
            source_path=row['source_path'],
            backup_path=row['backup_path'],
            size_bytes=row['size_bytes'],
            file_count=row['file_count'],
            checksum=row['checksum'],
            created_at=datetime.fromisoformat(row['created_at']),
            metadata=json.loads(row['metadata']) if row['metadata'] else {}
        )

    # ============================================================
    # WebDAV 远程备份
    # ============================================================

    def backup_to_webdav(
        self,
        backup_id: str,
        webdav_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        上传备份到 WebDAV

        Args:
            backup_id: 本地备份 ID
            webdav_config: WebDAV 配置
                - url: WebDAV URL
                - username: 用户名
                - password: 密码
                - remote_path: 远程路径

        Returns:
            上传结果
        """
        try:
            import requests
            from requests.auth import HTTPBasicAuth
        except ImportError:
            return {"success": False, "error": "requests library not installed"}

        backup = self.get_backup(backup_id)
        if not backup:
            return {"success": False, "error": f"Backup not found: {backup_id}"}

        backup_path = Path(backup.backup_path)
        if not backup_path.exists():
            return {"success": False, "error": "Backup data missing"}

        url = webdav_config.get('url', '').rstrip('/')
        username = webdav_config.get('username', '')
        password = webdav_config.get('password', '')
        remote_path = webdav_config.get('remote_path', '/backups')

        auth = HTTPBasicAuth(username, password)

        try:
            # 创建远程目录
            remote_dir = f"{url}{remote_path}/{backup_id}"
            requests.request('MKCOL', remote_dir, auth=auth, timeout=30)

            # 上传文件
            uploaded_files = []
            for file in backup_path.rglob('*'):
                if file.is_file():
                    relative_path = file.relative_to(backup_path)
                    remote_file_url = f"{remote_dir}/{relative_path}"

                    # 确保父目录存在
                    parent_dir = f"{remote_dir}/{relative_path.parent}"
                    if str(relative_path.parent) != '.':
                        requests.request('MKCOL', parent_dir, auth=auth, timeout=30)

                    with open(file, 'rb') as f:
                        response = requests.put(
                            remote_file_url,
                            data=f,
                            auth=auth,
                            timeout=300
                        )
                        response.raise_for_status()

                    uploaded_files.append(str(relative_path))

            logger.info(f"Backup uploaded to WebDAV: {backup_id}")
            return {
                "success": True,
                "backup_id": backup_id,
                "remote_path": remote_dir,
                "file_count": len(uploaded_files)
            }

        except Exception as e:
            logger.error(f"WebDAV upload failed: {e}")
            return {"success": False, "error": str(e)}

    def restore_from_webdav(
        self,
        remote_path: str,
        webdav_config: Dict[str, Any],
        target_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        从 WebDAV 恢复备份

        Args:
            remote_path: 远程备份路径
            webdav_config: WebDAV 配置
            target_path: 本地目标路径

        Returns:
            恢复结果
        """
        try:
            import requests
            from requests.auth import HTTPBasicAuth
            import xml.etree.ElementTree as ET
        except ImportError:
            return {"success": False, "error": "requests library not installed"}

        url = webdav_config.get('url', '').rstrip('/')
        username = webdav_config.get('username', '')
        password = webdav_config.get('password', '')

        auth = HTTPBasicAuth(username, password)
        full_url = f"{url}{remote_path}"

        if target_path is None:
            target_path = str(self.backup_dir / "restored" / Path(remote_path).name)
        target = Path(target_path)
        target.mkdir(parents=True, exist_ok=True)

        try:
            # PROPFIND 获取文件列表
            response = requests.request(
                'PROPFIND',
                full_url,
                auth=auth,
                headers={'Depth': 'infinity'},
                timeout=60
            )
            response.raise_for_status()

            # 解析 XML 响应
            root = ET.fromstring(response.content)
            ns = {'d': 'DAV:'}

            downloaded_files = []
            for resp in root.findall('.//d:response', ns):
                href = resp.find('d:href', ns)
                if href is None:
                    continue

                file_url = href.text
                if file_url.endswith('/'):
                    continue  # 跳过目录

                # 下载文件
                relative_path = file_url.replace(remote_path, '').lstrip('/')
                local_file = target / relative_path
                local_file.parent.mkdir(parents=True, exist_ok=True)

                file_response = requests.get(
                    f"{url}{file_url}",
                    auth=auth,
                    timeout=300
                )
                file_response.raise_for_status()

                with open(local_file, 'wb') as f:
                    f.write(file_response.content)

                downloaded_files.append(str(relative_path))

            logger.info(f"Backup restored from WebDAV: {remote_path}")
            return {
                "success": True,
                "remote_path": remote_path,
                "target_path": str(target),
                "file_count": len(downloaded_files)
            }

        except Exception as e:
            logger.error(f"WebDAV restore failed: {e}")
            return {"success": False, "error": str(e)}

    # ============================================================
    # S3 对象存储
    # ============================================================

    def backup_to_s3(
        self,
        backup_id: str,
        s3_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        上传备份到 S3

        Args:
            backup_id: 本地备份 ID
            s3_config: S3 配置
                - bucket: S3 bucket 名称
                - prefix: 对象前缀
                - region: 区域（可选）
                - endpoint_url: 自定义端点（可选，用于 MinIO 等）
                - aws_access_key_id: Access Key
                - aws_secret_access_key: Secret Key

        Returns:
            上传结果
        """
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            return {"success": False, "error": "boto3 library not installed"}

        backup = self.get_backup(backup_id)
        if not backup:
            return {"success": False, "error": f"Backup not found: {backup_id}"}

        backup_path = Path(backup.backup_path)
        if not backup_path.exists():
            return {"success": False, "error": "Backup data missing"}

        try:
            # 创建 S3 客户端
            client_kwargs = {
                'service_name': 's3',
                'region_name': s3_config.get('region', 'us-east-1'),
                'aws_access_key_id': s3_config.get('aws_access_key_id'),
                'aws_secret_access_key': s3_config.get('aws_secret_access_key'),
            }
            if s3_config.get('endpoint_url'):
                client_kwargs['endpoint_url'] = s3_config['endpoint_url']

            s3_client = boto3.client(**client_kwargs)

            bucket = s3_config.get('bucket')
            prefix = s3_config.get('prefix', 'backups').strip('/')

            # 上传文件
            uploaded_files = []
            for file in backup_path.rglob('*'):
                if file.is_file():
                    relative_path = file.relative_to(backup_path)
                    s3_key = f"{prefix}/{backup_id}/{relative_path}"

                    s3_client.upload_file(str(file), bucket, s3_key)
                    uploaded_files.append(s3_key)

            logger.info(f"Backup uploaded to S3: {backup_id}")
            return {
                "success": True,
                "backup_id": backup_id,
                "bucket": bucket,
                "prefix": f"{prefix}/{backup_id}",
                "file_count": len(uploaded_files)
            }

        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            return {"success": False, "error": str(e)}

    def restore_from_s3(
        self,
        s3_key: str,
        s3_config: Dict[str, Any],
        target_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        从 S3 恢复备份

        Args:
            s3_key: S3 对象前缀 (如 "backups/backup-id")
            s3_config: S3 配置
            target_path: 本地目标路径

        Returns:
            恢复结果
        """
        try:
            import boto3
        except ImportError:
            return {"success": False, "error": "boto3 library not installed"}

        if target_path is None:
            target_path = str(self.backup_dir / "restored" / Path(s3_key).name)
        target = Path(target_path)
        target.mkdir(parents=True, exist_ok=True)

        try:
            # 创建 S3 客户端
            client_kwargs = {
                'service_name': 's3',
                'region_name': s3_config.get('region', 'us-east-1'),
                'aws_access_key_id': s3_config.get('aws_access_key_id'),
                'aws_secret_access_key': s3_config.get('aws_secret_access_key'),
            }
            if s3_config.get('endpoint_url'):
                client_kwargs['endpoint_url'] = s3_config['endpoint_url']

            s3_client = boto3.client(**client_kwargs)

            bucket = s3_config.get('bucket')

            # 列出对象
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=s3_key)

            downloaded_files = []
            for page in pages:
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    relative_path = key.replace(s3_key, '').lstrip('/')
                    local_file = target / relative_path
                    local_file.parent.mkdir(parents=True, exist_ok=True)

                    s3_client.download_file(bucket, key, str(local_file))
                    downloaded_files.append(str(relative_path))

            logger.info(f"Backup restored from S3: {s3_key}")
            return {
                "success": True,
                "s3_key": s3_key,
                "target_path": str(target),
                "file_count": len(downloaded_files)
            }

        except Exception as e:
            logger.error(f"S3 restore failed: {e}")
            return {"success": False, "error": str(e)}

    def close(self):
        """关闭服务"""
        if self._db:
            self._db.close()
            self._db = None
        logger.info("BackupManager closed")


# ============================================================
# 工厂函数
# ============================================================

_backup_manager: Optional[BackupManager] = None


def get_backup_manager(
    backup_dir: str = ".writing/backups",
    config: Optional[Any] = None
) -> BackupManager:
    """
    获取 BackupManager 单例

    Args:
        backup_dir: 备份目录
        config: 配置对象

    Returns:
        BackupManager 实例
    """
    global _backup_manager
    if _backup_manager is None:
        _backup_manager = BackupManager(backup_dir=backup_dir, config=config)
    return _backup_manager


def reset_backup_manager():
    """重置 BackupManager 单例（仅用于测试）"""
    global _backup_manager
    if _backup_manager:
        _backup_manager.close()
    _backup_manager = None
