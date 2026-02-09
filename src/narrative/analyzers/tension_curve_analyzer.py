# -*- coding: utf-8 -*-
"""
张力曲线分析器

分析文本的情节张力变化，识别：
- 张力高点 (Peaks)
- 张力低点 (Valleys)
- 转折点 (Turning Points)
- 整体张力曲线
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum

from .base import BaseAnalyzer, AnalysisResult, AnalysisType


class TensionLevel(Enum):
    """张力水平"""
    VERY_LOW = 1      # 非常低（平静）
    LOW = 2           # 低
    MEDIUM = 3        # 中等
    HIGH = 4          # 高
    VERY_HIGH = 5     # 非常高（高潮）


class PointType(Enum):
    """曲线点类型"""
    NORMAL = "normal"           # 普通点
    PEAK = "peak"               # 高点
    VALLEY = "valley"           # 低点
    TURNING_POINT = "turning"   # 转折点
    CLIMAX = "climax"           # 高潮点


# 张力指示词
TENSION_INDICATORS = {
    TensionLevel.VERY_HIGH: [
        "绝望", "崩溃", "爆发", "冲突", "决战", "生死",
        "高潮", "巅峰", "极限", "临界", "爆炸", "毁灭",
        "惊恐", "震惊", "不敢相信", "天崩地裂",
    ],
    TensionLevel.HIGH: [
        "紧张", "危机", "威胁", "冲突", "对抗", "激烈",
        "焦虑", "恐惧", "害怕", "担忧", "不安", "慌乱",
        "追逐", "逃跑", "战斗", "争吵",
    ],
    TensionLevel.MEDIUM: [
        "疑惑", "困惑", "好奇", "期待", "等待", "观察",
        "思考", "犹豫", "踌躇", "权衡", "考虑",
    ],
    TensionLevel.LOW: [
        "平静", "安宁", "祥和", "轻松", "舒适", "惬意",
        "日常", "普通", "平常", "正常", "如常",
    ],
    TensionLevel.VERY_LOW: [
        "沉睡", "休息", "回忆", "梦境", "宁静", "沉默",
        "静谧", "安详", "悠闲", "闲适", "恬静",
    ],
}

# 转折指示词
TURNING_INDICATORS = [
    "突然", "忽然", "猛然", "骤然", "陡然",
    "但是", "然而", "可是", "却", "不料",
    "转折", "变化", "改变", "发现", "揭示",
    "原来", "竟然", "居然", "没想到",
]


@dataclass
class TensionPoint:
    """张力曲线上的点"""
    position: int                         # 位置（段落/句子索引）
    level: TensionLevel                   # 张力水平
    point_type: PointType = PointType.NORMAL  # 点类型
    content: str = ""                     # 对应内容
    indicators: List[str] = field(default_factory=list)  # 触发词
    score: float = 0.5                    # 归一化分数 0-1

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "position": self.position,
            "level": self.level.value,
            "point_type": self.point_type.value,
            "content": self.content[:100] if self.content else "",
            "indicators": self.indicators,
            "score": self.score,
        }


@dataclass
class TensionCurve:
    """张力曲线"""
    points: List[TensionPoint] = field(default_factory=list)
    peaks: List[int] = field(default_factory=list)      # 高点位置
    valleys: List[int] = field(default_factory=list)    # 低点位置
    turning_points: List[int] = field(default_factory=list)  # 转折点位置
    climax_position: Optional[int] = None               # 高潮位置
    average_tension: float = 0.5                        # 平均张力
    variance: float = 0.0                               # 张力变化幅度

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "point_count": len(self.points),
            "peaks": self.peaks,
            "valleys": self.valleys,
            "turning_points": self.turning_points,
            "climax_position": self.climax_position,
            "average_tension": self.average_tension,
            "variance": self.variance,
            "points": [p.to_dict() for p in self.points],
        }


class TensionCurveAnalyzer(BaseAnalyzer):
    """张力曲线分析器"""

    @property
    def name(self) -> str:
        return "TensionCurveAnalyzer"

    @property
    def analysis_type(self) -> AnalysisType:
        return AnalysisType.TENSION

    @property
    def description(self) -> str:
        return "分析文本的情节张力变化曲线"

    async def analyze(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[TensionCurve]:
        """
        分析张力曲线

        Args:
            content: 待分析的文本
            context: 上下文信息

        Returns:
            AnalysisResult: 包含张力曲线的分析结果
        """
        if self.llm_client:
            return await self._analyze_with_llm(content, context)

        return self.quick_analyze(content)

    async def _analyze_with_llm(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[TensionCurve]:
        """使用 LLM 进行深度分析"""
        system_prompt = """你是一位专业的叙事分析专家，擅长分析文本的情节张力变化。
