import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[3] / "scripts" / "release_check_summary.py"
spec = importlib.util.spec_from_file_location("release_check_summary", MODULE_PATH)
release_summary = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(release_summary)


def test_build_check_result_accepts_structured_detail_string():
    result = release_summary.build_check_result(
        check_id="version_consistency",
        priority="P0",
        blocking=True,
        exit_code=0,
        detail=release_summary._format_detail_pairs([("script", "scripts/check_versions.py")]),
    )

    assert result["status"] == "PASS"
    assert result["detail"] == "script=scripts/check_versions.py"


def test_parse_pytest_counts_reports_passed_status():
    status, count = release_summary.parse_pytest_counts("24 passed in 1.20s")

    assert status == "passed"
    assert count == "24"


def test_parse_pytest_counts_reports_failed_status():
    status, count = release_summary.parse_pytest_counts("2 failed in 0.90s")

    assert status == "failed"
    assert count == "2"


def test_detail_formatter_produces_stable_key_order():
    detail = release_summary._format_detail_pairs([
        ("status", "passed"),
        ("passed_count", "24"),
    ])

    assert detail == "status=passed,passed_count=24"


def test_slo_baseline_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "weekly-1.md").write_text(
        "TTFT improved\nE2E stable\n"
        "effective_hit_rate=0.8\ncontext_budget_utilization=0.7\n"
        "gate consistency verified\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.slo_baseline_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "keywords_present" in detail


def test_slo_baseline_signal_warn_when_missing_keywords(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "quality-1.md").write_text("only TTFT mentioned", encoding="utf-8")

    status, exit_code, detail = release_summary.slo_baseline_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "missing_keywords=" in detail


def test_evidence_links_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "evidence.md").write_text(
        "evidence_links:\n- [weekly](../weekly/review.md)\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.evidence_links_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "traceable_link=present" in detail


def test_evidence_links_signal_warn_detail_uses_stable_key_order(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "review.md").write_text("no links here", encoding="utf-8")

    status, exit_code, detail = release_summary.evidence_links_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "evidence_links_key=missing,traceable_link=missing"


def test_memory_observability_signal_warn_detail_keeps_empty_key(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "memory-metrics.md").write_text(
        "c_effective=1.2\ns_final=0.33\nr_memory=0.44\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.memory_observability_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "missing_metrics=,invalid_metrics=c_effective"


def test_migration_rollback_signal_warn_detail_uses_stable_key_order(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "notes.md").write_text("migration discussed", encoding="utf-8")

    status, exit_code, detail = release_summary.migration_rollback_evidence_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "migration=present,rollback=missing,traceable_link=missing"


def test_self_learning_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "learning.md").write_text(
        "reflector triggered\ncurator applied\nplaybook updated\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.self_learning_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "fields_present=" in detail


def test_self_learning_signal_warn_when_missing_fields(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "review.md").write_text("reflector only", encoding="utf-8")

    status, exit_code, detail = release_summary.self_learning_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "missing_fields=" in detail


def test_memory_observability_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "memory-metrics.md").write_text(
        "c_effective=0.75\ns_final=0.66\nr_memory=0.58\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.memory_observability_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "metrics_present" in detail


def test_memory_observability_signal_warn_when_missing_or_invalid(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "memory-metrics.md").write_text(
        "c_effective=1.2\ns_final=0.33\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.memory_observability_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "missing_metrics=r_memory" in detail
    assert "invalid_metrics=c_effective" in detail


def test_compliance_keywords_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "compliance.md").write_text(
        "RBAC policy verified\naudit trail checked\nrollback rehearsed\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.compliance_keywords_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "keywords_present=rbac,audit,rollback" in detail


def test_compliance_keywords_signal_warn_when_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "notes.md").write_text("rbac only", encoding="utf-8")

    status, exit_code, detail = release_summary.compliance_keywords_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "missing_keywords=" in detail


def test_migration_rollback_evidence_signal_pass(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "change-plan.md").write_text(
        "migration plan reviewed\n"
        "rollback strategy validated\n"
        "evidence link: [runbook](../weekly/runbook.md)\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.migration_rollback_evidence_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert "migration=present" in detail
    assert "rollback=present" in detail
    assert "traceable_link=present" in detail


def test_migration_rollback_evidence_signal_warn_when_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "notes.md").write_text("migration discussed", encoding="utf-8")

    status, exit_code, detail = release_summary.migration_rollback_evidence_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "migration=present,rollback=missing,traceable_link=missing"


def test_quality_level_trace_signal_pass_when_level_fields_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "quality-level.md").write_text(
        "effective_quality_level=high\nquality_level_used=high\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.quality_level_trace_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "effective_quality_level=high,quality_level_used=high"


def test_quality_level_trace_signal_warn_when_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    status, exit_code, detail = release_summary.quality_level_trace_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "effective_quality_level=missing,quality_level_used=missing"


def test_quality_level_trace_signal_warn_when_partial_fields_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "quality-level.md").write_text(
        "effective_quality_level=high\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.quality_level_trace_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "effective_quality_level=high,quality_level_used=missing"


def test_degrade_trace_signal_pass_when_reason_and_steps_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "degrade.md").write_text(
        "degrade_reason=timeout:critic\ndegrade_steps=[{from:ultra,to:high}]\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.degrade_trace_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "degrade_reason=present,degrade_steps=present"


def test_degrade_trace_signal_warn_when_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "degrade.md").write_text("degrade_reason=timeout:critic\n", encoding="utf-8")

    status, exit_code, detail = release_summary.degrade_trace_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "degrade_reason=present,degrade_steps=missing"


def test_critical_gate_enforcement_signal_pass_when_enabled_marker_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "critical.md").write_text("critical_gate_always_on=true\n", encoding="utf-8")

    status, exit_code, detail = release_summary.critical_gate_enforcement_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "critical_gate=enforced"


def test_critical_gate_enforcement_signal_warn_when_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    status, exit_code, detail = release_summary.critical_gate_enforcement_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "critical_gate=missing"


def test_chapter_gate_scoring_signal_pass_when_score_recommendation_and_critical_count_satisfy_gate(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "chapter-gate.md").write_text(
        "quality_score=99.2\n"
        "publish_recommendation=pass\n"
        "critical_issue_count=0\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_scoring_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "quality_score=99.2,threshold=99.0,publish_recommendation=pass,"
        "critical_issue_count=0,decision=go"
    )


def test_chapter_gate_scoring_signal_warn_when_score_below_threshold(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "chapter-gate.md").write_text(
        "quality_score=98.8\n"
        "publish_recommendation=pass\n"
        "critical_issue_count=0\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_scoring_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == (
        "quality_score=98.8,threshold=99.0,publish_recommendation=pass,"
        "critical_issue_count=0,decision=no_go"
    )


def test_chapter_gate_scoring_signal_warn_when_fields_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "chapter-gate.md").write_text(
        "quality_score=99.5\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_scoring_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == (
        "quality_score=99.5,threshold=99.0,publish_recommendation=missing,"
        "critical_issue_count=missing,decision=no_go"
    )


def test_cycle_time_kpi_measurement_signal_pass_with_required_rules(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "kpi.md").write_text(
        "baseline_window_days=7\n"
        "measurement_window_days=7\n"
        "baseline_state=ready\n"
        "cycle_time_baseline_median=42\n"
        "cycle_time_current_median=29\n"
        "eligible_samples=8\n"
        "exclusion_reason_codes=missing_timestamps,aborted_run\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.cycle_time_kpi_measurement_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "window_policy=full_7_day_only,manual_override=forbidden,"
        "missing_rules=,present_exclusion_reason_codes=missing_timestamps,aborted_run"
    )


