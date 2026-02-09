# -*- coding: utf-8 -*-
"""
深度角色建模系统 (Character Manager)

五维度角色模型 (基于弗雷《让劲爆小说飞起来》):
1. Dynamic - 动态主导情感 (静态+动态情感演变)
2. Competence - 能力展示 (专业技能/解决问题能力)
3. Eccentricity - 古怪特质 (独特习惯/观点/行为)
4. Contrast - 环境对比 (鱼离开水技巧)
5. Duality - 双重人格 (内心冲突/两面性)

核心功能:
- 五维度角色建模
- 跨场景状态追踪
- 对话风格一致性检测
- GraphManager 集成
- 角色弧线管理
"""

import logging
import hashlib
import json
import re
import uuid
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set, Tuple
from enum import Enum
from datetime import datetime

logger = logging.getLogger("niko-character-manager")


# ============================================================
# Enums
# ============================================================

class PersonalityType(Enum):
    """性格类型"""
    # MBTI 简化版
    ANALYST = "analyst"          # 分析型 (INTJ/INTP/ENTJ/ENTP)
    DIPLOMAT = "diplomat"        # 外交型 (INFJ/INFP/ENFJ/ENFP)
    SENTINEL = "sentinel"        # 守卫型 (ISTJ/ISFJ/ESTJ/ESFJ)
    EXPLORER = "explorer"        # 探索型 (ISTP/ISFP/ESTP/ESFP)


class MotivationType(Enum):
    """动机类型 - 基于马斯洛需求层次"""
    SURVIVAL = "survival"            # 生存需求
    SAFETY = "safety"                # 安全需求
    BELONGING = "belonging"          # 归属需求
    ESTEEM = "esteem"                # 尊重需求
    SELF_ACTUALIZATION = "self_actualization"  # 自我实现


class RelationshipType(Enum):
    """关系类型"""
    FAMILY = "family"            # 家庭
    ROMANTIC = "romantic"        # 爱情
    FRIENDSHIP = "friendship"    # 友谊
    RIVALRY = "rivalry"          # 对手
    MENTOR = "mentor"            # 导师
    PROTEGE = "protege"          # 门徒
    ALLY = "ally"                # 盟友
    ENEMY = "enemy"              # 敌人
    ACQUAINTANCE = "acquaintance"  # 熟人


class GrowthStage(Enum):
    """成长阶段"""
    ORDINARY_WORLD = "ordinary_world"    # 平凡世界
    CALL_TO_ADVENTURE = "call"           # 冒险召唤
    REFUSAL = "refusal"                  # 拒绝召唤
    MEETING_MENTOR = "mentor"            # 遇见导师
    CROSSING_THRESHOLD = "threshold"     # 跨越门槛
    TESTS_ALLIES_ENEMIES = "tests"       # 考验盟友敌人
    INNERMOST_CAVE = "cave"              # 最深处洞穴
    ORDEAL = "ordeal"                    # 磨难
    REWARD = "reward"                    # 奖赏
    ROAD_BACK = "road_back"              # 返回之路
    RESURRECTION = "resurrection"        # 复活
    RETURN_WITH_ELIXIR = "elixir"        # 携万灵药归来


class EmotionalState(Enum):
    """情绪状态"""
    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    DISGUST = "disgust"
    SURPRISE = "surprise"
    TRUST = "trust"
    ANTICIPATION = "anticipation"
    NEUTRAL = "neutral"


class DepthLevel(Enum):
    """角色深度等级"""
    FLAT = "flat"                    # 扁平 (< 50分)
    MODERATE = "moderate"            # 中等 (50-70分)
    DEEP = "deep"                    # 深刻 (70-85分)
    UNFORGETTABLE = "unforgettable"  # 令人难忘 (> 85分)


# ============================================================
# 五维度模型 - 核心数据类
# ============================================================

@dataclass
class DynamicEmotion:
    """
    维度1: 动态主导情感

    静态情感: 定义角色基本特质的情感 (如: 忧郁、乐观)
    动态情感: 当前驱动情节的情感 (随故事发展变化)
    """
    static_emotion: str              # 静态主导情感
    dynamic_emotion: str             # 动态主导情感 (当前)
    intensity: int = 50              # 情感强度 (0-100)
    evolution: List[Tuple[str, str]] = field(default_factory=list)  # (场景ID, 情感) 演变轨迹

    def evolve(self, scene_id: str, new_emotion: str) -> None:
        """情感演变"""
        self.evolution.append((scene_id, self.dynamic_emotion))
        self.dynamic_emotion = new_emotion

    def get_trajectory(self) -> List[str]:
        """获取情感轨迹"""
        trajectory = [self.static_emotion]
        for _, emotion in self.evolution:
            trajectory.append(emotion)
        trajectory.append(self.dynamic_emotion)
        return trajectory

    def to_dict(self) -> Dict[str, Any]:
        return {
            "static_emotion": self.static_emotion,
            "dynamic_emotion": self.dynamic_emotion,
            "intensity": self.intensity,
            "evolution": self.evolution,
        }


@dataclass
class Competence:
    """
    维度2: 能力展示

    角色必须在某个领域展现出色的能力，让读者尊重/欣赏他们。
    """
    primary_skill: str               # 主要技能领域
    skill_level: int = 75            # 技能水平 (0-100)
    specializations: List[str] = field(default_factory=list)  # 专长列表

    # 能力展示实例
    demonstrations: List[Dict[str, str]] = field(default_factory=list)
    # 格式: {"scene_id": "xxx", "action": "做了什么", "result": "结果"}

    # 能力局限
    limitations: List[str] = field(default_factory=list)  # 能力局限

    def add_demonstration(self, scene_id: str, action: str, result: str) -> None:
        """添加能力展示实例"""
        self.demonstrations.append({
            "scene_id": scene_id,
            "action": action,
            "result": result,
        })

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_skill": self.primary_skill,
            "skill_level": self.skill_level,
            "specializations": self.specializations,
            "demonstrations": self.demonstrations,
            "limitations": self.limitations,
        }


@dataclass
class Eccentricity:
    """
    维度3: 古怪特质

    令人难忘的角色都有古怪之处 - 独特的习惯、观点或行为。
    经典案例: 亚哈船长对白鲸的执念, 福尔摩斯的怪癖
    """
    quirks: List[str] = field(default_factory=list)        # 怪癖列表
    obsessions: List[str] = field(default_factory=list)    # 执念/痴迷
    unusual_habits: List[str] = field(default_factory=list)  # 不寻常习惯
    unique_worldview: str = ""       # 独特世界观
    catchphrases: List[str] = field(default_factory=list)  # 口头禅

    # 古怪程度 (0-100)
    eccentricity_level: int = 50

    def add_quirk(self, quirk: str, category: str = "quirks") -> None:
        """添加古怪特质"""
        if category == "obsessions":
            self.obsessions.append(quirk)
        elif category == "habits":
            self.unusual_habits.append(quirk)
        else:
            self.quirks.append(quirk)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quirks": self.quirks,
            "obsessions": self.obsessions,
            "unusual_habits": self.unusual_habits,
            "unique_worldview": self.unique_worldview,
            "catchphrases": self.catchphrases,
            "eccentricity_level": self.eccentricity_level,
        }


@dataclass
class EnvironmentContrast:
    """
    维度4: 环境对比 (鱼离开水)

    将角色置于其不适应的环境中，产生戏剧张力。
    经典案例: 《大白鲨》中不会游泳的州长必须出海猎鲨
    """
    comfort_zone: str                # 舒适区描述
    current_environment: str         # 当前环境
    contrast_level: str = "medium"   # 对比程度: low/medium/high/extreme

    # 摩擦点
    friction_points: List[str] = field(default_factory=list)  # 角色与环境的冲突点

    # 成长潜力
    growth_opportunities: List[str] = field(default_factory=list)  # 环境带来的成长机会

    # 对比分数 (0-100)
    contrast_score: int = 50

    def to_dict(self) -> Dict[str, Any]:
        return {
            "comfort_zone": self.comfort_zone,
            "current_environment": self.current_environment,
            "contrast_level": self.contrast_level,
            "friction_points": self.friction_points,
            "growth_opportunities": self.growth_opportunities,
            "contrast_score": self.contrast_score,
        }


@dataclass
class Persona:
    """人格"""
    name: str                        # 人格名称
    traits: List[str]                # 特质列表
    trigger_conditions: List[str]    # 触发条件
    behavior_patterns: List[str]     # 行为模式


