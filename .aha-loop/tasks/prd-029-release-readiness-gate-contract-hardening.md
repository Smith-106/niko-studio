# PRD: Release Readiness Gate Contract Hardening

**ID:** PRD-029
**Milestone:** M7
**Status:** Pending

## Overview

Freeze and test deterministic GO/NO_GO blocker semantics for baseline tests/coverage, desktop checks, and gate-score critical blockers.

## Context

The current system already uses release-check artifacts as operational gatekeepers. This behavior is high-value legacy capability and must be elevated into an explicit contract with regression protection.

## Goals

- Define a canonical release-gate contract (input signals, blocker semantics, decision output).
- Eliminate semantic drift between scripts, evidence artifacts, and release decision reports.
- Ensure GO/NO_GO reasons remain machine-readable and stable across iterations.

## Contract Scope (V1)

- `decision`: `GO | NO_GO`
- `go_no_go_reasons`: ordered blocker ids array
- `checks[]`: each with `check_id`, `priority`, `blocking`, `status`, `exit_code`, `detail`
- Mandatory P0 blocker set includes:
  - `baseline_tests_and_coverage`
  - `desktop_check`
  - `gate_score_or_critical_blocker_signal`

## Planned Code Touchpoints

- `scripts/release_check_summary.py`: freeze blocker semantics + reason ordering + artifact parity logic.
- `release-check-summary.md` generation path: ensure summary mirrors machine-readable decision.
- `.workflow/evidence/release/release-readiness-artifact.json`: stabilize required fields and deterministic serialization order.
- `tests/unit/scripts/test_release_check_summary.py`: add matrix tests for P0 blocker branches.
- `tests/unit/scripts/test_release_artifact_contract.py`: assert summary/artifact consistency and required keys.
- `tests/unit/scripts/test_release_gate_regression.py`: snapshot regression around GO/NO_GO transitions.

## Recommended Execution Order

1. Freeze blocker-id contract and reason ordering.
2. Normalize script output payload and summary/artifact rendering.
3. Add contract regression tests (matrix + snapshot).
4. Run release-check script and verify deterministic repeatability.

## User Stories

### US-001: 阻断语义冻结
- 作为维护者，我希望 P0 阻断语义是固定且可验证的，以避免发布决策漂移。
- 范围：P0 清单、blocking 判定规则、reason 排序规则。

### US-002: 决策工件一致性
- 作为审核者，我希望 `release-check-summary.md` 与 machine artifact 决策一致，以支持审计复现。
- 范围：文本摘要与 JSON 工件对齐、字段完整性检查。

### US-003: 回归防护
- 作为团队成员，我希望关键门禁契约有自动回归测试，以便改动不会破坏发布决策逻辑。
- 范围：脚本回归测试、样例快照、边界条件。

## Automated Test Anchors

- **US-001（阻断语义冻结）**
  - `tests/unit/scripts/test_release_check_summary.py`: P0 blocker matrix and NO_GO decision mapping.
  - `tests/unit/workflow/test_novel_quality.py`: gate blocker semantics remain deterministic.
- **US-002（工件一致性）**
  - `tests/unit/scripts/test_release_artifact_contract.py`: markdown summary and JSON artifact consistency checks.
  - `tests/unit/workflow/test_revision_loop.py`: gate decision fields are propagated to evidence outputs.
- **US-003（回归防护）**
  - `tests/unit/scripts/test_release_gate_regression.py`: contract snapshot-based regression cases.
  - `tests/unit/test_workflow.py`: end-to-end release decision path includes blocker reason list.

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- Audit current `release_check_summary.py` decision path and existing blocker IDs.
- Identify mismatch risks between summary markdown and machine-readable artifact.

### Phase P: Plan Review
- Freeze V1 release-gate schema and blocker priority matrix.
- Define backward-safe policy for adding new P1/P0 checks.

### Phase I: Implement
- I1（US-001）：codify blocker semantics + stable reason ordering.
- I2（US-002）：normalize report/artifact payload generation path.
- I3（US-003）：add contract regression tests and sample fixtures.

### Phase Q: Quality
- Q1: Unit tests for blocker matrix and decision branches.
- Q2: Contract tests for artifact consistency and required fields.
- Q3: Integration smoke to ensure deterministic GO/NO_GO under representative scenarios.

## Dependencies

- PRD-016: Release Readiness Automation.
- PRD-028: Genre-Aware Gate Policy.

## Acceptance Criteria

- [ ] Release decision contract fields are frozen and validated automatically.
- [ ] P0 blocker semantics produce deterministic GO/NO_GO decisions.
- [ ] Markdown summary and machine-readable artifact stay consistent.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
