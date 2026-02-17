"""
技能加载器 (Skill Loader) - 简化版

设计理念：
- Skills 是静态知识文件，不需要 MCP
- 直接读取 Markdown 文件，注入到 Prompt
- LLM 自己判断使用什么技能
- 支持 @skill:name 引用语法

使用方式：
    loader = SkillLoader()
    
    # 方式1: 直接加载
    content = loader.load("fictional-dream")
    
    # 方式2: 获取列表供 LLM 选择
    summary = loader.get_summary()
    
    # 方式3: 解析 @skill 引用
    resolved = loader.resolve_refs("使用 @skill:fictional-dream 写...")
"""

import re
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

logger = logging.getLogger("niko-skills")


@dataclass
class SkillMeta:
    """技能元数据"""
    name: str
    description: str = ""
    tags: List[str] = field(default_factory=list)
    triggers: List[str] = field(default_factory=list)


@dataclass  
class Skill:
    """技能包"""
    name: str
    meta: SkillMeta
    content: str
    path: Path
    techniques: List[str] = field(default_factory=list)


class SkillLoader:
    """
    技能加载器 - 纯本地文件读取
    
    技能目录结构:
    skills/
    └── {skill_name}/
        └── SKILL.md       # 技能内容 (YAML frontmatter + Markdown)
    
    三级路径优先级:
    1. .niko/skills/     (项目级 - 最高)
    2. ~/.niko/skills/   (用户级)
    3. skills/           (内置 - 最低)
    """
    
    def __init__(self, base_path: Optional[str] = None):
        self.skill_paths = [
            Path(".niko/skills"),           # 项目级
            Path.home() / ".niko/skills",   # 用户级
            Path("skills"),                  # 内置
        ]
        
        # 如果指定了 base_path，添加到最高优先级
        if base_path:
            self.skill_paths.insert(0, Path(base_path) / "skills")
        
        self._cache: Dict[str, Skill] = {}
        self._all_skills: Optional[List[Skill]] = None
    
    # ============ 核心方法 ============
    
    def load(self, skill_name: str) -> str:
        """
        加载技能包内容
        
        Args:
            skill_name: 技能名称
            
        Returns:
            技能 Markdown 内容
            
        Raises:
            FileNotFoundError: 技能不存在
        """
        skill = self._get_skill(skill_name)
        return skill.content
    
    def load_full(self, skill_name: str) -> Skill:
        """
        加载完整技能对象

        Args:
            skill_name: 技能名称

        Returns:
            Skill 对象
        """
        return self._get_skill(skill_name)

    def load_skill(self, skill_name: str) -> Dict[str, Any]:
        """兼容接口：以字典形式返回技能包。"""
        skill = self._get_skill(skill_name)
        return {
            "name": skill.name,
            "content": skill.content,
            "metadata": {
                "description": skill.meta.description,
                "tags": skill.meta.tags,
                "triggers": skill.meta.triggers,
                "path": str(skill.path),
                "techniques": skill.techniques,
            },
            "techniques": skill.techniques,
        }

    def load_technique(self, skill_name: str, technique: str) -> str:
        """加载 techniques 目录下的技巧文件内容。"""
        technique_name = technique if technique.endswith(".md") else f"{technique}.md"
        for base_path in self.skill_paths:
            technique_path = base_path / skill_name / "techniques" / technique_name
            if technique_path.exists():
                return technique_path.read_text(encoding="utf-8")
        raise FileNotFoundError(f"Technique '{technique}' not found for skill '{skill_name}'")

    def load_template(self, skill_name: str, template: str) -> str:
        """加载 templates 目录下的模板文件内容。"""
        template_name = template if template.endswith(".md") else f"{template}.md"
        for base_path in self.skill_paths:
            template_path = base_path / skill_name / "templates" / template_name
            if template_path.exists():
                return template_path.read_text(encoding="utf-8")
        raise FileNotFoundError(f"Template '{template}' not found for skill '{skill_name}'")

    def get_technique(self, skill_name: str, technique: str) -> Optional[str]:
        """
        提取特定技巧段落
        
        Args:
            skill_name: 技能名称
            technique: 技巧名称
            
        Returns:
            技巧内容，未找到返回 None
        """
        content = self.load(skill_name)
        
        # 匹配 ## 或 ### 开头的技巧章节
        pattern = rf'^(#{2,3})\s+{re.escape(technique)}.*?\n(.*?)(?=^#{2,3}\s|\Z)'
        match = re.search(pattern, content, re.MULTILINE | re.DOTALL | re.IGNORECASE)
        
        if match:
            return match.group(2).strip()
        return None
    
    def list_skills(self) -> List[str]:
        """列出所有可用技能名称"""
        return [s.name for s in self._discover_all()]
    
    def get_summary(self) -> str:
        """
        生成技能摘要供 LLM 参考
        
        Returns:
            格式化的技能列表字符串
        """
        skills = self._discover_all()
        lines = ["可用技能包：", ""]
        
        for skill in skills:
            tags_str = f" [{', '.join(skill.meta.tags[:3])}]" if skill.meta.tags else ""
            lines.append(f"- **{skill.name}**{tags_str}: {skill.meta.description}")
        
        lines.append("")
        lines.append("使用方式: @skill:技能名称")
        
        return "\n".join(lines)
    
    def get_summary_dict(self) -> List[Dict]:
        """
        生成技能摘要字典列表
        
        Returns:
            [{"name": "...", "description": "...", "tags": [...]}]
        """
        skills = self._discover_all()
        return [
            {
                "name": s.name,
                "description": s.meta.description,
                "tags": s.meta.tags,
                "triggers": s.meta.triggers,
                "techniques": s.techniques[:5]
            }
            for s in skills
        ]
    
    # ============ @skill 引用解析 ============
    
    def resolve_refs(self, text: str) -> str:
        """
        解析文本中的 @skill:name 引用
        
        Args:
            text: 包含 @skill 引用的文本
            
        Returns:
            替换后的文本
            
        示例:
            输入: "使用 @skill:fictional-dream 写一段场景"
            输出: "使用 [技能包: fictional-dream]\n..内容..\n[/技能包] 写一段场景"
        """
        pattern = r'@skill:([a-zA-Z0-9_-]+)'
        
        def replace_skill(match):
            skill_name = match.group(1)
            try:
                content = self.load(skill_name)
                # 限制长度，避免 prompt 过长
                if len(content) > 4000:
                    content = content[:4000] + "\n... (内容截断)"
                return f"\n[技能包: {skill_name}]\n{content}\n[/技能包]\n"
            except FileNotFoundError:
                return f"[技能包 {skill_name} 未找到]"
        
        return re.sub(pattern, replace_skill, text)
    
    def extract_refs(self, text: str) -> List[str]:
        """
        提取文本中的 @skill:name 引用
        
        Args:
            text: 包含 @skill 引用的文本
            
        Returns:
            技能名称列表
        """
        pattern = r'@skill:([a-zA-Z0-9_-]+)'
        return re.findall(pattern, text)
    
    # ============ 内部方法 ============
    
    def _get_skill(self, skill_name: str) -> Skill:
        """获取技能（带缓存）"""
        if skill_name in self._cache:
            return self._cache[skill_name]
        
        # 按优先级查找
        for base_path in self.skill_paths:
            skill_file = base_path / skill_name / "SKILL.md"
            if skill_file.exists():
                skill = self._parse_skill_file(skill_file, skill_name)
                self._cache[skill_name] = skill
                return skill
        
        raise FileNotFoundError(f"Skill '{skill_name}' not found in any path")
    
    def _discover_all(self) -> List[Skill]:
        """发现所有可用技能包"""
        if self._all_skills is not None:
            return self._all_skills
        
        discovered = {}
        
        # 按优先级遍历（后发现的覆盖先发现的，所以反向遍历）
        for base_path in reversed(self.skill_paths):
            if not base_path.exists():
                continue
            
            for skill_dir in base_path.iterdir():
                if not skill_dir.is_dir():
                    continue
                
                skill_file = skill_dir / "SKILL.md"
                if not skill_file.exists():
                    continue
                
                skill = self._parse_skill_file(skill_file, skill_dir.name)
                discovered[skill.name] = skill
                self._cache[skill.name] = skill
        
        self._all_skills = list(discovered.values())
        logger.info(f"Discovered {len(self._all_skills)} skills")
        return self._all_skills
    
    def _parse_skill_file(self, path: Path, name: str) -> Skill:
        """解析 SKILL.md 文件"""
        content = path.read_text(encoding="utf-8")
        meta = self._parse_frontmatter(content)
        techniques = self._extract_techniques(content)
        
        # 如果没有描述，从内容提取
        if not meta.description:
            first_para = re.search(r'^#.*?\n\n(.+?)(?:\n\n|\n#)', content, re.DOTALL)
            if first_para:
                meta.description = first_para.group(1).strip()[:150]
        
        meta.name = name
        
        return Skill(
            name=name,
            meta=meta,
            content=content,
            path=path,
            techniques=techniques
        )
    
    def _parse_frontmatter(self, content: str) -> SkillMeta:
        """解析 YAML frontmatter"""
        meta = SkillMeta(name="")
        
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
        if not match:
            return meta
        
        frontmatter = match.group(1)
        
        # 简单解析（不依赖 yaml 库）
        for line in frontmatter.split('\n'):
            if ':' not in line:
                continue
            
            key, value = line.split(':', 1)
            key = key.strip().lower()
            value = value.strip()
            
            if key == 'description':
                meta.description = value.strip('"\'')
            elif key == 'tags':
                # 解析 [tag1, tag2] 格式
                tags_match = re.search(r'\[(.*?)\]', value)
                if tags_match:
                    meta.tags = [t.strip().strip('"\'') for t in tags_match.group(1).split(',')]
            elif key == 'triggers':
                triggers_match = re.search(r'\[(.*?)\]', value)
                if triggers_match:
                    meta.triggers = [t.strip().strip('"\'') for t in triggers_match.group(1).split(',')]
        
        return meta
    
    def _extract_techniques(self, content: str) -> List[str]:
        """提取技巧标题"""
        # 匹配 ## 或 ### 开头的标题
        techniques = re.findall(r'^#{2,3}\s+(.+)$', content, re.MULTILINE)
        return [t.strip() for t in techniques if not t.startswith('---')]
    
    def clear_cache(self):
        """清除缓存（用于热重载）"""
        self._cache.clear()
        self._all_skills = None
        logger.info("Skill cache cleared")


# ============ 便捷函数 ============

_default_loader: Optional[SkillLoader] = None


def get_loader(base_path: Optional[str] = None) -> SkillLoader:
    """获取默认加载器"""
    global _default_loader
    if _default_loader is None:
        _default_loader = SkillLoader(base_path)
    return _default_loader


def load_skill(skill_name: str) -> str:
    """加载技能内容"""
    return get_loader().load(skill_name)


def list_skills() -> List[str]:
    """列出所有技能"""
    return get_loader().list_skills()


def get_skill_summary() -> str:
    """获取技能摘要"""
    return get_loader().get_summary()


def resolve_skill_refs(text: str) -> str:
    """解析 @skill 引用"""
    return get_loader().resolve_refs(text)
