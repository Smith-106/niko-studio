# Analysis: M5 Phase 2 — Editor & UX Enhancement

**Artifact**: ANL-006
**Phase**: 2
**Milestone**: M5
**Date**: 2026-05-04
**Tool**: maestro-analyze (delegate gem-132723-fcd0)

---

## Summary

Phase 2 builds on the clean test baseline from Phase 1 to add writing-centric editor features and polish panel interactions. The TipTap editor has a minimal but solid foundation. Intelligence panels from M4 are functional but lack accessibility. Three new features (word count, focus mode, AI toolbar enhancement) are greenfield implementations with clear integration points.

---

## 6-Dimension Scoring

### 1. Feasibility: 8/10

**Evidence:**
- TipTap `characterCount` extension is a standard, well-documented extension — word count is straightforward
- `AppContextFooter.tsx` is a simple div already positioned at the bottom of the editor context area — ideal insertion point for word count
- BubbleToolbar already exists with AI action hooks (`onRewrite`, `onContinue`) — enhancing with expand/summarize is additive
- Focus mode is pure UI state management (Zustand store toggle → CSS class changes) — no backend dependency
- Keyboard navigation for panels follows standard React patterns (focus trap, roving tabindex)

**Risk:**
- TipTap extension version compatibility — `@tiptap/react` and `@tiaptap/extension-character-count` must match the installed core version

### 2. Impact: 9/10

**Evidence:**
- Word count + reading time are core writer tools — direct UX value
- Focus mode addresses the "distraction-free writing" requirement — high user request frequency
- AI inline actions (rewrite/expand/summarize) leverage the existing chat API — high leverage from existing infrastructure
- Panel keyboard navigation brings M4 panels to WCAG 2.1 AA compliance

### 3. Complexity: 6/10

**Evidence:**
- Word count: Low — add `CharacterCount` extension, pipe `onUpdate` stats to footer
- Focus mode: Medium — new Zustand slice, CSS transitions, conditional rendering of sidebar/panels
- AI toolbar enhancement: Medium — wire new action types to existing chat API, handle streaming responses inline
- Keyboard navigation: Medium-High — focus management, roving tabindex across dynamic panel list, Escape key handling
- Responsive layout: Medium — Tailwind breakpoints, collapsible panel regions

### 4. Dependencies: 8/10

**Evidence:**
- All dependencies are frontend-only — no backend changes
- TipTap `@tiptap/extension-character-count` is the only new package dependency
- Zustand store already exists — focus mode state fits naturally
- Chat API hooks (`useChatStreaming`) already handle streaming — AI toolbar reuses them
- No cross-milestone dependencies — M4 panels are complete

### 5. Risk: 5/10

**Evidence:**
- TipTap extension version mismatch could cause build failures (mitigated: check package versions before install)
- Focus mode state conflicts with panel open/close state (mitigated: focus mode auto-closes panels)
- AI inline actions could conflict with existing BubbleToolbar formatting actions (mitigated: separate AI submenu)
- Keyboard nav across panels requires careful focus trap management (standard pattern, well-documented)

### 6. Alignment: 9/10

**Evidence:**
- All features directly serve the "Writing Experience & Quality" milestone theme
- No scope creep — features are tightly scoped to editor and panel polish
- Builds naturally on M4 intelligence panel foundation
- Phase 1 test health ensures a stable baseline for feature work

---

## Component Map

| Component | Location | Current State | Phase 2 Change |
|-----------|----------|---------------|----------------|
| NikoEditor.tsx | src/components/editor/ | Minimal TipTap (StarterKit, Placeholder, TextStyle, Typography) | Add CharacterCount extension, onUpdate callback for word stats |
| BubbleToolbar.tsx | src/components/editor/ | Floating div with formatting + AI (rewrite, continue) | Add expand/summarize actions, improve ARIA |
| AiToolbar.tsx | src/components/ | Static global toolbar in AppHeader | Add toolbar role, improve keyboard nav |
| AppContextFooter.tsx | src/components/ | Simple div with contextEstimatedText | Add word count + reading time display |
| SessionAnalyticsPanel.tsx | src/components/intelligence/ | Chart-based analytics | Connect live word count metrics |
| CharacterRelationshipsPanel.tsx | src/components/intelligence/ | Relationship graph | Add keyboard focus management |
| ForeshadowingTrackerPanel.tsx | src/components/intelligence/ | Foreshadowing items | Add keyboard focus management |
| PatternDashboardPanel.tsx | src/components/intelligence/ | Pattern cards | Add keyboard focus management |
| AccordionWrapper.tsx | src/components/intelligence/ | Basic accordion | Add ARIA attributes per M4 TASK-010 |

---

## Key Findings

1. **TipTap foundation is minimal but solid** — Standard extensions only, no custom extensions. Adding CharacterCount is low-risk.
2. **BubbleToolbar is the right place for AI inline actions** — Already has AI hooks, just needs expand/summarize additions.
3. **Focus mode is greenfield** — No existing implementation anywhere in `src/`. Needs new Zustand slice + UI toggle.
4. **Panel accessibility is the highest-effort item** — All four intelligence panels need keyboard focus management, ARIA attributes, and proper focus traps.
5. **AccordionWrapper has tech debt** — M4 TASK-010 specified ARIA attributes that were never implemented. Fix in this phase.
6. **AppContextFooter is ideal for word count** — Simple component, already in the right position, easy to extend.

---

## Go/No-Go Recommendation

**GO** — All features are feasible with existing infrastructure. Phase 1 provides a clean test baseline. The only new dependency is `@tiptap/extension-character-count`. Risk is contained and mitigable.
