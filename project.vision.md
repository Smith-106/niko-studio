# Project Vision

## What

A command-first AI-assisted writing studio that helps an author brainstorm, draft, auto-generate, revise, and quality-check long-form fiction and serialized content inside a local-first workspace.

## Why

Existing writing tools rarely support a complete loop from ideation to auto-generation to revision. Cloud-heavy tools are often opaque, making process auditing and reproduction difficult. This project exists to keep creative control in the author's hands with a transparent, inspectable workflow instead of black-box automation.

## Target Users

- Solo fiction writers who want structured iteration loops instead of blank-page writing
- Author-developers who prefer CLI and automation over GUI-only writing tools
- Small writing teams that need deterministic workflow stages and quality gates

## Success Criteria

- A writer can go from idea to first draft with a guided workflow in one session
- Revision loops can be run repeatedly with explicit checkpoints and no data loss
- Quality checks produce actionable feedback mapped to scene/chapter-level artifacts
- Core workflows run locally without mandatory external SaaS dependencies
- Writing artifacts and process state are auditable through repository history
- Auto-generation is author-controllable through configurable style, length, and constraint settings
- Character, worldbuilding, and timeline consistency checks can detect and flag narrative conflicts
- End-to-end chapter cycle time from ideation to publishable draft is reduced by at least 30% at comparable quality
- Chapter-level release quality reaches >= 99% with zero Critical consistency issues and traceable review evidence

## Evidence Mapping

- Idea-to-first-draft in one session -> `.workflow/evidence/e2e/YYYY-MM-DD-session.md` (topic input, start/end timestamps, chapter/output reference)
- Repeatable revision loops with no data loss -> `.workflow/evidence/quality/YYYY-MM-DD-revision-case.md` (revision round, before/after references, pass/fail, failure reason)
- Actionable scene/chapter-level quality feedback -> `.workflow/evidence/quality/YYYY-MM-DD-revision-case.md` (scene/chapter anchor, severity, suggested action)
- Local-first execution without mandatory SaaS -> `.workflow/evidence/e2e/YYYY-MM-DD-local-run.md` (offline/local conditions, dependency list, execution log summary)
- Auditable process and artifacts -> `git log` plus `.workflow/evidence/weekly/YYYY-Www-review.md` (key commits, chapter/task linkage, reviewer, timestamp)
- Author-controllable auto-generation -> `.workflow/evidence/quality/YYYY-MM-DD-generation-control.md` (parameter snapshot, output reference, constraint compliance, manual interventions)
- Consistency conflict detection for character/worldbuilding/timeline -> `.workflow/evidence/quality/YYYY-MM-DD-consistency-check.md` (conflict list, severity, fix status)
- >=30% chapter-cycle time reduction -> `.workflow/evidence/weekly/YYYY-Www-review.md` (baseline cycle time, current cycle time, calculation method, sample size)
- Chapter release gate >=99% and zero Critical issues -> `.workflow/evidence/quality/YYYY-MM-DD-chapter-gate.md` (score, Critical count, release decision, linked evidence)


---

## Constraints (Optional)

- Must run in the existing local repository and workflow structure
- Prefer incremental, non-breaking changes over large rewrites
- Keep command interfaces explicit and composable
- Preserve existing content and workflow compatibility

## Technical Preferences (Optional)

### Preferred Technologies
- Desktop + Tauri shell + local Node/TypeScript gateway as the default runtime surface
- Python helper scripts for release governance and explicit compatibility-only launcher paths
- Local file artifacts (Markdown/JSON) as source of truth
- CLI-first operation with optional desktop UI layers

### Technologies to Avoid
- Mandatory cloud lock-in for core authoring operations
- Opaque binary state formats that are hard to diff/review

## Inspirations (Optional)

- Linear-style explicit workflow states and clear progress transitions
- Git-native authoring practices for transparent versioning
- Iterative critique loops used in editorial pipelines

## Non-Goals (Optional)

- Not a generic social writing platform
- Not a replacement for full desktop publishing/layout tools
- Not a one-click auto-write system with no human creative control
- Not a fully unattended auto-writing and auto-publishing pipeline without author review gates
