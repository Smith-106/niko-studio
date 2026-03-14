# Quality Revision Case Template

## Metadata Envelope
- artifact_type: quality_revision
- schema_version: evidence.v1
- date: YYYY-MM-DD
- owner:
- input:
- output:
- result: PASS / FAIL / WARN / BLOCKED
- evidence_links:
  -
- trace:
  - session_id:
  - revision_id:

## Quality Revision Body
## Original Sample
-

## Issue Summary
-

## Revision Action
-

## Re-evaluation
- Score before:
- Score after:
- Result: PASS / FAIL

## Quality Level Trace
- effective_quality_level: high
- quality_level_used: high

## Degrade Trace
- degrade_reason: none
- degrade_steps: none

## Critical Gate Enforcement
- critical_gate_always_on: true

## Memory Observability
- c_effective: 0.95
- s_final: 0.92
- r_memory: 0.88

## Self Learning
- reflector: enabled
- curator: enabled
- playbook: active

## Migration & Rollback
- migration: none
- rollback: none

## Compliance
- rbac: enabled
- audit: enabled
- rollback: tested

## SLO Baseline
- ttft: 0.0 (target: <2.0s)
- e2e: 0.0 (target: <5.0s)
- effective_hit_rate: 0.95 (target: >0.90)
- context_budget_utilization: 0.80 (target: 0.70-0.90)
- gate consistency: yes

## Machine Companion (optional)
```json
{
  "artifact_type": "quality_revision",
  "schema_version": "evidence.v1",
  "date": "YYYY-MM-DD",
  "owner": "",
  "input": "",
  "output": "",
  "result": "PASS",
  "evidence_links": [".workflow/evidence/quality/YYYY-MM-DD-revision-case.md"],
  "trace": {
    "session_id": "",
    "revision_id": ""
  },
  "body": {
    "issue_summary": "",
    "revision_action": "",
    "score_before": 0,
    "score_after": 0,
    "effective_quality_level": "high",
    "quality_level_used": "high",
    "degrade_reason": "none",
    "degrade_steps": "none",
    "critical_gate_always_on": true,
    "c_effective": 0.95,
    "s_final": 0.92,
    "r_memory": 0.88
  }
}
```
