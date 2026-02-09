# -*- coding: utf-8 -*-
"""
感官细节分析器

从文本中提取五种感官细节：
- 视觉 (Visual)
- 听觉 (Auditory)
- 嗅觉 (Olfactory)
- 触觉 (Tactile)
- 味觉 (Gustatory)
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum

from .base import BaseAnalyzer, AnalysisResult, AnalysisType


class SensoryType(Enum):
    """感官类型"""
    VISUAL = "visual"           # 视觉
    AUDITORY = "auditory"       # 听觉
    OLFACTORY = "olfactory"     # 嗅觉
    TACTILE = "tactile"         # 触觉
    GUSTATORY = "gustatory"     # 味觉


# 感官词汇表（基于规则的快速检测）
SENSORY_KEYWORDS = {
    SensoryType.VISUAL: [
        # 颜色
        "红", "蓝", "绿", "黄", "白", "黑", "紫", "橙", "灰", "金", "银",
        "明亮", "昏暗", "闪烁", "光芒", "阴影", "色彩", "颜色",
        # 形状与动态
        "看见", "看到", "望向", "注视", "凝视", "目光", "眼前",
        "闪现", "浮现", "映入", "晃动", "飘动", "摇曳",
    ],
    SensoryType.AUDITORY: [
        "听见", "听到", "声音", "响声", "回响", "回荡",
        "嘈杂", "寂静", "沉默", "喧嚣", "轰鸣", "低语", "呢喃",
        "咳嗽", "叹息", "呼吸", "脚步", "敲门", "铃声",
        "尖叫", "怒吼", "哭泣", "笑声", "歌声", "音乐",
    ],
    SensoryType.OLFACTORY: [
        "闻到", "嗅到", "气味", "味道", "香气", "臭味",
        "芳香", "清香", "腥味", "霉味", "焦味", "烟味",
        "花香", "草香", "酒香", "饭香", "血腥味",
    ],
    SensoryType.TACTILE: [
        "触摸", "触碰", "抚摸", "握住", "抓住", "推开",
        "冰冷", "温暖", "炽热", "滚烫", "潮湿", "干燥",
        "光滑", "粗糙", "柔软", "坚硬", "刺痛", "酸痛",
        "颤抖", "战栗", "麻木", "疼痛", "舒适",
    ],
    SensoryType.GUSTATORY: [
        "尝到", "品尝", "咀嚼", "吞咽", "舔舐",
        "甜", "酸", "苦", "辣", "咸", "鲜",
        "美味", "可口", "恶心", "难吃", "入口", "回味",
    ],
}


@dataclass
class SensoryDetail:
    """感官细节"""
    type: SensoryType                    # 感官类型
    content: str                         # 原文内容
    keywords: List[str] = field(default_factory=list)  # 触发关键词
    position: Optional[int] = None       # 在文本中的位置
    intensity: float = 0.5               # 强度 0-1
    context: str = ""                    # 上下文

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "type": self.type.value,
            "content": self.content,
            "keywords": self.keywords,
            "position": self.position,
            "intensity": self.intensity,
            "context": self.context,
        }


class SensoryAnalyzer(BaseAnalyzer):
    """感官细节分析器"""

    @property
    def name(self) -> str:
        return "SensoryAnalyzer"

    @property
    def analysis_type(self) -> AnalysisType:
        return AnalysisType.SENSORY

    @property
    def description(self) -> str:
        return "分析文本中的五感描写（视觉、听觉、嗅觉、触觉、味觉）"

    async def analyze(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[SensoryDetail]:
        """
        分析感官细节

        Args:
            content: 待分析的文本
            context: 上下文信息

        Returns:
            AnalysisResult: 包含感官细节列表的分析结果
        """
        # 如果有 LLM 客户端，使用 AI 辅助分析
        if self.llm_client:
            return await self._analyze_with_llm(content, context)

        # 否则使用基于规则的快速分析
        return self.quick_analyze(content)

    async def _analyze_with_llm(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult[SensoryDetail]:
        """使用 LLM 进行深度分析"""
        system_prompt = """你是一位专业的叙事分析专家，擅长识别文本中的感官描写。
