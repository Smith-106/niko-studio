# Context: M6 Phase 1 — Profiling & Bundle Audit

## Locked Decisions

1. **Lazy loading already implemented** — All 12 right-panel components use React.lazy + Suspense in AppRightPanels.tsx. Roadmap TASK-2.1 is pre-resolved.

2. **Vendor chunk strategy is sound** — 5 vendor manualChunks (TipTap, ProseMirror, react-markdown, lucide, react-virtual) are appropriate. No vendor-level changes needed.

3. **TipTap editor stays eager** — NikoEditor is the primary writing view; lazy-loading would cause visible delay on app start. Not a candidate.

4. **react-markdown stays in vendor chunk** — Already code-split at 118KB/36KB gzip. MessageBubble triggers load on demand during chat.

## Free Decisions

1. **StoryBiblePanel lazy-loading approach** — React.lazy in DocumentEditor.tsx vs Vite manualChunks. React.lazy preferred (consistent with existing pattern).

2. **ChatArea lazy-loading scope** — Lazy-load ChatArea only (inside ChatSidebar) vs lazy-load entire ChatSidebar. Recommend ChatArea only since ChatSidebar has resize logic that should stay eager.

3. **Store selector pattern for Sidebar** — Convert `useAppStore()` to individual selectors or use `useShallow` for multi-value extraction.

4. **React.memo candidates** — Identify which components benefit from memoization. Only components with expensive renders + frequent parent updates are worth memoizing.

## Deferred

1. **Lighthouse audit with actual metrics** — Requires running app in browser with production build. CLI analysis covers static bundle composition only.

2. **React DevTools Profiler render analysis** — Requires interactive profiling. Deferred to Phase 2 validation.

3. **Bundle visualizer report** — `rollup-plugin-visualizer` or `vite-bundle-visualizer` can generate treemap. Useful but not blocking.

4. **Service worker / caching strategy** — Out of scope for M6. The app runs in Tauri desktop, not a web deployment.

## Gray Areas

1. **StoryBiblePanel conditional rendering** — Need to verify when StoryBiblePanel renders (always? tab-switched?). If always visible in editor, lazy-loading provides no benefit.
   - **Resolution needed**: Check DocumentEditor rendering logic for StoryBiblePanel visibility condition.

2. **ChatSidebar collapse state** — If chat sidebar is collapsed by default, lazy-loading ChatArea gives maximum benefit on initial load.
   - **Resolution needed**: Check default collapsed state.