请分析文本的张力曲线，识别：
- 张力水平 (1-5): 1=非常低, 2=低, 3=中等, 4=高, 5=非常高
- 关键点类型: normal(普通), peak(高点), valley(低点), turning(转折点), climax(高潮)

返回 JSON 格式：
{
  "points": [{"position": 0, "level": 3, "point_type": "normal", "description": "..."}],
  "climax_position": 5,
  "overall_pattern": "rising/falling/oscillating/building/flat",
  "summary": "整体张力分析摘要"
}"""

        prompt = f"分析以下文本的情节张力变化：\n\n{content[:2000]}"

        try:
            result = await self.llm_client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            )

            # 解析 LLM 响应
            llm_points = result.get("points", [])
            points: List[TensionPoint] = []

            for item in llm_points:
                try:
                    level_value = int(item.get("level", 3))
                    level = TensionLevel(level_value)
                    point_type_str = item.get("point_type", "normal")
                    point_type = PointType(point_type_str)

                    points.append(TensionPoint(
                        position=int(item.get("position", len(points))),
                        level=level,
                        point_type=point_type,
                        content=item.get("description", "")[:100],
                        score=level_value / 5.0,
                    ))
                except (ValueError, KeyError):
                    continue

            # 如果 LLM 结果不足，合并规则分析
            if len(points) < 3:
                rule_result = self.quick_analyze(content)
                if rule_result.items:
                    points = rule_result.items[0].points

            # 构建曲线
            curve = self._build_curve(points) if points else TensionCurve()

            # 使用 LLM 提供的高潮位置
            if result.get("climax_position") is not None:
                curve.climax_position = result["climax_position"]

            summary = result.get("summary", self._generate_summary(curve))

            return AnalysisResult(
                analyzer_name=self.name,
                analysis_type=self.analysis_type,
                items=[curve],
                metadata={
                    "point_count": len(curve.points),
                    "peak_count": len(curve.peaks),
                    "valley_count": len(curve.valleys),
                    "turning_point_count": len(curve.turning_points),
                    "overall_pattern": result.get("overall_pattern", "unknown"),
                    "analysis_source": "llm",
                },
                summary=summary
            )
        except Exception:
            # LLM 失败时降级到规则分析
            return self.quick_analyze(content)

    def quick_analyze(self, content: str) -> AnalysisResult[TensionCurve]:
        """
        快速分析（基于规则）

        Args:
            content: 待分析的文本

        Returns:
            AnalysisResult: 分析结果
        """
        # 按段落/句子分割
        segments = self._segment_text(content)

        # 分析每个段落的张力
        points: List[TensionPoint] = []
        for idx, segment in enumerate(segments):
            if not segment.strip():
                continue

            level, indicators = self._detect_tension_level(segment)
            is_turning = self._detect_turning_point(segment)

            point = TensionPoint(
                position=idx,
                level=level,
                point_type=PointType.TURNING_POINT if is_turning else PointType.NORMAL,
                content=segment[:100],
                indicators=indicators,
                score=level.value / 5.0,
            )
            points.append(point)

        # 构建曲线
        curve = self._build_curve(points)

        # 生成摘要
        summary = self._generate_summary(curve)

        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
            items=[curve],
            metadata={
                "segment_count": len(segments),
                "point_count": len(points),
                "peak_count": len(curve.peaks),
                "valley_count": len(curve.valleys),
                "turning_point_count": len(curve.turning_points),
            },
            summary=summary
        )

    def _segment_text(self, content: str) -> List[str]:
        """分割文本"""
        # 优先按段落分割
        paragraphs = content.split('\n\n')
        if len(paragraphs) > 3:
            return [p.strip() for p in paragraphs if p.strip()]

        # 否则按句子分割
        sentences = re.split(r'[。！？]', content)
        return [s.strip() for s in sentences if s.strip()]

    def _detect_tension_level(
        self,
        text: str
    ) -> tuple[TensionLevel, List[str]]:
        """检测张力水平"""
        found_indicators: List[str] = []
        max_level = TensionLevel.MEDIUM

        for level in [TensionLevel.VERY_HIGH, TensionLevel.HIGH,
                      TensionLevel.LOW, TensionLevel.VERY_LOW]:
            for indicator in TENSION_INDICATORS[level]:
                if indicator in text:
                    found_indicators.append(indicator)
                    if level.value > max_level.value:
                        max_level = level
                    elif level.value < max_level.value and max_level == TensionLevel.MEDIUM:
                        max_level = level

        return max_level, found_indicators

    def _detect_turning_point(self, text: str) -> bool:
        """检测是否为转折点"""
        for indicator in TURNING_INDICATORS:
            if indicator in text:
                return True
        return False

    def _build_curve(self, points: List[TensionPoint]) -> TensionCurve:
        """构建张力曲线"""
        if not points:
            return TensionCurve()

        # 识别高点和低点
        peaks = []
        valleys = []
        turning_points = []
        climax_position = None
        max_score = 0

        for i, point in enumerate(points):
            # 检查是否为局部高点
            if i > 0 and i < len(points) - 1:
                if (point.score > points[i-1].score and
                    point.score > points[i+1].score):
                    peaks.append(i)
                    point.point_type = PointType.PEAK

                # 检查是否为局部低点
                if (point.score < points[i-1].score and
                    point.score < points[i+1].score):
                    valleys.append(i)
                    point.point_type = PointType.VALLEY

            # 记录转折点
            if point.point_type == PointType.TURNING_POINT:
                turning_points.append(i)

            # 记录最高点
            if point.score > max_score:
                max_score = point.score
                climax_position = i

        # 标记高潮点
        if climax_position is not None and len(points) > climax_position:
            points[climax_position].point_type = PointType.CLIMAX

        # 计算统计量
        scores = [p.score for p in points]
        avg_tension = sum(scores) / len(scores) if scores else 0.5
        variance = sum((s - avg_tension) ** 2 for s in scores) / len(scores) if scores else 0

        return TensionCurve(
            points=points,
            peaks=peaks,
            valleys=valleys,
            turning_points=turning_points,
            climax_position=climax_position,
            average_tension=round(avg_tension, 3),
            variance=round(variance, 3),
        )

    def _generate_summary(self, curve: TensionCurve) -> str:
        """生成摘要"""
        if not curve.points:
            return "未检测到有效的张力变化"

        parts = [
            f"分析了 {len(curve.points)} 个文本段落",
            f"平均张力 {curve.average_tension:.2f}",
            f"变化幅度 {curve.variance:.2f}",
        ]

        if curve.peaks:
            parts.append(f"{len(curve.peaks)} 个高点")
        if curve.valleys:
            parts.append(f"{len(curve.valleys)} 个低点")
        if curve.turning_points:
            parts.append(f"{len(curve.turning_points)} 个转折")
        if curve.climax_position is not None:
            parts.append(f"高潮在位置 {curve.climax_position}")

        return "。".join(parts) + "。"

    def get_tension_pattern(self, content: str) -> str:
        """
        获取张力模式描述

        Args:
            content: 待分析的文本

        Returns:
            str: 张力模式描述
        """
        result = self.quick_analyze(content)
        if not result.items:
            return "unknown"

        curve = result.items[0]

        # 分析模式
        if curve.variance < 0.1:
            return "flat"  # 平淡
        elif len(curve.peaks) > len(curve.valleys) + 2:
            return "rising"  # 上升
        elif len(curve.valleys) > len(curve.peaks) + 2:
            return "falling"  # 下降
        elif curve.climax_position and curve.climax_position > len(curve.points) * 0.6:
            return "building"  # 蓄势
        else:
            return "oscillating"  # 波动