请分析文本中的五感描写：
- visual: 视觉描写
- auditory: 听觉描写
- olfactory: 嗅觉描写
- tactile: 触觉描写
- gustatory: 味觉描写

返回 JSON 格式，包含 sensory_details 数组，每个元素包含：
- type: 感官类型 (visual/auditory/olfactory/tactile/gustatory)
- content: 感官描写的原文片段
- intensity: 强度 0-1 之间的小数
- context: 该描写的叙事作用"""

        prompt = f"分析以下文本中的感官描写：\n\n{content[:2000]}"

        try:
            result = await self.llm_client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            )

            details: List[SensoryDetail] = []
            llm_details = result.get("sensory_details", [])

            for idx, item in enumerate(llm_details):
                try:
                    sensory_type = SensoryType(item.get("type", "visual"))
                    details.append(SensoryDetail(
                        type=sensory_type,
                        content=item.get("content", ""),
                        intensity=float(item.get("intensity", 0.5)),
                        context=item.get("context", ""),
                        position=idx,
                    ))
                except (ValueError, KeyError):
                    continue

            # 合并规则分析结果
            rule_result = self.quick_analyze(content)
            all_details = details + rule_result.items

            type_counts = {t: 0 for t in SensoryType}
            for d in all_details:
                type_counts[d.type] += 1

            return AnalysisResult(
                analyzer_name=self.name,
                analysis_type=self.analysis_type,
                items=all_details,
                metadata={
                    "total_count": len(all_details),
                    "llm_count": len(details),
                    "rule_count": len(rule_result.items),
                    "type_distribution": {t.value: c for t, c in type_counts.items()},
                },
                summary=f"发现 {len(all_details)} 处感官描写（LLM: {len(details)}, 规则: {len(rule_result.items)}）"
            )
        except Exception:
            # LLM 失败时降级到规则分析
            return self.quick_analyze(content)

    def quick_analyze(self, content: str) -> AnalysisResult[SensoryDetail]:
        """
        快速分析（基于规则）

        Args:
            content: 待分析的文本

        Returns:
            AnalysisResult: 分析结果
        """
        details: List[SensoryDetail] = []
        type_counts: Dict[SensoryType, int] = {t: 0 for t in SensoryType}

        # 按句子分割
        sentences = re.split(r'[。！？\n]', content)

        for idx, sentence in enumerate(sentences):
            if not sentence.strip():
                continue

            for sensory_type, keywords in SENSORY_KEYWORDS.items():
                found_keywords = []
                for keyword in keywords:
                    if keyword in sentence:
                        found_keywords.append(keyword)

                if found_keywords:
                    type_counts[sensory_type] += 1
                    details.append(SensoryDetail(
                        type=sensory_type,
                        content=sentence.strip(),
                        keywords=found_keywords,
                        position=idx,
                        intensity=min(1.0, len(found_keywords) * 0.3),
                    ))

        # 生成摘要
        total = sum(type_counts.values())
        distribution = ", ".join([
            f"{t.value}: {c}" for t, c in type_counts.items() if c > 0
        ])

        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
            items=details,
            metadata={
                "total_count": total,
                "type_distribution": {t.value: c for t, c in type_counts.items()},
                "sentence_count": len(sentences),
                "density": total / max(1, len(sentences)),
            },
            summary=f"发现 {total} 处感官描写。分布: {distribution or '无'}"
        )

    def extract_by_type(
        self,
        content: str,
        sensory_type: SensoryType
    ) -> List[SensoryDetail]:
        """
        提取特定类型的感官细节

        Args:
            content: 待分析的文本
            sensory_type: 感官类型

        Returns:
            List[SensoryDetail]: 该类型的感官细节列表
        """
        result = self.quick_analyze(content)
        return [d for d in result.items if d.type == sensory_type]

    def get_sensory_density(self, content: str) -> Dict[str, float]:
        """
        计算感官描写密度

        Args:
            content: 待分析的文本

        Returns:
            Dict: 各类型的密度（每100字的感官描写数）
        """
        result = self.quick_analyze(content)
        char_count = len(content)

        if char_count == 0:
            return {t.value: 0.0 for t in SensoryType}

        type_counts = result.metadata.get("type_distribution", {})
        return {
            sensory_type: (count / char_count) * 100
            for sensory_type, count in type_counts.items()
        }
