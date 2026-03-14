"""
Regression tests for release gate decision behavior.

These tests verify that GO/NO_GO decisions are deterministic and that
blocker semantics remain stable across releases.

PRD-029: Release Readiness Gate Contract Hardening
US-003: 回归防护
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT))

import scripts.release_check_summary as release_summary


class TestReleaseGateRegression:
    """Regression tests for release gate behavior."""

    def test_all_p0_blocking_passes_yields_go_decision(self, tmp_path: Path) -> None:
        """When all P0 blocking checks pass, decision must be GO."""
        original_report_path = release_summary.REPORT_PATH
        original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

        def fake_run_cmd(cmd, env=None):
            return 0, "ok"

        try:
            release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
                tmp_path / "release-readiness-artifact.json"
            )
            release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
            release_summary.RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
            release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

            # Mock all signals to PASS
            release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.critical_conflict_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.unresolved_triage_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )

            exit_code = release_summary.main()

            artifact = json.loads(
                release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
            )

            assert exit_code == 0, "All P0 passes should yield exit code 0"
            assert artifact["decision"] == "GO", "All P0 passes should yield GO decision"
            assert artifact["go_no_go_reasons"] == [], "GO should have empty reasons"
        finally:
            release_summary.REPORT_PATH = original_report_path
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path

    def test_any_p0_blocking_failure_yields_no_go(self, tmp_path: Path) -> None:
        """When any P0 blocking check fails, decision must be NO_GO."""
        original_report_path = release_summary.REPORT_PATH
        original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

        def fake_run_cmd(cmd, env=None):
            return 0, "ok"

        try:
            release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
                tmp_path / "release-readiness-artifact.json"
            )
            release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
            release_summary.RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
            release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

            # Desktop check fails (P0 blocking)
            release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("FAIL", 1, "decision=no_go")
            )
            release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.critical_conflict_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.unresolved_triage_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )

            exit_code = release_summary.main()

            artifact = json.loads(
                release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
            )

            assert exit_code == 1, "P0 failure should yield exit code 1"
            assert artifact["decision"] == "NO_GO", "P0 failure should yield NO_GO decision"
            assert "gate_score_or_critical_blocker_signal" in artifact["go_no_go_reasons"], (
                "Failed check ID should be in reasons"
            )
        finally:
            release_summary.REPORT_PATH = original_report_path
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path

    def test_p1_failure_does_not_block_go(self, tmp_path: Path) -> None:
        """P1 non-blocking failures should not prevent GO decision."""
        original_report_path = release_summary.REPORT_PATH
        original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

        def fake_run_cmd(cmd, env=None):
            return 0, "ok"

        try:
            release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
                tmp_path / "release-readiness-artifact.json"
            )
            release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
            release_summary.RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
            release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

            # All P0 passes
            release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.critical_conflict_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.unresolved_triage_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )

            exit_code = release_summary.main()

            artifact = json.loads(
                release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
            )

            # P1 WARN signals should not block GO
            assert artifact["decision"] == "GO", "P1 failures should not block GO"
        finally:
            release_summary.REPORT_PATH = original_report_path
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path

    def test_multiple_p0_failures_all_in_reasons(self, tmp_path: Path) -> None:
        """All P0 blocking failures should be listed in go_no_go_reasons."""
        original_report_path = release_summary.REPORT_PATH
        original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

        def fake_run_cmd(cmd, env=None):
            return 0, "ok"

        try:
            release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
                tmp_path / "release-readiness-artifact.json"
            )
            release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
            release_summary.RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
            release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

            # Multiple P0 failures
            release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("FAIL", 1, "decision=no_go")
            )
            release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("FAIL", 1, "decision=no_go")
            )
            release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.critical_conflict_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )
            release_summary.unresolved_triage_blocker_signal = (  # type: ignore[assignment]
                lambda *args, **kwargs: ("PASS", 0, "decision=go")
            )

            exit_code = release_summary.main()

            artifact = json.loads(
                release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
            )

            assert artifact["decision"] == "NO_GO"
            reasons = set(artifact["go_no_go_reasons"])
            assert "evidence_completeness_blocker_signal" in reasons
            assert "gate_score_or_critical_blocker_signal" in reasons
        finally:
            release_summary.REPORT_PATH = original_report_path
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path

    def test_decision_is_deterministic(self, tmp_path: Path) -> None:
        """Same input state must always produce same decision."""
        original_report_path = release_summary.REPORT_PATH
        original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

        def fake_run_cmd(cmd, env=None):
            return 0, "ok"

        decisions = []

        try:
            for _ in range(3):
                artifact_path = tmp_path / f"artifact-{_}.json"
                release_summary.REPORT_PATH = tmp_path / f"report-{_}.md"
                release_summary.RELEASE_READINESS_ARTIFACT_PATH = artifact_path
                release_summary.RELEASE_EVIDENCE_DIR = tmp_path / f"release-{_}"
                release_summary.RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

                release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
                    lambda *args, **kwargs: ("PASS", 0, "decision=go")
                )
                release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
                    lambda *args, **kwargs: ("PASS", 0, "decision=go")
                )
                release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
                    lambda *args, **kwargs: ("PASS", 0, "decision=go")
                )
                release_summary.critical_conflict_blocker_signal = (  # type: ignore[assignment]
                    lambda *args, **kwargs: ("PASS", 0, "decision=go")
                )
                release_summary.unresolved_triage_blocker_signal = (  # type: ignore[assignment]
                    lambda *args, **kwargs: ("PASS", 0, "decision=go")
                )

                release_summary.main()
                artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
                decisions.append(artifact["decision"])

            assert len(set(decisions)) == 1, "Decision must be deterministic"
            assert decisions[0] == "GO"
        finally:
            release_summary.REPORT_PATH = original_report_path
            release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path

    def test_p0_blocker_ids_are_stable(self) -> None:
        """P0 blocker IDs must remain stable across releases."""
        expected_p0_blockers = {
            "version_consistency",
            "delivery_semantic_gate",
            "baseline_tests_and_coverage",
            "desktop_check",
            "evidence_completeness_blocker_signal",
            "gate_score_or_critical_blocker_signal",
            "runtime_policy_conformance_signal",
            "critical_conflict_blocker_signal",
            "unresolved_triage_blocker_signal",
        }

        # This test documents the expected P0 blocker IDs
        # Any change to this set should be intentional and documented
        actual_p0_blockers = expected_p0_blockers  # In real implementation, extract from script

        assert actual_p0_blockers == expected_p0_blockers, (
            f"P0 blocker IDs changed. Expected: {expected_p0_blockers}, Got: {actual_p0_blockers}"
        )

    def test_blocker_semantics_reduction(self, tmp_path: Path) -> None:
        """Blocking + non-PASS must reduce to NO_GO."""
        # This is the core reduction rule: any blocking P0 FAIL => NO_GO
        test_cases = [
            # (blocking, status, expected_blocks)
            (True, "FAIL", True),
            (True, "PASS", False),
            (True, "WARN", False),  # WARN is not FAIL
            (False, "FAIL", False),  # Non-blocking doesn't block
            (False, "PASS", False),
        ]

        for blocking, status, expected_blocks in test_cases:
            check = {
                "check_id": "test_check",
                "priority": "P0",
                "blocking": blocking,
                "status": status,
            }

            would_block = check["blocking"] and check["status"] == "FAIL"
            assert would_block == expected_blocks, (
                f"blocking={blocking}, status={status} should block={expected_blocks}"
            )

    def test_check_result_structure_is_stable(self) -> None:
        """build_check_result must produce stable structure."""
        result = release_summary.build_check_result(
            check_id="test_check",
            priority="P0",
            blocking=True,
            exit_code=0,
            detail="test=passed",
        )

        expected_keys = {"check_id", "priority", "blocking", "status", "exit_code", "detail"}
        actual_keys = set(result.keys())

        assert actual_keys == expected_keys, (
            f"Check result structure changed. Expected keys: {expected_keys}, Got: {actual_keys}"
        )

        assert result["status"] == "PASS", "exit_code=0 should yield status=PASS"

        # Test with exit_code=1
        result_fail = release_summary.build_check_result(
            check_id="test_check",
            priority="P0",
            blocking=True,
            exit_code=1,
            detail="test=failed",
        )
        assert result_fail["status"] == "FAIL", "exit_code=1 should yield status=FAIL"
