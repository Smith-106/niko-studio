"""
ObsidianService - Obsidian Vault 集成服务

支持：
- 扫描系统 Obsidian Vaults
- 遍历 Vault 目录结构
- 按名称获取文件列表
- 跨平台兼容 (Win/Mac/Linux)
"""

import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from fnmatch import fnmatch
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# 跨平台配置路径
# ============================================================

def _get_obsidian_config_path() -> Optional[Path]:
    """获取 Obsidian 配置目录路径"""
    platform = sys.platform

    if platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return Path(appdata) / "obsidian"
    elif platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "obsidian"
    else:  # linux and others
        return Path.home() / ".config" / "obsidian"

    return None


@dataclass
class VaultInfo:
    """Vault 信息"""
    name: str
    path: str
    last_modified: datetime
    file_count: int
    folder_count: int = 0
    total_size_bytes: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NoteInfo:
    """笔记信息"""
    name: str
    path: str
    relative_path: str
    size_bytes: int
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)
    links: List[str] = field(default_factory=list)


class ObsidianService:
    """
    Obsidian Vault 集成服务

    提供 Vault 发现、文件遍历和笔记读取功能。

    Usage:
        service = ObsidianService()
        vaults = service.discover_vaults()
        structure = service.get_vault_structure(vaults[0].path)
    """

    def __init__(self, config: Optional[Any] = None):
        """
        初始化 ObsidianService

        Args:
            config: 可选的配置对象
        """
        self._config = config
        self._config_path = _get_obsidian_config_path()
        self._vault_cache: Dict[str, VaultInfo] = {}

        logger.info(f"ObsidianService initialized, config path: {self._config_path}")

    # ============================================================
    # Vault 发现
    # ============================================================

    def discover_vaults(self, refresh: bool = False) -> List[VaultInfo]:
        """
        发现系统中的 Obsidian Vaults

        Args:
            refresh: 是否刷新缓存

        Returns:
            Vault 列表
        """
        if self._vault_cache and not refresh:
            return list(self._vault_cache.values())

        vaults = []

        # 方法 1: 从 Obsidian 配置文件读取
        config_vaults = self._discover_from_config()
        vaults.extend(config_vaults)

        # 方法 2: 扫描常见位置
        common_vaults = self._discover_from_common_paths()
        for vault in common_vaults:
            if vault.path not in [v.path for v in vaults]:
                vaults.append(vault)

        # 更新缓存
        self._vault_cache = {v.path: v for v in vaults}

        logger.info(f"Discovered {len(vaults)} Obsidian vaults")
        return vaults

    def _discover_from_config(self) -> List[VaultInfo]:
        """从 Obsidian 配置文件发现 Vaults"""
        vaults = []

        if not self._config_path or not self._config_path.exists():
            return vaults

        # 读取 obsidian.json
        obsidian_json = self._config_path / "obsidian.json"
        if obsidian_json.exists():
            try:
                with open(obsidian_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                vault_list = data.get("vaults", {})
                for vault_id, vault_data in vault_list.items():
                    vault_path = vault_data.get("path", "")
                    if vault_path and Path(vault_path).exists():
                        vault_info = self._get_vault_info(vault_path)
                        if vault_info:
                            vault_info.metadata["vault_id"] = vault_id
                            vaults.append(vault_info)
            except Exception as e:
                logger.warning(f"Failed to read obsidian.json: {e}")

        return vaults

    def _discover_from_common_paths(self) -> List[VaultInfo]:
        """从常见路径发现 Vaults"""
        vaults = []

        # 常见 Vault 位置
        common_paths = [
            Path.home() / "Documents" / "Obsidian",
            Path.home() / "Documents" / "obsidian",
            Path.home() / "Obsidian",
            Path.home() / "obsidian",
            Path.home() / "Notes",
            Path.home() / "notes",
        ]

        # Windows 特定路径
        if sys.platform == "win32":
            common_paths.extend([
                Path.home() / "OneDrive" / "Documents" / "Obsidian",
                Path("D:/Obsidian"),
                Path("D:/Notes"),
            ])

        for path in common_paths:
            if path.exists() and path.is_dir():
                # 检查是否是 Vault（包含 .obsidian 目录）
                if (path / ".obsidian").exists():
                    vault_info = self._get_vault_info(str(path))
                    if vault_info:
                        vaults.append(vault_info)
                else:
                    # 检查子目录
                    for subdir in path.iterdir():
                        if subdir.is_dir() and (subdir / ".obsidian").exists():
                            vault_info = self._get_vault_info(str(subdir))
                            if vault_info:
                                vaults.append(vault_info)

        return vaults

    def _get_vault_info(self, vault_path: str) -> Optional[VaultInfo]:
        """获取 Vault 信息"""
        path = Path(vault_path)
        if not path.exists():
            return None

        try:
            # 统计文件
            file_count = 0
            folder_count = 0
            total_size = 0
            latest_modified = datetime.min

            for item in path.rglob('*'):
                # 跳过 .obsidian 目录
                if '.obsidian' in item.parts:
                    continue

                if item.is_file():
                    file_count += 1
                    total_size += item.stat().st_size
                    mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                    if mod_time > latest_modified:
                        latest_modified = mod_time
                elif item.is_dir():
                    folder_count += 1

            return VaultInfo(
                name=path.name,
                path=str(path),
                last_modified=latest_modified if latest_modified != datetime.min else datetime.now(),
                file_count=file_count,
                folder_count=folder_count,
                total_size_bytes=total_size
            )
        except Exception as e:
            logger.warning(f"Failed to get vault info for {vault_path}: {e}")
            return None

    def get_vault_by_name(self, name: str) -> Optional[VaultInfo]:
        """
        按名称获取 Vault

        Args:
            name: Vault 名称

        Returns:
            VaultInfo 或 None
        """
        vaults = self.discover_vaults()
        for vault in vaults:
            if vault.name.lower() == name.lower():
                return vault
        return None

    def get_vault_by_path(self, path: str) -> Optional[VaultInfo]:
        """
        按路径获取 Vault

        Args:
            path: Vault 路径

        Returns:
            VaultInfo 或 None
        """
        path = str(Path(path).resolve())
        if path in self._vault_cache:
            return self._vault_cache[path]

        vault_info = self._get_vault_info(path)
        if vault_info:
            self._vault_cache[path] = vault_info
        return vault_info

    # ============================================================
    # 文件操作
    # ============================================================

    def get_vault_structure(
        self,
        vault_path: str,
        max_depth: int = 3
    ) -> Dict[str, Any]:
        """
        获取 Vault 目录结构

        Args:
            vault_path: Vault 路径
            max_depth: 最大深度

        Returns:
            目录结构字典
        """
        path = Path(vault_path)
        if not path.exists():
            return {"error": f"Vault not found: {vault_path}"}

        def build_tree(current_path: Path, depth: int) -> Dict[str, Any]:
            if depth > max_depth:
                return {"truncated": True}

            node: Dict[str, Any] = {
                "name": current_path.name,
                "type": "directory" if current_path.is_dir() else "file",
            }

            if current_path.is_file():
                node["size"] = current_path.stat().st_size
                node["extension"] = current_path.suffix
                return node

            # 目录
            children = []
            for item in sorted(current_path.iterdir()):
                # 跳过隐藏文件和 .obsidian
                if item.name.startswith('.'):
                    continue
                children.append(build_tree(item, depth + 1))

            node["children"] = children
            node["file_count"] = sum(
                1 for c in children if c.get("type") == "file"
            )
            node["folder_count"] = sum(
                1 for c in children if c.get("type") == "directory"
            )

            return node

        return build_tree(path, 0)

    def get_files(
        self,
        vault_path: str,
        pattern: str = "*.md",
        recursive: bool = True
    ) -> List[Path]:
        """
        获取 Vault 中的文件

        Args:
            vault_path: Vault 路径
            pattern: 文件匹配模式 (glob)
            recursive: 是否递归搜索

        Returns:
            文件路径列表
        """
        path = Path(vault_path)
        if not path.exists():
            return []

        files = []
        if recursive:
            for item in path.rglob('*'):
                if item.is_file() and fnmatch(item.name, pattern):
                    # 跳过 .obsidian 目录
                    if '.obsidian' not in item.parts:
                        files.append(item)
        else:
            for item in path.iterdir():
                if item.is_file() and fnmatch(item.name, pattern):
                    files.append(item)

        return sorted(files)

    def get_notes(
        self,
        vault_path: str,
        folder: Optional[str] = None,
        limit: int = 100
    ) -> List[NoteInfo]:
        """
        获取笔记列表

        Args:
            vault_path: Vault 路径
            folder: 子文件夹（可选）
            limit: 返回数量限制

        Returns:
            笔记信息列表
        """
        search_path = Path(vault_path)
        if folder:
            search_path = search_path / folder

        if not search_path.exists():
            return []

        notes = []
        for file in self.get_files(str(search_path), "*.md"):
            try:
                stat = file.stat()
                relative_path = str(file.relative_to(vault_path))

                # 解析 frontmatter 获取 tags
                tags = []
                links = []
                try:
                    content = file.read_text(encoding='utf-8')
                    tags = self._extract_tags(content)
                    links = self._extract_links(content)
                except Exception:
                    pass

                notes.append(NoteInfo(
                    name=file.stem,
                    path=str(file),
                    relative_path=relative_path,
                    size_bytes=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_ctime),
                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                    tags=tags,
                    links=links
                ))

                if len(notes) >= limit:
                    break
            except Exception as e:
                logger.warning(f"Failed to get note info for {file}: {e}")

        return notes

    def _extract_tags(self, content: str) -> List[str]:
        """从笔记内容提取标签"""
        import re
        tags = set()

        # YAML frontmatter tags
        frontmatter_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
        if frontmatter_match:
            frontmatter = frontmatter_match.group(1)
            tags_match = re.search(r'tags:\s*\[([^\]]+)\]', frontmatter)
            if tags_match:
                for tag in tags_match.group(1).split(','):
                    tags.add(tag.strip().strip('"\''))
            else:
                tags_match = re.search(r'tags:\s*\n((?:\s*-\s*.+\n)+)', frontmatter)
                if tags_match:
                    for line in tags_match.group(1).split('\n'):
                        line = line.strip()
                        if line.startswith('-'):
                            tags.add(line[1:].strip().strip('"\''))

        # Inline tags (#tag)
        inline_tags = re.findall(r'(?<!\w)#([a-zA-Z\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_/-]*)', content)
        tags.update(inline_tags)

        return list(tags)

    def _extract_links(self, content: str) -> List[str]:
        """从笔记内容提取链接"""
        import re
        links = []

        # Wiki links [[link]]
        wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', content)
        links.extend(wiki_links)

        return list(set(links))

    def read_note(
        self,
        vault_path: str,
        note_path: str
    ) -> str:
        """
        读取笔记内容

        Args:
            vault_path: Vault 路径
            note_path: 笔记相对路径

        Returns:
            笔记内容
        """
        full_path = Path(vault_path) / note_path

        # 自动添加 .md 扩展名
        if not full_path.suffix:
            full_path = full_path.with_suffix('.md')

        if not full_path.exists():
            raise FileNotFoundError(f"Note not found: {note_path}")

        return full_path.read_text(encoding='utf-8')

    def search_notes(
        self,
        vault_path: str,
        query: str,
        search_content: bool = True,
        limit: int = 50
    ) -> List[NoteInfo]:
        """
        搜索笔记

        Args:
            vault_path: Vault 路径
            query: 搜索关键词
            search_content: 是否搜索内容
            limit: 返回数量限制

        Returns:
            匹配的笔记列表
        """
        query_lower = query.lower()
        results = []

        for file in self.get_files(vault_path, "*.md"):
            try:
                # 文件名匹配
                if query_lower in file.stem.lower():
                    stat = file.stat()
                    results.append(NoteInfo(
                        name=file.stem,
                        path=str(file),
                        relative_path=str(file.relative_to(vault_path)),
                        size_bytes=stat.st_size,
                        modified_at=datetime.fromtimestamp(stat.st_mtime)
                    ))
                    continue

                # 内容匹配
                if search_content:
                    content = file.read_text(encoding='utf-8')
                    if query_lower in content.lower():
                        stat = file.stat()
                        results.append(NoteInfo(
                            name=file.stem,
                            path=str(file),
                            relative_path=str(file.relative_to(vault_path)),
                            size_bytes=stat.st_size,
                            modified_at=datetime.fromtimestamp(stat.st_mtime),
                            tags=self._extract_tags(content)
                        ))

                if len(results) >= limit:
                    break
            except Exception as e:
                logger.warning(f"Failed to search {file}: {e}")

        return results

    # ============================================================
    # 集成
    # ============================================================

    def sync_to_knowledge_layer(
        self,
        vault_path: str,
        knowledge_layer: Any,
        folder: Optional[str] = None,
        file_types: List[str] = None
    ) -> Dict[str, Any]:
        """
        同步 Vault 到知识层

        Args:
            vault_path: Vault 路径
            knowledge_layer: KnowledgeLayer 实例
            folder: 子文件夹（可选）
            file_types: 文件类型列表

        Returns:
            同步结果
        """
        if file_types is None:
            file_types = ["*.md"]

        search_path = Path(vault_path)
        if folder:
            search_path = search_path / folder

        synced_files = []
        failed_files = []

        for pattern in file_types:
            for file in self.get_files(str(search_path), pattern):
                try:
                    # 调用 knowledge_layer 的 sync_file 方法
                    if hasattr(knowledge_layer, 'sync_file'):
                        result = knowledge_layer.sync_file(str(file))
                        if result.get('success'):
                            synced_files.append(str(file))
                        else:
                            failed_files.append({
                                "file": str(file),
                                "error": result.get('error', 'Unknown error')
                            })
                    else:
                        # 回退：直接添加
                        content = file.read_text(encoding='utf-8')
                        knowledge_layer.add_document(
                            content=content,
                            metadata={
                                "source": "obsidian",
                                "vault": vault_path,
                                "file": str(file.relative_to(vault_path))
                            }
                        )
                        synced_files.append(str(file))
                except Exception as e:
                    failed_files.append({
                        "file": str(file),
                        "error": str(e)
                    })

        logger.info(f"Synced {len(synced_files)} files from Obsidian vault")
        return {
            "success": len(failed_files) == 0,
            "synced_count": len(synced_files),
            "failed_count": len(failed_files),
            "synced_files": synced_files[:10],  # 只返回前 10 个
            "failed_files": failed_files
        }

    def close(self):
        """关闭服务"""
        self._vault_cache.clear()
        logger.info("ObsidianService closed")


# ============================================================
# 工厂函数
# ============================================================

_obsidian_service: Optional[ObsidianService] = None


def get_obsidian_service(config: Optional[Any] = None) -> ObsidianService:
    """
    获取 ObsidianService 单例

    Args:
        config: 配置对象

    Returns:
        ObsidianService 实例
    """
    global _obsidian_service
    if _obsidian_service is None:
        _obsidian_service = ObsidianService(config=config)
    return _obsidian_service


def reset_obsidian_service():
    """重置 ObsidianService 单例（仅用于测试）"""
    global _obsidian_service
    if _obsidian_service:
        _obsidian_service.close()
    _obsidian_service = None
