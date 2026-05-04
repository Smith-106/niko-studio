# M5 Phase 1 Analysis: Test Health & Technical Debt

## Summary

Phase 1 targets 3 pre-existing test failures and 3 TODO markers. Root cause analysis complete for all 6 items. All fixes are straightforward — no architectural changes needed.

## Test Failure Root Causes

### TF-1: useChatStreaming.test.tsx — tests 8 & 9 (lines 297, 339)

- **Root cause**: Retry logic commented out in `useChatStreaming.ts`
  - Lines 29-43: `StreamErrorPayload` interface and `isStreamErrorPayload` type guard commented out
  - Lines 74-75: `retries` variable commented out
  - Lines 174-183: Retry `if` block commented out
- **Impact**: Tests 8 & 9 expect `mockChatStream` to be called 2× and 3× respectively for retry scenarios, but current code only calls once then exits on error
- **Fix**: Uncomment the retry infrastructure (interface, type guard, counter, retry block). The logic is already written and correct — it was commented out, not removed.
- **Confidence**: HIGH — uncommenting matches test expectations exactly

### TF-2: Sidebar.test.tsx — snapshot test (line 159)

- **Root cause**: Stale snapshot from before M4 added "Characters" button with SVG icon
- **Impact**: Snapshot diff shows new `<svg>` and `<span class="text-sm font-medium">Characters</span>` elements
- **Fix**: Update snapshot via `vitest -u`
- **Confidence**: HIGH — visual inspection of diff confirms M4 additions only

## TODO Markers

### TODO-1: analysis.test.ts line 48-49

- **Content**: `// TODO: Fix this test` / `// expect(result.data[0].name).toBe('Recurring Motif')`
- **Root cause**: Assertion was commented out, likely during a prior refactor
- **Fix**: Uncomment the assertion — mock data already includes `name: 'Recurring Motif'`
- **Confidence**: HIGH

### TODO-2: analysis.test.ts line 98-99

- **Content**: `// TODO: Fix this test` / `// expect(result.data[0].members).toHaveLength(1)`
- **Root cause**: Same pattern as TODO-1
- **Fix**: Uncomment the assertion — mock data already includes 1 member
- **Confidence**: HIGH

### TODO-3: useChatStreaming.ts line 174

- **Content**: Commented-out retry block (same code block as TF-1 fix)
- **Root cause**: Retry logic disabled, same as TF-1
- **Fix**: Same fix as TF-1 — uncomment the retry infrastructure
- **Confidence**: HIGH — resolves both test failures and the TODO marker in one change

## Integration Test Scope

### IT-1: Chat send → stream → render pipeline

- **Path**: `useChatStreaming` hook → `ChatArea` component → `MessageBubble` render
- **Approach**: Render `ChatArea` with mock gateway, verify message appears after stream completes
- **Key files**: `src/hooks/useChatStreaming.ts`, `src/components/ChatArea.tsx`, `src/components/MessageBubble.tsx`

### IT-2: Knowledge entity search flow

- **Path**: `PersistedEntityTab` → `knowledge.ts` API → store → render
- **Approach**: Render entity tab with mock API, verify search results display
- **Key files**: `src/components/knowledge/PersistedEntityTab.tsx`, `src/api/knowledge.ts`

## Risk Assessment

- **Complexity**: LOW — all fixes are uncommenting existing code or updating snapshots
- **Breaking changes**: NONE — retry logic was always intended to exist
- **Regression risk**: LOW — test suite baseline is 879/882 passing; fixes add coverage without changing interfaces

## Scoring

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Feasibility | 9/10 | All fixes are uncommenting existing, tested code |
| Clarity | 9/10 | Root causes clearly identified with line references |
| Risk | 9/10 | No architectural changes, no interface changes |
| Impact | 8/10 | Achieves 0-failure baseline critical for Phase 2 |
| Testability | 9/10 | Tests already written for retry logic |
| Dependencies | 10/10 | No external dependencies, no cross-module coupling |

**Overall**: 9.0/10 — Go recommendation