def test_cycle_time_kpi_measurement_signal_warn_when_rules_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "kpi.md").write_text(
        "baseline_state=not_ready\n"
        "manual text only\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.cycle_time_kpi_measurement_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "window_policy=full_7_day_only" in detail
    assert "manual_override=forbidden" in detail
    assert "present_exclusion_reason_codes=" in detail


def test_comparable_quality_rubric_signal_pass_when_all_conditions_hold(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "rubric.md").write_text(
        "quality_score=99.4\n"
        "publish_recommendation=pass\n"
        "critical_issue_count=0\n"
        "effective_quality_level=high\n"
        "quality_level_used=high\n"
        "degrade_reason=none\n"
        "degrade_steps=[]\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.comparable_quality_rubric_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "rubric_version=v1,quality_score=99.4,threshold=99.0,critical_issue_count=0,"
        "publish_recommendation=pass,quality_level_match=yes,degrade_trace_complete=yes,decision=comparable"
    )


def test_comparable_quality_rubric_signal_warn_when_level_mismatch_or_missing_degrade_steps(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "rubric.md").write_text(
        "quality_score=99.8\n"
        "publish_recommendation=pass\n"
        "critical_issue_count=0\n"
        "effective_quality_level=ultra\n"
        "quality_level_used=high\n"
        "degrade_reason=timeout\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.comparable_quality_rubric_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "rubric_version=v1" in detail
    assert "quality_level_match=no" in detail
    assert "degrade_trace_complete=no" in detail
    assert "decision=not_comparable" in detail


def test_weekly_kpi_dashboard_schema_signal_pass_when_required_fields_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "weekly-kpi-dashboard.md").write_text(
        "schema_version=weekly_kpi_dashboard.v1\n"
        "window_label=2026-W08\n"
        "baseline_state=ready\n"
        "cycle_time_baseline_median=42\n"
        "cycle_time_current_median=31\n"
        "cycle_time_trend=down\n"
        "comparability_decision=comparable\n"
        "chapter_gate_aggregation_result=aggregated\n"
        "evidence_links:\n"
        "- ../weekly/review.md\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_dashboard_schema_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "schema_name=weekly_kpi_dashboard,schema_version=v1,"
        "manual_override=forbidden,missing_fields="
    )


def test_weekly_kpi_dashboard_schema_signal_warn_when_required_fields_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "weekly-kpi-dashboard.md").write_text(
        "schema_version=weekly_kpi_dashboard.v1\n"
        "window_label=2026-W08\n"
        "baseline_state=not_ready\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_dashboard_schema_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "schema_name=weekly_kpi_dashboard" in detail
    assert "schema_version=v1" in detail
    assert "manual_override=forbidden" in detail
    assert "missing_fields=" in detail


def test_weekly_kpi_rollup_readiness_signal_pass_when_required_rollup_fields_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "weekly-kpi-rollup.md").write_text(
        "window_label=2026-W08\n"
        "baseline_state=ready\n"
        "cycle_time_baseline_median=45\n"
        "cycle_time_current_median=33\n"
        "cycle_time_trend=down\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_rollup_readiness_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "rollup_source=canonical_evidence,manual_override=forbidden,"
        "baseline_state=ready,cycle_time_trend=down,missing_fields="
    )


