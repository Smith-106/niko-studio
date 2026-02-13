# -*- coding: utf-8 -*-
"""
场景矛盾检测系统 (Scene Coherence System)

核心功能:
1. 时间线矛盾检测 - 时序错乱、时间跳跃不合理
2. 地点矛盾检测 - 空间传送、地理错误
3. 状态矛盾检测 - 物品/角色状态不一致
4. 跨场景一致性验证 - 全局连贯性检查

检测维度:
- Timeline: 时间顺序、持续时间、并发事件
- Location: 地点转换、距离合理性、环境一致性
- State: 角色状态、物品状态、环境状态
- Causality: 因果关系、事件连锁
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set, Tuple
from enum import Enum
from datetime import datetime, timedelta
import json

logger = logging.getLogger("niko-scene-coherence")


# ============================================================
# Enums
# ============================================================

class ContradictionType(Enum):
    """矛盾类型"""
    TIMELINE = "timeline"            # 时间线矛盾
    LOCATION = "location"            # 地点矛盾
    CHARACTER_STATE = "char_state"   # 角色状态矛盾
    OBJECT_STATE = "obj_state"       # 物品状态矛盾
    ENVIRONMENT = "environment"      # 环境矛盾
    CAUSALITY = "causality"          # 因果矛盾
    KNOWLEDGE = "knowledge"          # 知识矛盾 (角色不应知道的信息)
    PHYSICS = "physics"              # 物理矛盾


class Severity(Enum):
    """严重程度"""
    CRITICAL = "critical"    # 严重 - 破坏故事逻辑
    MAJOR = "major"          # 主要 - 明显的不一致
    MINOR = "minor"          # 次要 - 轻微的不一致
    INFO = "info"            # 信息 - 潜在问题


class TimeUnit(Enum):
    """时间单位"""
    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


# ============================================================
# Data Classes
# ============================================================

@dataclass
class TimeMarker:
    """时间标记"""
    scene_id: str
    timestamp: Optional[datetime] = None     # 绝对时间
    relative_time: Optional[str] = None      # 相对时间描述
    time_of_day: Optional[str] = None        # 时段: morning/afternoon/evening/night
    duration: Optional[timedelta] = None     # 场景持续时间
    order: int = 0                           # 场景顺序

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scene_id": self.scene_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "relative_time": self.relative_time,
            "time_of_day": self.time_of_day,
            "duration": str(self.duration) if self.duration else None,
            "order": self.order,
        }


@dataclass
class LocationMarker:
    """地点标记"""
    scene_id: str
    location_name: str
    location_type: str = ""          # indoor/outdoor/vehicle/etc
    parent_location: str = ""        # 上级地点 (城市 -> 建筑 -> 房间)
    coordinates: Optional[Tuple[float, float]] = None  # 经纬度
    travel_time_from_prev: Optional[timedelta] = None  # 从上一地点的旅行时间

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scene_id": self.scene_id,
            "location_name": self.location_name,
            "location_type": self.location_type,
            "parent_location": self.parent_location,
            "coordinates": self.coordinates,
            "travel_time": str(self.travel_time_from_prev) if self.travel_time_from_prev else None,
        }


@dataclass
class StateSnapshot:
    """状态快照"""
    scene_id: str
    entity_id: str                   # 角色或物品ID
    entity_type: str                 # character/object/environment
    entity_name: str
    properties: Dict[str, Any] = field(default_factory=dict)  # 属性键值对
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scene_id": self.scene_id,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "entity_name": self.entity_name,
            "properties": self.properties,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class Contradiction:
    """矛盾记录"""
    id: str
    type: ContradictionType
    severity: Severity
    description: str

    # 涉及的场景
    scene_a: str
    scene_b: str

    # 详细信息
    entity_involved: str = ""        # 涉及的实体
    expected_value: str = ""         # 期望值
    actual_value: str = ""           # 实际值

    # 上下文
    context_a: str = ""              # 场景A的相关内容
    context_b: str = ""              # 场景B的相关内容

    # 建议
    suggestion: str = ""

    detected_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "severity": self.severity.value,
            "description": self.description,
            "scene_a": self.scene_a,
            "scene_b": self.scene_b,
            "entity_involved": self.entity_involved,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "context_a": self.context_a,
            "context_b": self.context_b,
            "suggestion": self.suggestion,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class Scene:
    """场景"""
    id: str
    title: str
    content: str
    order: int                       # 在故事中的顺序

    # 时空标记
    time_marker: Optional[TimeMarker] = None
    location_marker: Optional[LocationMarker] = None

    # 状态快照
    state_snapshots: List[StateSnapshot] = field(default_factory=list)

    # 涉及的实体
    characters: List[str] = field(default_factory=list)
    objects: List[str] = field(default_factory=list)

    # 事件
    events: List[str] = field(default_factory=list)

    # 元数据
    chapter: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "order": self.order,
            "time_marker": self.time_marker.to_dict() if self.time_marker else None,
            "location_marker": self.location_marker.to_dict() if self.location_marker else None,
            "characters": self.characters,
            "objects": self.objects,
            "events": self.events,
            "chapter": self.chapter,
        }


@dataclass
class CoherenceReport:
    """连贯性检测报告"""
    total_scenes: int
    total_contradictions: int
    critical_count: int
    major_count: int
    minor_count: int
    info_count: int

    contradictions: List[Contradiction]
    timeline_issues: List[Contradiction]
    location_issues: List[Contradiction]
    state_issues: List[Contradiction]

    coherence_score: float           # 0-100
    summary: str

    generated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_scenes": self.total_scenes,
            "total_contradictions": self.total_contradictions,
            "by_severity": {
                "critical": self.critical_count,
                "major": self.major_count,
                "minor": self.minor_count,
                "info": self.info_count,
            },
            "coherence_score": self.coherence_score,
            "summary": self.summary,
            "contradictions": [c.to_dict() for c in self.contradictions],
            "generated_at": self.generated_at.isoformat(),
        }


# ============================================================
# Scene Coherence Detector
# ============================================================

class SceneCoherenceDetector:
    """
    场景矛盾检测器

    功能:
    1. 时间线验证
    2. 地点连贯性验证
    3. 状态一致性验证
    4. 跨场景综合检测
    """

    def __init__(self, llm=None):
        self.llm = llm
        self.scenes: Dict[str, Scene] = {}
        self.state_registry: Dict[str, List[StateSnapshot]] = {}  # entity_id -> snapshots
        self.contradictions: List[Contradiction] = []
        self._contradiction_counter = 0

        # 时间关键词
        self.time_keywords = {
            "morning": ["早上", "早晨", "清晨", "上午", "dawn", "morning"],
            "afternoon": ["下午", "午后", "afternoon"],
            "evening": ["傍晚", "黄昏", "evening", "dusk"],
            "night": ["夜晚", "深夜", "晚上", "night", "midnight"],
        }

        # 地点关系图 (用于验证旅行合理性)
        self.location_graph: Dict[str, Dict[str, timedelta]] = {}

        logger.info("SceneCoherenceDetector initialized")

    # ========================================
    # Scene Management
    # ========================================

    def add_scene(self, scene: Scene) -> None:
        """添加场景"""
        self.scenes[scene.id] = scene
        logger.info(f"Added scene: {scene.id}")

    def create_scene(
        self,
        scene_id: str,
        title: str,
        content: str,
        order: int,
        time_info: Dict[str, Any] = None,
        location_info: Dict[str, Any] = None,
        characters: List[str] = None,
        objects: List[str] = None,
    ) -> Scene:
        """创建并添加场景"""
        scene = Scene(
            id=scene_id,
            title=title,
            content=content,
            order=order,
            characters=characters or [],
            objects=objects or [],
        )

        if time_info:
            scene.time_marker = TimeMarker(
                scene_id=scene_id,
                relative_time=time_info.get("relative_time"),
                time_of_day=time_info.get("time_of_day"),
                order=order,
            )

        if location_info:
            scene.location_marker = LocationMarker(
                scene_id=scene_id,
                location_name=location_info.get("name", ""),
                location_type=location_info.get("type", ""),
                parent_location=location_info.get("parent", ""),
            )

        self.add_scene(scene)
        return scene

    def get_scene(self, scene_id: str) -> Optional[Scene]:
        """获取场景"""
        return self.scenes.get(scene_id)

    def get_ordered_scenes(self) -> List[Scene]:
        """获取按顺序排列的场景列表"""
        return sorted(self.scenes.values(), key=lambda s: s.order)

    # ========================================
    # State Tracking
    # ========================================

    def record_state(
        self,
        scene_id: str,
        entity_id: str,
        entity_type: str,
        entity_name: str,
        properties: Dict[str, Any],
    ) -> StateSnapshot:
        """记录实体状态"""
        snapshot = StateSnapshot(
            scene_id=scene_id,
            entity_id=entity_id,
            entity_type=entity_type,
            entity_name=entity_name,
            properties=properties,
        )

        if entity_id not in self.state_registry:
            self.state_registry[entity_id] = []
        self.state_registry[entity_id].append(snapshot)

        # 同时添加到场景
        scene = self.scenes.get(scene_id)
        if scene:
            scene.state_snapshots.append(snapshot)

        return snapshot

    def get_entity_states(self, entity_id: str) -> List[StateSnapshot]:
        """获取实体的所有状态快照"""
        return self.state_registry.get(entity_id, [])

    # ========================================
    # Location Graph
    # ========================================

    def set_travel_time(
        self,
        location_a: str,
        location_b: str,
        travel_time: timedelta,
        bidirectional: bool = True,
    ) -> None:
        """设置地点间的旅行时间"""
        if location_a not in self.location_graph:
            self.location_graph[location_a] = {}
        self.location_graph[location_a][location_b] = travel_time

        if bidirectional:
            if location_b not in self.location_graph:
                self.location_graph[location_b] = {}
            self.location_graph[location_b][location_a] = travel_time

    def get_travel_time(self, location_a: str, location_b: str) -> Optional[timedelta]:
        """获取地点间的旅行时间"""
        if location_a in self.location_graph:
            return self.location_graph[location_a].get(location_b)
        return None

    # ========================================
    # Contradiction Detection
    # ========================================

    def _generate_contradiction_id(self) -> str:
        """生成矛盾ID"""
        self._contradiction_counter += 1
        return f"CTD-{self._contradiction_counter:04d}"

    def detect_all(self) -> CoherenceReport:
        """执行全面检测"""
        self.contradictions = []

        # 1. 时间线检测
        timeline_issues = self._detect_timeline_contradictions()

        # 2. 地点检测
        location_issues = self._detect_location_contradictions()

        # 3. 状态检测
        state_issues = self._detect_state_contradictions()

        # 4. 因果检测
        causality_issues = self._detect_causality_contradictions()

        # 合并所有问题
        all_issues = timeline_issues + location_issues + state_issues + causality_issues
        self.contradictions = all_issues

        # 统计
        critical = sum(1 for c in all_issues if c.severity == Severity.CRITICAL)
        major = sum(1 for c in all_issues if c.severity == Severity.MAJOR)
        minor = sum(1 for c in all_issues if c.severity == Severity.MINOR)
        info = sum(1 for c in all_issues if c.severity == Severity.INFO)

        # 计算分数
        score = self._calculate_coherence_score(critical, major, minor, info)

        # 生成摘要
        summary = self._generate_summary(all_issues, score)

        return CoherenceReport(
            total_scenes=len(self.scenes),
            total_contradictions=len(all_issues),
            critical_count=critical,
            major_count=major,
            minor_count=minor,
            info_count=info,
            contradictions=all_issues,
            timeline_issues=timeline_issues,
            location_issues=location_issues,
            state_issues=state_issues,
            coherence_score=score,
            summary=summary,
        )

    def _detect_timeline_contradictions(self) -> List[Contradiction]:
        """检测时间线矛盾"""
        issues = []
        ordered_scenes = self.get_ordered_scenes()

        for i in range(1, len(ordered_scenes)):
            prev_scene = ordered_scenes[i - 1]
            curr_scene = ordered_scenes[i]

            # 检查时间标记
            if prev_scene.time_marker and curr_scene.time_marker:
                prev_time = prev_scene.time_marker
                curr_time = curr_scene.time_marker

                # 检查时段矛盾
                if prev_time.time_of_day and curr_time.time_of_day:
                    if not self._is_valid_time_progression(
                        prev_time.time_of_day, curr_time.time_of_day
                    ):
                        issues.append(Contradiction(
                            id=self._generate_contradiction_id(),
                            type=ContradictionType.TIMELINE,
                            severity=Severity.MAJOR,
                            description=f"时段跳跃不合理: {prev_time.time_of_day} -> {curr_time.time_of_day}",
                            scene_a=prev_scene.id,
                            scene_b=curr_scene.id,
                            expected_value=f"合理的时间过渡",
                            actual_value=f"{prev_time.time_of_day} -> {curr_time.time_of_day}",
                            suggestion="检查时间流逝是否合理，或添加过渡场景",
                        ))

            # 检查内容中的时间表达
            time_contradiction = self._check_content_time_contradiction(
                prev_scene, curr_scene
            )
            if time_contradiction:
                issues.append(time_contradiction)

        return issues

    def _detect_location_contradictions(self) -> List[Contradiction]:
        """检测地点矛盾"""
        issues = []
        ordered_scenes = self.get_ordered_scenes()

        for i in range(1, len(ordered_scenes)):
            prev_scene = ordered_scenes[i - 1]
            curr_scene = ordered_scenes[i]

            if prev_scene.location_marker and curr_scene.location_marker:
                prev_loc = prev_scene.location_marker.location_name
                curr_loc = curr_scene.location_marker.location_name

                # 检查是否是相同场景但地点不同
                if prev_loc != curr_loc:
                    # 检查是否有足够的旅行时间
                    travel_time = self.get_travel_time(prev_loc, curr_loc)

                    if travel_time:
                        # 检查场景间隔是否足够
                        if prev_scene.time_marker and curr_scene.time_marker:
                            if prev_scene.time_marker.duration:
                                if prev_scene.time_marker.duration < travel_time:
                                    issues.append(Contradiction(
                                        id=self._generate_contradiction_id(),
                                        type=ContradictionType.LOCATION,
                                        severity=Severity.CRITICAL,
                                        description=f"地点传送: 从{prev_loc}到{curr_loc}需要{travel_time}，但场景间隔不足",
                                        scene_a=prev_scene.id,
                                        scene_b=curr_scene.id,
                                        expected_value=f"至少{travel_time}的间隔",
                                        actual_value=f"{prev_scene.time_marker.duration}",
                                        suggestion="增加过渡场景或调整时间线",
                                    ))

        return issues

    def _detect_state_contradictions(self) -> List[Contradiction]:
        """检测状态矛盾"""
        issues = []

        for entity_id, snapshots in self.state_registry.items():
            if len(snapshots) < 2:
                continue

            # 按场景顺序排序
            sorted_snapshots = sorted(
                snapshots,
                key=lambda s: self.scenes.get(s.scene_id, Scene("", "", "", 999)).order
            )

            for i in range(1, len(sorted_snapshots)):
                prev = sorted_snapshots[i - 1]
                curr = sorted_snapshots[i]

                # 检查属性变化是否合理
                state_issue = self._check_state_transition(prev, curr)
                if state_issue:
                    issues.append(state_issue)

        return issues

    def _detect_causality_contradictions(self) -> List[Contradiction]:
        """
        检测因果矛盾

        采用混合策略：
        1. 关键词预筛选 - 提取因果关系对
        2. 规则检测 - 检测时间顺序矛盾
        3. LLM验证 - 可选的深度验证
        """
        issues = []
        ordered_scenes = self.get_ordered_scenes()

        if len(ordered_scenes) < 2:
            return issues

        # 因果关键词模式
        cause_keywords = [
            r"因为", r"由于", r"既然", r"鉴于", r"正因为",
            r"之所以", r"缘于", r"源于", r"归因于",
            r"because", r"since", r"as", r"due to",
        ]
        effect_keywords = [
            r"所以", r"因此", r"于是", r"导致", r"致使",
            r"结果", r"从而", r"以至于", r"故而", r"遂",
            r"therefore", r"thus", r"hence", r"so",
        ]

        # 状态冲突模式: (先决条件状态, 后续不可能的动作)
        state_conflict_patterns = [
            (r"死亡|死去|去世|身亡|丧命|毙命", r"说道|说|做|行动|走|跑|站|坐"),
            (r"离开|离去|走了|走开", r"在场|出现|站在|坐在"),
            (r"失去|丢失|弄丢|遗失", r"使用|拿着|握着|持有|挥舞"),
            (r"昏迷|晕倒|失去意识", r"说|看|听|走|站"),
            (r"锁上|锁住|封闭", r"打开|进入|走进"),
            (r"摧毁|毁坏|破坏|砸碎", r"使用|拿起|完好"),
        ]

        # 1. 提取场景中的因果关系对
        causal_relations = []
        for scene in ordered_scenes:
            relations = self._extract_causal_relations(
                scene.content, cause_keywords, effect_keywords
            )
            for cause, effect in relations:
                causal_relations.append((scene.id, scene.order, cause, effect))

        # 2. 检测状态冲突矛盾
        for i, scene_a in enumerate(ordered_scenes):
            for j, scene_b in enumerate(ordered_scenes):
                if j <= i:
                    continue

                for precondition_pattern, impossible_action_pattern in state_conflict_patterns:
                    # 检查 scene_a 是否包含先决条件
                    precondition_match = re.search(precondition_pattern, scene_a.content)
                    if not precondition_match:
                        continue

                    # 提取涉及的实体 (简单启发式: 前后文的名词)
                    entity = self._extract_entity_near_match(
                        scene_a.content, precondition_match.start()
                    )

                    if not entity:
                        continue

                    # 检查 scene_b 中该实体是否执行了不可能的动作
                    if entity in scene_b.content:
                        entity_context = self._get_entity_context(scene_b.content, entity)
                        action_match = re.search(impossible_action_pattern, entity_context)

                        if action_match:
                            issues.append(Contradiction(
                                id=self._generate_contradiction_id(),
                                type=ContradictionType.CAUSALITY,
                                severity=Severity.CRITICAL,
                                description=f"因果矛盾: {entity}在场景{scene_a.order}中\"{precondition_match.group()}\"，"
                                           f"但在场景{scene_b.order}中\"{action_match.group()}\"",
                                scene_a=scene_a.id,
                                scene_b=scene_b.id,
                                entity_involved=entity,
                                expected_value=f"不应出现: {action_match.group()}",
                                actual_value=f"出现了: {action_match.group()}",
                                context_a=self._get_context_around(scene_a.content, precondition_match.start()),
                                context_b=self._get_context_around(scene_b.content, action_match.start()),
                                suggestion=f"检查{entity}的状态变化是否合理，或添加状态恢复的情节",
                            ))

        # 3. 检测事件因果顺序矛盾
        event_issues = self._detect_event_order_contradictions(ordered_scenes)
        issues.extend(event_issues)

        # 4. 如果有 LLM，进行深度验证
        if self.llm and issues:
            # 异步验证在外部调用
            pass

        return issues

    def _extract_causal_relations(
        self, content: str, cause_keywords: List[str], effect_keywords: List[str]
    ) -> List[Tuple[str, str]]:
        """提取因果关系对"""
        relations = []

        # 构建组合模式
        cause_pattern = "|".join(cause_keywords)
        effect_pattern = "|".join(effect_keywords)

        # 模式1: 因为X，所以Y
        pattern1 = rf"({cause_pattern})(.{{5,50}})({effect_pattern})(.{{5,50}})"
        matches = re.finditer(pattern1, content, re.DOTALL)
        for match in matches:
            cause_text = match.group(2).strip()
            effect_text = match.group(4).strip()
            if cause_text and effect_text:
                relations.append((cause_text, effect_text))

        # 模式2: Y，是因为X (倒装)
        pattern2 = rf"(.{{5,50}})({effect_pattern}).{{0,5}}({cause_pattern})(.{{5,50}})"
        matches = re.finditer(pattern2, content, re.DOTALL)
        for match in matches:
            effect_text = match.group(1).strip()
            cause_text = match.group(4).strip()
            if cause_text and effect_text:
                relations.append((cause_text, effect_text))

        return relations

    def _extract_entity_near_match(self, content: str, match_pos: int) -> Optional[str]:
        """提取匹配位置附近的实体名称"""
        # 提取前后文
        start = max(0, match_pos - 20)
        end = min(len(content), match_pos + 20)
        context = content[start:end]

        # 简单的中文人名/实体模式 (2-4个汉字的名词)
        name_patterns = [
            r"[\u4e00-\u9fa5]{2,4}(?=死|离|失|昏|走|跑)",  # 动作前的名词
            r"(?:他|她|它)们?",  # 代词
            r"[\u4e00-\u9fa5]{2,4}(?:先生|女士|老师|医生|经理)",  # 称谓
        ]

        for pattern in name_patterns:
            match = re.search(pattern, context)
            if match:
                return match.group()

        return None

    def _get_entity_context(self, content: str, entity: str, window: int = 50) -> str:
        """获取实体周围的上下文"""
        pos = content.find(entity)
        if pos == -1:
            return ""

        start = max(0, pos - window)
        end = min(len(content), pos + len(entity) + window)
        return content[start:end]

    def _get_context_around(self, content: str, pos: int, window: int = 30) -> str:
        """获取位置周围的上下文"""
        start = max(0, pos - window)
        end = min(len(content), pos + window)
        return content[start:end]

    def _detect_event_order_contradictions(
        self, ordered_scenes: List[Scene]
    ) -> List[Contradiction]:
        """检测事件顺序矛盾"""
        issues = []

        # 构建事件索引
        event_first_occurrence: Dict[str, Tuple[str, int]] = {}  # event -> (scene_id, order)

        # 事件依赖关系 (B必须在A之后)
        event_dependencies = [
            (r"出生|诞生", r"死亡|去世"),
            (r"结婚|成婚", r"离婚"),
            (r"购买|买下", r"卖出|售出"),
            (r"开始|启动", r"结束|完成"),
            (r"到达|抵达", r"离开|出发"),
        ]

        for scene in ordered_scenes:
            for event in scene.events:
                if event not in event_first_occurrence:
                    event_first_occurrence[event] = (scene.id, scene.order)

            # 检查内容中的事件顺序
            for prereq_pattern, dependent_pattern in event_dependencies:
                prereq_match = re.search(prereq_pattern, scene.content)
                dependent_match = re.search(dependent_pattern, scene.content)

                if prereq_match and dependent_match:
                    # 检查在同一场景中的位置顺序
                    if dependent_match.start() < prereq_match.start():
                        issues.append(Contradiction(
                            id=self._generate_contradiction_id(),
                            type=ContradictionType.CAUSALITY,
                            severity=Severity.MAJOR,
                            description=f"事件顺序矛盾: \"{dependent_match.group()}\"出现在\"{prereq_match.group()}\"之前",
                            scene_a=scene.id,
                            scene_b=scene.id,
                            expected_value=f"先{prereq_match.group()}，后{dependent_match.group()}",
                            actual_value=f"顺序相反",
                            suggestion="调整事件描述的顺序，或检查叙事结构",
                        ))

        return issues

    def _mock_causality_analysis(self, scenes: List[Scene]) -> List[Dict[str, Any]]:
        """模拟因果分析结果 (LLM-free 降级模式)"""
        return [
            {
                "type": "causality",
                "severity": "major",
                "description": "检测到潜在的因果矛盾",
                "suggestion": "建议使用 LLM 进行深度分析",
            }
        ]

    # ========================================
    # Helper Methods
    # ========================================

    def _is_valid_time_progression(self, prev: str, curr: str) -> bool:
        """检查时间进展是否合理"""
        time_order = ["morning", "afternoon", "evening", "night"]

        # 归一化时间段
        prev_normalized = self._normalize_time_of_day(prev)
        curr_normalized = self._normalize_time_of_day(curr)

        if not prev_normalized or not curr_normalized:
            return True  # 无法判断时认为有效

        prev_idx = time_order.index(prev_normalized) if prev_normalized in time_order else -1
        curr_idx = time_order.index(curr_normalized) if curr_normalized in time_order else -1

        if prev_idx == -1 or curr_idx == -1:
            return True

        # 允许正向进展或跨天
        return curr_idx >= prev_idx or (prev_normalized == "night" and curr_normalized == "morning")

    def _normalize_time_of_day(self, time_str: str) -> Optional[str]:
        """归一化时间段表达"""
        time_str = time_str.lower()
        for period, keywords in self.time_keywords.items():
            if any(kw in time_str for kw in keywords):
                return period
        return None

    def _check_content_time_contradiction(
        self, prev_scene: Scene, curr_scene: Scene
    ) -> Optional[Contradiction]:
        """
        检查内容中的时间矛盾

        检测维度:
        1. 具体时间点矛盾 (如 3点 -> 2点)
        2. 时段矛盾 (如 晚上 -> 早上，无跨天说明)
        3. 相对时间矛盾 (如 昨天 vs 场景时间戳)
        """
        # 提取时间表达
        prev_times = self._extract_time_expressions(prev_scene.content)
        curr_times = self._extract_time_expressions(curr_scene.content)

        if not prev_times or not curr_times:
            return None

        # 1. 检测具体时间点矛盾
        prev_hour = self._parse_hour_from_expressions(prev_times)
        curr_hour = self._parse_hour_from_expressions(curr_times)

        if prev_hour is not None and curr_hour is not None:
            # 检查时间是否倒流 (同一天内)
            if curr_hour < prev_hour:
                # 检查是否有跨天指示
                has_day_change = self._has_day_change_indicator(
                    prev_scene.content, curr_scene.content
                )
                if not has_day_change:
                    return Contradiction(
                        id=self._generate_contradiction_id(),
                        type=ContradictionType.TIMELINE,
                        severity=Severity.MAJOR,
                        description=f"时间倒流: 从{prev_hour}点到{curr_hour}点，无跨天说明",
                        scene_a=prev_scene.id,
                        scene_b=curr_scene.id,
                        expected_value=f"时间应向前推进或有跨天说明",
                        actual_value=f"{prev_hour}点 -> {curr_hour}点",
                        suggestion="添加跨天说明（如'第二天'）或调整时间",
                    )

        # 2. 检测时段矛盾
        prev_period = self._extract_time_period(prev_scene.content)
        curr_period = self._extract_time_period(curr_scene.content)

        if prev_period and curr_period:
            period_order = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
            prev_idx = period_order.get(prev_period, -1)
            curr_idx = period_order.get(curr_period, -1)

            if prev_idx != -1 and curr_idx != -1:
                # 检查时段倒退
                if curr_idx < prev_idx:
                    has_day_change = self._has_day_change_indicator(
                        prev_scene.content, curr_scene.content
                    )
                    if not has_day_change:
                        return Contradiction(
                            id=self._generate_contradiction_id(),
                            type=ContradictionType.TIMELINE,
                            severity=Severity.MINOR,
                            description=f"时段矛盾: 从{prev_period}到{curr_period}，无跨天说明",
                            scene_a=prev_scene.id,
                            scene_b=curr_scene.id,
                            expected_value=f"时段应向前推进",
                            actual_value=f"{prev_period} -> {curr_period}",
                            suggestion="添加跨天说明或调整时段描述",
                        )

        # 3. 检测相对时间与场景时间戳的矛盾
        relative_time_issue = self._check_relative_time_consistency(
            prev_scene, curr_scene, prev_times, curr_times
        )
        if relative_time_issue:
            return relative_time_issue

        return None

    def _parse_hour_from_expressions(self, time_expressions: List[str]) -> Optional[int]:
        """从时间表达式中解析小时"""
        for expr in time_expressions:
            # 匹配 "3点"、"15时"、"15:30" 等
            hour_match = re.search(r'(\d{1,2})[点时:]', expr)
            if hour_match:
                hour = int(hour_match.group(1))
                # 处理下午时间 (如 "下午3点" 应为 15)
                if "下午" in expr or "晚" in expr:
                    if hour < 12:
                        hour += 12
                return hour
        return None

    def _extract_time_period(self, content: str) -> Optional[str]:
        """提取时段"""
        period_patterns = {
            "morning": [r"早上", r"早晨", r"清晨", r"上午", r"凌晨"],
            "afternoon": [r"下午", r"午后", r"中午"],
            "evening": [r"傍晚", r"黄昏", r"日落"],
            "night": [r"夜晚", r"深夜", r"晚上", r"夜里", r"半夜"],
        }

        for period, patterns in period_patterns.items():
            for pattern in patterns:
                if re.search(pattern, content):
                    return period
        return None

    def _has_day_change_indicator(self, prev_content: str, curr_content: str) -> bool:
        """检查是否有跨天指示"""
        day_change_patterns = [
            r"第二天", r"次日", r"翌日", r"隔天",
            r"几天后", r"一周后", r"数日后",
            r"过了.*天", r".*天之?后",
            r"next day", r"the following day",
        ]

        combined = prev_content + curr_content
        for pattern in day_change_patterns:
            if re.search(pattern, combined):
                return True
        return False

    def _check_relative_time_consistency(
        self,
        prev_scene: Scene,
        curr_scene: Scene,
        prev_times: List[str],
        curr_times: List[str],
    ) -> Optional[Contradiction]:
        """检查相对时间与场景时间戳的一致性"""
        # 检测 "昨天"、"前天" 等相对时间表达
        relative_patterns = {
            "昨天": -1, "前天": -2, "大前天": -3,
            "今天": 0, "明天": 1, "后天": 2,
        }

        for expr in curr_times:
            for pattern, day_offset in relative_patterns.items():
                if pattern in expr:
                    # 如果有场景时间戳，检查一致性
                    if prev_scene.time_marker and prev_scene.time_marker.timestamp:
                        if curr_scene.time_marker and curr_scene.time_marker.timestamp:
                            actual_diff = (
                                curr_scene.time_marker.timestamp -
                                prev_scene.time_marker.timestamp
                            ).days

                            # 如果说"昨天"但场景间隔不对
                            if pattern == "昨天" and actual_diff != 1:
                                return Contradiction(
                                    id=self._generate_contradiction_id(),
                                    type=ContradictionType.TIMELINE,
                                    severity=Severity.MINOR,
                                    description=f"相对时间矛盾: 使用'{pattern}'但场景间隔为{actual_diff}天",
                                    scene_a=prev_scene.id,
                                    scene_b=curr_scene.id,
                                    expected_value=f"场景间隔应为1天",
                                    actual_value=f"实际间隔{actual_diff}天",
                                    suggestion="调整相对时间表达或场景时间戳",
                                )
        return None

    def _mock_time_contradiction_analysis(
        self, prev_scene: Scene, curr_scene: Scene
    ) -> Optional[Dict[str, Any]]:
        """模拟时间矛盾分析 (LLM-free 降级模式)"""
        return {
            "has_contradiction": False,
            "description": "基于规则的时间矛盾检测完成",
            "suggestion": "如需深度分析，请启用 LLM",
        }

    def _extract_time_expressions(self, content: str) -> List[str]:
        """提取时间表达"""
        patterns = [
            r'\d{1,2}[点时]',                    # 3点, 下午5时
            r'\d{1,2}:\d{2}',                    # 15:30
            r'[早中午下晚][上午后晚]?',           # 早上, 下午
            r'[昨今明后]天',                      # 昨天, 今天
            r'\d+[天周月年][前后]',               # 3天前, 一周后
        ]

        times = []
        for pattern in patterns:
            matches = re.findall(pattern, content)
            times.extend(matches)

        return times

    def _check_state_transition(
        self, prev: StateSnapshot, curr: StateSnapshot
    ) -> Optional[Contradiction]:
        """检查状态转换是否合理"""
        # 获取场景
        prev_scene = self.scenes.get(prev.scene_id)
        curr_scene = self.scenes.get(curr.scene_id)

        if not prev_scene or not curr_scene:
            return None

        # 检查物理状态
        if prev.entity_type == "character":
            # 检查伤亡状态
            if prev.properties.get("status") == "dead":
                if curr.properties.get("status") != "dead":
                    return Contradiction(
                        id=self._generate_contradiction_id(),
                        type=ContradictionType.CHARACTER_STATE,
                        severity=Severity.CRITICAL,
                        description=f"角色{prev.entity_name}已死亡但在后续场景中存活",
                        scene_a=prev.scene_id,
                        scene_b=curr.scene_id,
                        entity_involved=prev.entity_name,
                        expected_value="dead",
                        actual_value=curr.properties.get("status", "unknown"),
                        suggestion="检查角色死亡逻辑或添加复活剧情",
                    )

            # 检查位置一致性
            if prev.properties.get("location") and curr.properties.get("location"):
                prev_loc = prev.properties["location"]
                curr_loc = curr.properties["location"]

                # 检查是否存在不可能的传送
                if prev_loc != curr_loc:
                    # 检查场景间是否有足够时间旅行
                    pass  # 在 _detect_location_contradictions 中已处理

        elif prev.entity_type == "object":
            # 检查物品状态
            if prev.properties.get("destroyed") == True:
                if curr.properties.get("exists", True) == True:
                    return Contradiction(
                        id=self._generate_contradiction_id(),
                        type=ContradictionType.OBJECT_STATE,
                        severity=Severity.MAJOR,
                        description=f"物品{prev.entity_name}已损毁但在后续场景中完好",
                        scene_a=prev.scene_id,
                        scene_b=curr.scene_id,
                        entity_involved=prev.entity_name,
                        expected_value="destroyed",
                        actual_value="exists",
                        suggestion="检查物品状态或添加修复情节",
                    )

            # 检查所有权转移
            prev_owner = prev.properties.get("owner")
            curr_owner = curr.properties.get("owner")
            if prev_owner and curr_owner and prev_owner != curr_owner:
                transfer_found = self._has_ownership_transfer_event_between(prev_scene, curr_scene)
                if not transfer_found:
                    return Contradiction(
                        id=self._generate_contradiction_id(),
                        type=ContradictionType.OBJECT_STATE,
                        severity=Severity.MAJOR,
                        description=f"物品{prev.entity_name}所有权从{prev_owner}变为{curr_owner}，但无转移场景",
                        scene_a=prev.scene_id,
                        scene_b=curr.scene_id,
                        entity_involved=prev.entity_name,
                        expected_value="所有权转移事件",
                        actual_value="无转移记录",
                        suggestion="添加物品转移的场景或事件",
                    )

        return None

    def _has_ownership_transfer_event_between(self, prev_scene: Scene, curr_scene: Scene) -> bool:
        """检查两个场景之间是否存在所有权转移事件。"""
        transfer_keywords = ["转交", "交给", "给"]

        intermediate_scenes = [
            s for s in self.get_ordered_scenes()
            if prev_scene.order < s.order < curr_scene.order
        ]

        for scene in intermediate_scenes:
            for event in scene.events:
                if any(keyword in event for keyword in transfer_keywords):
                    return True

        return False

    def _calculate_coherence_score(
        self, critical: int, major: int, minor: int, info: int
    ) -> float:
        """计算连贯性分数"""
        if len(self.scenes) == 0:
            return 100.0

        # 权重: critical=20, major=10, minor=3, info=1
        penalty = critical * 20 + major * 10 + minor * 3 + info * 1

        # 基于场景数量调整
        max_penalty = len(self.scenes) * 15  # 假设平均每场景最多15分惩罚

        score = max(0, 100 - (penalty / max_penalty) * 100)
        return round(score, 1)

    def _generate_summary(self, issues: List[Contradiction], score: float) -> str:
        """生成摘要"""
        if not issues:
            return "未检测到矛盾，场景连贯性良好。"

        critical = sum(1 for c in issues if c.severity == Severity.CRITICAL)
        major = sum(1 for c in issues if c.severity == Severity.MAJOR)

        if critical > 0:
            return f"检测到{critical}个严重矛盾，需要立即修复。连贯性评分: {score}分。"
        elif major > 0:
            return f"检测到{major}个主要矛盾，建议修复。连贯性评分: {score}分。"
        else:
            return f"检测到{len(issues)}个轻微问题，可选修复。连贯性评分: {score}分。"

    # ========================================
    # Cross-Scene Validation
    # ========================================

    def validate_character_presence(self, character_id: str) -> List[Contradiction]:
        """验证角色在各场景的存在合理性"""
        issues = []
        states = self.get_entity_states(character_id)

        if not states:
            return issues

        # 按场景顺序排序
        sorted_states = sorted(
            states,
            key=lambda s: self.scenes.get(s.scene_id, Scene("", "", "", 999)).order
        )

        for i in range(1, len(sorted_states)):
            prev = sorted_states[i - 1]
            curr = sorted_states[i]

            prev_scene = self.scenes.get(prev.scene_id)
            curr_scene = self.scenes.get(curr.scene_id)

            if not prev_scene or not curr_scene:
                continue

            # 检查角色是否能从上一场景到达当前场景
            if prev_scene.location_marker and curr_scene.location_marker:
                prev_loc = prev_scene.location_marker.location_name
                curr_loc = curr_scene.location_marker.location_name

                if prev_loc != curr_loc:
                    # 检查中间场景
                    intermediate_scenes = [
                        s for s in self.get_ordered_scenes()
                        if prev_scene.order < s.order < curr_scene.order
                    ]

                    # 检查角色是否在中间场景出现
                    char_in_intermediate = any(
                        character_id in s.characters for s in intermediate_scenes
                    )

                    if not char_in_intermediate and len(intermediate_scenes) > 2:
                        issues.append(Contradiction(
                            id=self._generate_contradiction_id(),
                            type=ContradictionType.CHARACTER_STATE,
                            severity=Severity.MINOR,
                            description=f"角色{prev.entity_name}在多个场景中缺失后突然出现",
                            scene_a=prev.scene_id,
                            scene_b=curr.scene_id,
                            entity_involved=prev.entity_name,
                            suggestion="考虑添加角色在中间场景的存在或解释其行踪",
                        ))

        return issues

    def validate_object_tracking(self, object_id: str) -> List[Contradiction]:
        """验证物品追踪"""
        issues = []
        states = self.get_entity_states(object_id)

        if not states:
            return issues

        # 按场景顺序排序
        sorted_states = sorted(
            states,
            key=lambda s: self.scenes.get(s.scene_id, Scene("", "", "", 999)).order
        )

        for i in range(1, len(sorted_states)):
            prev = sorted_states[i - 1]
            curr = sorted_states[i]

            # 检查所有权变化
            prev_owner = prev.properties.get("owner")
            curr_owner = curr.properties.get("owner")

            if prev_owner and curr_owner and prev_owner != curr_owner:
                # 检查是否有转移场景
                prev_scene = self.scenes.get(prev.scene_id)
                curr_scene = self.scenes.get(curr.scene_id)

                if prev_scene and curr_scene:
                    # 检查中间场景是否有转移事件
                    intermediate_scenes = [
                        s for s in self.get_ordered_scenes()
                        if prev_scene.order < s.order < curr_scene.order
                    ]

                    transfer_found = False
                    for s in intermediate_scenes:
                        for event in s.events:
                            if "转交" in event or "给" in event or "交给" in event:
                                transfer_found = True
                                break

                    if not transfer_found:
                        issues.append(Contradiction(
                            id=self._generate_contradiction_id(),
                            type=ContradictionType.OBJECT_STATE,
                            severity=Severity.MAJOR,
                            description=f"物品{prev.entity_name}所有权从{prev_owner}变为{curr_owner}，但无转移场景",
                            scene_a=prev.scene_id,
                            scene_b=curr.scene_id,
                            entity_involved=prev.entity_name,
                            expected_value=f"所有权转移事件",
                            actual_value=f"无转移记录",
                            suggestion="添加物品转移的场景或事件",
                        ))

        return issues

    # ========================================
    # LLM-Assisted Detection
    # ========================================

    async def deep_analysis(self, scene_ids: List[str] = None) -> Dict[str, Any]:
        """使用LLM进行深度分析"""
        if not self.llm:
            return self._mock_deep_analysis()

        scenes_to_analyze = [
            self.scenes[sid] for sid in (scene_ids or self.scenes.keys())
            if sid in self.scenes
        ]

        if not scenes_to_analyze:
            return {"error": "No scenes to analyze"}

        # 构建分析提示
        scenes_content = "\n\n---\n\n".join([
            f"场景{s.order}: {s.title}\n{s.content[:1000]}"
            for s in sorted(scenes_to_analyze, key=lambda x: x.order)
        ])

        prompt = COHERENCE_ANALYSIS_PROMPT.format(scenes=scenes_content)

        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    def _mock_deep_analysis(self) -> Dict[str, Any]:
        """模拟深度分析结果"""
        return {
            "contradictions_found": 2,
            "timeline_issues": ["场景3和场景5之间的时间跨度不明确"],
            "location_issues": ["角色从A城到B城的旅行时间未交代"],
            "state_issues": ["物品X在场景4后消失，场景7重新出现但未解释"],
            "suggestions": [
                "在场景4后添加过渡场景",
                "明确时间线的推进",
                "交代角色的行踪",
            ],
        }

    # ========================================
    # Export & Import
    # ========================================

    def export_data(self) -> Dict[str, Any]:
        """导出数据"""
        return {
            "scenes": {sid: s.to_dict() for sid, s in self.scenes.items()},
            "state_registry": {
                eid: [s.to_dict() for s in snapshots]
                for eid, snapshots in self.state_registry.items()
            },
            "contradictions": [c.to_dict() for c in self.contradictions],
            "location_graph": {
                loc_a: {loc_b: str(time) for loc_b, time in neighbors.items()}
                for loc_a, neighbors in self.location_graph.items()
            },
            "exported_at": datetime.now().isoformat(),
        }


# ============================================================
# LLM Prompts
# ============================================================

COHERENCE_ANALYSIS_PROMPT = """
## 场景连贯性深度分析

请仔细分析以下场景序列，检测任何可能的矛盾或不一致。

**场景内容**:
{scenes}

请检查以下维度:
1. 时间线 - 时间顺序是否合理？是否有时间跳跃未解释？
2. 地点 - 地点转换是否合理？角色能否在时间内到达？
3. 角色状态 - 角色的物理/情绪状态是否一致？
4. 物品状态 - 物品是否突然出现/消失？
5. 因果关系 - 事件的因果是否合理？

请输出JSON格式:
```json
{{
    "contradictions": [
        {{
            "type": "timeline/location/character/object/causality",
            "severity": "critical/major/minor",
            "scenes_involved": ["场景ID"],
            "description": "矛盾描述",
            "suggestion": "修复建议"
        }}
    ],
    "overall_coherence": "评价",
    "suggestions": ["改进建议..."]
}}
```
"""
