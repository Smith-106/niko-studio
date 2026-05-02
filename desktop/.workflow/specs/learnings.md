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
