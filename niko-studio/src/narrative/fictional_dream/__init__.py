# -*- coding: utf-8 -*-
"""
虚构梦境引擎 (Fictional Dream Engine)

创造让读者完全沉浸的"虚构梦境"结界
四层情感递进: 同情 → 认同 → 移情 → 沉浸

来源: 《劲爆小说创作指南：高级戏剧性叙事技巧》
"""

from .engine import FictionalDreamEngine
from .sympathy import SympathyAnalyzer, SympathyTrigger
from .identification import IdentificationBuilder, IdentificationElement
from .empathy import EmpathyDeepener, SensoryDetail
from .immersion import ImmersionCatalyst, InternalConflict
from .evaluator import DreamEvaluator, DreamStrength

__all__ = [
    # 主引擎
    "FictionalDreamEngine",
    
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
    
    # 评估器
    "DreamEvaluator",
    "DreamStrength",
]
