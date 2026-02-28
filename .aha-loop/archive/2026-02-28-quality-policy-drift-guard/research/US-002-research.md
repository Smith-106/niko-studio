# Research Report: US-002 - Detect threshold and blocker-semantic drift across modes

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Threshold and blocker-semantics mapping used by current gate logic
2. Failure modes where heuristic shortcuts or partial overrides cause drift

---

## Findings

### Topic 1: Threshold and blocker semantics mapping in current gate logic

**Summary:** The project already has a deterministic drift check foundation in `scripts/release_check_summary.py`, but drift detection should be anchored as a mode-coverage matrix (manual/hybrid/full-auto semantics) with explicit mismatch keys and stable output.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Runtime source code
- [x] Policy docs (`docs/quality/*`, `docs/PDD.md`)
- [ ] External docs (not needed)

**Policy anchors discovered:**
- `docs/quality/QUALITY_CRITERIA.md:12` — quality pass threshold `>= 99%`.
- `docs/quality/QUALITY_CRITERIA.md:29-31` — runtime publish gate should align to strict threshold; heuristic endpoint is precheck only.
- `docs/PDD.md:1098-1100` — `P0` as blocking layer (`NO_GO` / `BLOCKED`).
- `docs/PDD.md:1137-1140` and `docs/PDD.md:1143-1149` — decision/threshold consistency matrix (99/95/94/<50 + evidence missing => `BLOCKED`).

**Runtime mapping anchors discovered:**
- `src/workflow/state.py:18-21` — canonical novel score thresholds (`99`, `95`) and improvement threshold.
- `src/workflow/novel_quality.py:455-459` — heuristic recommendation mapping (`pass` / `revise` / `block`) using score/high-issue conditions.
- `src/mcp/gateway.py:585-588` — decision-to-publish mapping (`go->pass`, `soft_go->revise`, `no_go->block`).
- `src/mcp/gateway.py:431-437` — terminal contract default fallback (`decision=go`, `terminal=done`) if missing.
- `scripts/release_check_summary.py:208-233` — policy contract extraction from docs.
- `scripts/release_check_summary.py:236-265` — runtime contract probes (thresholds, publish mapping, terminal behavior, mode consistency).
- `scripts/release_check_summary.py:268-337` — deterministic conformance evaluation with ordered key/value detail and mismatch list.

### Topic 2: Drift failure modes from shortcuts/default paths

**Summary:** Main drift risks are not missing thresholds; they are semantic softening via fallback/default behavior and incomplete cross-mode consistency assertions.

**High-risk failure modes:**
1. **Fallback softening risk**
   - If terminal payload is partial, gateway defaults `decision` to `go` (`src/mcp/gateway.py:433-434`), which can conflict with strict blocker intent if not guarded upstream.
2. **Heuristic-vs-policy precedence risk**
   - Heuristic recommendation path in `novel_quality` can be misused as final acceptance gate unless release/runtime conformance checks enforce policy precedence (`docs/quality/QUALITY_CRITERIA.md:29-31`).
3. **Threshold extraction fragility risk**
   - Doc-parsing logic depends on regex extraction/range ordering and could drift when prose changes format (`scripts/release_check_summary.py:213-225`).
4. **Mode inconsistency risk**
   - Manual vs auto quality behavior must remain semantically consistent for publish recommendation parity (`scripts/release_check_summary.py:247-264`).

---

## Implementation Recommendations

Based on research, implement US-002 as follows:

1. **Approach:** Strengthen drift detection as an explicit threshold+blocker semantic matrix across runtime modes (manual/hybrid/full-auto) with actionable mismatch output.
2. **Pattern to Follow:** Keep deterministic ordered `key=value` details and explicit mismatch keys; fail on semantic drift, not only numeric threshold drift.
3. **Key Files to Modify:**
   - `scripts/release_check_summary.py`
   - `tests/unit/scripts/test_release_check_summary.py`
   - (if needed) `src/mcp/gateway.py` and corresponding tests when fallback semantics must be tightened
4. **Dependencies:** none.

### Pitfalls to Avoid

- Treating `publish_recommendation` heuristic as final acceptance decision.
- Allowing default `decision=go` to bypass `P0 => NO_GO/BLOCKED` semantics.
- Returning free-form drift messages; use stable mismatch keys for CI assertions.

### Sample Implementation (directional)

```python
# Keep deterministic ordered checks
expected = {
    "quality_pass_score": 99.0,
    "human_review_score": 95.0,
    "publish_from_soft_go": "revise",
    "publish_from_no_go": "block",
}

mismatches = [k for k, v in expected.items() if runtime.get(k) != v]
status = "FAIL" if mismatches else "PASS"
detail = _format_detail_pairs([
    ("mismatches", _format_csv(mismatches)),
    ("decision", "no_go" if mismatches else "go"),
])
```

---

## Follow-up Research Needed

- [ ] Clarify whether gateway terminal fallback should remain permissive (`go`) or be hardened to explicit unknown state for stricter blocker semantics.
- [ ] Define one canonical source for mode labels (`manual` / `hybrid` / `full-auto`) and bind it directly in conformance output fields.

---

## Knowledge Base Updates

- Added reusable project pattern for runtime policy drift matrix checks.
- Added gotcha for docs-regex extraction coupling to prose/range ordering.

---

## Checklist

- [x] All research topics investigated
- [x] Threshold and blocker mapping traced across docs/runtime/release layers
- [x] Drift failure modes identified with concrete code anchors
- [x] Actionable implementation recommendations documented
- [x] Knowledge-base deltas drafted
