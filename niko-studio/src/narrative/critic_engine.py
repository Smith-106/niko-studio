"""
评估引擎 - 五维度综合评估

核心特性:
1. 五维度评估 (dream/suspense/character/premise/voice)
2. 问题识别
3. 改进建议
4. 版本对比
5. 技能包推荐
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Iterable, Protocol

from src.config import get_config_value

logger = logging.getLogger("niko-critic")


@dataclass
class DimensionScore:
    """维度评分"""
    dimension: str
    score: float  # 0-10
    feedback: str
    issues: List[str] = field(default_factory=list)
    highlights: List[str] = field(default_factory=list)


@dataclass
class EvaluationResult:
    """评估结果"""
    overall_score: float
    dimensions: Dict[str, DimensionScore]
    issues: List[str]
    recommended_skills: List[str]


class DreamEvaluator:
    """虚构之梦评估器 - 沉浸感与画面感"""
    
    INDICATORS = {
        "positive": ["感受到", "仿佛", "画面", "沉浸", "真实", "细节", "氛围"],
        "negative": ["告诉", "解释", "说明", "因为", "所以", "总之"]
    }
    
    def evaluate(self, content: str) -> DimensionScore:
        positive = sum(1 for word in self.INDICATORS["positive"] if word in content)
        negative = sum(1 for word in self.INDICATORS["negative"] if word in content)
        
        # 基础分 5 分，正面指标加分，负面指标减分
        score = min(10, max(0, 5 + positive * 0.5 - negative * 0.3))
        
        issues = []
        if negative > 3:
            issues.append("过多直白叙述，缺少画面感")
        if positive < 2:
            issues.append("细节描写不足，难以形成沉浸感")
        
        return DimensionScore(
            dimension="dream",
            score=round(score, 1),
            feedback=self._generate_feedback(score, positive, negative),
            issues=issues,
            highlights=["画面感强" for _ in range(min(positive, 3))]
        )
    
    def _generate_feedback(self, score: float, pos: int, neg: int) -> str:
        if score >= 8:
            return "优秀的沉浸感，读者能够轻松进入虚构世界"
        elif score >= 6:
            return "基本的画面感，但可以通过更多感官细节增强"
        else:
            return "需要减少直白叙述，增加场景描写和感官细节"


class SuspenseEvaluator:
    """悬念张力评估器 - 紧张感与吸引力"""
    
    INDICATORS = {
        "tension": ["突然", "意外", "竟然", "却", "但是", "然而"],
        "mystery": ["为什么", "怎么", "谁", "什么", "难道", "究竟"],
        "urgency": ["必须", "马上", "立刻", "紧急", "来不及"]
    }
    
    def evaluate(self, content: str) -> DimensionScore:
        tension = sum(1 for word in self.INDICATORS["tension"] if word in content)
        mystery = sum(1 for word in self.INDICATORS["mystery"] if word in content)
        urgency = sum(1 for word in self.INDICATORS["urgency"] if word in content)
        
        score = min(10, max(0, 4 + tension * 0.4 + mystery * 0.3 + urgency * 0.3))
        
        issues = []
        if tension < 2 and mystery < 2:
            issues.append("缺少转折和悬念")
        if urgency < 1:
            issues.append("缺少紧迫感")
        
        return DimensionScore(
            dimension="suspense",
            score=round(score, 1),
            feedback=self._generate_feedback(score),
            issues=issues,
            highlights=[]
        )
    
    def _generate_feedback(self, score: float) -> str:
        if score >= 8:
            return "强烈的悬念感，读者会迫不及待地继续阅读"
        elif score >= 6:
            return "有一定的张力，但可以通过更多冲突增强"
        else:
            return "需要增加冲突、转折和悬念元素"


class CharacterEvaluator:
    """角色塑造评估器 - 人物立体感"""
    
    def evaluate(self, content: str) -> DimensionScore:
        # 对话检测
        dialogue_count = len(re.findall(r'["「].*?["」]', content))
        
        # 心理描写检测
        psychology_words = ["想", "觉得", "感到", "心里", "内心", "意识到"]
        psychology = sum(1 for word in psychology_words if word in content)
        
        # 动作描写检测
        action_patterns = len(re.findall(r'他[她它]?[^，。]{1,10}[了着过]', content))
        
        score = min(10, max(0, 4 + dialogue_count * 0.3 + psychology * 0.4 + action_patterns * 0.3))
        
        issues = []
        if dialogue_count < 2:
            issues.append("对话较少，角色声音不够突出")
        if psychology < 2:
            issues.append("心理描写不足，角色内心世界不够丰富")
        
        return DimensionScore(
            dimension="character",
            score=round(score, 1),
            feedback=self._generate_feedback(score),
            issues=issues,
            highlights=[]
        )
    
    def _generate_feedback(self, score: float) -> str:
        if score >= 8:
            return "角色形象立体，有独特的声音和行为模式"
        elif score >= 6:
            return "角色基本可辨识，但可以增加更多个性化细节"
        else:
            return "需要通过对话、心理和动作增强角色塑造"


class PremiseEvaluator:
    """前提设定评估器 - 逻辑自洽性"""
    
    def evaluate(self, content: str) -> DimensionScore:
        # 设定相关词
        setting_words = ["规则", "世界", "设定", "法则", "原理"]
        setting = sum(1 for word in setting_words if word in content)
        
        # 逻辑连接词
        logic_words = ["因为", "所以", "因此", "由于", "既然"]
        logic = sum(1 for word in logic_words if word in content)
        
        score = min(10, max(0, 5 + setting * 0.3 + logic * 0.2))
        
        issues = []
        if "魔法" in content or "超能力" in content:
            if setting < 1:
                issues.append("超自然元素缺少规则说明")
        
        return DimensionScore(
            dimension="premise",
            score=round(score, 1),
            feedback=self._generate_feedback(score),
            issues=issues,
            highlights=[]
        )
    
    def _generate_feedback(self, score: float) -> str:
        if score >= 8:
            return "设定清晰，逻辑自洽，读者容易接受"
        elif score >= 6:
            return "基本合理，但某些设定可以更加明确"
        else:
            return "需要加强设定的一致性和合理性"


class VoiceEvaluator:
    """叙事声音评估器 - 风格独特性"""
    
    def evaluate(self, content: str) -> DimensionScore:
        # 句子长度变化
        sentences = re.split(r'[。！？]', content)
        lengths = [len(s) for s in sentences if s.strip()]
        
        if len(lengths) > 1:
            variance = sum((l - sum(lengths)/len(lengths))**2 for l in lengths) / len(lengths)
            rhythm_score = min(3, variance / 100)  # 变化越大越好
        else:
            rhythm_score = 1
        
        # 修辞检测
        rhetoric_patterns = [
            r'像.*一样', r'如同', r'仿佛', r'宛如',  # 比喻
            r'.*呢\？', r'难道.*吗',  # 反问
        ]
        rhetoric = sum(1 for p in rhetoric_patterns if re.search(p, content))
        
        score = min(10, max(0, 4 + rhythm_score + rhetoric * 0.5))
        
        issues = []
        if rhythm_score < 1:
            issues.append("句式较为单一，缺少节奏变化")
        if rhetoric < 1:
            issues.append("修辞手法较少，表达可以更加生动")
        
        return DimensionScore(
            dimension="voice",
            score=round(score, 1),
            feedback=self._generate_feedback(score),
            issues=issues,
            highlights=[]
        )
    
    def _generate_feedback(self, score: float) -> str:
        if score >= 8:
            return "独特的叙事声音，风格鲜明"
        elif score >= 6:
            return "有一定风格，但可以更加个性化"
        else:
            return "需要发展更独特的叙事风格"


class EnginePlugin(Protocol):
    """主系统引擎插件协议"""

    name: str

    async def load(self, engine: "CriticEngine") -> None:
        """加载插件"""

    async def health_check(self) -> Dict[str, Any]:
        """插件健康检查"""

    async def before_evaluate(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """评估前钩子"""

    async def after_evaluate(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """评估后钩子"""


class CriticEngine:
    """综合评估引擎 (主系统)"""

    DIMENSION_SKILL_MAP = {
        "dream": ["fictional-dream", "expression-craft"],
        "suspense": ["suspense-craft", "misdirection-twist", "foreshadowing-craft"],
        "character": ["character-forge", "psychology-craft", "four-selves"],
        "premise": ["premise-magic", "lock-system"],
        "voice": ["voice-workshop", "presentation"],
    }

    def __init__(self, plugins: Optional[Iterable[EnginePlugin]] = None):
        self.is_primary_engine = True
        self.plugins: List[EnginePlugin] = []
        self._plugin_health: Dict[str, Dict[str, Any]] = {}
        self.evaluators = {
            "dream": DreamEvaluator(),
            "suspense": SuspenseEvaluator(),
            "character": CharacterEvaluator(),
            "premise": PremiseEvaluator(),
            "voice": VoiceEvaluator(),
        }
        logger.info("Critic engine initialized")

        if plugins:
            self._register_plugins(plugins)

    def _register_plugins(self, plugins: Iterable[EnginePlugin]) -> None:
        for plugin in plugins:
            if plugin in self.plugins:
                continue
            self.plugins.append(plugin)

    async def initialize(self) -> None:
        for plugin in self.plugins:
            try:
                await plugin.load(self)
            except Exception as exc:
                logger.error(f"Critic plugin load failed: {getattr(plugin, 'name', 'unknown')}: {exc}")
                self._plugin_health[getattr(plugin, "name", "unknown")] = {
                    "status": "error",
                    "error": str(exc)
                }

    async def health_check(self) -> Dict[str, Any]:
        plugin_status = {}
        for plugin in self.plugins:
            name = getattr(plugin, "name", "unknown")
            try:
                plugin_status[name] = await plugin.health_check()
            except Exception as exc:
                plugin_status[name] = {"status": "error", "error": str(exc)}
        self._plugin_health = plugin_status
        return {
            "engine": "primary",
            "evaluators": list(self.evaluators.keys()),
            "plugins": plugin_status
        }

    @classmethod
    def from_config(cls, plugins: Optional[Iterable[EnginePlugin]] = None) -> "CriticEngine":
        enabled = get_config_value("critic.enabled", True)
        if not enabled:
            return cls(plugins=plugins)
        return cls(plugins=plugins)

    async def _apply_before_hooks(self, context: Dict[str, Any]) -> Dict[str, Any]:
        for plugin in self.plugins:
            try:
                context = await plugin.before_evaluate(context)
            except Exception as exc:
                logger.error(f"Critic before_evaluate failed: {getattr(plugin, 'name', 'unknown')}: {exc}")
        return context

    async def _apply_after_hooks(self, context: Dict[str, Any]) -> Dict[str, Any]:
        for plugin in self.plugins:
            try:
                context = await plugin.after_evaluate(context)
            except Exception as exc:
                logger.error(f"Critic after_evaluate failed: {getattr(plugin, 'name', 'unknown')}: {exc}")
        return context

    async def evaluate(
        self,
        content: str,
        dimensions: List[str] = None
    ) -> dict:
        """
        五维度评估内容
        """
        if dimensions is None:
            dimensions = list(self.evaluators.keys())

        hook_context = await self._apply_before_hooks({"content": content, "dimensions": dimensions})
        content = hook_context.get("content", content)
        dimensions = hook_context.get("dimensions", dimensions)

        results = {}
        all_issues = []
        recommended_skills = set()

        for dim in dimensions:
            if dim not in self.evaluators:
                continue

            evaluator = self.evaluators[dim]
            score = evaluator.evaluate(content)

            results[dim] = {
                "score": score.score,
                "feedback": score.feedback,
                "issues": score.issues,
                "highlights": score.highlights
            }

            all_issues.extend(score.issues)

            # 低于 6 分推荐技能包
            if score.score < 6:
                recommended_skills.update(self.DIMENSION_SKILL_MAP.get(dim, []))

        # 计算总分
        scores = [results[dim]["score"] for dim in results]
        overall_score = sum(scores) / len(scores) if scores else 0

        result = {
            "overall_score": round(overall_score, 1),
            "dimensions": results,
            "issues": all_issues,
            "recommended_skills": list(recommended_skills)
        }

        result = await self._apply_after_hooks({
            "content": content,
            "dimensions": dimensions,
            "result": result
        })
        return result.get("result", result)
    
    async def suggest_improvements(
        self,
        content: str,
        issues: List[str] = None,
        max_suggestions: int = 5
    ) -> list:
        """获取改进建议"""
        # 先评估
        evaluation = await self.evaluate(content)
        
        if issues is None:
            issues = evaluation["issues"]
        
        suggestions = []
        
        for issue in issues[:max_suggestions]:
            # 匹配问题到技能包
            skill = None
            technique = None
            
            if "画面感" in issue or "沉浸" in issue:
                skill = "fictional-dream"
                technique = "感官细节描写"
            elif "悬念" in issue or "转折" in issue:
                skill = "suspense-craft"
                technique = "悬念钩子"
            elif "对话" in issue or "角色" in issue:
                skill = "character-forge"
                technique = "角色声音塑造"
            elif "设定" in issue or "逻辑" in issue:
                skill = "premise-magic"
                technique = "设定一致性检查"
            elif "风格" in issue or "句式" in issue:
                skill = "expression-craft"
                technique = "节奏变化"
            
            suggestions.append({
                "issue": issue,
                "suggestion": self._generate_suggestion(issue),
                "skill": skill,
                "technique": technique
            })
        
        return suggestions
    
    def _generate_suggestion(self, issue: str) -> str:
        """生成改进建议"""
        suggestion_map = {
            "画面感": "增加视觉、听觉、触觉等感官细节，让读者'看到'而不是'被告知'",
            "沉浸": "减少作者干预，通过场景和动作展示情感，而不是直接说明",
            "悬念": "在关键节点设置悬念钩子，延迟信息披露，制造期待感",
            "对话": "让角色通过独特的说话方式展现个性，避免'传声筒'式对话",
            "心理": "深入角色内心，展现其矛盾、挣扎和成长",
            "设定": "明确超自然元素的规则和代价，保持逻辑一致",
            "风格": "变化句子长度和结构，使用修辞手法增加表现力",
        }
        
        for key, suggestion in suggestion_map.items():
            if key in issue:
                return suggestion
        
        return "请参考相关技能包进行改进"
    
    async def compare(
        self,
        version_a: str,
        version_b: str
    ) -> dict:
        """比较两个版本的质量差异"""
        eval_a = await self.evaluate(version_a)
        eval_b = await self.evaluate(version_b)
        
        comparison = {
            "version_a_score": eval_a["overall_score"],
            "version_b_score": eval_b["overall_score"],
            "improvement": round(eval_b["overall_score"] - eval_a["overall_score"], 1),
            "dimension_changes": {}
        }
        
        for dim in eval_a["dimensions"]:
            if dim in eval_b["dimensions"]:
                change = eval_b["dimensions"][dim]["score"] - eval_a["dimensions"][dim]["score"]
                comparison["dimension_changes"][dim] = {
                    "before": eval_a["dimensions"][dim]["score"],
                    "after": eval_b["dimensions"][dim]["score"],
                    "change": round(change, 1),
                    "improved": change > 0
                }
        
        comparison["verdict"] = (
            "版本B优于版本A" if comparison["improvement"] > 0.5
            else "版本A优于版本B" if comparison["improvement"] < -0.5
            else "两个版本质量相近"
        )
        
        return comparison
