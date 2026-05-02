# M1 Summary: UX & Stability Sprint

**Completed**: 2026-05-03
**Verdict**: PASS

---

## What Shipped

### Phase 1: Frontend UX Polish
- Chat composer toolbar with quick-action buttons and inline mode switcher
- Cross-panel layout consistency (spacing, typography, interactive states)
- WCAG 2.1 a11y fixes (aria-hidden, screen reader announcements, focus management)
- Draft persistence across mode switches with debounce + cancel pattern
- CSS design token cleanup and shared utility standardization

### Phase 2: Backend Stability & Knowledge
- Structured error classification (6 error classes) in workflow engine
- Auto-retry for recoverable streaming errors (max 2 retries, configurable delay)
- Error class badge in stream status UI
- Full CRUD for Character, Location, Plot knowledge entries
- Delete-with-confirmation dialog
- Extra fields per entity type (Role/Traits, Geography, Chapter/Act)
- Rename fix: MATCH+SET before MERGE to prevent duplicate graph nodes

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Plans executed | 4 (PLN-001 through PLN-004) |
| Tasks completed | 21 |
| Source files modified | 30+ |
| Automated tests | 852 passing |
| Review findings | 0 critical, 0 high, 2 medium, 2 low |
| UAT scenarios | 8/8 passed |
| Learnings extracted | 15 |

---

## Key Learnings

1. **React auto-retry loops**: Use local `let` counters (not refs) inside `useCallback` for-loop retry tracking. `reset()` mid-loop triggers re-renders that invalidate `result.current` in tests.
2. **Nullish coalescing for numeric defaults**: `retry_after ?? 5` (not `|| 5`) — 0 is falsy with `||`.
3. **Cypher rename safety**: Execute MATCH+SET to rename first, then MERGE on the new name. Single MERGE can create duplicates depending on engine implementation.
4. **Test mock completeness**: When adding graph CRUD features, update mock's queryGraph handler for new mutation patterns (DETACH DELETE, MATCH+SET rename).
5. **aria-hidden on focusable elements**: WCAG 2.1 SC 1.3.1 forbids aria-hidden on keyboard-accessible elements. Use `tabIndex={-1}` instead.
6. **Screen reader announcements**: Changing `aria-label` in-place doesn't trigger NVDA/VoiceOver announcements. Use adjacent `<span role="status">` for status changes.
7. **Debounce cancel pattern**: Inline `makeDebounce` must return `{ call, cancel }`. Always call `cancel()` before clearing state in send/submit handlers to prevent stale timers.
8. **Draft restore useEffect deps**: Use `[currentConversationId]` (not `[persistedText]`) to avoid overwriting in-progress input on every persist call.

---

## Deferred to M2

- Full embedding-based semantic search for knowledge retrieval
- L4/L5 multi-agent coordinator stress testing
- Composer rich-text attachments (image/file drag-drop)
- Skill Tab CRUD improvements
- Remove dead `retryCountRef` in useChatStreaming.ts (REV2-001)
- Type `streamErrorPayload` properly instead of `any` (REV2-002)
