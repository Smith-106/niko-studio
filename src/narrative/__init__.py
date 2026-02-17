# Narrative / Critic Engine
"""
叙事能力导出入口。

- 保持 `CriticEngine` 兼容导出（legacy root engine）
- 提供 evaluators/analyzers 的核心导出，便于统一引用
"""

from .critic_engine import CriticEngine as LegacyCriticEngine
from .evaluators.critic_engine import CriticEngine as EvaluatorCriticEngine, ComprehensiveReport
from .analyzers import (
    SensoryAnalyzer,
    ConflictAnalyzer,
    CharacterStateAnalyzer,
    TensionCurveAnalyzer,
)

# 兼容旧导出
CriticEngine = LegacyCriticEngine

__all__ = [
    "CriticEngine",
    "LegacyCriticEngine",
    "EvaluatorCriticEngine",
    "ComprehensiveReport",
    "SensoryAnalyzer",
    "ConflictAnalyzer",
    "CharacterStateAnalyzer",
    "TensionCurveAnalyzer",
]
