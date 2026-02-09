# -*- coding: utf-8 -*-
"""
冲突元素分析器

从文本中提取冲突元素：
- 内在冲突 (Internal) - 角色内心的矛盾
- 外在冲突 (External) - 角色与外部力量的对抗
- 人际冲突 (Interpersonal) - 角色之间的冲突
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum

from .base import BaseAnalyzer, AnalysisResult, AnalysisType


class ConflictType(Enum):
    """冲突类型"""
    INTERNAL = "internal"           # 内在冲突
    EXTERNAL = "external"           # 外在冲突
    INTERPERSONAL = "interpersonal" # 人际冲突


class ConflictIntensity(Enum):
    """冲突强度"""
    LOW = "low"           # 低强度
    MEDIUM = "medium"     # 中等强度
    HIGH = "high"         # 高强度
    CRITICAL = "critical" # 极高强度


# 冲突指示词
CONFLICT_INDICATORS = {
    ConflictType.INTERNAL: [
        # 内心挣扎
        "犹豫", "踌躇", "彷徨", "迷茫", "困惑", "纠结",
        "矛盾", "挣扎", "煎熬", "痛苦", "两难", "抉择",
        # 内心独白
        "我该", "我应该", "如果我", "但是我", "可是我",
        "一方面", "另一方面", "心想", "暗想", "自问",
        # 情感冲突
        "爱恨", "喜忧", "悲喜", "又想", "却又",
    ],
    ConflictType.EXTERNAL: [
        # 对抗性词汇
        "对抗", "抵抗", "反抗", "战斗", "斗争", "抗争",
        "威胁", "危机", "险境", "困境", "绝境", "死亡",
        # 环境压力
        "压力", "阻碍", "障碍", "困难", "挑战", "考验",
        "风暴", "灾难", "战争", "敌人", "命运",
    ],
    ConflictType.INTERPERSONAL: [
        # 人际对抗
        "争吵", "争论", "争执", "吵架", "冲突", "对峙",
        "敌对", "仇恨", "背叛", "欺骗", "谎言", "误解",
        # 关系紧张
        "怀疑", "猜忌", "嫉妒", "愤怒", "指责", "质问",
        "分歧", "决裂", "反目", "翻脸", "对立",
    ],
}

# 强度指示词
INTENSITY_INDICATORS = {
    ConflictIntensity.CRITICAL: ["绝望", "崩溃", "毁灭", "死亡", "致命", "生死"],
    ConflictIntensity.HIGH: ["激烈", "剧烈", "强烈", "爆发", "冲突", "对抗"],
    ConflictIntensity.MEDIUM: ["紧张", "不安", "焦虑", "担忧", "困扰", "烦恼"],
    ConflictIntensity.LOW: ["轻微", "略微", "有些", "稍微", "微小", "隐约"],
}


@dataclass
class Conflict:
    """冲突元素"""
    type: ConflictType                    # 冲突类型
    content: str                          # 原文内容
    parties: List[str] = field(default_factory=list)  # 冲突方
    intensity: ConflictIntensity = ConflictIntensity.MEDIUM  # 强度
    indicators: List[str] = field(default_factory=list)  # 指示词
    position: Optional[int] = None        # 在文本中的位置
    description: str = ""                 # 冲突描述

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "type": self.type.value,
            "content": self.content,
            "parties": self.parties,
            "intensity": self.intensity.value,
            "indicators": self.indicators,
            "position": self.position,
            "description": self.description,
        }


class ConflictAnalyzer(BaseAnalyzer):
    """冲突元素分析器"""

    @property
    def name(self) -> str:
        return "ConflictAnalyzer"

    @property
    def analysis_type(self) -> AnalysisType:
        return AnalysisType.CONFLICT

    @property
    def description(self) -> str:
        return "分析文本中的冲突元素（内在、外在、人际冲突）"

    async def analyze(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[Conflict]:
        """
        分析冲突元素

        Args:
            content: 待分析的文本
            context: 上下文信息

        Returns:
            AnalysisResult: 包含冲突列表的分析结果
        """
        if self.llm_client:
            return await self._analyze_with_llm(content, context)

        return self.quick_analyze(content)

    async def _analyze_with_llm(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[Conflict]:
        """使用 LLM 进行深度分析"""
        # 构建分析提示词
        system_prompt = """你是一位专业的叙事分析专家，擅长识别文本中的冲突元素。
请分析文本中的冲突，识别以下类型：
- internal: 内在冲突（角色内心的矛盾）
- external: 外在冲突（角色与外部力量的对抗）
- interpersonal: 人际冲突（角色之间的冲突）

