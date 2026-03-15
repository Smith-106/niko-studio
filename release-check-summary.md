# Release Check Summary

- Decision: GO
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: disabled

## Deterministic Check Results

| check_id | priority | blocking | status |
|---|---|---|---|
| version_consistency | P0 | true | PASS |
| delivery_semantic_gate | P0 | true | PASS |
| baseline_tests_and_coverage | P0 | true | PASS |
| desktop_check | P0 | true | PASS |
| external_e2e_smoke | P1 | false | PASS |
| production_guard | P1 | false | PASS |
| metrics_guard | P1 | false | PASS |
| codecov_signal | P1 | false | PASS |
| evidence_completeness_blocker_signal | P0 | true | PASS |
| gate_score_or_critical_blocker_signal | P0 | true | PASS |
| runtime_policy_conformance_signal | P0 | true | PASS |
| evidence_coverage_signal | P1 | false | PASS |
| slo_baseline_signal | P1 | false | WARN |
| evidence_links_signal | P1 | false | PASS |
| self_learning_signal | P1 | false | WARN |
| memory_observability_signal | P1 | false | WARN |
| quality_level_trace_signal | P1 | false | WARN |
| degrade_trace_signal | P1 | false | WARN |
| critical_gate_enforcement_signal | P1 | false | WARN |
| chapter_gate_scoring_signal | P1 | false | PASS |
| cycle_time_kpi_measurement_signal | P1 | false | WARN |
| comparable_quality_rubric_signal | P1 | false | WARN |
| weekly_kpi_dashboard_schema_signal | P1 | false | WARN |
| weekly_kpi_rollup_readiness_signal | P1 | false | WARN |
| weekly_kpi_comparability_visibility_signal | P1 | false | WARN |
| critical_conflict_blocker_signal | P0 | true | PASS |
| unresolved_triage_blocker_signal | P0 | true | PASS |
| feedback_artifact_linkage_signal | P1 | false | PASS |
| conflict_artifact_linkage_signal | P1 | false | PASS |
| chapter_gate_evidence_linkage_signal | P1 | false | PASS |
| evidence_freshness_signal | P1 | false | PASS |
| migration_rollback_evidence_signal | P1 | false | WARN |
| compliance_keywords_signal | P1 | false | WARN |
| tasks_completion_signal | P1 | false | PASS |

## Machine-Readable Decision

