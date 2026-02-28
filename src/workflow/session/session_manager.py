"""
會話管理器 (Session Manager)

管理寫作會話的生命週期: 創建、讀寫、歸檔、刪除。
"""

from pathlib import Path
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
import re
import shutil
import uuid


class SessionStatus(Enum):
    """會話狀態"""
    ACTIVE = "active"
    ARCHIVED = "archived"


class ContentType(Enum):
    """內容類型"""
    CHAPTER = "chapter"
    OUTLINE = "outline"
    CHARACTER = "character"
    WORLDVIEW = "worldview"
    PLAN = "plan"
    TODO = "todo"
    SUMMARY = "summary"
    STATE = "state"
    SNAPSHOT_INDEX = "snapshot_index"
    AUDIT = "audit"
    HANDOFF = "handoff"
    REVISION_CHECKPOINT = "revision_checkpoint"
    GENERATION_SNAPSHOT = "generation_snapshot"


# 內容類型路由表
PATH_ROUTES = {
    ContentType.CHAPTER: "{base}/chapters/chapter-{id}.md",
    ContentType.OUTLINE: "{base}/OUTLINE.md",
    ContentType.CHARACTER: "{base}/.data/characters/{id}.json",
    ContentType.WORLDVIEW: "{base}/.data/worldview.json",
    ContentType.PLAN: "{base}/IMPL_PLAN.md",
    ContentType.TODO: "{base}/TODO_LIST.md",
    ContentType.SUMMARY: "{base}/SUMMARY.md",
    ContentType.STATE: "{base}/.data/state.json",
    ContentType.SNAPSHOT_INDEX: "{base}/.data/snapshot-index.json",
    ContentType.AUDIT: "{base}/.data/audit.jsonl",
    ContentType.HANDOFF: "{base}/HANDOFF.md",
    ContentType.REVISION_CHECKPOINT: "{base}/.data/revision-checkpoints/{id}.json",
    ContentType.GENERATION_SNAPSHOT: "{base}/.data/generation-snapshots/{id}.json",
}

_SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


@dataclass
class SessionInfo:
    """會話信息"""
    id: str
    type: str                    # rapid | lite | standard | brainstorm | coordinator
    status: str                  # active | archived
    project_name: str = ""
    created_at: str = ""
    updated_at: str = ""
    task_count: int = 0
    chapter_count: int = 0
    domain: str = "novel"        # novel | code | knowledge
    runner_state: str = "pending"
    last_checkpoint_id: str = ""
    lifecycle_updated_at: str = ""


