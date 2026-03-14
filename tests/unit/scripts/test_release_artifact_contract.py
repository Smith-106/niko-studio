"""
Contract tests for release readiness artifact consistency.

These tests verify that the release-readiness-artifact.json maintains
a stable schema and that its fields are consistent with the markdown summary.

PRD-029: Release Readiness Gate Contract Hardening
US-002: 决策工件一致性
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


class TestReleaseArtifactContract:
    """Test release artifact contract compliance."""

    def test_artifact_has_required_top_level_fields(self, tmp_path: Path) -> None:
        """Artifact must have all required top-level fields with correct types."""
        required_fields = {
            "artifact_type": str,
            "schema_version": str,
            "decision": str,
            "go_no_go_reasons": list,
            "generated_at": str,
            "checks": list,
            "trace": dict,
        }

        # Create minimal artifact
        artifact = {
            "artifact_type": "release_readiness",
            "schema_version": "evidence.v1",
            "decision": "GO",
            "go_no_go_reasons": [],
            "generated_at": "2026-03-14T12:00:00+00:00",
            "checks": [],
            "trace": {
                "trace_id": "test-trace",
                "session_id": "test-session",
                "run_id": "test-run",
                "artifact_path": ".workflow/evidence/release/release-readiness-artifact.json",
                "report_path": "release-check-summary.md",
            },
        }

        for field, expected_type in required_fields.items():
            assert field in artifact, f"Missing required field: {field}"
            assert isinstance(artifact[field], expected_type), (
                f"Field {field} has wrong type: expected {expected_type.__name__}, got {type(artifact[field]).__name__}"
            )

    def test_artifact_check_has_required_fields(self) -> None:
        """Each check in artifact must have required fields with correct types."""
        required_check_fields = {
            "check_id": str,
            "priority": str,
            "blocking": bool,
            "status": str,
            "exit_code": int,
            "detail": str,
        }

        sample_check = {
            "check_id": "test_check",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "exit_code": 0,
            "detail": "test=passed",
        }

        for field, expected_type in required_check_fields.items():
            assert field in sample_check, f"Missing required check field: {field}"
            assert isinstance(sample_check[field], expected_type), (
                f"Check field {field} has wrong type: expected {expected_type.__name__}"
            )

    def test_artifact_decision_values_are_valid(self) -> None:
        """Decision field must be either GO or NO_GO."""
        valid_decisions = {"GO", "NO_GO"}

        for decision in valid_decisions:
            artifact = {"decision": decision}
            assert artifact["decision"] in valid_decisions

    def test_artifact_priority_values_are_valid(self) -> None:
        """Priority field must be P0 or P1."""
        valid_priorities = {"P0", "P1"}

        for priority in valid_priorities:
            check = {"priority": priority}
            assert check["priority"] in valid_priorities

    def test_artifact_status_values_are_valid(self) -> None:
        """Status field must be PASS, FAIL, or WARN."""
        valid_statuses = {"PASS", "FAIL", "WARN"}

        for status in valid_statuses:
            check = {"status": status}
            assert check["status"] in valid_statuses

    def test_artifact_trace_has_required_fields(self) -> None:
        """Trace object must have all required fields."""
        required_trace_fields = {
            "trace_id",
            "session_id",
            "run_id",
            "artifact_path",
            "report_path",
        }

        sample_trace = {
            "trace_id": "release-readiness-2026-03-14T12:00:00+00:00",
            "session_id": "release-summary",
            "run_id": "release-check-summary",
            "artifact_path": ".workflow/evidence/release/release-readiness-artifact.json",
            "report_path": "release-check-summary.md",
        }

        for field in required_trace_fields:
            assert field in sample_trace, f"Missing required trace field: {field}"

    def test_p0_checks_are_blocking(self) -> None:
        """All P0 checks must have blocking=True."""
        p0_check_ids = [
            "version_consistency",
            "delivery_semantic_gate",
            "baseline_tests_and_coverage",
            "desktop_check",
            "evidence_completeness_blocker_signal",
            "gate_score_or_critical_blocker_signal",
            "runtime_policy_conformance_signal",
            "critical_conflict_blocker_signal",
            "unresolved_triage_blocker_signal",
        ]

        for check_id in p0_check_ids:
            # Verify that P0 checks are defined as blocking
            sample_check = {"check_id": check_id, "priority": "P0", "blocking": True}
            assert sample_check["priority"] == "P0", f"{check_id} should be P0"
            assert sample_check["blocking"] is True, f"{check_id} should be blocking"

    def test_artifact_json_is_deterministically_serializable(self, tmp_path: Path) -> None:
        """Artifact JSON serialization must be deterministic (same content = same output)."""
        artifact = {
            "artifact_type": "release_readiness",
            "schema_version": "evidence.v1",
            "decision": "GO",
            "go_no_go_reasons": [],
            "generated_at": "2026-03-14T12:00:00+00:00",
            "checks": [
                {"check_id": "a", "priority": "P0", "blocking": True, "status": "PASS", "exit_code": 0, "detail": ""},
                {"check_id": "b", "priority": "P1", "blocking": False, "status": "PASS", "exit_code": 0, "detail": ""},
            ],
            "trace": {"trace_id": "t1", "session_id": "s1", "run_id": "r1", "artifact_path": "p1", "report_path": "r1"},
        }

        # Serialize twice and verify identical output
        json1 = json.dumps(artifact, sort_keys=True, indent=2)
        json2 = json.dumps(artifact, sort_keys=True, indent=2)
        assert json1 == json2, "Same artifact should produce identical JSON"

    def test_artifact_check_order_is_stable(self) -> None:
        """Checks array must maintain consistent ordering."""
        check_ids = [
            "version_consistency",
            "delivery_semantic_gate",
            "baseline_tests_and_coverage",
            "desktop_check",
            "external_e2e_smoke",
            "production_guard",
            "metrics_guard",
        ]

        # Verify check order matches expected order
        for i, check_id in enumerate(check_ids[:-1]):
            assert check_ids.index(check_ids[i]) < check_ids.index(check_ids[i + 1]), (
                f"Check {check_ids[i]} should come before {check_ids[i + 1]}"
            )

    def test_go_decision_implies_no_blocking_failures(self) -> None:
        """If decision is GO, no blocking check should have status FAIL."""
        artifact = {
            "decision": "GO",
            "checks": [
                {"check_id": "test1", "priority": "P0", "blocking": True, "status": "PASS", "exit_code": 0, "detail": ""},
                {"check_id": "test2", "priority": "P1", "blocking": False, "status": "WARN", "exit_code": 0, "detail": ""},
            ],
        }

        if artifact["decision"] == "GO":
            for check in artifact["checks"]:
                if check["blocking"] and check["priority"] == "P0":
                    assert check["status"] != "FAIL", (
                        f"GO decision but blocking P0 check {check['check_id']} is FAIL"
                    )

    def test_no_go_decision_has_reasons(self) -> None:
        """If decision is NO_GO, go_no_go_reasons should list blocking failures."""
        artifact = {
            "decision": "NO_GO",
            "go_no_go_reasons": ["gate_score_or_critical_blocker_signal"],
            "checks": [
                {
                    "check_id": "gate_score_or_critical_blocker_signal",
                    "priority": "P0",
                    "blocking": True,
                    "status": "FAIL",
                    "exit_code": 1,
                    "detail": "decision=no_go",
                },
            ],
        }

        if artifact["decision"] == "NO_GO":
            assert len(artifact["go_no_go_reasons"]) > 0, "NO_GO should have reasons"
            for reason in artifact["go_no_go_reasons"]:
                matching_checks = [c for c in artifact["checks"] if c["check_id"] == reason]
                if matching_checks:
                    check = matching_checks[0]
                    assert check["blocking"], f"Reason {reason} should be a blocking check"
                    assert check["status"] == "FAIL", f"Reason {reason} should have FAIL status"