```json
{
  "decision": "GO",
  "go_no_go_reasons": [],
  "generated_at": "2026-03-14T12:59:52.468856+00:00",
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
      "check_id": "baseline_tests_and_coverage",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "status=passed,passed_count=6318"
    },
    {
      "check_id": "desktop_check",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "command=npm --prefix desktop run check"
    },
    {
      "check_id": "external_e2e_smoke",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "status=passed,passed_count=16"
    },
    {
      "check_id": "production_guard",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "guard=reload_cors_production"
    },
    {
      "check_id": "metrics_guard",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "guard=gateway_metrics_production"
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
      "detail": "chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_not_pass_or_critical_or_unresolved_triage,decision=go"
    },
    {
      "check_id": "runtime_policy_conformance_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go"
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
      "status": "WARN",
      "exit_code": 0,
      "detail": "missing_keywords=ttft,effective_hit_rate,context_budget_utilization,gate consistency"
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
      "status": "WARN",
      "exit_code": 0,
      "detail": "missing_fields=reflector,curator,playbook"
    },
    {
      "check_id": "memory_observability_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "missing_metrics=c_effective,s_final,r_memory,invalid_metrics="
    },
    {
      "check_id": "quality_level_trace_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "effective_quality_level=missing,quality_level_used=missing"
    },
    {
      "check_id": "degrade_trace_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "degrade_reason=missing,degrade_steps=missing"
    },
    {
      "check_id": "critical_gate_enforcement_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "critical_gate=missing"
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
      "status": "WARN",
      "exit_code": 0,
      "detail": "window_policy=full_7_day_only,manual_override=forbidden,missing_rules=baseline_window_days,measurement_window_days,baseline_state,cycle_time_baseline_median,cycle_time_current_median,eligible_samples,present_exclusion_reason_codes="
    },
    {
      "check_id": "comparable_quality_rubric_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "rubric_version=v1,quality_score=99.0,threshold=99.0,critical_issue_count=0,publish_recommendation=pass,quality_level_match=no,degrade_trace_complete=yes,decision=not_comparable"
    },
    {
      "check_id": "weekly_kpi_dashboard_schema_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "schema_name=weekly_kpi_dashboard,schema_version=v1,manual_override=forbidden,missing_fields=schema_version,window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend,comparability_decision,chapter_gate_aggregation_result"
    },
    {
      "check_id": "weekly_kpi_rollup_readiness_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "rollup_source=canonical_evidence,manual_override=forbidden,baseline_state=missing,cycle_time_trend=missing,missing_fields=window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend"
    },
    {
      "check_id": "weekly_kpi_comparability_visibility_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,comparability_decision=missing,cycle_time_trend=missing,baseline_state=missing,missing_fields=comparability_decision,cycle_time_trend,baseline_state"
    },
    {
      "check_id": "critical_conflict_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "snapshots_scanned=3,linked_conflict_artifacts=1,critical_conflicts_linked=0,invalid_snapshots=0,decision=go"
    },
    {
      "check_id": "unresolved_triage_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "state_files_scanned=333,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=333,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=go"
    },
    {
      "check_id": "feedback_artifact_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "snapshots_scanned=1,linked_feedback_artifacts=1,invalid_snapshots=0"
    },
    {
      "check_id": "conflict_artifact_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "snapshots_scanned=3,linked_conflict_artifacts=1,critical_conflicts_linked=0,invalid_snapshots=0"
    },
    {
      "check_id": "chapter_gate_evidence_linkage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "snapshots_scanned=3,eligible_release_gate_runs=1,chapter_gate_checks_linked=1,aggregation_window=active_sessions,result=aggregated,invalid_snapshots=0"
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
      "status": "WARN",
      "exit_code": 0,
      "detail": "migration=missing,rollback=missing,traceable_link=present"
    },
    {
      "check_id": "compliance_keywords_signal",
      "priority": "P1",
      "blocking": false,
      "status": "WARN",
      "exit_code": 0,
      "detail": "missing_keywords=rbac,audit,rollback"
    },
    {
      "check_id": "tasks_completion_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "checked=29,unchecked=0,completion_ratio=100.0%,json_parse_error=none"
    }
  ]
}
```

## Details

### Check Detail Summary (from machine payload)

