# Tasks: Project Current State Follow-up

## Wave 1: Foundation Structural and Baseline Work

- [x] **IMPL-001**: Collapse duplicated gateway integration adapter ownership -> [task](./.task/IMPL-001.json)
- [x] **IMPL-002**: Establish the repo-local JS/TS engineering baseline -> [task](./.task/IMPL-002.json)
- [x] **IMPL-003**: Extract the desktop transport contract from the monolithic API client -> [task](./.task/IMPL-003.json)

## Wave 2: Boundary and Contract Completion

- [x] **IMPL-004**: Fence the deprecated web gateway compatibility surface -> [task](./.task/IMPL-004.json)
- [x] **IMPL-005**: Retire legacy pytest defaults and align delivery-gate local anchors -> [task](./.task/IMPL-005.json)
- [x] **IMPL-006**: Extract shared desktop gateway schemas and thin the endpoint facade -> [task](./.task/IMPL-006.json)

## Wave 3: Knowledge Surface Functional Closure

- [x] **IMPL-007**: Close non-skill knowledge tab dead ends in `KnowledgeModal` -> [task](./.task/IMPL-007.json)

## Wave 4: User-Facing Assurance and Persistence Boundary Clarity

- [x] **IMPL-008**: Add behavior coverage for the knowledge-surface closure -> [task](./.task/IMPL-008.json)
- [x] **IMPL-009**: Make the Story Bible persistence contract explicit -> [task](./.task/IMPL-009.json)

## Wave 5: Story Bible Local Recovery Flow

- [x] **IMPL-010**: Add local-only backup, restore, and reset for Story Bible drafts -> [task](./.task/IMPL-010.json)

## Execution Notes

- Parent inputs: `UAN-project-status-2026-04-07` and `WFS-post-governance-hardening-20260407`
- Recommended concurrency: `3`
- Governance and authority hardening are already complete and remain out of scope for this queue
- Same-wave rule: only files inside each task `scope` are writable; `focus_paths` are execution context only
- Start Wave 3 only after `IMPL-006` completes
- Start Wave 4 only after `IMPL-007` completes
- Start Wave 5 only after `IMPL-009` completes

## Status Legend

- `- [ ]` = pending
- `- [x]` = completed

## Planning Summary

- This queue follows the completed governance-hardening session and targets only the remaining engineering and product closure work
- The authoritative runtime and delivery path remains `desktop + src-ts`
- Gateway structural debt, local engineering baseline, and desktop API contract split are staged before user-surface work to reduce file contention and rework
- Story Bible remains local-only in this queue; the follow-up adds clarity and explicit local recovery, not project-synced persistence










