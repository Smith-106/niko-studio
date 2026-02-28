# Research Report: US-001 - Define canonical evidence artifact schemas

**Date:** 2026-02-24
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Existing evidence artifact patterns in this repository
2. Schema conventions that keep JSON artifacts deterministic and diffable

---

## Findings

### Topic 1: Existing evidence artifact patterns in this repository

**Summary:**
The repository already has a clear evidence directory taxonomy and template set under `.workflow/evidence/`, plus release-gate generation in `scripts/release_check_summary.py`. The canonical contract should align with these existing paths and checklist mappings in `docs/PDD.md` instead of inventing new locations.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing docs and templates

**Repository Patterns Observed:**
- Evidence root and naming convention in `.workflow/evidence/README.md`.
- E2E templates:
  - `.workflow/evidence/e2e/TEMPLATE-run-log.md`
  - `.workflow/evidence/e2e/TEMPLATE-artifacts.md`
  - `.workflow/evidence/e2e/TEMPLATE-failures.md`
- Weekly/quality/release templates:
  - `.workflow/evidence/weekly/TEMPLATE-plan.md`
  - `.workflow/evidence/weekly/TEMPLATE-review.md`
  - `.workflow/evidence/weekly/TEMPLATE-trend.md`
  - `.workflow/evidence/quality/TEMPLATE-revision-case.md`
  - `.workflow/evidence/release/TEMPLATE-release-path-check.md`
- PDD evidence mapping and minimum fields in `docs/PDD.md` section 16.

**Key Insight:**
Current templates are markdown-oriented and category-specific. Canonical schema work should add a stable cross-artifact metadata envelope while preserving these category templates and file paths.

### Topic 2: Deterministic and diffable JSON schema conventions

**Summary:**
`release-check-summary.md` includes machine-readable JSON payloads generated from deterministic structures. The script enforces stable key ordering for detail fields via ordered pair formatting, and tests assert exact string outputs. This establishes a strong convention for deterministic consumption.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Unit tests for release check behavior

**Source Code Analysis:**
- Deterministic detail serialization:
  - `scripts/release_check_summary.py` `_format_detail_pairs`
  - `scripts/release_check_summary.py` `build_check_result`
- Deterministic machine payload block:
  - `scripts/release_check_summary.py` machine payload `decision`, `go_no_go_reasons`, `generated_at`, `checks`
- Assertions of stable detail strings:
  - `tests/unit/scripts/test_release_check_summary.py`

**Key Insight:**
Canonical evidence schema should preserve deterministic ordering and explicit required keys for release consumption. Free-form prose should not be the parser contract.

---

## Implementation Recommendations

1. **Approach:**
   Define a shared evidence artifact contract with:
   - common metadata envelope (applies to e2e, quality, release)
   - artifact-specific body sections
   - deterministic JSON companion shape for machine consumers

2. **Patterns to Follow:**
   - Preserve existing evidence directory layout under `.workflow/evidence/*`.
   - Preserve release check deterministic detail formatting style in `scripts/release_check_summary.py`.
   - Align required fields with `docs/PDD.md` section 16 minimum fields and traceability rules.

3. **Key Files to Modify (next phase):**
   - `docs/PDD.md` (canonical field and schema description)
   - `.workflow/evidence/README.md` and templates
   - `scripts/release_check_summary.py` (if additional schema validation hooks are needed)
   - `tests/unit/scripts/test_release_check_summary.py`

4. **Required Metadata Baseline:**
   - `date`
   - `owner`
   - `input`
   - `output`
   - `result`
   - `evidence_links`
   - trace identifiers to correlate with release checks (for example: session/check ids)

### Pitfalls to Avoid

- Counting template files as evidence artifacts.
- Using unstable/free-form `detail` content for release parser logic.
- Creating schema fields that are not mapped to existing release checks/tests.

### Candidate Canonical Shape (Draft)

```json
{
  "artifact_type": "e2e|quality|release",
  "metadata": {
    "date": "YYYY-MM-DD",
    "owner": "string",
    "input": "string|object",
    "output": "string|object",
    "result": "PASS|FAIL|WARN|BLOCKED",
    "evidence_links": ["path-or-url"],
    "trace": {
      "session_id": "string",
      "check_id": "string"
    }
  },
  "body": {}
}
```

---

## Follow-up Research Needed

- [ ] Confirm if `generated_at` should remain informational-only or become a required field for all evidence JSON.
- [ ] Confirm whether release-gate evidence requires a dedicated `blocking_level` field at artifact layer or only in gate summaries.

---

## Knowledge Base Updates

Applied updates:
- `.aha-loop/knowledge/project/patterns.md`
- `.aha-loop/knowledge/project/gotchas.md`

---

## Checklist

- [x] All research topics investigated
- [x] Existing repository templates and mappings analyzed
- [x] Deterministic parser/test conventions identified
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Knowledge base updated