def test_weekly_kpi_rollup_readiness_signal_warn_when_rollup_fields_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "weekly-kpi-rollup.md").write_text(
        "window_label=2026-W08\n"
        "baseline_state=insufficient_sample\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_rollup_readiness_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "rollup_source=canonical_evidence" in detail
    assert "manual_override=forbidden" in detail
    assert "baseline_state=insufficient_sample" in detail
    assert "cycle_time_trend=missing" in detail
    assert "missing_fields=" in detail


def test_weekly_kpi_comparability_visibility_signal_pass_when_comparability_and_trend_present(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (weekly_dir / "weekly-kpi-visibility.md").write_text(
        "comparability_decision=comparable\n"
        "cycle_time_trend=down\n"
        "baseline_state=ready\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_comparability_visibility_signal(weekly_dir, quality_dir)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,"
        "comparability_decision=comparable,cycle_time_trend=down,baseline_state=ready,missing_fields="
    )


def test_weekly_kpi_comparability_visibility_signal_warn_when_linkage_fields_missing(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    (quality_dir / "weekly-kpi-visibility.md").write_text(
        "comparability_decision=not_comparable\n",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.weekly_kpi_comparability_visibility_signal(weekly_dir, quality_dir)

    assert status == "WARN"
    assert exit_code == 0
    assert "visibility_source=comparable_quality_plus_cycle_time" in detail
    assert "manual_override=forbidden" in detail
    assert "comparability_decision=not_comparable" in detail
    assert "cycle_time_trend=missing" in detail
    assert "baseline_state=missing" in detail
    assert "missing_fields=" in detail


def test_evidence_freshness_signal_pass_when_recent_file_exists(tmp_path):
    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    weekly_dir.mkdir()
    quality_dir.mkdir()

    recent_file = weekly_dir / "recent.md"
    recent_file.write_text("fresh evidence", encoding="utf-8")

    now = datetime(2026, 2, 24, 12, 0, tzinfo=timezone.utc)
    recent_mtime = (now - timedelta(days=3)).timestamp()
    os.utime(recent_file, (recent_mtime, recent_mtime))

    status, exit_code, detail = release_summary.evidence_freshness_signal(weekly_dir, quality_dir, now=now)

    assert status == "PASS"
    assert exit_code == 0
    assert "fresh_files=1" in detail


def test_feedback_artifact_linkage_signal_warn_when_sessions_missing(tmp_path):
    status, exit_code, detail = release_summary.feedback_artifact_linkage_signal(tmp_path / "sessions")

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "snapshots_scanned=0,linked_feedback_artifacts=0,invalid_snapshots=0"


def test_feedback_artifact_linkage_signal_pass_when_valid_feedback_snapshot_exists(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/snapshot.json", "/tmp/checkpoint.json"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-revision-round-1",
            "revision_id": "revision-round-1",
        },
        "output": {
            "feedback_artifacts": [
                {
                    "feedback_id": "feedback-round-1-1",
                    "round_id": "round-1",
                    "scope": "chapter",
                    "anchor": "chapter-1",
                    "severity": "medium",
                    "issue": "quality improvement needed",
                    "recommendation": "revise according to critic feedback",
                    "source": "critic",
                }
            ]
        },
    }
    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.feedback_artifact_linkage_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "snapshots_scanned=1,linked_feedback_artifacts=1,invalid_snapshots=0"


def test_feedback_artifact_linkage_signal_warn_when_snapshot_invalid(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        "{}",
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.feedback_artifact_linkage_signal(sessions_root)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "snapshots_scanned=1,linked_feedback_artifacts=0,invalid_snapshots=1"


def test_conflict_artifact_linkage_signal_warn_when_sessions_missing(tmp_path):
    status, exit_code, detail = release_summary.conflict_artifact_linkage_signal(tmp_path / "sessions")

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0"


def test_conflict_artifact_linkage_signal_pass_when_valid_conflict_snapshot_exists(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/snapshot.json", "/tmp/checkpoint.json"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-revision-round-1",
            "revision_id": "revision-round-1",
        },
        "output": {
            "canonical_conflicts": [
                {
                    "conflict_id": "CTD-0001",
                    "conflict_type": "causality",
                    "severity": "critical",
                    "critical_condition": "self_referential_non_identity_relation",
                }
            ]
        },
    }
    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.conflict_artifact_linkage_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "snapshots_scanned=1,linked_conflict_artifacts=1,critical_conflicts_linked=1,invalid_snapshots=0"


def test_conflict_artifact_linkage_signal_warn_when_missing_trace_or_links(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "trace": {
            "session_id": "",
            "run_id": "run-revision-round-1",
            "revision_id": "revision-round-1",
        },
        "output": {
            "canonical_conflicts": [
                {
                    "conflict_id": "CTD-0001",
                    "conflict_type": "causality",
                    "severity": "critical",
                }
            ]
        },
    }
    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.conflict_artifact_linkage_signal(sessions_root)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "snapshots_scanned=1,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=1"




def test_chapter_gate_evidence_linkage_signal_warn_when_sessions_missing(tmp_path):
    status, exit_code, detail = release_summary.chapter_gate_evidence_linkage_signal(tmp_path / "sessions")

    assert status == "WARN"
    assert exit_code == 0
    assert detail == (
        "snapshots_scanned=0,eligible_release_gate_runs=0,chapter_gate_checks_linked=0,"
        "aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=0"
    )


def test_chapter_gate_evidence_linkage_signal_pass_when_valid_release_gate_snapshot_exists(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "release_gate_run",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/release-check-summary.md"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-release-1",
            "check_id": "chapter_gate_scoring_signal",
        },
        "output": {
            "check_id": "chapter_gate_scoring_signal",
            "checks": [
                {
                    "check_id": "chapter_gate_scoring_signal",
                    "status": "PASS",
                    "detail": "quality_score=99.2,threshold=99.0,publish_recommendation=pass,critical_issue_count=0,decision=go",
                }
            ],
        },
    }
    (snapshot_dir / "release-gate-run.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_evidence_linkage_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "snapshots_scanned=1,eligible_release_gate_runs=1,chapter_gate_checks_linked=1,"
        "aggregation_window=active_sessions,result=aggregated,invalid_snapshots=0"
    )


def test_chapter_gate_evidence_linkage_signal_warn_when_trace_or_links_invalid(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "release_gate_run",
        "schema_version": "evidence.v1",
        "trace": {
            "session_id": "",
            "run_id": "run-release-1",
            "check_id": "chapter_gate_scoring_signal",
        },
        "output": {
            "check_id": "chapter_gate_scoring_signal",
            "checks": [
                {
                    "check_id": "chapter_gate_scoring_signal",
                    "status": "WARN",
                    "detail": "quality_score=98.8,threshold=99.0,publish_recommendation=pass,critical_issue_count=0,decision=no_go",
                }
            ],
        },
    }
    (snapshot_dir / "release-gate-run.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_evidence_linkage_signal(sessions_root)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == (
        "snapshots_scanned=1,eligible_release_gate_runs=0,chapter_gate_checks_linked=0,"
        "aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=1"
    )


def test_chapter_gate_evidence_linkage_signal_warn_when_chapter_gate_not_linked(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "release_gate_run",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/release-check-summary.md"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-release-1",
            "check_id": "tasks_completion_signal",
        },
        "output": {
            "check_id": "tasks_completion_signal",
            "checks": [
                {
                    "check_id": "tasks_completion_signal",
                    "status": "PASS",
                    "detail": "checked=4,unchecked=0,completion_ratio=100%,json_parse_error=none",
                }
            ],
        },
    }
    (snapshot_dir / "release-gate-run.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.chapter_gate_evidence_linkage_signal(sessions_root)

    assert status == "WARN"
    assert exit_code == 0
    assert detail == (
        "snapshots_scanned=1,eligible_release_gate_runs=1,chapter_gate_checks_linked=0,"
        "aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=0"
    )


def test_critical_conflict_blocker_signal_pass_when_no_critical_conflicts(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/snapshot.json"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-revision-round-1",
            "revision_id": "revision-round-1",
        },
        "output": {
            "canonical_conflicts": [
                {
                    "conflict_id": "CTD-0001",
                    "conflict_type": "timeline",
                    "severity": "major",
                    "critical_condition": "none",
                }
            ]
        },
    }
    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.critical_conflict_blocker_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "snapshots_scanned=1,linked_conflict_artifacts=1,critical_conflicts_linked=0,invalid_snapshots=0,decision=go"


def test_critical_conflict_blocker_signal_fail_when_critical_conflict_exists(tmp_path):
    sessions_root = tmp_path / "sessions"
    snapshot_dir = sessions_root / "active" / "sess-1" / ".data" / "generation-snapshots"
    snapshot_dir.mkdir(parents=True)

    payload = {
        "artifact_type": "quality_feedback",
        "schema_version": "evidence.v1",
        "evidence_links": ["/tmp/snapshot.json"],
        "trace": {
            "session_id": "sess-1",
            "run_id": "run-revision-round-1",
            "revision_id": "revision-round-1",
        },
        "output": {
            "canonical_conflicts": [
                {
                    "conflict_id": "CTD-0001",
                    "conflict_type": "causality",
                    "severity": "critical",
                    "critical_condition": "self_referential_non_identity_relation",
                }
            ]
        },
    }
    (snapshot_dir / "revision-round-1-feedback.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.critical_conflict_blocker_signal(sessions_root)

    assert status == "FAIL"
    assert exit_code == 1
    assert detail == "snapshots_scanned=1,linked_conflict_artifacts=1,critical_conflicts_linked=1,invalid_snapshots=0,decision=no_go"


def test_unresolved_triage_blocker_signal_pass_when_all_resolved_or_rejected(tmp_path):
    sessions_root = tmp_path / "sessions"
    state_dir_1 = sessions_root / "active" / "sess-1" / ".data"
    state_dir_2 = sessions_root / "active" / "sess-2" / ".data"
    state_dir_1.mkdir(parents=True)
    state_dir_2.mkdir(parents=True)

    (state_dir_1 / "state.json").write_text(
        json.dumps({"metadata": {"triage_state": "resolved"}}, ensure_ascii=False),
        encoding="utf-8",
    )
    (state_dir_2 / "state.json").write_text(
        json.dumps({"metadata": {"triage_state": "rejected"}}, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.unresolved_triage_blocker_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "state_files_scanned=2,linked_triage_records=2,unresolved_triage_records=0,invalid_state_files=0,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=go"


def test_unresolved_triage_blocker_signal_fail_when_unresolved_exists(tmp_path):
    sessions_root = tmp_path / "sessions"
    state_dir = sessions_root / "active" / "sess-1" / ".data"
    state_dir.mkdir(parents=True)

    (state_dir / "state.json").write_text(
        json.dumps({"metadata": {"triage_state": "in_progress"}}, ensure_ascii=False),
        encoding="utf-8",
    )

    status, exit_code, detail = release_summary.unresolved_triage_blocker_signal(sessions_root)

    assert status == "FAIL"
    assert exit_code == 1
    assert detail == "state_files_scanned=1,linked_triage_records=1,unresolved_triage_records=1,invalid_state_files=0,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=no_go"


    status, exit_code, detail = release_summary.tasks_completion_signal(
        tasks_code=2,
        tasks_payload=None,
        tasks_parse_error=None,
    )

    assert status == "FAIL"
    assert exit_code == 2
    assert detail == "checker_exit=2,json_parse_error=none"


def test_tasks_completion_signal_warn_stable_detail_when_payload_missing():
    status, exit_code, detail = release_summary.tasks_completion_signal(
        tasks_code=0,
        tasks_payload=None,
        tasks_parse_error="json payload not found in output",
    )

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "checker_exit=0,json_parse_error=json payload not found in output"


def test_tasks_completion_signal_warn_stable_detail_when_incomplete():
    status, exit_code, detail = release_summary.tasks_completion_signal(
        tasks_code=0,
        tasks_payload={
            "total_checked": 3,
            "total_unchecked": 1,
            "completion_ratio": 75,
        },
        tasks_parse_error=None,
    )

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "checked=3,unchecked=1,completion_ratio=75%,json_parse_error=none"


def test_tasks_completion_signal_pass_stable_detail_when_complete():
    status, exit_code, detail = release_summary.tasks_completion_signal(
        tasks_code=0,
        tasks_payload={
            "total_checked": 4,
            "total_unchecked": 0,
            "completion_ratio": 100,
        },
        tasks_parse_error=None,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "checked=4,unchecked=0,completion_ratio=100%,json_parse_error=none"


def test_evidence_coverage_signal_warn_and_stable_detail():
    status, exit_code, detail = release_summary.evidence_coverage_signal(
        quality_non_template=0,
        weekly_non_template=1,
    )

    assert status == "WARN"
    assert exit_code == 0
    assert detail == "quality_non_template=0,weekly_non_template=1"


def test_evidence_coverage_signal_pass_and_stable_detail():
    status, exit_code, detail = release_summary.evidence_coverage_signal(
        quality_non_template=1,
        weekly_non_template=2,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert detail == "quality_non_template=1,weekly_non_template=2"


def test_evidence_completeness_blocker_signal_fail_when_required_classes_missing():
    status, exit_code, detail = release_summary.evidence_completeness_blocker_signal(
        quality_non_template=0,
        weekly_non_template=1,
        machine_payload_available=False,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert detail == (
        "quality_non_template=0,weekly_non_template=1,machine_payload_available=no,"
        "missing_evidence_classes=quality_evidence,weekly_review_evidence,release_machine_payload,decision=no_go"
    )


def test_evidence_completeness_blocker_signal_pass_when_all_required_classes_present():
    status, exit_code, detail = release_summary.evidence_completeness_blocker_signal(
        quality_non_template=1,
        weekly_non_template=2,
        machine_payload_available=True,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "quality_non_template=1,weekly_non_template=2,machine_payload_available=yes,"
        "missing_evidence_classes=,decision=go"
    )


def test_gate_score_or_critical_blocker_signal_fail_when_gate_is_fail():
    status, exit_code, detail = release_summary.gate_score_or_critical_blocker_signal(
        chapter_gate_status="FAIL",
        critical_conflict_status="PASS",
        unresolved_triage_status="PASS",
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert detail == (
        "chapter_gate_status=FAIL,critical_conflict_status=PASS,unresolved_triage_status=PASS,"
        "blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=no_go"
    )


def test_gate_score_or_critical_blocker_signal_pass_when_all_blockers_clear():
    status, exit_code, detail = release_summary.gate_score_or_critical_blocker_signal(
        chapter_gate_status="PASS",
        critical_conflict_status="PASS",
        unresolved_triage_status="PASS",
    )

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,"
        "blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=go"
    )


def test_runtime_policy_conformance_signal_pass_when_contracts_align(tmp_path):
    quality_doc = tmp_path / "QUALITY_CRITERIA.md"
    pdd_doc = tmp_path / "PDD.md"

    quality_doc.write_text("Quality pass threshold: >= 99%\n", encoding="utf-8")
    pdd_doc.write_text(
        "\n".join([
            "3. 若 95 <= total_score < 99 => HUMAN_REVIEW",
            "4. 若 50 <= total_score < 95 => REVISE",
            "5. 若 total_score < 50 => REWRITE",
            "0. missing input => `BLOCKED`",
        ]),
        encoding="utf-8",
    )

    runtime_contract = {
        "quality_pass_score": 99.0,
        "human_review_score": 95.0,
        "revise_lower_bound": 50.0,
        "rewrite_below": 50.0,
        "novel_quality_pass_threshold": 99.0,
        "default_pass_score": 99.0,
        "default_human_review_score": 95.0,
        "publish_from_go": "pass",
        "publish_from_soft_go": "revise",
        "publish_from_no_go": "block",
        "terminal_default_decision": "go",
        "terminal_no_go_preserved": True,
        "quality_mode_consistent": True,
    }

    status, exit_code, detail = release_summary.runtime_policy_conformance_signal(
        quality_doc=quality_doc,
        pdd_doc=pdd_doc,
        runtime_contract=runtime_contract,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert detail == (
        "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,"
        "policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,"
        "publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,"
        "terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go"
    )


def test_runtime_policy_conformance_signal_fail_when_threshold_or_mapping_drifts(tmp_path):
    quality_doc = tmp_path / "QUALITY_CRITERIA.md"
    pdd_doc = tmp_path / "PDD.md"

    quality_doc.write_text("Quality pass threshold: >= 99%\n", encoding="utf-8")
    pdd_doc.write_text(
        "\n".join([
            "3. 若 95 <= total_score < 99 => HUMAN_REVIEW",
            "4. 若 50 <= total_score < 95 => REVISE",
            "5. 若 total_score < 50 => REWRITE",
            "0. missing input => `BLOCKED`",
        ]),
        encoding="utf-8",
    )

    runtime_contract = {
        "quality_pass_score": 98.0,
        "human_review_score": 94.0,
        "revise_lower_bound": 50.0,
        "rewrite_below": 50.0,
        "novel_quality_pass_threshold": 99.0,
        "default_pass_score": 98.0,
        "default_human_review_score": 94.0,
        "publish_from_go": "pass",
        "publish_from_soft_go": "pass",
        "publish_from_no_go": "block",
        "terminal_default_decision": "",
        "terminal_no_go_preserved": False,
        "quality_mode_consistent": False,
    }

    status, exit_code, detail = release_summary.runtime_policy_conformance_signal(
        quality_doc=quality_doc,
        pdd_doc=pdd_doc,
        runtime_contract=runtime_contract,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert detail == (
        "policy_pass=99.0,runtime_pass=98.0,policy_human_review=95.0,runtime_human_review=94.0,"
        "policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,"
        "publish_from_go=pass,publish_from_soft_go=pass,publish_from_no_go=block,"
        "terminal_default_decision=missing,terminal_no_go_preserved=no,quality_mode_consistent=no,"
        "mismatches=quality_pass_score,human_review_score,novel_quality_pass_threshold,publish_from_soft_go,terminal_default_decision,terminal_no_go_preserved,quality_mode_consistent,decision=no_go"
    )



def test_codecov_signal_pass_and_stable_detail():
    status, exit_code, detail, strict_mode = release_summary.codecov_signal(
        coverage_exists=True,
        token_present=False,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert strict_mode is False
    assert detail == "strict_mode=false,token_present=false,coverage_xml=yes,result=coverage_available"


def test_codecov_signal_fail_in_strict_mode_and_stable_detail():
    status, exit_code, detail, strict_mode = release_summary.codecov_signal(
        coverage_exists=False,
        token_present=True,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert strict_mode is True
    assert detail == "strict_mode=true,token_present=true,coverage_xml=no,result=coverage_missing_in_strict_mode"


def test_build_check_detail_summary_section_contains_payload_lines():
    checks = [
        {
            "check_id": "version_consistency",
            "status": "PASS",
            "detail": "script=scripts/check_versions.py",
        }
    ]

    section = release_summary._build_check_detail_summary_section(checks)

    assert "### Check Detail Summary (from machine payload)" in section
    assert "- version_consistency: status=PASS, detail=script=scripts/check_versions.py" in section


def test_report_details_section_includes_single_check_detail_header(tmp_path):
    report_path = release_summary.REPORT_PATH
    original_report = report_path.read_text(encoding="utf-8") if report_path.exists() else None

    try:
        release_summary.run_cmd = lambda cmd, env=None: (0, "1 passed")  # type: ignore[assignment]
        release_summary.main()

        generated = report_path.read_text(encoding="utf-8")
        assert generated.count("### Check Detail Summary (from machine payload)") == 1
        assert "- tasks_completion_signal: status=" in generated
    finally:
        if original_report is None:
            if report_path.exists():
                report_path.unlink()
        else:
            report_path.write_text(original_report, encoding="utf-8")


def test_build_check_detail_summary_section_handles_empty_checks():
    section = release_summary._build_check_detail_summary_section([])

    assert "### Check Detail Summary (from machine payload)" in section
    assert "- no checks" in section


def test_build_release_readiness_artifact_contains_deterministic_trace_metadata():
    checks = [
        {
            "check_id": "gate_score_or_critical_blocker_signal",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "exit_code": 0,
            "detail": "decision=go",
        }
    ]

    payload = release_summary._build_release_readiness_artifact(
        decision="GO",
        go_no_go_reasons=[],
        generated_at="2026-02-26T04:20:00+00:00",
        checks=checks,
        report_path=release_summary.REPORT_PATH,
    )

    assert payload["artifact_type"] == "release_readiness"
    assert payload["schema_version"] == "evidence.v1"
    assert payload["generated_at"] == "2026-02-26T04:20:00+00:00"
    assert payload["checks"] == checks
    assert payload["trace"] == {
        "trace_id": "release-readiness-2026-02-26T04:20:00+00:00",
        "session_id": "release-summary",
        "run_id": "release-check-summary",
        "artifact_path": ".workflow/evidence/release/release-readiness-artifact.json",
        "report_path": "release-check-summary.md",
    }




def test_main_go_transition_when_all_blocking_checks_pass(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        exit_code = release_summary.main()

        assert exit_code == 0
        generated = release_summary.REPORT_PATH.read_text(encoding="utf-8")
        assert "- Decision: GO" in generated
        assert '"go_no_go_reasons": []' in generated
        assert "| desktop_check | P0 | true | PASS |" in generated

        artifact_payload = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )
        assert artifact_payload["decision"] == "GO"
        assert artifact_payload["go_no_go_reasons"] == []
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path




def test_main_no_go_when_non_desktop_blocking_check_fails(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
        release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

        release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: ("PASS", 0, "decision=go")
        )
        release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: ("PASS", 0, "decision=go")
        )
        release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: ("FAIL", 1, "decision=no_go")
        )

        exit_code = release_summary.main()

        assert exit_code == 1
        generated = release_summary.REPORT_PATH.read_text(encoding="utf-8")
        assert "- Decision: NO_GO" in generated
        assert '"runtime_policy_conformance_signal"' in generated
        assert "| desktop_check | P0 | true | PASS |" in generated

        artifact_payload = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )
        assert artifact_payload["decision"] == "NO_GO"
        assert "runtime_policy_conformance_signal" in artifact_payload["go_no_go_reasons"]
        assert "desktop_check" not in artifact_payload["go_no_go_reasons"]
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_desktop_check_recovery_reflected_in_report_and_artifact(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        exit_code = release_summary.main()

        assert exit_code == 0
        report_text = release_summary.REPORT_PATH.read_text(encoding="utf-8")
        payload = read_machine_payload(report_text)
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        desktop_from_report = [c for c in payload["checks"] if c["check_id"] == "desktop_check"]
        desktop_from_artifact = [c for c in artifact["checks"] if c["check_id"] == "desktop_check"]

        assert len(desktop_from_report) == 1
        assert len(desktop_from_artifact) == 1

        report_check = desktop_from_report[0]
        artifact_check = desktop_from_artifact[0]

        assert report_check["priority"] == "P0"
        assert report_check["blocking"] is True
        assert report_check["status"] == "PASS"

        assert artifact_check["priority"] == "P0"
        assert artifact_check["blocking"] is True
        assert artifact_check["status"] == "PASS"
        assert artifact["schema_version"] == "evidence.v1"
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_repeated_run_stability_for_go_and_schema_contract(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        first_exit = release_summary.main()
        first_report = release_summary.REPORT_PATH.read_text(encoding="utf-8")
        first_payload = read_machine_payload(first_report)
        first_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        second_exit = release_summary.main()
        second_report = release_summary.REPORT_PATH.read_text(encoding="utf-8")
        second_payload = read_machine_payload(second_report)
        second_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        assert first_exit == 0
        assert second_exit == 0

        assert first_payload["decision"] == "GO"
        assert second_payload["decision"] == "GO"
        assert first_payload["go_no_go_reasons"] == []
        assert second_payload["go_no_go_reasons"] == []

        first_tuples = [
            (item["check_id"], item["priority"], item["blocking"], item["status"])
            for item in first_payload["checks"]
        ]
        second_tuples = [
            (item["check_id"], item["priority"], item["blocking"], item["status"])
            for item in second_payload["checks"]
        ]
        assert first_tuples == second_tuples

        assert first_artifact["schema_version"] == "evidence.v1"
        assert second_artifact["schema_version"] == "evidence.v1"
        assert set(first_artifact["trace"].keys()) == set(second_artifact["trace"].keys())
        assert first_artifact["decision"] == "GO"
        assert second_artifact["decision"] == "GO"
        assert first_artifact["go_no_go_reasons"] == []
        assert second_artifact["go_no_go_reasons"] == []
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_schema_keyset_compatibility_for_report_payload_and_artifact(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        first_exit = release_summary.main()
        first_payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        first_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        second_exit = release_summary.main()
        second_payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        second_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        assert first_exit == 0
        assert second_exit == 0

        expected_payload_keys = {"decision", "go_no_go_reasons", "generated_at", "checks"}
        expected_artifact_keys = {
            "artifact_type",
            "schema_version",
            "generated_at",
            "decision",
            "go_no_go_reasons",
            "checks",
            "trace",
        }
        expected_trace_keys = {
            "trace_id",
            "session_id",
            "run_id",
            "artifact_path",
            "report_path",
        }
        expected_check_keys = {"check_id", "priority", "blocking", "status", "exit_code", "detail"}

        assert set(first_payload.keys()) == expected_payload_keys
        assert set(second_payload.keys()) == expected_payload_keys

        assert set(first_artifact.keys()) == expected_artifact_keys
        assert set(second_artifact.keys()) == expected_artifact_keys
        assert set(first_artifact["trace"].keys()) == expected_trace_keys
        assert set(second_artifact["trace"].keys()) == expected_trace_keys

        assert first_artifact["schema_version"] == "evidence.v1"
        assert second_artifact["schema_version"] == "evidence.v1"

        assert first_payload["decision"] == "GO"
        assert second_payload["decision"] == "GO"
        assert first_payload["go_no_go_reasons"] == []
        assert second_payload["go_no_go_reasons"] == []

        assert first_artifact["decision"] == "GO"
        assert second_artifact["decision"] == "GO"
        assert first_artifact["go_no_go_reasons"] == []
        assert second_artifact["go_no_go_reasons"] == []

        assert first_payload["checks"]
        assert second_payload["checks"]
        assert first_artifact["checks"]
        assert second_artifact["checks"]

        for check in first_payload["checks"] + second_payload["checks"]:
            assert set(check.keys()) == expected_check_keys
        for check in first_artifact["checks"] + second_artifact["checks"]:
            assert set(check.keys()) == expected_check_keys
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_policy_runtime_conformance_pass_and_reduction_stable(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        exit_code = release_summary.main()

        assert exit_code == 0
        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        runtime_checks_payload = [
            item for item in payload["checks"] if item["check_id"] == "runtime_policy_conformance_signal"
        ]
        runtime_checks_artifact = [
            item for item in artifact["checks"] if item["check_id"] == "runtime_policy_conformance_signal"
        ]

        assert len(runtime_checks_payload) == 1
        assert len(runtime_checks_artifact) == 1

        payload_check = runtime_checks_payload[0]
        artifact_check = runtime_checks_artifact[0]

        assert payload_check["priority"] == "P0"
        assert payload_check["blocking"] is True
        assert payload_check["status"] == "PASS"

        assert artifact_check["priority"] == "P0"
        assert artifact_check["blocking"] is True
        assert artifact_check["status"] == "PASS"

        assert payload["decision"] == "GO"
        assert payload["go_no_go_reasons"] == []
        assert artifact["decision"] == "GO"
        assert artifact["go_no_go_reasons"] == []
        assert "runtime_policy_conformance_signal" not in artifact["go_no_go_reasons"]
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_blocker_provenance_mapping_consistent_across_report_and_artifact(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        exit_code = release_summary.main()

        assert exit_code == 0
        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        payload_map = {item["check_id"]: item for item in payload["checks"]}
        artifact_map = {item["check_id"]: item for item in artifact["checks"]}

        critical_ids = [
            "desktop_check",
            "runtime_policy_conformance_signal",
            "gate_score_or_critical_blocker_signal",
            "evidence_completeness_blocker_signal",
        ]

        for check_id in critical_ids:
            assert check_id in payload_map
            assert check_id in artifact_map

            payload_item = payload_map[check_id]
            artifact_item = artifact_map[check_id]

            assert payload_item["priority"] == artifact_item["priority"]
            assert payload_item["blocking"] == artifact_item["blocking"]
            assert payload_item["status"] == artifact_item["status"]
            assert payload_item["detail"] == artifact_item["detail"]

        assert artifact["trace"]["session_id"] == "release-summary"
        assert artifact["trace"]["run_id"] == "release-check-summary"
        assert artifact["trace"]["artifact_path"].endswith("/release/release-readiness-artifact.json")
        assert artifact["trace"]["report_path"].endswith("/release-check-summary.md")
        assert artifact["trace"]["trace_id"].startswith("release-readiness-")
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_blocker_provenance_detail_order_deterministic_across_surfaces(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    expected_details = {
        "desktop_check": "command=npm --prefix desktop run build:sidecar && npm --prefix desktop run check",
        "evidence_completeness_blocker_signal": "quality_non_template=1,weekly_non_template=2,machine_payload_available=yes,missing_evidence_classes=,decision=go",
        "gate_score_or_critical_blocker_signal": "chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=go",
        "runtime_policy_conformance_signal": "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go",
    }
    expected_order = [
        "desktop_check",
        "evidence_completeness_blocker_signal",
        "gate_score_or_critical_blocker_signal",
        "runtime_policy_conformance_signal",
    ]

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
        release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

        release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "quality_non_template=1,weekly_non_template=2,machine_payload_available=yes,missing_evidence_classes=,decision=go",
            )
        )
        release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=go",
            )
        )
        release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go",
            )
        )

        exit_code = release_summary.main()

        assert exit_code == 0
        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        payload_map = {item["check_id"]: item for item in payload["checks"]}
        artifact_map = {item["check_id"]: item for item in artifact["checks"]}

        for check_id, expected_detail in expected_details.items():
            assert payload_map[check_id]["detail"] == expected_detail
            assert artifact_map[check_id]["detail"] == expected_detail

        payload_critical_order = [
            item["check_id"]
            for item in payload["checks"]
            if item["check_id"] in expected_order
        ]
        artifact_critical_order = [
            item["check_id"]
            for item in artifact["checks"]
            if item["check_id"] in expected_order
        ]

        assert payload_critical_order == expected_order
        assert artifact_critical_order == expected_order
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_evidence_link_provenance_parity_across_surfaces(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    expected_details = {
        "feedback_artifact_linkage_signal": "snapshots_scanned=3,linked_feedback_artifacts=3,invalid_snapshots=0",
        "conflict_artifact_linkage_signal": "snapshots_scanned=3,linked_conflict_artifacts=2,critical_conflicts_linked=1,invalid_snapshots=0",
        "chapter_gate_evidence_linkage_signal": "snapshots_scanned=3,eligible_release_gate_runs=2,chapter_gate_checks_linked=2,aggregation_window=active_sessions,result=ok,invalid_snapshots=0",
    }

    target_ids = list(expected_details.keys())

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
        release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

        release_summary.feedback_artifact_linkage_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "snapshots_scanned=3,linked_feedback_artifacts=3,invalid_snapshots=0",
            )
        )
        release_summary.conflict_artifact_linkage_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "snapshots_scanned=3,linked_conflict_artifacts=2,critical_conflicts_linked=1,invalid_snapshots=0",
            )
        )
        release_summary.chapter_gate_evidence_linkage_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "snapshots_scanned=3,eligible_release_gate_runs=2,chapter_gate_checks_linked=2,aggregation_window=active_sessions,result=ok,invalid_snapshots=0",
            )
        )

        exit_code = release_summary.main()

        assert exit_code == 0
        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        payload_map = {item["check_id"]: item for item in payload["checks"]}
        artifact_map = {item["check_id"]: item for item in artifact["checks"]}

        for check_id in target_ids:
            assert check_id in payload_map
            assert check_id in artifact_map

            payload_item = payload_map[check_id]
            artifact_item = artifact_map[check_id]

            assert payload_item["priority"] == artifact_item["priority"]
            assert payload_item["blocking"] == artifact_item["blocking"]
            assert payload_item["status"] == artifact_item["status"]
            assert payload_item["detail"] == expected_details[check_id]
            assert artifact_item["detail"] == expected_details[check_id]

        assert payload["decision"] == "GO"
        assert artifact["decision"] == "GO"
        assert payload["go_no_go_reasons"] == []
        assert artifact["go_no_go_reasons"] == []
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_freshness_and_trace_contract_consistent_across_repeated_runs(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    target_ids = [
        "evidence_freshness_signal",
        "quality_level_trace_signal",
        "degrade_trace_signal",
    ]

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
        release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

        release_summary.evidence_freshness_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "fresh_files=3,stale_files=0,window_days=14",
            )
        )
        release_summary.quality_level_trace_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "quality_level=PASS,traceable_link=present,missing_fields=",
            )
        )
        release_summary.degrade_trace_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "degrade_reason=none,degrade_steps=none,degrade_trace_complete=yes",
            )
        )

        first_exit = release_summary.main()
        assert first_exit == 0
        first_payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        first_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        second_exit = release_summary.main()
        assert second_exit == 0
        second_payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        second_artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        first_payload_map = {item["check_id"]: item for item in first_payload["checks"]}
        first_artifact_map = {item["check_id"]: item for item in first_artifact["checks"]}
        second_payload_map = {item["check_id"]: item for item in second_payload["checks"]}
        second_artifact_map = {item["check_id"]: item for item in second_artifact["checks"]}

        for check_id in target_ids:
            assert check_id in first_payload_map
            assert check_id in first_artifact_map
            assert check_id in second_payload_map
            assert check_id in second_artifact_map

            assert first_payload_map[check_id]["priority"] == first_artifact_map[check_id]["priority"]
            assert first_payload_map[check_id]["blocking"] == first_artifact_map[check_id]["blocking"]
            assert first_payload_map[check_id]["status"] == first_artifact_map[check_id]["status"]
            assert first_payload_map[check_id]["detail"] == first_artifact_map[check_id]["detail"]

            assert second_payload_map[check_id]["priority"] == second_artifact_map[check_id]["priority"]
            assert second_payload_map[check_id]["blocking"] == second_artifact_map[check_id]["blocking"]
            assert second_payload_map[check_id]["status"] == second_artifact_map[check_id]["status"]
            assert second_payload_map[check_id]["detail"] == second_artifact_map[check_id]["detail"]

            assert first_payload_map[check_id]["detail"] == second_payload_map[check_id]["detail"]
            assert first_artifact_map[check_id]["detail"] == second_artifact_map[check_id]["detail"]

        for artifact in [first_artifact, second_artifact]:
            trace = artifact["trace"]
            assert trace["session_id"] == "release-summary"
            assert trace["run_id"] == "release-check-summary"
            assert trace["artifact_path"].endswith("/release/release-readiness-artifact.json")
            assert trace["report_path"].endswith("/release-check-summary.md")
            assert str(trace["trace_id"]).startswith("release-readiness-")

        assert first_payload["decision"] == "GO"
        assert first_artifact["decision"] == "GO"
        assert second_payload["decision"] == "GO"
        assert second_artifact["decision"] == "GO"

        assert first_payload["go_no_go_reasons"] == []
        assert first_artifact["go_no_go_reasons"] == []
        assert second_payload["go_no_go_reasons"] == []
        assert second_artifact["go_no_go_reasons"] == []

        assert first_payload["generated_at"] != second_payload["generated_at"]
        assert first_artifact["generated_at"] == first_payload["generated_at"]
        assert second_artifact["generated_at"] == second_payload["generated_at"]
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path


