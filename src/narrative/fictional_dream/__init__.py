# -*- coding: utf-8 -*-
"""
虚构梦境引擎 (Fictional Dream Engine)

创造让读者完全沉浸的"虚构梦境"结界。
本包聚焦梦境分析/评估能力；写作技巧由 skills/fictional-dream/SKILL.md 提供。

四层情感递进: 同情 -> 认同 -> 移情 -> 沉浸

来源: 《劲爆小说创作指南：高级戏剧性叙事技巧》
"""

from .engine import FictionalDreamEngine, DreamStrength, DreamLayerScore, FictionalDreamResult
from .sympathy import SympathyAnalyzer, SympathyTrigger
from .identification import IdentificationBuilder, IdentificationElement
from .empathy import EmpathyDeepener, SensoryDetail
from .immersion import ImmersionCatalyst, InternalConflict
from .evaluator import DreamEvaluator as FictionalDreamEvaluator, QuickDreamReport

# 兼容旧导出：DreamEvaluator
DreamEvaluator = FictionalDreamEvaluator

__all__ = [
    # 主引擎与结果模型
    "FictionalDreamEngine",
    "DreamStrength",
    "DreamLayerScore",
    "FictionalDreamResult",

    # 第一层：同情
    "SympathyAnalyzer",
    "SympathyTrigger",

    # 第二层：认同
    "IdentificationBuilder",
    "IdentificationElement",

    # 第三层：移情
    "EmpathyDeepener",
    "SensoryDetail",

    # 第四层：沉浸
    "ImmersionCatalyst",
    "InternalConflict",

    # 梦境评估器（与 narrative.evaluators.DreamEvaluator 区分）
    "FictionalDreamEvaluator",
    "QuickDreamReport",

    # 兼容别名
    "DreamEvaluator",
]
