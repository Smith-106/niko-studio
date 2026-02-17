# -*- coding: utf-8 -*-
"""
叙事分析器模块

分析器负责从文本中提取和分析特定元素：
- 感官细节 (SensoryAnalyzer)
- 冲突元素 (ConflictAnalyzer)
- 角色状态 (CharacterStateAnalyzer)
- 张力曲线 (TensionCurveAnalyzer)

设计原则：
- 分析器提取结构化数据
- 评估器基于分析数据评分
- 技能包提供写作指导
"""

from .base import (
    BaseAnalyzer,
    AnalysisResult,
    AnalysisType,
)

from .sensory_analyzer import (
    SensoryAnalyzer,
    SensoryDetail,
    SensoryType,
)

from .conflict_analyzer import (
    ConflictAnalyzer,
    Conflict,
    ConflictType,
)

from .character_state_analyzer import (
    CharacterStateAnalyzer,
    CharacterState,
)

from .tension_curve_analyzer import (
    TensionCurveAnalyzer,
    TensionCurve,
    TensionPoint,
)

__all__ = [
    # 基类
    'BaseAnalyzer',
    'AnalysisResult',
    'AnalysisType',

    # 感官分析
    'SensoryAnalyzer',
    'SensoryDetail',
    'SensoryType',

    # 冲突分析
    'ConflictAnalyzer',
    'Conflict',
    'ConflictType',

    # 角色状态分析
    'CharacterStateAnalyzer',
    'CharacterState',

    # 张力曲线
    'TensionCurveAnalyzer',
    'TensionCurve',
    'TensionPoint',
]
