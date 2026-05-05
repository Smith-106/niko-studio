# Project Learnings

<spec-entry category="learning" keywords="a11y,aria-hidden,tabIndex,wcag,focusable" date="2026-05-02" source="execute/EXC-003/TASK-001">
Never use `aria-hidden` on keyboard-focusable interactive elements. Use `tabIndex={condition ? -1 : undefined}` to exclude from tab order instead. WCAG 2.1 SC 1.3.1 forbids aria-hidden on elements still in the tab order — screen readers cannot describe a focused element hidden from the accessibility tree.
</spec-entry>

<spec-entry category="learning" keywords="a11y,screen-reader,aria-live,status,announcement" date="2026-05-02" source="execute/EXC-003/TASK-001">
Changing `aria-label` in place on a button does not reliably trigger screen reader announcements in NVDA/VoiceOver. Use `<span role="status" className="sr-only">{text}</span>` adjacent to the button for WCAG 2.1 SC 4.1.3 compliant status changes. The button's aria-label can remain static.
</spec-entry>

<spec-entry category="learning" keywords="debounce,cancel,setTimeout,draft-persist,race-condition" date="2026-05-02" source="execute/EXC-003/TASK-002">
Inline `makeDebounce` should return `{ call, cancel }` instead of just the debounced function. Without `cancel()`, a stale debounce timer can fire after the action it was debouncing has already completed (e.g., a draft persist timer firing after a message is sent, re-creating the draft). Always call `cancel()` before clearing state in send/submit handlers.
</spec-entry>

<spec-entry category="debug" keywords="css,index.css,globals.css,file-path" date="2026-05-02" source="execute/TASK-001">
The project CSS entry point is `src/styles/globals.css`, not `src/index.css`. Plans referencing `src/index.css` as a target should be redirected to `src/styles/globals.css`. The `:root` design token block lives at the top of globals.css.
</spec-entry>

<spec-entry category="debug" keywords="linter,auto-revert,atomic-commit,file-write" date="2026-05-02" source="execute/TASK-006">
The project linter (likely ESLint + Prettier via a pre-write hook) auto-reverts edits to .tsx files if they don't pass lint on save. When edits get reverted mid-session, the fix is to write all changes and commit atomically in a single step rather than making incremental edits.
</spec-entry>

<spec-entry category="coding" keywords="navigator.clipboard,jsdom,vitest,mock,test" date="2026-05-02" source="execute/TASK-007">
`navigator.clipboard` is not available in jsdom (vitest test environment). For tests that exercise clipboard copy behavior, mock with: `vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })`. The implementation code should already wrap clipboard calls in `.catch(() => {})` to handle non-browser environments gracefully.
</spec-entry>

<spec-entry category="debug" keywords="stale-tests,pre-existing-failures,test-cleanup,removed-props" date="2026-05-02" source="execute/TASK-007">
When simplifying components (removing props/UI elements), the corresponding test files accumulate stale tests that reference removed behavior. These show up as pre-existing failures in downstream tasks. Best practice: update test files in the same task that removes the behavior (TASK-003 did this correctly for ChatAreaModeControls), or dedicate a test cleanup task immediately after (TASK-007 cleaned up ChatArea.test.tsx).
</spec-entry>

<spec-entry category="coding" keywords="ChatAreaComposer,toolbar,simplified-baseline,plan-vs-reality" date="2026-05-02" source="execute/TASK-002">
ChatAreaComposer.tsx was already simplified to a 123-line baseline before Phase 1 planning. Plan documentation described a 404-line version with toolbar dropdowns. Always read the actual file before referencing line numbers from plan docs — the live code may differ significantly from planning-time snapshots.
</spec-entry>

