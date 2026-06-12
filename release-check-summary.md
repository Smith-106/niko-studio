# Release Check Summary

- Decision: GO
- Go/No-Go rule: any blocking FAIL => NO_GO
- Codecov strict mode: disabled

## Deterministic Check Results

| check_id | priority | blocking | status |
|---|---|---|---|
| version_consistency | P0 | true | PASS |
| delivery_semantic_gate | P0 | true | PASS |
| governance_scripts_regression | P0 | true | PASS |
| baseline_tests_and_coverage | P0 | true | PASS |
| desktop_check | P0 | true | PASS |
| desktop_sidecar_readiness | P0 | true | PASS |
| desktop_packaging_dry_run | P0 | true | PASS |
| writing_helper_acceptance_signal | P0 | true | PASS |
| package_e2e_acceptance_signal | P0 | true | PASS |
| package_app_smoke_signal | P1 | false | PASS |
| external_e2e_smoke | P0 | true | PASS |
| production_guard | P0 | true | PASS |
| metrics_guard | P0 | true | PASS |
| codecov_signal | P1 | false | PASS |
| evidence_completeness_blocker_signal | P0 | true | PASS |
| gate_score_or_critical_blocker_signal | P0 | true | PASS |
| runtime_policy_conformance_signal | P0 | true | PASS |
| authority_alignment_signal | P0 | true | PASS |
| issue_pending_blocker_signal | P0 | true | PASS |
| evidence_coverage_signal | P1 | false | PASS |
| slo_baseline_signal | P1 | false | PASS |
| evidence_links_signal | P1 | false | PASS |
| self_learning_signal | P1 | false | PASS |
| memory_observability_signal | P1 | false | PASS |
| quality_level_trace_signal | P1 | false | PASS |
| degrade_trace_signal | P1 | false | PASS |
| critical_gate_enforcement_signal | P1 | false | PASS |
| chapter_gate_scoring_signal | P1 | false | PASS |
| cycle_time_kpi_measurement_signal | P1 | false | PASS |
| comparable_quality_rubric_signal | P1 | false | PASS |
| weekly_kpi_dashboard_schema_signal | P1 | false | PASS |
| weekly_kpi_rollup_readiness_signal | P1 | false | PASS |
| weekly_kpi_comparability_visibility_signal | P1 | false | PASS |
| critical_conflict_blocker_signal | P0 | true | PASS |
| unresolved_triage_blocker_signal | P0 | true | PASS |
| feedback_artifact_linkage_signal | P1 | false | WARN |
| conflict_artifact_linkage_signal | P1 | false | WARN |
| chapter_gate_evidence_linkage_signal | P1 | false | WARN |
| evidence_freshness_signal | P1 | false | PASS |
| migration_rollback_evidence_signal | P1 | false | PASS |
| compliance_keywords_signal | P1 | false | PASS |
| tasks_completion_signal | P1 | false | PASS |
| local_selftest_enforcement | P0 | true | PASS |
| delivery_contract_100_signal | P0 | true | PASS |

## Machine-Readable Decision

```json
{
  "decision": "GO",
  "go_no_go_reasons": [],
  "generated_at": "2026-06-12T14:33:01.560028+00:00",
  "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
  "version": "11.0.1",
  "freshness_window_hours": 48,
  "delivery_contract": {
    "contract_id": "ISS-20260423-001",
    "label": "100% delivery contract",
    "gate_signal": "delivery_contract_100_signal",
    "status": "PASS",
    "decision_rule": "all scorecard dimensions must PASS",
    "required_dimensions": 4,
    "passed_dimensions": 4,
    "failed_dimensions": [],
    "completion_percent": 100.0
  },
  "scorecard_dimensions": [
    {
      "dimension_id": "functional",
      "label": "Functional closure",
      "status": "PASS",
      "check_ids": [
        "delivery_semantic_gate",
        "runtime_policy_conformance_signal",
        "external_e2e_smoke",
        "production_guard",
        "metrics_guard"
      ],
      "blocking_failures": [],
      "non_pass_checks": []
    },
    {
      "dimension_id": "testing",
      "label": "Test gates",
      "status": "PASS",
      "check_ids": [
        "governance_scripts_regression",
        "baseline_tests_and_coverage"
      ],
      "blocking_failures": [],
      "non_pass_checks": []
    },
    {
      "dimension_id": "release",
      "label": "Release readiness",
      "status": "PASS",
      "check_ids": [
        "desktop_check",
        "desktop_sidecar_readiness",
        "desktop_packaging_dry_run",
        "writing_helper_acceptance_signal",
        "package_e2e_acceptance_signal",
        "local_selftest_enforcement"
      ],
      "blocking_failures": [],
      "non_pass_checks": []
    },
    {
      "dimension_id": "governance",
      "label": "Governance closure",
      "status": "PASS",
      "check_ids": [
        "authority_alignment_signal",
        "evidence_completeness_blocker_signal",
        "gate_score_or_critical_blocker_signal",
        "issue_pending_blocker_signal"
      ],
      "blocking_failures": [],
      "non_pass_checks": []
    }
  ],
  "checks": [
    {
      "check_id": "version_consistency",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "script=scripts/check_versions.py"
    },
    {
      "check_id": "delivery_semantic_gate",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "script=scripts/delivery_gate.py"
    },
    {
      "check_id": "governance_scripts_regression",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "script=scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q,status=passed,passed_count=50,junitxml=.workflow/evidence/release/governance-scripts.junit.xml"
    },
    {
      "check_id": "baseline_tests_and_coverage",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix src-ts run test:coverage:phase4,status=passed,passed_count=11"
    },
    {
      "check_id": "desktop_check",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix desktop run check:local,package_script=desktop/package.json -> scripts.check:local"
    },
    {
      "check_id": "desktop_sidecar_readiness",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix desktop run build:sidecar && npm --prefix desktop run validate:sidecar-contract,artifact=desktop/src-tauri/bin/niko-gateway"
    },
    {
      "check_id": "desktop_packaging_dry_run",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix desktop run validate:package:dry-run,target=x86_64-pc-windows-msvc,signing=unsigned_local_dry_run"
    },
    {
      "check_id": "writing_helper_acceptance_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "artifact=.workflow/evidence/release/writing-helper-acceptance.json,strict=True,status=PASS,head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,current_head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,version=11.0.1,current_version=11.0.1,generated_at=2026-06-12T14:27:12.6152766+00:00,freshness_window_hours=48,freshness_status=fresh,freshness_age_hours=0.1,supersession_status=current,supersession_reasons=,evidence_state=fresh_current,generated_at_parse_error=none,total_cases=7,passed_cases=7,failed_cases=0,failed_cases_path=none,missing_keys=,json_parse_error=none,decision=go"
    },
    {
      "check_id": "package_e2e_acceptance_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "artifact=.workflow/evidence/release/package-e2e-acceptance.json,status=PASS,head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,current_head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,version=11.0.1,current_version=11.0.1,tester=codex,artifact_path=C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_11.0.1_x64-setup.exe,artifact_sha256=e4d779b8d8598386d55cfeb40d672cc3a62db745ed7d1847ca004a5c01721004,generated_at=2026-06-12T14:26:35.107811+00:00,freshness_window_hours=48,freshness_status=fresh,freshness_age_hours=0.11,supersession_status=current,supersession_reasons=,evidence_state=fresh_current,generated_at_parse_error=none,install_verified=True,launch_verified=True,core_flow_verified=True,shutdown_verified=True,notes=none,missing_keys=,json_parse_error=none,decision=go"
    },
    {
      "check_id": "package_app_smoke_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "artifact=.workflow/evidence/release/packaged-app-smoke.json,status=PASS,package_version=11.0.1,current_version=11.0.1,version_drift=false,install_verified=true,launch_verified=true,health_version_verified=true,services_verified=true,cors_verified=true,failure_count=0,mode=advisory_first,decision=go"
    },
    {
      "check_id": "external_e2e_smoke",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "status=passed,passed_count=2"
    },
    {
      "check_id": "production_guard",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts,status=passed,passed_count=2,junitxml=.workflow/evidence/release/vitest-production-guard.xml"
    },
    {
      "check_id": "metrics_guard",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts,status=passed,passed_count=2,junitxml=.workflow/evidence/release/vitest-production-guard.xml"
    },
    {
      "check_id": "codecov_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "strict_mode=false,token_present=false,coverage_xml=yes,result=coverage_available"
    },
    {
      "check_id": "evidence_completeness_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "quality_non_template=2,weekly_non_template=5,machine_payload_available=yes,missing_evidence_classes=,decision=go"
    },
    {
      "check_id": "gate_score_or_critical_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=go"
    },
    {
      "check_id": "runtime_policy_conformance_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,workflow_hard_gate_present=yes,public_entry_api_present=yes,mismatches=,decision=go"
    },
    {
      "check_id": "authority_alignment_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "checked_rules=96,passed_rules=96,failed_rules=0,checked_files=17,mismatches=,json_parse_error=none"
    },
    {
      "check_id": "issue_pending_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "issue_history=.workflow/issues/issue-history.jsonl,roadmap_issues_checked=0,pending_issues=0,pending_issue_ids=none,terminal_statuses=completed,closed,resolved,done,decision=go"
    },
    {
      "check_id": "evidence_coverage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "quality_non_template=2,weekly_non_template=5"
    },
    {
      "check_id": "slo_baseline_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "keywords_present=ttft,e2e,effective_hit_rate,context_budget_utilization,gate consistency"
    },
    {
      "check_id": "evidence_links_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "evidence_links_key=present,traceable_link=present"
    },
    {
      "check_id": "self_learning_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "fields_present=reflector,curator,playbook"
    },
    {
      "check_id": "memory_observability_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "metrics_present=c_effective,s_final,r_memory"
    },
    {
      "check_id": "quality_level_trace_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "effective_quality_level=high,quality_level_used=high"
    },
    {
      "check_id": "degrade_trace_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "degrade_reason=present,degrade_steps=present"
    },
    {
      "check_id": "critical_gate_enforcement_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "critical_gate=enforced"
    },
    {
      "check_id": "chapter_gate_scoring_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "quality_score=99.0,threshold=99.0,publish_recommendation=pass,critical_issue_count=0,decision=go"
    },
    {
      "check_id": "cycle_time_kpi_measurement_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "window_policy=full_7_day_only,manual_override=forbidden,missing_rules=,present_exclusion_reason_codes=missing_timestamps"
    },
    {
      "check_id": "comparable_quality_rubric_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "rubric_version=v1,quality_score=99.0,threshold=99.0,critical_issue_count=0,publish_recommendation=pass,quality_level_match=yes,degrade_trace_complete=yes,decision=comparable"
    },
    {
      "check_id": "weekly_kpi_dashboard_schema_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "schema_name=weekly_kpi_dashboard,schema_version=v1,manual_override=forbidden,missing_fields="
    },
    {
      "check_id": "weekly_kpi_rollup_readiness_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "rollup_source=canonical_evidence,manual_override=forbidden,baseline_state=ready,cycle_time_trend=down,missing_fields="
    },
    {
      "check_id": "weekly_kpi_comparability_visibility_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,comparability_decision=comparable,cycle_time_trend=down,baseline_state=ready,missing_fields="
    },
    {
      "check_id": "critical_conflict_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0,decision=go"
    },
    {
      "check_id": "unresolved_triage_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "state_files_scanned=0,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=0,ignored_legacy_records=0,blocker_semantics=current_parseable_triage_state_not_in_{resolved,rejected}_and_not_legacy_noise,decision=go"
    },
    {
      "check_id": "feedback_artifact_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "snapshots_scanned=0,linked_feedback_artifacts=0,invalid_snapshots=0"
    },
    {
      "check_id": "conflict_artifact_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0"
    },
    {
      "check_id": "chapter_gate_evidence_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "snapshots_scanned=0,eligible_release_gate_runs=0,chapter_gate_checks_linked=0,aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=0"
    },
    {
      "check_id": "evidence_freshness_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "fresh_files=7,stale_files=0,window_days=14"
    },
    {
      "check_id": "migration_rollback_evidence_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "migration=present,rollback=present,traceable_link=present"
    },
    {
      "check_id": "compliance_keywords_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "keywords_present=rbac,audit,rollback"
    },
    {
      "check_id": "tasks_completion_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "checked=29,unchecked=0,completion_ratio=100.0%,json_parse_error=none"
    },
    {
      "check_id": "local_selftest_enforcement",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix desktop run local:selftest,required_when=retained_release_evidence_for_release_sign_off_is_not_fresh_current,proof_binding=same_head_fresh_current_release_evidence,release_evidence_status=fresh_current,bound_sources=release_summary_report,authority_alignment,writing_helper_acceptance,governance_scripts_regression,blocking_sources=none,proof_state=fresh_current,decision=optional_with_fresh_current_evidence"
    },
    {
      "check_id": "delivery_contract_100_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "contract_id=ISS-20260423-001,label=100% delivery contract,required_dimensions=4,passed_dimensions=4,failed_dimensions=none,completion_percent=100.0,decision=go"
    }
  ],
  "release_evidence": {
    "status": "fresh_current",
    "blocking_sources": [],
    "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
    "version": "11.0.1",
    "generated_at": "2026-06-12T14:33:01.560028+00:00",
    "freshness_window_hours": 48,
    "evidence_sources": [
      {
        "source_id": "release_summary_report",
        "source_type": "report",
        "artifact_path": "release-check-summary.md",
        "status": "PASS",
        "generated_at": "2026-06-12T14:33:01.560028+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.0,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "authority_alignment",
        "source_type": "retained_artifact",
        "artifact_path": ".workflow/evidence/release/authority-alignment.json",
        "status": "PASS",
        "generated_at": "2026-06-12T14:33:01.560028+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.0,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "writing_helper_acceptance",
        "source_type": "retained_artifact",
        "artifact_path": ".workflow/evidence/release/writing-helper-acceptance.json",
        "status": "PASS",
        "generated_at": "2026-06-12T14:27:12.6152766+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.1,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "package_e2e_acceptance",
        "source_type": "retained_artifact",
        "artifact_path": ".workflow/evidence/release/package-e2e-acceptance.json",
        "status": "PASS",
        "generated_at": "2026-06-12T14:26:35.107811+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.11,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "governance_scripts_regression",
        "source_type": "junit",
        "artifact_path": ".workflow/evidence/release/governance-scripts.junit.xml",
        "status": "PASS",
        "generated_at": "2026-06-12T14:33:01.560028+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.0,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "production_guard",
        "source_type": "junit",
        "artifact_path": ".workflow/evidence/release/vitest-production-guard.xml",
        "status": "PASS",
        "generated_at": "2026-06-12T14:33:01.560028+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.0,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      },
      {
        "source_id": "external_e2e_smoke",
        "source_type": "junit",
        "artifact_path": ".workflow/evidence/release/vitest-e2e.xml",
        "status": "PASS",
        "generated_at": "2026-06-12T14:33:01.560028+00:00",
        "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
        "version": "11.0.1",
        "freshness_window_hours": 48,
        "freshness_status": "fresh",
        "freshness_age_hours": 0.0,
        "supersession_status": "current",
        "supersession_reasons": [],
        "evidence_state": "fresh_current",
        "is_fresh": true,
        "is_current": true,
        "generated_at_parse_error": "none"
      }
    ]
  }
}
```