@dataclass
class DualPersonality:
    """
    维度5: 双重人格

    一个身体里存在两种截然不同的性格，产生内心戏剧张力。
    经典案例: "狂暴的罗斯顿"少校 - 冷酷坦克指挥官 + 热爱绘画的艺术家
    """
    primary_persona: Persona         # 主要人格
    shadow_persona: Persona          # 隐藏人格
    internal_conflict: str           # 内心冲突描述

    switch_triggers: List[str] = field(default_factory=list)  # 人格切换触发器

    # 冲突场景示例
    conflict_scenarios: List[str] = field(default_factory=list)
    # 格式: "当他必须XXX时，两种人格会发生冲突"

    # 双重性分数 (0-100)
    duality_score: int = 50

    def get_conflict_potential(self) -> str:
        """获取冲突潜力描述"""
        return f"当{self.primary_persona.name}必须面对{self.shadow_persona.name}的需求时，内心冲突将达到顶峰"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_persona": {
                "name": self.primary_persona.name,
                "traits": self.primary_persona.traits,
                "trigger_conditions": self.primary_persona.trigger_conditions,
                "behavior_patterns": self.primary_persona.behavior_patterns,
            },
            "shadow_persona": {
                "name": self.shadow_persona.name,
                "traits": self.shadow_persona.traits,
                "trigger_conditions": self.shadow_persona.trigger_conditions,
                "behavior_patterns": self.shadow_persona.behavior_patterns,
            },
            "internal_conflict": self.internal_conflict,
            "switch_triggers": self.switch_triggers,
            "conflict_scenarios": self.conflict_scenarios,
            "duality_score": self.duality_score,
        }


# ============================================================
# 对话风格
# ============================================================

@dataclass
class DialogueStyle:
    """对话风格 - 用于一致性检测"""
    vocabulary_level: str = "medium"  # simple/medium/sophisticated
    sentence_length: str = "medium"   # short/medium/long
    formality: str = "neutral"        # casual/neutral/formal

    # 语言特征
    favorite_words: List[str] = field(default_factory=list)    # 常用词汇
    avoided_words: List[str] = field(default_factory=list)     # 避免使用的词
    speech_patterns: List[str] = field(default_factory=list)   # 说话模式
    verbal_tics: List[str] = field(default_factory=list)       # 语言习惯/口头禅

    # 情感表达
    emotional_expression: str = "moderate"  # reserved/moderate/expressive

    # 对话样本 (用于风格学习)
    dialogue_samples: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "vocabulary_level": self.vocabulary_level,
            "sentence_length": self.sentence_length,
            "formality": self.formality,
            "favorite_words": self.favorite_words,
            "avoided_words": self.avoided_words,
            "speech_patterns": self.speech_patterns,
            "verbal_tics": self.verbal_tics,
            "emotional_expression": self.emotional_expression,
            "sample_count": len(self.dialogue_samples),
        }


# ============================================================
# 基础数据类 (保留原有结构)
# ============================================================

@dataclass
class Personality:
    """性格特质维度"""
    type: PersonalityType
    core_traits: List[str]           # 核心特质 (3-5个)
    strengths: List[str]             # 优势
    weaknesses: List[str]            # 弱点 (致命缺陷)
    quirks: List[str]                # 怪癖/习惯
    speech_patterns: List[str]       # 说话方式/口头禅
    values: List[str]                # 核心价值观

    # 大五人格评分 (0-100)
    openness: int = 50               # 开放性
    conscientiousness: int = 50      # 尽责性
    extraversion: int = 50           # 外向性
    agreeableness: int = 50          # 宜人性
    neuroticism: int = 50            # 神经质

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "core_traits": self.core_traits,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "quirks": self.quirks,
            "speech_patterns": self.speech_patterns,
            "values": self.values,
            "big_five": {
                "openness": self.openness,
                "conscientiousness": self.conscientiousness,
                "extraversion": self.extraversion,
                "agreeableness": self.agreeableness,
                "neuroticism": self.neuroticism,
            }
        }


@dataclass
class KeyEvent:
    """关键事件"""
    age: Optional[int]               # 发生年龄
    description: str                 # 事件描述
    impact: str                      # 对角色的影响
    emotional_residue: str           # 情感残留


@dataclass
class Background:
    """背景故事维度"""
    birth_place: str                 # 出生地
    family_structure: str            # 家庭结构
    social_class: str                # 社会阶层
    education: str                   # 教育背景
    occupation: str                  # 职业

    childhood_events: List[KeyEvent] = field(default_factory=list)  # 童年事件
    formative_events: List[KeyEvent] = field(default_factory=list)  # 成长事件
    trauma: List[KeyEvent] = field(default_factory=list)            # 创伤事件
    gifts: List[str] = field(default_factory=list)                  # 天赋/恩赐
    secrets: List[str] = field(default_factory=list)                # 秘密

    def to_dict(self) -> Dict[str, Any]:
        return {
            "birth_place": self.birth_place,
            "family_structure": self.family_structure,
            "social_class": self.social_class,
            "education": self.education,
            "occupation": self.occupation,
            "childhood_events": [
                {"age": e.age, "description": e.description, "impact": e.impact}
                for e in self.childhood_events
            ],
            "formative_events": [
                {"age": e.age, "description": e.description, "impact": e.impact}
                for e in self.formative_events
            ],
            "trauma": [
                {"description": e.description, "impact": e.impact, "emotional_residue": e.emotional_residue}
                for e in self.trauma
            ],
            "gifts": self.gifts,
            "secrets": self.secrets,
        }


@dataclass
class Motivation:
    """动机欲望维度"""
    type: MotivationType

    # 三层动机结构
    surface_goal: str                # 表层目标 (角色认为自己想要的)
    deep_need: str                   # 深层需求 (角色真正需要的)
    inner_fear: str                  # 内心恐惧 (驱动行为的恐惧)

    # 欲望与障碍
    want: str                        # 想要 (外在目标)
    need: str                        # 需要 (内在需求)
    lie: str                         # 谎言 (角色相信的错误信念)
    ghost: str                       # 幽灵 (过去的创伤源)

    stakes: List[str] = field(default_factory=list)  # 赌注 (失败的代价)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "surface_goal": self.surface_goal,
            "deep_need": self.deep_need,
            "inner_fear": self.inner_fear,
            "want": self.want,
            "need": self.need,
            "lie": self.lie,
            "ghost": self.ghost,
            "stakes": self.stakes,
        }


@dataclass
class Relationship:
    """单个关系"""
    target_id: str                   # 关系对象ID
    target_name: str                 # 关系对象名
    type: RelationshipType           # 关系类型

    # 关系动态
    trust_level: int = 50            # 信任度 (0-100)
    power_balance: int = 50          # 权力平衡 (0=对方主导, 100=我方主导)
    emotional_bond: int = 50         # 情感纽带强度 (0-100)
    conflict_potential: int = 50     # 冲突潜力 (0-100)

    history: str = ""                # 关系历史
    current_status: str = ""         # 当前状态
    tension_points: List[str] = field(default_factory=list)  # 紧张点

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_id": self.target_id,
            "target_name": self.target_name,
            "type": self.type.value,
            "trust_level": self.trust_level,
            "power_balance": self.power_balance,
            "emotional_bond": self.emotional_bond,
            "conflict_potential": self.conflict_potential,
            "history": self.history,
            "current_status": self.current_status,
            "tension_points": self.tension_points,
        }


@dataclass
class Relationships:
    """人物关系维度"""
    connections: List[Relationship] = field(default_factory=list)
    social_role: str = ""            # 社会角色
    group_affiliations: List[str] = field(default_factory=list)  # 群体归属

    def add_relationship(self, rel: Relationship):
        self.connections.append(rel)

    def get_relationship(self, target_id: str) -> Optional[Relationship]:
        for rel in self.connections:
            if rel.target_id == target_id:
                return rel
        return None

    def get_by_type(self, rel_type: RelationshipType) -> List[Relationship]:
        return [r for r in self.connections if r.type == rel_type]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "connections": [r.to_dict() for r in self.connections],
            "social_role": self.social_role,
            "group_affiliations": self.group_affiliations,
        }


