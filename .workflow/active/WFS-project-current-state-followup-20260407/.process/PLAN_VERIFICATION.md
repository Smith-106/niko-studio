# Plan Verification

Session: `WFS-project-current-state-followup-20260407`  
Verified: `2026-04-07`  
Mode: Read-only plan verification

## A. User Intent Alignment
Status: `PASS`

Evidence:
- The plan still matches the stated goal in [`planning-notes.md`](../planning-notes.md): convert the `2026-04-07` current-state analysis into an execution-ready queue for the remaining structure debt, engineering baseline, and user-surface gaps.
- [`IMPL_PLAN.md`](../IMPL_PLAN.md), [`plan.json`](../plan.json), and [`TODO_LIST.md`](../TODO_LIST.md) stay centered on the same five closure themes: gateway boundary debt, repo-local baseline, desktop API seam split, knowledge-surface closure, and Story Bible local-only clarity.
- The queue continues to treat `WFS-post-governance-hardening-20260407` as the upstream boundary and does not reopen already-completed governance hardening.

## B. Requirements Coverage
Status: `PASS`

Evidence:
- The 10-task queue covers the remaining execution themes identified in [`planning-notes.md`](../planning-notes.md) and [`plan.json`](../plan.json): gateway cleanup, local engineering baseline, desktop contract split, knowledge UI closure, and Story Bible persistence clarification.
- The earlier coverage concern around the Python runtime boundary is now explicitly scoped: [`plan.json`](../plan.json) says the Python override/runtime-tooling boundary is upstream-fixed and this queue only handles residual local defaults plus bounded compatibility surfaces on disk.
- Deferred items from [`.workflow/.team/UAN-project-status-2026-04-07/conclusions.json`](../../../../.team/UAN-project-status-2026-04-07/conclusions.json), such as product-narrative narrowing and deployment/security baseline work, are explicitly deferred in [`planning-notes.md`](../planning-notes.md) rather than silently omitted.

## C. Internal Consistency
Status: `WARN`