## 100% Scorecard Dimensions

- Contract: ISS-20260423-001 — 100% delivery contract
- Status: PASS
- Completion: 100.0% (4/4 dimensions passed)
- Decision rule: all scorecard dimensions must PASS
- Blocking signal: delivery_contract_100_signal

| dimension_id | label | status | blocking_failures | non_pass_checks |
|---|---|---|---|---|
| functional | Functional closure | PASS | none | none |
| testing | Test gates | PASS | none | none |
| release | Release readiness | PASS | none | none |
| governance | Governance closure | PASS | none | none |

Single scorecard contract: functional + testing + release + governance must all be PASS before the repo can claim 100% completion.
Verification path: release check + issue pending inspection + targeted governance regression.

## Retained Release Evidence

- current_head_sha: 9a83e78a273b605195853f09e9b03f678b04fb2f
- current_version: 11.0.1
- release_evidence_generated_at: 2026-06-12T14:33:01.560028+00:00
- freshness_window_hours: 48
- release_evidence_status: fresh_current
- blocking_sources: none

| source_id | status | freshness_status | supersession_status | evidence_state |
|---|---|---|---|---|
| release_summary_report | PASS | fresh | current | fresh_current |
| authority_alignment | PASS | fresh | current | fresh_current |
| writing_helper_acceptance | PASS | fresh | current | fresh_current |
| package_e2e_acceptance | PASS | fresh | current | fresh_current |
| governance_scripts_regression | PASS | fresh | current | fresh_current |
| production_guard | PASS | fresh | current | fresh_current |
| external_e2e_smoke | PASS | fresh | current | fresh_current |

## Details

### Check Detail Summary (from machine payload)

- version_consistency: status=PASS, detail=script=scripts/check_versions.py
- delivery_semantic_gate: status=PASS, detail=script=scripts/delivery_gate.py
- governance_scripts_regression: status=PASS, detail=script=scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q,status=passed,passed_count=50,junitxml=.workflow/evidence/release/governance-scripts.junit.xml
- baseline_tests_and_coverage: status=PASS, detail=command=npm --prefix src-ts run test:coverage:phase4,status=passed,passed_count=11
- desktop_check: status=PASS, detail=command=npm --prefix desktop run check:local,package_script=desktop/package.json -> scripts.check:local
- desktop_sidecar_readiness: status=PASS, detail=command=npm --prefix desktop run build:sidecar && npm --prefix desktop run validate:sidecar-contract,artifact=desktop/src-tauri/bin/niko-gateway
- desktop_packaging_dry_run: status=PASS, detail=command=npm --prefix desktop run validate:package:dry-run,target=x86_64-pc-windows-msvc,signing=unsigned_local_dry_run
- writing_helper_acceptance_signal: status=PASS, detail=artifact=.workflow/evidence/release/writing-helper-acceptance.json,strict=True,status=PASS,head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,current_head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,version=11.0.1,current_version=11.0.1,generated_at=2026-06-12T14:27:12.6152766+00:00,freshness_window_hours=48,freshness_status=fresh,freshness_age_hours=0.1,supersession_status=current,supersession_reasons=,evidence_state=fresh_current,generated_at_parse_error=none,total_cases=7,passed_cases=7,failed_cases=0,failed_cases_path=none,missing_keys=,json_parse_error=none,decision=go
- package_e2e_acceptance_signal: status=PASS, detail=artifact=.workflow/evidence/release/package-e2e-acceptance.json,status=PASS,head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,current_head_sha=9a83e78a273b605195853f09e9b03f678b04fb2f,version=11.0.1,current_version=11.0.1,tester=codex,artifact_path=C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_11.0.1_x64-setup.exe,artifact_sha256=e4d779b8d8598386d55cfeb40d672cc3a62db745ed7d1847ca004a5c01721004,generated_at=2026-06-12T14:26:35.107811+00:00,freshness_window_hours=48,freshness_status=fresh,freshness_age_hours=0.11,supersession_status=current,supersession_reasons=,evidence_state=fresh_current,generated_at_parse_error=none,install_verified=True,launch_verified=True,core_flow_verified=True,shutdown_verified=True,notes=none,missing_keys=,json_parse_error=none,decision=go
- package_app_smoke_signal: status=PASS, detail=artifact=.workflow/evidence/release/packaged-app-smoke.json,status=PASS,package_version=11.0.1,current_version=11.0.1,version_drift=false,install_verified=true,launch_verified=true,health_version_verified=true,services_verified=true,cors_verified=true,failure_count=0,mode=advisory_first,decision=go
- external_e2e_smoke: status=PASS, detail=status=passed,passed_count=2
- production_guard: status=PASS, detail=command=npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts,status=passed,passed_count=2,junitxml=.workflow/evidence/release/vitest-production-guard.xml
- metrics_guard: status=PASS, detail=command=npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts,status=passed,passed_count=2,junitxml=.workflow/evidence/release/vitest-production-guard.xml
- codecov_signal: status=PASS, detail=strict_mode=false,token_present=false,coverage_xml=yes,result=coverage_available
- evidence_completeness_blocker_signal: status=PASS, detail=quality_non_template=2,weekly_non_template=5,machine_payload_available=yes,missing_evidence_classes=,decision=go
- gate_score_or_critical_blocker_signal: status=PASS, detail=chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_or_critical_or_unresolved_triage_is_fail,decision=go
- runtime_policy_conformance_signal: status=PASS, detail=policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,workflow_hard_gate_present=yes,public_entry_api_present=yes,mismatches=,decision=go
- authority_alignment_signal: status=PASS, detail=checked_rules=96,passed_rules=96,failed_rules=0,checked_files=17,mismatches=,json_parse_error=none
- issue_pending_blocker_signal: status=PASS, detail=issue_history=.workflow/issues/issue-history.jsonl,roadmap_issues_checked=0,pending_issues=0,pending_issue_ids=none,terminal_statuses=completed,closed,resolved,done,decision=go
- evidence_coverage_signal: status=PASS, detail=quality_non_template=2,weekly_non_template=5
- slo_baseline_signal: status=PASS, detail=keywords_present=ttft,e2e,effective_hit_rate,context_budget_utilization,gate consistency
- evidence_links_signal: status=PASS, detail=evidence_links_key=present,traceable_link=present
- self_learning_signal: status=PASS, detail=fields_present=reflector,curator,playbook
- memory_observability_signal: status=PASS, detail=metrics_present=c_effective,s_final,r_memory
- quality_level_trace_signal: status=PASS, detail=effective_quality_level=high,quality_level_used=high
- degrade_trace_signal: status=PASS, detail=degrade_reason=present,degrade_steps=present
- critical_gate_enforcement_signal: status=PASS, detail=critical_gate=enforced
- chapter_gate_scoring_signal: status=PASS, detail=quality_score=99.0,threshold=99.0,publish_recommendation=pass,critical_issue_count=0,decision=go
- cycle_time_kpi_measurement_signal: status=PASS, detail=window_policy=full_7_day_only,manual_override=forbidden,missing_rules=,present_exclusion_reason_codes=missing_timestamps
- comparable_quality_rubric_signal: status=PASS, detail=rubric_version=v1,quality_score=99.0,threshold=99.0,critical_issue_count=0,publish_recommendation=pass,quality_level_match=yes,degrade_trace_complete=yes,decision=comparable
- weekly_kpi_dashboard_schema_signal: status=PASS, detail=schema_name=weekly_kpi_dashboard,schema_version=v1,manual_override=forbidden,missing_fields=
- weekly_kpi_rollup_readiness_signal: status=PASS, detail=rollup_source=canonical_evidence,manual_override=forbidden,baseline_state=ready,cycle_time_trend=down,missing_fields=
- weekly_kpi_comparability_visibility_signal: status=PASS, detail=visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,comparability_decision=comparable,cycle_time_trend=down,baseline_state=ready,missing_fields=
- critical_conflict_blocker_signal: status=PASS, detail=snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0,decision=go
- unresolved_triage_blocker_signal: status=PASS, detail=state_files_scanned=0,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=0,ignored_legacy_records=0,blocker_semantics=current_parseable_triage_state_not_in_{resolved,rejected}_and_not_legacy_noise,decision=go
- feedback_artifact_linkage_signal: status=WARN, detail=snapshots_scanned=0,linked_feedback_artifacts=0,invalid_snapshots=0
- conflict_artifact_linkage_signal: status=WARN, detail=snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0
- chapter_gate_evidence_linkage_signal: status=WARN, detail=snapshots_scanned=0,eligible_release_gate_runs=0,chapter_gate_checks_linked=0,aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=0
- evidence_freshness_signal: status=PASS, detail=fresh_files=7,stale_files=0,window_days=14
- migration_rollback_evidence_signal: status=PASS, detail=migration=present,rollback=present,traceable_link=present
- compliance_keywords_signal: status=PASS, detail=keywords_present=rbac,audit,rollback
- tasks_completion_signal: status=PASS, detail=checked=29,unchecked=0,completion_ratio=100.0%,json_parse_error=none
- local_selftest_enforcement: status=PASS, detail=command=npm --prefix desktop run local:selftest,required_when=retained_release_evidence_for_release_sign_off_is_not_fresh_current,proof_binding=same_head_fresh_current_release_evidence,release_evidence_status=fresh_current,bound_sources=release_summary_report,authority_alignment,writing_helper_acceptance,governance_scripts_regression,blocking_sources=none,proof_state=fresh_current,decision=optional_with_fresh_current_evidence
- delivery_contract_100_signal: status=PASS, detail=contract_id=ISS-20260423-001,label=100% delivery contract,required_dimensions=4,passed_dimensions=4,failed_dimensions=none,completion_percent=100.0,decision=go

### Command Outputs

#### version_consistency output

```text
authoritative source: src-ts/config/index.ts:APP_VERSION
expected version: 11.0.1
- src-ts/config/index.ts:APP_VERSION: 11.0.1
- src-ts/package.json: 11.0.1
- config/niko-studio.yaml: 11.0.1
- config/niko-studio.production.yaml: 11.0.1
- desktop/package.json: 11.0.1
- desktop/src-tauri/tauri.conf.json: 11.0.1
- desktop/src-tauri/Cargo.toml: 11.0.1

�汾һ���Լ��ͨ����
```

#### delivery_semantic_gate output

```text
delivery gate: start
delivery gate: ok
```

#### governance_scripts_regression output

```text
..................................................                       [100%]
50 passed in 1.29s
```

#### baseline_tests_and_coverage output

