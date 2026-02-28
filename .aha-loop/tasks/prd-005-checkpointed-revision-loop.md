# PRD: Checkpointed Revision Loop

**ID:** PRD-005
**Milestone:** M1
**Status:** Completed

## Overview

Guarantee iterative revision loops with explicit checkpoints and no silent data loss between rounds.

## Context

Revision reliability is a core success criterion and must be deterministic across repeated runs.

## Goals

- Define checkpoint policy for each revision stage.
- Add recovery/resume behavior from checkpoints.
- Verify artifact integrity through loop transitions.

## User Stories

To be generated when this PRD is actively expanded.

## Dependencies

- PRD-001: Stable workflow state schema.
- PRD-002: Evidence artifacts for revision outcomes.

## Acceptance Criteria

- [ ] Each revision round creates explicit checkpoint artifacts.
- [ ] Recovery path restores latest valid checkpoint without corruption.
- [ ] Revision evidence captures before/after and pass/fail outcomes.

---

*This PRD will be fully expanded when it becomes the active PRD.*