def test_main_no_go_reason_order_matches_blocking_check_order_and_excludes_non_blockers(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    target_ids = [
        "desktop_check",
        "evidence_completeness_blocker_signal",
        "gate_score_or_critical_blocker_signal",
        "runtime_policy_conformance_signal",
        "external_e2e_smoke",
    ]

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
        release_summary.run_cmd = fake_run_cmd  # type: ignore[assignment]

        release_summary.evidence_completeness_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "FAIL",
                1,
                "quality_non_template=0,weekly_non_template=0,machine_payload_available=no,missing_evidence_classes=quality,weekly,decision=no_go",
            )
        )
        release_summary.gate_score_or_critical_blocker_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "FAIL",
                1,
                "chapter_gate_status=FAIL,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=no_go",
            )
        )
        release_summary.runtime_policy_conformance_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "PASS",
                0,
                "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go",
            )
        )

        exit_code = release_summary.main()

        assert exit_code == 1
        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        expected_reasons = [
            "evidence_completeness_blocker_signal",
            "gate_score_or_critical_blocker_signal",
        ]
        assert payload["decision"] == "NO_GO"
        assert artifact["decision"] == "NO_GO"
        assert payload["go_no_go_reasons"] == expected_reasons
        assert artifact["go_no_go_reasons"] == expected_reasons
        assert "external_e2e_smoke" not in payload["go_no_go_reasons"]
        assert "external_e2e_smoke" not in artifact["go_no_go_reasons"]

        payload_map = {item["check_id"]: item for item in payload["checks"]}
        artifact_map = {item["check_id"]: item for item in artifact["checks"]}

        for check_id in target_ids:
            assert check_id in payload_map
            assert check_id in artifact_map
            assert payload_map[check_id]["priority"] == artifact_map[check_id]["priority"]
            assert payload_map[check_id]["blocking"] == artifact_map[check_id]["blocking"]
            assert payload_map[check_id]["status"] == artifact_map[check_id]["status"]
            assert payload_map[check_id]["detail"] == artifact_map[check_id]["detail"]

        assert payload_map["external_e2e_smoke"]["blocking"] is False
        assert payload_map["external_e2e_smoke"]["status"] == "PASS"
        assert payload_map["evidence_completeness_blocker_signal"]["status"] == "FAIL"
        assert payload_map["gate_score_or_critical_blocker_signal"]["status"] == "FAIL"
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path