```text
> niko-studio-backend@11.0.1 test:coverage:phase4
> node -e "require('fs').mkdirSync('coverage/.tmp',{recursive:true})" && vitest run --config vitest.phase4.config.ts --coverage --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura


 RUN  v3.2.4 C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/src-ts
      Coverage enabled with v8

 ✓ tests/memory/index.test.ts (12 tests) 2024ms
   ✓ memory/index barrel > covers plugin lifecycle and config-driven factory behavior through the public unified memory engine  334ms
 ✓ tests/memory/unified-memory.integration-adapters.test.ts (8 tests) 1071ms
 ✓ tests/store/store-manager.test.ts (8 tests) 447ms
stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.089Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-Zhup5o\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.089Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.090Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alicia"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.090Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.090Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Broken Seal"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.090Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Late Bell"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.090Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Closed Loop"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.091Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice","relationType":"KNOWS","toName":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.091Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice","relationType":"MENTORS","toName":"Alicia"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports the remaining search, relationship, foreshadow, and mutation tail behavior
{"timestamp":"2026-06-12T14:27:21.092Z","level":"info","module":"gateway/graph-engine","message":"Deleted entity: Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > returns bounded errors for missing entities on create, update, and delete flows
{"timestamp":"2026-06-12T14:27:21.119Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-UFUPmf\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > returns bounded errors for missing entities on create, update, and delete flows
{"timestamp":"2026-06-12T14:27:21.120Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > applies executeCypher guards and bounded typed-node query semantics
{"timestamp":"2026-06-12T14:27:21.147Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-pQeqLF\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > applies executeCypher guards and bounded typed-node query semantics
{"timestamp":"2026-06-12T14:27:21.149Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Event","name":"Bridge Alarm"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > applies executeCypher guards and bounded typed-node query semantics
{"timestamp":"2026-06-12T14:27:21.149Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Event","name":"Harbor Bell"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.183Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-9yXruj\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.184Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.184Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.184Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Carol"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.185Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice","relationType":"KNOWS","toName":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports relationship-match and traversal-like executeCypher queries
{"timestamp":"2026-06-12T14:27:21.185Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Bob","relationType":"KNOWS","toName":"Carol"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports scoped MERGE mutations for persisted authoring and survives reloads
{"timestamp":"2026-06-12T14:27:21.217Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-8DYnfY\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > supports scoped MERGE mutations for persisted authoring and survives reloads
{"timestamp":"2026-06-12T14:27:21.228Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-8DYnfY\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.254Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-config-zBLSki\\data-root\\graph.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.256Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.256Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Event","name":"Bridge Alarm"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.257Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.257Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Location","name":"Watchtower"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.257Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Signal Fire"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.257Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice","relationType":"PARTICIPATES","toName":"Bridge Alarm"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.258Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice","relationType":"KNOWS","toName":"Bob"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers config-driven lifecycle, plugin, timeline, and projection compatibility branches
{"timestamp":"2026-06-12T14:27:21.289Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-config-zBLSki\\configured-graph.db"}
{"timestamp":"2026-06-12T14:27:21.312Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-config-zBLSki\\configured-niko-graph.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.346Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-u9BfWQ\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.347Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Scoped Hero"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.347Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Project Scout"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.347Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Legacy Echo"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.347Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Other Realm"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.348Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Null Props"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.348Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Scoped Hero","relationType":"KNOWS","toName":"Project Scout"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.353Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Scoped Hero","relationType":"ALLY","toName":"Project Scout"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.373Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-home-fallback-025TFe\\.niko\\graph.db"}
{"timestamp":"2026-06-12T14:27:21.400Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-Fe3r1j\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.401Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Raw Foreshadow Null"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.422Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-9ty1TZ\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.422Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"CreateOnly Hero"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.456Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-GdJAcs\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.456Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Clamp A"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.456Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Clamp B"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.456Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Clamp C"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.457Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Clamp A","relationType":"KNOWS","toName":"Clamp B"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.457Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Clamp B","relationType":"KNOWS","toName":"Clamp C"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.488Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-YUJxzm\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.488Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Center"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.488Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Mid"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.488Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Leaf"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.489Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Center","relationType":"KNOWS","toName":"Mid"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.489Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Center","relationType":"KNOWS","toName":"Leaf"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.489Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Mid","relationType":"KNOWS","toName":"Leaf"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.517Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-IEBvlm\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.517Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alias Hero"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers scoped reads and merge mutation parser edge branches
{"timestamp":"2026-06-12T14:27:21.526Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Foreshadow","name":"Scoped Null Props"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.558Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-uFzj5q\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.558Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Branch Hero"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.559Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Branch Ally"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.559Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Branch Hero","relationType":"KNOWS","toName":"Branch Ally"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.579Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-DPgf10\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers remaining helper fallback branches with controlled harnesses
{"timestamp":"2026-06-12T14:27:21.607Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-from-config-T2KPNP\\graph.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.645Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-engine-jiA9sx\\graph-engine.db"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice Scope"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Bob Scope"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Carol Scope"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Event","name":"Bridge Alarm Scoped"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice Scope","relationType":"KNOWS","toName":"Bob Scope"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.646Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Bob Scope","relationType":"KNOWS","toName":"Carol Scope"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.647Z","level":"info","module":"gateway/graph-engine","message":"Created relation","fromName":"Alice Scope","relationType":"PARTICIPATES","toName":"Bridge Alarm Scoped"}

stdout | tests/graph/graph-engine.test.ts > graph/graph-engine > covers fallback match and scoped timeline traversal branches
{"timestamp":"2026-06-12T14:27:21.649Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":".writing/graph_db"}

 ✓ tests/graph/graph-engine.test.ts (9 tests) 595ms
stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > supports bounded CRUD, query, stats, and shortest-path behavior
{"timestamp":"2026-06-12T14:27:21.756Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-IMcZ5D\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.757Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Alice","id":"char-alice"}
{"timestamp":"2026-06-12T14:27:21.757Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Bob","id":"char-bob"}
{"timestamp":"2026-06-12T14:27:21.757Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"object","name":"Silver Key","id":"item-key"}
{"timestamp":"2026-06-12T14:27:21.757Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-alice -[KNOWS]-> char-bob"}
{"timestamp":"2026-06-12T14:27:21.757Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-bob -[OWNS]-> item-key"}
{"timestamp":"2026-06-12T14:27:21.768Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > supports the remaining update, relationship, search, and delete tail behavior
{"timestamp":"2026-06-12T14:27:21.791Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-57KCoA\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.791Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Alice Tail","id":"char-alice-tail"}
{"timestamp":"2026-06-12T14:27:21.791Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Bob Tail","id":"char-bob-tail"}
{"timestamp":"2026-06-12T14:27:21.792Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"location","name":"Watchtower","id":"loc-watchtower"}
{"timestamp":"2026-06-12T14:27:21.792Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-alice-tail -[KNOWS]-> char-bob-tail"}
{"timestamp":"2026-06-12T14:27:21.792Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-bob-tail -[LOCATED_IN]-> loc-watchtower"}
{"timestamp":"2026-06-12T14:27:21.792Z","level":"info","module":"gateway/graph-manager","message":"Updated entity","id":"char-alice-tail"}
{"timestamp":"2026-06-12T14:27:21.793Z","level":"info","module":"gateway/graph-manager","message":"Deleted relationship: rel-tail-knows"}
{"timestamp":"2026-06-12T14:27:21.793Z","level":"info","module":"gateway/graph-manager","message":"Deleted entity: char-bob-tail"}
{"timestamp":"2026-06-12T14:27:21.800Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > supports shortest-path edge cases and subgraph compatibility behavior
{"timestamp":"2026-06-12T14:27:21.822Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-2V9MN1\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.822Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Algo Alice","id":"char-algo-alice"}
{"timestamp":"2026-06-12T14:27:21.823Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Algo Bob","id":"char-algo-bob"}
{"timestamp":"2026-06-12T14:27:21.823Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"location","name":"North Tower","id":"loc-algo-tower"}
{"timestamp":"2026-06-12T14:27:21.823Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Ghost","id":"char-algo-ghost"}
{"timestamp":"2026-06-12T14:27:21.823Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-algo-alice -[KNOWS]-> char-algo-bob"}
{"timestamp":"2026-06-12T14:27:21.823Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-algo-bob -[LOCATED_IN]-> loc-algo-tower"}
{"timestamp":"2026-06-12T14:27:21.830Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > supports deeper CREATE, property-filter, and relationship-match cypher behavior
{"timestamp":"2026-06-12T14:27:21.851Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-1togso\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.852Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Cypher Alice","id":"7d11173b-46f7-470f-9298-712e920a458a"}
{"timestamp":"2026-06-12T14:27:21.852Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"event","name":"Bridge Alarm","id":"2989f740-4c1a-414f-adbf-92f764a3ee4d"}
{"timestamp":"2026-06-12T14:27:21.852Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Cypher Bob","id":"char-cypher-bob"}
{"timestamp":"2026-06-12T14:27:21.853Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"location","name":"North Bridge","id":"loc-cypher-bridge"}
{"timestamp":"2026-06-12T14:27:21.853Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-cypher-bob -[LOCATED_IN]-> loc-cypher-bridge"}
{"timestamp":"2026-06-12T14:27:21.859Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > supports legacy addEntity and addRelation aliases for compatibility
{"timestamp":"2026-06-12T14:27:21.881Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-FkCyCp\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.881Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Legacy Alice","id":"char-legacy-alice"}
{"timestamp":"2026-06-12T14:27:21.881Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Legacy Bob","id":"char-legacy-bob"}
{"timestamp":"2026-06-12T14:27:21.882Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-legacy-alice -[KNOWS]-> char-legacy-bob"}
{"timestamp":"2026-06-12T14:27:21.888Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers parser type detection and raw SQL fallback behavior
{"timestamp":"2026-06-12T14:27:21.908Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-JtqgwI\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.908Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"SQL Alice","id":"char-sql-alice"}
{"timestamp":"2026-06-12T14:27:21.915Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers traversal edge limits and LIKE-search fallback behavior
{"timestamp":"2026-06-12T14:27:21.936Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-htV7s4\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.936Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Fallback Alice","id":"char-fallback-alice"}
{"timestamp":"2026-06-12T14:27:21.936Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Fallback Bob","id":"char-fallback-bob"}
{"timestamp":"2026-06-12T14:27:21.937Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: char-fallback-alice -[KNOWS]-> char-fallback-bob"}
{"timestamp":"2026-06-12T14:27:21.943Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers parser conversions and internal fallback branches
{"timestamp":"2026-06-12T14:27:21.964Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-Y3lP7K\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:21.965Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"No Id Entity","id":"8f5474b8-9139-49b8-bf29-1836a7474972"}
{"timestamp":"2026-06-12T14:27:21.965Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"concept","name":"Entity_ab23d25e","id":"979817d2-9536-446c-a931-5c0fc26076b7"}
{"timestamp":"2026-06-12T14:27:21.966Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"concept","name":"Fallback Label Entity","id":"b2720b48-d283-489a-8446-f70286254171"}
{"timestamp":"2026-06-12T14:27:21.966Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Entity_b2ec15fe","id":"83cb6fb9-63e0-4759-a284-ba8bd1064f59"}
{"timestamp":"2026-06-12T14:27:21.968Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Limit Source A","id":"limit-source-a"}
{"timestamp":"2026-06-12T14:27:21.969Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Limit Source B","id":"limit-source-b"}
{"timestamp":"2026-06-12T14:27:21.969Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Limit Neighbor","id":"limit-neighbor"}
{"timestamp":"2026-06-12T14:27:21.969Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: limit-source-a -[KNOWS]-> limit-neighbor"}
{"timestamp":"2026-06-12T14:27:21.969Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: limit-source-b -[KNOWS]-> limit-neighbor"}
{"timestamp":"2026-06-12T14:27:21.969Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Isolated Node","id":"isolated-node"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Duplicate Root","id":"dup-root"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Duplicate Left","id":"dup-left"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Duplicate Right","id":"dup-right"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Duplicate Leaf","id":"dup-leaf"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: dup-root -[KNOWS]-> dup-left"}
{"timestamp":"2026-06-12T14:27:21.970Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: dup-root -[KNOWS]-> dup-right"}
{"timestamp":"2026-06-12T14:27:21.971Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: dup-left -[KNOWS]-> dup-leaf"}
{"timestamp":"2026-06-12T14:27:21.971Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: dup-right -[KNOWS]-> dup-leaf"}
{"timestamp":"2026-06-12T14:27:21.978Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers where-property compare and lifecycle compatibility branches
{"timestamp":"2026-06-12T14:27:21.998Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-Kc4nQ6\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:22.017Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\.niko\\graph_manager.db"}
{"timestamp":"2026-06-12T14:27:22.022Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}
{"timestamp":"2026-06-12T14:27:22.023Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Compare Source","id":"compare-source"}
{"timestamp":"2026-06-12T14:27:22.024Z","level":"info","module":"gateway/graph-manager","message":"Created entity","type":"character","name":"Compare Target","id":"compare-target"}
{"timestamp":"2026-06-12T14:27:22.024Z","level":"info","module":"gateway/graph-manager","message":"Created relationship: compare-source -[KNOWS]-> compare-target"}
{"timestamp":"2026-06-12T14:27:22.031Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers entity embedding helper content and metadata branches
{"timestamp":"2026-06-12T14:27:22.051Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-bZLAOw\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:22.057Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > logs and swallows vector adapter failures for fire-and-forget embedding hooks
{"timestamp":"2026-06-12T14:27:22.079Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-W2QNuT\\graph-manager.db"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > logs and swallows vector adapter failures for fire-and-forget embedding hooks
{"timestamp":"2026-06-12T14:27:22.085Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

stdout | tests/graph/graph-manager.test.ts > graph/graph-manager > covers cache eviction and process-wide default vector search wiring
{"timestamp":"2026-06-12T14:27:22.107Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-Cpru7Z\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:22.127Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-Hceojd\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:22.133Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}
{"timestamp":"2026-06-12T14:27:22.155Z","level":"info","module":"gateway/graph-manager","message":"GraphManager initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-manager-MBDutJ\\graph-manager.db"}
{"timestamp":"2026-06-12T14:27:22.161Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}
{"timestamp":"2026-06-12T14:27:22.169Z","level":"info","module":"gateway/graph-manager","message":"GraphManager closed"}

 ✓ tests/graph/graph-manager.test.ts (12 tests) 436ms
stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > loads persisted mappings with compatibility defaults and skips blank or invalid lines
{"timestamp":"2026-06-12T14:27:22.226Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-LM9vk1"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > keeps initialization resilient when mapping persistence is unreadable
{"timestamp":"2026-06-12T14:27:22.236Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-NDCgHE"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > handles missing mapping file branch when structure setup is bypassed
{"timestamp":"2026-06-12T14:27:22.241Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-aWQoq9"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > logs mapping persistence failures without breaking ingest or delete public behavior
{"timestamp":"2026-06-12T14:27:22.273Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-jJ4W7P"}
{"timestamp":"2026-06-12T14:27:22.275Z","level":"info","module":"gateway/store-contract","message":"Ingested content as document: doc-shadow"}
{"timestamp":"2026-06-12T14:27:22.276Z","level":"info","module":"gateway/store-contract","message":"Deleted document: doc-shadow"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > ingests content, emits memory/citation files, and reports integrity through the public contract
{"timestamp":"2026-06-12T14:27:22.288Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-saS1lt"}
{"timestamp":"2026-06-12T14:27:22.290Z","level":"info","module":"gateway/store-contract","message":"Ingested content as document: doc-openkl-1"}
{"timestamp":"2026-06-12T14:27:22.293Z","level":"info","module":"gateway/store-contract","message":"Created memory: mem-1"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > covers optional memory metadata, missing citations, and integrity anomaly reporting
{"timestamp":"2026-06-12T14:27:22.306Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-5hzvhD"}
{"timestamp":"2026-06-12T14:27:22.307Z","level":"info","module":"gateway/store-contract","message":"Ingested content as document: doc-hash"}
{"timestamp":"2026-06-12T14:27:22.307Z","level":"info","module":"gateway/store-contract","message":"Ingested content as document: doc-missing"}
{"timestamp":"2026-06-12T14:27:22.309Z","level":"info","module":"gateway/store-contract","message":"Created memory: mem-untagged"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > returns null when a citation file exists but contains invalid JSON
{"timestamp":"2026-06-12T14:27:22.321Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-VPMoVo"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > covers doc-id generation and malformed mapping ingestion branches
{"timestamp":"2026-06-12T14:27:22.367Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-cXbrKn"}
{"timestamp":"2026-04-27T12:34:56.000Z","level":"info","module":"gateway/store-contract","message":"Ingested content as document: doc-20260427123456000Z-5640bd18"}
{"timestamp":"2026-06-12T14:27:22.373Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-cXbrKn"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > uses copy fallback for topic links on win32 platforms
{"timestamp":"2026-06-12T14:27:22.381Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-VAEfdS"}
{"timestamp":"2026-06-12T14:27:22.384Z","level":"info","module":"gateway/store-contract","message":"Created memory: mem-copy-fallback"}

stdout | tests/store/openkl-contract.test.ts > store/openkl-contract > covers non-win32 topic link handling branches without breaking memory creation
{"timestamp":"2026-06-12T14:27:22.395Z","level":"info","module":"gateway/store-contract","message":"OpenKL contract initialized","basePath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-openkl-ZWRDJh"}
{"timestamp":"2026-06-12T14:27:22.398Z","level":"info","module":"gateway/store-contract","message":"Created memory: mem-symlink-branch"}

 ✓ tests/store/openkl-contract.test.ts (12 tests) 184ms
stdout | tests/graph/index.test.ts > graph/index barrel > provides a working graph engine through the barrel
{"timestamp":"2026-06-12T14:27:22.468Z","level":"info","module":"gateway/graph-engine","message":"Graph engine initialized","dbPath":"C:\\Users\\niko\\AppData\\Local\\Temp\\niko-graph-barrel-80e97663-e8a9-4a95-ad89-784459e47898\\graph.db"}

stdout | tests/graph/index.test.ts > graph/index barrel > provides a working graph engine through the barrel
{"timestamp":"2026-06-12T14:27:22.468Z","level":"info","module":"gateway/graph-engine","message":"Created entity","entityType":"Character","name":"Alice"}

 ✓ tests/graph/index.test.ts (2 tests) 29ms
 ✓ tests/mcp/memory-service.test.ts (7 tests) 25ms
 ✓ tests/mcp/graph-service.test.ts (5 tests) 20ms
 ✓ tests/store/index.test.ts (2 tests) 8ms
 ✓ tests/integrations/adapters.test.ts (4 tests) 6ms

 Test Files  11 passed (11)
      Tests  81 passed (81)
   Start at  22:27:16
   Duration  7.80s (transform 385ms, setup 28ms, collect 554ms, tests 4.85s, environment 0ms, prepare 88ms)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |      100 |     100 |     100 |                   
 graph             |     100 |      100 |     100 |     100 |                   
  graph-engine.ts  |     100 |      100 |     100 |     100 |                   
  graph-manager.ts |     100 |      100 |     100 |     100 |                   
 mcp/services      |     100 |      100 |     100 |     100 |                   
  graph.ts         |     100 |      100 |     100 |     100 |                   
  memory.ts        |     100 |      100 |     100 |     100 |                   
 store             |     100 |      100 |     100 |     100 |                   
  ...l-contract.ts |     100 |      100 |     100 |     100 |                   
  store-manager.ts |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------

stderr | tests/memory/index.test.ts > memory/index barrel > provides a working unified memory engine through the barrel
{"timestamp":"2026-06-12T14:27:17.414Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:17.416Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > supports filtered search and temporal windows through the public unified memory engine
{"timestamp":"2026-06-12T14:27:17.541Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:17.541Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > keeps search, temporal lookup, and conflict detection isolated by memory scope
{"timestamp":"2026-06-12T14:27:17.695Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:17.695Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > round-trips retrieval profiles and cache entries through the public unified memory engine
{"timestamp":"2026-06-12T14:27:17.838Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:17.838Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > expires and cleans retrieval cache entries through the public unified memory engine
{"timestamp":"2026-06-12T14:27:17.978Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:17.978Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > reuses and resets the unified memory singleton through the public barrel helpers
{"timestamp":"2026-06-12T14:27:18.485Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:18.485Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}
{"timestamp":"2026-06-12T14:27:18.604Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:18.604Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > applies environment-selected default adapters through the public config factory
{"timestamp":"2026-06-12T14:27:18.717Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:18.717Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > detects and resolves public memory conflicts through the unified engine
{"timestamp":"2026-06-12T14:27:18.833Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:18.833Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > supports explicit conflict resolution strategies through the unified engine
{"timestamp":"2026-06-12T14:27:18.979Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:18.979Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/index.test.ts > memory/index barrel > preserves richer metadata when merge resolution combines sparse newer memories
{"timestamp":"2026-06-12T14:27:19.269Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.269Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > keeps the local-first add path when postgres shadow-write is disabled
{"timestamp":"2026-06-12T14:27:19.477Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.477Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > invokes the injected shadow-write adapter when postgres integration is enabled
{"timestamp":"2026-06-12T14:27:19.592Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.592Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > preserves the local write when the shadow-write adapter fails
{"timestamp":"2026-06-12T14:27:19.714Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.714Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > preserves the local write when the shadow-write adapter does not confirm success
{"timestamp":"2026-06-12T14:27:19.846Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.846Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > uses environment-selected default adapters when no integration bundle is injected
{"timestamp":"2026-06-12T14:27:19.969Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:19.969Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > uses environment-selected default adapters on the singleton accessor path
{"timestamp":"2026-06-12T14:27:20.097Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:20.097Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > shadow-writes merged memories with inherited metadata on the merge path
{"timestamp":"2026-06-12T14:27:20.222Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:20.222Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}

stderr | tests/memory/unified-memory.integration-adapters.test.ts > UnifiedMemoryEngine integration adapters > preserves merge resolution when merge shadow-write throws after local merge is stored
{"timestamp":"2026-06-12T14:27:20.380Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED: No embedding model installed — all vectors are dummy/zero, retrieval will not work properly","model":"BAAI/bge-small-zh-v1.5"}
{"timestamp":"2026-06-12T14:27:20.380Z","level":"error","module":"gateway/memory","message":"EMBEDDING ENGINE DEGRADED at startup — semantic search/retrieval will return poor results"}
```

