# Context: M9 Phase 1 — Intelligence & Templates

## Locked Decisions

1. **Prompt-based analysis via existing gateway** — No custom ML models. All intelligence modules use crafted prompts through the existing agent gateway. **Why:** Reuses infrastructure, no new dependencies, LLM improvements automatically benefit analysis quality.

2. **On-demand analysis (user-triggered)** — Analysis runs when user clicks "Analyze", not automatic on save. **Why:** AI calls are expensive (time + tokens); user controls cost/latency.

3. **Filesystem-based caching** — Analysis results stored as JSON files in Tauri appDataDir alongside project data, using content_hash for invalidation. **Why:** Consistent with existing `projectFileService.ts` pattern; no SQLite needed.

4. **TipTap JSON as template format** — Templates are stored as TipTap JSON with metadata envelope. **Why:** Zero conversion needed when applying template to editor.

5. **Frontend-orchestrated analysis** — Analysis orchestration happens in frontend TypeScript (intelligenceService), calling existing gateway agent endpoints per chapter. No new sidecar endpoints needed. **Why:** Simpler implementation, avoids sidecar PR, leverage existing agent/write and agent/context endpoints.

6. **Built-in templates bundled with app** — Static JSON files in `src/templates/` imported at build time. **Why:** No filesystem access needed for built-in templates; user templates go to Tauri appDataDir.

## Free Decisions (implementer's choice)

1. **Chinese readability formula** — Need to choose or adapt a formula. Options: simplified character count-based metrics, adapted Flesch formula for Chinese, or custom scoring based on sentence/paragraph length ratios.

2. **Analysis UI layout** — Whether to add a new tab to AppRightPanels or extend EvaluationPanel. Recommendation: new "Intelligence" tab in AppRightPanels for clean separation.

3. **Template categories** — Beyond the 5 required (novel chapter, short story, essay, script, academic paper), how to organize custom user categories.

4. **Progress feedback mechanism** — How to show analysis progress (simple progress bar, chapter-by-chapter status, or toast notifications).

5. **Template preview rendering** — Whether to render TipTap JSON in a read-only editor instance or simplified HTML preview.

## Deferred

1. **Genre-specific writing advice** — Based on analysis results, provide genre-specific suggestions. Deferred to future enhancement.

2. **Automated outline validation** — Compare manuscript against planned outline. Deferred: requires outline data model that doesn't exist yet.

3. **Template marketplace** — Sharing templates between users. Deferred: requires infrastructure beyond desktop app scope.

4. **AI-generated templates** — Generate templates from genre/style description. Deferred: complex, F-006 scope is manual templates only.

5. **Analysis result export** — Export analysis report as markdown. Nice-to-have, not blocking.

## Gray Areas

1. **Cross-chapter analysis context strategy** — How to pass accumulated context between chapter analyses without exceeding LLM context window. Options: rolling summary, key-fact extraction, or bounded window of N previous chapters.

2. **Consistency checker confidence threshold** — At what confidence level should findings be presented. Too low = noise, too high = missed issues. Needs UX tuning.

3. **Template placeholder discovery** — How to extract `{{variables}}` from TipTap JSON content (need to traverse text nodes recursively).

4. **Analysis cancellation** — If user navigates away during multi-chapter analysis, should partial results be saved or discarded.