def test_main_pointer_transition_sequence_stays_deterministic_for_roadmap_activation_payload():
    transition_events = [
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "prd_completed",
            "prdId": "PRD-043",
        },
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "prd_activated",
            "prdId": "PRD-044",
        },
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-044",
        },
    ]

    assert [item["action"] for item in transition_events] == [
        "prd_completed",
        "prd_activated",
        "current_prd_updated",
    ]
    assert transition_events[0]["prdId"] == "PRD-043"
    assert transition_events[1]["prdId"] == "PRD-044"
    assert transition_events[2]["prdId"] == "PRD-044"


def test_main_pointer_transition_rejects_contradictory_pending_target_state():
    roadmap_payload = {
        "currentMilestone": "M12",
        "currentPRD": "PRD-044",
        "milestones": [
            {
                "id": "M12",
                "status": "in_progress",
                "prds": [
                    {"id": "PRD-043", "status": "completed"},
                    {"id": "PRD-044", "status": "pending"},
                ],
            }
        ],
    }

    current_milestone = next(
        milestone
        for milestone in roadmap_payload["milestones"]
        if milestone["id"] == roadmap_payload["currentMilestone"]
    )
    target_prd = next(
        prd
        for prd in current_milestone["prds"]
        if prd["id"] == roadmap_payload["currentPRD"]
    )

    contradiction_detected = target_prd["status"] == "pending"
    assert contradiction_detected is True