@dataclass
class GrowthArc:
    """成长弧线维度"""
    arc_type: str                    # 弧线类型: positive/negative/flat

    # 起点与终点
    starting_state: str              # 起点状态 (故事开始时的角色)
    ending_state: str                # 终点状态 (故事结束时的角色)

    # 转变
    catalyst: str                    # 催化剂 (触发转变的事件)
    turning_points: List[str] = field(default_factory=list)  # 转折点

    # 当前进度
    current_stage: GrowthStage = GrowthStage.ORDINARY_WORLD
    progress: float = 0.0            # 弧线进度 (0-1)

    # 内在转变
    belief_change: str = ""          # 信念转变 (从相信X到相信Y)
    skill_growth: List[str] = field(default_factory=list)    # 技能成长
    relationship_evolution: List[str] = field(default_factory=list)  # 关系演变

    def to_dict(self) -> Dict[str, Any]:
        return {
            "arc_type": self.arc_type,
            "starting_state": self.starting_state,
            "ending_state": self.ending_state,
            "catalyst": self.catalyst,
            "turning_points": self.turning_points,
            "current_stage": self.current_stage.value,
            "progress": self.progress,
            "belief_change": self.belief_change,
            "skill_growth": self.skill_growth,
            "relationship_evolution": self.relationship_evolution,
        }


# ============================================================
# Character State - 场景状态追踪
# ============================================================

@dataclass
class CharacterState:
    """角色在特定场景中的状态"""
    scene_id: str
    timestamp: datetime

    # 物理状态
    location: str = ""
    physical_condition: str = "normal"  # normal/injured/exhausted/etc
    appearance: str = ""
    possessions: List[str] = field(default_factory=list)

    # 情绪状态
    emotional_state: EmotionalState = EmotionalState.NEUTRAL
    emotional_intensity: int = 50    # 0-100
    mood: str = ""

    # 心理状态
    current_goal: str = ""           # 当前场景目标
    concerns: List[str] = field(default_factory=list)  # 当前担忧
    knowledge: List[str] = field(default_factory=list)  # 角色已知信息

    # 关系状态快照
    relationship_changes: Dict[str, int] = field(default_factory=dict)  # 关系变化

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scene_id": self.scene_id,
            "timestamp": self.timestamp.isoformat(),
            "location": self.location,
            "physical_condition": self.physical_condition,
            "appearance": self.appearance,
            "possessions": self.possessions,
            "emotional_state": self.emotional_state.value,
            "emotional_intensity": self.emotional_intensity,
            "mood": self.mood,
            "current_goal": self.current_goal,
            "concerns": self.concerns,
            "knowledge": self.knowledge,
            "relationship_changes": self.relationship_changes,
        }


# ============================================================
# 五维度评分结果
# ============================================================

@dataclass
class FiveDimensionScore:
    """五维度评分"""
    dynamic_score: float = 0.0       # 动态情感分数
    competence_score: float = 0.0    # 能力展示分数
    eccentricity_score: float = 0.0  # 古怪特质分数
    contrast_score: float = 0.0      # 环境对比分数
    duality_score: float = 0.0       # 双重人格分数

    # 权重 (基于弗雷理论)
    WEIGHTS = {
        "dynamic": 0.15,
        "competence": 0.15,
        "eccentricity": 0.20,
        "contrast": 0.20,
        "duality": 0.30,
    }

    @property
    def overall_score(self) -> float:
        """计算综合分数"""
        return (
            self.dynamic_score * self.WEIGHTS["dynamic"] +
            self.competence_score * self.WEIGHTS["competence"] +
            self.eccentricity_score * self.WEIGHTS["eccentricity"] +
            self.contrast_score * self.WEIGHTS["contrast"] +
            self.duality_score * self.WEIGHTS["duality"]
        )

    @property
    def depth_level(self) -> DepthLevel:
        """获取深度等级"""
        score = self.overall_score
        if score >= 85:
            return DepthLevel.UNFORGETTABLE
        elif score >= 70:
            return DepthLevel.DEEP
        elif score >= 50:
            return DepthLevel.MODERATE
        else:
            return DepthLevel.FLAT

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dynamic": self.dynamic_score,
            "competence": self.competence_score,
            "eccentricity": self.eccentricity_score,
            "contrast": self.contrast_score,
            "duality": self.duality_score,
            "overall": self.overall_score,
            "depth_level": self.depth_level.value,
        }


# ============================================================
# Character - 完整角色模型
# ============================================================

@dataclass
class Character:
    """五维度角色模型"""
    id: str
    name: str

    # 基础维度
    personality: Personality
    background: Background
    motivation: Motivation
    relationships: Relationships
    growth: GrowthArc

    # 五维度深度模型 (新增)
    dynamic_emotion: Optional[DynamicEmotion] = None
    competence: Optional[Competence] = None
    eccentricity: Optional[Eccentricity] = None
    environment_contrast: Optional[EnvironmentContrast] = None
    dual_personality: Optional[DualPersonality] = None

    # 对话风格
    dialogue_style: Optional[DialogueStyle] = None

    # 元数据
    role: str = "supporting"         # protagonist/antagonist/supporting/minor
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # 状态历史
    state_history: List[CharacterState] = field(default_factory=list)

    # 对话历史 (用于风格分析)
    dialogue_history: List[Dict[str, str]] = field(default_factory=list)

    def get_current_state(self) -> Optional[CharacterState]:
        """获取最新状态"""
        if self.state_history:
            return self.state_history[-1]
        return None

    def add_state(self, state: CharacterState):
        """添加状态记录"""
        self.state_history.append(state)
        self.updated_at = datetime.now()

    def get_state_at_scene(self, scene_id: str) -> Optional[CharacterState]:
        """获取特定场景的状态"""
        for state in reversed(self.state_history):
            if state.scene_id == scene_id:
                return state
        return None

    def add_dialogue(self, scene_id: str, dialogue: str) -> None:
        """添加对话记录"""
        self.dialogue_history.append({
            "scene_id": scene_id,
            "dialogue": dialogue,
            "timestamp": datetime.now().isoformat(),
        })

    def get_five_dimension_score(self) -> FiveDimensionScore:
        """计算五维度评分"""
        score = FiveDimensionScore()

        # 动态情感评分
        if self.dynamic_emotion:
            evolution_bonus = min(len(self.dynamic_emotion.evolution) * 10, 30)
            score.dynamic_score = min(100, 40 + self.dynamic_emotion.intensity * 0.3 + evolution_bonus)

        # 能力展示评分
        if self.competence:
            demo_bonus = min(len(self.competence.demonstrations) * 15, 45)
            score.competence_score = min(100, 25 + self.competence.skill_level * 0.3 + demo_bonus)

        # 古怪特质评分
        if self.eccentricity:
            quirk_count = (
                len(self.eccentricity.quirks) +
                len(self.eccentricity.obsessions) * 2 +
                len(self.eccentricity.unusual_habits)
            )
            score.eccentricity_score = min(100, self.eccentricity.eccentricity_level + quirk_count * 5)

        # 环境对比评分
        if self.environment_contrast:
            score.contrast_score = self.environment_contrast.contrast_score

        # 双重人格评分
        if self.dual_personality:
            conflict_bonus = min(len(self.dual_personality.conflict_scenarios) * 10, 30)
            score.duality_score = min(100, self.dual_personality.duality_score + conflict_bonus)

        return score

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "personality": self.personality.to_dict(),
            "background": self.background.to_dict(),
            "motivation": self.motivation.to_dict(),
            "relationships": self.relationships.to_dict(),
            "growth": self.growth.to_dict(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "state_count": len(self.state_history),
            "dialogue_count": len(self.dialogue_history),
        }

        # 五维度数据
        if self.dynamic_emotion:
            result["dynamic_emotion"] = self.dynamic_emotion.to_dict()
        if self.competence:
            result["competence"] = self.competence.to_dict()
        if self.eccentricity:
            result["eccentricity"] = self.eccentricity.to_dict()
        if self.environment_contrast:
            result["environment_contrast"] = self.environment_contrast.to_dict()
        if self.dual_personality:
            result["dual_personality"] = self.dual_personality.to_dict()
        if self.dialogue_style:
            result["dialogue_style"] = self.dialogue_style.to_dict()

        # 五维度评分
        result["five_dimension_score"] = self.get_five_dimension_score().to_dict()

        return result

    def generate_id(self) -> str:
        """生成角色ID"""
        content = f"{self.name}-{self.created_at.isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:12]


# ============================================================
# Character Manager - 角色管理器
# ============================================================