#### desktop_check output

```text
> niko-studio-desktop@11.0.1 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

> niko-studio-desktop@11.0.1 check:local
> npm run check:release


> niko-studio-desktop@11.0.1 check:release
> npm run lint && npm run format:check && npm run test:serial && npm run build:sidecar && npm run validate:sidecar-contract && npm run build


> niko-studio-desktop@11.0.1 lint
> eslint --config ../eslint.config.mjs "src/**/*.{ts,tsx}" "scripts/**/*.{js,cjs,mjs}" "vite.config.ts" --max-warnings 0


> niko-studio-desktop@11.0.1 format:check
> prettier --config ../prettier.config.mjs --ignore-path ../.prettierignore --check "package.json" "../eslint.config.mjs" "../prettier.config.mjs"

Checking formatting...
All matched files use Prettier code style!

> niko-studio-desktop@11.0.1 test:serial
> node --max-old-space-size=8192 ./node_modules/vitest/vitest.mjs run --root . --maxWorkers=1 --fileParallelism=false


 RUN  v3.2.4 C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/desktop

 ✓ src/components/SettingsModal.test.tsx (18 tests) 8191ms
   ✓ SettingsModal quality presets > updates quality goal sliders when preset changes  313ms
   ✓ SettingsModal quality presets > persists retrieval and context type settings after save  697ms
   ✓ SettingsModal quality presets > keeps open drafts local but reloads latest store settings on reopen  558ms
   ✓ SettingsModal quality presets > adds deterministic id and name attributes to representative labeled fields  541ms
   ✓ SettingsModal quality presets > renders backend config fields and only enables save for editable changes  670ms
   ✓ SettingsModal quality presets > saves the backend ui bridge toggle through the shared config contract  2259ms
   ✓ SettingsModal quality presets > renders backend config labels in english  572ms
   ✓ SettingsModal quality presets > reloads backend config from the backend section  559ms
   ✓ SettingsModal quality presets > renders backend sync status and disables actions while syncing  561ms
 ✓ src/components/StoryBiblePanel.test.tsx (10 tests) 7052ms
   ✓ StoryBiblePanel > migrates the legacy local draft into persisted workspace authority and restores it after reload  785ms
   ✓ StoryBiblePanel > exports compatibility drafts, imports persisted content, and keeps reset state after reload  1037ms
   ✓ StoryBiblePanel > keeps the local draft visible and surfaces an explicit failure state when graph save fails  592ms
   ✓ StoryBiblePanel > authors workspace-scoped scene, event, and timeline records and activates them  2754ms
   ✓ StoryBiblePanel > renders without errors  433ms
   ✓ StoryBiblePanel > matches snapshot  435ms
   ✓ StoryBiblePanel > promotes synopsis into canon and shows the canon review preview  543ms
 ✓ src/components/ChatArea.test.tsx (29 tests) 5387ms
   ✓ ChatArea P0 flows > sends comparison request and renders dual-model response when comparison is enabled  340ms
   ✓ ChatArea P0 flows > opens template library panel and applies template in replace mode  368ms
   ✓ ChatArea P0 flows > applies template in append mode with existing input  449ms
   ✓ ChatArea P0 flows > restores focus to the trigger on escape and to the composer after apply  464ms
 ✓ src/components/knowledge/MemoryForm.test.tsx (13 tests) 3323ms
   ✓ MemoryForm > queries temporal facts with an optional time value  433ms
   ✓ MemoryForm > adds memory with content and optional fields  637ms
   ✓ MemoryForm > uses the focused entity automatically when no explicit entity is provided  434ms
   ✓ MemoryForm > prefers the explicit entity over the focused entity when both exist  510ms
   ✓ MemoryForm > clears memory content input after successful addition  354ms
 ✓ src/components/knowledge/PersistedEntityTab.test.tsx (11 tests) 2894ms
   ✓ persisted knowledge authoring tabs > creates, edits, and reloads persisted characters  832ms
   ✓ persisted knowledge authoring tabs > creates persisted plot events  462ms
   ✓ persisted knowledge authoring tabs > shows delete button when editing an existing character  341ms
   ✓ persisted knowledge authoring tabs > shows confirmation before delete and cancels  385ms
   ✓ persisted knowledge authoring tabs > deletes entity after confirmation  494ms
 ✓ src/components/WritingHelperPanel.test.tsx (12 tests) 2645ms
   ✓ WritingHelperPanel mode options and payload > restores the captured handoff preset after the user changes parameters  374ms
   ✓ WritingHelperPanel mode options and payload > applies selected skill packs through the primary writing request and shows used skills in the result  367ms
   ✓ WritingHelperPanel mode options and payload > uses revision-safe replace/alternative/undo actions when the current input matches an editor selection snapshot  339ms
   ✓ WritingHelperPanel mode options and payload > falls back to plain insert when no matching editor selection snapshot exists  305ms
 ✓ src/components/EvaluationPanel.test.tsx (16 tests) 2091ms
   ✓ EvaluationPanel actions > supports direct workflow actions and autofills IDs from response  451ms
 ✓ src/components/knowledge/LocationTab.test.tsx (8 tests) 2035ms
   ✓ LocationTab > creates a new location via the form  708ms
   ✓ LocationTab > clears the editor fields when the clear button is clicked  573ms
   ✓ LocationTab > updates an existing location and persists changes  559ms
 ✓ src/components/knowledge/SkillTab.test.tsx (14 tests) 1964ms
   ✓ SkillTab CRUD operations > creates a new skill  339ms
   ✓ SkillTab CRUD operations > edits skill content and saves  528ms
 ✓ src/components/knowledge/PlotTab.test.tsx (8 tests) 1635ms
   ✓ PlotTab > creates a new plot event via the form  926ms
   ✓ PlotTab > clears the editor when the clear button is clicked  527ms
 ✓ src/components/AiTextOptimizer.test.tsx (8 tests) 1316ms
   ✓ AiTextOptimizer > keeps English source labels and hints correct across manual edits and refresh  361ms
 ✓ src/components/knowledge/CharacterTab.test.tsx (9 tests) 1375ms
   ✓ CharacterTab > creates a new character via the form  435ms
   ✓ CharacterTab > clears the editor when the clear button is clicked  432ms
 ✓ src/components/KnowledgeModal.test.tsx (9 tests) 1237ms
 ✓ src/hooks/writerWorkflowExperience.test.tsx (5 tests) 1151ms
 ✓ src/components/QuickRollback.test.tsx (6 tests) 1096ms
   ✓ QuickRollback > calls quickRollbackWorkflow with filled fields and shows success  373ms
   ✓ QuickRollback > shows error message when rollback fails  390ms
 ✓ src/components/PromptTemplatePanel.test.tsx (10 tests) 1134ms
 ✓ src/components/RevisionPreviewCard.test.tsx (15 tests) 1067ms
 ✓ src/components/EvaluationPanel.revision-loop.test.tsx (5 tests) 827ms
   ✓ EvaluationPanel revision loop > generates a revision preview and applies it through revision-safe editor actions  345ms
 ✓ src/components/AutomationPanel.test.tsx (4 tests) 907ms
   ✓ AutomationPanel reliability regressions > handles waiting-confirmation transition and confirm-token recovery  433ms
 ✓ src/components/AppRightPanels.reload-persistence.test.tsx (1 test) 737ms
   ✓ AppRightPanels persisted evaluation handoff reload > survives remount with the persisted revision-preview handoff intact  736ms
 ✓ src/components/AppRightPanels.test.tsx (4 tests) 683ms
   ✓ AppRightPanels writer handoff continuity > keeps the evaluation source summary visible after the real panel switch and guidance clear  377ms
 ✓ src/components/cowriting/InlineHints.test.tsx (8 tests) 577ms
 ✓ src/components/ExportDialog-interaction.test.tsx (6 tests) 516ms
 ✓ src/stores/settingsStore.test.ts (12 tests) 420ms
   ✓ settingsStore prompt template library > does not persist sensitive api keys to localStorage  405ms
 ✓ src/components/editor/BubbleToolbar.test.tsx (5 tests) 368ms
 ✓ src/App.shell.test.tsx (1 test) 340ms
   ✓ App shell integration > renders the real app shell wiring through useAppViewModel and routes shell actions to the right coordinators  339ms
 ✓ src/components/DocumentEditor.test.tsx (5 tests) 329ms
 ✓ src/components/QuickPanel.test.tsx (18 tests) 311ms
 ✓ src/components/AppHeader.test.tsx (5 tests) 348ms
 ✓ src/components/narrative-visualization/NarrativeVisualizationPanelContent.test.tsx (5 tests) 266ms
 ✓ src/components/ExportDialog.test.tsx (4 tests) 287ms
 ✓ src/hooks/useAppRuntimeHealth.test.tsx (6 tests) 254ms
 ✓ src/components/MessageBubble.test.tsx (6 tests) 189ms
 ✓ src/utils/exportDocx.test.ts (25 tests) 225ms
 ✓ src/hooks/useAppBackendBootstrap.test.tsx (5 tests) 251ms
 ✓ src/components/ChatAreaComposer.test.tsx (15 tests) 221ms
 ✓ src/components/editor/SlashCommandMenu.test.tsx (20 tests) 208ms
 ✓ src/components/panels/__tests__/ConflictResolutionPanel.test.tsx (7 tests) 212ms
 ✓ src/components/CharacterRelationshipsPanel.test.tsx (2 tests) 120ms
 ✓ src/components/AiToolbar.test.tsx (10 tests) 103ms
 ✓ src/components/Sidebar.test.tsx (16 tests) 185ms
 ✓ src/components/narrative-visualization/__tests__/VisualizationToolbar.test.tsx (14 tests) 114ms
 ✓ src/components/intelligence/WritingDashboard.test.tsx (7 tests) 181ms
 ✓ src/components/ChatAreaModeControls.test.tsx (13 tests) 163ms
 ✓ src/components/NikoEditor.revision-handle.test.tsx (7 tests) 149ms
 ✓ src/components/narrative-visualization/__tests__/TimelineView.test.tsx (15 tests) 165ms
 ✓ src/components/narrative-visualization/__tests__/CharacterGraphView.test.tsx (16 tests) 163ms
 ✓ src/components/ForeshadowingTrackerPanel.test.tsx (2 tests) 173ms
 ✓ src/components/narrative-visualization/__tests__/TensionCurveView.test.tsx (16 tests) 168ms
 ✓ src/components/AnalysisPanel.test.tsx (1 test) 153ms
 ✓ src/components/EvaluationDrillDownPanel.test.tsx (2 tests) 158ms
 ✓ src/components/AppMainContent.test.tsx (9 tests) 123ms
 ✓ src/components/editor/extensions/__tests__/MathView.test.tsx (11 tests) 156ms
 ✓ src/components/ErrorBoundary.test.tsx (9 tests) 115ms
 ✓ src/App.test.tsx (2 tests) 107ms
 ✓ src/components/SessionAnalyticsPanel.test.tsx (2 tests) 112ms
 ✓ src/components/PatternDashboardPanel.test.tsx (2 tests) 116ms
 ✓ src/components/NikoEditor.test.tsx (6 tests) 108ms
 ✓ src/components/ChatAreaStreamStatus.test.tsx (21 tests) 78ms
 ✓ src/components/ContentSearch.test.tsx (5 tests) 94ms
 ✓ src/hooks/useExportHistory.test.ts (6 tests) 29ms
 ✓ src/components/HistoryPanel.test.tsx (1 test) 74ms
 ✓ src/components/McpStatusPanel.test.tsx (4 tests) 96ms
 ✓ src/components/ToastContainer.test.tsx (8 tests) 74ms
 ✓ src/components/__tests__/VirtualList.test.tsx (7 tests) 68ms
 ✓ src/components/AppContextFooter.test.tsx (8 tests) 68ms
 ✓ src/api/ipc-chunk.test.ts (23 tests) 57ms
 ✓ src/components/VirtualList.test.tsx (4 tests) 57ms
 ✓ src/stores/selectors.test.ts (23 tests) 32ms
 ✓ src/hooks/__tests__/useChatStreaming.test.ts (4 tests) 67ms
 ✓ src/components/ChatAreaInlineActions.test.tsx (13 tests) 53ms
 ✓ src/api/client.test.ts (55 tests) 48ms
 ✓ src/components/ThinkingEffect.test.tsx (9 tests) 43ms
 ✓ src/hooks/useChatStreaming.test.tsx (10 tests) 30ms
 ✓ src/components/ChatSidebar.test.tsx (6 tests) 45ms
 ✓ src/hooks/useChatRecovery.test.tsx (12 tests) 30ms
 ✓ src/components/ChatMessageList.test.tsx (5 tests) 38ms
 ✓ src/components/intelligence/AccordionWrapper.test.tsx (5 tests) 46ms
 ✓ src/components/AppRestoreStatusBanner.test.tsx (7 tests) 30ms
 ✓ src/components/intelligence/IntelligenceBadge.test.tsx (4 tests) 39ms
 ✓ src/hooks/useSmoothStream.test.tsx (8 tests) 39ms
 ✓ src/api/workflow.test.ts (22 tests) 31ms
 ✓ src/hooks/useEvaluationQualityCheck.test.tsx (12 tests) 31ms
 ✓ src/hooks/useChatRequestBuilder.test.tsx (15 tests) 26ms
 ✓ src/hooks/useAppUiPersistence.test.tsx (9 tests) 20ms
 ✓ src/components/ChatContextBar.test.tsx (2 tests) 21ms
 ✓ src/hooks/useAppShellViewModel.test.tsx (6 tests) 21ms
 ✓ src/components/evaluation/EvaluationSupportToolsSection.test.tsx (1 test) 33ms
 ✓ src/utils/export.test.ts (18 tests) 24ms
 ✓ src/hooks/useEditorAI.test.tsx (11 tests) 34ms
 ✓ src/hooks/useSettingsDiagnostics.test.tsx (9 tests) 23ms
 ✓ src/hooks/useDraftCache.test.tsx (10 tests) 21ms
 ✓ src/stores/appStore.test.ts (24 tests) 25ms
 ✓ src/hooks/useAppPanelOrchestration.test.tsx (5 tests) 20ms
 ✓ src/hooks/useMemoryUpload.test.tsx (11 tests) 36ms
 ✓ src/utils/export-edge.test.ts (14 tests) 18ms
 ✓ src/components/intelligence/MetricValue.test.tsx (2 tests) 22ms
 ✓ src/components/intelligence/SectionHeader.test.tsx (2 tests) 18ms
 ✓ src/components/narrative-visualization/__tests__/useVisualizationState.test.ts (11 tests) 23ms
 ✓ src/hooks/useEvaluationWorkflow.test.tsx (13 tests) 36ms
 ✓ src/components/intelligence/ProgressBar.test.tsx (3 tests) 20ms
 ✓ src/hooks/useAppViewModel.test.tsx (2 tests) 15ms
 ✓ src/hooks/useChatStreaming.integration.test.tsx (5 tests) 23ms
 ✓ src/hooks/useToast.test.ts (4 tests) 15ms
 ✓ src/hooks/useScrollPosition.test.tsx (4 tests) 17ms
 ✓ src/hooks/useSettingsBackendConfig.test.tsx (10 tests) 13ms
 ✓ src/components/narrative-visualization/__tests__/useVisualizationData.test.ts (11 tests) 21ms
 ✓ src/stores/app/projectSlice.test.ts (18 tests) 10ms
 ✓ src/api/workspace-store.integration.test.ts (6 tests) 18ms
 ✓ src/services/workflowService.test.ts (21 tests) 10ms
 ✓ src/services/intelligenceService.test.ts (9 tests) 9ms
 ✓ src/services/projectFileService.test.ts (32 tests) 16ms
 ✓ src/api/evaluation.test.ts (12 tests) 8ms
 ✓ src/services/migrationService.test.ts (12 tests) 8ms
 ✓ src/api/knowledge.test.ts (14 tests) 10ms
 ✓ src/stores/app/workflowSlice.test.ts (12 tests) 6ms
 ✓ src/api/contracts.test.ts (33 tests) 5ms
 ✓ src/api/transport.test.ts (21 tests) 8ms
 ✓ src/api/agents.test.ts (12 tests) 8ms
 ✓ src/api/writing-craft.integration.test.ts (2 tests) 7ms
 ✓ src/services/styleProfile.test.ts (9 tests) 6ms
 ✓ src/api/wiki.test.ts (3 tests) 5ms
 ✓ src/services/consistencyEngine.test.ts (10 tests) 6ms
 ✓ src/services/templateService.test.ts (14 tests) 7ms
 ✓ src/services/versionService.test.ts (5 tests) 4ms
 ✓ src/api/m10-apis.test.ts (7 tests) 6ms
stdout | src/services/revisionOrchestrator.test.ts > RevisionOrchestrator > returns revision session metadata alongside the legacy loop result
Created checkpoint cp-1
Evaluating content snippet: 原始正文

stdout | src/services/revisionOrchestrator.test.ts > RevisionOrchestrator > returns revision session metadata alongside the legacy loop result
Iteration 1, current score: 7
Evaluating content snippet: 原始正文

stdout | src/services/revisionOrchestrator.test.ts > RevisionOrchestrator > returns revision session metadata alongside the legacy loop result
Revising content based on 'generic' suggestion: 增加冲突

stdout | src/services/revisionOrchestrator.test.ts > RevisionOrchestrator > returns revision session metadata alongside the legacy loop result
Evaluating content snippet: 改写后的正文

 ✓ src/services/revisionOrchestrator.test.ts (1 test) 4ms
 ✓ src/stores/app/intelligenceSlice.test.ts (6 tests) 5ms
 ✓ src/utils/failurePresentation.test.ts (4 tests) 3ms
 ✓ src/types/workspace.test.ts (3 tests) 4ms
 ✓ src/api/analysis.test.ts (6 tests) 6ms
 ✓ src/utils/revisionLoop.test.ts (4 tests) 4ms
 ✓ src/api/chat.test.ts (23 tests) 6ms
 ✓ src/stores/uiSlice.test.ts (5 tests) 5ms
 ✓ src/stores/app/templateSlice.test.ts (7 tests) 5ms
 ✓ src/utils/stableKey.test.ts (11 tests) 4ms
 ✓ src/services/contextAssembler.test.ts (6 tests) 3ms
 ✓ src/api/workflow/revision.test.ts (3 tests) 3ms
 ✓ src/types/project.test.ts (5 tests) 3ms
 ✓ src/utils/writingSessionTelemetry.test.ts (2 tests) 4ms
 ✓ src/api/core.test.ts (7 tests) 4ms
 ✓ src/api/writing-craft.test.ts (2 tests) 4ms
 ✓ src/api/knowledge.integration.test.ts (4 tests) 4ms
 ✓ src/adapters/chapterAdapter.test.ts (5 tests) 2ms
 ✓ src/utils/wordCount.test.ts (11 tests) 4ms
 ✓ src/api/narrative-visualization.test.ts (1 test) 2ms
 ↓ src/api/writing-craft.e2e.test.ts (2 tests | 2 skipped)
 ✓ scripts/run_local_vite_shell.test.ts (5 tests) 22ms

 Test Files  147 passed | 1 skipped (148)
      Tests  1387 passed | 2 skipped (1389)
   Start at  22:28:54
   Duration  187.14s (transform 3.58s, setup 10.65s, collect 21.58s, tests 59.00s, environment 63.25s, prepare 10.92s)


> niko-studio-desktop@11.0.1 build:sidecar
> npm run build:sidecar:choose


> niko-studio-desktop@11.0.1 build:sidecar:choose
> node scripts/choose_sidecar.cjs

[sidecar:choose] Runtime selection: NIKO_GATEWAY_RUNTIME=node
[sidecar:choose] Authoritative runtime active: Node-first sidecar path
[sidecar:choose] Building Node sidecar (default runtime)...

> niko-studio-desktop@11.0.1 build:sidecar:node
> npm run check:node-sidecar && node scripts/build_node_sidecar.cjs


> niko-studio-desktop@11.0.1 check:node-sidecar
> node --check src-tauri/bin/niko-gateway-node

[sidecar:bundle] build host: win32-x64, Node v24.16.0
[sidecar:bundle] stage dir: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin\sidecar
[sidecar:bundle] bundled Node version: v20.18.1 (NIKO_SIDECAR_BUNDLE_NODE=true)
[sidecar:bundle] compiling src-ts → dist/ via npm run build

> niko-studio-backend@11.0.1 build
> tsc && node scripts/postprocess_esm_imports.cjs

[src-ts:postprocess] rewrote relative ESM imports in 211 file(s)
[sidecar:bundle] post-processing compiled JS: adding .js extensions to ESM relative imports
[sidecar:bundle] post-process: rewrote relative imports in 0 file(s)
[sidecar:bundle] staging compiled JS into desktop\src-tauri\bin\sidecar
[sidecar:bundle] hydrating production deps in desktop\src-tauri\bin\sidecar (npm ci --omit=dev)
[sidecar:bundle]   ABI target: Node v20.18.1 on win32-x64 (forces matching prebuilds)

added 266 packages in 10s
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/darwin (~43.3 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/linux (~30.4 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/win32/arm64 (~9.2 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/darwin (~64.8 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/linux (~75.8 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/win32/arm64 (~34.0 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-web (~65.0 MB)
[sidecar:bundle]   trim: removed node_modules/@xenova/transformers/dist (~43.1 MB)
[sidecar:bundle] trim: total removed ~365.5 MB
[sidecar:bundle] reusing extracted Node 20.18.1 at .workflow\.cache\portable-node\node-v20.18.1-win-x64
[sidecar:bundle] copied portable node.exe → desktop\src-tauri\bin\sidecar\node.exe
[sidecar:bundle] ✅ Node sidecar bundle staged
[sidecar:bundle]    Next: cargo build --release --bin niko-gateway-launcher
[sidecar:bundle]    Then: copy launcher to bin/niko-gateway-x86_64-pc-windows-msvc.exe and run validate:sidecar-contract
[sidecar:choose] ✅ Node sidecar ready
[sidecar:choose] 📝 Wrote sidecar manifest (node v11.0.1) to desktop\src-tauri\bin\sidecar.manifest.json
[sidecar:choose] Validating sidecar contract...

> niko-studio-desktop@11.0.1 validate:sidecar-contract
> node scripts/validate_sidecar_contract.cjs --strict

🔍 Sidecar Contract Validator
   Bin directory: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin
   Platform: Windows
   Mode: STRICT
   Validation scope: node runtime
   Packaging proof: not required

📦 node (Node.js sidecar (standalone proxy))
   Platform: windows
   ✅ niko-gateway-node
   ✅ niko-gateway-node.cmd
   Status: ✅ PASS

🔐 Desktop security boundary
   ✅ main window label is explicit
   ✅ security.capabilities pins the frontend boundary
   ✅ release CSP constrains runtime fetches and asset loading
   ✅ dev CSP keeps Vite localhost access explicit
   ✅ freezePrototype hardening is enabled
   ✅ capability file exists for the main window only
   ✅ frontend capability matches the explicit desktop permission contract

🧭 Runtime / packaging matrix
   Authoritative local runtime: node
   Packaged compatibility runtime: python
   Current target triple: x86_64-pc-windows-msvc
   Validation mode: local/runtime contract
   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.
   Packaging prerequisite note: hydrated packaged compatibility artifact is checked by validate:package:dry-run, not by the generic sidecar contract gate.
   ✅ authoritative local runtime remains node-first
   ✅ packaged externalBin stays on the python compatibility sidecar
   ✅ packaged compatibility artifact is present when explicit packaging proof is requested
   ✅ node sidecar is repo-local only and not claimed as a packaged binary

🔢 Sidecar version contract (ISS-20260430-001 guard)
   Expected version (desktop/package.json): 11.0.1
   Manifest present: true
   Manifest version: 11.0.1 (match=true)
   Bundled binary age vs package.json: -0.0d (stale=false)
   ✅ sidecar.manifest.json records the build provenance
   ✅ bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)
   ✅ bundled sidecar binary is not stale vs package.json (>30d threshold)

============================================================
✅ All contracts validated successfully
[sidecar:choose] ✅ Sidecar build complete

> niko-studio-desktop@11.0.1 validate:sidecar-contract
> node scripts/validate_sidecar_contract.cjs --strict

🔍 Sidecar Contract Validator
   Bin directory: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin
   Platform: Windows
   Mode: STRICT
   Validation scope: node runtime
   Packaging proof: not required

📦 node (Node.js sidecar (standalone proxy))
   Platform: windows
   ✅ niko-gateway-node
   ✅ niko-gateway-node.cmd
   Status: ✅ PASS

🔐 Desktop security boundary
   ✅ main window label is explicit
   ✅ security.capabilities pins the frontend boundary
   ✅ release CSP constrains runtime fetches and asset loading
   ✅ dev CSP keeps Vite localhost access explicit
   ✅ freezePrototype hardening is enabled
   ✅ capability file exists for the main window only
   ✅ frontend capability matches the explicit desktop permission contract

🧭 Runtime / packaging matrix
   Authoritative local runtime: node
   Packaged compatibility runtime: python
   Current target triple: x86_64-pc-windows-msvc
   Validation mode: local/runtime contract
   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.
   Packaging prerequisite note: hydrated packaged compatibility artifact is checked by validate:package:dry-run, not by the generic sidecar contract gate.
   ✅ authoritative local runtime remains node-first
   ✅ packaged externalBin stays on the python compatibility sidecar
   ✅ packaged compatibility artifact is present when explicit packaging proof is requested
   ✅ node sidecar is repo-local only and not claimed as a packaged binary

🔢 Sidecar version contract (ISS-20260430-001 guard)
   Expected version (desktop/package.json): 11.0.1
   Manifest present: true
   Manifest version: 11.0.1 (match=true)
   Bundled binary age vs package.json: -0.0d (stale=false)
   ✅ sidecar.manifest.json records the build provenance
   ✅ bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)
   ✅ bundled sidecar binary is not stale vs package.json (>30d threshold)

============================================================
✅ All contracts validated successfully

> niko-studio-desktop@11.0.1 build
> npm run ensure-deps && tsc && vite build


> niko-studio-desktop@11.0.1 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

vite v7.3.2 building client environment for production...
transforming...
✓ 2307 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                         0.98 kB │ gzip:   0.42 kB
dist/assets/KaTeX_Size3-Regular-CTq5MqoE.woff           4.42 kB
dist/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2          4.93 kB
dist/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2          5.21 kB
dist/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2          5.47 kB
dist/assets/KaTeX_Size4-Regular-BF-4gkZK.woff           5.98 kB
dist/assets/KaTeX_Size2-Regular-oD1tc_U0.woff           6.19 kB
dist/assets/KaTeX_Size1-Regular-C195tn64.woff           6.50 kB
dist/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2    6.91 kB
dist/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2       6.91 kB
dist/assets/KaTeX_Size3-Regular-DgpXs0kz.ttf            7.59 kB
dist/assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff     7.66 kB
dist/assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff        7.72 kB
dist/assets/KaTeX_Script-Regular-D3wIWfF6.woff2         9.64 kB
dist/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2     10.34 kB
dist/assets/KaTeX_Size4-Regular-DWFBv043.ttf           10.36 kB
dist/assets/KaTeX_Script-Regular-D5yQViql.woff         10.59 kB
dist/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2       11.32 kB
dist/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2          11.35 kB
dist/assets/KaTeX_Size2-Regular-B7gKUWhC.ttf           11.51 kB
dist/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2      12.03 kB
dist/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2        12.22 kB
dist/assets/KaTeX_Size1-Regular-Dbsnue_I.ttf           12.23 kB
dist/assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff      12.32 kB
dist/assets/KaTeX_Caligraphic-Regular-wX97UBjC.ttf     12.34 kB
dist/assets/KaTeX_Caligraphic-Bold-ATXxdsX0.ttf        12.37 kB
dist/assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff        13.21 kB
dist/assets/KaTeX_Fraktur-Bold-BsDP51OF.woff           13.30 kB
dist/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2    13.57 kB
dist/assets/KaTeX_SansSerif-Italic-DN2j7dab.woff       14.11 kB
dist/assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff         14.41 kB
dist/assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff     16.03 kB
dist/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2       16.40 kB
dist/assets/KaTeX_Math-Italic-t53AETM-.woff2           16.44 kB
dist/assets/KaTeX_Script-Regular-C5JkGWo-.ttf          16.65 kB
dist/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2       16.78 kB
dist/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2           16.99 kB
dist/assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff        18.67 kB
dist/assets/KaTeX_Math-Italic-DA0__PXp.woff            18.75 kB
dist/assets/KaTeX_Main-BoldItalic-SpSLRI95.woff        19.41 kB
dist/assets/KaTeX_SansSerif-Regular-BNo7hRIc.ttf       19.44 kB
dist/assets/KaTeX_Fraktur-Regular-CB_wures.ttf         19.57 kB
dist/assets/KaTeX_Fraktur-Bold-BdnERNNW.ttf            19.58 kB
dist/assets/KaTeX_Main-Italic-BMLOBm91.woff            19.68 kB
dist/assets/KaTeX_SansSerif-Italic-YYjJ1zSn.ttf        22.36 kB
dist/assets/KaTeX_SansSerif-Bold-CFMepnvq.ttf          24.50 kB
dist/assets/KaTeX_Main-Bold-Cx986IdX.woff2             25.32 kB
dist/assets/KaTeX_Main-Regular-B22Nviop.woff2          26.27 kB
dist/assets/KaTeX_Typewriter-Regular-D3Ib7_Hf.ttf      27.56 kB
dist/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2           28.08 kB
dist/assets/KaTeX_Main-Bold-Jm3AIy58.woff              29.91 kB
dist/assets/KaTeX_Main-Regular-Dr94JaBh.woff           30.77 kB
dist/assets/KaTeX_Math-BoldItalic-B3XSjfu4.ttf         31.20 kB
dist/assets/KaTeX_Math-Italic-flOr_0UB.ttf             31.31 kB
dist/assets/KaTeX_Main-BoldItalic-DzxPMmG6.ttf         32.97 kB
dist/assets/KaTeX_AMS-Regular-DMm9YOAa.woff            33.52 kB
dist/assets/KaTeX_Main-Italic-3WenGoN9.ttf             33.58 kB
dist/assets/KaTeX_Main-Bold-waoOVXN0.ttf               51.34 kB
dist/assets/KaTeX_Main-Regular-ypZvNtVU.ttf            53.58 kB
dist/assets/KaTeX_AMS-Regular-DRggAlZN.ttf             63.63 kB
dist/assets/vendor-katex-wklAmtGL.css                  29.24 kB │ gzip:   8.04 kB
dist/assets/index-C4xGZ6rF.css                        120.35 kB │ gzip:  18.85 kB
dist/assets/vendor-sentry-C4xrE_kX.js                   0.09 kB │ gzip:   0.10 kB │ map:     0.11 kB
dist/assets/m10-apis-DVOgAIif.js                        0.26 kB │ gzip:   0.22 kB │ map:     2.79 kB
dist/assets/MetricValue-DhV80kd7.js                     0.33 kB │ gzip:   0.25 kB │ map:     0.81 kB
dist/assets/ProgressBar-CpBUdF56.js                     0.34 kB │ gzip:   0.27 kB │ map:     0.89 kB
dist/assets/wiki-CPqtLL8w.js                            0.61 kB │ gzip:   0.35 kB │ map:     4.31 kB
dist/assets/SectionHeader-9OsPS9Bm.js                   0.67 kB │ gzip:   0.44 kB │ map:     2.05 kB
dist/assets/AccordionWrapper-ChJZiKaf.js                1.03 kB │ gzip:   0.59 kB │ map:     3.35 kB
dist/assets/event-xjs_l_HR.js                           1.62 kB │ gzip:   0.79 kB │ map:     7.43 kB
dist/assets/plans-pHTkk0TK.js                           2.69 kB │ gzip:   0.97 kB │ map:    31.00 kB
dist/assets/EvaluationDrillDownPanel-CVwn-IlL.js        2.82 kB │ gzip:   1.29 kB │ map:     6.60 kB
dist/assets/SessionAnalyticsPanel-O3J6Pwnz.js           2.98 kB │ gzip:   1.26 kB │ map:     6.89 kB
dist/assets/CharacterRelationshipsPanel-BLTmoNed.js     3.00 kB │ gzip:   1.32 kB │ map:     8.65 kB
dist/assets/failurePresentation-yUKpC8TD.js             3.15 kB │ gzip:   1.27 kB │ map:    12.13 kB
dist/assets/PatternDashboardPanel-DSRe7uq1.js           3.45 kB │ gzip:   1.49 kB │ map:    10.08 kB
dist/assets/exportDocx-CN_Ksees.js                      3.66 kB │ gzip:   1.55 kB │ map:    12.72 kB
dist/assets/ForeshadowingTrackerPanel-CtkVA-GH.js       5.36 kB │ gzip:   1.93 kB │ map:    12.97 kB
dist/assets/TemplateBrowserPanel-C_Y_5LiS.js            7.22 kB │ gzip:   2.52 kB │ map:    20.71 kB
dist/assets/RevisionPreviewCard-Clf5Pk9a.js             9.74 kB │ gzip:   3.19 kB │ map:    28.46 kB
dist/assets/AutomationPanel-fOIEzTs6.js                14.49 kB │ gzip:   4.27 kB │ map:    37.56 kB
dist/assets/WorkflowEditorPanel-1JnR4dDE.js            18.34 kB │ gzip:   5.05 kB │ map:    47.67 kB
dist/assets/vendor-lucide-D2Uoz3rY.js                  23.93 kB │ gzip:   8.63 kB │ map:    88.30 kB
dist/assets/McpStatusPanel-BNrObORr.js                 26.23 kB │ gzip:   6.48 kB │ map:    57.94 kB
dist/assets/AiTextOptimizer-BJ8we1QG.js                28.40 kB │ gzip:  10.88 kB │ map:    54.11 kB
dist/assets/AnalysisPanel-BAodF-SU.js                  35.84 kB │ gzip:  10.68 kB │ map:   105.44 kB
dist/assets/NarrativeVisualizationPanel-BtDoqYIC.js    38.32 kB │ gzip:   8.72 kB │ map:   100.75 kB
dist/assets/KnowledgeModal-TKgIpaws.js                 42.73 kB │ gzip:   9.66 kB │ map:   118.90 kB
dist/assets/StoryBiblePanel-BnyZM0x9.js                44.22 kB │ gzip:  10.99 kB │ map:   133.01 kB
dist/assets/WritingHelperPanel-CFjkJ-fm.js             45.43 kB │ gzip:  10.07 kB │ map:   113.09 kB
dist/assets/SettingsModal-DV46oXQn.js                  67.40 kB │ gzip:  14.12 kB │ map:   198.89 kB
dist/assets/EvaluationPanel-C7G_3yOY.js                74.40 kB │ gzip:  20.62 kB │ map:   234.11 kB
dist/assets/ChatArea-z4I0CrEU.js                       75.30 kB │ gzip:  21.60 kB │ map:   257.12 kB
dist/assets/vendor-markdown-BKKZwvaK.js               117.77 kB │ gzip:  36.26 kB │ map:   722.41 kB
dist/assets/vendor-virtual-C28XxP0U.js                150.80 kB │ gzip:  48.39 kB │ map:   386.75 kB
dist/assets/vendor-editor-DF3iE8r1.js                 184.20 kB │ gzip:  60.41 kB │ map:   782.69 kB
dist/assets/vendor-editor-pm-BRjesWX5.js              251.48 kB │ gzip:  77.66 kB │ map: 1,100.70 kB
dist/assets/vendor-katex-B4uVxgnO.js                  259.10 kB │ gzip:  77.03 kB │ map:   969.83 kB
dist/assets/vendor-docx-C11IHjUO.js                   349.71 kB │ gzip: 101.66 kB │ map: 1,317.17 kB
dist/assets/index-BYt7Gb34.js                         491.49 kB │ gzip: 148.24 kB │ map: 1,312.24 kB
✓ built in 8.68s

stderr | src/components/SettingsModal.test.tsx > SettingsModal quality presets > renders workflow backend mode labels in english
Warning: An update to TemplateManagerPanel inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act
    at TemplateManagerPanel (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\TemplateManagerPanel.tsx:13:33)
    at section
    at div
    at div
    at div
    at div
    at div
    at SettingsModal (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\SettingsModal.tsx:49:3)

stderr | src/components/SettingsModal.test.tsx > SettingsModal quality presets > keeps service and diagnostics hidden behind advanced support by default
Warning: An update to TemplateManagerPanel inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act
    at TemplateManagerPanel (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\TemplateManagerPanel.tsx:13:33)
    at section
    at div
    at div
    at div
    at div
    at div
    at SettingsModal (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\SettingsModal.tsx:49:3)

stderr | src/components/StoryBiblePanel.test.tsx > StoryBiblePanel > keeps the local draft visible and surfaces an explicit failure state when graph save fails
Failed to persist Story Bible: Error: graph unavailable
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\story-bible\useStoryBiblePanelController.ts:655:17)

stderr | src/components/knowledge/PersistedEntityTab.test.tsx > persisted knowledge authoring tabs > reports a load-specific error when the knowledge query fails on entry
Failed to load Character: Error: graph unavailable
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\knowledge\PersistedEntityTab.tsx:116:15

stderr | src/components/knowledge/PersistedEntityTab.test.tsx > persisted knowledge authoring tabs > retries loading automatically after backend health recovers
Failed to load Character: Error: graph unavailable
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\knowledge\PersistedEntityTab.tsx:116:15

stderr | src/components/knowledge/LocationTab.test.tsx > LocationTab > shows error status when graph query fails
Failed to load Location: Error: graph unavailable
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\knowledge\PersistedEntityTab.tsx:116:15

stderr | src/components/knowledge/PlotTab.test.tsx > PlotTab > shows error status when graph query fails
Failed to load Event: Error: graph unavailable
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\knowledge\PersistedEntityTab.tsx:116:15

stderr | src/components/knowledge/CharacterTab.test.tsx > CharacterTab > shows error status when the graph query fails
Failed to load Character: Error: graph unavailable
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\knowledge\PersistedEntityTab.tsx:116:15

stderr | src/components/cowriting/InlineHints.test.tsx > InlineHints > calls onDismiss when dismiss button is clicked
Warning: An update to InlineHints inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act
    at InlineHints (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\cowriting\InlineHints.tsx:15:24)

stderr | src/components/cowriting/InlineHints.test.tsx > InlineHints > dismisses all suggestions when close button is clicked
Warning: An update to InlineHints inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act
    at InlineHints (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\cowriting\InlineHints.tsx:15:24)

stderr | src/components/McpStatusPanel.test.tsx
[gateway-doctor] Not in Tauri environment or failed to listen: TypeError: Cannot read properties of undefined (reading 'transformCallback')
    at transformCallback (file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@tauri-apps/api/core.js:72:39)
    at listen (file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@tauri-apps/api/event.js:79:18)
    at startListening (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\components\McpStatusPanel.tsx:74:29)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)

stderr | src/api/client.test.ts > fetchProviderModels > returns combined gateway/direct reason when gateway 404 and direct fails
Fetch provider models failed (Error)

stderr | src/api/client.test.ts > workflow bridge and quality-check APIs > maps fetch rejection for novelQualityCheck
API call failed: /writing/quality (Error)

stderr | src/api/client.test.ts > chatStream > maps interrupted terminal when fetch throws abort-like error
Stream error: Error: AbortError
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\api\client.test.ts:2061:13
    at mockCall (file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@vitest/spy/dist/index.js:96:15)
    at spy (file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/tinyspy/dist/index.js:47:80)
    at chatStream (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\api\chat.ts:331:28)
    at C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src\api\client.test.ts:2064:11
    at file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@vitest/runner/dist/chunk-hooks.js:155:11
    at file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@vitest/runner/dist/chunk-hooks.js:752:26
    at file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@vitest/runner/dist/chunk-hooks.js:1897:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///C:/Users/niko/Desktop/%E5%B7%A5%E4%BD%9C%E7%9B%AE%E5%BD%95/niko-studio/desktop/node_modules/@vitest/runner/dist/chunk-hooks.js:1863:10)

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/hooks/useEditorAI.test.tsx > useEditorAI > restores the original selection on callback-only rewrite failure with no streamed content
AI stream error: stream failed

stderr | src/hooks/useEditorAI.test.tsx > useEditorAI > keeps partial streamed rewrite content when a callback-side error arrives late
AI stream error: stream failed

stderr | src/hooks/useEditorAI.test.tsx > useEditorAI > removes the loading placeholder for generate failures without altering surrounding content
AI stream error: stream failed

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

stderr | src/utils/export-edge.test.ts
Error: Not implemented: navigation (except hash changes)
    at module.exports (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\browser\not-implemented.js:9:17)
    at navigateFetch (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:77:3)
    at exports.navigate (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\window\navigation.js:55:3)
    at Timeout._onTimeout (C:\Users\niko\Desktop\工作目录\niko-studio\desktop\node_modules\jsdom\lib\jsdom\living\nodes\HTMLHyperlinkElementUtils-impl.js:80:7)
    at listOnTimeout (node:internal/timers:605:17)
    at processTimers (node:internal/timers:541:7) undefined

npm warn Unknown env config "build-from-source". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "disturl". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "runtime". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target-arch". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target-platform". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native addon; alternatives are available.
npm warn deprecated boolean@3.2.0: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
```

