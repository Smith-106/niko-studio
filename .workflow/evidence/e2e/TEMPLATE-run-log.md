# E2E Run Log Template

## Metadata Envelope
- artifact_type: e2e_session
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

## E2E Session Body
- Goal:
- Entry command:

## Input
-

## Output
-

## Key Logs
-

## Generated Artifacts
-

## Failure and Retry (if any)
- Failure stage:
- Error summary:
- Retry result:

## Machine Companion (optional)
```json
{
  "artifact_type": "e2e_session",
  "schema_version": "evidence.v1",
  "date": "YYYY-MM-DD",
  "owner": "",
  "input": "",
  "output": "",
  "result": "PASS",
  "evidence_links": [".workflow/evidence/e2e/YYYY-MM-DD-run-log.md"],
  "trace": {
    "session_id": "",
    "run_id": ""
  },
  "body": {
    "entry_command": "",
    "key_logs": [],
    "generated_artifacts": []
  }
}
```
