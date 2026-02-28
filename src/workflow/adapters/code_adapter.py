"""
Code Domain Adapter

Implements a practical code workflow:
planner -> coder -> evaluator -> finalize.
"""

from typing import Type, Any, Dict, Optional
from langgraph.graph import StateGraph, END

from .base_adapter import (
    BaseDomainAdapter,
    AdapterRegistry,
    DomainType,
    BaseEvaluationResult,
)
from src.workflow.base_state import BaseState, create_base_state


@AdapterRegistry.register(
    DomainType.CODE.value,
    capabilities=("strict-governance", "cli-exposed"),
)
class CodeAdapter(BaseDomainAdapter):

    def get_domain_type(self) -> str:
        return DomainType.CODE.value

    def get_state_class(self) -> Type[BaseState]:
        return BaseState

    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        metadata = kwargs.get("metadata") or {}
        resume_decision = kwargs.get("resume_decision")
        if resume_decision:
            metadata = {**metadata, "resume_decision": resume_decision}

        return create_base_state(
            user_request=user_request,
            domain=DomainType.CODE.value,
            metadata=metadata,
            **{key: value for key, value in kwargs.items() if key not in ("metadata", "resume_decision")},
        )

    def evaluate(self, state: BaseState) -> BaseEvaluationResult:
        pass_score = float(self.config.get("pass_score", 80))
        coverage_threshold = float(self.config.get("code_coverage_threshold", 80))
        max_revisions = int(self.config.get("max_revisions", 3))

        tests_passed = self._resolve_bool_signal(state, "tests_passed")
        lint_passed = self._resolve_bool_signal(state, "lint_passed")
        build_passed = self._resolve_bool_signal(state, "build_passed")
        coverage = self._resolve_coverage(state)

        dimension_scores = {
            "tests": self._score_binary_signal(tests_passed, 35.0, 18.0),
            "lint": self._score_binary_signal(lint_passed, 20.0, 10.0),
            "build": self._score_binary_signal(build_passed, 25.0, 12.0),
            "coverage": self._score_coverage(coverage),
        }
        total_score = round(sum(dimension_scores.values()), 2)

        errors = state.get("errors") or []
        revision_count = int(state.get("revision_count", 0))
        coverage_below_threshold = coverage is not None and coverage < coverage_threshold

        blocking_reasons = []
        revision_instructions = []

        if errors:
            blocking_reasons.append("runtime_or_execution_errors")
            revision_instructions.append({
                "target": "error",
                "issue": "Resolve execution/runtime errors first",
                "action": "Inspect errors and fix root causes before next evaluation",
            })

        if tests_passed is False:
            blocking_reasons.append("tests_failed")
            revision_instructions.append({
                "target": "tests",
                "issue": "Tests are failing",
                "action": "Fix failing tests and keep regression suite green",
            })

        if lint_passed is False:
            blocking_reasons.append("lint_failed")
            revision_instructions.append({
                "target": "lint",
                "issue": "Lint checks are failing",
                "action": "Apply lint fixes and formatting before merge",
            })

        if build_passed is False:
            blocking_reasons.append("build_failed")
            revision_instructions.append({
                "target": "build",
                "issue": "Build checks are failing",
                "action": "Fix build breakages and verify clean build",
            })

        if coverage_below_threshold:
            blocking_reasons.append("coverage_below_threshold")
            revision_instructions.append({
                "target": "coverage",
                "issue": f"Coverage {coverage:.2f}% below {coverage_threshold:.2f}%",
                "action": "Add/adjust tests to satisfy coverage threshold",
            })

        if blocking_reasons:
            if revision_count >= max_revisions:
                decision = "HUMAN_REVIEW"
                decision_reason = (
                    f"Blocking checks still failing after {revision_count} revisions: "
                    f"{', '.join(blocking_reasons)}"
                )
            else:
                decision = "REVISE"
                decision_reason = f"Blocking checks failed: {', '.join(blocking_reasons)}"
        elif total_score >= pass_score:
            decision = "APPROVED"
            decision_reason = f"Code quality gates passed (score={total_score:.2f})"
        else:
            decision = "REVISE"
            decision_reason = f"Quality score {total_score:.2f} below pass score {pass_score:.2f}"

        feedback = (
            "Code evaluation completed: "
            f"tests={tests_passed}, lint={lint_passed}, build={build_passed}, coverage={coverage}"
        )

        return BaseEvaluationResult(
            decision=decision,
            decision_reason=decision_reason,
            total_score=total_score,
            dimension_scores=dimension_scores,
            feedback=feedback,
            revision_instructions=revision_instructions,
        )

    def create_graph(self):
        workflow = StateGraph(BaseState)
        workflow.add_node("planner", self.planner_node)
        workflow.add_node("coder", self.coder_node)
        workflow.add_node("evaluator", self.evaluator_node)
        workflow.add_node("finalize", self.finalize_node)

        workflow.set_entry_point("planner")
        workflow.add_edge("planner", "coder")
        workflow.add_edge("coder", "evaluator")
        workflow.add_edge("evaluator", "finalize")
        workflow.add_edge("finalize", END)
        return workflow

    async def planner_node(self, state: BaseState) -> Dict[str, Any]:
        user_request = state.get("user_request", "")
        plan = [
            "Analyze requirements and constraints",
            "Implement code changes",
            "Run tests/lint/build/coverage checks",
            "Prepare final output and decision",
        ]
        return {
            "current_step": "planner",
            "context": f"Code task: {user_request}",
            "implementation_plan": plan,
        }

    async def coder_node(self, state: BaseState) -> Dict[str, Any]:
        metadata = state.get("metadata") or {}
        change_summary = metadata.get("change_summary")
        if not change_summary:
            change_summary = f"Implement request: {state.get('user_request', '')}"

        return {
            "current_step": "coder",
            "draft_content": change_summary,
            "iteration_count": int(state.get("iteration_count", 0)) + 1,
        }

    async def evaluator_node(self, state: BaseState) -> Dict[str, Any]:
        evaluation = self.evaluate(state)
        metadata = dict(state.get("metadata") or {})
        metadata["quality_assessment"] = {
            "total_score": evaluation.total_score,
            "dimension_scores": evaluation.dimension_scores,
        }

        return {
            "current_step": "evaluator",
            "decision": evaluation.decision,
            "decision_reason": evaluation.decision_reason,
            "score": evaluation.total_score,
            "feedback_context": evaluation.feedback,
            "revision_instructions": evaluation.revision_instructions,
            "metadata": metadata,
        }

    async def finalize_node(self, state: BaseState) -> Dict[str, Any]:
        decision = state.get("decision", "REVISE")
        approved = decision == "APPROVED"
        return {
            "current_step": "finalize",
            "requires_human_intervention": decision == "HUMAN_REVIEW",
            "final_output": state.get("draft_content", "") if approved else state.get("final_output", ""),
        }

    def _resolve_bool_signal(self, state: BaseState, key: str) -> Optional[bool]:
        value = state.get(key)
        if value is None:
            metadata = state.get("metadata") or {}
            quality_signals = metadata.get("quality_signals") if isinstance(metadata, dict) else {}
            if isinstance(quality_signals, dict) and key in quality_signals:
                value = quality_signals.get(key)
            else:
                value = metadata.get(key) if isinstance(metadata, dict) else None

        return self._to_optional_bool(value)

    def _resolve_coverage(self, state: BaseState) -> Optional[float]:
        coverage_keys = ("coverage", "coverage_pct", "coverage_percent")
        metadata = state.get("metadata") or {}
        quality_signals = metadata.get("quality_signals") if isinstance(metadata, dict) else {}

        value = None
        for key in coverage_keys:
            if key in state:
                value = state.get(key)
                break
            if isinstance(quality_signals, dict) and key in quality_signals:
                value = quality_signals.get(key)
                break
            if isinstance(metadata, dict) and key in metadata:
                value = metadata.get(key)
                break

        if value is None:
            return None

        if isinstance(value, str):
            value = value.strip().rstrip("%")

        try:
            coverage = float(value)
        except (TypeError, ValueError):
            return None

        return max(0.0, min(coverage, 100.0))

    @staticmethod
    def _to_optional_bool(value: Any) -> Optional[bool]:
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "pass", "passed", "yes", "y", "1"}:
                return True
            if normalized in {"false", "fail", "failed", "no", "n", "0"}:
                return False
        return None

    @staticmethod
    def _score_binary_signal(signal: Optional[bool], pass_score: float, unknown_score: float) -> float:
        if signal is True:
            return pass_score
        if signal is False:
            return 0.0
        return unknown_score

    @staticmethod
    def _score_coverage(coverage: Optional[float]) -> float:
        if coverage is None:
            return 8.0
        return round((coverage / 100.0) * 20.0, 2)
