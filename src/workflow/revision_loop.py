# -*- coding: utf-8 -*-
"""
修订循环模块 (Revision Loop)

实现 Critic 反馈驱动的 Writer 修订循环。
支持最大循环次数限制和人工介入触发。
"""

from typing import Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum


class RevisionDecision(Enum):
    """修订决策"""
    APPROVED = "APPROVED"           # 通过，无需修订
    REVISE = "REVISE"               # 需要修订
    REWRITE = "REWRITE"             # 需要重写
    HUMAN_REVIEW = "HUMAN_REVIEW"   # 需要人工审阅


@dataclass
class RevisionConfig:
    """修订循环配置"""
    max_revisions: int = 3          # 最大修订次数
    pass_score: float = 80.0        # 通过分数阈值
    min_c_score: float = 7.0        # C(冲突)维度最低分
    human_review_score: float = 70.0  # 触发人工审阅的分数
    score_improvement_threshold: float = 5.0  # 最小分数提升阈值


@dataclass
class RevisionState:
    """修订状态"""
    revision_count: int = 0
    current_score: float = 0.0
    previous_score: float = 0.0
    decision: RevisionDecision = RevisionDecision.REVISE
    feedback: str = ""
    history: list = field(default_factory=list)
    stagnant_count: int = 0  # 分数停滞次数


class RevisionLoop:
    """
    修订循环控制器

    管理 Writer ↔ Critic 的修订循环，包括：
    - 分数追踪和趋势分析
    - 停滞检测（连续无提升）
    - 自动人工介入触发
    """

    def __init__(self, config: Optional[RevisionConfig] = None):
        self.config = config or RevisionConfig()
        self.state = RevisionState()

    def should_continue(self) -> bool:
        """判断是否应该继续修订循环"""
        # 已通过
        if self.state.decision == RevisionDecision.APPROVED:
            return False

        # 需要人工审阅
        if self.state.decision == RevisionDecision.HUMAN_REVIEW:
            return False

        # 达到最大修订次数
        if self.state.revision_count >= self.config.max_revisions:
            return False

        # 分数停滞超过2次
        if self.state.stagnant_count >= 2:
            return False

        return True

    def update_from_critic(self, critic_result: Dict[str, Any]) -> RevisionDecision:
        """
        根据 Critic 结果更新状态

        Args:
            critic_result: Critic Agent 的输出

        Returns:
            RevisionDecision: 修订决策
        """
        self.state.previous_score = self.state.current_score
        self.state.current_score = critic_result.get("total_score", 0)
        self.state.revision_count += 1

        # 获取原始决策
        raw_decision = critic_result.get("decision", "REVISE")
        self.state.feedback = critic_result.get("actionable_feedback", "")

        # 记录历史
        self.state.history.append({
            "revision": self.state.revision_count,
            "score": self.state.current_score,
            "decision": raw_decision,
            "feedback_preview": self.state.feedback[:100] if self.state.feedback else ""
        })

        # 检查分数提升
        score_improvement = self.state.current_score - self.state.previous_score
        if self.state.revision_count > 1 and score_improvement < self.config.score_improvement_threshold:
            self.state.stagnant_count += 1
        else:
            self.state.stagnant_count = 0

        # 确定最终决策
        decision = self._determine_decision(raw_decision, critic_result)
        self.state.decision = decision

        return decision

    def _determine_decision(
        self,
        raw_decision: str,
        critic_result: Dict[str, Any]
    ) -> RevisionDecision:
        """确定最终修订决策"""
        score = self.state.current_score

        # 检查 LOCK 分析中的 C 分数
        lock_analysis = critic_result.get("lock_analysis", {})
        c_score = 10  # 默认满分
        if lock_analysis:
            c_data = lock_analysis.get("C", {})
            if isinstance(c_data, dict):
                c_score = c_data.get("score", 10)

        # 决策逻辑
        if raw_decision == "APPROVED":
            if score >= self.config.pass_score and c_score >= self.config.min_c_score:
                return RevisionDecision.APPROVED
            else:
                # 分数不够，降级为修订
                return RevisionDecision.REVISE

        if raw_decision == "REWRITE":
            if self.state.revision_count >= self.config.max_revisions:
                return RevisionDecision.HUMAN_REVIEW
            return RevisionDecision.REWRITE

        if raw_decision == "HUMAN_REVIEW":
            return RevisionDecision.HUMAN_REVIEW

        # REVISE 情况
        if self.state.revision_count >= self.config.max_revisions:
            return RevisionDecision.HUMAN_REVIEW

        if self.state.stagnant_count >= 2:
            # 分数停滞，需要人工介入
            return RevisionDecision.HUMAN_REVIEW

        return RevisionDecision.REVISE

    def get_feedback_for_writer(self) -> Dict[str, Any]:
        """
        获取传递给 Writer 的反馈信息

        Returns:
            包含 issues, suggestions, dimension_scores 的字典
        """
        return {
            "feedback": self.state.feedback,
            "revision_count": self.state.revision_count,
            "previous_score": self.state.previous_score,
            "current_score": self.state.current_score,
            "history": self.state.history,
        }

    def get_summary(self) -> Dict[str, Any]:
        """获取修订循环摘要"""
        return {
            "total_revisions": self.state.revision_count,
            "final_score": self.state.current_score,
            "final_decision": self.state.decision.value,
            "score_trend": [h["score"] for h in self.state.history],
            "stagnant_count": self.state.stagnant_count,
            "history": self.state.history,
        }

    def reset(self):
        """重置修订状态"""
        self.state = RevisionState()


async def run_revision_loop(
    draft: str,
    scene_card: Dict[str, Any],
    writer_fn: Callable[[str, Dict[str, Any]], Awaitable[str]],
    critic_fn: Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]],
    config: Optional[RevisionConfig] = None,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    执行完整的修订循环

    Args:
        draft: 初始草稿
        scene_card: 场景卡片
        writer_fn: Writer 修订函数 (draft, feedback) -> revised_draft
        critic_fn: Critic 评估函数 (draft, scene_card) -> critic_result
        config: 修订配置
        verbose: 是否输出日志

    Returns:
        包含最终草稿和修订历史的字典
    """
    loop = RevisionLoop(config)
    current_draft = draft

    while True:
        # 评估当前草稿
        if verbose:
            print(f"\n🧐 第 {loop.state.revision_count + 1} 次评估...")

        critic_result = await critic_fn(current_draft, scene_card)
        decision = loop.update_from_critic(critic_result)

        if verbose:
            print(f"   分数: {loop.state.current_score:.1f}")
            print(f"   决策: {decision.value}")

        # 检查是否应该继续
        if not loop.should_continue():
            break

        # 获取反馈并修订
        feedback = loop.get_feedback_for_writer()

        if verbose:
            print(f"\n✍️ 第 {loop.state.revision_count} 次修订...")

        current_draft = await writer_fn(current_draft, feedback)

    # 返回结果
    summary = loop.get_summary()
    summary["final_draft"] = current_draft

    if verbose:
        print(f"\n{'='*50}")
        print(f"修订循环完成")
        print(f"   总修订次数: {summary['total_revisions']}")
        print(f"   最终分数: {summary['final_score']:.1f}")
        print(f"   最终决策: {summary['final_decision']}")
        print(f"{'='*50}")

    return summary