Evidence:
- [`IMPL_PLAN.md`](../IMPL_PLAN.md), [`plan.json`](../plan.json), [`TODO_LIST.md`](../TODO_LIST.md), and [`workflow-session.json`](../workflow-session.json) still agree on the same 10 tasks, 5 waves, and top-level dependency graph.
- The previous `IMPL-003` scope mismatch is fixed in [`IMPL-003.json`](../.task/IMPL-003.json), which now includes the other live desktop `invoke(...)` call sites and the full 5-command surface.
- One stale inconsistency remains: [`IMPL_PLAN.md`](../IMPL_PLAN.md) still says “preserve the 4 existing command names” at the risk table, while [`IMPL-003.json`](../.task/IMPL-003.json) and [`desktop/src-tauri/src/main.rs`](/D:/工作目录/niko-studio/desktop/src-tauri/src/main.rs#L409) clearly use 5 commands.

## D. Dependency Integrity
Status: `PASS`

Evidence:
- The main dependency graph remains coherent: `IMPL-001 -> IMPL-004`, `IMPL-002 -> IMPL-005`, `IMPL-001 + IMPL-003 -> IMPL-006`, `IMPL-006 -> IMPL-007`, `IMPL-007 -> IMPL-008/009`, `IMPL-009 -> IMPL-010`.
- The earlier transport-contract blocker is resolved: [`IMPL-003.json`](../.task/IMPL-003.json) now includes [`desktop/src/hooks/useAppBackendBootstrap.ts`](/D:/工作目录/niko-studio/desktop/src/hooks/useAppBackendBootstrap.ts), [`desktop/src/components/SettingsModal.tsx`](/D:/工作目录/niko-studio/desktop/src/components/SettingsModal.tsx#L251), and [`desktop/src-tauri/src/main.rs`](/D:/工作目录/niko-studio/desktop/src-tauri/src/main.rs#L409) in scope or focus.
- Story Bible sequencing is now sounder because [`IMPL-009.json`](../.task/IMPL-009.json) explicitly creates the focused test surface if needed, and [`IMPL-010.json`](../.task/IMPL-010.json) depends on `IMPL-009`.

## E. Upstream-Session Alignment
Status: `PASS`

Evidence:
- [`plan.json`](../plan.json) preserves the upstream state as `GO` with `authority_alignment_signal = PASS`, matching [`HANDOFF.md`](../../WFS-post-governance-hardening-20260407/HANDOFF.md).
- The execution rules in [`plan.json`](../plan.json) explicitly forbid reopening governance, authority-alignment, or release-hardening work already completed upstream.
- The plan continues to preserve the authoritative `desktop + src-ts` path and avoids reintroducing Python or Web as equal-first runtime paths.

## F. Task Specification Quality
Status: `WARN`

Evidence:
- The largest earlier spec issue is fixed: [`IMPL-003.json`](../.task/IMPL-003.json) now names the correct 5-command host surface and covers the extra invoke call sites.
- The Story Bible test-surface issue is also fixed: [`IMPL-009.json`](../.task/IMPL-009.json) explicitly says to create the focused `StoryBiblePanel` test surface if it does not already exist.
- The remaining weak point is [`IMPL-007.json`](../.task/IMPL-007.json), whose verification still ends with a manual smoke-check. Existing automated coverage in [`desktop/src/components/KnowledgeModal.test.tsx`](/D:/工作目录/niko-studio/desktop/src/components/KnowledgeModal.test.tsx#L25) is still accessibility/label-focused rather than behavior-focused.
- [`IMPL-002.json`](../.task/IMPL-002.json) is improved, but it still does not define an explicit first-pass lint/format allowlist or rule profile even though verification requires `lint`, `format:check`, and `check:local` on both packages.

## G. Duplication and Overlap
Status: `PASS`

Evidence:
- Same-wave scopes remain mostly isolated as promised: gateway internals, repo baseline config, desktop transport work, knowledge UI, and Story Bible work are separated by file cluster.
- Overlap is deliberate and sequenced where it exists: `client.ts` and transport files between `IMPL-003` and `IMPL-006`, and Story Bible files between `IMPL-009` and `IMPL-010`.
- No task pair now appears to solve the same problem twice.

## H. Feasibility and Sequencing
Status: `WARN`

Evidence:
- The earlier wave-1 execution blocker is removed because `IMPL-003` now matches the real desktop transport surface.
- Wave sequencing is generally feasible, but wave 3 can still close on a partly subjective manual verification path because [`IMPL-007.json`](../.task/IMPL-007.json) does not require an automated behavior gate before moving to [`IMPL-008.json`](../.task/IMPL-008.json).
- [`IMPL_PLAN.md`](../IMPL_PLAN.md) already acknowledges noisy whole-repo lint churn as a high risk for `IMPL-002`; without an explicit first-pass allowlist or minimal rule set, that risk can still surface during execution.

## I. Constraints Compliance
Status: `PASS`

Evidence:
- [`plan.json`](../plan.json) keeps governance, authority-alignment, and release-hardening work out of scope, consistent with the user constraint to follow the completed upstream session rather than reopen it.
- [`plan.json`](../plan.json) explicitly forbids CSV-wave artifacts for this session.
- Story Bible tasks remain within the stated local-only boundary and do not add gateway-backed or Tauri-managed project persistence.

## J. Context Fidelity to the Current Repo State
Status: `WARN`

Evidence:
- The major repo-state mismatches from the earlier verification are resolved: the extra desktop invoke sites are now included in `IMPL-003`, the 5-command host inventory is correct in the task JSON, and Story Bible test creation is now explicit while [`desktop/src/components/StoryBiblePanel.test.tsx`](/D:/工作目录/niko-studio/desktop/src/components/StoryBiblePanel.test.tsx) is still absent.
- The plan remains faithful on other live facts: [`pytest.ini`](/D:/工作目录/niko-studio/pytest.ini#L17) still carries legacy `--cov=src`, and [`desktop/src/components/StoryBiblePanel.tsx`](/D:/工作目录/niko-studio/desktop/src/components/StoryBiblePanel.tsx#L85) still persists the five local draft fields in local storage while characters and locations are graph-backed reads.
- One stale repo-state mismatch remains in [`IMPL_PLAN.md`](../IMPL_PLAN.md): the risk table still refers to 4 command names even though [`desktop/src-tauri/src/main.rs`](/D:/工作目录/niko-studio/desktop/src-tauri/src/main.rs#L409) registers 5.

## Issues

1. `MEDIUM` - `IMPL_PLAN.md` still contains a stale 4-command inventory for the desktop transport split.
   Refs: [`IMPL_PLAN.md`](../IMPL_PLAN.md), [`IMPL-003.json`](../.task/IMPL-003.json), [`desktop/src-tauri/src/main.rs`](/D:/工作目录/niko-studio/desktop/src-tauri/src/main.rs#L409).
   Impact: the main task spec is now correct, but the plan document still contains an outdated fact that can confuse execution or later review.

2. `MEDIUM` - `IMPL-007` still exits on a partly subjective verification path.
   Refs: [`IMPL-007.json`](../.task/IMPL-007.json), [`IMPL-008.json`](../.task/IMPL-008.json), [`desktop/src/components/KnowledgeModal.test.tsx`](/D:/工作目录/niko-studio/desktop/src/components/KnowledgeModal.test.tsx#L25).
   Impact: wave 3 can be marked complete without a scripted proof that the non-skill detail flow and dead-CTA removal actually work.

3. `LOW` - `IMPL-002` still needs an explicit first-pass baseline boundary.
   Refs: [`IMPL-002.json`](../.task/IMPL-002.json), [`desktop/package.json`](/D:/工作目录/niko-studio/desktop/package.json), [`src-ts/package.json`](/D:/工作目录/niko-studio/src-ts/package.json).
   Impact: the task is still feasible, but verification may expand into out-of-scope cleanup unless execution starts with a deliberately narrow lint/format rule set or file allowlist.

## Final Quality Gate

`PROCEED_WITH_CAUTION`

Rationale:
- The earlier blocking-quality issue around `IMPL-003` is materially resolved: the task now matches the real 5-command desktop transport surface and includes the extra invoke call sites.
- The Story Bible test-surface ambiguity is also resolved: `IMPL-009` now explicitly handles test creation.
- The remaining problems are non-blocking but real: one stale plan fact, one subjective wave-3 verification gate, and one baseline-rollout risk.

## Recommended Fixes

1. Update [`IMPL_PLAN.md`](../IMPL_PLAN.md) to say `5` existing command names instead of `4` in the desktop contract split risk row.

2. Tighten [`IMPL-007.json`](../.task/IMPL-007.json) so wave 3 cannot close on typecheck plus manual smoke alone.
   Either add a scriptable behavior verification step, or state explicitly that `IMPL-008` must land before the knowledge-closure wave is considered complete.

3. Narrow the first-pass rollout contract in [`IMPL-002.json`](../.task/IMPL-002.json).
   Define the initial lint/format scope as an explicit allowlist or minimal rule profile limited to the active `desktop` and `src-ts` authority surfaces so verification does not force unrelated source churn.
