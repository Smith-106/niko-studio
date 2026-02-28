# -*- coding: utf-8 -*-
"""
修订循环模块 (Revision Loop)

实现 Critic 反馈驱动的 Writer 修订循环。
支持最大循环次数限制和人工介入触发。
"""

from typing import Dict, Any, Optional, Callable, Awaitable, Literal
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from datetime import datetime, timezone
import asyncio
import json

from src.workflow.state import (
    NOVEL_PASS_SCORE,
    NOVEL_MIN_C_SCORE,
    NOVEL_HUMAN_REVIEW_SCORE,
    NOVEL_SCORE_IMPROVEMENT_THRESHOLD,
)
from src.workflow.session.session_manager import SessionManager, ContentType


QualityMode = Literal["auto", "manual"]
QualityLevel = Literal["ultra", "high", "medium", "fluent"]
QUALITY_LEVEL_ORDER: tuple[QualityLevel, ...] = ("ultra", "high", "medium", "fluent")


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
    pass_score: float = float(NOVEL_PASS_SCORE)        # 通过分数阈值
    min_c_score: float = float(NOVEL_MIN_C_SCORE)        # C(冲突)维度最低分
    human_review_score: float = float(NOVEL_HUMAN_REVIEW_SCORE)  # 触发人工审阅的分数
    score_improvement_threshold: float = float(NOVEL_SCORE_IMPROVEMENT_THRESHOLD)  # 最小分数提升阈值
    quality_mode: QualityMode = "auto"
    quality_level: QualityLevel = "high"
    degrade_on_timeout: bool = True
    degrade_on_error: bool = True
    quality_phase_timeout_seconds: int = 30


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
    checkpoint_trace: list = field(default_factory=list)
    last_checkpoint_id: str = ""
    quality_mode: QualityMode = "auto"
    requested_quality_level: QualityLevel = "high"
    effective_quality_level: QualityLevel = "high"
    degrade_reason: str = ""
    degrade_steps: list = field(default_factory=list)
    feedback_artifacts: list = field(default_factory=list)


