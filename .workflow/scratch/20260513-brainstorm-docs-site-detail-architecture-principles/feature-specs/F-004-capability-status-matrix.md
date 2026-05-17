# F-004 Capability Status Matrix

## 1. Requirements Summary

Docs MUST expose capability status to prevent overclaiming. Status categories should include supported, partial, experimental, disabled, historical, and roadmap.

## 2. Design Decisions

The matrix should be driven by existing authority sources where possible. Each capability row should include status, user-facing meaning, source of truth, and related docs.

Example:

| Capability | Status | Meaning | Source |
|---|---|---|---|
| Desktop authoring | supported | Primary shipped product path | README |
| Code signing | partial | Release pipeline support but environment-dependent | operations docs |
| Historical web UI | historical | Not current runtime path | README / archive |

## 3. Interface Contract

Could be a standalone page and/or reusable table section embedded in capability docs.

## 4. Constraints & Risks

Status must be maintained; stale status labels are worse than no labels. Avoid inventing status without source.

## 5. Acceptance Criteria

- Matrix covers all docs-site categories.
- Each row has related page link.
- Status definitions are documented.

## 6. Detailed Analysis References

- @product-manager/analysis.md
- @system-architect/analysis.md

## 7. Cross-Feature Dependencies

F-001 and F-002 should link to this page when advanced capabilities are discussed.
