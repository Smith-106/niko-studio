# Release Check Summary

- Decision: NO_GO
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: disabled

## Deterministic Check Results

| check_id | priority | blocking | status |
|---|---|---|---|
| version_consistency | P0 | true | PASS |
| delivery_semantic_gate | P0 | true | PASS |
| baseline_tests_and_coverage | P0 | true | FAIL |
| desktop_check | P0 | true | FAIL |
| external_e2e_smoke | P1 | false | PASS |
| production_guard | P1 | false | PASS |
| metrics_guard | P1 | false | PASS |
| codecov_signal | P1 | false | PASS |
| evidence_completeness_blocker_signal | P0 | true | PASS |
| gate_score_or_critical_blocker_signal | P0 | true | FAIL |
| evidence_coverage_signal | P1 | false | PASS |
| slo_baseline_signal | P1 | false | WARN |
| evidence_links_signal | P1 | false | PASS |
| self_learning_signal | P1 | false | WARN |
| memory_observability_signal | P1 | false | WARN |
| quality_level_trace_signal | P1 | false | WARN |
| degrade_trace_signal | P1 | false | WARN |
| critical_gate_enforcement_signal | P1 | false | WARN |
| chapter_gate_scoring_signal | P1 | false | WARN |
| cycle_time_kpi_measurement_signal | P1 | false | WARN |
| comparable_quality_rubric_signal | P1 | false | WARN |
| weekly_kpi_dashboard_schema_signal | P1 | false | WARN |
| weekly_kpi_rollup_readiness_signal | P1 | false | WARN |
| weekly_kpi_comparability_visibility_signal | P1 | false | WARN |
| critical_conflict_blocker_signal | P0 | true | PASS |
| unresolved_triage_blocker_signal | P0 | true | PASS |
| feedback_artifact_linkage_signal | P1 | false | WARN |
| conflict_artifact_linkage_signal | P1 | false | WARN |
| chapter_gate_evidence_linkage_signal | P1 | false | WARN |
| evidence_freshness_signal | P1 | false | PASS |
| migration_rollback_evidence_signal | P1 | false | WARN |
| compliance_keywords_signal | P1 | false | WARN |
| tasks_completion_signal | P1 | false | PASS |

## Machine-Readable Decision