<spec-entry category="coding" keywords="debounce,no-lodash,useMemo,useRef,inline-helper" date="2026-05-02" source="execute/TASK-002-gaps">
This project has no lodash or debounce utility. For debounced persistence, use a 3-line module-scope helper before the component: `function makeDebounce<T extends (...args: any[]) => void>(fn: T, delay: number) { let timer: ReturnType<typeof setTimeout>; return (...args: Parameters<T>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) } }`. Wire into component via `useMemo(() => makeDebounce(persist, 350), [persist])`.
</spec-entry>

<spec-entry category="debug" keywords="useEffect,stale-deps,eslint-disable,react-hooks,draft-restore" date="2026-05-02" source="execute/TASK-002-gaps">
React anti-pattern in draft restore: `useEffect(() => setInput(persistedText), [persistedText])` fires on every `persist()` call, overwriting in-progress user input. Fix: change dep to `[currentConversationId]` with `// eslint-disable-next-line react-hooks/exhaustive-deps` on the preceding line to make the intentional dep mismatch explicit.
</spec-entry>

<spec-entry category="coding" keywords="opacity-0,aria-hidden,testing-library,getByTitle,conditional-render" date="2026-05-02" source="execute/TASK-004-gaps">
When using `opacity-0 pointer-events-none` + `aria-hidden="true"` to visually hide buttons (vs conditional mount), testing-library's `getByRole` won't find aria-hidden elements even with `{ hidden: true }` in some versions. Use `getByTitle(titleText)` as the query selector for hidden-state Trash2/similar buttons, then assert `.toHaveClass('opacity-0')` for the hidden state.
</spec-entry>

<spec-entry category="learning" keywords="auto-retry,streaming,useCallback,for-loop,timer" date="2026-05-03" source="milestone-complete/M1">
Auto-retry loops inside React `useCallback` must use local variables (not refs) for retry tracking when the loop is a synchronous `for(;;)` with `await`. Calling `reset()` from `useSmoothStream` mid-loop triggers a re-render that can invalidate `renderHook`'s `result.current` in tests. Fix: track retries via local `let` counter, skip `reset()` calls inside the loop, use `??` instead of `||` for numeric defaults (0 is falsy with `||`).
</spec-entry>

<spec-entry category="learning" keywords="cypher,graph,rename,duplicate,MERGE" date="2026-05-03" source="milestone-complete/M1">
In custom Cypher-like graph engines, using MERGE with a match on the OLD name and SET to a NEW name can create duplicates depending on engine implementation. Safer pattern: execute a separate MATCH+SET to rename first, then MERGE on the new name for remaining property updates. This avoids the engine creating a new node if MERGE's match predicate doesn't find the pre-renamed node.
</spec-entry>

<spec-entry category="learning" keywords="test-mock,queryGraph,DETACH-DELETE,graph-crud" date="2026-05-03" source="milestone-complete/M1">
When adding graph CRUD features (delete, rename), update the test mock's queryGraph handler to recognize the new mutation patterns (MATCH+SET for rename, DETACH DELETE for delete). Without these handlers, tests will fall through to the generic LOAD query handler, causing false failures or silent no-ops.
</spec-entry>

<spec-entry category="learning" keywords="vitest,globalSetup,sidecar,compiled-tree,globalTeardown" date="2026-05-03" source="execute/EXC-{pending}/TASK-002">
Sidecar vitest's globalSetup references `tests/globalTeardown.ts`, but the compiled `src-tauri/bin/sidecar/` tree may ship without it (the canonical copy lives in `src-ts/tests/`). When `npx vitest run` from `src-tauri/bin/sidecar/` fails to start with a missing-globalSetup error, recreate the shim by copying from `src-ts/tests/globalTeardown.ts`. A sidecar rebuild can re-introduce the gap.
</spec-entry>

