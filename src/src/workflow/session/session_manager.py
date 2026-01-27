"""
會話管理器 (Session Manager)

管理寫作會話的生命週期: 創建、讀寫、歸檔、刪除。
"""

from pathlib import Path
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List
import json
import shutil


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
}


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
    
    def delete(self, session_id: str, force: bool = False) -> bool:
        """
        刪除會話
        
        Args:
            session_id: 會話 ID
            force: 是否強制刪除 (跳過歸檔)
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
        template = PATH_ROUTES.get(content_type, "{base}/{id}")
        base = self._get_session_path(session_id)
        path_str = template.format(base=str(base), **kwargs)
        return Path(path_str)
    
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
    
    def _update_timestamp(self, session_id: str):
        """更新時間戳"""
        info = self._load_session_info(session_id)
        if info:
            info.updated_at = datetime.now().isoformat()
            self._save_session_info(session_id, info)