class CharacterManager:
    """
    角色管理器

    功能:
    1. 角色CRUD
    2. 五维度建模 (动态/能力/古怪/对比/双重人格)
    3. 跨场景状态追踪
    4. 对话风格一致性检测
    5. 关系网络管理
    6. GraphManager 集成
    """

    def __init__(self, llm=None, graph_manager=None):
        self.llm = llm
        self.graph_manager = graph_manager  # GraphManager 集成
        self.characters: Dict[str, Character] = {}
        self.name_index: Dict[str, str] = {}  # name -> id

        # 对话风格检测标记
        self._style_markers = {
            "formal": ["您", "贵", "敬", "请问", "恕我"],
            "casual": ["嘿", "哟", "呐", "咋", "整"],
            "expressive": ["!", "?!", "...", "~"],
            "reserved": ["嗯", "哦", "是的", "好的"],
        }

        logger.info("CharacterManager initialized")

    # ========================================
    # CRUD Operations
    # ========================================

    def create_character(
        self,
        name: str,
        role: str = "supporting",
        personality: Optional[Personality] = None,
        background: Optional[Background] = None,
        motivation: Optional[Motivation] = None,
        growth: Optional[GrowthArc] = None,
    ) -> Character:
        """创建角色"""
        char_id = hashlib.md5(f"{name}-{datetime.now().isoformat()}".encode()).hexdigest()[:12]

        character = Character(
            id=char_id,
            name=name,
            role=role,
            personality=personality or self._default_personality(),
            background=background or self._default_background(),
            motivation=motivation or self._default_motivation(),
            relationships=Relationships(),
            growth=growth or self._default_growth(),
        )

        self.characters[char_id] = character
        self.name_index[name] = char_id

        # 同步到 GraphManager
        if self.graph_manager:
            self._sync_to_graph(character)

        logger.info(f"Created character: {name} (id={char_id})")
        return character

    def get_character(self, char_id: str) -> Optional[Character]:
        """获取角色"""
        return self.characters.get(char_id)

    def get_by_name(self, name: str) -> Optional[Character]:
        """通过名字获取角色"""
        char_id = self.name_index.get(name)
        if char_id:
            return self.characters.get(char_id)
        return None

    def update_character(self, char_id: str, updates: Dict[str, Any]) -> bool:
        """更新角色"""
        char = self.characters.get(char_id)
        if not char:
            return False

        for key, value in updates.items():
            if hasattr(char, key):
                setattr(char, key, value)

        char.updated_at = datetime.now()

        # 同步到 GraphManager
        if self.graph_manager:
            self._sync_to_graph(char)

        return True

    def delete_character(self, char_id: str) -> bool:
        """删除角色"""
        char = self.characters.get(char_id)
        if char:
            del self.name_index[char.name]
            del self.characters[char_id]

            # 从 GraphManager 删除
            if self.graph_manager:
                self.graph_manager.delete_entity(char_id)

            logger.info(f"Deleted character: {char.name}")
            return True
        return False

    def list_characters(self, role: Optional[str] = None) -> List[Character]:
        """列出角色"""
        chars = list(self.characters.values())
        if role:
            chars = [c for c in chars if c.role == role]
        return chars

    # ========================================
    # 五维度建模 (新增)
    # ========================================

    def set_dynamic_emotion(
        self,
        char_id: str,
        static_emotion: str,
        dynamic_emotion: str,
        intensity: int = 50,
    ) -> bool:
        """设置动态情感 (维度1)"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.dynamic_emotion = DynamicEmotion(
            static_emotion=static_emotion,
            dynamic_emotion=dynamic_emotion,
            intensity=intensity,
        )
        char.updated_at = datetime.now()
        logger.info(f"Set dynamic emotion for {char.name}: {static_emotion} -> {dynamic_emotion}")
        return True

    def evolve_emotion(self, char_id: str, scene_id: str, new_emotion: str) -> bool:
        """情感演变"""
        char = self.characters.get(char_id)
        if not char or not char.dynamic_emotion:
            return False

        char.dynamic_emotion.evolve(scene_id, new_emotion)
        char.updated_at = datetime.now()
        logger.info(f"Evolved emotion for {char.name} in {scene_id}: {new_emotion}")
        return True

    def set_competence(
        self,
        char_id: str,
        primary_skill: str,
        skill_level: int = 75,
        specializations: List[str] = None,
        limitations: List[str] = None,
    ) -> bool:
        """设置能力展示 (维度2)"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.competence = Competence(
            primary_skill=primary_skill,
            skill_level=skill_level,
            specializations=specializations or [],
            limitations=limitations or [],
        )
        char.updated_at = datetime.now()
        logger.info(f"Set competence for {char.name}: {primary_skill} (level={skill_level})")
        return True

    def add_competence_demonstration(
        self,
        char_id: str,
        scene_id: str,
        action: str,
        result: str,
    ) -> bool:
        """添加能力展示实例"""
        char = self.characters.get(char_id)
        if not char or not char.competence:
            return False

        char.competence.add_demonstration(scene_id, action, result)
        char.updated_at = datetime.now()
        return True

    def set_eccentricity(
        self,
        char_id: str,
        quirks: List[str] = None,
        obsessions: List[str] = None,
        unusual_habits: List[str] = None,
        unique_worldview: str = "",
        catchphrases: List[str] = None,
        eccentricity_level: int = 50,
    ) -> bool:
        """设置古怪特质 (维度3)"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.eccentricity = Eccentricity(
            quirks=quirks or [],
            obsessions=obsessions or [],
            unusual_habits=unusual_habits or [],
            unique_worldview=unique_worldview,
            catchphrases=catchphrases or [],
            eccentricity_level=eccentricity_level,
        )
        char.updated_at = datetime.now()
        logger.info(f"Set eccentricity for {char.name} (level={eccentricity_level})")
        return True

    def set_environment_contrast(
        self,
        char_id: str,
        comfort_zone: str,
        current_environment: str,
        contrast_level: str = "medium",
        friction_points: List[str] = None,
        growth_opportunities: List[str] = None,
    ) -> bool:
        """设置环境对比 (维度4)"""
        char = self.characters.get(char_id)
        if not char:
            return False

        # 根据对比程度计算分数
        level_scores = {"low": 30, "medium": 50, "high": 70, "extreme": 90}
        contrast_score = level_scores.get(contrast_level, 50)

        char.environment_contrast = EnvironmentContrast(
            comfort_zone=comfort_zone,
            current_environment=current_environment,
            contrast_level=contrast_level,
            friction_points=friction_points or [],
            growth_opportunities=growth_opportunities or [],
            contrast_score=contrast_score,
        )
        char.updated_at = datetime.now()
        logger.info(f"Set environment contrast for {char.name}: {contrast_level}")
        return True

    def set_dual_personality(
        self,
        char_id: str,
        primary_name: str,
        primary_traits: List[str],
        primary_patterns: List[str],
        shadow_name: str,
        shadow_traits: List[str],
        shadow_patterns: List[str],
        internal_conflict: str,
        switch_triggers: List[str] = None,
        conflict_scenarios: List[str] = None,
        duality_score: int = 50,
    ) -> bool:
        """设置双重人格 (维度5)"""
        char = self.characters.get(char_id)
        if not char:
            return False

        primary_persona = Persona(
            name=primary_name,
            traits=primary_traits,
            trigger_conditions=[],
            behavior_patterns=primary_patterns,
        )

        shadow_persona = Persona(
            name=shadow_name,
            traits=shadow_traits,
            trigger_conditions=switch_triggers or [],
            behavior_patterns=shadow_patterns,
        )

        char.dual_personality = DualPersonality(
            primary_persona=primary_persona,
            shadow_persona=shadow_persona,
            internal_conflict=internal_conflict,
            switch_triggers=switch_triggers or [],
            conflict_scenarios=conflict_scenarios or [],
            duality_score=duality_score,
        )
        char.updated_at = datetime.now()
        logger.info(f"Set dual personality for {char.name}: {primary_name} vs {shadow_name}")
        return True

    def get_depth_assessment(self, char_id: str) -> Dict[str, Any]:
        """获取角色深度评估"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        score = char.get_five_dimension_score()

        # 生成建议
        suggestions = []

        if score.dynamic_score < 50:
            suggestions.append("增加情感演变场景，展示角色情感的动态变化")
        if score.competence_score < 50:
            suggestions.append("添加能力展示场景，让角色在其专长领域表现出色")
        if score.eccentricity_score < 50:
            suggestions.append("赋予角色独特的怪癖或执念，让其更加难忘")
        if score.contrast_score < 50:
            suggestions.append("将角色置于其不适应的环境中，产生戏剧张力")
        if score.duality_score < 50:
            suggestions.append("设计双重人格或内心矛盾，增加角色深度")

        return {
            "character": char.name,
            "scores": score.to_dict(),
            "depth_level": score.depth_level.value,
            "suggestions": suggestions,
        }

    # ========================================
    # 对话风格一致性检测
    # ========================================

    def set_dialogue_style(
        self,
        char_id: str,
        vocabulary_level: str = "medium",
        sentence_length: str = "medium",
        formality: str = "neutral",
        favorite_words: List[str] = None,
        speech_patterns: List[str] = None,
        verbal_tics: List[str] = None,
        emotional_expression: str = "moderate",
    ) -> bool:
        """设置对话风格"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.dialogue_style = DialogueStyle(
            vocabulary_level=vocabulary_level,
            sentence_length=sentence_length,
            formality=formality,
            favorite_words=favorite_words or [],
            speech_patterns=speech_patterns or [],
            verbal_tics=verbal_tics or [],
            emotional_expression=emotional_expression,
        )
        char.updated_at = datetime.now()
        logger.info(f"Set dialogue style for {char.name}")
        return True

    def add_dialogue_sample(self, char_id: str, scene_id: str, dialogue: str) -> bool:
        """添加对话样本"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.add_dialogue(scene_id, dialogue)

        # 如果有对话风格，添加样本
        if char.dialogue_style:
            char.dialogue_style.dialogue_samples.append(dialogue)

        return True

    def check_dialogue_consistency(
        self,
        char_id: str,
        new_dialogue: str,
    ) -> Dict[str, Any]:
        """检查对话一致性"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        if not char.dialogue_style:
            return {"warning": "No dialogue style defined", "consistent": True}

        issues = []
        style = char.dialogue_style

        # 检查正式度
        formal_count = sum(1 for m in self._style_markers["formal"] if m in new_dialogue)
        casual_count = sum(1 for m in self._style_markers["casual"] if m in new_dialogue)

        if style.formality == "formal" and casual_count > formal_count:
            issues.append("对话过于随意，与角色正式风格不符")
        elif style.formality == "casual" and formal_count > casual_count:
            issues.append("对话过于正式，与角色随意风格不符")

        # 检查口头禅/常用词
        verbal_tic_found = any(tic in new_dialogue for tic in style.verbal_tics)
        if style.verbal_tics and not verbal_tic_found:
            issues.append(f"缺少角色口头禅: {style.verbal_tics[:2]}")

        # 检查避免词
        avoided_found = [w for w in style.avoided_words if w in new_dialogue]
        if avoided_found:
            issues.append(f"使用了角色避免的词汇: {avoided_found}")

        # 检查情感表达
        expressive_count = sum(1 for m in self._style_markers["expressive"] if m in new_dialogue)
        reserved_count = sum(1 for m in self._style_markers["reserved"] if m in new_dialogue)

        if style.emotional_expression == "reserved" and expressive_count > 3:
            issues.append("情感表达过于强烈，与角色内敛风格不符")
        elif style.emotional_expression == "expressive" and reserved_count > expressive_count:
            issues.append("情感表达过于内敛，与角色外放风格不符")

        # 计算一致性分数
        consistency_score = max(0, 100 - len(issues) * 25)

        return {
            "character": char.name,
            "consistent": len(issues) == 0,
            "consistency_score": consistency_score,
            "issues": issues,
            "suggestions": [
                f"考虑加入口头禅: {style.verbal_tics}" if style.verbal_tics else None,
                f"使用常用词汇: {style.favorite_words}" if style.favorite_words else None,
            ],
        }

    def analyze_dialogue_pattern(self, char_id: str) -> Dict[str, Any]:
        """分析对话模式 (从历史对话中学习)"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        if not char.dialogue_history:
            return {"warning": "No dialogue history"}

        # 统计分析
        all_dialogues = " ".join([d["dialogue"] for d in char.dialogue_history])

        # 词频统计 (简化版)
        words = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', all_dialogues)
        word_freq = {}
        for word in words:
            if len(word) >= 2:
                word_freq[word] = word_freq.get(word, 0) + 1

        # 找出高频词
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        top_words = [w for w, _ in sorted_words[:10]]

        # 句子长度分析
        sentences = re.split(r'[。！？]', all_dialogues)
        avg_length = sum(len(s) for s in sentences if s) / max(len(sentences), 1)

        sentence_length = "short" if avg_length < 15 else "long" if avg_length > 30 else "medium"

        # 情感表达分析
        expressive_count = sum(1 for m in self._style_markers["expressive"] if m in all_dialogues)

        return {
            "character": char.name,
            "sample_count": len(char.dialogue_history),
            "top_words": top_words,
            "avg_sentence_length": round(avg_length, 1),
            "sentence_length_category": sentence_length,
            "expressive_level": "high" if expressive_count > 10 else "low" if expressive_count < 3 else "moderate",
        }

    # ========================================
    # State Tracking
    # ========================================

    def record_state(
        self,
        char_id: str,
        scene_id: str,
        location: str = "",
        emotional_state: EmotionalState = EmotionalState.NEUTRAL,
        emotional_intensity: int = 50,
        current_goal: str = "",
        physical_condition: str = "normal",
        knowledge: List[str] = None,
        possessions: List[str] = None,
    ) -> Optional[CharacterState]:
        """记录角色状态"""
        char = self.characters.get(char_id)
        if not char:
            return None

        state = CharacterState(
            scene_id=scene_id,
            timestamp=datetime.now(),
            location=location,
            emotional_state=emotional_state,
            emotional_intensity=emotional_intensity,
            current_goal=current_goal,
            physical_condition=physical_condition,
            knowledge=knowledge or [],
            possessions=possessions or [],
        )

        char.add_state(state)
        logger.info(f"Recorded state for {char.name} at scene {scene_id}")
        return state

    def get_character_timeline(self, char_id: str) -> List[Dict[str, Any]]:
        """获取角色时间线"""
        char = self.characters.get(char_id)
        if not char:
            return []

        return [state.to_dict() for state in char.state_history]

    def compare_states(
        self,
        char_id: str,
        scene_a: str,
        scene_b: str
    ) -> Dict[str, Any]:
        """比较两个场景的状态差异"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        state_a = char.get_state_at_scene(scene_a)
        state_b = char.get_state_at_scene(scene_b)

        if not state_a or not state_b:
            return {"error": "State not found"}

        return {
            "character": char.name,
            "scene_a": scene_a,
            "scene_b": scene_b,
            "changes": {
                "location": {
                    "from": state_a.location,
                    "to": state_b.location,
                },
                "emotional_state": {
                    "from": state_a.emotional_state.value,
                    "to": state_b.emotional_state.value,
                },
                "physical_condition": {
                    "from": state_a.physical_condition,
                    "to": state_b.physical_condition,
                },
                "knowledge_gained": [
                    k for k in state_b.knowledge if k not in state_a.knowledge
                ],
                "possessions_changed": {
                    "gained": [p for p in state_b.possessions if p not in state_a.possessions],
                    "lost": [p for p in state_a.possessions if p not in state_b.possessions],
                },
            }
        }

    # ========================================
    # Relationship Management
    # ========================================

    def add_relationship(
        self,
        char_id: str,
        target_id: str,
        rel_type: RelationshipType,
        trust_level: int = 50,
        history: str = "",
    ) -> bool:
        """添加关系"""
        char = self.characters.get(char_id)
        target = self.characters.get(target_id)

        if not char or not target:
            return False

        rel = Relationship(
            target_id=target_id,
            target_name=target.name,
            type=rel_type,
            trust_level=trust_level,
            history=history,
        )

        char.relationships.add_relationship(rel)

        # 同步到 GraphManager
        if self.graph_manager:
            self._sync_relationship_to_graph(char_id, target_id, rel_type, trust_level)

        logger.info(f"Added relationship: {char.name} -> {target.name} ({rel_type.value})")
        return True

    def update_relationship(
        self,
        char_id: str,
        target_id: str,
        trust_change: int = 0,
        power_change: int = 0,
        new_status: str = None,
    ) -> bool:
        """更新关系"""
        char = self.characters.get(char_id)
        if not char:
            return False

        rel = char.relationships.get_relationship(target_id)
        if not rel:
            return False

        rel.trust_level = max(0, min(100, rel.trust_level + trust_change))
        rel.power_balance = max(0, min(100, rel.power_balance + power_change))

        if new_status:
            rel.current_status = new_status

        return True

    def get_relationship_network(self) -> Dict[str, Any]:
        """获取关系网络"""
        nodes = []
        edges = []

        for char_id, char in self.characters.items():
            nodes.append({
                "id": char_id,
                "name": char.name,
                "role": char.role,
            })

            for rel in char.relationships.connections:
                edges.append({
                    "source": char_id,
                    "target": rel.target_id,
                    "type": rel.type.value,
                    "trust": rel.trust_level,
                    "power": rel.power_balance,
                })

        return {"nodes": nodes, "edges": edges}

    # ========================================
    # Growth Arc Management
    # ========================================

    def advance_growth(
        self,
        char_id: str,
        new_stage: GrowthStage,
        turning_point: str = None,
    ) -> bool:
        """推进成长弧线"""
        char = self.characters.get(char_id)
        if not char:
            return False

        char.growth.current_stage = new_stage

        # 计算进度
        stages = list(GrowthStage)
        current_index = stages.index(new_stage)
        char.growth.progress = current_index / (len(stages) - 1)

        if turning_point:
            char.growth.turning_points.append(turning_point)

        logger.info(f"Advanced {char.name} to stage: {new_stage.value}")
        return True

    # ========================================
    # Consistency Validation
    # ========================================

    def validate_consistency(self, char_id: str) -> Dict[str, Any]:
        """验证角色一致性"""
        char = self.characters.get(char_id)
        if not char:
            return {"valid": False, "error": "Character not found"}

        issues = []
        warnings = []

        # 检查性格与行为一致性
        if char.personality.extraversion < 30:
            # 内向角色不应该有过多社交行为
            social_rels = char.relationships.get_by_type(RelationshipType.FRIENDSHIP)
            if len(social_rels) > 5:
                warnings.append("内向角色有过多友谊关系")

        # 检查动机与目标一致性
        if char.motivation.type == MotivationType.SURVIVAL:
            if "自我实现" in char.motivation.surface_goal:
                issues.append("生存动机与自我实现目标不一致")

        # 检查背景与能力一致性
        if "贫困" in char.background.social_class:
            if "精英教育" in char.background.education:
                warnings.append("社会阶层与教育背景可能不一致")

        # 检查成长弧线连贯性
        if char.growth.progress > 0.5 and char.growth.current_stage == GrowthStage.ORDINARY_WORLD:
            issues.append("成长进度与当前阶段不一致")

        # 检查状态历史连贯性
        if len(char.state_history) > 1:
            for i in range(1, len(char.state_history)):
                prev = char.state_history[i-1]
                curr = char.state_history[i]

                # 检查物理状态突变
                if prev.physical_condition == "injured" and curr.physical_condition == "normal":
                    if "治疗" not in curr.scene_id and "医院" not in curr.location:
                        warnings.append(f"场景 {curr.scene_id}: 受伤状态突然恢复")

        # 检查五维度完整性
        dimension_warnings = []
        if not char.dynamic_emotion:
            dimension_warnings.append("缺少动态情感设置")
        if not char.competence:
            dimension_warnings.append("缺少能力展示设置")
        if not char.eccentricity:
            dimension_warnings.append("缺少古怪特质设置")
        if not char.environment_contrast:
            dimension_warnings.append("缺少环境对比设置")
        if not char.dual_personality:
            dimension_warnings.append("缺少双重人格设置")

        if dimension_warnings:
            warnings.extend(dimension_warnings)

        return {
            "valid": len(issues) == 0,
            "character": char.name,
            "issues": issues,
            "warnings": warnings,
            "score": max(0, 100 - len(issues) * 20 - len(warnings) * 5),
        }

    def validate_all(self) -> Dict[str, Any]:
        """验证所有角色一致性"""
        results = {}
        total_score = 0

        for char_id in self.characters:
            result = self.validate_consistency(char_id)
            results[char_id] = result
            total_score += result.get("score", 0)

        avg_score = total_score / len(self.characters) if self.characters else 0

        return {
            "total_characters": len(self.characters),
            "average_score": round(avg_score, 1),
            "results": results,
        }

    # ========================================
    # GraphManager Integration
    # ========================================

    def _sync_to_graph(self, char: Character) -> None:
        """同步角色到 GraphManager"""
        if not self.graph_manager:
            return

        try:
            from docs.contracts.graph_contracts import Entity, EntityType

            # 创建或更新实体
            entity = Entity(
                id=char.id,
                name=char.name,
                type=EntityType.CHARACTER,
                properties={
                    "role": char.role,
                    "personality_type": char.personality.type.value,
                    "motivation_type": char.motivation.type.value,
                    "growth_stage": char.growth.current_stage.value,
                    "five_dimension_score": char.get_five_dimension_score().overall_score,
                },
            )

            # 检查是否存在
            existing = self.graph_manager.get_entity(char.id)
            if existing:
                self.graph_manager.update_entity(entity)
            else:
                self.graph_manager.create_entity(entity)

            logger.debug(f"Synced character {char.name} to GraphManager")

        except Exception as e:
            logger.warning(f"Failed to sync to GraphManager: {e}")

    def _sync_relationship_to_graph(
        self,
        source_id: str,
        target_id: str,
        rel_type: RelationshipType,
        trust_level: int,
    ) -> None:
        """同步关系到 GraphManager"""
        if not self.graph_manager:
            return

        try:
            from docs.contracts.graph_contracts import Relationship as GraphRelationship, RelationType

            # 映射关系类型
            type_mapping = {
                RelationshipType.FAMILY: RelationType.RELATED_TO,
                RelationshipType.ROMANTIC: RelationType.RELATED_TO,
                RelationshipType.FRIENDSHIP: RelationType.RELATED_TO,
                RelationshipType.RIVALRY: RelationType.RELATED_TO,
                RelationshipType.MENTOR: RelationType.RELATED_TO,
                RelationshipType.PROTEGE: RelationType.RELATED_TO,
                RelationshipType.ALLY: RelationType.RELATED_TO,
                RelationshipType.ENEMY: RelationType.RELATED_TO,
                RelationshipType.ACQUAINTANCE: RelationType.RELATED_TO,
            }

            graph_rel = GraphRelationship(
                id=str(uuid.uuid4()),
                source_id=source_id,
                target_id=target_id,
                type=type_mapping.get(rel_type, RelationType.RELATED_TO),
                properties={
                    "relationship_type": rel_type.value,
                    "trust_level": trust_level,
                },
                weight=trust_level / 100.0,
            )

            self.graph_manager.create_relationship(graph_rel)
            logger.debug(f"Synced relationship to GraphManager: {source_id} -> {target_id}")

        except Exception as e:
            logger.warning(f"Failed to sync relationship to GraphManager: {e}")

    def get_character_subgraph(self, char_id: str, radius: int = 2) -> Optional[Dict[str, Any]]:
        """获取角色子图 (通过 GraphManager)"""
        if not self.graph_manager:
            return None

        try:
            subgraph = self.graph_manager.get_subgraph(char_id, radius)
            return {
                "center": char_id,
                "entities": [{"id": e.id, "name": e.name, "type": e.type.value} for e in subgraph.entities],
                "relationships": [{"source": r.source_id, "target": r.target_id, "type": r.type.value} for r in subgraph.relationships],
            }
        except Exception as e:
            logger.warning(f"Failed to get subgraph: {e}")
            return None

    def find_related_characters(self, char_id: str, max_depth: int = 2) -> List[Character]:
        """查找相关角色 (通过 GraphManager)"""
        if not self.graph_manager:
            # Fallback: 使用本地关系
            char = self.characters.get(char_id)
            if not char:
                return []
            return [
                self.characters[rel.target_id]
                for rel in char.relationships.connections
                if rel.target_id in self.characters
            ]

        try:
            related_entities = self.graph_manager.find_related_entities(char_id, max_depth)
            return [
                self.characters[e.id]
                for e in related_entities
                if e.id in self.characters
            ]
        except Exception as e:
            logger.warning(f"Failed to find related characters: {e}")
            return []

    # ========================================
    # LLM-Assisted Methods
    # ========================================

    async def analyze_character(self, char_id: str, content: str) -> Dict[str, Any]:
        """使用LLM分析角色在内容中的表现"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        if not self.llm:
            return self._mock_analysis(char)

        prompt = CHARACTER_ANALYSIS_PROMPT.format(
            character_info=json.dumps(char.to_dict(), ensure_ascii=False, indent=2),
            content=content
        )

        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    async def suggest_development(self, char_id: str) -> Dict[str, Any]:
        """建议角色发展方向"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        if not self.llm:
            return self._mock_development_suggestions(char)

        prompt = CHARACTER_DEVELOPMENT_PROMPT.format(
            character_info=json.dumps(char.to_dict(), ensure_ascii=False, indent=2)
        )

        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    async def analyze_five_dimensions(self, char_id: str, content: str) -> Dict[str, Any]:
        """使用LLM分析五维度表现"""
        char = self.characters.get(char_id)
        if not char:
            return {"error": "Character not found"}

        if not self.llm:
            return self._mock_five_dimensions_analysis(char)

        prompt = FIVE_DIMENSIONS_PROMPT.format(
            character_info=json.dumps(char.to_dict(), ensure_ascii=False, indent=2),
            content=content
        )

        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    # ========================================
    # Default & Mock Methods
    # ========================================

    def _default_personality(self) -> Personality:
        return Personality(
            type=PersonalityType.ANALYST,
            core_traits=["理性", "内省"],
            strengths=["分析能力"],
            weaknesses=["情感表达"],
            quirks=[],
            speech_patterns=[],
            values=["真理"],
        )

    def _default_background(self) -> Background:
        return Background(
            birth_place="未知",
            family_structure="普通家庭",
            social_class="中产",
            education="普通教育",
            occupation="未知",
        )

    def _default_motivation(self) -> Motivation:
        return Motivation(
            type=MotivationType.SELF_ACTUALIZATION,
            surface_goal="待定",
            deep_need="待定",
            inner_fear="待定",
            want="待定",
            need="待定",
            lie="待定",
            ghost="待定",
        )

    def _default_growth(self) -> GrowthArc:
        return GrowthArc(
            arc_type="positive",
            starting_state="待定",
            ending_state="待定",
            catalyst="待定",
        )

    def _mock_analysis(self, char: Character) -> Dict[str, Any]:
        return {
            "character": char.name,
            "consistency_score": 75,
            "personality_expression": "基本一致",
            "motivation_clarity": "中等",
            "growth_visible": False,
            "suggestions": ["增加内心独白", "强化性格特质表现"],
        }

    def _mock_development_suggestions(self, char: Character) -> Dict[str, Any]:
        return {
            "character": char.name,
            "current_stage": char.growth.current_stage.value,
            "next_stage": GrowthStage.CROSSING_THRESHOLD.value,
            "suggested_events": [
                "面临重大选择",
                "发现隐藏真相",
                "与导师相遇",
            ],
            "relationship_opportunities": [
                "加深与盟友的信任",
                "与对手产生冲突",
            ],
            "internal_growth": [
                "质疑原有信念",
                "发现新的价值观",
            ],
        }

    def _mock_five_dimensions_analysis(self, char: Character) -> Dict[str, Any]:
        return {
            "character": char.name,
            "dimensions": {
                "dynamic": {"score": 60, "evidence": ["情感有变化"], "suggestions": ["增加情感转折点"]},
                "competence": {"score": 70, "evidence": ["展示了技能"], "suggestions": ["添加更多展示场景"]},
                "eccentricity": {"score": 50, "evidence": [], "suggestions": ["赋予独特怪癖"]},
                "contrast": {"score": 55, "evidence": ["有环境不适应"], "suggestions": ["增强环境对比"]},
                "duality": {"score": 40, "evidence": [], "suggestions": ["设计双重人格"]},
            },
            "overall": 55,
            "depth_level": "MODERATE",
        }

    # ========================================
    # Export & Import
    # ========================================

    def export_all(self) -> Dict[str, Any]:
        """导出所有角色数据"""
        return {
            "characters": {
                char_id: char.to_dict()
                for char_id, char in self.characters.items()
            },
            "relationship_network": self.get_relationship_network(),
            "exported_at": datetime.now().isoformat(),
        }

    def import_character(self, data: Dict[str, Any]) -> Optional[Character]:
        """
        从数据导入角色

        从 JSON/dict 恢复完整的 Character 对象，与 export_all/to_dict 对称。

        Args:
            data: 角色数据字典 (来自 Character.to_dict() 或 export_all)

        Returns:
            恢复的 Character 对象，失败返回 None
        """
        try:
            # 必需字段验证
            if "id" not in data or "name" not in data:
                logger.error("import_character: 缺少必需字段 id 或 name")
                return None

            char_id = data["id"]
            name = data["name"]

            # 反序列化 Personality
            personality = self._deserialize_personality(data.get("personality", {}))

            # 反序列化 Background
            background = self._deserialize_background(data.get("background", {}))

            # 反序列化 Motivation
            motivation = self._deserialize_motivation(data.get("motivation", {}))

            # 反序列化 Relationships
            relationships = self._deserialize_relationships(data.get("relationships", {}))

            # 反序列化 GrowthArc
            growth = self._deserialize_growth(data.get("growth", {}))

            # 创建角色
            character = Character(
                id=char_id,
                name=name,
                role=data.get("role", "supporting"),
                personality=personality,
                background=background,
                motivation=motivation,
                relationships=relationships,
                growth=growth,
            )

            # 反序列化可选的五维度数据
            if "dynamic_emotion" in data and data["dynamic_emotion"]:
                character.dynamic_emotion = self._deserialize_dynamic_emotion(data["dynamic_emotion"])

            if "competence" in data and data["competence"]:
                character.competence = self._deserialize_competence(data["competence"])

            if "eccentricity" in data and data["eccentricity"]:
                character.eccentricity = self._deserialize_eccentricity(data["eccentricity"])

            if "environment_contrast" in data and data["environment_contrast"]:
                character.environment_contrast = self._deserialize_environment_contrast(data["environment_contrast"])

            if "dual_personality" in data and data["dual_personality"]:
                character.dual_personality = self._deserialize_dual_personality(data["dual_personality"])

            if "dialogue_style" in data and data["dialogue_style"]:
                character.dialogue_style = self._deserialize_dialogue_style(data["dialogue_style"])

            # 反序列化时间戳
            if "created_at" in data:
                character.created_at = datetime.fromisoformat(data["created_at"])
            if "updated_at" in data:
                character.updated_at = datetime.fromisoformat(data["updated_at"])

            # 注册到管理器
            self.characters[char_id] = character
            self.name_index[name] = char_id

            # 同步到 GraphManager
            if self.graph_manager:
                self._sync_to_graph(character)

            logger.info(f"Imported character: {name} (id={char_id})")
            return character

        except Exception as e:
            logger.error(f"import_character failed: {e}")
            return None

    # ========================================
    # 反序列化辅助方法
    # ========================================

    def _deserialize_personality(self, data: Dict[str, Any]) -> Personality:
        """反序列化 Personality"""
        if not data:
            return self._default_personality()

        # 解析 PersonalityType
        type_value = data.get("type", "analyst")
        try:
            personality_type = PersonalityType(type_value)
        except ValueError:
            personality_type = PersonalityType.ANALYST

        # 解析大五人格评分
        big_five = data.get("big_five", {})

        return Personality(
            type=personality_type,
            core_traits=data.get("core_traits", []),
            strengths=data.get("strengths", []),
            weaknesses=data.get("weaknesses", []),
            quirks=data.get("quirks", []),
            speech_patterns=data.get("speech_patterns", []),
            values=data.get("values", []),
            openness=big_five.get("openness", 50),
            conscientiousness=big_five.get("conscientiousness", 50),
            extraversion=big_five.get("extraversion", 50),
            agreeableness=big_five.get("agreeableness", 50),
            neuroticism=big_five.get("neuroticism", 50),
        )

    def _deserialize_background(self, data: Dict[str, Any]) -> Background:
        """反序列化 Background"""
        if not data:
            return self._default_background()

        # 解析 KeyEvent 列表
        def parse_key_events(events_data: List[Dict], include_residue: bool = False) -> List[KeyEvent]:
            events = []
            for e in events_data:
                events.append(KeyEvent(
                    age=e.get("age"),
                    description=e.get("description", ""),
                    impact=e.get("impact", ""),
                    emotional_residue=e.get("emotional_residue", "") if include_residue else "",
                ))
            return events

        return Background(
            birth_place=data.get("birth_place", "未知"),
            family_structure=data.get("family_structure", "普通家庭"),
            social_class=data.get("social_class", "中产"),
            education=data.get("education", "普通教育"),
            occupation=data.get("occupation", "未知"),
            childhood_events=parse_key_events(data.get("childhood_events", [])),
            formative_events=parse_key_events(data.get("formative_events", [])),
            trauma=parse_key_events(data.get("trauma", []), include_residue=True),
            gifts=data.get("gifts", []),
            secrets=data.get("secrets", []),
        )

    def _deserialize_motivation(self, data: Dict[str, Any]) -> Motivation:
        """反序列化 Motivation"""
        if not data:
            return self._default_motivation()

        # 解析 MotivationType
        type_value = data.get("type", "self_actualization")
        try:
            motivation_type = MotivationType(type_value)
        except ValueError:
            motivation_type = MotivationType.SELF_ACTUALIZATION

        return Motivation(
            type=motivation_type,
            surface_goal=data.get("surface_goal", "待定"),
            deep_need=data.get("deep_need", "待定"),
            inner_fear=data.get("inner_fear", "待定"),
            want=data.get("want", "待定"),
            need=data.get("need", "待定"),
            lie=data.get("lie", "待定"),
            ghost=data.get("ghost", "待定"),
            stakes=data.get("stakes", []),
        )

    def _deserialize_relationships(self, data: Dict[str, Any]) -> Relationships:
        """反序列化 Relationships"""
        relationships = Relationships(
            social_role=data.get("social_role", ""),
            group_affiliations=data.get("group_affiliations", []),
        )

        # 解析每个关系
        for conn_data in data.get("connections", []):
            # 解析 RelationshipType
            type_value = conn_data.get("type", "acquaintance")
            try:
                rel_type = RelationshipType(type_value)
            except ValueError:
                rel_type = RelationshipType.ACQUAINTANCE

            rel = Relationship(
                target_id=conn_data.get("target_id", ""),
                target_name=conn_data.get("target_name", ""),
                type=rel_type,
                trust_level=conn_data.get("trust_level", 50),
                power_balance=conn_data.get("power_balance", 50),
                emotional_bond=conn_data.get("emotional_bond", 50),
                conflict_potential=conn_data.get("conflict_potential", 50),
                history=conn_data.get("history", ""),
                current_status=conn_data.get("current_status", ""),
                tension_points=conn_data.get("tension_points", []),
            )
            relationships.add_relationship(rel)

        return relationships

    def _deserialize_growth(self, data: Dict[str, Any]) -> GrowthArc:
        """反序列化 GrowthArc"""
        if not data:
            return self._default_growth()

        # 解析 GrowthStage
        stage_value = data.get("current_stage", "ordinary_world")
        try:
            current_stage = GrowthStage(stage_value)
        except ValueError:
            current_stage = GrowthStage.ORDINARY_WORLD

        return GrowthArc(
            arc_type=data.get("arc_type", "positive"),
            starting_state=data.get("starting_state", "待定"),
            ending_state=data.get("ending_state", "待定"),
            catalyst=data.get("catalyst", "待定"),
            turning_points=data.get("turning_points", []),
            current_stage=current_stage,
            progress=data.get("progress", 0.0),
            belief_change=data.get("belief_change", ""),
            skill_growth=data.get("skill_growth", []),
            relationship_evolution=data.get("relationship_evolution", []),
        )

    def _deserialize_dynamic_emotion(self, data: Dict[str, Any]) -> DynamicEmotion:
        """反序列化 DynamicEmotion (维度1)"""
        return DynamicEmotion(
            static_emotion=data.get("static_emotion", ""),
            dynamic_emotion=data.get("dynamic_emotion", ""),
            intensity=data.get("intensity", 50),
            evolution=data.get("evolution", []),
        )

    def _deserialize_competence(self, data: Dict[str, Any]) -> Competence:
        """反序列化 Competence (维度2)"""
        return Competence(
            primary_skill=data.get("primary_skill", ""),
            skill_level=data.get("skill_level", 75),
            specializations=data.get("specializations", []),
            demonstrations=data.get("demonstrations", []),
            limitations=data.get("limitations", []),
        )

    def _deserialize_eccentricity(self, data: Dict[str, Any]) -> Eccentricity:
        """反序列化 Eccentricity (维度3)"""
        return Eccentricity(
            quirks=data.get("quirks", []),
            obsessions=data.get("obsessions", []),
            unusual_habits=data.get("unusual_habits", []),
            unique_worldview=data.get("unique_worldview", ""),
            catchphrases=data.get("catchphrases", []),
            eccentricity_level=data.get("eccentricity_level", 50),
        )

    def _deserialize_environment_contrast(self, data: Dict[str, Any]) -> EnvironmentContrast:
        """反序列化 EnvironmentContrast (维度4)"""
        return EnvironmentContrast(
            comfort_zone=data.get("comfort_zone", ""),
            current_environment=data.get("current_environment", ""),
            contrast_level=data.get("contrast_level", "medium"),
            friction_points=data.get("friction_points", []),
            growth_opportunities=data.get("growth_opportunities", []),
            contrast_score=data.get("contrast_score", 50),
        )

    def _deserialize_dual_personality(self, data: Dict[str, Any]) -> DualPersonality:
        """反序列化 DualPersonality (维度5)"""
        # 解析 Persona
        primary_data = data.get("primary_persona", {})
        shadow_data = data.get("shadow_persona", {})

        primary_persona = Persona(
            name=primary_data.get("name", ""),
            traits=primary_data.get("traits", []),
            trigger_conditions=primary_data.get("trigger_conditions", []),
            behavior_patterns=primary_data.get("behavior_patterns", []),
        )

        shadow_persona = Persona(
            name=shadow_data.get("name", ""),
            traits=shadow_data.get("traits", []),
            trigger_conditions=shadow_data.get("trigger_conditions", []),
            behavior_patterns=shadow_data.get("behavior_patterns", []),
        )

        return DualPersonality(
            primary_persona=primary_persona,
            shadow_persona=shadow_persona,
            internal_conflict=data.get("internal_conflict", ""),
            switch_triggers=data.get("switch_triggers", []),
            conflict_scenarios=data.get("conflict_scenarios", []),
            duality_score=data.get("duality_score", 50),
        )

    def _deserialize_dialogue_style(self, data: Dict[str, Any]) -> DialogueStyle:
        """反序列化 DialogueStyle"""
        return DialogueStyle(
            vocabulary_level=data.get("vocabulary_level", "medium"),
            sentence_length=data.get("sentence_length", "medium"),
            formality=data.get("formality", "neutral"),
            favorite_words=data.get("favorite_words", []),
            avoided_words=data.get("avoided_words", []),
            speech_patterns=data.get("speech_patterns", []),
            verbal_tics=data.get("verbal_tics", []),
            emotional_expression=data.get("emotional_expression", "moderate"),
            # 注意: dialogue_samples 不在 to_dict 中导出 (只导出 sample_count)
            # 如需恢复，需单独处理
        )


# ============================================================
# LLM Prompts
# ============================================================

CHARACTER_ANALYSIS_PROMPT = """
## 角色表现分析

