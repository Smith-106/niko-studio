# PRD: Desktop Typecheck Gate Recovery

**ID:** PRD-036
**Milestone:** M9
**Status:** In Progress

## Overview

Eliminate desktop TypeScript failures that currently keep the release gate at `NO_GO` and re-establish deterministic blocker-to-gate mapping evidence.

## Context

M8 governance and drift-guard work stabilized roadmap, KPI, and policy conformance semantics, but release evidence still records a persistent desktop `P0` blocker (`desktop_check`) that prevents release availability even when workflow/evidence completion is READY.

## Goals

- Resolve desktop package TypeScript/typecheck failures behind `desktop_check`.
- Keep release-gate semantics deterministic (`P0 FAIL => NO_GO`) while removing the underlying blocker.
- Ensure release evidence artifacts reflect the recovered `desktop_check` state without contract drift.
- Preserve compatibility with existing release summary and evidence schemas.

## User Stories

- As a maintainer, I want desktop typecheck failures fixed so release availability is not blocked by known P0 issues.
- As a release reviewer, I want release gate output to move from `NO_GO` to policy-aligned status once blockers are truly resolved.
- As an auditor, I want updated evidence showing blocker resolution with deterministic traceability.

## Dependencies

- PRD-031: Desktop Quality-Gate Parity Enforcement.
- PRD-035: Quality Policy Drift Guard.

## Acceptance Criteria

- [ ] Desktop typecheck/build checks pass in the release path.
- [ ] `desktop_check` no longer emits P0 FAIL under normal release verification.
- [ ] Release summary and release evidence artifacts stay schema-compatible and deterministic.
- [ ] Policy-runtime conformance checks remain passing after desktop fixes.

---

*This PRD will be fully expanded when it becomes the active PRD.*