- version_consistency: status=PASS, detail=script=scripts/check_versions.py
- delivery_semantic_gate: status=PASS, detail=script=scripts/delivery_gate.py
- baseline_tests_and_coverage: status=PASS, detail=status=passed,passed_count=6318
- desktop_check: status=PASS, detail=command=npm --prefix desktop run check
- external_e2e_smoke: status=PASS, detail=status=passed,passed_count=16
- production_guard: status=PASS, detail=guard=reload_cors_production
- metrics_guard: status=PASS, detail=guard=gateway_metrics_production
- codecov_signal: status=PASS, detail=strict_mode=false,token_present=false,coverage_xml=yes,result=coverage_available
- evidence_completeness_blocker_signal: status=PASS, detail=quality_non_template=2,weekly_non_template=5,machine_payload_available=yes,missing_evidence_classes=,decision=go
- gate_score_or_critical_blocker_signal: status=PASS, detail=chapter_gate_status=PASS,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_not_pass_or_critical_or_unresolved_triage,decision=go
- runtime_policy_conformance_signal: status=PASS, detail=policy_pass=99.0,runtime_pass=99.0,policy_human_review=95.0,runtime_human_review=95.0,policy_revise_lower=50.0,runtime_revise_lower=50.0,policy_rewrite_below=50.0,runtime_rewrite_below=50.0,publish_from_go=pass,publish_from_soft_go=revise,publish_from_no_go=block,terminal_default_decision=go,terminal_no_go_preserved=yes,quality_mode_consistent=yes,mismatches=,decision=go
- evidence_coverage_signal: status=PASS, detail=quality_non_template=2,weekly_non_template=5
- slo_baseline_signal: status=WARN, detail=missing_keywords=ttft,effective_hit_rate,context_budget_utilization,gate consistency
- evidence_links_signal: status=PASS, detail=evidence_links_key=present,traceable_link=present
- self_learning_signal: status=WARN, detail=missing_fields=reflector,curator,playbook
- memory_observability_signal: status=WARN, detail=missing_metrics=c_effective,s_final,r_memory,invalid_metrics=
- quality_level_trace_signal: status=WARN, detail=effective_quality_level=missing,quality_level_used=missing
- degrade_trace_signal: status=WARN, detail=degrade_reason=missing,degrade_steps=missing
- critical_gate_enforcement_signal: status=WARN, detail=critical_gate=missing
- chapter_gate_scoring_signal: status=PASS, detail=quality_score=99.0,threshold=99.0,publish_recommendation=pass,critical_issue_count=0,decision=go
- cycle_time_kpi_measurement_signal: status=WARN, detail=window_policy=full_7_day_only,manual_override=forbidden,missing_rules=baseline_window_days,measurement_window_days,baseline_state,cycle_time_baseline_median,cycle_time_current_median,eligible_samples,present_exclusion_reason_codes=
- comparable_quality_rubric_signal: status=WARN, detail=rubric_version=v1,quality_score=99.0,threshold=99.0,critical_issue_count=0,publish_recommendation=pass,quality_level_match=no,degrade_trace_complete=yes,decision=not_comparable
- weekly_kpi_dashboard_schema_signal: status=WARN, detail=schema_name=weekly_kpi_dashboard,schema_version=v1,manual_override=forbidden,missing_fields=schema_version,window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend,comparability_decision,chapter_gate_aggregation_result
- weekly_kpi_rollup_readiness_signal: status=WARN, detail=rollup_source=canonical_evidence,manual_override=forbidden,baseline_state=missing,cycle_time_trend=missing,missing_fields=window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend
- weekly_kpi_comparability_visibility_signal: status=WARN, detail=visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,comparability_decision=missing,cycle_time_trend=missing,baseline_state=missing,missing_fields=comparability_decision,cycle_time_trend,baseline_state
- critical_conflict_blocker_signal: status=PASS, detail=snapshots_scanned=3,linked_conflict_artifacts=1,critical_conflicts_linked=0,invalid_snapshots=0,decision=go
- unresolved_triage_blocker_signal: status=PASS, detail=state_files_scanned=333,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=333,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=go
- feedback_artifact_linkage_signal: status=PASS, detail=snapshots_scanned=1,linked_feedback_artifacts=1,invalid_snapshots=0
- conflict_artifact_linkage_signal: status=PASS, detail=snapshots_scanned=3,linked_conflict_artifacts=1,critical_conflicts_linked=0,invalid_snapshots=0
- chapter_gate_evidence_linkage_signal: status=PASS, detail=snapshots_scanned=3,eligible_release_gate_runs=1,chapter_gate_checks_linked=1,aggregation_window=active_sessions,result=aggregated,invalid_snapshots=0
- evidence_freshness_signal: status=PASS, detail=fresh_files=7,stale_files=0,window_days=14
- migration_rollback_evidence_signal: status=WARN, detail=migration=missing,rollback=missing,traceable_link=present
- compliance_keywords_signal: status=WARN, detail=missing_keywords=rbac,audit,rollback
- tasks_completion_signal: status=PASS, detail=checked=29,unchecked=0,completion_ratio=100.0%,json_parse_error=none

