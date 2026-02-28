# PRD: Mode Orchestration and Quality-First Policy Enforcement

**ID:** PRD-032
**Milestone:** M7
**Status:** Pending

## Overview

Enforce manual-enable auto-writing modes and make `docs/quality` criteria authoritative across manual/hybrid/full-auto workflows.

## Context

The product supports multiple writing modes, but author control and quality acceptance cannot drift by mode. Auto-writing should be explicitly enabled by the author, and final acceptance must remain governed by quality criteria in `docs/quality/*`.

## Goals

- Require explicit manual enablement before entering full-auto writing mode.
- Keep manual/hybrid/full-auto mode transitions auditable and evidence-backed.
- Make `docs/quality/*` the authoritative acceptance baseline across all modes.
- Prevent heuristic precheck paths from overriding final quality acceptance decisions.

## Policy Matrix (V1)

- `manual`: author drives each step; quality gate required before release.
- `hybrid`: selective automation allowed; quality gate unchanged.
- `full_auto`: requires explicit author enable action; quality gate unchanged.
- For all modes, final acceptance must follow `docs/quality/QUALITY_CRITERIA.md` thresholds and DoD semantics.

## Planned Code Touchpoints

- `src/config.py`: mode policy defaults and manual-enable guard flags.
- `src/cli/commands/run.py`: explicit mode selection and full-auto enable handshake.
- `src/workflow/workflow_engine.py`: enforce mode transition invariants and gate routing.
- `src/workflow/state.py`: persist mode state and transition evidence fields.
- `docs/quality/QUALITY_CRITERIA.md` (reference contract only): ensure runtime checks map to authoritative thresholds.
- `tests/unit/test_cli_commands.py`: verify mode selection and full-auto enable requirements.
- `tests/unit/workflow/test_workflow_engine.py`: verify mode invariants and quality-gate parity across modes.

## Recommended Execution Order

1. Freeze mode-policy contract and explicit full-auto enable rules.
2. Implement CLI/workflow guards for mode transitions.
3. Wire quality-check mapping to `docs/quality/*` as authoritative acceptance baseline.
4. Add regression tests for mode invariants and non-bypass quality behavior.

## User Stories

### US-001: 手动启用全自动模式
- 作为作者，我希望全自动模式必须手动开启，避免误触发自动写作。
- 范围：mode switch、enable action、default behavior。

### US-002: 跨模式质量门禁一致
- 作为审核者，我希望 manual/hybrid/full-auto 都遵循同一质量门禁，避免模式导致放水。
- 范围：quality threshold mapping、gate semantics、release decision parity。

### US-003: 模式切换可追溯
- 作为维护者，我希望每次模式切换都有证据记录，便于回溯与审计。
- 范围：artifact fields、summary mapping、audit trail.

## Automated Test Anchors

- **US-001（手动启用）**
  - `tests/unit/test_cli_commands.py`: full-auto requires explicit enable action.
  - `tests/unit/test_cli_runtime_commands.py`: default mode remains manual without explicit enable.
- **US-002（门禁一致）**
  - `tests/unit/scripts/test_release_check_summary.py`: quality gate semantics unchanged across mode flags.
  - `tests/unit/workflow/test_workflow_engine.py`: mode-aware routing still enforces identical acceptance thresholds.
- **US-003（可追溯）**
  - `tests/unit/scripts/test_release_artifact_contract.py`: artifact includes mode and transition rationale fields.
  - `tests/unit/workflow/test_revision_loop.py`: mode changes are propagated to evidence outputs.

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- Inventory current mode flags, runtime defaults, and quality-gate integration points.
- Confirm quality baseline mapping from `docs/quality/*` into runtime gate logic.

### Phase P: Plan Review
- Freeze mode transition policy and full-auto manual-enable handshake contract.
- Define artifact fields for mode state, enable rationale, and gate decision linkage.

### Phase I: Implement
- I1（US-001）：implement explicit full-auto enable requirement and safe defaults.
- I2（US-002）：enforce quality-gate parity across manual/hybrid/full-auto paths.
- I3（US-003）：persist mode transition evidence and summary mapping fields.

### Phase Q: Quality
- Q1: Unit tests for mode default, explicit enable, and invalid transition branches.
- Q2: Regression tests proving no mode bypass of `docs/quality/*` acceptance thresholds.
- Q3: Artifact parity tests for mode-state visibility in release evidence.

## Dependencies

- PRD-028: Genre-Aware Gate Policy.
- PRD-029: Release Readiness Gate Contract Hardening.

## Acceptance Criteria

- [ ] Full-auto mode cannot start without explicit manual enable action.
- [ ] Manual/hybrid/full-auto modes share deterministic quality gate semantics.
- [ ] Release summaries/artifacts include mode state and transition rationale.
- [ ] `docs/quality/*` criteria remain a core, non-overridable acceptance baseline in final acceptance.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
