# PRD: Desktop Quality-Gate Parity Enforcement

**ID:** PRD-031
**Milestone:** M7
**Status:** Pending

## Overview

Enforce desktop typecheck/build parity as release-facing signal when optional UI delivery is in scope.

## Context

Desktop is optional but user-facing. If desktop quality gates fail while backend/CLI pass, delivery confidence drops and optional path becomes unreliable.

## Goals

- Make desktop `typecheck + build` a deterministic release-facing signal when desktop deliverables are included.
- Align desktop error semantics with release summary and evidence artifacts.
- Keep CLI-first architecture unchanged while preserving optional UI reliability.

## Parity Policy (V1)

- Desktop-in-scope release requires:
  - `npm --prefix desktop run check` passing.
- Desktop-out-of-scope release may downgrade desktop check to non-blocking informational signal.
- Release artifact records whether desktop scope is active and why.

## Planned Code Touchpoints

- `desktop/package.json`: keep `check` command contract (`typecheck` + `build`) stable.
- `desktop/tsconfig*.json`: ensure type environment matches test/runtime assumptions (e.g., node/browser boundary).
- `desktop/src/components/ChatArea.test.tsx`: resolve node type dependency assumptions (`Buffer` and related typings).
- `desktop/src/components/McpStatusPanel.tsx`: remove dead variables and align strict type/lint expectations.
- `desktop/src/stores/settingsStore.test.ts`: eliminate stale `@ts-expect-error` directives and assert explicit failure modes.
- `scripts/release_check_summary.py`: enforce desktop-scope-aware blocking semantics in final GO/NO_GO decision.

## Recommended Execution Order

1. Fix desktop typecheck blockers and keep `npm --prefix desktop run check` green.
2. Encode desktop-in-scope vs out-of-scope blocking policy in release script.
3. Add/refresh unit tests for scope-aware desktop signal mapping.
4. Verify summary/artifact include desktop participation rationale.

## User Stories

### US-001: 桌面检查纳入发布信号
- 作为发布负责人，我希望 desktop check 有明确阻断语义，以便可预测决策。
- 范围：scope flag、blocking policy、release summary mapping。

### US-002: TypeScript 质量收敛
- 作为开发者，我希望常见 TS 契约问题可被稳定捕获和回归测试覆盖。
- 范围：node type availability、unused directives/vars、tsconfig contract。

### US-003: 端到端一致汇总
- 作为审核者，我希望 release summary 能明确展示 desktop check 是否参与阻断。
- 范围：artifact fields、summary lines、CI parity.

## Automated Test Anchors

- **US-001（发布信号）**
  - `tests/unit/scripts/test_release_check_summary.py`: desktop scope-aware blocking semantics.
  - `tests/unit/test_cli_commands.py`: release command outputs desktop signal state.
- **US-002（TS 质量收敛）**
  - `desktop/src/components/*.test.tsx`: type regression cases for node/browser boundary.
  - `desktop/src/stores/*.test.ts`: ts-expect-error and lint-safe contract checks.
- **US-003（汇总一致）**
  - `tests/unit/scripts/test_release_artifact_contract.py`: summary/artifact include desktop scope and status.
  - CI workflow check logs: `npm --prefix desktop run check` result surfaced in release evidence.

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- Audit current desktop check invocation and its release-summary mapping.
- Identify recurring TS failure patterns and ownership boundaries.

### Phase P: Plan Review
- Freeze desktop-in-scope vs out-of-scope policy matrix.
- Define release artifact fields for desktop participation and blocking rationale.

### Phase I: Implement
- I1（US-001）：implement scope-aware desktop blocking policy.
- I2（US-002）：fix/guard recurring TS contract failures and update quality constraints.
- I3（US-003）：wire desktop signal into release summary/artifact consistently.

### Phase Q: Quality
- Q1: Unit tests for desktop blocking policy branches.
- Q2: Desktop check green under in-scope delivery path.
- Q3: Release summary/artifact parity validation in CI and local scripts.

## Dependencies

- PRD-029: Release Readiness Gate Contract Hardening.
- PRD-030: MCP Gateway Backward-Compatibility Guard.

## Acceptance Criteria

- [ ] Desktop-in-scope releases enforce deterministic typecheck/build gating.
- [ ] Desktop-out-of-scope releases record downgraded semantics explicitly.
- [ ] Release summaries/artifacts consistently expose desktop signal and rationale.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