### Command Outputs

#### version_consistency output

```text
expected version: 8.0.0
- python.__version__: 8.0.0
- config/niko-studio.yaml: 8.0.0
- config/niko-studio.production.yaml: 8.0.0
- desktop/package.json: 8.0.0
- desktop/src-tauri/tauri.conf.json: 8.0.0
- desktop/src-tauri/Cargo.toml: 8.0.0

�汾һ���Լ��ͨ����
```

#### delivery_semantic_gate output

```text
delivery gate: start
delivery gate: ok
```

#### baseline_tests_and_coverage output

```text
........................................................................ [  1%]
........................................................................ [  2%]
........................................................................ [  3%]
........................................................................ [  4%]
........................................................................ [  5%]
........................................................................ [  6%]
........................................................................ [  7%]
........................................................................ [  9%]
........................................................................ [ 10%]
........................................................................ [ 11%]
........................................................................ [ 12%]
........................................................................ [ 13%]
........................................................................ [ 14%]
........................................................................ [ 15%]
........................................................................ [ 17%]
........................................................................ [ 18%]
........................................................................ [ 19%]
........................................................................ [ 20%]
........................................................................ [ 21%]
........................................................................ [ 22%]
........................................................................ [ 23%]
........................................................................ [ 25%]
........................................................................ [ 26%]
........................................................................ [ 27%]
........................................................................ [ 28%]
........................................................................ [ 29%]
........................................................................ [ 30%]
........................................................................ [ 31%]
........................................................................ [ 33%]
........................................................................ [ 34%]
........................................................................ [ 35%]
........................................................................ [ 36%]
........................................................................ [ 37%]
........................................................................ [ 38%]
........................................................................ [ 39%]
........................................................................ [ 41%]
........................................................................ [ 42%]
........................................................................ [ 43%]
........................................................................ [ 44%]
........................................................................ [ 45%]
........................................................................ [ 46%]
........................................................................ [ 47%]
........................................................................ [ 48%]
........................................................................ [ 50%]
........................................................................ [ 51%]
........................................................................ [ 52%]
........................................................................ [ 53%]
........................................................................ [ 54%]
........................................................................ [ 55%]
........................................................................ [ 56%]
...............................................s........................ [ 58%]
........................................................................ [ 59%]
........................................................................ [ 60%]
........................................................................ [ 61%]
........................................................................ [ 62%]
........................................................................ [ 63%]
........................................................................ [ 64%]
........................................................................ [ 66%]
........................................................................ [ 67%]
........................................................................ [ 68%]
........................................................................ [ 69%]
........................................................................ [ 70%]
........................................................................ [ 71%]
........................................................................ [ 72%]
........................................................................ [ 74%]
........................................................................ [ 75%]
........................................................................ [ 76%]
........................................................................ [ 77%]
........................................................................ [ 78%]
........................................................................ [ 79%]
........................................................................ [ 80%]
........................................................................ [ 82%]
........................................................................ [ 83%]
........................................................................ [ 84%]
........................................................................ [ 85%]
........................................................................ [ 86%]
........................................................................ [ 87%]
........................................................................ [ 88%]
........................................................................ [ 90%]
........................................................................ [ 91%]
........................................................................ [ 92%]
........................................................................ [ 93%]
.....................s.................................................. [ 94%]
........................................................................ [ 95%]
........................................................................ [ 96%]
........................................................................ [ 97%]
........................................................................ [ 99%]
........................................................                 [100%]
============================== warnings summary ===============================
src\services\__init__.py:29
  D:\����Ŀ¼\niko-studio\src\services\__init__.py:29: DeprecationWarning: DistillService is deprecated. Use src.memory.distillation_manager.DistillationManager instead.
    from src.services.distill_service import DistillService

C:\Users\32852\AppData\Local\Programs\Python\Python312\Lib\site-packages\pydantic\_internal\_config.py:323
  C:\Users\32852\AppData\Local\Programs\Python\Python312\Lib\site-packages\pydantic\_internal\_config.py:323: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.11/migration/
    warnings.warn(DEPRECATION_MESSAGE, DeprecationWarning)

src\workflow\graph.py:607
src\workflow\graph.py:607
tests/unit/workflow/test_graph_extra.py::TestCompileGraph::test_with_memory
tests/unit/workflow/test_graph_extra.py::TestCompileGraph::test_without_memory
tests/unit/workflow/test_graph_extra.py::TestImportFallback::test_default_app_fallback_to_none_when_compile_fails
tests/integration/test_workflow_integration.py::TestArchitectureBoundaryIntegration::test_boundary_graph_compile_delegates_to_adapter
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:607: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.graph.compile_graph
    _warn_legacy_entrypoint("src.workflow.graph.compile_graph")

src\workflow\graph.py:590
src\workflow\graph.py:590
tests/unit/test_workflow.py::TestCreateWritingGraph::test_graph_creation
tests/unit/test_workflow.py::TestCreateWritingGraph::test_graph_has_required_nodes
tests/unit/workflow/test_graph_extra.py::TestCreateWritingGraph::test_raises_when_adapter_is_none
tests/unit/workflow/test_graph_extra.py::TestImportFallback::test_default_app_fallback_to_none_when_compile_fails
tests/integration/test_workflow_integration.py::TestArchitectureBoundaryIntegration::test_boundary_graph_compile_delegates_to_adapter
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:590: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.graph.create_writing_graph
    _warn_legacy_entrypoint("src.workflow.graph.create_writing_graph")

src\workflow\graph.py:603
src\workflow\graph.py:603
tests/unit/test_workflow.py::TestCreateWritingGraph::test_graph_creation
tests/unit/test_workflow.py::TestCreateWritingGraph::test_graph_has_required_nodes
tests/integration/test_workflow_integration.py::TestArchitectureBoundaryIntegration::test_boundary_graph_compile_delegates_to_adapter
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:603: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.adapters.novel_adapter.NovelAdapter.create_graph
    return adapter.create_graph()

tests/unit/mcp/test_gateway_endpoints.py::test_gateway_main_invokes_uvicorn_with_resolved_settings
  <frozen runpy>:128: RuntimeWarning: 'src.mcp.gateway' found in sys.modules after import of package 'src.mcp', but prior to execution of 'src.mcp.gateway'; this may result in unpredictable behaviour

tests/unit/test_cli_module_entry.py::test_cli_main_runs_main_under_name_main
  <frozen runpy>:128: RuntimeWarning: 'src.cli.main' found in sys.modules after import of package 'src.cli', but prior to execution of 'src.cli.main'; this may result in unpredictable behaviour

tests/unit/workflow/test_adapter_contract_matrix.py::test_contract_factory_creation_and_unknown_domain_fail_fast
  D:\����Ŀ¼\niko-studio\src\workflow\graph_factory.py:67: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.adapters.novel_adapter.NovelAdapter.create_graph
    graph = adapter.create_graph()

tests/unit/workflow/test_graph.py::TestCreateDistillationNode::test_default
tests/unit/workflow/test_graph.py::TestCreateDistillationNode::test_with_template
tests/unit/workflow/test_graph.py::TestCreateDistillationNode::test_with_knowledge_layer
tests/unit/workflow/test_graph_distillation.py::TestCreateDistillationNode::test_default
tests/unit/workflow/test_graph_distillation.py::TestCreateDistillationNode::test_with_template
tests/unit/workflow/test_graph_distillation.py::TestCreateDistillationNode::test_with_knowledge_layer
tests/unit/workflow/test_graph_extra.py::TestCreateDistillationNode::test_default
tests/unit/workflow/test_graph_extra.py::TestCreateDistillationNode::test_with_template
tests/unit/workflow/test_graph_extra.py::TestCreateDistillationNode::test_with_knowledge_layer
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:563: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.graph.create_distillation_node
    _warn_legacy_entrypoint("src.workflow.graph.create_distillation_node")

tests/unit/workflow/test_graph_extra.py::TestCanonicalNormalizationAndConflictBranches::test_conditional_true
tests/unit/workflow/test_graph_extra.py::TestCanonicalNormalizationAndConflictBranches::test_conditional_false
tests/unit/workflow/test_graph_extra.py::TestCanonicalNormalizationAndConflictBranches::test_route_to_distill_goes_to_distillation
tests/unit/workflow/test_graph_extra.py::TestCanonicalNormalizationAndConflictBranches::test_route_to_distill_goes_to_critic
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:518: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.graph.add_distillation_node
    _warn_legacy_entrypoint("src.workflow.graph.add_distillation_node")

tests/unit/workflow/test_graph_extra.py::TestRunWritingSession::test_basic
tests/unit/workflow/test_graph_extra.py::TestRunWritingSession::test_stream_safety_cap_branch
tests/unit/workflow/test_graph_extra.py::TestRunWritingSession::test_verbose_branch_and_node_prints
tests/unit/workflow/test_graph_extra.py::TestRunWritingSession::test_non_graph_recursion_error_is_reraised
tests/unit/workflow/test_graph_extra.py::TestRunWritingSession::test_graph_recursion_error_branch
tests/integration/test_workflow_integration.py::TestArchitectureBoundaryIntegration::test_boundary_graph_run_session_uses_graph_facade_only
  D:\����Ŀ¼\niko-studio\src\workflow\graph.py:638: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.graph.run_writing_session
    _warn_legacy_entrypoint("src.workflow.graph.run_writing_session")

tests/unit/workflow/test_novel_adapter.py::TestCreateGraph::test_creates_graph
  D:\����Ŀ¼\niko-studio\tests\unit\workflow\test_novel_adapter.py:950: DeprecationWarning: Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. Use WorkflowEngine entry API (route/plan/execute/run) as the single public authority. source=src.workflow.adapters.novel_adapter.NovelAdapter.create_graph
    graph = adapter.create_graph()

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html

---------- coverage: platform win32, python 3.12.10-final-0 ----------
Coverage XML written to file coverage.xml

Required test coverage of 80% reached. Total coverage: 99.50%
6318 passed, 2 skipped, 16 deselected, 43 warnings in 789.74s (0:13:09)
```