返回 JSON 格式，包含 conflicts 数组，每个元素包含：
- type: 冲突类型 (internal/external/interpersonal)
- content: 冲突相关的原文片段（最多100字）
- parties: 冲突方列表
- intensity: 强度 (low/medium/high/critical)
- description: 冲突描述"""

        prompt = f"分析以下文本中的冲突元素：\n\n{content[:2000]}"

        try:
            result = await self.llm_client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            )

            conflicts: List[Conflict] = []
            llm_conflicts = result.get("conflicts", [])

            for item in llm_conflicts:
                try:
                    conflict_type = ConflictType(item.get("type", "interpersonal"))
                    intensity = ConflictIntensity(item.get("intensity", "medium"))
                    conflicts.append(Conflict(
                        type=conflict_type,
                        content=item.get("content", "")[:200],
                        parties=item.get("parties", []),
                        intensity=intensity,
                        description=item.get("description", ""),
                    ))
                except (ValueError, KeyError):
                    continue

            # 合并规则分析结果
            rule_result = self.quick_analyze(content)
            all_conflicts = conflicts + rule_result.items

            type_counts = {t: 0 for t in ConflictType}
            for c in all_conflicts:
                type_counts[c.type] += 1

            return AnalysisResult(
                analyzer_name=self.name,
                analysis_type=self.analysis_type,
                items=all_conflicts,
                metadata={
                    "total_count": len(all_conflicts),
                    "llm_count": len(conflicts),
                    "rule_count": len(rule_result.items),
                    "type_distribution": {t.value: c for t, c in type_counts.items()},
                },
                summary=f"发现 {len(all_conflicts)} 处冲突元素（LLM: {len(conflicts)}, 规则: {len(rule_result.items)}）"
            )
        except Exception:
            # LLM 失败时降级到规则分析
            return self.quick_analyze(content)

    def quick_analyze(self, content: str) -> AnalysisResult[Conflict]:
        """
        快速分析（基于规则）

        Args:
            content: 待分析的文本

        Returns:
            AnalysisResult: 分析结果
        """
        conflicts: List[Conflict] = []
        type_counts: Dict[ConflictType, int] = {t: 0 for t in ConflictType}

        # 按段落分割
        paragraphs = content.split('\n\n')
        if len(paragraphs) == 1:
            paragraphs = re.split(r'[。！？]', content)

        for idx, para in enumerate(paragraphs):
            if not para.strip():
                continue

            for conflict_type, indicators in CONFLICT_INDICATORS.items():
                found_indicators = []
                for indicator in indicators:
                    if indicator in para:
                        found_indicators.append(indicator)

                if found_indicators:
                    type_counts[conflict_type] += 1
                    intensity = self._detect_intensity(para)

                    conflicts.append(Conflict(
                        type=conflict_type,
                        content=para.strip()[:200],  # 截取前200字
                        indicators=found_indicators,
                        intensity=intensity,
                        position=idx,
                        description=self._generate_description(conflict_type, found_indicators),
                    ))

        # 生成摘要
        total = sum(type_counts.values())
        distribution = ", ".join([
            f"{t.value}: {c}" for t, c in type_counts.items() if c > 0
        ])

        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
            items=conflicts,
            metadata={
                "total_count": total,
                "type_distribution": {t.value: c for t, c in type_counts.items()},
                "intensity_distribution": self._get_intensity_distribution(conflicts),
            },
            summary=f"发现 {total} 处冲突元素。分布: {distribution or '无'}"
        )

    def _detect_intensity(self, text: str) -> ConflictIntensity:
        """检测冲突强度"""
        for intensity, indicators in INTENSITY_INDICATORS.items():
            for indicator in indicators:
                if indicator in text:
                    return intensity
        return ConflictIntensity.MEDIUM

    def _generate_description(
        self,
        conflict_type: ConflictType,
        indicators: List[str]
    ) -> str:
        """生成冲突描述"""
        type_names = {
            ConflictType.INTERNAL: "内在冲突",
            ConflictType.EXTERNAL: "外在冲突",
            ConflictType.INTERPERSONAL: "人际冲突",
        }
        return f"{type_names[conflict_type]}，关键词: {', '.join(indicators[:3])}"

    def _get_intensity_distribution(
        self,
        conflicts: List[Conflict]
    ) -> Dict[str, int]:
        """获取强度分布"""
        distribution = {i.value: 0 for i in ConflictIntensity}
        for conflict in conflicts:
            distribution[conflict.intensity.value] += 1
        return distribution

    def get_dominant_conflict_type(self, content: str) -> Optional[ConflictType]:
        """
        获取主导冲突类型

        Args:
            content: 待分析的文本

        Returns:
            ConflictType: 主导冲突类型，或 None
        """
        result = self.quick_analyze(content)
        type_dist = result.metadata.get("type_distribution", {})

        if not type_dist:
            return None

        max_type = max(type_dist.items(), key=lambda x: x[1])
        if max_type[1] == 0:
            return None

        return ConflictType(max_type[0])
