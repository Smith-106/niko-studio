# PRD: Deterministic Reason Attribution Guardrail

**ID:** PRD-040
**Milestone:** M11
**Status:** Completed

## Overview

Expand regression coverage to guarantee blocker reason attribution remains precise across mixed PASS/FAIL combinations.

## Context

Following provenance mapping hardening, release semantics still require stronger safeguards against false reason attribution and drift in blocker provenance.

## Goals

- Harden reason attribution invariants under mixed blocking outcomes.
- Prevent false-positive/false-negative inclusion in `go_no_go_reasons`.
- Keep deterministic GO/NO_GO reduction contract stable.

## User Stories

- [x] US-001: Deterministic mixed-outcome reason attribution guard for blocking include/exclude and ordering parity across report/artifact surfaces.
- [x] US-002: Additional regression guard(s) for non-blocking noise exclusion and future refactor drift.

## Dependencies

- PRD-039: Artifact Provenance and Cross-Surface Mapping.

## Acceptance Criteria

- [x] Mixed-scenario attribution tests cover include/exclude invariants for blocker reasons.
- [x] Report and artifact reason attribution stay aligned.
- [x] Deterministic decision reduction remains unchanged.
- [x] Typecheck/tests pass.

---

*This PRD will be fully expanded when it becomes the active PRD.*