<spec-entry category="learning" keywords="vector-search,DI,embedding,fire-and-forget,graceful-degradation" date="2026-05-03" source="milestone-complete/M2">
Inject optional services (VectorSearch) into core components (GraphManager) via method injection (`setVectorSearch()`) rather than constructor coupling. Embedding failures in `_embedEntity` are fire-and-forget — graph CRUD operations continue without blocking on embedding. When VectorSearch is unavailable, all graph operations degrade to non-embedded mode transparently. This pattern lets heavy ML dependencies be optional without complicating core data paths.
Milestone: M2 Phase 1 (TASK-004)
</spec-entry>

<spec-entry category="learning" keywords="hybrid-search,semantic-search,keyword-fallback,transparent-backend" date="2026-05-03" source="milestone-complete/M2">
When upgrading search from keyword-only to hybrid (keyword + vector RRF fusion), keep the API shape identical (`searchEntities()` → ranked entity array) and make the search mode an internal implementation detail. Frontend consumers need zero changes. The async hybrid path falls back to keyword-only when VectorSearch is null, preserving existing behavior. This "transparent backend upgrade" pattern avoids breaking API contracts while adding capability.
Milestone: M2 Phase 1 (TASK-005)
</spec-entry>

<spec-entry category="learning" keywords="stress-test,harness,reusable,mock-container,timeout-guard" date="2026-05-03" source="milestone-complete/M2">
Build a reusable stress test harness (`createMockContainer`, `withTimeout`, `validateNoUnhandledRejections`, `assertSessionState`) before writing workflow-specific stress tests. The harness self-test catches harness bugs before stress tests depend on it. This DRY investment pays back when multiple test suites (L4, L5, future L6+) build on the same foundation without duplicating fixture/cleanup code.
Milestone: M2 Phase 2 (TASK-002)
</spec-entry>

<spec-entry category="learning" keywords="parallelism,sequential-bottleneck,Promise.race,timeout,async-fix" date="2026-05-03" source="milestone-complete/M2">
L4 Brainstorm's `generateArtifacts()` was sequential despite `max_parallel` config — a 37500ms baseline for 5 rounds. Fix: make `execute()` async with `generateArtifactsAsync` + `Promise.race` timeout per role, yielding 5x speedup to 7534ms. Root cause: the original loop iterated roles sequentially without honoring parallelism config. Always verify that parallelism configs are actually used in hot loops, not just documented.
Milestone: M2 Phase 2 (TASK-005)
</spec-entry>

<spec-entry category="learning" keywords="integration-test,smoke,e2e,env-gate,optional-dependency" date="2026-05-03" source="milestone-complete/M2">
For integration tests involving optional ML dependencies (fastembed model), use two tiers: smoke test (unconditional, verifies DI wiring and interface contracts) + e2e test (env-gated, skips when model unavailable). The smoke test catches DI miswiring in CI; the e2e test proves the full pipeline when run in an environment with the model. This prevents false CI failures from missing optional dependencies while still validating integration contracts.
Milestone: M2 Phase 2 (TASK-007)
</spec-entry>

<spec-entry category="learning" keywords="regression-baseline,test-count,phase-boundary,classification" date="2026-05-03" source="milestone-complete/M2">
Track exact test counts at each phase boundary (Phase 1: 860/860 frontend baseline). At Phase 2, verify `baseline_match=true` with exact count comparison. Classify sidecar failures as pre-existing (verified via `git stash` at baseline commit + re-run) or environmental (missing LLM provider) rather than new regressions. This three-tier classification (baseline match / pre-existing / environmental) prevents false regression alarms during multi-phase milestones.
Milestone: M2 Phase 2 (TASK-008)
</spec-entry>

<spec-entry category="coding" keywords="service-singleton,lazy-init,MCP-endpoint,manager-pattern" date="2026-05-03" source="execute/EXC-008/TASK-005">
For MCP services wrapping manager classes not in the DI container (ForeshadowingManager, CharacterManager), use module-level singleton with lazy `getManager()` init. Pattern: `let instance = null; function getManager() { if (!instance) { instance = new ManagerClass(); } return instance; }`. This avoids import-time construction while keeping the service layer simple. Each service file exports async functions that call `getManager()` then delegate to the manager.
Milestone: M3 (TASK-005, TASK-007, TASK-008)
</spec-entry>

