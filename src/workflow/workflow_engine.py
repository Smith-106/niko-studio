"""
工作流引擎 - L1-L5 五级模式 + Plan-Act + Checkpoint

核心特性:
1. 任务路由 (自动识别复杂度)
2. Plan-Act 模式 (规划与执行分离)
3. Git-based 检查点管理
4. 状态追踪
"""

import json
import logging
import re
import uuid
import hashlib
import copy
import asyncio
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

from src.workflow.levels.types import (
    WorkflowLevel,
    WorkflowDecision,
    LevelRouter,
    to_workflow_label,
    to_workflow_slug,
    ensure_contract_payload,
)
from src.workflow.session.session_manager import SessionManager, ContentType

logger = logging.getLogger("niko-workflow")


TEMPLATE_METADATA_MAP: Dict[WorkflowLevel, Dict[str, Any]] = {
    WorkflowLevel.L1_RAPID: {
        "level": "L1",
        "scene": "quick_reply",
        "risk": "low",
        "gate_profile": "rapid-soft",
    },
    WorkflowLevel.L2_LITE: {
        "level": "L2",
        "scene": "single_turn",
        "risk": "low",
        "gate_profile": "lite-soft",
    },
    WorkflowLevel.L3_STANDARD: {
        "level": "L3",
        "scene": "chapter",
        "risk": "medium",
        "gate_profile": "standard-soft",
    },
    WorkflowLevel.L4_BRAINSTORM: {
        "level": "L4",
        "scene": "brainstorm",
        "risk": "medium",
        "gate_profile": "brainstorm-soft",
    },
    WorkflowLevel.L5_COORDINATOR: {
        "level": "L5",
        "scene": "coordinator",
        "risk": "high",
        "gate_profile": "coordinator-soft",
    },
}

RUNNER_ALLOWED_TRANSITIONS = {
    "pending": {"running", "stopped"},
    "running": {"paused", "stopped"},
    "paused": {"running", "stopped"},
    "stopped": set(),
}

RUNNER_TO_SESSION_STATUS = {
    "running": "active",
    "paused": "checkpointed",
    "stopped": "archived",
}

STEP_ALLOWED_TRANSITIONS = {
    "planned": {"executing", "failed"},
    "executing": {"review", "failed"},
    "review": {"test", "failed"},
    "test": {"done", "failed"},
    "done": set(),
    "failed": set(),
}

STEP_LEGACY_TO_CANONICAL = {
    "pending": "planned",
    "running": "executing",
    "completed": "done",
}

MAINTENANCE_TO_SESSION_STATUS = {
    "running": "active",
    "paused": "checkpointed",
    "stopped": "active",
}

DESTRUCTIVE_STEP_NAMES = {"revise", "checkpoint", "final_review"}
AUTO_ROLLBACK_CONFIRM_TOKEN = "__auto_rollback__"
RECOVERY_CHAIN_STEPS = ("analyze-with-file", "plan", "plan-verify", "execute")
OBSERVABILITY_MODES = ("Autopilot", "Team", "Pipeline/Ralph")
ECO_MODE_LABEL = "EcoMode"

WAVE6_BUDGET_GUARDRAIL = {
    "token_budget": 2400,
    "time_budget_minutes": 20.0,
}


@dataclass
class WorkflowStep:
    """工作流步骤"""
    id: str
    name: str
    description: str
    status: str = "planned"  # planned/executing/review/test/done/failed
    dependencies: List[str] = field(default_factory=list)
    output: Any = None
    started_at: str = None
    completed_at: str = None


