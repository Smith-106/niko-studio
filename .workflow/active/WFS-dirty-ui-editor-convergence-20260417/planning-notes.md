# Planning Notes

## Closure Note

- This planning note is retained as the original pre-execution context record for `WFS-dirty-ui-editor-convergence-20260417`.
- The session is now complete; current operator entrypoint is `HANDOFF.md`.
- Final validation and release evidence now live in `execution-summary.md`, `release-check-summary.md`, and `.workflow/evidence/release/release-readiness-artifact.json`.

## Context Findings

- The prior `PEX-next-work-plan-2026-04-17` lane is complete through `EXEC-007`, so this new session starts after the release/governance fixes and the first shell trust/failure-path contracts are already in place.
- The old QA passability certification is no longer authoritative for the live worktree because the desktop dirty surface has grown beyond the scout-era baseline; the next lane must produce fresh desktop evidence instead of reusing that certification.
- Recent UX diagnosis still leaves one unresolved high-risk frontend pattern: destructive async rewrite in the editor (`useEditorAI` / `NikoEditor` / `BubbleToolbar`) with silent or weak recovery semantics.
- The remaining dirty files now cluster into four practical convergence lanes:
  1. editor rewrite safety and revision-loop reliability
  2. writing-helper / text-optimizer / shell entrypoint coherence
  3. chat / evaluation / message-surface contract alignment
  4. final desktop green-baseline sweep and residual hotspot isolation

## Conflict Decisions

- Preserve the now-stable `EXEC-003` to `EXEC-007` contracts. New work should build on those results rather than reopening the same shell seams.
- Keep editor-risk mitigation local to the editor hook, host component, and supporting stream/revision utilities before touching higher-level writing flows.
- Delay any broad structural redesign of `ChatArea`, `MessageBubble`, or `KnowledgeModal` until the passability sweep proves a narrower contract repair is insufficient.

## Validation Posture

- Slice-level validation should be the default during execution.
- `npm --prefix desktop run typecheck` remains mandatory after each implementation slice.
- End-of-lane validation should target `npm --prefix desktop run check:quick` when feasible; if not feasible on the first pass, document the exact blocker and retain a reduced but explicit desktop validation bundle.
