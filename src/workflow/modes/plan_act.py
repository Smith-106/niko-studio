# -*- coding: utf-8 -*-
"""
Plan-Act Mode - 计划-执行模式

实现结构化的计划-执行-审核工作流模式。
支持多阶段执行、检查点管理和迭代优化。
"""

import logging
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Protocol, runtime_checkable
from datetime import datetime

logger = logging.getLogger("niko-workflow")


class WorkflowPhase(Enum):
    """工作流阶段"""
    PLAN = "plan"          # 计划阶段
    ACT = "act"            # 执行阶段
    REVIEW = "review"      # 审核阶段
    REVISE = "revise"      # 修订阶段
    COMPLETE = "complete"  # 完成


@dataclass
class PhaseResult:
    """阶段执行结果"""
    phase: WorkflowPhase
    success: bool
    output: Any = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[Exception] = None
    duration_ms: int = 0
    next_phase: Optional[WorkflowPhase] = None

    @classmethod
    def ok(cls, phase: WorkflowPhase, output: Any, next_phase: Optional[WorkflowPhase] = None, **metadata) -> "PhaseResult":
        return cls(
            phase=phase,
            success=True,
            output=output,
            metadata=metadata,
            next_phase=next_phase
        )

    @classmethod
    def fail(cls, phase: WorkflowPhase, error: Exception) -> "PhaseResult":
        return cls(
            phase=phase,
            success=False,
            error=error
        )


@dataclass
class Checkpoint:
    """检查点"""
    phase: WorkflowPhase
    timestamp: datetime
    state: Dict[str, Any]
    iteration: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "phase": self.phase.value,
            "timestamp": self.timestamp.isoformat(),
            "state": self.state,
            "iteration": self.iteration
        }


@dataclass
class PlanActState:
    """Plan-Act 模式状态"""
    session_id: str
    current_phase: WorkflowPhase = WorkflowPhase.PLAN
    iteration: int = 0
    max_iterations: int = 3
    plan: Optional[Dict[str, Any]] = None
    output: Optional[str] = None
    review_feedback: Optional[Dict[str, Any]] = None
    checkpoints: List[Checkpoint] = field(default_factory=list)
    phase_history: List[PhaseResult] = field(default_factory=list)

    def save_checkpoint(self) -> Checkpoint:
        """保存当前状态为检查点"""
        checkpoint = Checkpoint(
            phase=self.current_phase,
            timestamp=datetime.now(),
            state={
                "plan": self.plan,
                "output": self.output,
                "review_feedback": self.review_feedback,
            },
            iteration=self.iteration
        )
        self.checkpoints.append(checkpoint)
        return checkpoint

    def restore_checkpoint(self, checkpoint: Checkpoint) -> None:
        """恢复到检查点状态"""
        self.current_phase = checkpoint.phase
        self.iteration = checkpoint.iteration
        self.plan = checkpoint.state.get("plan")
        self.output = checkpoint.state.get("output")
        self.review_feedback = checkpoint.state.get("review_feedback")


@runtime_checkable
class IPhaseExecutor(Protocol):
    """阶段执行器协议"""

    async def execute(
        self,
        state: PlanActState,
        context: Dict[str, Any]
    ) -> PhaseResult:
        """执行阶段"""
        ...


class PlanPhaseExecutor:
    """
    计划阶段执行器

    使用 ArchitectAgent 生成执行计划。
    """

    def __init__(self, architect_agent: Optional[Any] = None):
        self._architect = architect_agent

    async def execute(
        self,
        state: PlanActState,
        context: Dict[str, Any]
    ) -> PhaseResult:
        """执行计划阶段"""
        start_time = datetime.now()

        try:
            task = context.get("task", "")
            requirements = context.get("requirements", [])

            # 如果有 ArchitectAgent，使用它生成计划
            if self._architect and hasattr(self._architect, 'plan'):
                plan = await self._architect.plan(
                    task=task,
                    requirements=requirements,
                    context=context
                )
            else:
                # 默认计划结构
                plan = {
                    "task": task,
                    "steps": [
                        {"step": 1, "action": "analyze_requirements", "description": "Analyze task requirements"},
                        {"step": 2, "action": "generate_content", "description": "Generate initial content"},
                        {"step": 3, "action": "refine_output", "description": "Refine and polish output"},
                    ],
                    "estimated_tokens": 2000,
                    "skills_required": context.get("skills", []),
                }

            state.plan = plan
            duration = int((datetime.now() - start_time).total_seconds() * 1000)

            return PhaseResult.ok(
                phase=WorkflowPhase.PLAN,
                output=plan,
                next_phase=WorkflowPhase.ACT,
                duration_ms=duration
            )

        except Exception as e:
            logger.error(f"Plan phase failed: {e}")
            return PhaseResult.fail(WorkflowPhase.PLAN, e)


