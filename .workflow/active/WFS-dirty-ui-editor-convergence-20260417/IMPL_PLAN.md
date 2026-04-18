# Dirty UI / Editor Convergence Plan

## Status

- Current status: `completed`
- Final operator entrypoint: `HANDOFF.md`
- Detailed execution evidence: `execution-summary.md`
- Final desktop gate: `npm --prefix desktop run check:local` -> `PASS` (`43` files, `277` tests)
- Final release decision: `GO`

## Goal

Stabilize the remaining dirty desktop UI/editor worktree after the completed `PEX` lane, with the next priority on user-risk reduction, contract clarity, and fresh desktop passability evidence.

## Why A New Lane

- The previous `PEX` plan intentionally fixed the smallest high-value trust breaks first and is now complete.
- The current desktop dirty surface still spans editor, writing-helper, chat, message, and shell components, so continuing ad hoc changes would raise cross-slice regression risk.
- The highest unresolved user-risk is still editor-side destructive rewrite behavior, and the current passability evidence predates the latest dirty worktree drift.

## Ordering Principles

1. Fix data-loss and silent-failure risks before polishing interaction copy or expanding feature scope.
2. Keep shell and entrypoint changes downstream of editor contract stabilization, not mixed into it.
3. Use existing `PEX` outcomes as fixed anchors; do not reopen already-settled return-route, fresh-start, evaluation-source, settings staged-save, or Story Bible failure contracts unless a new regression proves they are insufficient.
4. Refresh desktop validation evidence at the end of the lane instead of relying on stale green snapshots.

## Reading Rule

- Treat the task breakdown below as the original execution plan.
- For the final operator-facing conclusion, start with `HANDOFF.md`.
- For detailed validation chronology and evidence, read `execution-summary.md`.

## Execution Plan

### IMPL-1 Editor Rewrite Safety And Revision Loop Reliability

- Scope:
  - `desktop/src/hooks/useEditorAI.ts`
  - `desktop/src/components/NikoEditor.tsx`
  - `desktop/src/components/editor/BubbleToolbar.tsx`
  - `desktop/src/components/editor/streamToEditor.ts`
  - `desktop/src/utils/revisionLoop.ts`
  - editor/revision related tests
- Objective:
  - remove destructive rewrite data-loss risk
  - make rewrite failure observable to users
  - align callback-side stream failure, fallback restoration, and revision-loop state
- Acceptance:
  - failed rewrite restores or preserves the original user text
  - editor shows an explicit failure/recovery signal
  - dedicated tests cover callback-only stream failure and rewrite recovery
- Validation:
  - targeted editor Vitest bundle for `useEditorAI`, `NikoEditor`, `BubbleToolbar`, `revisionLoop`
  - `npm --prefix desktop run typecheck`

### IMPL-2 Writing Surface Entry Point And Draft/Handoff Convergence

- Scope:
  - `desktop/src/components/WritingHelperPanel.tsx`
  - `desktop/src/components/AiTextOptimizer.tsx`
  - `desktop/src/components/AppHeader.tsx`
  - `desktop/src/components/Sidebar.tsx`
  - `desktop/src/components/AppContextFooter.tsx`
  - `desktop/src/components/editor/WritingStyle.ts`
  - related tests already added or still missing
- Objective:
  - reconcile remaining entrypoint semantics and helper/optimizer state continuity
  - reduce mock-heavy shell coupling left behind after `EXEC-004` and `EXEC-005`
  - make style and helper affordances consistent across launch points
- Acceptance:
  - explicit launch actions, resume actions, and style-dependent helper flows remain distinguishable
  - optimizer and helper settings/open flows stay origin-correct
  - focused UI regressions cover these interaction seams
- Validation:
  - targeted Vitest bundle for helper/optimizer/header/sidebar/footer surfaces
  - `npm --prefix desktop run typecheck`

### IMPL-3 Chat / Evaluation / Message Surface Contract Stabilization

- Scope:
  - `desktop/src/components/ChatArea.tsx`
  - `desktop/src/components/ChatAreaModeControls.tsx`
  - `desktop/src/components/MessageBubble.tsx`
  - `desktop/src/components/KnowledgeModal.tsx`
  - `desktop/src/hooks/useEvaluationData.ts`
  - `desktop/src/hooks/useEvaluationQualityCheck.ts`
  - `desktop/src/hooks/writerWorkflowExperience.test.tsx`
  - supporting tests
- Objective:
  - align source-summary, mode-control, and evaluation/result contracts across chat-facing surfaces
  - stabilize current mock-heavy or copy-drift-prone tests without broad redesign
  - keep message/evaluation semantics consistent with the new explicit source-provider contract from `EXEC-005`
- Acceptance:
  - chat/evaluation/message tests express one coherent source and workflow contract
  - no drift between message source summary, mode controls, and evaluation actions
  - Knowledge/Chat surfaces remain additive rather than redefining shell authority
- Validation:
  - targeted Vitest bundle for chat, message, knowledge, evaluation hook surfaces
  - `npm --prefix desktop run typecheck`

### IMPL-4 Desktop Green Baseline Refresh And Residual Hotspot Isolation

- Scope:
  - `desktop/src/i18n/translations.ts`
  - shared helpers touched by `IMPL-1` to `IMPL-3`
  - any remaining dirty tests required to make desktop validation authoritative
  - residual-lane documentation if a non-blocking hotspot remains
- Objective:
  - produce fresh passability evidence for the post-PEX, post-convergence dirty baseline
  - compress remaining non-blocking issues into a documented follow-up lane instead of leaving them implicit
- Acceptance:
  - desktop validation bundle is rerun on the current worktree
  - any skipped heavier gate is explicitly justified with the exact blocker
  - remaining issues are isolated as residual follow-up, not mixed into the finished convergence lane
- Validation:
  - preferred: `npm --prefix desktop run check:quick`
  - fallback: explicit reduced bundle plus blocker note

## Recommended Next Command

Start execution from `IMPL-1` and keep the lane sequential because the current dirty worktree has high overlap in editor/shell surfaces.