def test_main_activation_closure_lifecycle_sequence_remains_auditable_and_stable():
    changelog = [
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "prd_completed",
            "prdId": "PRD-043",
        },
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "prd_activated",
            "prdId": "PRD-044",
        },
        {
            "timestamp": "2026-02-28T23:40:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-044",
        },
        {
            "timestamp": "2026-03-01T08:00:00Z",
            "action": "prd_completed",
            "prdId": "PRD-044",
        },
        {
            "timestamp": "2026-03-01T08:00:00Z",
            "action": "prd_activated",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-03-01T08:00:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-045",
        },
    ]

    transition_windows = []
    for index, event in enumerate(changelog):
        if event["action"] != "prd_completed":
            continue
        activated = changelog[index + 1]
        current = changelog[index + 2]
        transition_windows.append((event, activated, current))

    assert len(transition_windows) == 2

    first_pass = [
        (
            completed["prdId"],
            activated["prdId"],
            current["prdId"],
            completed["action"],
            activated["action"],
            current["action"],
        )
        for completed, activated, current in transition_windows
    ]
    second_pass = [
        (
            completed["prdId"],
            activated["prdId"],
            current["prdId"],
            completed["action"],
            activated["action"],
            current["action"],
        )
        for completed, activated, current in transition_windows
    ]

    assert first_pass == second_pass

    for completed, activated, current in transition_windows:
        assert activated["action"] == "prd_activated"
        assert current["action"] == "current_prd_updated"
        assert completed["prdId"] != activated["prdId"]
        assert activated["prdId"] == current["prdId"]
        assert completed["timestamp"] <= activated["timestamp"]
        assert activated["timestamp"] <= current["timestamp"]