class ActPhaseExecutor:
    """
    执行阶段执行器

    使用 WriterAgent 执行计划并生成内容。
    """

    def __init__(self, writer_agent: Optional[Any] = None):
        self._writer = writer_agent

    async def execute(
        self,
        state: PlanActState,
        context: Dict[str, Any]
    ) -> PhaseResult:
        """执行行动阶段"""
        start_time = datetime.now()

        try:
            if state.plan is None:
                raise ValueError("No plan available for execution")

            plan = state.plan
            task = context.get("task", "")

            # 如果有 WriterAgent，使用它生成内容
            if self._writer and hasattr(self._writer, 'write'):
                output = await self._writer.write(
                    task=task,
                    plan=plan,
                    context=context,
                    previous_feedback=state.review_feedback
                )
            else:
                # 默认输出
                steps_desc = "\n".join(f"- {s['description']}" for s in plan.get("steps", []))
                output = f"[Generated content for: {task}]\n\nExecuted steps:\n{steps_desc}"

            state.output = output
            duration = int((datetime.now() - start_time).total_seconds() * 1000)

            return PhaseResult.ok(
                phase=WorkflowPhase.ACT,
                output=output,
                next_phase=WorkflowPhase.REVIEW,
                duration_ms=duration
            )

        except Exception as e:
            logger.error(f"Act phase failed: {e}")
            return PhaseResult.fail(WorkflowPhase.ACT, e)


class ReviewPhaseExecutor:
    """
    审核阶段执行器

    使用 CriticAgent 评估输出质量。
    """

    def __init__(
        self,
        critic_agent: Optional[Any] = None,
        quality_threshold: float = 0.7
    ):
        self._critic = critic_agent
        self._quality_threshold = quality_threshold

    async def execute(
        self,
        state: PlanActState,
        context: Dict[str, Any]
    ) -> PhaseResult:
        """执行审核阶段"""
        start_time = datetime.now()

        try:
            if state.output is None:
                raise ValueError("No output to review")

            output = state.output

            # 如果有 CriticAgent，使用它评估
            if self._critic and hasattr(self._critic, 'evaluate'):
                feedback = await self._critic.evaluate(
                    content=output,
                    context=context
                )
            else:
                # 默认评估
                feedback = {
                    "overall_score": 0.75,
                    "dimensions": {
                        "coherence": 0.8,
                        "engagement": 0.7,
                        "style": 0.75,
                    },
                    "issues": [],
                    "suggestions": [],
                }

            state.review_feedback = feedback
            duration = int((datetime.now() - start_time).total_seconds() * 1000)

            # 决定下一阶段
            overall_score = feedback.get("overall_score", 0)
            if overall_score >= self._quality_threshold:
                next_phase = WorkflowPhase.COMPLETE
            elif state.iteration < state.max_iterations:
                next_phase = WorkflowPhase.REVISE
            else:
                next_phase = WorkflowPhase.COMPLETE
                logger.warning(f"Max iterations reached, accepting output with score {overall_score}")

            return PhaseResult.ok(
                phase=WorkflowPhase.REVIEW,
                output=feedback,
                next_phase=next_phase,
                duration_ms=duration,
                quality_score=overall_score
            )

        except Exception as e:
            logger.error(f"Review phase failed: {e}")
            return PhaseResult.fail(WorkflowPhase.REVIEW, e)


class RevisePhaseExecutor:
    """
    修订阶段执行器

    基于审核反馈修订输出。
    """

    def __init__(self, writer_agent: Optional[Any] = None):
        self._writer = writer_agent

    async def execute(
        self,
        state: PlanActState,
        context: Dict[str, Any]
    ) -> PhaseResult:
        """执行修订阶段"""
        start_time = datetime.now()

        try:
            if state.output is None or state.review_feedback is None:
                raise ValueError("Missing output or feedback for revision")

            # 如果有 WriterAgent，使用它修订
            if self._writer and hasattr(self._writer, 'revise'):
                revised = await self._writer.revise(
                    content=state.output,
                    feedback=state.review_feedback,
                    context=context
                )
            else:
                # 默认修订（简单返回原内容）
                issues = state.review_feedback.get("issues", [])
                revised = state.output
                if issues:
                    revised += f"\n\n[Revision notes: Addressed {len(issues)} issues]"

            state.output = revised
            state.iteration += 1
            duration = int((datetime.now() - start_time).total_seconds() * 1000)

            return PhaseResult.ok(
                phase=WorkflowPhase.REVISE,
                output=revised,
                next_phase=WorkflowPhase.REVIEW,
                duration_ms=duration,
                iteration=state.iteration
            )

        except Exception as e:
            logger.error(f"Revise phase failed: {e}")
            return PhaseResult.fail(WorkflowPhase.REVISE, e)


