# PRD: Roadmap Governance and Lifecycle Sync

**ID:** PRD-033
**Milestone:** M8
**Status:** In Progress

## Overview

Maintain roadmap lifecycle consistency by keeping milestone/PRD status, pointers, and changelog semantics deterministic and synchronized.

## Context

After capability-parity milestones are completed, roadmap governance itself becomes critical to avoid stale pointers (e.g., completed milestone with outdated current milestone ID), ambiguous active PRD state, and inconsistent lifecycle transitions.

## Goals

- Keep `currentMilestone` and `currentPRD` pointers consistent with actual milestone/PRD statuses.
- Define deterministic transitions for PRD activation, completion, and milestone closure.
- Ensure roadmap changelog entries capture lifecycle actions in a stable, auditable format.
- Prevent contradictory states (e.g., completed milestone marked active).

## User Stories

- As a maintainer, I want roadmap pointers to always reflect real execution state so automation does not misroute.
- As an orchestrator, I want deterministic lifecycle rules so PRD queue progression is reproducible.
- As an auditor, I want changelog actions to be complete and traceable.

## Dependencies

- PRD-032: Mode Orchestration and Quality-First Policy Enforcement.

## Acceptance Criteria

- [ ] `currentMilestone` and `currentPRD` are updated according to deterministic lifecycle rules.
- [ ] Lifecycle transitions (`prd_activated`, `prd_completed`, `milestone_completed`) follow a consistent sequence.
- [ ] Changelog format remains stable and machine-consumable for orchestration tools.
- [ ] No contradictory roadmap state remains after updates.

---

*This PRD will be fully expanded when it becomes the active PRD.*