#### desktop_sidecar_readiness output

```text
> niko-studio-desktop@11.0.1 build:sidecar
> npm run build:sidecar:choose


> niko-studio-desktop@11.0.1 build:sidecar:choose
> node scripts/choose_sidecar.cjs

[sidecar:choose] Runtime selection: NIKO_GATEWAY_RUNTIME=node
[sidecar:choose] Authoritative runtime active: Node-first sidecar path
[sidecar:choose] Building Node sidecar (default runtime)...

> niko-studio-desktop@11.0.1 build:sidecar:node
> npm run check:node-sidecar && node scripts/build_node_sidecar.cjs


> niko-studio-desktop@11.0.1 check:node-sidecar
> node --check src-tauri/bin/niko-gateway-node

[sidecar:bundle] build host: win32-x64, Node v24.16.0
[sidecar:bundle] stage dir: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin\sidecar
[sidecar:bundle] bundled Node version: v20.18.1 (NIKO_SIDECAR_BUNDLE_NODE=true)
[sidecar:bundle] compiling src-ts → dist/ via npm run build

> niko-studio-backend@11.0.1 build
> tsc && node scripts/postprocess_esm_imports.cjs

[src-ts:postprocess] rewrote relative ESM imports in 211 file(s)
[sidecar:bundle] post-processing compiled JS: adding .js extensions to ESM relative imports
[sidecar:bundle] post-process: rewrote relative imports in 0 file(s)
[sidecar:bundle] staging compiled JS into desktop\src-tauri\bin\sidecar
[sidecar:bundle] hydrating production deps in desktop\src-tauri\bin\sidecar (npm ci --omit=dev)
[sidecar:bundle]   ABI target: Node v20.18.1 on win32-x64 (forces matching prebuilds)

added 266 packages in 9s
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/darwin (~43.3 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/linux (~30.4 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-node/bin/napi-v3/win32/arm64 (~9.2 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/darwin (~64.8 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/linux (~75.8 MB)
[sidecar:bundle]   trim: removed node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3/win32/arm64 (~34.0 MB)
[sidecar:bundle]   trim: removed node_modules/onnxruntime-web (~65.0 MB)
[sidecar:bundle]   trim: removed node_modules/@xenova/transformers/dist (~43.1 MB)
[sidecar:bundle] trim: total removed ~365.5 MB
[sidecar:bundle] reusing extracted Node 20.18.1 at .workflow\.cache\portable-node\node-v20.18.1-win-x64
[sidecar:bundle] copied portable node.exe → desktop\src-tauri\bin\sidecar\node.exe
[sidecar:bundle] ✅ Node sidecar bundle staged
[sidecar:bundle]    Next: cargo build --release --bin niko-gateway-launcher
[sidecar:bundle]    Then: copy launcher to bin/niko-gateway-x86_64-pc-windows-msvc.exe and run validate:sidecar-contract
[sidecar:choose] ✅ Node sidecar ready
[sidecar:choose] 📝 Wrote sidecar manifest (node v11.0.1) to desktop\src-tauri\bin\sidecar.manifest.json
[sidecar:choose] Validating sidecar contract...

> niko-studio-desktop@11.0.1 validate:sidecar-contract
> node scripts/validate_sidecar_contract.cjs --strict

🔍 Sidecar Contract Validator
   Bin directory: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin
   Platform: Windows
   Mode: STRICT
   Validation scope: node runtime
   Packaging proof: not required

📦 node (Node.js sidecar (standalone proxy))
   Platform: windows
   ✅ niko-gateway-node
   ✅ niko-gateway-node.cmd
   Status: ✅ PASS

🔐 Desktop security boundary
   ✅ main window label is explicit
   ✅ security.capabilities pins the frontend boundary
   ✅ release CSP constrains runtime fetches and asset loading
   ✅ dev CSP keeps Vite localhost access explicit
   ✅ freezePrototype hardening is enabled
   ✅ capability file exists for the main window only
   ✅ frontend capability matches the explicit desktop permission contract

🧭 Runtime / packaging matrix
   Authoritative local runtime: node
   Packaged compatibility runtime: python
   Current target triple: x86_64-pc-windows-msvc
   Validation mode: local/runtime contract
   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.
   Packaging prerequisite note: hydrated packaged compatibility artifact is checked by validate:package:dry-run, not by the generic sidecar contract gate.
   ✅ authoritative local runtime remains node-first
   ✅ packaged externalBin stays on the python compatibility sidecar
   ✅ packaged compatibility artifact is present when explicit packaging proof is requested
   ✅ node sidecar is repo-local only and not claimed as a packaged binary

🔢 Sidecar version contract (ISS-20260430-001 guard)
   Expected version (desktop/package.json): 11.0.1
   Manifest present: true
   Manifest version: 11.0.1 (match=true)
   Bundled binary age vs package.json: -0.0d (stale=false)
   ✅ sidecar.manifest.json records the build provenance
   ✅ bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)
   ✅ bundled sidecar binary is not stale vs package.json (>30d threshold)

============================================================
✅ All contracts validated successfully
[sidecar:choose] ✅ Sidecar build complete

npm warn Unknown env config "build-from-source". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "disturl". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "runtime". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target-arch". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown env config "target-platform". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native addon; alternatives are available.
npm warn deprecated boolean@3.2.0: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.

> niko-studio-desktop@11.0.1 validate:sidecar-contract
> node scripts/validate_sidecar_contract.cjs --strict

🔍 Sidecar Contract Validator
   Bin directory: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin
   Platform: Windows
   Mode: STRICT
   Validation scope: node runtime
   Packaging proof: not required

📦 node (Node.js sidecar (standalone proxy))
   Platform: windows
   ✅ niko-gateway-node
   ✅ niko-gateway-node.cmd
   Status: ✅ PASS

🔐 Desktop security boundary
   ✅ main window label is explicit
   ✅ security.capabilities pins the frontend boundary
   ✅ release CSP constrains runtime fetches and asset loading
   ✅ dev CSP keeps Vite localhost access explicit
   ✅ freezePrototype hardening is enabled
   ✅ capability file exists for the main window only
   ✅ frontend capability matches the explicit desktop permission contract

🧭 Runtime / packaging matrix
   Authoritative local runtime: node
   Packaged compatibility runtime: python
   Current target triple: x86_64-pc-windows-msvc
   Validation mode: local/runtime contract
   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.
   Packaging prerequisite note: hydrated packaged compatibility artifact is checked by validate:package:dry-run, not by the generic sidecar contract gate.
   ✅ authoritative local runtime remains node-first
   ✅ packaged externalBin stays on the python compatibility sidecar
   ✅ packaged compatibility artifact is present when explicit packaging proof is requested
   ✅ node sidecar is repo-local only and not claimed as a packaged binary

🔢 Sidecar version contract (ISS-20260430-001 guard)
   Expected version (desktop/package.json): 11.0.1
   Manifest present: true
   Manifest version: 11.0.1 (match=true)
   Bundled binary age vs package.json: -0.0d (stale=false)
   ✅ sidecar.manifest.json records the build provenance
   ✅ bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)
   ✅ bundled sidecar binary is not stale vs package.json (>30d threshold)

============================================================
✅ All contracts validated successfully
```