class RevisionLoop:
    """
    修订循环控制器

    管理 Writer ↔ Critic 的修订循环，包括：
    - 分数追踪和趋势分析
    - 停滞检测（连续无提升）
    - 自动人工介入触发
    """

    def __init__(self, config: Optional[RevisionConfig] = None, checkpoint_store: Optional[Dict[str, Any]] = None):
        self.config = config or RevisionConfig()
        self.state = RevisionState(
            quality_mode=self.config.quality_mode,
            requested_quality_level=self._normalize_quality_level(self.config.quality_level),
            effective_quality_level=self._normalize_quality_level(self.config.quality_level),
        )
        self.checkpoint_store = checkpoint_store or {}

    @staticmethod
    def _normalize_quality_level(level: str) -> QualityLevel:
        if level in QUALITY_LEVEL_ORDER:
            return level  # type: ignore[return-value]
        return "high"

    @staticmethod
    def _next_quality_level(level: QualityLevel) -> QualityLevel:
        index = QUALITY_LEVEL_ORDER.index(level)
        if index >= len(QUALITY_LEVEL_ORDER) - 1:
            return level
        return QUALITY_LEVEL_ORDER[index + 1]

    def _record_degrade_step(self, reason: str, phase: str) -> bool:
        if self.state.quality_mode != "auto":
            return False

        from_level = self.state.effective_quality_level
        to_level = self._next_quality_level(from_level)
        if to_level == from_level:
            return False

        self.state.effective_quality_level = to_level
        self.state.degrade_reason = reason
        self.state.degrade_steps.append(
            {
                "from_level": from_level,
                "to_level": to_level,
                "reason": reason,
                "phase": phase,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return True

    def handle_runtime_event(self, event: Literal["timeout", "error"], phase: str, detail: str = "") -> bool:
        if event == "timeout" and not self.config.degrade_on_timeout:
            return False
        if event == "error" and not self.config.degrade_on_error:
            return False

        reason = f"{event}:{phase}"
        if detail:
            reason = f"{reason}:{detail}"
        return self._record_degrade_step(reason, phase)

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

    def _build_round_identifier(self) -> str:
        return f"round-{self.state.revision_count}"

    def _build_checkpoint_artifact(
        self,
        round_identifier: str,
        critic_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "checkpoint_id": f"revision-{round_identifier}",
            "revision_count": self.state.revision_count,
            "round_identifier": round_identifier,
            "step_id": round_identifier,
            "stage": "critic",
            "decision": self.state.decision.value,
            "score": self.state.current_score,
            "previous_score": self.state.previous_score,
            "stagnant_count": self.state.stagnant_count,
            "session_id": str(critic_result.get("session_id") or ""),
            "trace": {
                "state_trace_id": f"{round_identifier}:{self.state.current_score}",
                "revision_checkpoint_id": f"revision-{round_identifier}",
            },
        }

    def _persist_checkpoint_artifact(self, artifact: Dict[str, Any]) -> str:
        checkpoint_id = str(artifact.get("checkpoint_id") or "")
        if not checkpoint_id:
            return ""

        self.checkpoint_store[checkpoint_id] = artifact
        self.state.last_checkpoint_id = checkpoint_id
        self.state.checkpoint_trace.append(
            {
                "checkpoint_id": checkpoint_id,
                "step_id": artifact.get("step_id", ""),
                "stage": artifact.get("stage", "critic"),
                "round_identifier": artifact.get("round_identifier", ""),
            }
        )

        return checkpoint_id

    def _normalize_severity(self, priority: str) -> str:
        normalized = (priority or "").strip().lower()
        if normalized in {"high", "critical"}:
            return "high"
        if normalized in {"medium", "med"}:
            return "medium"
        if normalized in {"low", "minor"}:
            return "low"
        return "medium"

    def _infer_scope(self, anchor: str) -> str:
        token = (anchor or "").lower()
        if "scene" in token or "场景" in token:
            return "scene"
        return "chapter"

    def _build_feedback_artifacts(
        self,
        round_identifier: str,
        critic_result: Dict[str, Any],
    ) -> list:
        instructions = critic_result.get("revision_instructions")
        actionable_feedback = str(critic_result.get("actionable_feedback") or "").strip()

        artifacts: list = []

        if isinstance(instructions, list) and instructions:
            for index, item in enumerate(instructions, start=1):
                if not isinstance(item, dict):
                    continue

                anchor = str(item.get("target") or "").strip() or f"chapter-{self.state.revision_count}"
                issue = str(item.get("issue") or "").strip() or "unspecified issue"
                recommendation = str(item.get("suggestion") or "").strip() or actionable_feedback or "revise content"
                priority = str(item.get("priority") or "medium")
                severity = self._normalize_severity(priority)

                artifacts.append(
                    {
                        "feedback_id": f"feedback-{round_identifier}-{index}",
                        "round_id": round_identifier,
                        "scope": self._infer_scope(anchor),
                        "anchor": anchor,
                        "severity": severity,
                        "issue": issue,
                        "recommendation": recommendation,
                        "source": "critic",
                    }
                )

        if not artifacts:
            default_anchor = f"chapter-{self.state.revision_count}"
            default_issue = actionable_feedback or "quality improvement needed"
            artifacts.append(
                {
                    "feedback_id": f"feedback-{round_identifier}-1",
                    "round_id": round_identifier,
                    "scope": "chapter",
                    "anchor": default_anchor,
                    "severity": "medium",
                    "issue": default_issue,
                    "recommendation": actionable_feedback or "revise according to critic feedback",
                    "source": "critic",
                }
            )

        return artifacts

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

        round_identifier = self._build_round_identifier()
        artifact = self._build_checkpoint_artifact(round_identifier, critic_result)
        self._persist_checkpoint_artifact(artifact)
        self.state.feedback_artifacts = self._build_feedback_artifacts(round_identifier, critic_result)

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
            "last_checkpoint_id": self.state.last_checkpoint_id,
            "checkpoint_trace": self.state.checkpoint_trace,
            "quality_mode": self.state.quality_mode,
            "requested_quality_level": self.state.requested_quality_level,
            "effective_quality_level": self.state.effective_quality_level,
            "degrade_reason": self.state.degrade_reason,
            "degrade_steps": self.state.degrade_steps,
            "feedback_artifacts": self.state.feedback_artifacts,
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
            "last_checkpoint_id": self.state.last_checkpoint_id,
            "checkpoint_trace": self.state.checkpoint_trace,
            "quality_mode": self.state.quality_mode,
            "requested_quality_level": self.state.requested_quality_level,
            "effective_quality_level": self.state.effective_quality_level,
            "degrade_reason": self.state.degrade_reason,
            "degrade_steps": self.state.degrade_steps,
            "feedback_artifacts": self.state.feedback_artifacts,
        }

    def reset(self):
        """重置修订状态"""
        self.state = RevisionState(
            quality_mode=self.config.quality_mode,
            requested_quality_level=self._normalize_quality_level(self.config.quality_level),
            effective_quality_level=self._normalize_quality_level(self.config.quality_level),
        )
def _build_feedback_artifact_envelope(
    feedback_artifacts: list,
    session_id: str,
    run_id: str,
    revision_id: str,
    evidence_links: list[str],
) -> Dict[str, Any]:
    return {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "date": datetime.now().date().isoformat(),
        "owner": "revision_loop",
        "input": {
            "session_id": session_id,
            "run_id": run_id,
            "revision_id": revision_id,
        },
        "output": {
            "feedback_artifacts": feedback_artifacts,
            "count": len(feedback_artifacts),
        },
        "result": "PASS",
        "evidence_links": evidence_links,
        "trace": {
            "session_id": session_id,
            "run_id": run_id,
            "revision_id": revision_id,
        },
    }


async def run_revision_loop(
    draft: str,
    scene_card: Dict[str, Any],
    writer_fn: Callable[[str, Dict[str, Any]], Awaitable[str]],
    critic_fn: Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]],
    config: Optional[RevisionConfig] = None,
    verbose: bool = True,
    checkpoint_store: Optional[Dict[str, Any]] = None,
    checkpoint_base_path: Optional[str] = None,
    session_id: str = "",
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
    loop = RevisionLoop(config, checkpoint_store=checkpoint_store)
    current_draft = draft
    session_manager: Optional[SessionManager] = None

    if checkpoint_base_path and session_id:
        session_manager = SessionManager(base_path=checkpoint_base_path)
        active_session_path = session_manager.active_path / session_id
        archived_session_path = session_manager.archived_path / session_id
        if not active_session_path.exists() and not archived_session_path.exists():
            session_manager.init(
                session_id=session_id,
                session_type="standard",
                project_name="revision-loop",
                domain="novel",
            )

    while True:
        # 评估当前草稿
        if verbose:
            print(f"\n🧐 第 {loop.state.revision_count + 1} 次评估...")

        try:
            timeout_seconds = max(float(loop.config.quality_phase_timeout_seconds), 0.0)
            critic_coro = critic_fn(current_draft, scene_card)
            critic_result = (
                await asyncio.wait_for(critic_coro, timeout=timeout_seconds)
                if timeout_seconds > 0
                else await critic_coro
            )
        except asyncio.TimeoutError:
            degraded = loop.handle_runtime_event("timeout", "critic")
            if degraded:
                if verbose:
                    print(f"   质量降级: critic timeout -> {loop.state.effective_quality_level}")
                continue
            loop.state.decision = RevisionDecision.HUMAN_REVIEW
            loop.state.degrade_reason = "timeout:critic"
            break
        except Exception as exc:
            degraded = loop.handle_runtime_event("error", "critic", detail=exc.__class__.__name__)
            if degraded:
                if verbose:
                    print(f"   质量降级: critic error -> {loop.state.effective_quality_level}")
                continue
            loop.state.decision = RevisionDecision.HUMAN_REVIEW
            loop.state.degrade_reason = f"error:critic:{exc.__class__.__name__}"
            break

        if session_id and isinstance(critic_result, dict) and "session_id" not in critic_result:
            critic_result = {**critic_result, "session_id": session_id}
        decision = loop.update_from_critic(critic_result)

        if checkpoint_base_path and loop.state.last_checkpoint_id:
            checkpoint_dir = Path(checkpoint_base_path) / "revision-checkpoints"
            checkpoint_dir.mkdir(parents=True, exist_ok=True)
            checkpoint_payload = loop.checkpoint_store.get(loop.state.last_checkpoint_id, {})
            checkpoint_path = checkpoint_dir / f"{loop.state.last_checkpoint_id}.json"
            checkpoint_path.write_text(
                json.dumps(checkpoint_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            if session_manager and session_id:
                session_manager.write(
                    session_id=session_id,
                    content_type=ContentType.REVISION_CHECKPOINT,
                    content=json.dumps(checkpoint_payload, ensure_ascii=False, indent=2, sort_keys=True),
                    id=loop.state.last_checkpoint_id,
                )

                feedback_snapshot_id = f"{loop.state.last_checkpoint_id}-feedback"
                feedback_snapshot_path = session_manager._resolve_path(
                    session_id=session_id,
                    content_type=ContentType.GENERATION_SNAPSHOT,
                    id=feedback_snapshot_id,
                )
                feedback_artifacts = list(loop.state.feedback_artifacts)
                feedback_snapshot_payload = _build_feedback_artifact_envelope(
                    feedback_artifacts=feedback_artifacts,
                    session_id=session_id,
                    run_id=f"run-{loop.state.last_checkpoint_id}",
                    revision_id=loop.state.last_checkpoint_id,
                    evidence_links=[
                        str(feedback_snapshot_path),
                        str(session_manager._resolve_path(session_id, ContentType.REVISION_CHECKPOINT, id=loop.state.last_checkpoint_id)),
                    ],
                )
                session_manager.write(
                    session_id=session_id,
                    content_type=ContentType.GENERATION_SNAPSHOT,
                    content=json.dumps(feedback_snapshot_payload, ensure_ascii=False, indent=2, sort_keys=True),
                    id=feedback_snapshot_id,
                )

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

        try:
            timeout_seconds = max(float(loop.config.quality_phase_timeout_seconds), 0.0)
            writer_coro = writer_fn(current_draft, feedback)
            current_draft = (
                await asyncio.wait_for(writer_coro, timeout=timeout_seconds)
                if timeout_seconds > 0
                else await writer_coro
            )
        except asyncio.TimeoutError:
            degraded = loop.handle_runtime_event("timeout", "writer")
            if degraded:
                if verbose:
                    print(f"   质量降级: writer timeout -> {loop.state.effective_quality_level}")
                continue
            loop.state.decision = RevisionDecision.HUMAN_REVIEW
            loop.state.degrade_reason = "timeout:writer"
            break
        except Exception as exc:
            degraded = loop.handle_runtime_event("error", "writer", detail=exc.__class__.__name__)
            if degraded:
                if verbose:
                    print(f"   质量降级: writer error -> {loop.state.effective_quality_level}")
                continue
            loop.state.decision = RevisionDecision.HUMAN_REVIEW
            loop.state.degrade_reason = f"error:writer:{exc.__class__.__name__}"
            break

    # 返回结果
    summary = loop.get_summary()
    summary["final_draft"] = current_draft

    if verbose:
        print(f"\n{'='*50}")
        print("修订循环完成")
        print(f"   总修订次数: {summary['total_revisions']}")
        print(f"   最终分数: {summary['final_score']:.1f}")
        print(f"   最终决策: {summary['final_decision']}")
        print(f"{'='*50}")

    return summary
