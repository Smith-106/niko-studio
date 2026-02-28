# Release Path Check Template

## Metadata Envelope
- artifact_type: release_gate_run
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
  - run_id:
  - check_id:

## Release Gate Body
- Environment: internal / external

## Startup Check
- Desktop start: PASS / FAIL
- Gateway start: PASS / FAIL

## Critical Path Check
- Chat path: PASS / FAIL
- Workflow path: PASS / FAIL
- Evidence path write: PASS / FAIL

## Gate and Rollback Check
- Release gate result: PASS / FAIL
- Rollback drill result: PASS / FAIL

## Notes
-

## Machine Companion (optional)
Use deterministic key ordering for `detail` values (`key=value` pairs in fixed order).

```json
{
  "artifact_type": "release_gate_run",
  "schema_version": "evidence.v1",
  "date": "YYYY-MM-DD",
  "owner": "",
  "input": "",
  "output": "",
  "result": "PASS",
  "evidence_links": [".workflow/evidence/release/YYYY-MM-DD-release-path-check.md"],
  "trace": {
    "session_id": "",
    "run_id": "",
    "check_id": ""
  },
  "body": {
    "environment": "internal",
    "startup_check": {
      "desktop": "PASS",
      "gateway": "PASS"
    },
    "critical_path_check": {
      "chat": "PASS",
      "workflow": "PASS",
      "evidence_write": "PASS"
    },
    "gate_and_rollback": {
      "release_gate": "PASS",
      "rollback_drill": "PASS"
    }
  }
}
```
