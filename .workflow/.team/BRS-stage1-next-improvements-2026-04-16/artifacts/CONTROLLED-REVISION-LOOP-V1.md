# Controlled Revision Loop v1

## Goal

Make AI revision feel like a normal writing-app editing action instead of a side-panel text dump.

Version 1 should let the user:

1. generate a revision candidate from an existing selection or current draft chunk;
2. compare the candidate against the source text;
3. apply the candidate into the editor in a controlled way;
4. insert the candidate as an alternative instead of replacing the original;
5. undo the most recent apply safely.

## Product Boundary

This is **not** the full `active writing thread` idea.

This slice should **not** include:

- global cross-surface shared-state redesign
- automatic context escalation
- broad recovery sheet / task center
- shell-wide route or runtime refactor
- full-document patch engine
- complex diff/merge UI

This slice **may** include small enabling support work when directly required by the apply loop.

## Current Relevant Reality

### Existing strengths

- `WritingHelperPanel` already generates revised text and waits for explicit user insertion.
- `useEditorAI.rewriteSelection()` already supports selection-level rewrite and safe rollback on stream failure/cancel.
- `EvaluationPanel` already has recommendation apply/undo actions, so the product already has an "action -> apply -> rollback" mental model.
- `NikoEditor` already exposes a lightweight editor bridge through `editorHandle`.

### Existing gaps

- `WritingHelperPanel` can only `insertText`, not replace the original selection or present revision alternatives as a controlled loop.
- `editorHandle` is too weak for a revision workflow. It exposes insert/getSelectedText/getJSON, but not selection replacement, alternative insertion, or local revision undo.
- `EvaluationPanel` apply/undo currently operates through recommendation APIs, not the same editor-facing revision path the writer sees in text rewriting.
- There is no shared revision candidate model across `WritingHelperPanel`, `EvaluationPanel`, and the editor bridge.

## V1 User Story

The user selects a paragraph, asks for rewrite/revise/polish, gets one candidate back, sees the original and candidate together, then chooses:

- `Replace selection`
- `Insert below as alternative`
- `Undo last apply`

Evaluation should be able to feed that same loop with 1 to 3 revision moves, but only after the candidate/apply target exists.

## Recommended Task Split

### TASK-R1 Editor Revision Handle

#### Goal

Extend the editor bridge from a simple "insert text" helper into a small revision-safe contract.

#### Required capabilities

- `getSelectedText()`
- `replaceSelection(text)`
- `insertBelowSelection(text)` or nearest equivalent stable insertion
- `captureSelectionSnapshot()` returning enough data to apply or restore safely
- `undoLastRevisionApply()` for the most recent apply done through this loop only

#### Notes

- Keep this local and explicit.
- Do not introduce global editor command buses or generalized history frameworks.
- Prefer building on existing TipTap range replacement primitives already used by `useEditorAI`.

### TASK-R2 Revision Candidate Model

#### Goal

Define one frontend-level candidate object for revision results.

#### Minimum shape

- `sourceText`
- `candidateText`
- `origin`
  - `writing-helper`
  - `evaluation`
  - optional later: `editor-ai`
- `mode`
  - `rewrite`
  - `polish`
  - `expand`
  - etc.
- `selectionSnapshot`
- `createdAt`

#### Notes

- Keep it session-local for v1.
- This model is the precursor to later handoff work, but should not yet become a global task thread.

### TASK-R3 Writing Helper Compare/Apply Surface

#### Goal

Turn `WritingHelperPanel` result output into the first real revision loop surface.

#### UX requirements

- Show `original` and `candidate` together when the action came from existing selected text.
- Keep plain result rendering for modes like outline/summarize where compare is irrelevant.
- Replace the current single `insert to editor` action with:
  - `Replace selection`
  - `Insert as alternative`
  - `Undo last apply`

#### Notes

- v1 can use a simple dual-block compare view.
- Do not block on inline rich diff rendering.

### TASK-R4 Evaluation Feeds Revision Loop

#### Goal

Make `EvaluationPanel` produce revision candidates that enter the same apply loop instead of remaining a separate action silo.

#### v1 rule

- Keep only 1 to 3 highest-value revision moves.
- Do not redesign the whole evaluation surface.
- A recommendation should be able to open or hydrate the same revision candidate/apply path used by `WritingHelperPanel`.

#### Notes

- This can initially be one-way:
  - evaluation generates candidate
  - candidate moves into controlled apply loop
- Full revision sprint orchestration can wait.

### TASK-R5 Focused Regression Coverage

#### Goal

Lock the loop down with narrow, high-value tests.

#### Needed coverage

- editor handle replacement / alternative insertion / local undo
- `WritingHelperPanel` compare/apply actions
- evaluation-driven entry into the same apply flow
- rollback safety when stream rewrite fails or is cancelled before content arrives

## Suggested Build Order

1. `TASK-R1 Editor Revision Handle`
2. `TASK-R2 Revision Candidate Model`
3. `TASK-R3 Writing Helper Compare/Apply Surface`
4. `TASK-R5 Focused Regression Coverage` for the first loop
5. `TASK-R4 Evaluation Feeds Revision Loop`

## Why This Order

- Without editor-side replace/apply/undo, everything else is fake wiring.
- Without a candidate model, handoff into evaluation or future task continuity will sprawl.
- `WritingHelperPanel` is the safest first front-end landing point because it already has explicit result staging.
- Evaluation should consume the proven loop, not define it.

## Explicit Deferrals

- persistent `active writing thread`
- cross-surface current-task carry-over beyond the minimal candidate object
- automatic research/source attachment
- shell simplification beyond thin local support
- generalized patch history across the whole manuscript
- broad editor diff viewer

## Implementation Anchor

If we start coding immediately, the most defensible first code slice is:

1. extend `editorHandle` + `NikoEditor` with revision-safe replace/insert/undo methods;
2. add a minimal candidate object inside `WritingHelperPanel`;
3. replace `Insert to editor` with `Replace selection / Insert as alternative / Undo`.

That delivers a real user-visible loop without forcing the rest of the product to reorganize around it yet.