#### desktop_packaging_dry_run output

```text
> niko-studio-desktop@11.0.1 validate:package:dry-run
> npm run hydrate:packaged-compat && node scripts/validate_sidecar_contract.cjs --strict --strict-packaging && npm run tauri -- build --debug --no-bundle --target x86_64-pc-windows-msvc


> niko-studio-desktop@11.0.1 hydrate:packaged-compat
> node scripts/hydrate_packaged_compat_artifact.cjs

[sidecar:hydrate] source: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\target\release\niko-gateway-launcher.exe
[sidecar:hydrate] wrote: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin\niko-gateway.exe
[sidecar:hydrate] wrote: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin\niko-gateway-x86_64-pc-windows-msvc.exe
🔍 Sidecar Contract Validator
   Bin directory: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\bin
   Platform: Windows
   Mode: STRICT
   Validation scope: node runtime
   Packaging proof: required

📦 node (Node.js sidecar (standalone proxy))
   Platform: windows
   ✅ niko-gateway-node
   ✅ niko-gateway-node.cmd
   Status: ✅ PASS

🔐 Desktop security boundary
   ✅ main window label is explicit
   ✅ security.capabilities pins the frontend boundary
   ✅ release CSP constrains runtime fetches and asset loading
   ✅ dev CSP keeps Vite localhost access explicit
   ✅ freezePrototype hardening is enabled
   ✅ capability file exists for the main window only
   ✅ frontend capability matches the explicit desktop permission contract

🧭 Runtime / packaging matrix
   Authoritative local runtime: node
   Packaged compatibility runtime: python
   Current target triple: x86_64-pc-windows-msvc
   Validation mode: packaging proof
   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.
   ✅ authoritative local runtime remains node-first
   ✅ packaged externalBin stays on the python compatibility sidecar
   ✅ packaged compatibility artifact is present when explicit packaging proof is requested
   ✅ node sidecar is repo-local only and not claimed as a packaged binary

🔢 Sidecar version contract (ISS-20260430-001 guard)
   Expected version (desktop/package.json): 11.0.1
   Manifest present: true
   Manifest version: 11.0.1 (match=true)
   Bundled binary age vs package.json: -0.0d (stale=false)
   ✅ sidecar.manifest.json records the build provenance
   ✅ bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)
   ✅ bundled sidecar binary is not stale vs package.json (>30d threshold)

============================================================
✅ All contracts validated successfully

> niko-studio-desktop@11.0.1 tauri
> node ./node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle --target x86_64-pc-windows-msvc


> niko-studio-desktop@11.0.1 build
> npm run ensure-deps && tsc && vite build


> niko-studio-desktop@11.0.1 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

vite v7.3.2 building client environment for production...
transforming...
✓ 2307 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                         0.98 kB │ gzip:   0.42 kB
dist/assets/KaTeX_Size3-Regular-CTq5MqoE.woff           4.42 kB
dist/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2          4.93 kB
dist/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2          5.21 kB
dist/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2          5.47 kB
dist/assets/KaTeX_Size4-Regular-BF-4gkZK.woff           5.98 kB
dist/assets/KaTeX_Size2-Regular-oD1tc_U0.woff           6.19 kB
dist/assets/KaTeX_Size1-Regular-C195tn64.woff           6.50 kB
dist/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2    6.91 kB
dist/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2       6.91 kB
dist/assets/KaTeX_Size3-Regular-DgpXs0kz.ttf            7.59 kB
dist/assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff     7.66 kB
dist/assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff        7.72 kB
dist/assets/KaTeX_Script-Regular-D3wIWfF6.woff2         9.64 kB
dist/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2     10.34 kB
dist/assets/KaTeX_Size4-Regular-DWFBv043.ttf           10.36 kB
dist/assets/KaTeX_Script-Regular-D5yQViql.woff         10.59 kB
dist/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2       11.32 kB
dist/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2          11.35 kB
dist/assets/KaTeX_Size2-Regular-B7gKUWhC.ttf           11.51 kB
dist/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2      12.03 kB
dist/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2        12.22 kB
dist/assets/KaTeX_Size1-Regular-Dbsnue_I.ttf           12.23 kB
dist/assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff      12.32 kB
dist/assets/KaTeX_Caligraphic-Regular-wX97UBjC.ttf     12.34 kB
dist/assets/KaTeX_Caligraphic-Bold-ATXxdsX0.ttf        12.37 kB
dist/assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff        13.21 kB
dist/assets/KaTeX_Fraktur-Bold-BsDP51OF.woff           13.30 kB
dist/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2    13.57 kB
dist/assets/KaTeX_SansSerif-Italic-DN2j7dab.woff       14.11 kB
dist/assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff         14.41 kB
dist/assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff     16.03 kB
dist/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2       16.40 kB
dist/assets/KaTeX_Math-Italic-t53AETM-.woff2           16.44 kB
dist/assets/KaTeX_Script-Regular-C5JkGWo-.ttf          16.65 kB
dist/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2       16.78 kB
dist/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2           16.99 kB
dist/assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff        18.67 kB
dist/assets/KaTeX_Math-Italic-DA0__PXp.woff            18.75 kB
dist/assets/KaTeX_Main-BoldItalic-SpSLRI95.woff        19.41 kB
dist/assets/KaTeX_SansSerif-Regular-BNo7hRIc.ttf       19.44 kB
dist/assets/KaTeX_Fraktur-Regular-CB_wures.ttf         19.57 kB
dist/assets/KaTeX_Fraktur-Bold-BdnERNNW.ttf            19.58 kB
dist/assets/KaTeX_Main-Italic-BMLOBm91.woff            19.68 kB
dist/assets/KaTeX_SansSerif-Italic-YYjJ1zSn.ttf        22.36 kB
dist/assets/KaTeX_SansSerif-Bold-CFMepnvq.ttf          24.50 kB
dist/assets/KaTeX_Main-Bold-Cx986IdX.woff2             25.32 kB
dist/assets/KaTeX_Main-Regular-B22Nviop.woff2          26.27 kB
dist/assets/KaTeX_Typewriter-Regular-D3Ib7_Hf.ttf      27.56 kB
dist/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2           28.08 kB
dist/assets/KaTeX_Main-Bold-Jm3AIy58.woff              29.91 kB
dist/assets/KaTeX_Main-Regular-Dr94JaBh.woff           30.77 kB
dist/assets/KaTeX_Math-BoldItalic-B3XSjfu4.ttf         31.20 kB
dist/assets/KaTeX_Math-Italic-flOr_0UB.ttf             31.31 kB
dist/assets/KaTeX_Main-BoldItalic-DzxPMmG6.ttf         32.97 kB
dist/assets/KaTeX_AMS-Regular-DMm9YOAa.woff            33.52 kB
dist/assets/KaTeX_Main-Italic-3WenGoN9.ttf             33.58 kB
dist/assets/KaTeX_Main-Bold-waoOVXN0.ttf               51.34 kB
dist/assets/KaTeX_Main-Regular-ypZvNtVU.ttf            53.58 kB
dist/assets/KaTeX_AMS-Regular-DRggAlZN.ttf             63.63 kB
dist/assets/vendor-katex-wklAmtGL.css                  29.24 kB │ gzip:   8.04 kB
dist/assets/index-C4xGZ6rF.css                        120.35 kB │ gzip:  18.85 kB
dist/assets/vendor-sentry-C4xrE_kX.js                   0.09 kB │ gzip:   0.10 kB │ map:     0.11 kB
dist/assets/m10-apis-DVOgAIif.js                        0.26 kB │ gzip:   0.22 kB │ map:     2.79 kB
dist/assets/MetricValue-DhV80kd7.js                     0.33 kB │ gzip:   0.25 kB │ map:     0.81 kB
dist/assets/ProgressBar-CpBUdF56.js                     0.34 kB │ gzip:   0.27 kB │ map:     0.89 kB
dist/assets/wiki-CPqtLL8w.js                            0.61 kB │ gzip:   0.35 kB │ map:     4.31 kB
dist/assets/SectionHeader-9OsPS9Bm.js                   0.67 kB │ gzip:   0.44 kB │ map:     2.05 kB
dist/assets/AccordionWrapper-ChJZiKaf.js                1.03 kB │ gzip:   0.59 kB │ map:     3.35 kB
dist/assets/event-xjs_l_HR.js                           1.62 kB │ gzip:   0.79 kB │ map:     7.43 kB
dist/assets/plans-pHTkk0TK.js                           2.69 kB │ gzip:   0.97 kB │ map:    31.00 kB
dist/assets/EvaluationDrillDownPanel-CVwn-IlL.js        2.82 kB │ gzip:   1.29 kB │ map:     6.60 kB
dist/assets/SessionAnalyticsPanel-O3J6Pwnz.js           2.98 kB │ gzip:   1.26 kB │ map:     6.89 kB
dist/assets/CharacterRelationshipsPanel-BLTmoNed.js     3.00 kB │ gzip:   1.32 kB │ map:     8.65 kB
dist/assets/failurePresentation-yUKpC8TD.js             3.15 kB │ gzip:   1.27 kB │ map:    12.13 kB
dist/assets/PatternDashboardPanel-DSRe7uq1.js           3.45 kB │ gzip:   1.49 kB │ map:    10.08 kB
dist/assets/exportDocx-CN_Ksees.js                      3.66 kB │ gzip:   1.55 kB │ map:    12.72 kB
dist/assets/ForeshadowingTrackerPanel-CtkVA-GH.js       5.36 kB │ gzip:   1.93 kB │ map:    12.97 kB
dist/assets/TemplateBrowserPanel-C_Y_5LiS.js            7.22 kB │ gzip:   2.52 kB │ map:    20.71 kB
dist/assets/RevisionPreviewCard-Clf5Pk9a.js             9.74 kB │ gzip:   3.19 kB │ map:    28.46 kB
dist/assets/AutomationPanel-fOIEzTs6.js                14.49 kB │ gzip:   4.27 kB │ map:    37.56 kB
dist/assets/WorkflowEditorPanel-1JnR4dDE.js            18.34 kB │ gzip:   5.05 kB │ map:    47.67 kB
dist/assets/vendor-lucide-D2Uoz3rY.js                  23.93 kB │ gzip:   8.63 kB │ map:    88.30 kB
dist/assets/McpStatusPanel-BNrObORr.js                 26.23 kB │ gzip:   6.48 kB │ map:    57.94 kB
dist/assets/AiTextOptimizer-BJ8we1QG.js                28.40 kB │ gzip:  10.88 kB │ map:    54.11 kB
dist/assets/AnalysisPanel-BAodF-SU.js                  35.84 kB │ gzip:  10.68 kB │ map:   105.44 kB
dist/assets/NarrativeVisualizationPanel-BtDoqYIC.js    38.32 kB │ gzip:   8.72 kB │ map:   100.75 kB
dist/assets/KnowledgeModal-TKgIpaws.js                 42.73 kB │ gzip:   9.66 kB │ map:   118.90 kB
dist/assets/StoryBiblePanel-BnyZM0x9.js                44.22 kB │ gzip:  10.99 kB │ map:   133.01 kB
dist/assets/WritingHelperPanel-CFjkJ-fm.js             45.43 kB │ gzip:  10.07 kB │ map:   113.09 kB
dist/assets/SettingsModal-DV46oXQn.js                  67.40 kB │ gzip:  14.12 kB │ map:   198.89 kB
dist/assets/EvaluationPanel-C7G_3yOY.js                74.40 kB │ gzip:  20.62 kB │ map:   234.11 kB
dist/assets/ChatArea-z4I0CrEU.js                       75.30 kB │ gzip:  21.60 kB │ map:   257.12 kB
dist/assets/vendor-markdown-BKKZwvaK.js               117.77 kB │ gzip:  36.26 kB │ map:   722.41 kB
dist/assets/vendor-virtual-C28XxP0U.js                150.80 kB │ gzip:  48.39 kB │ map:   386.75 kB
dist/assets/vendor-editor-DF3iE8r1.js                 184.20 kB │ gzip:  60.41 kB │ map:   782.69 kB
dist/assets/vendor-editor-pm-BRjesWX5.js              251.48 kB │ gzip:  77.66 kB │ map: 1,100.70 kB
dist/assets/vendor-katex-B4uVxgnO.js                  259.10 kB │ gzip:  77.03 kB │ map:   969.83 kB
dist/assets/vendor-docx-C11IHjUO.js                   349.71 kB │ gzip: 101.66 kB │ map: 1,317.17 kB
dist/assets/index-BYt7Gb34.js                         491.49 kB │ gzip: 148.24 kB │ map: 1,312.24 kB
✓ built in 8.84s

        Info Looking up installed tauri packages to check mismatched versions...
     Running beforeBuildCommand `npm run build`
   Compiling niko-studio-desktop v11.0.1 (C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri)
warning: unused import: `VaultChangeEvent`
 --> src\vault_commands.rs:1:45
  |
1 | use crate::vault_watcher::{discover_vaults, VaultChangeEvent, VaultInfo, VaultWatcher};
  |                                             ^^^^^^^^^^^^^^^^
  |
  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default

warning: unused variable: `tx`
  --> src\vault_watcher.rs:27:14
   |
27 |         let (tx, rx): (mpsc::Sender<notify::Event>, mpsc::Receiver<notify::Event>) =
   |              ^^ help: if this is intentional, prefix it with an underscore: `_tx`
   |
   = note: `#[warn(unused_variables)]` (part of `#[warn(unused)]`) on by default

