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
    "score_after": 0
  }
}
```