@dataclass
class WorkflowPlan:
    """工作流计划"""
    id: str
    task: str
    level: str
    steps: List[WorkflowStep] = field(default_factory=list)
    status: str = "created"  # created/running/completed/failed
    runner_state: str = "pending"  # pending/running/paused/stopped
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: str = None
    template_meta: Dict[str, Any] = field(default_factory=dict)
    gate_decision: str = WorkflowDecision.GO.value
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    recommendations_frozen: bool = False
    plan_hash: str = ""
    lane: str = "default"
    quality_metrics: Dict[str, float] = field(default_factory=dict)
    observability: Dict[str, Any] = field(default_factory=dict)
    budget_guardrail: Dict[str, Any] = field(default_factory=dict)
    handoff_package: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Checkpoint:
    """检查点"""
    id: str
    description: str
    commit_hash: str = None
    plan_id: str = None
    step_id: str = None
    replay_payload: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class WorkflowEngine:
    """工作流引擎"""

    def _with_contract(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return ensure_contract_payload(payload)

    def _recommended_modules_for_step(self, plan: WorkflowPlan, step: WorkflowStep) -> List[str]:
        modules = [f"workflow:{step.name}"]
        if plan.lane == "maintenance":
            modules.append("workflow:maintenance")
        for item in plan.recommendations or []:
            action = str(item.get("action") or "").strip().lower()
            if action.startswith("module:"):
                module_name = action.split(":", 1)[1].strip()
                if module_name:
                    modules.append(f"module:{module_name}")
        return sorted(set(modules))

    def _conflicting_modules(self, plan: WorkflowPlan, step: WorkflowStep) -> List[str]:
        requested = self._recommended_modules_for_step(plan, step)
        conflicts = []
        for module in requested:
            owner = self._module_owners.get(module)
            if owner and owner != plan.id:
                conflicts.append(module)
        return conflicts

    async def _ensure_module_locks(self, modules: List[str]) -> None:
        async with self._module_lock_guard:
            for module in modules:
                if module not in self._module_locks:
                    self._module_locks[module] = asyncio.Lock()

    async def _acquire_module_ownership(self, plan: WorkflowPlan, step: WorkflowStep) -> Dict[str, Any]:
        requested = self._recommended_modules_for_step(plan, step)
        if not requested:
            return {"requested": [], "serialized": False, "conflicts": [], "ownership": []}

        await self._ensure_module_locks(requested)

        for module in requested:
            await self._module_locks[module].acquire()

        ownership = []
        serialized = False
        conflicts = []
        try:
            for module in requested:
                owner = self._module_owners.get(module)
                ownership.append({"module": module, "previous_owner": owner, "owner": plan.id})
                if owner and owner != plan.id:
                    serialized = True
                    conflicts.append(module)
                self._module_owners[module] = plan.id

            lock_payload = {
                "step_id": step.id,
                "step_name": step.name,
                "requested_modules": requested,
                "conflicts": conflicts,
                "serialized": serialized,
                "owner": plan.id,
            }
            self._append_audit_event(plan, "module_lock_acquired", lock_payload)
            if serialized:
                self._append_audit_event(
                    plan,
                    "module_conflict_serialized",
                    {
                        "step_id": step.id,
                        "step_name": step.name,
                        "conflicts": conflicts,
                        "owner": plan.id,
                        "policy": "independent-only",
                    },
                )
            return {
                "requested": requested,
                "serialized": serialized,
                "conflicts": conflicts,
                "ownership": ownership,
            }
        except Exception:
            for module in requested:
                lock = self._module_locks.get(module)
                if lock and lock.locked():
                    lock.release()
            raise

    def _release_module_ownership(self, plan: WorkflowPlan, step: WorkflowStep, lock_context: Dict[str, Any]) -> None:
        requested = lock_context.get("requested", [])
        released = []
        for module in requested:
            current_owner = self._module_owners.get(module)
            if current_owner == plan.id:
                self._module_owners.pop(module, None)
            lock = self._module_locks.get(module)
            if lock and lock.locked():
                lock.release()
            released.append(module)

        if released:
            self._append_audit_event(
                plan,
                "module_lock_released",
                {
                    "step_id": step.id,
                    "step_name": step.name,
                    "released_modules": released,
                    "owner": plan.id,
                },
            )

    def _resolve_template_meta(self, level: WorkflowLevel) -> Dict[str, Any]:
        return dict(TEMPLATE_METADATA_MAP.get(level, TEMPLATE_METADATA_MAP[WorkflowLevel.L3_STANDARD]))

    def _create_observability_baseline(self) -> Dict[str, Any]:
        return {
            "wave": 5,
            "mode": OBSERVABILITY_MODES[0],
            "upgrade_target": OBSERVABILITY_MODES[0],
            "upgrade_reason": "baseline",
            "mode_changed": False,
            "threshold_triggered": False,
            "aggregate": {
                "completed_steps": 0,
                "failed_steps": 0,
                "retry_count": 0,
                "convergence_rounds": 0,
                "mttr": 0.0,
                "completion_rate": 0.0,
                "failure_rate": 0.0,
            },
        }

    def _calculate_observability_aggregate(self, plan: WorkflowPlan) -> Dict[str, Any]:
        completed_steps = sum(1 for step in plan.steps if self._canonical_step_status(step.status) == "done")
        failed_steps = sum(1 for step in plan.steps if self._canonical_step_status(step.status) == "failed")
        total_steps = len(plan.steps) or 1

        now = datetime.now()
        created_at = datetime.fromisoformat(plan.created_at)
        minutes_since_create = max((now - created_at).total_seconds() / 60.0, 0.0)
        mttr = round(minutes_since_create / max(failed_steps, 1), 2) if failed_steps else 0.0

        completion_rate = round((completed_steps / total_steps) * 100, 2)
        failure_rate = round((failed_steps / total_steps) * 100, 2)
        retry_count = max(0, failed_steps - 1)
        convergence_rounds = completed_steps + retry_count

        return {
            "completed_steps": completed_steps,
            "failed_steps": failed_steps,
            "retry_count": retry_count,
            "convergence_rounds": convergence_rounds,
            "mttr": mttr,
            "completion_rate": completion_rate,
            "failure_rate": failure_rate,
        }

    def _resolve_observability_mode(self, aggregate: Dict[str, Any]) -> Dict[str, Any]:
        completion_rate = float(aggregate.get("completion_rate", 0.0))
        failure_rate = float(aggregate.get("failure_rate", 0.0))
        retry_count = int(aggregate.get("retry_count", 0))
        convergence_rounds = int(aggregate.get("convergence_rounds", 0))
        mttr = float(aggregate.get("mttr", 0.0))

        if failure_rate >= 20.0 or retry_count >= 3 or mttr >= 20.0:
            return {
                "mode": OBSERVABILITY_MODES[2],
                "threshold_triggered": True,
                "reason": "failure/retry/mttr threshold breached",
            }

        if completion_rate < 80.0 or convergence_rounds >= 5:
            return {
                "mode": OBSERVABILITY_MODES[1],
                "threshold_triggered": True,
                "reason": "completion/convergence threshold breached",
            }

        return {
            "mode": OBSERVABILITY_MODES[0],
            "threshold_triggered": False,
            "reason": "within autopilot threshold",
        }

    def _refresh_observability(self, plan: WorkflowPlan) -> Dict[str, Any]:
        current = dict(plan.observability or self._create_observability_baseline())
        aggregate = self._calculate_observability_aggregate(plan)
        mode_resolution = self._resolve_observability_mode(aggregate)

        previous_mode = current.get("mode", OBSERVABILITY_MODES[0])
        next_mode = mode_resolution["mode"]
        mode_changed = previous_mode != next_mode

        current["mode"] = next_mode
        current["upgrade_target"] = next_mode
        current["upgrade_reason"] = mode_resolution["reason"]
        current["mode_changed"] = mode_changed
        current["threshold_triggered"] = mode_resolution["threshold_triggered"]
        current["aggregate"] = aggregate

        plan.observability = current
        plan.template_meta["execution_mode"] = next_mode
        plan.template_meta["observability_wave"] = 5
        return current

    def _create_handoff_package(self, plan: WorkflowPlan, trigger: str) -> Dict[str, Any]:
        pending_steps = [
            {
                "id": step.id,
                "name": step.name,
                "status": self._canonical_step_status(step.status),
            }
            for step in plan.steps
            if self._canonical_step_status(step.status) != "done"
        ]
        blocked_by = [
            step["id"]
            for step in pending_steps
            if step.get("status") == "failed"
        ]
        next_command = f"workflow_execute(plan_id='{plan.id}')"
        handoff = {
            "generated_at": datetime.now().isoformat(),
            "trigger": trigger,
            "plan_id": plan.id,
            "status": plan.status,
            "runner_state": plan.runner_state,
            "execution_mode": plan.template_meta.get("execution_mode", OBSERVABILITY_MODES[0]),
            "pending_steps": pending_steps,
            "blocked_by": blocked_by,
            "next_command": next_command,
        }
        plan.handoff_package = handoff
        return handoff

    def _persist_handoff_package(self, plan: WorkflowPlan, trigger: str) -> Dict[str, Any]:
        handoff = self._create_handoff_package(plan, trigger)
        lines = [
            f"# Handoff Package ({trigger})",
            "",
            f"- plan_id: {handoff['plan_id']}",
            f"- status: {handoff['status']}",
            f"- runner_state: {handoff['runner_state']}",
            f"- execution_mode: {handoff['execution_mode']}",
            f"- generated_at: {handoff['generated_at']}",
            "",
            "## Pending Steps",
        ]
        if handoff["pending_steps"]:
            lines.extend(
                [f"- {step['id']} | {step['name']} | {step['status']}" for step in handoff["pending_steps"]]
            )
        else:
            lines.append("- (none)")

        lines.extend([
            "",
            "## Blocked",
        ])
        if handoff["blocked_by"]:
            lines.extend([f"- {item}" for item in handoff["blocked_by"]])
        else:
            lines.append("- (none)")

        lines.extend([
            "",
            "## Next Command",
            f"- {handoff['next_command']}",
            "",
        ])

        self.session_manager.write(
            session_id=self._session_id_for_plan(plan.id),
            content_type=ContentType.HANDOFF,
            content="\n".join(lines),
        )
        self._append_audit_event(
            plan,
            "handoff_package_generated",
            {
                "trigger": trigger,
                "pending_count": len(handoff["pending_steps"]),
                "blocked_count": len(handoff["blocked_by"]),
                "next_command": handoff["next_command"],
            },
        )
        return handoff

    def _create_budget_guardrail_baseline(self) -> Dict[str, Any]:
        return {
            "token_budget": int(WAVE6_BUDGET_GUARDRAIL["token_budget"]),
            "time_budget_minutes": float(WAVE6_BUDGET_GUARDRAIL["time_budget_minutes"]),
            "token_used": 0,
            "elapsed_minutes": 0.0,
            "threshold_triggered": False,
            "degraded": False,
            "degrade_mode": "",
            "reason": "within budget",
        }

    def _estimate_plan_tokens(self, plan: WorkflowPlan) -> int:
        step_tokens = sum(len(step.description or "") for step in plan.steps)
        recommendation_tokens = sum(
            len((item.get("title") or "")) + len((item.get("action") or ""))
            for item in (plan.recommendations or [])
        )
        return len(plan.task or "") + step_tokens + recommendation_tokens

    def _refresh_budget_guardrail(self, plan: WorkflowPlan) -> Dict[str, Any]:
        current = dict(plan.budget_guardrail or self._create_budget_guardrail_baseline())
        token_budget = int(current.get("token_budget", WAVE6_BUDGET_GUARDRAIL["token_budget"]))
        time_budget = float(current.get("time_budget_minutes", WAVE6_BUDGET_GUARDRAIL["time_budget_minutes"]))

        token_used = self._estimate_plan_tokens(plan)
        created_at = datetime.fromisoformat(plan.created_at)
        elapsed_minutes = round(max((datetime.now() - created_at).total_seconds() / 60.0, 0.0), 2)

        over_budget = token_used >= token_budget or elapsed_minutes >= time_budget
        degrade_mode = ECO_MODE_LABEL if over_budget else ""
        reason = "budget threshold breached" if over_budget else "within budget"

        current.update(
            {
                "token_budget": token_budget,
                "time_budget_minutes": time_budget,
                "token_used": token_used,
                "elapsed_minutes": elapsed_minutes,
                "threshold_triggered": over_budget,
                "degraded": over_budget,
                "degrade_mode": degrade_mode,
                "reason": reason,
            }
        )

        plan.budget_guardrail = current
        if over_budget:
            plan.template_meta["execution_mode"] = ECO_MODE_LABEL
        return current

    def _resolve_execution_mode(self, plan: WorkflowPlan, observability_mode: str) -> str:
        if (plan.budget_guardrail or {}).get("degraded"):
            return ECO_MODE_LABEL
        return observability_mode

    def _build_quality_metrics(self, task: str) -> Dict[str, float]:
        task_length = len(task or "")
        pass_rate = 92.0 if task_length < 80 else 86.0
        risk_score = 0.82 if re.search(r"维护|maintenance|回收|修复", task or "", re.IGNORECASE) else 0.38
        recovery_latency = 280.0 if task_length >= 100 else 120.0
        return {
            "pass_rate": round(pass_rate, 2),
            "risk_score": round(risk_score, 2),
            "recovery_latency": round(recovery_latency, 2),
        }

        task_length = len(task or "")
        pass_rate = 92.0 if task_length < 80 else 86.0
        risk_score = 0.82 if re.search(r"维护|maintenance|回收|修复", task or "", re.IGNORECASE) else 0.38
        recovery_latency = 280.0 if task_length >= 100 else 120.0
        return {
            "pass_rate": round(pass_rate, 2),
            "risk_score": round(risk_score, 2),
            "recovery_latency": round(recovery_latency, 2),
        }

    def _determine_lane(self, metrics: Dict[str, float]) -> str:
        if (
            metrics.get("risk_score", 0.0) >= 0.75
            or metrics.get("recovery_latency", 0.0) >= 240.0
            or metrics.get("pass_rate", 100.0) < 88.0
        ):
            return "maintenance"
        return "default"

    def _resolve_adaptive_level(self, level: WorkflowLevel, lane: str, metrics: Dict[str, float]) -> WorkflowLevel:
        if lane != "maintenance":
            return level

        pass_rate = metrics.get("pass_rate", 100.0)
        risk_score = metrics.get("risk_score", 0.0)
        recovery_latency = metrics.get("recovery_latency", 0.0)

        if risk_score >= 0.9 or pass_rate < 80.0:
            return WorkflowLevel.L5_COORDINATOR
        if risk_score >= 0.75 or recovery_latency >= 240.0:
            return WorkflowLevel.L4_BRAINSTORM
        if pass_rate < 88.0:
            return WorkflowLevel.L3_STANDARD
        return level

    def _resolve_gate_profile(self, level: WorkflowLevel, lane: str, metrics: Dict[str, float]) -> str:
        if lane == "maintenance":
            if metrics.get("risk_score", 0.0) >= 0.9:
                return "maintenance-hard"
            if metrics.get("risk_score", 0.0) >= 0.75 or metrics.get("recovery_latency", 0.0) >= 240.0:
                return "maintenance-selective-hard"
            return "maintenance-soft"

        return self._resolve_template_meta(level).get("gate_profile", "default-soft")

    def _get_level_indicators(self) -> Dict[WorkflowLevel, List[str]]:
        return {
            WorkflowLevel.L1_RAPID: ["回答", "解释", "什么是", "告诉我", "简单"],
            WorkflowLevel.L2_LITE: ["写一段", "描写", "生成段落", "扩写"],
            WorkflowLevel.L3_STANDARD: ["写一章", "创作章节", "完成场景", "第.*章"],
            WorkflowLevel.L4_BRAINSTORM: ["连续写", "多章", "接着写", "继续"],
            WorkflowLevel.L5_COORDINATOR: ["规划全书", "大纲", "整体设计", "完整故事"],
        }

    def __init__(self, workspace: str = None):
        self.workspace = Path(workspace) if workspace else Path.cwd()
        self.plans: Dict[str, WorkflowPlan] = {}
        self.checkpoints: Dict[str, Checkpoint] = {}
        self.plan_sessions: Dict[str, str] = {}
        self.router = LevelRouter()
        self.session_manager = SessionManager(base_path=str(self.workspace / ".writing" / "sessions"))
        self._module_locks: Dict[str, asyncio.Lock] = {}
        self._module_lock_guard = asyncio.Lock()
        self._module_owners: Dict[str, str] = {}

        logger.info(f"Workflow engine initialized: {self.workspace}")

    def _session_id_for_plan(self, plan_id: str) -> str:
        return self.plan_sessions.setdefault(plan_id, f"workflow-{plan_id}")

    def _sync_session_lifecycle(self, plan: WorkflowPlan, checkpoint_id: str = None) -> Dict[str, Any]:
        session_id = self._session_id_for_plan(plan.id)
        status_map = MAINTENANCE_TO_SESSION_STATUS if plan.lane == "maintenance" else RUNNER_TO_SESSION_STATUS
        return self.session_manager.sync_lifecycle(
            session_id=session_id,
            runner_state=plan.runner_state,
            checkpoint_id=checkpoint_id,
            status_map=status_map,
        )

    def _resolve_lane_status_map(self, plan: WorkflowPlan) -> Dict[str, str]:
        return MAINTENANCE_TO_SESSION_STATUS if plan.lane == "maintenance" else RUNNER_TO_SESSION_STATUS

    def _append_audit_event(self, plan: WorkflowPlan, event_type: str, payload: Dict[str, Any]) -> None:
        session_id = self._session_id_for_plan(plan.id)
        event = {
            "ts": datetime.now().isoformat(),
            "event_type": event_type,
            "plan_id": plan.id,
            "payload": payload,
        }
        self.session_manager.append_audit(session_id=session_id, event=event)

    def _checkpoint_trace_for_plan(self, plan: WorkflowPlan) -> List[Dict[str, Any]]:
        trace: List[Dict[str, Any]] = []
        for cp in sorted(
            (c for c in self.checkpoints.values() if c.plan_id == plan.id),
            key=lambda c: c.created_at,
        ):
            trace.append(
                {
                    "checkpoint_id": cp.id,
                    "step_id": cp.step_id,
                    "description": cp.description,
                    "created_at": cp.created_at,
                }
            )
        return trace

    def _persist_plan_state(
        self,
        plan: WorkflowPlan,
        current_phase: Optional[str] = None,
        checkpoint_id: Optional[str] = None,
        recovery_envelope: Optional[Dict[str, Any]] = None,
    ) -> None:
        session_id = self._session_id_for_plan(plan.id)
        existing_phase = None
        existing_checkpoint_id = ""
        existing_recovery = None
        existing_payload = self.session_manager.read(session_id=session_id, content_type=ContentType.STATE)
        if existing_payload:
            try:
                existing_state = json.loads(existing_payload)
                existing_phase = existing_state.get("current_phase")
                existing_checkpoint_id = existing_state.get("last_checkpoint_id", "")
                recovery_candidate = existing_state.get("recovery")
                if isinstance(recovery_candidate, dict):
                    existing_recovery = recovery_candidate
            except json.JSONDecodeError:
                existing_phase = None
                existing_checkpoint_id = ""
                existing_recovery = None

        phase = current_phase or existing_phase or plan.status
        last_checkpoint_id = checkpoint_id if checkpoint_id is not None else existing_checkpoint_id
        updated_at = datetime.now().isoformat()
        state_payload = {
            "plan_id": plan.id,
            "task": plan.task,
            "level": plan.level,
            "plan_status": plan.status,
            "runner_state": plan.runner_state,
            "current_phase": phase,
            "last_checkpoint_id": last_checkpoint_id,
            "state_trace_id": f"{plan.id}:{updated_at}",
            "updated_at": updated_at,
            "observability": plan.observability,
            "budget_guardrail": plan.budget_guardrail,
            "handoff_package": plan.handoff_package,
            "steps": [
                {
                    "id": step.id,
                    "name": step.name,
                    "status": self._canonical_step_status(step.status),
                    "started_at": step.started_at,
                    "completed_at": step.completed_at,
                }
                for step in plan.steps
            ],
            "checkpoint_trace": self._checkpoint_trace_for_plan(plan),
        }
        next_recovery = recovery_envelope if recovery_envelope is not None else existing_recovery
        if isinstance(next_recovery, dict):
            state_payload["recovery"] = next_recovery
        self.session_manager.write(
            session_id=session_id,
            content_type=ContentType.STATE,
            content=json.dumps(state_payload, ensure_ascii=False, indent=2),
        )

    def _state_resume_metadata(self, plan: WorkflowPlan) -> Dict[str, Any]:
        session_id = self._session_id_for_plan(plan.id)
        payload_raw = self.session_manager.read(session_id=session_id, content_type=ContentType.STATE)

        if not payload_raw:
            return {
                "current_phase": plan.status,
                "state_trace_id": "",
                "can_resume_from_checkpoint": False,
                "recovery": {},
                "observability": plan.observability,
                "budget_guardrail": plan.budget_guardrail,
                "handoff_package": plan.handoff_package,
            }

        try:
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            return {
                "current_phase": plan.status,
                "state_trace_id": "",
                "can_resume_from_checkpoint": False,
                "recovery": {},
                "observability": plan.observability,
                "budget_guardrail": plan.budget_guardrail,
                "handoff_package": plan.handoff_package,
            }

        recovery = payload.get("recovery")
        if not isinstance(recovery, dict):
            recovery = {}

        return {
            "current_phase": payload.get("current_phase", plan.status),
            "state_trace_id": payload.get("state_trace_id", ""),
            "can_resume_from_checkpoint": bool(payload.get("last_checkpoint_id")),
            "recovery": recovery,
            "observability": payload.get("observability", plan.observability),
            "budget_guardrail": payload.get("budget_guardrail", plan.budget_guardrail),
            "handoff_package": payload.get("handoff_package", plan.handoff_package),
        }

    def _canonical_step_status(self, status: str) -> str:
        return STEP_LEGACY_TO_CANONICAL.get(status, status)

    def _remaining_steps(self, plan: WorkflowPlan) -> int:
        return sum(1 for s in plan.steps if self._canonical_step_status(s.status) != "done")

    def _transition_step_state(self, plan: WorkflowPlan, step: WorkflowStep, target_status: str, reason: str) -> None:
        current = self._canonical_step_status(step.status)
        target = self._canonical_step_status(target_status)

        allowed = STEP_ALLOWED_TRANSITIONS.get(current, set())
        if target != current and target not in allowed:
            self._append_audit_event(
                plan,
                "step_state_transition_rejected",
                {
                    "step_id": step.id,
                    "step_name": step.name,
                    "from": current,
                    "to": target,
                    "reason": reason,
                },
            )
            raise ValueError(f"Invalid step transition: {current} -> {target}")

        now = datetime.now().isoformat()
        step.status = target
        if target == "executing" and not step.started_at:
            step.started_at = now
        if target in {"done", "failed"}:
            step.completed_at = now

        phase_by_state = {
            "planned": "planned",
            "executing": "executing",
            "review": "review",
            "test": "test",
            "done": "done",
            "failed": "failed",
        }

        self._append_audit_event(
            plan,
            "step_state_transition",
            {
                "step_id": step.id,
                "step_name": step.name,
                "from": current,
                "to": target,
                "reason": reason,
            },
        )
        self._persist_plan_state(plan, current_phase=phase_by_state[target])

    def _has_valid_confirm_token(self, confirm_token: Optional[str]) -> bool:
        return isinstance(confirm_token, str) and bool(confirm_token.strip())

    def _redacted_confirm_token(self, confirm_token: Optional[str]) -> Optional[str]:
        if not self._has_valid_confirm_token(confirm_token):
            return None
        return "<provided>"

    def _is_destructive_step(self, step: WorkflowStep, recommendations: Optional[List[Dict[str, Any]]] = None) -> bool:
        destructive_tokens = ("overwrite", "delete", "remove", "destructive", "覆盖", "删除", "移除", "破坏")
        if step.name in DESTRUCTIVE_STEP_NAMES:
            return True
        for item in recommendations or []:
            action = str(item.get("action") or "").lower()
            title = str(item.get("title") or "").lower()
            if any(token in action for token in destructive_tokens):
                return True
            if any(token in title for token in destructive_tokens):
                return True
        return False

    def _evaluate_risk_gate(
        self,
        level: WorkflowLevel,
        step: WorkflowStep,
        recommendations: Optional[List[Dict[str, Any]]] = None,
        confirm_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        template_meta = self._resolve_template_meta(level)
        risk = template_meta.get("risk", "low")

        needs_soft_review = step.name in {"checkpoint", "final_review"} and risk in {"medium", "high"}
        destructive = self._is_destructive_step(step, recommendations)

        if destructive:
            confirmed = self._has_valid_confirm_token(confirm_token)
            decision = WorkflowDecision.GO if confirmed else WorkflowDecision.NO_GO
            reason = (
                "destructive write confirmed, hard gate passed"
                if confirmed
                else "destructive write requires secondary confirmation"
            )
            confirm_required = True
            blocking = not confirmed
            gate_profile = "selective-hard"
        elif needs_soft_review:
            decision = WorkflowDecision.SOFT_GO
            reason = f"{step.name} requires soft gate review under {risk} risk"
            confirm_required = False
            confirmed = True
            blocking = False
            gate_profile = template_meta.get("gate_profile", "default-soft")
        else:
            decision = WorkflowDecision.GO
            reason = "soft gate passed"
            confirm_required = False
            confirmed = True
            blocking = False
            gate_profile = template_meta.get("gate_profile", "default-soft")

        return {
            "decision": decision.value,
            "reason": reason,
            "risk": "high" if destructive else risk,
            "gate_profile": gate_profile,
            "blocking": blocking,
            "destructive": destructive,
            "confirm_required": confirm_required,
            "confirm_token": self._redacted_confirm_token(confirm_token),
            "confirmed": confirmed,
        }

    def _build_plan_replay_payload(self, plan: WorkflowPlan) -> Dict[str, Any]:
        return {
            "plan_id": plan.id,
            "plan_hash": plan.plan_hash or self._compute_plan_hash(plan),
            "recommendations": copy.deepcopy(plan.recommendations),
            "recommendations_frozen": plan.recommendations_frozen,
        }

    def _load_recovery_envelope(self, plan: WorkflowPlan) -> Optional[Dict[str, Any]]:
        session_id = self._session_id_for_plan(plan.id)
        payload_raw = self.session_manager.read(session_id=session_id, content_type=ContentType.STATE)
        if not payload_raw:
            return None

        try:
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            return None

        recovery = payload.get("recovery")
        return recovery if isinstance(recovery, dict) else None

    def _build_recovery_envelope(
        self,
        plan: WorkflowPlan,
        failure_phase: str,
        failure_reason: str,
        failed_step_id: Optional[str],
        checkpoint_id: Optional[str],
        recovery_checkpoint_id: Optional[str],
    ) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        recovery_id = str(uuid.uuid4())[:8]

        steps = []
        for index, name in enumerate(RECOVERY_CHAIN_STEPS):
            status = "done" if index < len(RECOVERY_CHAIN_STEPS) - 1 else "pending"
            steps.append(
                {
                    "name": name,
                    "status": status,
                    "started_at": now,
                    "completed_at": now if status == "done" else None,
                }
            )

        return {
            "recovery_id": recovery_id,
            "status": "awaiting_execute",
            "current_index": len(RECOVERY_CHAIN_STEPS) - 1,
            "current_step": RECOVERY_CHAIN_STEPS[-1],
            "chain": steps,
            "failure": {
                "phase": failure_phase,
                "reason": failure_reason,
                "step_id": failed_step_id,
                "checkpoint_id": checkpoint_id,
            },
            "recovery_checkpoint_id": recovery_checkpoint_id or "",
            "resume_ready": True,
            "updated_at": now,
        }

    async def _trigger_recovery_chain(
        self,
        plan: WorkflowPlan,
        failure_phase: str,
        failure_reason: str,
        failed_step_id: Optional[str] = None,
        checkpoint_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self._load_recovery_envelope(plan)
        if existing and existing.get("status") in {"awaiting_execute", "running", "pending"}:
            self._append_audit_event(
                plan,
                "recovery_chain_resume",
                {
                    "recovery_id": existing.get("recovery_id"),
                    "current_step": existing.get("current_step"),
                    "status": existing.get("status"),
                },
            )
            return existing

        recovery_checkpoint = await self.create_checkpoint(
            description=f"recovery-entry:{plan.id}",
            auto_commit=False,
            plan_id=plan.id,
            step_id=failed_step_id,
            replay_payload=self._build_plan_replay_payload(plan),
        )
        recovery_checkpoint_id = recovery_checkpoint.get("checkpoint_id")

        envelope = self._build_recovery_envelope(
            plan=plan,
            failure_phase=failure_phase,
            failure_reason=failure_reason,
            failed_step_id=failed_step_id,
            checkpoint_id=checkpoint_id,
            recovery_checkpoint_id=recovery_checkpoint_id,
        )

        self._append_audit_event(
            plan,
            "recovery_chain_started",
            {
                "recovery_id": envelope["recovery_id"],
                "failure": envelope["failure"],
                "recovery_checkpoint_id": recovery_checkpoint_id,
            },
        )

        for item in envelope["chain"]:
            self._append_audit_event(
                plan,
                "recovery_chain_step",
                {
                    "recovery_id": envelope["recovery_id"],
                    "step": item["name"],
                    "status": item["status"],
                },
            )

        self._append_audit_event(
            plan,
            "recovery_chain_ready",
            {
                "recovery_id": envelope["recovery_id"],
                "current_step": envelope["current_step"],
                "resume_ready": envelope["resume_ready"],
            },
        )

        self._persist_plan_state(plan, current_phase="recovery", recovery_envelope=envelope)
        return envelope

    def _is_wave_gate_required(self, plan: WorkflowPlan) -> bool:
        if bool(plan.template_meta.get("gate_required", False)):
            return True

        for item in plan.recommendations or []:
            action = str(item.get("action", "")).lower()
            if "require_wave_gate" in action:
                return True

        return False

    async def _run_wave_gate_orchestration(self, plan: WorkflowPlan) -> Dict[str, Any]:
        required = self._is_wave_gate_required(plan)
        if not required:
            return {"required": False, "passed": True, "trace": []}

        recommendations = plan.recommendations or []
        force_fail = any("force_gate_fail" in str(item.get("action", "")) for item in recommendations)

        metrics = plan.quality_metrics or {}
        gates = [
            {
                "name": "review-session-cycle",
                "passed": not force_fail and float(metrics.get("risk_score", 1.0)) <= 0.85,
                "reason": "risk score within review threshold",
            },
            {
                "name": "test-fix-gen",
                "passed": not force_fail and float(metrics.get("pass_rate", 0.0)) >= 85.0,
                "reason": "pass rate satisfies fix generation threshold",
            },
            {
                "name": "test-cycle-execute",
                "passed": not force_fail and float(metrics.get("recovery_latency", 9999.0)) <= 300.0,
                "reason": "recovery latency within execution threshold",
            },
        ]

        trace = []
        failed_gate = None
        for gate in gates:
            trace.append(
                {
                    "name": gate["name"],
                    "passed": gate["passed"],
                    "reason": gate["reason"],
                }
            )
            if not gate["passed"]:
                failed_gate = gate["name"]
                break

        return {
            "required": True,
            "passed": failed_gate is None,
            "failed_gate": failed_gate,
            "trace": trace,
        }

    async def _create_rollback_checkpoint(self, plan: WorkflowPlan, step: WorkflowStep) -> str:
        checkpoint = await self.create_checkpoint(
            description=f"destructive-precheck:{plan.id}:{step.id}",
            auto_commit=False,
            plan_id=plan.id,
            step_id=step.id,
            replay_payload=self._build_plan_replay_payload(plan),
        )
        return checkpoint.get("checkpoint_id")

    async def quick_rollback(self, plan_id: str, checkpoint_id: str, reason: str = "") -> Dict[str, Any]:
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}

        plan = self.plans[plan_id]
        restore_result = await self.restore_checkpoint(
            checkpoint_id,
            confirm_token=AUTO_ROLLBACK_CONFIRM_TOKEN,
        )

        self._append_audit_event(
            plan,
            "rollback_trace",
            {
                "reason": reason,
                "checkpoint_id": checkpoint_id,
                "restore_status": restore_result.get("status", "error"),
                "restore_error": restore_result.get("error"),
            },
        )

        return {
            "plan_id": plan_id,
            "checkpoint_id": checkpoint_id,
            "restored": restore_result.get("status") == "restored" or bool(restore_result.get("replay", {}).get("applied")),
            "restore": restore_result,
        }

    def _set_runner_state(self, plan: WorkflowPlan, target_state: str, checkpoint_id: Optional[str] = None) -> Dict[str, Any]:
        current_state = plan.runner_state
        allowed = RUNNER_ALLOWED_TRANSITIONS.get(current_state, set())
        if target_state != current_state and target_state not in allowed:
            raise ValueError(f"Invalid runner transition: {current_state} -> {target_state}")

        plan.runner_state = target_state
        session_state = self._sync_session_lifecycle(plan, checkpoint_id=checkpoint_id)

        if target_state == "running" and plan.status == "created":
            plan.status = "running"
        if target_state == "stopped" and plan.status not in {"completed", "failed"}:
            plan.status = "failed"

        return session_state

    def _canonicalize_recommendations(self, recommendations: Optional[List[Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for index, raw in enumerate(recommendations or []):
            if isinstance(raw, dict):
                title = str(raw.get("title") or raw.get("name") or raw.get("recommendation") or "").strip()
                reason = str(raw.get("reason") or raw.get("rationale") or "").strip()
                action = str(raw.get("action") or raw.get("suggestion") or title or "").strip()
                if not action:
                    action = f"recommendation-{index + 1}"
            else:
                text = str(raw).strip()
                if not text:
                    continue
                title = text
                reason = ""
                action = text

            normalized.append({
                "id": f"rec-{index + 1:02d}",
                "title": title,
                "reason": reason,
                "action": action,
                "index": index,
            })

        return normalized

    def _compute_plan_hash(self, plan: WorkflowPlan) -> str:
        payload = {
            "task": plan.task,
            "level": plan.level,
            "steps": [
                {
                    "name": step.name,
                    "description": step.description,
                    "dependencies": list(step.dependencies),
                }
                for step in plan.steps
            ],
            "template_meta": plan.template_meta,
            "recommendations": [
                {
                    "id": item.get("id"),
                    "title": item.get("title", ""),
                    "reason": item.get("reason", ""),
                    "action": item.get("action", ""),
                    "index": item.get("index"),
                }
                for item in plan.recommendations
            ],
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def _freeze_recommendations(self, plan: WorkflowPlan) -> None:
        if plan.recommendations_frozen:
            return
        plan.recommendations = copy.deepcopy(plan.recommendations)
        plan.recommendations_frozen = True

    def _apply_replay_payload(self, checkpoint: Checkpoint) -> Dict[str, Any]:
        payload = checkpoint.replay_payload or {}
        if not payload:
            return {"applied": False, "reason": "no_replay_payload"}

        plan_id = payload.get("plan_id") or checkpoint.plan_id
        if not plan_id:
            return {"applied": False, "reason": "no_plan_id"}

        plan = self.plans.get(plan_id)
        if not plan:
            return {"applied": False, "reason": f"plan_not_found:{plan_id}"}

        expected_hash = payload.get("plan_hash")
        if expected_hash:
            current_hash = self._compute_plan_hash(plan)
            if current_hash != expected_hash:
                return {
                    "applied": False,
                    "reason": "plan_hash_mismatch",
                    "expected_plan_hash": expected_hash,
                    "current_plan_hash": current_hash,
                }

        replay_recommendations = self._canonicalize_recommendations(payload.get("recommendations"))
        plan.recommendations = replay_recommendations
        plan.recommendations_frozen = bool(payload.get("recommendations_frozen", True))
        plan.plan_hash = expected_hash or self._compute_plan_hash(plan)

        return {
            "applied": True,
            "plan_id": plan_id,
            "plan_hash": plan.plan_hash,
            "recommendation_count": len(plan.recommendations),
        }

    async def route(self, task: str) -> dict:
        """
        路由任务到合适的工作流级别

        基于任务描述自动识别复杂度
        """
        task_lower = task.lower()

        # 匹配关键词
        matched_level = WorkflowLevel.L2_LITE  # 默认
        max_score = 0

        for level, keywords in self._get_level_indicators().items():
            score = sum(1 for kw in keywords if re.search(kw, task_lower))
            if score > max_score:
                max_score = score
                matched_level = level

        # 根据任务长度调整
        if len(task) > 100 and matched_level in [WorkflowLevel.L1_RAPID, WorkflowLevel.L2_LITE]:
            matched_level = WorkflowLevel.L3_STANDARD

        level_descriptions = {
            WorkflowLevel.L1_RAPID: "简单问答模式 - 直接回答，无需规划",
            WorkflowLevel.L2_LITE: "段落生成模式 - 单次生成，可能需要技能包",
            WorkflowLevel.L3_STANDARD: "章节创作模式 - Plan-Act 模式，需要检查点",
            WorkflowLevel.L4_BRAINSTORM: "多章连续模式 - 状态管理，跨章节一致性",
            WorkflowLevel.L5_COORDINATOR: "全书规划模式 - 完整工作流，大纲到成稿",
        }

        return {
            "level": matched_level.label,
            "level_slug": matched_level.slug,
            "description": level_descriptions[matched_level],
            "suggested_workflow": self._get_workflow_template(matched_level),
            "reason": f"匹配关键词得分: {max_score}",
        }

    def _get_workflow_template(self, level: WorkflowLevel) -> list:
        """获取工作流模板"""
        if isinstance(level, str):
            level = WorkflowLevel.from_label(level)

        templates = {
            WorkflowLevel.L1_RAPID: [
                {"name": "answer", "description": "直接回答问题"}
            ],
            WorkflowLevel.L2_LITE: [
                {"name": "analyze", "description": "分析任务需求"},
                {"name": "match_skills", "description": "匹配技能包"},
                {"name": "generate", "description": "生成内容"},
            ],
            WorkflowLevel.L3_STANDARD: [
                {"name": "analyze", "description": "分析章节需求"},
                {"name": "load_context", "description": "加载上下文"},
                {"name": "match_skills", "description": "匹配技能包"},
                {"name": "plan_structure", "description": "规划章节结构"},
                {"name": "generate_draft", "description": "生成初稿"},
                {"name": "evaluate", "description": "评估质量"},
                {"name": "revise", "description": "修改优化"},
                {"name": "checkpoint", "description": "创建检查点"},
            ],
            WorkflowLevel.L4_BRAINSTORM: [
                {"name": "load_state", "description": "加载前文状态"},
                {"name": "plan_chapters", "description": "规划多章"},
                {"name": "create_chapter", "description": "创作单章 (循环)"},
                {"name": "consistency_check", "description": "一致性检查"},
                {"name": "save_state", "description": "保存状态"},
            ],
            WorkflowLevel.L5_COORDINATOR: [
                {"name": "concept", "description": "确定核心概念"},
                {"name": "outline", "description": "生成大纲"},
                {"name": "character_design", "description": "角色设计"},
                {"name": "world_building", "description": "世界设定"},
                {"name": "chapter_breakdown", "description": "章节分解"},
                {"name": "create_chapters", "description": "逐章创作"},
                {"name": "final_review", "description": "最终审核"},
            ],
        }
        return templates.get(level, templates[WorkflowLevel.L2_LITE])
    
    async def plan(self, task: str, level: str = None, recommendations: Optional[List[Any]] = None) -> dict:
        """
        生成执行计划 (Plan 模式)
        """
        # 自动路由
        if not level:
            routing = await self.route(task)
            level = routing["level"]

        workflow_level = WorkflowLevel.from_label(level)

        quality_metrics = self._build_quality_metrics(task)
        lane = self._determine_lane(quality_metrics)
        adaptive_level = self._resolve_adaptive_level(workflow_level, lane, quality_metrics)

        # 获取模板
        template = self._get_workflow_template(adaptive_level)
        template_meta = self._resolve_template_meta(adaptive_level)
        template_meta["lane"] = lane
        template_meta["quality_metrics"] = quality_metrics
        template_meta["gate_profile"] = self._resolve_gate_profile(adaptive_level, lane, quality_metrics)
        if adaptive_level != workflow_level:
            template_meta["adaptive_from_level"] = workflow_level.label

        # 创建计划
        plan_id = str(uuid.uuid4())[:8]
        steps = []

        for i, step_template in enumerate(template):
            step = WorkflowStep(
                id=f"{plan_id}-{i}",
                name=step_template["name"],
                description=step_template["description"],
                dependencies=[f"{plan_id}-{i-1}"] if i > 0 else []
            )
            steps.append(step)

        canonical_recommendations = self._canonicalize_recommendations(recommendations)

        plan = WorkflowPlan(
            id=plan_id,
            task=task,
            level=adaptive_level.label,
            steps=steps,
            template_meta=template_meta,
            recommendations=canonical_recommendations,
            lane=lane,
            quality_metrics=quality_metrics,
            observability=self._create_observability_baseline(),
            budget_guardrail=self._create_budget_guardrail_baseline(),
            handoff_package={},
        )
        plan.plan_hash = self._compute_plan_hash(plan)
        observability = self._refresh_observability(plan)
        budget_guardrail = self._refresh_budget_guardrail(plan)
        execution_mode = self._resolve_execution_mode(plan, observability["mode"])
        plan.template_meta["execution_mode"] = execution_mode
        plan.plan_hash = self._compute_plan_hash(plan)

        self.plans[plan_id] = plan
        self._append_audit_event(
            plan,
            "observability_mode_trace",
            {
                "mode": observability["mode"],
                "mode_changed": observability["mode_changed"],
                "reason": observability["upgrade_reason"],
                "aggregate": observability["aggregate"],
            },
        )
        self._persist_plan_state(plan, current_phase="planned")

        logger.info(f"Created plan: {plan_id} (Level: {workflow_level.label}, Steps: {len(steps)})")

        return self._with_contract({
            "plan_id": plan_id,
            "level": adaptive_level.label,
            "level_slug": adaptive_level.slug,
            "template_meta": template_meta,
            "gate_decision": plan.gate_decision,
            "recommendations": plan.recommendations,
            "recommendations_frozen": plan.recommendations_frozen,
            "plan_hash": plan.plan_hash,
            "execution_mode": execution_mode,
            "observability_metrics": observability["aggregate"],
            "budget_guardrail": budget_guardrail,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "description": s.description,
                    "dependencies": s.dependencies,
                    "status": s.status
                }
                for s in steps
            ],
            "total_steps": len(steps)
        })
    
    async def lifecycle(self, plan_id: str, action: str) -> dict:
        """loop-runner 生命周期控制入口"""
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}

        plan = self.plans[plan_id]
        normalized_action = (action or "").strip().lower()
        if normalized_action == "status":
            session_state = self._sync_session_lifecycle(plan)
            observability = self._refresh_observability(plan)
            budget_guardrail = self._refresh_budget_guardrail(plan)
            execution_mode = self._resolve_execution_mode(plan, observability["mode"])
            plan.template_meta["execution_mode"] = execution_mode
            return self._with_contract({
                "plan_id": plan.id,
                "action": "status",
                "runner_state": plan.runner_state,
                "plan_status": plan.status,
                "session_status": session_state.get("status"),
                "lane": plan.lane,
                "quality_metrics": plan.quality_metrics,
                "execution_mode": execution_mode,
                "observability_metrics": observability["aggregate"],
                "budget_guardrail": budget_guardrail,
                "handoff_package": plan.handoff_package,
                "state_mapping": self._resolve_lane_status_map(plan),
            })

        target_by_action = {
            "start": "running",
            "pause": "paused",
            "resume": "running",
            "stop": "stopped",
        }
        if normalized_action not in target_by_action:
            return {"error": f"Unsupported lifecycle action: {action}"}

        checkpoint_id = None
        if normalized_action == "pause":
            replay_payload = {
                "plan_id": plan.id,
                "plan_hash": plan.plan_hash or self._compute_plan_hash(plan),
                "recommendations": copy.deepcopy(plan.recommendations),
                "recommendations_frozen": plan.recommendations_frozen,
            }
            checkpoint = await self.create_checkpoint(
                description=f"loop-pause:{plan.id}",
                auto_commit=False,
                plan_id=plan.id,
                replay_payload=replay_payload,
            )
            checkpoint_id = checkpoint.get("checkpoint_id")

        try:
            session_state = self._set_runner_state(
                plan,
                target_by_action[normalized_action],
                checkpoint_id=checkpoint_id,
            )
        except ValueError as exc:
            return {"error": str(exc)}

        if normalized_action in {"pause", "stop"}:
            self._persist_handoff_package(plan, trigger=normalized_action)

        observability = self._refresh_observability(plan)
        budget_guardrail = self._refresh_budget_guardrail(plan)
        execution_mode = self._resolve_execution_mode(plan, observability["mode"])
        plan.template_meta["execution_mode"] = execution_mode

        return self._with_contract({
            "plan_id": plan.id,
            "action": normalized_action,
            "runner_state": plan.runner_state,
            "plan_status": plan.status,
            "session_status": session_state.get("status"),
            "checkpoint_id": checkpoint_id,
            "lane": plan.lane,
            "quality_metrics": plan.quality_metrics,
            "execution_mode": execution_mode,
            "observability_metrics": observability["aggregate"],
            "budget_guardrail": budget_guardrail,
            "handoff_package": plan.handoff_package,
            "state_mapping": self._resolve_lane_status_map(plan),
        })

    async def execute(
        self,
        plan_id: str,
        step_id: str = None,
        recommendations: Optional[List[Any]] = None,
        confirm_token: Optional[str] = None,
    ) -> dict:
        """
        执行计划 (Act 模式)
        """
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}

        plan = self.plans[plan_id]
        if plan.runner_state == "stopped":
            return {"error": "Loop runner is stopped"}
        if plan.runner_state == "paused":
            return {"error": "Loop runner is paused"}
        if plan.runner_state == "pending":
            self._set_runner_state(plan, "running")

        if recommendations:
            plan.recommendations = self._canonicalize_recommendations(recommendations)
            plan.recommendations_frozen = False
            plan.plan_hash = self._compute_plan_hash(plan)

        self._freeze_recommendations(plan)
        if not plan.plan_hash:
            plan.plan_hash = self._compute_plan_hash(plan)

        preflight_observability = self._refresh_observability(plan)
        preflight_budget_guardrail = self._refresh_budget_guardrail(plan)
        preflight_execution_mode = self._resolve_execution_mode(plan, preflight_observability["mode"])
        plan.template_meta["execution_mode"] = preflight_execution_mode

        # 找到要执行的步骤
        if step_id:
            step = next((s for s in plan.steps if s.id == step_id), None)
            if not step:
                return {"error": f"Step '{step_id}' not found"}
            if self._canonical_step_status(step.status) != "planned":
                return {
                    "error": f"Step '{step_id}' is not planned (current status: {self._canonical_step_status(step.status)})"
                }
        else:
            # 找到下一个待执行的步骤
            step = next((s for s in plan.steps if self._canonical_step_status(s.status) == "planned"), None)
        if not step:
            self._persist_plan_state(plan, current_phase="done")
            return {
                "status": "completed",
                "message": "All steps completed",
                "execution_mode": preflight_execution_mode,
                "observability_metrics": preflight_observability["aggregate"],
                "budget_guardrail": preflight_budget_guardrail,
                **self._state_resume_metadata(plan),
            }

        # 检查依赖
        for dep_id in step.dependencies:
            dep_step = next((s for s in plan.steps if s.id == dep_id), None)
            if dep_step and self._canonical_step_status(dep_step.status) != "done":
                return {"error": f"Dependency '{dep_id}' not completed"}

        # 标记计划为运行中
        if plan.status == "created":
            plan.status = "running"

        # 风险门检查在执行前完成，未确认时保持 planned 状态
        level_enum = WorkflowLevel.from_label(plan.level)
        gate = self._evaluate_risk_gate(
            level_enum,
            step,
            recommendations=plan.recommendations,
            confirm_token=confirm_token,
        )
        plan.gate_decision = gate["decision"]
        logger.info(
            "Risk gate decision: %s plan=%s step=%s reason=%s",
            gate["decision"],
            plan.id,
            step.name,
            gate["reason"],
        )

        if gate.get("confirm_required") and not gate.get("confirmed"):
            self._persist_plan_state(plan, current_phase="planned")
            self._append_audit_event(
                plan,
                "confirm_trace",
                {
                    "step_id": step.id,
                    "step_name": step.name,
                    "risk": gate.get("risk"),
                    "decision": gate.get("decision"),
                    "confirmed": False,
                    "reason": gate.get("reason"),
                },
            )
            return self._with_contract({
                "step_id": step.id,
                "step_name": step.name,
                "status": "waiting_confirmation",
                "gate": gate,
                "plan_status": plan.status,
                "runner_state": plan.runner_state,
                "remaining_steps": self._remaining_steps(plan),
                "execution_mode": preflight_execution_mode,
                "observability_metrics": preflight_observability["aggregate"],
                "budget_guardrail": preflight_budget_guardrail,
                **self._state_resume_metadata(plan),
            })

        lock_context = await self._acquire_module_ownership(plan, step)
        conflict_modules = lock_context.get("conflicts", [])
        has_conflict = bool(conflict_modules)

        observability = self._refresh_observability(plan)
        budget_guardrail = self._refresh_budget_guardrail(plan)
        execution_mode = self._resolve_execution_mode(plan, observability["mode"])
        plan.template_meta["execution_mode"] = execution_mode
        self._append_audit_event(
            plan,
            "observability_mode_trace",
            {
                "mode": execution_mode,
                "mode_changed": observability["mode_changed"],
                "reason": (
                    budget_guardrail["reason"]
                    if budget_guardrail.get("degraded")
                    else observability["upgrade_reason"]
                ),
                "aggregate": observability["aggregate"],
            },
        )

        precheck_checkpoint_id = None
        if gate.get("destructive"):
            precheck_checkpoint_id = await self._create_rollback_checkpoint(plan, step)
            self._append_audit_event(
                plan,
                "confirm_trace",
                {
                    "step_id": step.id,
                    "step_name": step.name,
                    "risk": gate.get("risk"),
                    "decision": gate.get("decision"),
                    "confirmed": True,
                    "confirm_token_provided": gate.get("confirmed"),
                    "rollback_checkpoint_id": precheck_checkpoint_id,
                },
            )

        # 执行步骤
        self._transition_step_state(plan, step, "executing", "execution_started")

        try:
            current_phase = "executing"
            # 根据步骤名称执行对应操作
            result = await self._execute_step(plan, step)

            current_phase = "review"
            self._transition_step_state(plan, step, "review", "execution_completed")
            current_phase = "test"
            self._transition_step_state(plan, step, "test", "review_passed")
            current_phase = "done"
            self._transition_step_state(plan, step, "done", "test_passed")
            step.output = result

            if all(self._canonical_step_status(s.status) == "done" for s in plan.steps):
                gate_chain = await self._run_wave_gate_orchestration(plan)
                if gate_chain.get("required"):
                    self._append_audit_event(
                        plan,
                        "wave_gate_trace",
                        {
                            "required": True,
                            "passed": gate_chain.get("passed", False),
                            "failed_gate": gate_chain.get("failed_gate"),
                            "trace": gate_chain.get("trace", []),
                        },
                    )
                    if not gate_chain.get("passed"):
                        plan.status = "failed"
                        recovery = await self._trigger_recovery_chain(
                            plan=plan,
                            failure_phase="wave_gate",
                            failure_reason=f"wave gate failed: {gate_chain.get('failed_gate') or 'unknown'}",
                            failed_step_id=step.id,
                            checkpoint_id=precheck_checkpoint_id,
                        )
                        return self._with_contract({
                            "step_id": step.id,
                            "step_name": step.name,
                            "status": "gate_blocked",
                            "result": result,
                            "gate": gate,
                            "gate_chain": gate_chain,
                            "blocked": True,
                            "plan_status": plan.status,
                            "runner_state": plan.runner_state,
                            "remaining_steps": self._remaining_steps(plan),
                            "recovery": recovery,
                            "concurrency": {
                                "serialized": has_conflict,
                                "conflict_modules": conflict_modules,
                                "ownership": lock_context.get("ownership", []),
                            },
                            "execution_mode": execution_mode,
                            "observability_metrics": observability["aggregate"],
                            "budget_guardrail": budget_guardrail,
                            **self._state_resume_metadata(plan),
                        })


                    wave_checkpoint = await self.create_checkpoint(
                        description=f"wave-complete:{plan.id}",
                        auto_commit=False,
                        plan_id=plan.id,
                        replay_payload=self._build_plan_replay_payload(plan),
                    )
                    plan.template_meta["wave_completion_checkpoint_id"] = wave_checkpoint.get("checkpoint_id")
                    self._append_audit_event(
                        plan,
                        "wave_gate_trace",
                        {
                            "required": True,
                            "passed": True,
                            "failed_gate": None,
                            "trace": gate_chain.get("trace", []),
                            "wave_completion_checkpoint_id": wave_checkpoint.get("checkpoint_id"),
                        },
                    )
                else:
                    gate_chain = {"required": False, "passed": True, "trace": []}

                plan.status = "completed"
                plan.completed_at = datetime.now().isoformat()

            else:
                gate_chain = {"required": False, "passed": True, "trace": []}

            return self._with_contract({
                "step_id": step.id,
                "step_name": step.name,
                "status": "completed",
                "result": result,
                "gate": gate,
                "gate_chain": gate_chain,
                "wave_completion_checkpoint_id": plan.template_meta.get("wave_completion_checkpoint_id", ""),
                "rollback_checkpoint_id": precheck_checkpoint_id,
                "plan_status": plan.status,
                "runner_state": plan.runner_state,
                "remaining_steps": self._remaining_steps(plan),
                "concurrency": {
                    "serialized": has_conflict,
                    "conflict_modules": conflict_modules,
                    "ownership": lock_context.get("ownership", []),
                },
                "execution_mode": execution_mode,
                "observability_metrics": observability["aggregate"],
                "budget_guardrail": budget_guardrail,
                **self._state_resume_metadata(plan),
            })

        except Exception as e:
            failure_phase = locals().get("current_phase", "executing")
            failure_reason = str(e)
            self._transition_step_state(plan, step, "failed", "execution_error")
            plan.status = "failed"
            logger.error(f"Step execution failed: {e}")

            rollback = None
            if precheck_checkpoint_id:
                rollback = await self.quick_rollback(
                    plan_id=plan.id,
                    checkpoint_id=precheck_checkpoint_id,
                    reason=f"step failed: {step.id}",
                )

            failure_context = {
                "phase": failure_phase,
                "reason": failure_reason,
                "checkpoint_id": precheck_checkpoint_id,
            }
            self._append_audit_event(
                plan,
                "step_execution_failed",
                {
                    "step_id": step.id,
                    "step_name": step.name,
                    **failure_context,
                },
            )
            recovery = await self._trigger_recovery_chain(
                plan=plan,
                failure_phase=failure_phase,
                failure_reason=failure_reason,
                failed_step_id=step.id,
                checkpoint_id=precheck_checkpoint_id,
            )

            return {
                "error": failure_reason,
                "step_id": step.id,
                "failure": failure_context,
                "rollback": rollback,
                "recovery": recovery,
                "concurrency": {
                    "serialized": has_conflict,
                    "conflict_modules": conflict_modules,
                    "ownership": lock_context.get("ownership", []),
                },
                "execution_mode": execution_mode,
                "observability_metrics": observability["aggregate"],
                "budget_guardrail": budget_guardrail,
                **self._state_resume_metadata(plan),
            }
        finally:
            self._release_module_ownership(plan, step, lock_context)
    
    async def _execute_step(self, plan: WorkflowPlan, step: WorkflowStep) -> Any:
        """执行具体步骤"""
        if step.name == "analyze":
            return self._run_analyze(plan)

        if step.name == "match_skills":
            return self._run_match_skills(plan)

        if step.name == "load_context":
            return self._run_load_context(plan)

        if step.name == "plan_structure":
            return self._run_plan_structure(plan)

        if step.name == "generate_draft":
            return self._run_generate_draft(plan)

        if step.name == "generate":
            return self._run_generate(plan)

        if step.name == "evaluate":
            return self._run_evaluate(plan)

        if step.name == "revise":
            return self._run_revise(plan)

        if step.name == "checkpoint":
            checkpoint = await self.create_checkpoint(
                description=f"plan:{plan.id} step:{step.id}",
                auto_commit=False,
                plan_id=plan.id,
                step_id=step.id,
                replay_payload={
                    "plan_id": plan.id,
                    "plan_hash": plan.plan_hash,
                    "recommendations": copy.deepcopy(plan.recommendations),
                    "recommendations_frozen": plan.recommendations_frozen,
                },
            )
            return {
                "checkpoint_id": checkpoint["checkpoint_id"],
                "created_at": checkpoint["created_at"],
                "replay_payload": checkpoint.get("replay_payload", {}),
            }

        if step.name == "answer":
            return self._run_answer(plan)

        raise ValueError(f"Unsupported workflow step: {step.name}")

    def _get_step_output(self, plan: WorkflowPlan, step_name: str) -> Optional[Dict[str, Any]]:
        for candidate in plan.steps:
            if candidate.name == step_name and isinstance(candidate.output, dict):
                return candidate.output
        return None

    def _run_analyze(self, plan: WorkflowPlan) -> Dict[str, Any]:
        task = plan.task.strip()
        keywords = [kw for kw in ["写", "章节", "角色", "冲突", "大纲", "修订"] if kw in task]

        return {
            "task": task,
            "task_length": len(task),
            "intent": "chapter_creation" if "章" in task else "general_writing",
            "keywords": keywords,
        }

    def _run_match_skills(self, plan: WorkflowPlan) -> Dict[str, Any]:
        task = plan.task
        skills: List[str] = []

        if any(k in task for k in ["对话", "台词"]):
            skills.append("dialogue-system")
        if any(k in task for k in ["人物", "角色"]):
            skills.append("character-forge")
        if any(k in task for k in ["悬念", "反转", "冲突"]):
            skills.append("suspense-builder")

        if not skills:
            skills = ["scene-builder"]

        return {"skills": skills, "skill_count": len(skills)}

    def _run_load_context(self, plan: WorkflowPlan) -> Dict[str, Any]:
        analyze_output = self._get_step_output(plan, "analyze") or {}

        return {
            "workspace": str(self.workspace),
            "task": plan.task,
            "analysis": analyze_output,
            "context_loaded": True,
        }

    def _run_plan_structure(self, plan: WorkflowPlan) -> Dict[str, Any]:
        task = plan.task

        if "对话" in task:
            structure = ["开场", "人物出场", "对话推进", "冲突显化", "收束"]
        elif "大纲" in task:
            structure = ["核心设定", "章节分段", "主线冲突", "高潮设计", "结局"]
        else:
            structure = ["开场", "发展", "冲突", "高潮", "结局"]

        return {"structure": structure, "section_count": len(structure)}

    def _run_generate_draft(self, plan: WorkflowPlan) -> Dict[str, Any]:
        structure_output = self._get_step_output(plan, "plan_structure") or {}
        sections = structure_output.get("structure", ["开场", "发展", "结尾"])
        draft = "\n".join(f"{idx + 1}. {section}" for idx, section in enumerate(sections))

        return {
            "draft": draft,
            "source_task": plan.task,
            "section_count": len(sections),
        }

    def _run_generate(self, plan: WorkflowPlan) -> Dict[str, Any]:
        skills_output = self._get_step_output(plan, "match_skills") or {}
        skills = ", ".join(skills_output.get("skills", []))

        content = f"任务：{plan.task}\n采用技能：{skills or 'scene-builder'}"

        return {
            "content": content,
            "task": plan.task,
        }

    def _run_evaluate(self, plan: WorkflowPlan) -> Dict[str, Any]:
        draft_output = self._get_step_output(plan, "generate_draft")
        generate_output = self._get_step_output(plan, "generate")

        text = ""
        if draft_output:
            text = draft_output.get("draft", "")
        elif generate_output:
            text = generate_output.get("content", "")

        score = min(100.0, max(60.0, 60.0 + len(text) / 8.0))

        return {
            "score": round(score, 1),
            "feedback": "结构完整，可进入修订" if score >= 75 else "需要补充细节",
            "length": len(text),
        }

    def _run_revise(self, plan: WorkflowPlan) -> Dict[str, Any]:
        evaluate_output = self._get_step_output(plan, "evaluate") or {}
        draft_output = self._get_step_output(plan, "generate_draft") or {}

        draft = draft_output.get("draft", "")
        score = evaluate_output.get("score", 0)

        revised = f"{draft}\n\n修订说明：根据评分 {score} 进行了表达与衔接优化。".strip()

        return {
            "revised": True,
            "score": score,
            "content": revised,
        }

    def _run_answer(self, plan: WorkflowPlan) -> Dict[str, Any]:
        return {
            "answer": f"已接收任务：{plan.task}。建议按步骤执行并在关键节点创建检查点。",
            "task": plan.task,
        }

    
    async def create_checkpoint(
        self,
        description: str = "",
        auto_commit: bool = True,
        plan_id: str = None,
        step_id: str = None,
        replay_payload: Optional[Dict[str, Any]] = None,
    ) -> dict:
        """
        创建检查点 (Git-based)
        """
        checkpoint_id = str(uuid.uuid4())[:8]
        commit_hash = None
        
        if auto_commit:
            try:
                # Git add - 仅暂存工作区目录下的文件，避免误伤
                subprocess.run(
                    ["git", "add", str(self.workspace)],
                    cwd=self.workspace,
                    capture_output=True,
                    check=True
                )
                
                # Git commit
                commit_msg = f"[checkpoint:{checkpoint_id}] {description or 'Auto checkpoint'}"
                result = subprocess.run(
                    ["git", "commit", "-m", commit_msg],
                    cwd=self.workspace,
                    capture_output=True,
                    text=True
                )
                
                # 获取 commit hash
                if result.returncode == 0:
                    hash_result = subprocess.run(
                        ["git", "rev-parse", "HEAD"],
                        cwd=self.workspace,
                        capture_output=True,
                        text=True
                    )
                    commit_hash = hash_result.stdout.strip()
                
            except subprocess.CalledProcessError as e:
                logger.warning(f"Git operation failed: {e}")
            except FileNotFoundError:
                logger.warning("Git not available")
        
        checkpoint = Checkpoint(
            id=checkpoint_id,
            description=description,
            commit_hash=commit_hash,
            plan_id=plan_id,
            step_id=step_id,
            replay_payload=copy.deepcopy(replay_payload) if replay_payload else {},
        )
        
        self.checkpoints[checkpoint_id] = checkpoint
        if plan_id and plan_id in self.plans:
            self._persist_plan_state(self.plans[plan_id], checkpoint_id=checkpoint_id)
        
        logger.info(f"Created checkpoint: {checkpoint_id}")
        
        return {
            "checkpoint_id": checkpoint_id,
            "commit_hash": commit_hash,
            "description": description,
            "plan_id": checkpoint.plan_id,
            "step_id": checkpoint.step_id,
            "replay_payload": checkpoint.replay_payload,
            "created_at": checkpoint.created_at
        }
    
    async def restore_checkpoint(self, checkpoint_id: str, confirm_token: Optional[str] = None) -> dict:
        """
        恢复到检查点
        """
        if checkpoint_id not in self.checkpoints:
            return {"error": f"Checkpoint '{checkpoint_id}' not found"}

        checkpoint = self.checkpoints[checkpoint_id]
        destructive = bool(checkpoint.replay_payload)
        confirmed = (not destructive) or self._has_valid_confirm_token(confirm_token)

        gate = {
            "decision": (
                WorkflowDecision.GO.value
                if confirmed
                else WorkflowDecision.NO_GO.value
            ),
            "reason": (
                "destructive restore confirmed, hard gate passed"
                if (destructive and confirmed)
                else (
                    "destructive restore requires secondary confirmation"
                    if destructive
                    else "soft gate passed"
                )
            ),
            "risk": "high" if destructive else "low",
            "gate_profile": "restore-selective-hard" if destructive else "restore-soft",
            "blocking": destructive and (not confirmed),
            "destructive": destructive,
            "confirm_required": destructive,
            "confirm_token": self._redacted_confirm_token(confirm_token),
            "confirmed": confirmed,
        }

        plan = self.plans.get(checkpoint.plan_id) if checkpoint.plan_id else None
        if plan:
            self._persist_plan_state(plan, checkpoint_id=checkpoint_id)

        if destructive and not gate["confirmed"]:
            if plan:
                self._append_audit_event(
                    plan,
                    "confirm_trace",
                    {
                        "operation": "restore_checkpoint",
                        "checkpoint_id": checkpoint_id,
                        "confirmed": False,
                        "reason": gate["reason"],
                    },
                )
            replay_result = {"applied": False, "reason": "waiting_confirmation"}
            return self._with_contract({
                "status": "waiting_confirmation",
                "error": "destructive restore requires secondary confirmation",
                "checkpoint_id": checkpoint_id,
                "plan_id": checkpoint.plan_id,
                "step_id": checkpoint.step_id,
                "replay": replay_result,
                "gate": gate,
            })

        replay_result = self._apply_replay_payload(checkpoint)

        if checkpoint.commit_hash:
            try:
                subprocess.run(
                    ["git", "checkout", checkpoint.commit_hash],
                    cwd=self.workspace,
                    capture_output=True,
                    check=True
                )

                if plan:
                    self._append_audit_event(
                        plan,
                        "confirm_trace",
                        {
                            "operation": "restore_checkpoint",
                            "checkpoint_id": checkpoint_id,
                            "confirmed": True,
                            "confirm_token_provided": gate.get("confirmed"),
                        },
                    )

                return self._with_contract({
                    "status": "restored",
                    "checkpoint_id": checkpoint_id,
                    "commit_hash": checkpoint.commit_hash,
                    "plan_id": checkpoint.plan_id,
                    "step_id": checkpoint.step_id,
                    "replay": replay_result,
                    "gate": gate,
                })

            except subprocess.CalledProcessError as e:
                return {"error": f"Git restore failed: {e}", "replay": replay_result, "gate": gate}

        if plan and destructive:
            self._append_audit_event(
                plan,
                "confirm_trace",
                {
                    "operation": "restore_checkpoint",
                    "checkpoint_id": checkpoint_id,
                    "confirmed": True,
                    "confirm_token_provided": gate.get("confirmed"),
                },
            )

        return {
            "error": "No commit hash available for this checkpoint",
            "plan_id": checkpoint.plan_id,
            "step_id": checkpoint.step_id,
            "replay": replay_result,
            "gate": gate,
        }
    
    async def list_checkpoints(self, limit: int = 10) -> list:
        """
        列出最近的检查点
        """
        checkpoints = sorted(
            self.checkpoints.values(),
            key=lambda c: c.created_at,
            reverse=True
        )
        
        return [
            {
                "id": c.id,
                "description": c.description,
                "commit_hash": c.commit_hash,
                "created_at": c.created_at
            }
            for c in checkpoints[:limit]
        ]
    
    def get_plan_status(self, plan_id: str) -> dict:
        """获取计划状态"""
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}
        
        plan = self.plans[plan_id]
        session_state = self._sync_session_lifecycle(plan)

        observability = self._refresh_observability(plan)
        budget_guardrail = self._refresh_budget_guardrail(plan)
        execution_mode = self._resolve_execution_mode(plan, observability["mode"])
        plan.template_meta["execution_mode"] = execution_mode

        return self._with_contract({
            "plan_id": plan.id,
            "task": plan.task,
            "level": plan.level,
            "status": plan.status,
            "runner_state": plan.runner_state,
            "session_status": session_state.get("status"),
            "state_mapping": RUNNER_TO_SESSION_STATUS,
            "template_meta": plan.template_meta,
            "gate_decision": plan.gate_decision,
            "recommendations": plan.recommendations,
            "recommendations_frozen": plan.recommendations_frozen,
            "plan_hash": plan.plan_hash,
            "execution_mode": execution_mode,
            "observability_metrics": observability["aggregate"],
            "budget_guardrail": budget_guardrail,
            "handoff_package": plan.handoff_package,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "status": s.status,
                    "output": s.output
                }
                for s in plan.steps
            ],
            "progress": f"{sum(1 for s in plan.steps if self._canonical_step_status(s.status) == 'done')}/{len(plan.steps)}"
        })