```json
{
  "decision": "NO_GO",
  "go_no_go_reasons": [
    "baseline_tests_and_coverage",
    "desktop_check",
    "gate_score_or_critical_blocker_signal"
  ],
  "generated_at": "2026-02-26T20:48:33.538333+00:00",
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
      "status": "FAIL",
      "exit_code": 1,
      "detail": "status=passed,passed_count=5958"
    },
    {
      "check_id": "desktop_check",
      "priority": "P0",
      "blocking": true,
      "status": "FAIL",
      "exit_code": 2,
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
      "detail": "quality_non_template=1,weekly_non_template=5,machine_payload_available=yes,missing_evidence_classes=,decision=go"
    },
    {
      "check_id": "gate_score_or_critical_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "FAIL",
      "exit_code": 1,
      "detail": "chapter_gate_status=WARN,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_not_pass_or_critical_or_unresolved_triage,decision=no_go"
    },
    {
      "check_id": "evidence_coverage_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "quality_non_template=1,weekly_non_template=5"
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
      "status": "WARN",
      "exit_code": 0,
      "detail": "quality_score=missing,threshold=99.0,publish_recommendation=missing,critical_issue_count=missing,decision=no_go"
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
      "detail": "rubric_version=v1,quality_score=missing,threshold=99.0,critical_issue_count=missing,publish_recommendation=missing,quality_level_match=no,degrade_trace_complete=yes,decision=not_comparable"
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
      "detail": "snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0,decision=go"
    },
    {
      "check_id": "unresolved_triage_blocker_signal",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "state_files_scanned=258,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=258,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=go"
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
      "detail": "fresh_files=6,stale_files=0,window_days=14"
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
- baseline_tests_and_coverage: status=FAIL, detail=status=passed,passed_count=5958
- desktop_check: status=FAIL, detail=command=npm --prefix desktop run check
- external_e2e_smoke: status=PASS, detail=status=passed,passed_count=16
- production_guard: status=PASS, detail=guard=reload_cors_production
- metrics_guard: status=PASS, detail=guard=gateway_metrics_production
- codecov_signal: status=PASS, detail=strict_mode=false,token_present=false,coverage_xml=yes,result=coverage_available
- evidence_completeness_blocker_signal: status=PASS, detail=quality_non_template=1,weekly_non_template=5,machine_payload_available=yes,missing_evidence_classes=,decision=go
- gate_score_or_critical_blocker_signal: status=FAIL, detail=chapter_gate_status=WARN,critical_conflict_status=PASS,unresolved_triage_status=PASS,blocker_semantics=chapter_gate_not_pass_or_critical_or_unresolved_triage,decision=no_go
- evidence_coverage_signal: status=PASS, detail=quality_non_template=1,weekly_non_template=5
- slo_baseline_signal: status=WARN, detail=missing_keywords=ttft,effective_hit_rate,context_budget_utilization,gate consistency
- evidence_links_signal: status=PASS, detail=evidence_links_key=present,traceable_link=present
- self_learning_signal: status=WARN, detail=missing_fields=reflector,curator,playbook
- memory_observability_signal: status=WARN, detail=missing_metrics=c_effective,s_final,r_memory,invalid_metrics=
- quality_level_trace_signal: status=WARN, detail=effective_quality_level=missing,quality_level_used=missing
- degrade_trace_signal: status=WARN, detail=degrade_reason=missing,degrade_steps=missing
- critical_gate_enforcement_signal: status=WARN, detail=critical_gate=missing
- chapter_gate_scoring_signal: status=WARN, detail=quality_score=missing,threshold=99.0,publish_recommendation=missing,critical_issue_count=missing,decision=no_go
- cycle_time_kpi_measurement_signal: status=WARN, detail=window_policy=full_7_day_only,manual_override=forbidden,missing_rules=baseline_window_days,measurement_window_days,baseline_state,cycle_time_baseline_median,cycle_time_current_median,eligible_samples,present_exclusion_reason_codes=
- comparable_quality_rubric_signal: status=WARN, detail=rubric_version=v1,quality_score=missing,threshold=99.0,critical_issue_count=missing,publish_recommendation=missing,quality_level_match=no,degrade_trace_complete=yes,decision=not_comparable
- weekly_kpi_dashboard_schema_signal: status=WARN, detail=schema_name=weekly_kpi_dashboard,schema_version=v1,manual_override=forbidden,missing_fields=schema_version,window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend,comparability_decision,chapter_gate_aggregation_result
- weekly_kpi_rollup_readiness_signal: status=WARN, detail=rollup_source=canonical_evidence,manual_override=forbidden,baseline_state=missing,cycle_time_trend=missing,missing_fields=window_label,baseline_state,cycle_time_baseline_median,cycle_time_current_median,cycle_time_trend
- weekly_kpi_comparability_visibility_signal: status=WARN, detail=visibility_source=comparable_quality_plus_cycle_time,manual_override=forbidden,comparability_decision=missing,cycle_time_trend=missing,baseline_state=missing,missing_fields=comparability_decision,cycle_time_trend,baseline_state
- critical_conflict_blocker_signal: status=PASS, detail=snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0,decision=go
- unresolved_triage_blocker_signal: status=PASS, detail=state_files_scanned=258,linked_triage_records=0,unresolved_triage_records=0,invalid_state_files=258,blocker_semantics=triage_state_not_in_{resolved,rejected},decision=go
- feedback_artifact_linkage_signal: status=WARN, detail=snapshots_scanned=0,linked_feedback_artifacts=0,invalid_snapshots=0
- conflict_artifact_linkage_signal: status=WARN, detail=snapshots_scanned=0,linked_conflict_artifacts=0,critical_conflicts_linked=0,invalid_snapshots=0
- chapter_gate_evidence_linkage_signal: status=WARN, detail=snapshots_scanned=0,eligible_release_gate_runs=0,chapter_gate_checks_linked=0,aggregation_window=active_sessions,result=insufficient_data,invalid_snapshots=0
- evidence_freshness_signal: status=PASS, detail=fresh_files=6,stale_files=0,window_days=14
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
........................................................................ [  7%]
........................................................................ [  8%]
........................................................................ [  9%]
.......EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE.F....F.....EEEEE [ 10%]
EEEEEE.......EEEEE................................F.....F..........EEEEE [ 11%]
EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE.......................................... [ 13%]
........................................................................ [ 14%]
........................................................................ [ 15%]
........................................................................ [ 16%]
........................................................................ [ 17%]
........................................................................ [ 18%]
........................................................................ [ 20%]
........................................................................ [ 21%]
........................................................................ [ 22%]
...........................................F..F......................... [ 23%]
........................................................................ [ 24%]
........................................................................ [ 26%]
........................................................................ [ 27%]
........................................................................ [ 28%]
........................................................................ [ 29%]
........................................................................ [ 30%]
........................................................................ [ 32%]
........................................................................ [ 33%]
........................................................................ [ 34%]
........................................................................ [ 35%]
........................................................................ [ 36%]
........................................................................ [ 37%]
........................................................................ [ 39%]
........................................................................ [ 40%]
........................................................................ [ 41%]
........................................................................ [ 42%]
........................................................................ [ 43%]
........................................................................ [ 45%]
........................................................................ [ 46%]
........................................................................ [ 47%]
........................................................................ [ 48%]
........................................................................ [ 49%]
........................................................................ [ 51%]
........................................................................ [ 52%]
........................................................................ [ 53%]
........................................................................ [ 54%]
........................................................................ [ 55%]
........................................................................ [ 56%]
........................................................................ [ 58%]
.s...................................................................... [ 59%]
........................................................................ [ 60%]
........................................................................ [ 61%]
........................................................................ [ 62%]
........................................................................ [ 64%]
........................................................................ [ 65%]
........................................................................ [ 66%]
........................................................................ [ 67%]
........................................................................ [ 68%]
........................................................................ [ 70%]
........................................................................ [ 71%]
........................................................................ [ 72%]
........................................................................ [ 73%]
........................................................................ [ 74%]
........................................................................ [ 75%]
........................................................................ [ 77%]
........................................................................ [ 78%]
........................................................................ [ 79%]
........................................................................ [ 80%]
........................................................................ [ 81%]
........................................................................ [ 83%]
........................................................................ [ 84%]
........................................................................ [ 85%]
........................................................................ [ 86%]
........................................................................ [ 87%]
........................................................................ [ 89%]
........................................................................ [ 90%]
........................................................................ [ 91%]
........................................................................ [ 92%]
..............................................................s......... [ 93%]
........................................................................ [ 94%]
........................................................................ [ 96%]
........................................................................ [ 97%]
........................................................................ [ 98%]
........................................................................ [ 99%]
.................                                                        [100%]
============================== warnings summary ===============================
src\services\__init__.py:29
  D:\����Ŀ¼\niko-studio\src\services\__init__.py:29: DeprecationWarning: DistillService is deprecated. Use src.memory.distillation_manager.DistillationManager instead.
    from src.services.distill_service import DistillService

src\services\reranker\models.py:21
  D:\����Ŀ¼\niko-studio\src\services\reranker\models.py:21: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class RankedDocument(BaseModel):

tests/unit/mcp/test_gateway_endpoints.py::test_gateway_main_invokes_uvicorn_with_resolved_settings
  <frozen runpy>:128: RuntimeWarning: 'src.mcp.gateway' found in sys.modules after import of package 'src.mcp', but prior to execution of 'src.mcp.gateway'; this may result in unpredictable behaviour

tests/unit/services/test_knowledge_layer.py::TestSyncDirectory::test_sync_directory
  C:\Users\32852\AppData\Local\Programs\Python\Python312\Lib\site-packages\huggingface_hub\file_download.py:143: UserWarning: `huggingface_hub` cache-system uses symlinks by default to efficiently store duplicated files but your machine does not support them in C:\Users\32852\AppData\Local\Temp\fastembed_cache\models--Qdrant--bge-small-zh-v1.5. Caching files will still work but in a degraded version that might require more space on your disk. This warning can be disabled by setting the `HF_HUB_DISABLE_SYMLINKS_WARNING` environment variable. For more details, see https://huggingface.co/docs/huggingface_hub/how-to-cache#limitations.
  To support symlinks on Windows, you either need to activate Developer Mode or to run Python as an administrator. In order to activate developer mode, see this article: https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development
    warnings.warn(message)

tests/unit/test_cli_module_entry.py::test_cli_main_runs_main_under_name_main
  <frozen runpy>:128: RuntimeWarning: 'src.cli.main' found in sys.modules after import of package 'src.cli', but prior to execution of 'src.cli.main'; this may result in unpredictable behaviour

tests/unit/test_memory_search.py::TestMemorySearch::test_delete_memory
  C:\Users\32852\AppData\Local\Programs\Python\Python312\Lib\site-packages\huggingface_hub\file_download.py:143: UserWarning: `huggingface_hub` cache-system uses symlinks by default to efficiently store duplicated files but your machine does not support them in C:\Users\32852\AppData\Local\Temp\fastembed_cache\models--qdrant--bge-small-en-v1.5-onnx-q. Caching files will still work but in a degraded version that might require more space on your disk. This warning can be disabled by setting the `HF_HUB_DISABLE_SYMLINKS_WARNING` environment variable. For more details, see https://huggingface.co/docs/huggingface_hub/how-to-cache#limitations.
  To support symlinks on Windows, you either need to activate Developer Mode or to run Python as an administrator. In order to activate developer mode, see this article: https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development
    warnings.warn(message)

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html

---------- coverage: platform win32, python 3.12.10-final-0 ----------
Coverage XML written to file coverage.xml

Required test coverage of 80% reached. Total coverage: 97.31%
=========================== short test summary info ===========================
FAILED tests/unit/mcp/test_gateway_endpoints.py::test_is_llm_available_handles_exception
FAILED tests/unit/mcp/test_gateway_endpoints.py::test_resolve_gateway_host_port_env_and_config
FAILED tests/unit/mcp/test_gateway_endpoints.py::test_ui_bridge_workflow_endpoints_respect_enable_toggle
FAILED tests/unit/mcp/test_gateway_endpoints.py::test_gateway_main_invokes_uvicorn_with_resolved_settings
FAILED tests/unit/memory/test_unified_memory.py::TestUnifiedMemory::test_to_dict
FAILED tests/unit/memory/test_unified_memory.py::TestUnifiedMemory::test_roundtrip
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpoint::test_chat_returns_200_with_valid_request
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpoint::test_chat_returns_content
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpoint::test_chat_returns_skills_used
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpoint::test_chat_returns_workflow_info
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpoint::test_chat_returns_evaluation
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_empty_messages_returns_400
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_no_user_message_returns_400
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_missing_messages_returns_400
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_invalid_workflow_level_returns_400
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_invalid_type_workflow_level_returns_400
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatEndpointErrors::test_chat_int_workflow_level_accepted
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWorkflowLevels::test_chat_l1_rapid_mode
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWorkflowLevels::test_chat_l4_brainstorm_mode
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWorkflowLevels::test_chat_l5_deep_mode
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWithSkills::test_chat_with_custom_skills
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWithSkills::test_chat_skills_limited_to_five
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatLlmFallback::test_chat_llm_unavailable_returns_503_when_fallback_disabled
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatWriterFailure::test_chat_writer_failure_returns_analysis_content
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatRoutingSemantics::test_chat_without_workflow_level_uses_commander_route
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatRoutingSemantics::test_chat_with_explicit_workflow_level_skips_route
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatHardFailAndCoordinatorState::test_chat_critic_failure_with_fallback_disabled_returns_500
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatHardFailAndCoordinatorState::test_chat_l5_coordinator_state_includes_session_id
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatAdditionalBranchCoverage::test_chat_skips_skill_injection_when_no_skills
ERROR tests/unit/mcp/test_gateway_chat.py::TestChatAdditionalBranchCoverage::test_chat_critic_failure_with_fallback_enabled_uses_self_check_feedback
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMetricsEndpoint::test_metrics_returns_200
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMetricsEndpoint::test_metrics_returns_required_fields
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMetricsEndpoint::test_metrics_returns_404_when_disabled
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_200
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_healthy_status
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_degraded_when_search_unhealthy
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_version
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_all_services
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_engine_health
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_returns_agents_list
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestHealthEndpoint::test_health_check_engine_exception_degrades_status
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestModelsEndpoint::test_models_returns_200_with_aggregated_models
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestModelsEndpoint::test_models_returns_provider_filtered_result
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestModelsEndpoint::test_models_returns_404_for_unknown_provider
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_returns_200
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_returns_all_services
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_memory_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_graph_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_search_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_workflow_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_critic_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_agent_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_skills_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestToolsEndpoint::test_list_tools_total_count
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_models_returns_500_when_config_load_fails
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_normalizes_missing_status_from_db_flag
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_non_dict_health_treated_as_ok
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_db_ok_true_normalized_to_ok
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_engine_without_health_check_treated_as_ok
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_runtime_fields_exist_and_compatible
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_runtime_degraded_mapping
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_health_check_includes_observability_layers
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMcpServiceConfigEndpoints::test_list_mcp_services_returns_configs
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMcpServiceConfigEndpoints::test_create_update_toggle_and_probe_custom_service
ERROR tests/unit/mcp/test_gateway_endpoints.py::TestMcpServiceConfigEndpoints::test_builtin_service_cannot_be_disabled
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_chat_endpoint_rejects_invalid_workflow_level
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_chat_endpoint_rejects_no_user_message
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_chat_endpoint_returns_model_comparison_payload_when_enabled
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_chat_stream_endpoint_rejects_invalid_workflow_level
ERROR tests/unit/mcp/test_gateway_endpoints.py::test_chat_stream_endpoint_rejects_no_messages
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_200
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_content_type_is_sse
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_cache_control_headers
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_start_event
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_routing_event
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_progress_events
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_content_events
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEndpoint::test_stream_returns_done_event
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEventSequence::test_event_sequence_order
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamEventSequence::test_done_event_includes_skills_used
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamErrorCases::test_stream_empty_messages_returns_400
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamErrorCases::test_stream_no_user_message_returns_400
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamErrorCases::test_stream_invalid_workflow_level_returns_400
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamErrorCases::test_stream_non_string_workflow_level_returns_400
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamL1Mode::test_stream_l1_mode
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamL3Mode::test_stream_l3_includes_evaluation
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamErrorEvents::test_stream_writer_failure_emits_error_event
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamRoutingSemantics::test_stream_without_workflow_level_uses_commander_route
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamRoutingSemantics::test_stream_with_explicit_workflow_level_skips_route
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamContractCompatibility::test_stream_done_event_contract_legacy_replay
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamContractCompatibility::test_stream_error_event_contract_legacy_replay
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamSoftGateRecovery::test_soft_gate_done_event_uses_recovered_terminal
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamHardFailAndSleepBranches::test_stream_critic_failure_with_fallback_disabled_emits_error
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamHardFailAndSleepBranches::test_stream_l1_multi_chunks_calls_sleep_between_chunks
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamHardFailAndSleepBranches::test_stream_timeout_error_maps_to_interrupted_terminal
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamHardFailAndSleepBranches::test_stream_outer_exception_returns_500
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_llm_unavailable_with_fallback_disabled_returns_503
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_skips_skill_injection_when_no_skills
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l1_writer_failure_with_fallback_enabled_emits_soft_recovery
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l3_writer_failure_with_fallback_enabled_emits_soft_recovery
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l5_without_session_id_skips_state_injection
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l5_multi_chunks_calls_sleep_between_chunks
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l3_multi_chunks_calls_sleep_between_chunks
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l1_writer_failure_with_fallback_disabled_emits_error
ERROR tests/unit/mcp/test_gateway_stream.py::TestStreamAdditionalBranchCoverage::test_stream_l5_with_session_id_injects_state
6 failed, 5958 passed, 2 skipped, 16 deselected, 6 warnings, 99 errors in 777.76s (0:12:57)
```

#### desktop_check output

```text
> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

> niko-studio-desktop@8.0.0 check
> npm run typecheck && npm run build


> niko-studio-desktop@8.0.0 typecheck
> tsc --noEmit

src/components/ChatArea.test.tsx(77,46): error TS2591: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/components/McpStatusPanel.tsx(58,10): error TS6133: 'error' is declared but its value is never read.
src/stores/settingsStore.test.ts(22,9): error TS2578: Unused '@ts-expect-error' directive.
```

#### external_e2e_smoke output

```text
................                                                         [100%]
16 passed in 4.79s
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