warning: field `vault_path` is never read
  --> src\vault_watcher.rs:22:5
   |
20 | pub struct VaultWatcher {
   |            ------------ field in this struct
21 |     _watcher: RecommendedWatcher,
22 |     vault_path: PathBuf,
   |     ^^^^^^^^^^
   |
   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default

warning: `niko-studio-desktop` (bin "niko-studio-desktop") generated 3 warnings (run `cargo fix --bin "niko-studio-desktop" -p niko-studio-desktop` to apply 2 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 29.59s
       Built application at: C:\Users\niko\Desktop\工作目录\niko-studio-coverage-delivery\desktop\src-tauri\target\x86_64-pc-windows-msvc\debug\niko-studio-desktop.exe
```

#### writing_helper_acceptance_signal output

```text
{
  "status": "PASS",
  "strict": true,
  "generated_at": "2026-06-12T14:27:12.6152766+00:00",
  "head_sha": "9a83e78a273b605195853f09e9b03f678b04fb2f",
  "version": "11.0.1",
  "host": "127.0.0.1",
  "port": 18080,
  "total_cases": 7,
  "passed_cases": 7,
  "failed_cases": 0,
  "failed_cases_path": null
}
```

#### external_e2e_smoke output

```text
RUN  v3.2.4 C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery

 ✓ src-ts/tests/mcp/workflow-critic-smoke.integration.test.ts (1 test) 1784ms
   ✓ workflow + critic smoke integration > generates workflow content and evaluates it through critic endpoints  1783ms
 ✓ src-ts/tests/mcp/workflow-endpoints.integration.test.ts (10 tests) 3273ms
   ✓ workflow endpoints integration > runs route -> plan -> execute through real workflow endpoints  1704ms


 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  22:32:52
   Duration  3.97s (transform 1.01s, setup 0ms, collect 117ms, tests 5.06s, environment 0ms, prepare 254ms)

JUNIT report written to C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/.workflow/evidence/release/vitest-e2e.xml

 DEPRECATED  'basic' reporter is deprecated and will be removed in Vitest v3.
Remove 'basic' from 'reporters' option. To match 'basic' reporter 100%, use configuration:
{
  "test": {
    "reporters": [
      [
        "default",
        {
          "summary": false
        }
      ]
    ]
  }
}
(node:156792) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 exit listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
(Use `node --trace-warnings ...` to show where the warning was created)
(node:156792) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGINT listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
(node:156792) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```

#### production_guard output

```text
RUN  v3.2.4 C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery

 ✓ src-ts/tests/mcp/health-endpoints.test.ts (5 tests) 19ms
 ✓ src-ts/tests/gateway-server.runtime.test.ts (2 tests) 7ms


 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  22:32:58
   Duration  3.09s (transform 1.49s, setup 0ms, collect 2.81s, tests 27ms, environment 0ms, prepare 273ms)

JUNIT report written to C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/.workflow/evidence/release/vitest-production-guard.xml

 DEPRECATED  'basic' reporter is deprecated and will be removed in Vitest v3.
Remove 'basic' from 'reporters' option. To match 'basic' reporter 100%, use configuration:
{
  "test": {
    "reporters": [
      [
        "default",
        {
          "summary": false
        }
      ]
    ]
  }
}
```

#### metrics_guard output

```text
RUN  v3.2.4 C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery

 ✓ src-ts/tests/mcp/health-endpoints.test.ts (5 tests) 19ms
 ✓ src-ts/tests/gateway-server.runtime.test.ts (2 tests) 7ms


 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  22:32:58
   Duration  3.09s (transform 1.49s, setup 0ms, collect 2.81s, tests 27ms, environment 0ms, prepare 273ms)

JUNIT report written to C:/Users/niko/Desktop/工作目录/niko-studio-coverage-delivery/.workflow/evidence/release/vitest-production-guard.xml

 DEPRECATED  'basic' reporter is deprecated and will be removed in Vitest v3.
Remove 'basic' from 'reporters' option. To match 'basic' reporter 100%, use configuration:
{
  "test": {
    "reporters": [
      [
        "default",
        {
          "summary": false
        }
      ]
    ]
  }
}
```

#### authority_alignment_signal output

```text
{
  "status": "PASS",
  "checked_rules": 96,
  "passed_rules": 96,
  "failed_rules": 0,
  "checked_files": [
    ".github/workflows/external-release-gate.yml",
    ".github/workflows/integration-tests.yml",
    ".pre-commit-config.yaml",
    "README.md",
    "desktop/README.md",
    "desktop/SIDECAR_IMPLEMENTATION_SUMMARY.md",
    "desktop/package.json",
    "desktop/scripts/choose_sidecar.cjs",
    "docs/INDEX.md",
    "docs/SECURITY_VISIBILITY.md",
    "docs/operations/DESKTOP_RUNBOOK.md",
    "docs/operations/ROLLBACK.md",
    "docs/release/RELEASE_NOTES.md",
    "docs/testing/TEST_TIER_MATRIX.md",
    "docs/workflow-entrypoint-inventory.md",
    "scripts/start_gateway.py",
    "src-ts/package.json"
  ],
  "mismatches": []
}
```

### 18) External Release Authority

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: repository contract in `.github/workflows/external-release-gate.yml` plus the local snapshot generated by this script.
- workflow_path: `.github/workflows/external-release-gate.yml`
- acceptance_workflow: `.github/workflows/writing-helper-acceptance.yml`
- policy_doc: `docs/release/RELEASE_NOTES.md`
- signoff_doc: `docs/release/SIGN_OFF.md`
- contract_docs: `README.md`, `desktop/README.md`, `docs/release/RELEASE_NOTES.md`, `docs/operations/DESKTOP_RUNBOOK.md`, `docs/operations/ROLLBACK.md`
- contract_labels: `Supported runtime`, `Supported launcher`, `Advisory compatibility surfaces`, `Deprecated surface`
- release_state_model:
  - `unsigned_local_proof`: repo-visible gates are green while `desktop/src-tauri/tauri.conf.json` still keeps `certificateThumbprint=null` and `timestampUrl=""`; valid local proof only, not a signed external shipment.
  - `prerequisite_missing_hold`: hold external shipment whenever any release prerequisite is missing [certificate thumbprint, timestamp URL, hydrated packaged compatibility artifact, Windows packaging host/toolchain].
  - `signed_external_release`: all repo-visible gates stay green and a Windows-hosted `npm --prefix desktop run tauri:build` completes with release-private signing inputs outside git.
- authority_alignment_checker: `scripts/check_authority_alignment.py`
- desktop_authoritative_local_gate: `npm --prefix desktop run check:local` (from `desktop/package.json` `check:local`, which currently resolves to `check:release`)
- desktop_local_selftest: `npm --prefix desktop run local:selftest` (required whenever retained release evidence for `release_summary_report`, `authority_alignment`, `writing_helper_acceptance`, or `governance_scripts_regression` is not already `fresh_current` for the current HEAD)
- packaging_dry_run: `npm --prefix desktop run validate:package:dry-run` (`tauri build --debug --no-bundle --target x86_64-pc-windows-msvc`)
- package_e2e_checklist: `npm --prefix desktop run package:e2e:checklist` (records installed-package install/start/use acceptance for the exact retained package artifact)
- formal_evidence_dir: `.workflow/evidence/release`
- retained_production_contract_evidence: `release-check-summary.md`, `.workflow/evidence/release/release-readiness-artifact.json`, `.workflow/evidence/release/authority-alignment.json`, `.workflow/evidence/release/writing-helper-acceptance.json`, `.workflow/evidence/release/package-e2e-acceptance.json`, `.workflow/evidence/release/vitest-production-guard.xml`, `.workflow/evidence/release/vitest-e2e.xml`, `.workflow/evidence/release/governance-scripts.junit.xml`
- authority_alignment_artifact: `.workflow/evidence/release/authority-alignment.json`
- writing_helper_acceptance_artifact: `.workflow/evidence/release/writing-helper-acceptance.json`
- package_e2e_acceptance_artifact: `.workflow/evidence/release/package-e2e-acceptance.json`
- governance_junit: `.workflow/evidence/release/governance-scripts.junit.xml`
- production_guard_junit: `.workflow/evidence/release/vitest-production-guard.xml`
- external_smoke_junit: `.workflow/evidence/release/vitest-e2e.xml`
- signing_prerequisite: `desktop/src-tauri/tauri.conf.json` keeps `certificateThumbprint=null` and `timestampUrl=""` for unsigned local proof; signed external bundles require release-private override material outside git.