<spec-entry category="coding" keywords="store-adapter,Cypher,graph-engine,NarrativePatternDetector" date="2026-05-03" source="execute/EXC-008/TASK-008">
When a module requires a `store` interface (e.g., NarrativePatternDetector needing `getEntitiesByTypes()`), create a lightweight adapter that translates calls to the graph engine's `executeCypher()`. The adapter lives in the service layer, not the module itself, keeping the module's dependency on an abstract store interface while the service provides the concrete implementation. This allows the module to remain testable with mock stores.
Milestone: M3 (TASK-008)
</spec-entry>

<spec-entry category="learning" keywords="dual-transport,backward-compat,module-scores,additive-fields" date="2026-05-03" source="milestone-complete/M3">
When adding per-module score breakdowns to an existing evaluation API, use additive fields (`module_scores?`) rather than replacing the existing aggregate scores. The dual transport pattern: existing `lock_score/style_score/logic_score` remain unchanged for backward compat, while `module_scores` is an optional addition. Frontend code checks for `module_scores` presence before rendering the breakdown. This lets existing consumers continue working without modification while new consumers opt into richer data.
Milestone: M3 (TASK-001, TASK-006)
</spec-entry>

<spec-entry category="learning" keywords="deferral-validation,codebase-evolution,stale-deferred,N/A-resolution" date="2026-05-03" source="milestone-complete/M3">
Deferred items from prior milestones may become inapplicable when the codebase evolves. Before implementing a deferred fix, verify the referenced code still exists. ISS-066 deferred `executeChain` interrupt edge case, but by M3 the function no longer exists in workflow.js. Similarly, F-001 referenced a `renameSkill` import that had already been removed. Always re-validate deferred items against current code rather than assuming they remain relevant.
Milestone: M3 (TASK-003)
</spec-entry>

<spec-entry category="learning" keywords="evaluator-pattern,BaseEvaluator,weighted-subscores,Chinese-markers" date="2026-05-03" source="milestone-complete/M3">
When creating new CriticEngine evaluators, follow the BaseEvaluator pattern: extend BaseEvaluator, implement `evaluate(content)` returning `{ name, score, issues, suggestions, subscores }`, and use Chinese marker arrays for content analysis. Each evaluator gets a weight in CriticEngine's weights map (sum must equal 1.0). The `relatedSkill` property links evaluators to writing skills for the skill system. Weights are redistributed when adding evaluators — reduce existing weights proportionally.
Milestone: M3 (gap-fix TASK-001)
</spec-entry>

<spec-entry category="learning" keywords="pdf-export,window.print,media-print,css,browser-native" date="2026-05-05" source="milestone-complete/M7-P1">
For PDF export in web apps, use `window.print()` with dedicated `@media print` CSS instead of external libraries (jsPDF, puppeteer). The print CSS hides all UI except target content (`.niko-editor-content .ProseMirror`), sets print-optimized typography (12pt font, 1.6 line-height, break-inside/after rules), and delegates PDF generation to the browser's native print dialog. Zero dependencies, full platform support.
Milestone: M7 Phase 1 (TASK-101)
</spec-entry>

<spec-entry category="coding" keywords="test-helper,blob-download,captureDownload,mock-anchor,file-export" date="2026-05-05" source="milestone-complete/M7-P1">
For testing file download functions that create Blob URLs and trigger anchor clicks, use a `captureDownload()` helper: `vi.spyOn(document.body, 'appendChild').mockImplementation((node) => { calls.push({ filename: (node as HTMLAnchorElement).download }); return node })`. Also stub `URL.createObjectURL`/`revokeObjectURL` at module level. This avoids jsdom Blob/navigation issues while verifying correct filename and MIME type.
Milestone: M7 Phase 1 (TASK-104)
</spec-entry>