class SessionManager:
    """
    會話管理器
    
    目錄結構:
    .writing/
    └── sessions/
        ├── active/
        │   └── {session_id}/
        │       ├── session.json
        │       ├── chapters/
        │       ├── .data/
        │       ├── OUTLINE.md
        │       └── IMPL_PLAN.md
        └── archived/
    """
    
    def __init__(self, base_path: str = ".writing/sessions"):
        self.base_path = Path(base_path)
        self.active_path = self.base_path / "active"
        self.archived_path = self.base_path / "archived"
        
        # 確保目錄存在
        self.active_path.mkdir(parents=True, exist_ok=True)
        self.archived_path.mkdir(parents=True, exist_ok=True)
    
    def _sanitize_segment(self, value: str, fallback: str = "session") -> str:
        sanitized = re.sub(r"[^A-Za-z0-9_-]+", "-", (value or "").strip())
        sanitized = sanitized.strip("-")
        return sanitized or fallback

    def _assert_valid_session_id(self, session_id: str):
        if not _SESSION_ID_PATTERN.fullmatch(session_id or ""):
            raise ValueError(f"invalid session_id: {session_id}")

    def init(
        self,
        session_id: str,
        session_type: str = "standard",
        project_name: str = "",
        domain: str = "novel"
    ) -> SessionInfo:
        """
        初始化新會話
        
        Args:
            session_id: 會話 ID
            session_type: 類型 (rapid/lite/standard/brainstorm/coordinator)
            project_name: 項目名稱
            domain: 領域 (novel/code/knowledge)
        
        Returns:
            SessionInfo 對象
        """
        self._assert_valid_session_id(session_id)
        session_path = self.active_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        
        # 創建子目錄
        (session_path / "chapters").mkdir(exist_ok=True)
        (session_path / ".data").mkdir(exist_ok=True)
        (session_path / ".data" / "characters").mkdir(exist_ok=True)
        
        # 創建會話信息
        now = datetime.now().isoformat()
        info = SessionInfo(
            id=session_id,
            type=session_type,
            status=SessionStatus.ACTIVE.value,
            project_name=project_name,
            created_at=now,
            updated_at=now,
            domain=domain,
        )
        
        # 保存 session.json
        self._save_session_info(session_id, info)
        
        return info
    
    def list(
        self, 
        location: str = "active",
        domain_filter: str = None,
        project_filter: str = None
    ) -> List[SessionInfo]:
        """
        列出會話
        
        Args:
            location: 位置 (active/archived/all)
            domain_filter: 領域過濾
            project_filter: 項目過濾
        
        Returns:
            SessionInfo 列表
        """
        sessions = []
        
        paths = []
        if location in ("active", "all"):
            paths.append(self.active_path)
        if location in ("archived", "all"):
            paths.append(self.archived_path)
        
        for base in paths:
            if not base.exists():
                continue
            for session_dir in base.iterdir():
                if not session_dir.is_dir():
                    continue
                info = self._load_session_info(session_dir.name, base)
                if info:
                    # 應用過濾器
                    if domain_filter and info.domain != domain_filter:
                        continue
                    if project_filter and info.project_name != project_filter:
                        continue
                    sessions.append(info)
        
        # 按更新時間排序
        sessions.sort(key=lambda x: x.updated_at, reverse=True)
        return sessions
    
    def read(
        self, 
        session_id: str, 
        content_type: ContentType,
        **kwargs
    ) -> str:
        """
        讀取會話內容
        
        Args:
            session_id: 會話 ID
            content_type: 內容類型
            **kwargs: 額外參數 (如 chapter id)
        
        Returns:
            內容字符串
        """
        path = self._resolve_path(session_id, content_type, **kwargs)
        if path.exists():
            return path.read_text(encoding="utf-8")
        return ""
    
    def write(
        self,
        session_id: str,
        content_type: ContentType,
        content: str,
        **kwargs
    ) -> bool:
        """
        寫入會話內容

        Args:
            session_id: 會話 ID
            content_type: 內容類型
            content: 內容
            **kwargs: 額外參數

        Returns:
            是否成功
        """
        path = self._resolve_path(session_id, content_type, **kwargs)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

        # 更新會話時間戳
        self._update_timestamp(session_id)
        self._append_snapshot_index(session_id, content_type, path)

        return True

    def append_audit(self, session_id: str, event: Dict[str, Any]) -> bool:
        """追加审计事件到 session 级审计日志。"""
        path = self._resolve_path(session_id, ContentType.AUDIT)
        path.parent.mkdir(parents=True, exist_ok=True)

        line = json.dumps(event, ensure_ascii=False)
        with path.open("a", encoding="utf-8") as fp:
            fp.write(line + "\n")

        self._update_timestamp(session_id)
        self._append_snapshot_index(session_id, ContentType.AUDIT, path)
        return True
    
    def archive(self, session_id: str) -> bool:
        """
        歸檔會話
        
        Args:
            session_id: 會話 ID
        
        Returns:
            是否成功
        """
        src = self.active_path / session_id
        dst = self.archived_path / session_id
        
        if not src.exists():
            return False
        
        shutil.move(str(src), str(dst))
        
        # 更新狀態
        info = self._load_session_info(session_id, self.archived_path)
        if info:
            info.status = SessionStatus.ARCHIVED.value
            self._save_session_info(session_id, info, self.archived_path)
        
        return True
    
    def restore(self, session_id: str) -> bool:
        """
        恢復歸檔會話
        """
        src = self.archived_path / session_id
        dst = self.active_path / session_id
        
        if not src.exists():
            return False
        
        shutil.move(str(src), str(dst))
        
        info = self._load_session_info(session_id, self.active_path)
        if info:
            info.status = SessionStatus.ACTIVE.value
            self._save_session_info(session_id, info)
        
        return True
    
    def sync_lifecycle(
        self,
        session_id: str,
        runner_state: str,
        checkpoint_id: Optional[str] = None,
        status_map: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """同步 loop-runner 生命周期到会话持久态。"""
        default_status_map = {
            "running": "active",
            "paused": "checkpointed",
            "stopped": "archived",
            "pending": "active",
        }
        effective_status_map = dict(default_status_map)
        if status_map:
            effective_status_map.update(status_map)
        target_status = effective_status_map.get(runner_state, "active")

        if target_status == "active":
            if not (self.active_path / session_id).exists() and (self.archived_path / session_id).exists():
                self.restore(session_id)
            elif not (self.active_path / session_id).exists():
                self.init(session_id=session_id, session_type="standard", project_name="workflow", domain="code")
        elif target_status == "archived":
            if (self.active_path / session_id).exists():
                self.archive(session_id)
            elif not (self.archived_path / session_id).exists():
                self.init(session_id=session_id, session_type="standard", project_name="workflow", domain="code")
                self.archive(session_id)
        else:
            if not (self.active_path / session_id).exists() and (self.archived_path / session_id).exists():
                self.restore(session_id)
            elif not (self.active_path / session_id).exists():
                self.init(session_id=session_id, session_type="standard", project_name="workflow", domain="code")

        base = self.archived_path if target_status == "archived" else self.active_path
        info = self._load_session_info(session_id, base)
        if not info:
            return {"session_id": session_id, "status": target_status}

        now = datetime.now().isoformat()
        info.status = target_status
        info.runner_state = runner_state
        info.lifecycle_updated_at = now
        info.updated_at = now
        if checkpoint_id:
            info.last_checkpoint_id = checkpoint_id
        self._save_session_info(session_id, info, base)
        return {
            "session_id": session_id,
            "status": info.status,
            "runner_state": info.runner_state,
            "last_checkpoint_id": info.last_checkpoint_id,
        }

    def delete(self, session_id: str, force: bool = False) -> bool:
        """
        刪除會話

        Args:
            session_id: 會話 ID
            force: 是否強制刪除 (跳過歸檔)

        Returns:
            是否成功
        """
        # 先檢查 active
        path = self.active_path / session_id
        if path.exists():
            if not force:
                return self.archive(session_id)
            shutil.rmtree(path)
            return True

        # 再檢查 archived
        path = self.archived_path / session_id
        if path.exists():
            shutil.rmtree(path)
            return True

        return False
    
    def create_session(
        self,
        project_id: str,
        goal: str = "",
        session_type: str = "standard",
        domain: str = "novel",
        namespace: str = "",
    ) -> dict:
        """兼容旧接口：创建会话并返回字典结果。"""
        safe_project_id = self._sanitize_segment(project_id, fallback="project")
        safe_namespace = self._sanitize_segment(namespace, fallback="") if namespace else ""
        unique_suffix = uuid.uuid4().hex[:8]
        if safe_namespace:
            session_id = f"{safe_namespace}--{safe_project_id}-{unique_suffix}"
        else:
            session_id = f"{safe_project_id}-{unique_suffix}"
        info = self.init(
            session_id=session_id,
            session_type=session_type,
            project_name=project_id,
            domain=domain,
        )
        return {
            "session_id": info.id,
            "project_id": project_id,
            "goal": goal,
            "status": info.status,
            "created_at": info.created_at,
            "namespace": safe_namespace,
        }

    def list_sessions(self, location: str = "active") -> List[dict]:
        """兼容旧接口：列出会话字典列表。"""
        sessions = self.list(location=location)
        return [
            {
                "session_id": s.id,
                "project_id": s.project_name,
                "status": s.status,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            }
            for s in sessions
        ]

    def stats(self, session_id: str) -> dict:
        """獲取會話統計"""
        info = self._load_session_info(session_id)
        if not info:
            return {}
        
        session_path = self._get_session_path(session_id)
        chapters_path = session_path / "chapters"
        
        chapter_count = 0
        total_words = 0
        
        if chapters_path.exists():
            for chapter_file in chapters_path.glob("*.md"):
                chapter_count += 1
                content = chapter_file.read_text(encoding="utf-8")
                total_words += len(content)
        
        return {
            "session_id": session_id,
            "type": info.type,
            "status": info.status,
            "chapter_count": chapter_count,
            "total_words": total_words,
            "created_at": info.created_at,
            "updated_at": info.updated_at,
        }
    
    # ========================================
    # 私有方法
    # ========================================
    
    def _resolve_path(
        self,
        session_id: str,
        content_type: ContentType,
        **kwargs
    ) -> Path:
        """解析內容類型到文件路徑"""
        self._assert_valid_session_id(session_id)
        template = PATH_ROUTES.get(content_type, "{base}/{id}")
        base = self._get_session_path(session_id)
        path_str = template.format(base=str(base), **kwargs)
        resolved = Path(path_str)
        base_resolved = base.resolve()
        resolved_parent = resolved.parent.resolve() if resolved.suffix else resolved.resolve()
        if base_resolved not in resolved_parent.parents and resolved_parent != base_resolved:
            raise ValueError(f"resolved path escapes session boundary: {resolved}")
        return resolved
    
    def _get_session_path(self, session_id: str) -> Path:
        """獲取會話目錄路徑"""
        # 先檢查 active
        path = self.active_path / session_id
        if path.exists():
            return path
        
        # 再檢查 archived
        path = self.archived_path / session_id
        if path.exists():
            return path
        
        # 默認返回 active
        return self.active_path / session_id
    
    def _save_session_info(
        self, 
        session_id: str, 
        info: SessionInfo,
        base: Path = None
    ):
        """保存會話信息"""
        base = base or self.active_path
        path = base / session_id / "session.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(asdict(info), ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    
    def _load_session_info(
        self, 
        session_id: str,
        base: Path = None
    ) -> Optional[SessionInfo]:
        """加載會話信息"""
        if base:
            path = base / session_id / "session.json"
        else:
            path = self._get_session_path(session_id) / "session.json"
        
        if not path.exists():
            return None
        
        data = json.loads(path.read_text(encoding="utf-8"))
        return SessionInfo(**data)

    def _append_snapshot_index(self, session_id: str, content_type: ContentType, path: Path):
        """追加 session 级增量快照索引"""
        index_path = self._resolve_path(session_id, ContentType.SNAPSHOT_INDEX)
        index_path.parent.mkdir(parents=True, exist_ok=True)

        snapshots = []
        if index_path.exists():
            try:
                snapshots = json.loads(index_path.read_text(encoding="utf-8"))
                if not isinstance(snapshots, list):
                    snapshots = []
            except json.JSONDecodeError:
                snapshots = []

        snapshots.append(
            {
                "ts": datetime.now().isoformat(),
                "content_type": content_type.value,
                "path": str(path),
            }
        )

        index_path.write_text(
            json.dumps(snapshots, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def _update_timestamp(self, session_id: str):
        """更新時間戳"""
        info = self._load_session_info(session_id)
        if info:
            info.updated_at = datetime.now().isoformat()
            self._save_session_info(session_id, info)