def test_main_lifecycle_transition_windows_preserve_identity_under_repeated_extraction():
    changelog = [
        {
            "timestamp": "2026-02-29T00:45:00Z",
            "action": "prd_completed",
            "prdId": "PRD-044",
        },
        {
            "timestamp": "2026-02-29T01:20:00Z",
            "action": "scope_extended",
            "description": "Roadmap extended with M13",
        },
        {
            "timestamp": "2026-02-29T01:20:00Z",
            "action": "prd_activated",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-02-29T01:20:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-03-02T09:10:00Z",
            "action": "prd_completed",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-03-02T09:10:00Z",
            "action": "prd_activated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-03-02T09:10:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-046",
        },
    ]

    def extract_windows(events):
        windows = []
        for index, event in enumerate(events):
            if event.get("action") != "prd_completed":
                continue
            if index + 2 >= len(events):
                continue
            activated = events[index + 1]
            current = events[index + 2]
            if activated.get("action") != "prd_activated":
                continue
            if current.get("action") != "current_prd_updated":
                continue
            windows.append((event, activated, current))
        return windows

    first_windows = extract_windows(changelog)
    second_windows = extract_windows(changelog)

    assert len(first_windows) == 1
    assert len(second_windows) == 1

    first_tuple = [
        (
            completed["prdId"],
            activated["prdId"],
            current["prdId"],
            completed["action"],
            activated["action"],
            current["action"],
        )
        for completed, activated, current in first_windows
    ]
    second_tuple = [
        (
            completed["prdId"],
            activated["prdId"],
            current["prdId"],
            completed["action"],
            activated["action"],
            current["action"],
        )
        for completed, activated, current in second_windows
    ]

    assert first_tuple == second_tuple

    completed, activated, current = first_windows[0]
    assert completed["prdId"] == "PRD-045"
    assert activated["prdId"] == "PRD-046"
    assert current["prdId"] == "PRD-046"
    assert activated["prdId"] == current["prdId"]
    assert completed["prdId"] != activated["prdId"]


def test_main_lifecycle_transition_window_detects_duplicate_actions():
    changelog = [
        {
            "timestamp": "2026-03-02T09:10:00Z",
            "action": "prd_completed",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-03-02T09:10:00Z",
            "action": "prd_activated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-03-02T09:10:01Z",
            "action": "prd_activated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-03-02T09:10:02Z",
            "action": "current_prd_updated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-03-02T09:10:03Z",
            "action": "current_prd_updated",
            "prdId": "PRD-046",
        },
    ]

    post_complete = changelog[1:]
    activation_count = sum(1 for event in post_complete if event["action"] == "prd_activated")
    pointer_update_count = sum(
        1 for event in post_complete if event["action"] == "current_prd_updated"
    )

    duplicate_activation_detected = activation_count > 1
    duplicate_pointer_update_detected = pointer_update_count > 1

    assert duplicate_activation_detected is True
    assert duplicate_pointer_update_detected is True


def test_main_lifecycle_transition_window_detects_pointer_action_contradiction():
    roadmap_payload = {
        "currentMilestone": "M13",
        "currentPRD": "PRD-047",
        "milestones": [
            {
                "id": "M13",
                "status": "in_progress",
                "prds": [
                    {"id": "PRD-045", "status": "completed"},
                    {"id": "PRD-046", "status": "in_progress"},
                    {"id": "PRD-047", "status": "pending"},
                ],
            }
        ],
        "changelog": [
            {"action": "prd_completed", "prdId": "PRD-045"},
            {"action": "prd_activated", "prdId": "PRD-046"},
            {"action": "current_prd_updated", "prdId": "PRD-046"},
        ],
    }

    target_prd = next(
        prd
        for prd in roadmap_payload["milestones"][0]["prds"]
        if prd["id"] == roadmap_payload["currentPRD"]
    )
    latest_pointer_event = next(
        event
        for event in reversed(roadmap_payload["changelog"])
        if event["action"] == "current_prd_updated"
    )

    contradiction_detected = (
        target_prd["status"] == "pending"
        or latest_pointer_event["prdId"] != roadmap_payload["currentPRD"]
    )

    assert contradiction_detected is True


def test_main_updated_at_stale_against_latest_pointer_transition_is_detected():
    roadmap_payload = {
        "updatedAt": "2026-03-02T09:10:00Z",
        "currentPRD": "PRD-046",
        "changelog": [
            {
                "timestamp": "2026-03-02T09:10:00Z",
                "action": "prd_completed",
                "prdId": "PRD-045",
            },
            {
                "timestamp": "2026-03-02T09:10:01Z",
                "action": "prd_activated",
                "prdId": "PRD-046",
            },
            {
                "timestamp": "2026-03-02T09:10:02Z",
                "action": "current_prd_updated",
                "prdId": "PRD-046",
            },
        ],
    }

    latest_pointer_event = next(
        event
        for event in reversed(roadmap_payload["changelog"])
        if event["action"] == "current_prd_updated"
    )
    pointer_target_consistent = (
        latest_pointer_event["prdId"] == roadmap_payload["currentPRD"]
    )
    stale_updated_at_detected = (
        roadmap_payload["updatedAt"] < latest_pointer_event["timestamp"]
    )

    assert pointer_target_consistent is True
    assert stale_updated_at_detected is True


def test_main_updated_at_equal_latest_pointer_transition_is_not_stale():
    roadmap_payload = {
        "updatedAt": "2026-03-02T09:10:02Z",
        "currentPRD": "PRD-046",
        "changelog": [
            {
                "timestamp": "2026-03-02T09:10:00Z",
                "action": "prd_completed",
                "prdId": "PRD-045",
            },
            {
                "timestamp": "2026-03-02T09:10:01Z",
                "action": "prd_activated",
                "prdId": "PRD-046",
            },
            {
                "timestamp": "2026-03-02T09:10:02Z",
                "action": "current_prd_updated",
                "prdId": "PRD-046",
            },
        ],
    }

    latest_pointer_event = next(
        event
        for event in reversed(roadmap_payload["changelog"])
        if event["action"] == "current_prd_updated"
    )
    pointer_target_consistent = (
        latest_pointer_event["prdId"] == roadmap_payload["currentPRD"]
    )
    stale_updated_at_detected = (
        roadmap_payload["updatedAt"] < latest_pointer_event["timestamp"]
    )

    assert pointer_target_consistent is True
    assert stale_updated_at_detected is False


def test_main_prd_completed_at_aligns_with_matching_prd_completed_timestamp():
    roadmap_payload = {
        "milestones": [
            {
                "id": "M13",
                "prds": [
                    {
                        "id": "PRD-045",
                        "status": "completed",
                        "completedAt": "2026-02-29T02:10:00Z",
                    }
                ],
            }
        ],
        "changelog": [
            {
                "timestamp": "2026-02-29T02:10:00Z",
                "action": "prd_completed",
                "prdId": "PRD-045",
            }
        ],
    }

    prd = roadmap_payload["milestones"][0]["prds"][0]
    matching_completed_event = next(
        event
        for event in roadmap_payload["changelog"]
        if event["action"] == "prd_completed" and event.get("prdId") == prd["id"]
    )
    timestamp_drift_detected = prd["completedAt"] != matching_completed_event["timestamp"]

    assert timestamp_drift_detected is False


def test_main_prd_completed_at_drift_from_matching_prd_completed_timestamp_is_detected():
    roadmap_payload = {
        "milestones": [
            {
                "id": "M13",
                "prds": [
                    {
                        "id": "PRD-045",
                        "status": "completed",
                        "completedAt": "2026-02-29T02:09:59Z",
                    }
                ],
            }
        ],
        "changelog": [
            {
                "timestamp": "2026-02-29T02:10:00Z",
                "action": "prd_completed",
                "prdId": "PRD-045",
            }
        ],
    }

    prd = roadmap_payload["milestones"][0]["prds"][0]
    matching_completed_event = next(
        event
        for event in roadmap_payload["changelog"]
        if event["action"] == "prd_completed" and event.get("prdId") == prd["id"]
    )
    timestamp_drift_detected = prd["completedAt"] != matching_completed_event["timestamp"]

    assert timestamp_drift_detected is True


def test_main_milestone_completed_at_not_earlier_than_latest_child_completion():
    milestone_payload = {
        "id": "M13",
        "status": "completed",
        "completedAt": "2026-02-29T02:30:00Z",
        "prds": [
            {"id": "PRD-045", "status": "completed", "completedAt": "2026-02-29T02:10:00Z"},
            {"id": "PRD-046", "status": "completed", "completedAt": "2026-02-29T02:25:00Z"},
        ],
    }

    completed_child_timestamps = [
        prd["completedAt"]
        for prd in milestone_payload["prds"]
        if prd.get("status") == "completed" and "completedAt" in prd
    ]
    latest_child_completed_at = max(completed_child_timestamps)
    non_monotonic_drift_detected = milestone_payload["completedAt"] < latest_child_completed_at

    assert non_monotonic_drift_detected is False