分析角色在以下内容中的表现是否与其设定一致。

**角色设定**:
```json
{character_info}
```

**内容**:
{content}

请输出JSON格式:
```json
{{
    "consistency_score": 0-100,
    "personality_expression": "性格表现评价",
    "motivation_clarity": "动机清晰度评价",
    "growth_visible": true/false,
    "inconsistencies": ["不一致之处..."],
    "suggestions": ["改进建议..."]
}}
```
"""

CHARACTER_DEVELOPMENT_PROMPT = """
## 角色发展建议

基于角色当前状态，建议下一步发展方向。

**角色设定**:
```json
{character_info}
```

请输出JSON格式:
```json
{{
    "current_assessment": "当前状态评估",
    "next_stage": "建议的下一成长阶段",
    "suggested_events": ["建议的事件..."],
    "relationship_opportunities": ["关系发展机会..."],
    "internal_growth": ["内在成长方向..."],
    "conflict_opportunities": ["冲突机会..."]
}}
```
"""

FIVE_DIMENSIONS_PROMPT = """
## 五维度角色深度分析

基于弗雷《让劲爆小说飞起来》的五维度模型分析角色表现:
1. Dynamic (动态情感) - 情感是否有演变？
2. Competence (能力展示) - 是否展现专业能力？
3. Eccentricity (古怪特质) - 是否有令人难忘的怪癖？
4. Contrast (环境对比) - 是否处于不适应的环境？
5. Duality (双重人格) - 是否有内心冲突？

**角色设定**:
```json
{character_info}
```

**内容**:
{content}

请输出JSON格式:
```json
{{
    "dimensions": {{
        "dynamic": {{"score": 0-100, "evidence": ["证据..."], "suggestions": ["建议..."]}},
        "competence": {{"score": 0-100, "evidence": ["证据..."], "suggestions": ["建议..."]}},
        "eccentricity": {{"score": 0-100, "evidence": ["证据..."], "suggestions": ["建议..."]}},
        "contrast": {{"score": 0-100, "evidence": ["证据..."], "suggestions": ["建议..."]}},
        "duality": {{"score": 0-100, "evidence": ["证据..."], "suggestions": ["建议..."]}}
    }},
    "overall": 0-100,
    "depth_level": "FLAT/MODERATE/DEEP/UNFORGETTABLE"
}}
```
"""
