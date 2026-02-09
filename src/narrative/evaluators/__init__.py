# -*- coding: utf-8 -*-
"""
叙事评估器模块

基于《AI写作代理终极指南》的双基石框架：
- 逻辑骨架（金字塔原理）
- 情感核心（弗雷叙事法则）

设计原则：评估器只负责评估和分析，不包含写作技巧指导。
写作技巧指导由 skills/ 目录下的技能包提供。

评估器职责：
- 分析文本内容
- 返回评分和问题诊断
- 提供改进方向（但不提供具体技巧）

技能包职责：
- 提供具体写作技巧
- 提供模板和示例
- 提供操作步骤
"""

from .base import BaseEvaluator, EvaluationResult, Issue, Severity, ScoreLevel

# 逻辑骨架评估器（金字塔原理）
from .pyramid_evaluator import PyramidEvaluator

# 情感核心评估器（弗雷叙事法则）
from .dream_evaluator import DreamEvaluator
from .suspense_evaluator import SuspenseEvaluator
from .character_evaluator import CharacterEvaluator
from .premise_evaluator import PremiseEvaluator
from .voice_evaluator import VoiceEvaluator

# 质量门禁
from .deadly_sins_checker import DeadlySinsChecker, DeadlySin

# 综合引擎
from .critic_engine import CriticEngine, ComprehensiveReport

# 新增评估器 - 基于知识库理论
from .subtext_evaluator import SubtextEvaluator
from .four_selves_evaluator import FourSelvesEvaluator
from .cliche_detector import ClicheDetector

__all__ = [
    # 基类
    'BaseEvaluator',
    'EvaluationResult',
    'Issue',
    'Severity',
    'ScoreLevel',
    
    # 逻辑骨架
    'PyramidEvaluator',
    
    # 情感核心
    'DreamEvaluator',
    'SuspenseEvaluator', 
    'CharacterEvaluator',
    'PremiseEvaluator',
    'VoiceEvaluator',
    
    # 质量门禁
    'DeadlySinsChecker',
    'DeadlySin',
    
    # 综合引擎
    'CriticEngine',
    'ComprehensiveReport',
    
    # 新增评估器 - 麦基理论体系
    'SubtextEvaluator',      # 潜台词评估
    'FourSelvesEvaluator',   # 四个自我评估
    'ClicheDetector',        # 陈词滥调检测
]
