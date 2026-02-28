# Release Path Check

## Metadata Envelope
- artifact_type: release_gate_run
- schema_version: evidence.v1
- date: 2026-02-26
- owner: core-workflow
- input: release summary + release readiness artifact consistency check
- output: release gate remains NO_GO due to desktop_check P0 fail; rollback path documented
- result: WARN
- evidence_links:
  - .workflow/evidence/release/2026-02-26-release-path-check.md
  - release-check-summary.md
  - .workflow/evidence/release/release-readiness-artifact.json
- trace:
  - session_id: release-summary
  - run_id: release-check-summary
  - check_id: desktop_check

## Release Gate Body
- Environment: internal

## Startup Check
- Desktop start: FAIL
- Gateway start: PASS

## Critical Path Check
- Chat path: PASS
- Workflow path: PASS
- Evidence path write: PASS

## Gate and Rollback Check
- Release gate result: FAIL
- Rollback drill result: PASS

## Notes
- Blocking reason traces to `desktop_check` in release summary.
- Rollback route verified as operational by policy and artifact linkage.

## Machine Companion (optional)
Use deterministic key ordering for `detail` values (`key=value` pairs in fixed order).

```json
{
  "artifact_type": "release_gate_run",
  "schema_version": "evidence.v1",
  "date": "2026-02-26",
  "owner": "core-workflow",
  "input": "release summary + release readiness artifact consistency check",
  "output": "release gate remains NO_GO due to desktop_check P0 fail; rollback path documented",
  "result": "WARN",
  "evidence_links": [
    ".workflow/evidence/release/2026-02-26-release-path-check.md",
    "release-check-summary.md",
    ".workflow/evidence/release/release-readiness-artifact.json"
  ],
  "trace": {
    "session_id": "release-summary",
    "run_id": "release-check-summary",
    "check_id": "desktop_check"
  },
  "body": {
    "environment": "internal",
    "startup_check": {
      "desktop": "FAIL",
      "gateway": "PASS"
    },
    "critical_path_check": {
      "chat": "PASS",
      "workflow": "PASS",
      "evidence_write": "PASS"
    },
    "gate_and_rollback": {
      "release_gate": "FAIL",
      "rollback_drill": "PASS"
    }
  }
}
```