def test_main_milestone_completed_at_earlier_than_latest_child_completion_is_detected():
    milestone_payload = {
        "id": "M13",
        "status": "completed",
        "completedAt": "2026-02-29T02:20:00Z",
        "prds": [
            {"id": "PRD-045", "status": "completed", "completedAt": "2026-02-29T02:10:00Z"},
            {"id": "PRD-046", "status": "completed", "completedAt": "2026-02-29T02:25:00Z"},
        ],
    }

    completed_child_timestamps = [
        prd["completedAt"]
        for prd in milestone_payload["prds"]
        if prd.get("status") == "completed" and "completedAt" in prd
    ]
    latest_child_completed_at = max(completed_child_timestamps)
    non_monotonic_drift_detected = milestone_payload["completedAt"] < latest_child_completed_at

    assert non_monotonic_drift_detected is True


def test_main_lifecycle_export_repeated_run_preserves_window_identity_and_reason_parity():
    changelog = [
        {
            "timestamp": "2026-02-29T02:10:00Z",
            "action": "prd_completed",
            "prdId": "PRD-045",
        },
        {
            "timestamp": "2026-02-29T02:10:00Z",
            "action": "prd_activated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-02-29T02:10:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-02-29T03:10:00Z",
            "action": "prd_completed",
            "prdId": "PRD-046",
        },
        {
            "timestamp": "2026-02-29T03:10:00Z",
            "action": "prd_activated",
            "prdId": "PRD-047",
        },
        {
            "timestamp": "2026-02-29T03:10:00Z",
            "action": "current_prd_updated",
            "prdId": "PRD-047",
        },
    ]

    def extract_transition_tuples(events):
        tuples = []
        for index, event in enumerate(events):
            if event.get("action") != "prd_completed":
                continue
            if index + 2 >= len(events):
                continue
            activated = events[index + 1]
            current = events[index + 2]
            if activated.get("action") != "prd_activated":
                continue
            if current.get("action") != "current_prd_updated":
                continue
            tuples.append(
                (
                    event["prdId"],
                    activated["prdId"],
                    current["prdId"],
                    event["timestamp"],
                    activated["timestamp"],
                    current["timestamp"],
                )
            )
        return tuples

    first_tuples = extract_transition_tuples(changelog)
    second_tuples = extract_transition_tuples(changelog)

    assert first_tuples == second_tuples
    assert first_tuples[-1] == (
        "PRD-046",
        "PRD-047",
        "PRD-047",
        "2026-02-29T03:10:00Z",
        "2026-02-29T03:10:00Z",
        "2026-02-29T03:10:00Z",
    )

    checks_first = {
        "lifecycle_window_identity": {
            "check_id": "lifecycle_window_identity",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "detail": "windows=2,latest_completed=PRD-046,latest_activated=PRD-047,latest_pointer=PRD-047",
        },
        "lifecycle_reason_parity": {
            "check_id": "lifecycle_reason_parity",
            "priority": "P1",
            "blocking": False,
            "status": "PASS",
            "detail": "go_no_go_reasons=none,parity=stable",
        },
    }
    checks_second = {
        "lifecycle_window_identity": {
            "check_id": "lifecycle_window_identity",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "detail": "windows=2,latest_completed=PRD-046,latest_activated=PRD-047,latest_pointer=PRD-047",
        },
        "lifecycle_reason_parity": {
            "check_id": "lifecycle_reason_parity",
            "priority": "P1",
            "blocking": False,
            "status": "PASS",
            "detail": "go_no_go_reasons=none,parity=stable",
        },
    }

    for check_id in checks_first:
        assert checks_first[check_id]["priority"] == checks_second[check_id]["priority"]
        assert checks_first[check_id]["blocking"] == checks_second[check_id]["blocking"]
        assert checks_first[check_id]["status"] == checks_second[check_id]["status"]
        assert checks_first[check_id]["detail"] == checks_second[check_id]["detail"]

    first_reasons = []
    second_reasons = []
    assert first_reasons == second_reasons


def test_main_lifecycle_export_parity_drift_between_payload_and_artifact_is_detected():
    payload_checks = {
        "lifecycle_window_identity": {
            "check_id": "lifecycle_window_identity",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "detail": "windows=2,latest_completed=PRD-046,latest_activated=PRD-047,latest_pointer=PRD-047",
        },
        "lifecycle_reason_parity": {
            "check_id": "lifecycle_reason_parity",
            "priority": "P1",
            "blocking": False,
            "status": "PASS",
            "detail": "go_no_go_reasons=none,parity=stable",
        },
    }
    artifact_checks = {
        "lifecycle_window_identity": {
            "check_id": "lifecycle_window_identity",
            "priority": "P0",
            "blocking": True,
            "status": "PASS",
            "detail": "windows=2,latest_completed=PRD-046,latest_activated=PRD-047,latest_pointer=PRD-047",
        },
        "lifecycle_reason_parity": {
            "check_id": "lifecycle_reason_parity",
            "priority": "P1",
            "blocking": False,
            "status": "PASS",
            "detail": "go_no_go_reasons=none,parity=drifted",
        },
    }

    payload_reasons = []
    artifact_reasons = []

    missing_rows_detected = any(check_id not in artifact_checks for check_id in payload_checks)
    contradictory_reason_list_detected = payload_reasons != artifact_reasons
    detail_drift_detected = (
        payload_checks["lifecycle_reason_parity"]["detail"]
        != artifact_checks["lifecycle_reason_parity"]["detail"]
    )

    parity_drift_detected = (
        missing_rows_detected
        or contradictory_reason_list_detected
        or detail_drift_detected
    )

    assert parity_drift_detected is True


def test_main_freshness_trace_warnings_do_not_affect_blocking_decision_reduction(tmp_path):
    original_report_path = release_summary.REPORT_PATH
    original_release_dir = release_summary.RELEASE_EVIDENCE_DIR
    original_artifact_path = release_summary.RELEASE_READINESS_ARTIFACT_PATH

    def fake_run_cmd(cmd, env=None):
        normalized = " ".join(str(part) for part in cmd)
        if "pytest" in normalized:
            return 0, "24 passed in 1.20s"
        if "check_tasks_completion.py" in normalized:
            return 0, "{}"
        return 0, "ok"

    def read_machine_payload(report_text: str) -> dict:
        marker = "```json\n"
        start = report_text.index(marker) + len(marker)
        end = report_text.index("\n```", start)
        return json.loads(report_text[start:end])

    target_ids = [
        "evidence_freshness_signal",
        "quality_level_trace_signal",
        "degrade_trace_signal",
        "evidence_completeness_blocker_signal",
        "gate_score_or_critical_blocker_signal",
        "runtime_policy_conformance_signal",
    ]

    try:
        release_summary.REPORT_PATH = tmp_path / "release-check-summary.md"
        release_summary.RELEASE_EVIDENCE_DIR = tmp_path / "release"
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = (
            release_summary.RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
        )
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

        release_summary.evidence_freshness_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: ("WARN", 0, "fresh_files=0,stale_files=3,window_days=14")
        )
        release_summary.quality_level_trace_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "WARN",
                0,
                "quality_level=missing,traceable_link=missing,missing_fields=quality_level,traceable_link",
            )
        )
        release_summary.degrade_trace_signal = (  # type: ignore[assignment]
            lambda *args, **kwargs: (
                "WARN",
                0,
                "degrade_reason=present,degrade_steps=missing,degrade_trace_complete=no",
            )
        )

        exit_code = release_summary.main()
        assert exit_code == 0

        payload = read_machine_payload(release_summary.REPORT_PATH.read_text(encoding="utf-8"))
        artifact = json.loads(
            release_summary.RELEASE_READINESS_ARTIFACT_PATH.read_text(encoding="utf-8")
        )

        assert payload["decision"] == "GO"
        assert artifact["decision"] == "GO"
        assert payload["go_no_go_reasons"] == []
        assert artifact["go_no_go_reasons"] == []

        payload_map = {item["check_id"]: item for item in payload["checks"]}
        artifact_map = {item["check_id"]: item for item in artifact["checks"]}

        for check_id in target_ids:
            assert check_id in payload_map
            assert check_id in artifact_map
            assert payload_map[check_id]["priority"] == artifact_map[check_id]["priority"]
            assert payload_map[check_id]["blocking"] == artifact_map[check_id]["blocking"]
            assert payload_map[check_id]["status"] == artifact_map[check_id]["status"]
            assert payload_map[check_id]["detail"] == artifact_map[check_id]["detail"]

        assert payload_map["evidence_freshness_signal"]["blocking"] is False
        assert payload_map["quality_level_trace_signal"]["blocking"] is False
        assert payload_map["degrade_trace_signal"]["blocking"] is False
        assert payload_map["evidence_freshness_signal"]["status"] == "WARN"
        assert payload_map["quality_level_trace_signal"]["status"] == "WARN"
        assert payload_map["degrade_trace_signal"]["status"] == "WARN"
    finally:
        release_summary.REPORT_PATH = original_report_path
        release_summary.RELEASE_EVIDENCE_DIR = original_release_dir
        release_summary.RELEASE_READINESS_ARTIFACT_PATH = original_artifact_path
