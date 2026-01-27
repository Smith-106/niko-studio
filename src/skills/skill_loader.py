"""
技能加載器 (Skill Loader)

加載和管理 Skills 技能包。
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict
import yaml
import re


@dataclass
class SkillMetadata:
    """技能元數據"""
    name: str
    description: str
    version: str = "1.0"
    author: str = "system"
    tags: List[str] = field(default_factory=list)


@dataclass
class Skill:
    """技能"""
    metadata: SkillMetadata
    content: str
    path: Path
    templates: Dict[str, str] = field(default_factory=dict)


class SkillLoader:
    """
    技能加載器
    
    技能目錄結構:
    skills/
    └── {skill_name}/
        ├── SKILL.md           # 技能描述 (YAML frontmatter + Markdown)
        ├── templates/         # Prompt 模板
        │   ├── prompt1.md
        │   └── prompt2.md
        └── scripts/           # 工具腳本 (可選)
    """
    
    def __init__(self, skills_dir: str = "skills"):
        self.skills_dir = Path(skills_dir)
        self._cache: Dict[str, Skill] = {}
    
    def load(self, skill_name: str) -> Skill:
        """
        加載技能
        
        Args:
            skill_name: 技能名稱 (目錄名)
        
        Returns:
            Skill 對象
        
        Raises:
            FileNotFoundError: 技能不存在
        """
        if skill_name in self._cache:
            return self._cache[skill_name]
        
        skill_path = self.skills_dir / skill_name / "SKILL.md"
        if not skill_path.exists():
            raise FileNotFoundError(f"Skill not found: {skill_name}")
        
        content = skill_path.read_text(encoding="utf-8")
        metadata_dict, body = self._parse_frontmatter(content)
        
        # 加載模板
        templates = self._load_templates(self.skills_dir / skill_name)
        
        skill = Skill(
            metadata=SkillMetadata(**metadata_dict),
            content=body,
            path=skill_path,
            templates=templates,
        )
        
        self._cache[skill_name] = skill
        return skill
    
    def list_skills(self) -> List[str]:
        """列出所有技能"""
        if not self.skills_dir.exists():
            return []
        
        return [
            d.name for d in self.skills_dir.iterdir()
            if d.is_dir() and (d / "SKILL.md").exists()
        ]
    
    def get_template(self, skill_name: str, template_name: str) -> str:
        """
        獲取技能模板
        
        Args:
            skill_name: 技能名稱
            template_name: 模板名稱 (不含 .md)
        
        Returns:
            模板內容
        """
        skill = self.load(skill_name)
        return skill.templates.get(template_name, "")
    
    def clear_cache(self):
        """清除緩存"""
        self._cache.clear()
    
    def _parse_frontmatter(self, content: str) -> tuple[dict, str]:
        """
        解析 YAML Frontmatter
        
        格式:
        ---
        name: skill-name
        description: 描述
        version: "1.0"
        tags: [tag1, tag2]
        ---
        
        Markdown 內容...
        """
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, content, re.DOTALL)
        
        if match:
            try:
                frontmatter = yaml.safe_load(match.group(1))
                body = match.group(2)
                return frontmatter or {}, body
            except yaml.YAMLError:
                pass
        
        return {}, content
    
    def _load_templates(self, skill_dir: Path) -> Dict[str, str]:
        """加載模板目錄"""
        templates = {}
        templates_dir = skill_dir / "templates"
        
        if templates_dir.exists():
            for template_file in templates_dir.glob("*.md"):
                name = template_file.stem
                templates[name] = template_file.read_text(encoding="utf-8")
        
        return templates


# ============================================================
# 便捷函數
# ============================================================

_default_loader: Optional[SkillLoader] = None


def get_loader(skills_dir: str = "skills") -> SkillLoader:
    """獲取默認加載器"""
    global _default_loader
    if _default_loader is None:
        _default_loader = SkillLoader(skills_dir)
    return _default_loader


def load_skill(skill_name: str) -> Skill:
    """加載技能 (使用默認加載器)"""
    return get_loader().load(skill_name)


def list_skills() -> List[str]:
    """列出技能 (使用默認加載器)"""
    return get_loader().list_skills()
