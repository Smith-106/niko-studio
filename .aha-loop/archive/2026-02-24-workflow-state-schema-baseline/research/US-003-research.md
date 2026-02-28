# Research Report: US-003 - Define state migration contract

**Date:** 2026-02-24
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Existing migration patterns for workflow state in this codebase
2. Best practices for versioned JSON state migration with deterministic transforms

---

## Findings

### Topic 1: Existing migration patterns for workflow state in this codebase

**Summary:**
The codebase already uses deterministic, in-place compatibility normalization patterns in multiple modules. The same shape can be reused for workflow state migration: pure function entrypoint, fixed field-default map, ordered canonicalization, and legacy-to-canonical alias mapping.

**Sources Consulted:**
- [ ] Library source code (`.vendor/...`)
- [x] Official documentation
- [x] Web search results
- [x] Existing codebase patterns

**Codebase Pattern Notes:**
- `src/workflow/workflow_engine.py:700` uses deterministic phase normalization via alias map + allowed set fallback.
- `src/workflow/workflow_engine.py:764` reads persisted state and recovers from malformed JSON with stable defaults.
- `src/workflow/levels/types.py:66` applies contract defaults in deterministic order, then backfills legacy fields.
- `src/mcp/gateway.py:545` normalizes schema version by ordered candidate selection.
- `src/memory/core_memory_store.py:125` demonstrates SQLite schema migration with additive columns and deterministic default backfill.

**Recommended Internal Migration Shape:**
1. Add one migration entrypoint for workflow state payloads (single authority).
2. Detect source schema version from persisted payload (or infer legacy baseline).
3. Apply versioned transforms in ascending order (no skipping side effects).
4. Re-run canonical normalizers for phases/statuses.
5. Validate post-migration invariants before returning migrated state.

### Topic 2: Best practices for versioned JSON state migration with deterministic transforms

**Summary:**
Use additive-compatible schema evolution by default, explicit version stamps, deterministic sequential transforms, and strict post-migration invariants. Reserve version bump for breaking shape changes.

**Sources Consulted:**
- [ ] Library source code (`.vendor/...`)
- [x] Official documentation
- [x] Web search results
- [x] Existing codebase patterns

**Documentation Notes:**
- Additive changes (new optional fields with defaults) are the safest backward-compatible path.
- Migration functions should be pure/idempotent for same input version.
- Deterministic transform order should be explicit (e.g., `v2025-12 -> v2026-01 -> v2026-02`).
- Unsupported/unknown versions should fail with machine-readable error detail at validation boundary.

**External References:**
- JSON Schema upgrade/downgrade rules repository (schema transform concepts): https://github.com/json-schema-org/upgrade-downgrade-rules
- Backward compatibility guidance for schema evolution (principles): https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide

---

## Implementation Recommendations

Based on research, implement US-003 as follows:

1. **Approach:**
   Introduce a dedicated migration contract API in workflow state handling with deterministic ordered transforms from historical versions to current `WORKFLOW_STATE_SCHEMA_VERSION`.

2. **Pattern to Follow:**
   - Contract normalization style from `src/workflow/levels/types.py:66`
   - Ordered schema fallback strategy from `src/mcp/gateway.py:545`
   - Defensive state read + stable default behavior from `src/workflow/workflow_engine.py:764`

3. **Key Files to Modify (next implementation phase):**
   - `src/workflow/workflow_engine.py`
   - `tests/unit/workflow/test_workflow_engine.py`

4. **Dependencies:**
   No new dependency required.

### Pitfalls to Avoid

- Do not mutate caller-owned dicts in migration steps.
- Do not rely on implicit dict ordering for version progression decisions.
- Do not mix migration and validation responsibilities; run validation after migration.
- Do not silently accept unknown future versions without explicit compatibility policy.

### Sample Migration Contract (pseudocode)

```python
MIGRATION_ORDER = ["2025-12", "2026-01", "2026-02"]


def migrate_workflow_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = copy.deepcopy(payload)
    source_version = detect_schema_version(current)
    for from_v, to_v, transform in ordered_transforms(source_version, target="2026-02"):
        current = transform(current)
        current["schema_version"] = to_v
    current = canonicalize_state(current)
    assert_state_invariants(current)
    return current
```

---

## Follow-up Research Needed

- [ ] None required before implementation.

---

## Knowledge Base Updates

Added reusable migration/compatibility patterns and gotchas to project knowledge files.

---

## Checklist

- [x] All research topics investigated
- [x] Library source code read (if applicable)
- [x] Documentation consulted
- [x] Alternatives compared (if applicable)
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Knowledge base updates drafted
- [x] Follow-up items noted