class PlanActMode:
    """
    Plan-Act 工作流模式

    实现结构化的计划-执行-审核循环。

    工作流程:
    1. Plan: 使用 ArchitectAgent 生成执行计划
    2. Act: 使用 WriterAgent 执行计划生成内容
    3. Review: 使用 CriticAgent 评估质量
    4. Revise (可选): 如果质量不达标，进行修订
    5. Complete: 返回最终输出

    使用示例:
        mode = PlanActMode(
            architect_agent=architect,
            writer_agent=writer,
            critic_agent=critic
        )

        result = await mode.execute(
            session_id="session-001",
            task="写一个悬疑开场",
            context={"genre": "mystery"}
        )

        if result.success:
            print(result.output)
    """

    def __init__(
        self,
        architect_agent: Optional[Any] = None,
        writer_agent: Optional[Any] = None,
        critic_agent: Optional[Any] = None,
        quality_threshold: float = 0.7,
        max_iterations: int = 3
    ):
        self._plan_executor = PlanPhaseExecutor(architect_agent)
        self._act_executor = ActPhaseExecutor(writer_agent)
        self._review_executor = ReviewPhaseExecutor(critic_agent, quality_threshold)
        self._revise_executor = RevisePhaseExecutor(writer_agent)

        self._executors: Dict[WorkflowPhase, IPhaseExecutor] = {
            WorkflowPhase.PLAN: self._plan_executor,
            WorkflowPhase.ACT: self._act_executor,
            WorkflowPhase.REVIEW: self._review_executor,
            WorkflowPhase.REVISE: self._revise_executor,
        }

        self._max_iterations = max_iterations
        self._states: Dict[str, PlanActState] = {}

    async def execute(
        self,
        session_id: str,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        resume_from_checkpoint: bool = False
    ) -> PhaseResult:
        """
        执行 Plan-Act 工作流

        Args:
            session_id: 会话 ID
            task: 任务描述
            context: 额外上下文
            resume_from_checkpoint: 是否从检查点恢复

        Returns:
            最终阶段结果
        """
        # 获取或创建状态
        if session_id in self._states and resume_from_checkpoint:
            state = self._states[session_id]
            if state.checkpoints:
                state.restore_checkpoint(state.checkpoints[-1])
        else:
            state = PlanActState(
                session_id=session_id,
                max_iterations=self._max_iterations
            )
            self._states[session_id] = state

        # 合并上下文
        full_context = {"task": task}
        if context:
            full_context.update(context)

        # 执行工作流循环
        while state.current_phase != WorkflowPhase.COMPLETE:
            executor = self._executors.get(state.current_phase)

            if executor is None:
                logger.error(f"No executor for phase: {state.current_phase}")
                break

            # 保存检查点
            state.save_checkpoint()

            # 执行阶段
            result = await executor.execute(state, full_context)
            state.phase_history.append(result)

            if not result.success:
                logger.error(f"Phase {state.current_phase.value} failed: {result.error}")
                return result

            # 转移到下一阶段
            if result.next_phase:
                state.current_phase = result.next_phase
            else:
                break

        # 返回最终结果
        return PhaseResult.ok(
            phase=WorkflowPhase.COMPLETE,
            output=state.output,
            plan=state.plan,
            review_feedback=state.review_feedback,
            iterations=state.iteration,
            phase_count=len(state.phase_history)
        )

    def get_state(self, session_id: str) -> Optional[PlanActState]:
        """获取会话状态"""
        return self._states.get(session_id)

    def clear_state(self, session_id: str) -> bool:
        """清除会话状态"""
        if session_id in self._states:
            del self._states[session_id]
            return True
        return False

    def list_sessions(self) -> List[str]:
        """列出所有会话"""
        return list(self._states.keys())


# ============ 便捷函数 ============

def get_default_plan_act_mode(
    architect_agent: Optional[Any] = None,
    writer_agent: Optional[Any] = None,
    critic_agent: Optional[Any] = None
) -> PlanActMode:
    """获取预配置的 Plan-Act 模式"""
    return PlanActMode(
        architect_agent=architect_agent,
        writer_agent=writer_agent,
        critic_agent=critic_agent,
        quality_threshold=0.7,
        max_iterations=3
    )
