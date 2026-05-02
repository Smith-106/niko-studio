# Project Learnings

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
