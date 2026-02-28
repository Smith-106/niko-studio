# PRD: Chapter Release Gate Scoring

**ID:** PRD-010
**Milestone:** M2
**Status:** Completed

## Overview

Implement deterministic chapter gate scoring with blocker handling for Critical consistency issues and evidence linkage.

## Context

The project must enforce chapter release quality >= 99% with zero Critical consistency issues.

## Goals

- Define chapter gate scoring formula and thresholds.
- Enforce hard block on Critical conflicts.
- Require complete linked evidence before release pass.

## User Stories

To be generated when this PRD is actively expanded.

## Dependencies

- PRD-009: Consistency conflict detector.

## Acceptance Criteria

- [ ] Chapter gate score and blocker rules are deterministic.
- [ ] Release fails automatically when Critical conflict count is non-zero.
- [ ] Gate output includes traceable links to supporting evidence artifacts.

---

*This PRD will be fully expanded when it becomes the active PRD.*