#### desktop_check output

```text
> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

> niko-studio-desktop@8.0.0 check
> npm run typecheck && npm run build


> niko-studio-desktop@8.0.0 typecheck
> tsc --noEmit


> niko-studio-desktop@8.0.0 build
> npm run ensure-deps && tsc && vite build


> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

[36mvite v7.3.1 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 1668 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.47 kB[22m[1m[22m[2m │ gzip:   0.31 kB[22m
[2mdist/[22m[35massets/index-D_oqkGbV.css  [39m[1m[2m 25.17 kB[22m[1m[22m[2m │ gzip:   5.41 kB[22m
[2mdist/[22m[36massets/index-B-UkZU2D.js   [39m[1m[2m480.21 kB[22m[1m[22m[2m │ gzip: 136.48 kB[22m
[32m✓ built in 11.50s[39m
```

#### external_e2e_smoke output

```text
................                                                         [100%]
16 passed in 7.82s
```

#### production_guard output

```text
production guard ok

INFO:IndexingService:sqlite-vec module imported successfully.
```

#### metrics_guard output

```text
metrics guard ok
```

### 18) CI Integration Tests latest

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: GitHub Actions `Integration Tests` latest result.
- workflow_url: https://github.com/Smith-106/niko-studio/actions/workflows/integration-tests.yml
