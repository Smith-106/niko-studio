# -*- coding: utf-8 -*-
"""
Skill Router - 技能路由器

根据任务类型自动路由到相关技能包。
基于知识库中的写作理论体系构建。
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass


class TaskType(Enum):
    """任务类型枚举"""
    # 人物相关
    CHARACTER_CREATION = "character_creation"       # 创建新角色
    CHARACTER_DEVELOPMENT = "character_development" # 角色发展/弧光
    CHARACTER_DIALOGUE = "character_dialogue"       # 角色对话
    
    # 结构相关
    STORY_OUTLINE = "story_outline"                 # 故事大纲
    SCENE_DESIGN = "scene_design"                   # 场景设计
    CHAPTER_WRITING = "chapter_writing"             # 章节写作
    
    # 技巧相关
    SUSPENSE_BUILD = "suspense_build"               # 悬念构建
    TWIST_DESIGN = "twist_design"                   # 反转设计
    CLIMAX_WRITING = "climax_writing"               # 高潮写作
    
    # 修复相关
    DIALOGUE_FIX = "dialogue_fix"                   # 对话修复
    DESCRIPTION_FIX = "description_fix"             # 描写修复
    LOGIC_FIX = "logic_fix"                         # 逻辑修复
    
    # 评估相关
    QUALITY_REVIEW = "quality_review"               # 质量评审
    CLICHE_CHECK = "cliche_check"                   # 陈词滥调检查


@dataclass
class SkillRecommendation:
    """技能推荐结果"""
    skill_id: str
    skill_name: str
    relevance: float  # 0-1 相关度
    reason: str
    priority: int     # 1=最高优先级


class SkillRouter:
    """
    技能路由器
    
    根据任务类型和上下文，推荐最相关的技能包。
    """
    
    # 技能注册表
    SKILL_REGISTRY = {
        # ============ 人物塑造类 ============
        "character-forge": {
            "name": "角色熔炉",
            "description": "基础人物创建与设定",
            "task_types": [TaskType.CHARACTER_CREATION],
            "keywords": ["角色", "人物", "创建", "设定", "背景"],
        },
        "four-selves": {
            "name": "四个自我",
            "description": "麦基四个自我模型：社会/个人/私密/隐藏",
            "task_types": [TaskType.CHARACTER_CREATION, TaskType.CHARACTER_DEVELOPMENT],
            "keywords": ["内心", "矛盾", "层次", "自我", "面具", "秘密"],
        },
        "true-character": {
            "name": "人物真相",
            "description": "通过两难选择揭示角色内核",
            "task_types": [TaskType.CHARACTER_DEVELOPMENT, TaskType.CLIMAX_WRITING],
            "keywords": ["选择", "两难", "抉择", "真相", "本性", "压力"],
        },
        "mirror-foil": {
            "name": "镜像陪衬",
            "description": "设计配角网络形成四角对立",
            "task_types": [TaskType.CHARACTER_CREATION, TaskType.SCENE_DESIGN],
            "keywords": ["配角", "对比", "镜像", "陪衬", "对立", "网络"],
        },
        "self-knowledge-eval": {
            "name": "自知之明评估",
            "description": "评估角色认知裂痕与弧光完成度",
            "task_types": [TaskType.CHARACTER_DEVELOPMENT, TaskType.QUALITY_REVIEW],
            "keywords": ["弧光", "成长", "认知", "转变", "完成度"],
        },
        
        # ============ 对话类 ============
        "subtext-dialogue": {
            "name": "潜台词对话",
            "description": "CoT双轨生成法制造潜台词",
            "task_types": [TaskType.CHARACTER_DIALOGUE],
            "keywords": ["潜台词", "对话", "言外之意", "暗示", "隐藏"],
        },
        "on-the-nose-fix": {
            "name": "直白修复",
            "description": "识别并转化直白对白为含蓄表达",
            "task_types": [TaskType.DIALOGUE_FIX],
            "keywords": ["直白", "修复", "含蓄", "隐晦", "优化"],
        },
        
        # ============ 结构类 ============
        "22-steps-outline": {
            "name": "22步骤大纲",
            "description": "特鲁比22步骤有机故事结构",
            "task_types": [TaskType.STORY_OUTLINE],
            "keywords": ["大纲", "结构", "步骤", "骨架", "规划"],
        },
        "pyramid-structure": {
            "name": "金字塔结构",
            "description": "逻辑骨架构建",
            "task_types": [TaskType.STORY_OUTLINE, TaskType.SCENE_DESIGN],
            "keywords": ["逻辑", "金字塔", "论证", "层次"],
        },
        "novel-chapter": {
            "name": "小说章节",
            "description": "章节级写作技巧",
            "task_types": [TaskType.CHAPTER_WRITING],
            "keywords": ["章节", "段落", "节奏", "承接"],
        },
        
        # ============ 悬念与反转类 ============
        "suspense-craft": {
            "name": "悬念技巧",
            "description": "悬念构建与维持",
            "task_types": [TaskType.SUSPENSE_BUILD],
            "keywords": ["悬念", "紧张", "期待", "未知"],
        },
        "misdirection-twist": {
            "name": "反转设计",
            "description": "注意力转移+逆向工程设计反转",
            "task_types": [TaskType.TWIST_DESIGN, TaskType.SUSPENSE_BUILD],
            "keywords": ["反转", "意外", "逆转", "误导", "揭示"],
        },
        "deus-ex-machina": {
            "name": "机械降神检测",
            "description": "识别巧合解决并植入伏笔",
            "task_types": [TaskType.LOGIC_FIX, TaskType.QUALITY_REVIEW],
            "keywords": ["巧合", "伏笔", "机械降神", "合理性"],
        },
        
        # ============ 描写类 ============
        "show-dont-tell": {
            "name": "展示性描写",
            "description": "四维感官化描写技法",
            "task_types": [TaskType.DESCRIPTION_FIX, TaskType.CHAPTER_WRITING],
            "keywords": ["展示", "描写", "感官", "细节", "具体"],
        },
        "object-symbolism": {
            "name": "物品象征",
            "description": "契诃夫之枪+第三音轨设计",
            "task_types": [TaskType.SCENE_DESIGN, TaskType.SUSPENSE_BUILD],
            "keywords": ["象征", "物品", "道具", "隐喻", "伏笔"],
        },
        "fictional-dream": {
            "name": "虚构之梦",
            "description": "沉浸式叙事体验",
            "task_types": [TaskType.CHAPTER_WRITING],
            "keywords": ["沉浸", "梦境", "体验", "代入"],
        },
        "voice-workshop": {
            "name": "叙事声音",
            "description": "叙事者声音塑造",
            "task_types": [TaskType.CHAPTER_WRITING],
            "keywords": ["声音", "叙事者", "风格", "语调"],
        },
        
        # ============ 评估类 ============
        "script-doctor": {
            "name": "剧本医生",
            "description": "综合诊断框架",
            "task_types": [TaskType.QUALITY_REVIEW, TaskType.CLICHE_CHECK],
            "keywords": ["诊断", "评估", "问题", "修复", "质量"],
        },
        
        # ============ 其他 ============
        "premise-magic": {
            "name": "前提魔法",
            "description": "故事前提设计",
            "task_types": [TaskType.STORY_OUTLINE],
            "keywords": ["前提", "概念", "点子", "核心"],
        },
        "presentation": {
            "name": "演示文稿",
            "description": "演示内容创作",
            "task_types": [],
            "keywords": ["演示", "PPT", "展示"],
        },
    }
    
    # 任务类型到技能的快速映射
    TASK_SKILL_MAP = {
        TaskType.CHARACTER_CREATION: [
            ("four-selves", 1.0, 1),
            ("character-forge", 0.9, 2),
            ("mirror-foil", 0.7, 3),
        ],
        TaskType.CHARACTER_DEVELOPMENT: [
            ("true-character", 1.0, 1),
            ("four-selves", 0.9, 2),
            ("self-knowledge-eval", 0.8, 3),
        ],
        TaskType.CHARACTER_DIALOGUE: [
            ("subtext-dialogue", 1.0, 1),
            ("on-the-nose-fix", 0.8, 2),
        ],
        TaskType.STORY_OUTLINE: [
            ("22-steps-outline", 1.0, 1),
            ("pyramid-structure", 0.8, 2),
            ("premise-magic", 0.7, 3),
        ],
        TaskType.SCENE_DESIGN: [
            ("object-symbolism", 0.9, 1),
            ("mirror-foil", 0.8, 2),
            ("suspense-craft", 0.7, 3),
        ],
        TaskType.CHAPTER_WRITING: [
            ("novel-chapter", 1.0, 1),
            ("show-dont-tell", 0.9, 2),
            ("fictional-dream", 0.8, 3),
            ("voice-workshop", 0.7, 4),
        ],
        TaskType.SUSPENSE_BUILD: [
            ("suspense-craft", 1.0, 1),
            ("misdirection-twist", 0.9, 2),
            ("object-symbolism", 0.7, 3),
        ],
        TaskType.TWIST_DESIGN: [
            ("misdirection-twist", 1.0, 1),
            ("deus-ex-machina", 0.8, 2),
        ],
        TaskType.CLIMAX_WRITING: [
            ("true-character", 1.0, 1),
            ("show-dont-tell", 0.9, 2),
            ("misdirection-twist", 0.7, 3),
        ],
        TaskType.DIALOGUE_FIX: [
            ("on-the-nose-fix", 1.0, 1),
            ("subtext-dialogue", 0.9, 2),
        ],
        TaskType.DESCRIPTION_FIX: [
            ("show-dont-tell", 1.0, 1),
            ("fictional-dream", 0.7, 2),
        ],
        TaskType.LOGIC_FIX: [
            ("deus-ex-machina", 1.0, 1),
            ("pyramid-structure", 0.7, 2),
        ],
        TaskType.QUALITY_REVIEW: [
            ("script-doctor", 1.0, 1),
            ("self-knowledge-eval", 0.8, 2),
            ("deus-ex-machina", 0.7, 3),
        ],
        TaskType.CLICHE_CHECK: [
            ("script-doctor", 1.0, 1),
        ],
    }
    
    def __init__(self):
        pass
    
    def route_by_task_type(
        self, 
        task_type: TaskType, 
        max_skills: int = 3
    ) -> List[SkillRecommendation]:
        """
        根据任务类型路由技能
        
        Args:
            task_type: 任务类型
            max_skills: 最多返回的技能数
            
        Returns:
            按优先级排序的技能推荐列表
        """
        if task_type not in self.TASK_SKILL_MAP:
            return []
        
        recommendations = []
        for skill_id, relevance, priority in self.TASK_SKILL_MAP[task_type][:max_skills]:
            skill_info = self.SKILL_REGISTRY.get(skill_id, {})
            recommendations.append(SkillRecommendation(
                skill_id=skill_id,
                skill_name=skill_info.get("name", skill_id),
                relevance=relevance,
                reason=skill_info.get("description", ""),
                priority=priority,
            ))
        
        return recommendations
    
    def route_by_keywords(
        self, 
        keywords: List[str], 
        max_skills: int = 5
    ) -> List[SkillRecommendation]:
        """
        根据关键词路由技能
        
        Args:
            keywords: 关键词列表
            max_skills: 最多返回的技能数
            
        Returns:
            按相关度排序的技能推荐列表
        """
        keyword_set = set(kw.lower() for kw in keywords)
        scores = []
        
        for skill_id, skill_info in self.SKILL_REGISTRY.items():
            skill_keywords = set(kw.lower() for kw in skill_info.get("keywords", []))
            
            # 计算关键词重叠度
            overlap = len(keyword_set & skill_keywords)
            if overlap > 0:
                relevance = overlap / max(len(keyword_set), len(skill_keywords))
                scores.append((skill_id, skill_info, relevance))
        
        # 按相关度排序
        scores.sort(key=lambda x: x[2], reverse=True)
        
        recommendations = []
        for i, (skill_id, skill_info, relevance) in enumerate(scores[:max_skills]):
            recommendations.append(SkillRecommendation(
                skill_id=skill_id,
                skill_name=skill_info.get("name", skill_id),
                relevance=relevance,
                reason=skill_info.get("description", ""),
                priority=i + 1,
            ))
        
        return recommendations
    
    def route_by_issue(
        self, 
        issue_type: str
    ) -> List[SkillRecommendation]:
        """
        根据问题类型路由修复技能
        
        Args:
            issue_type: 问题类型字符串
            
        Returns:
            推荐的修复技能列表
        """
        issue_mapping = {
            "直白对白": [TaskType.DIALOGUE_FIX],
            "潜台词不足": [TaskType.CHARACTER_DIALOGUE],
            "人物扁平": [TaskType.CHARACTER_CREATION, TaskType.CHARACTER_DEVELOPMENT],
            "机械降神": [TaskType.LOGIC_FIX],
            "巧合过多": [TaskType.LOGIC_FIX],
            "描写抽象": [TaskType.DESCRIPTION_FIX],
            "缺乏悬念": [TaskType.SUSPENSE_BUILD],
            "反转无力": [TaskType.TWIST_DESIGN],
            "陈词滥调": [TaskType.CLICHE_CHECK],
            "角色弧光不完整": [TaskType.CHARACTER_DEVELOPMENT],
        }
        
        all_recommendations = []
        for issue_key, task_types in issue_mapping.items():
            if issue_key in issue_type:
                for task_type in task_types:
                    all_recommendations.extend(self.route_by_task_type(task_type))
        
        # 去重并按优先级排序
        seen = set()
        unique_recommendations = []
        for rec in all_recommendations:
            if rec.skill_id not in seen:
                seen.add(rec.skill_id)
                unique_recommendations.append(rec)
        
        return unique_recommendations[:5]
    
    def get_skill_chain(
        self, 
        primary_task: TaskType,
        context: Optional[Dict[str, Any]] = None
    ) -> List[SkillRecommendation]:
        """
        获取技能链 - 根据主任务推荐完整的技能使用序列
        
        Args:
            primary_task: 主要任务类型
            context: 额外上下文信息
            
        Returns:
            按执行顺序排列的技能链
        """
        # 技能链配置
        SKILL_CHAINS = {
            TaskType.CHARACTER_CREATION: [
                "character-forge",   # 1. 基础设定
                "four-selves",       # 2. 深化内心层次
                "mirror-foil",       # 3. 设计配角网络
            ],
            TaskType.CHAPTER_WRITING: [
                "22-steps-outline",  # 1. 确认结构位置
                "subtext-dialogue",  # 2. 对话设计
                "show-dont-tell",    # 3. 描写技法
                "novel-chapter",     # 4. 章节完成
            ],
            TaskType.CLIMAX_WRITING: [
                "true-character",    # 1. 设计核心选择
                "misdirection-twist",# 2. 反转设计
                "show-dont-tell",    # 3. 高强度描写
            ],
            TaskType.QUALITY_REVIEW: [
                "script-doctor",     # 1. 综合诊断
                "deus-ex-machina",   # 2. 逻辑检查
                "self-knowledge-eval",# 3. 弧光评估
            ],
        }
        
        chain_skill_ids = SKILL_CHAINS.get(primary_task, [])
        
        recommendations = []
        for i, skill_id in enumerate(chain_skill_ids):
            skill_info = self.SKILL_REGISTRY.get(skill_id, {})
            recommendations.append(SkillRecommendation(
                skill_id=skill_id,
                skill_name=skill_info.get("name", skill_id),
                relevance=1.0,
                reason=f"技能链第{i+1}步: {skill_info.get('description', '')}",
                priority=i + 1,
            ))
        
        return recommendations
    
    def list_all_skills(self) -> Dict[str, Dict[str, Any]]:
        """列出所有已注册的技能"""
        return self.SKILL_REGISTRY.copy()


# ============================================================
# 便捷函数
# ============================================================

def get_skills_for_task(task_type: TaskType) -> List[SkillRecommendation]:
    """快捷函数：获取任务对应的技能"""
    router = SkillRouter()
    return router.route_by_task_type(task_type)


def get_skills_for_issue(issue: str) -> List[SkillRecommendation]:
    """快捷函数：获取问题修复技能"""
    router = SkillRouter()
    return router.route_by_issue(issue)
