# Context: M5 Phase 2 — Editor & UX Enhancement

**Source**: ANL-006
**Phase**: 2
**Date**: 2026-05-04

---

## Locked Decisions

These decisions are final and must not be revisited during planning/execution.

1. **Word count placement → AppContextFooter** — AppContextFooter.tsx is the designated location for word count and reading time display. It is already positioned at the bottom of the editor context area and has a simple structure.
   - *Rationale*: Delegate analysis confirmed it as the ideal insertion point. No better alternative exists in the layout.

2. **AI inline actions → BubbleToolbar** — The existing BubbleToolbar.tsx is the vehicle for AI inline actions (rewrite/expand/summarize). It already has `onRewrite` and `onContinue` hooks.
   - *Rationale*: BubbleToolbar appears on text selection — the natural UX moment for AI actions. Adding to AiToolbar would require text selection context which AiToolbar doesn't have.

3. **Focus mode state → Zustand store** — Focus mode toggle state goes into the existing Zustand store as a new slice. Not local component state.
   - *Rationale*: Focus mode affects global layout (sidebar visibility, panel visibility) — must be accessible from multiple components. Zustand is the project's state management pattern.

4. **No backend changes** — All Phase 2 work is frontend-only. No new API endpoints, no Tauri changes.
   - *Rationale*: Milestone scope explicitly excludes backend. AI actions reuse existing chat API.

5. **Package dependency → @tiptap/extension-character-count** — This is the only new package allowed. Version must match existing `@tiptap/react` installation.
   - *Rationale*: Standard TipTap extension, minimal footprint, no alternatives for character/word counting in TipTap.

---

## Free Decisions

These decisions are open for the planner/executor to make based on implementation convenience.

1. **Focus mode UX details** — Toggle button placement (header, keyboard shortcut, both), animation style (instant vs transition), whether panels remember their open state when exiting focus mode.
   - *Constraints*: Must be toggleable. Must respond to Escape key to exit. Must hide sidebar and non-essential panels.

2. **AI toolbar action implementation** — How expand/summarize differ from rewrite in terms of prompt construction. Whether to use a submenu or inline buttons. How streaming responses appear during AI processing.
   - *Constraints*: Must call existing chat API. Must show the AI result inline or as a suggestion the user can accept/reject.

3. **Keyboard navigation pattern** — Roving tabindex vs focus trap vs hybrid approach for panels. Whether Tab/Shift+Tab cycles panels or follows DOM order.
   - *Constraints*: Tab/Shift+Tab between panels. Escape closes focused panel. Enter activates panel action. WCAG 2.1 AA target.

4. **Responsive breakpoints** — Which Tailwind breakpoints trigger panel collapse. How panels stack at narrow widths. Whether panels become overlay or off-screen at mobile widths.
   - *Constraints*: No horizontal overflow. Graceful degradation at narrow widths.

5. **Word count → SessionAnalytics connection** — How live writing metrics are surfaced in the SessionAnalytics dashboard. Whether via shared store slice or direct prop passing.
   - *Constraints*: Metrics must be live (update as user types). Must not cause performance issues from excessive re-renders.

---

## Deferred

These items are acknowledged but explicitly deferred to future milestones.

1. **Custom TipTap extensions beyond CharacterCount** — Tables, math notation, collaborative cursors, drag-and-drop blocks
   - *Reason*: Scope limitation — Phase 2 focuses on writing tools, not editor extension ecosystem.

2. **Export functionality** — PDF, DOCX, Markdown file export
   - *Reason*: Separate milestone concern. No infrastructure for file system writes exists yet.

3. **Writing session persistence** — Save/restore draft state across app restarts
   - *Reason*: Requires Tauri backend changes (file system access), which is out of scope.

4. **Dark mode / theme system** — Light/dark theme toggle with CSS custom properties
   - *Reason*: Cross-cutting concern best addressed as a dedicated milestone.

5. **Performance profiling** — Lazy loading panels, code splitting, editor performance optimization
   - *Reason*: Premature optimization. Address if profiling reveals issues.

6. **AccordionWrapper full accessibility audit** — Beyond the M4 TASK-010 ARIA attributes, full WCAG compliance for all accordion interactions
   - *Reason*: Fix the known debt from M4. Full audit can happen in a future quality milestone.

---

## Gray Areas

1. **TipTap version compatibility** — Need to verify `@tiptap/extension-character-count` is compatible with the installed `@tiptap/react` version. Check `package.json` at execution time.
2. **AI action streaming UX** — When an AI rewrite/expand/summarize action is processing, the UX for showing in-progress state is not specified. Planner should propose an approach.
3. **Focus mode + panel interaction** — If focus mode hides panels but a panel was already open, what happens when focus mode is exited? Need clear behavior definition.
