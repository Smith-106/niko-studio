# Vision Analysis

**Generated:** 2026-02-24
**Vision Version:** 2026-02-24 (`.aha-loop/project.vision.md`)

## Validation Checklist

- [x] What section present and clear
- [x] Why section explains motivation
- [x] Target Users defined
- [x] Success Criteria are measurable

## Project Classification

- **Type:** CLI Tool (local-first AI writing workflow platform; optional UI layers)
- **Scale:** Large
- **Estimated Stories:** 60-140

## Core Requirements

### Must-Have (MVP)
1. End-to-end command-first workflow from ideation to first draft in one guided session.
2. Repeatable revision loop with explicit checkpoints and no data loss.
3. Scene/chapter-level quality checks that generate actionable feedback.
4. Local-first execution of core workflows without mandatory SaaS dependency.
5. Full process/artifact auditability via repository artifacts and history.
6. Author-controlled generation settings (style, length, constraints).
7. Consistency checking across character, worldbuilding, and timeline entities.
8. Chapter release gate with traceable evidence and zero Critical consistency issues.
9. Auto-writing must be manually enabled as an explicit mode switch; default mode remains author-driven manual workflow.
10. `docs/quality/*` criteria are authoritative and cannot be downgraded by mode-specific heuristics or prechecks.

### Should-Have (Post-MVP)
1. Strong KPI evidence pipeline for cycle-time reduction and release quality tracking.
2. Team-oriented deterministic workflow stages and quality gates.
3. Better ergonomics for mixed CLI + optional UI execution.
4. More robust conflict triage and fix-status tracking for consistency issues.
5. Deterministic release-readiness guardrail with explicit P0 blocker semantics and GO/NO_GO outputs.
6. MCP gateway API backward-compatibility guardrails for chat/stream/health/tools/models contracts.
7. Desktop quality-gate parity (typecheck/build) as a release-facing signal for optional UI stability.

### Nice-to-Have (Future)
1. Rich optional UX layers on top of CLI workflows.
2. Advanced analytics/dashboard views over evidence and revision history.
3. Higher-level automation helpers that still preserve author control gates.

### Out of Scope
- Generic social writing platform features.
- Desktop publishing/layout replacement.
- One-click autonomous writing without human control.
- Fully unattended auto-writing + auto-publishing pipeline without review gates.

## Technical Implications

### Data & Storage
- Local Markdown/JSON artifacts are the source of truth.
- Need stable schemas for workflow state, quality evidence, and consistency checks.
- Git-friendly outputs (diffable, auditable) are mandatory.

### Authentication & Security
- Core local workflow can run without mandatory external auth.
- If team/multi-user workflows evolve, lightweight identity/role boundaries may be needed.
- Must protect artifact integrity (no silent overwrites, explicit checkpoints).

### Integrations
- External model/tool integrations should remain optional and replaceable.
- CLI orchestration must support deterministic stage boundaries even with AI calls.
- MCP gateway endpoint contracts should remain compatibility-tested to prevent breaking downstream desktop/automation callers.

### Performance
- Priority metric: chapter cycle time reduction >=30% at comparable quality.
- Revision and quality-check loops should be repeatable with predictable runtime behavior.

### Deployment
- Primary environment is local repository execution.
- Cloud services can be optional add-ons, not core dependencies.
- Release should pass deterministic GO/NO_GO checks that include baseline tests/coverage, desktop quality checks, and gate blocker semantics.
- Workflow mode selection (manual/hybrid/full-auto) must not bypass quality acceptance thresholds defined in `docs/quality/*`.

## Constraints Summary

| Constraint | Impact |
|------------|--------|
| Must run in existing local repo/workflow structure | Prefer additive integration; avoid disruptive rewrites |
| Prefer incremental, non-breaking changes | Sequence work as small, reversible steps |
| Keep commands explicit/composable | Favor clear CLI contracts over hidden coupling |
| Preserve existing content/workflow compatibility | Require migration-safe schema changes and backward-safe adapters |
| Avoid cloud lock-in for core authoring | Keep offline-capable baseline; treat cloud as optional extension |
| Avoid opaque binary state formats | Store state in diffable text formats for review/audit |

## Open Questions

- [ ] What exact baseline window and sampling method defines the ">=30% cycle-time reduction" metric?
- [ ] How is "comparable quality" operationalized across chapters (rubric, scorer, threshold)?
- [ ] Is the chapter release gate score model formally specified (weights, criticality rules, tie-breakers)?
- [ ] What is the canonical schema for character/world/timeline entities used by consistency checks?
- [ ] Which minimal optional external integrations are acceptable for generation/quality without violating local-first intent?
- [ ] How should project-level custom reference libraries be modeled for different novels (era/history/world background, source provenance, update lifecycle)?
- [ ] Which genre taxonomy is canonical for adaptation (suspense, modern romance, ancient romance, fantasy/xuanhuan, sci-fi future, wuxia/xianxia, alternate history, urban realism), and can one project map to multiple genres?
- [ ] What are the mandatory rubric dimensions for history-detail quality cards (ritual etiquette, clothing/accessories, institutions, military systems, architecture/utensils, chronology consistency), and what are the pass thresholds?
- [ ] Should history-detail checks run as hard release gates or warning-only gates by project profile?

## Recommended Next Steps

1. Define and freeze KPI measurement specs (cycle time, quality comparability, chapter gate scoring).
2. Establish canonical artifact schemas for workflow state, quality evidence, and consistency findings.
3. Split roadmap into phased delivery: MVP (core loop + evidence) → consistency hardening → team ergonomics.
4. Add deterministic test gates for data-loss prevention across revision/checkpoint workflows.
5. Define explicit CLI contracts for generation controls and quality-check outputs.

## Architecture Hints

- Use a layered workflow engine with explicit stage transitions and checkpoint persistence.
- Keep domain state (chapter/scene/consistency entities) separate from orchestration logic.
- Treat quality evidence as first-class artifacts produced by each gate, not as side effects.
- Prefer adapter-based optional integrations so offline/local mode remains the default baseline.
