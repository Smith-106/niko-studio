# M5 Phase 1 Context — Decisions & Constraints

## Locked Decisions (cannot change)

1. **Retry logic must be restored** — useChatStreaming.ts retry infrastructure (StreamErrorPayload, isStreamErrorPayload, retry loop) was designed and tested but commented out. Must uncomment, not rewrite.
2. **Snapshot updates are acceptable** — M4 legitimately changed Sidebar rendering. Updating snapshot is correct, not a code fix.
3. **analysis.test.ts assertions are valid** — Mock data already contains the fields being asserted. TODOs were premature comments, not missing implementations.
4. **Integration tests use mock gateway** — No real backend calls. Tests verify component wiring, not API correctness.

## Free Decisions (plan decides)

1. **Task grouping** — Whether to combine TASK-1.1 + TASK-1.4 (same file, same fix) into a single task or keep separate
2. **Integration test file location** — New test files in `src/` alongside existing tests vs dedicated integration directory
3. **Anti-pattern scan scope** — Whether to scan entire `src/` or focus on files touched by M3/M4

## Deferred Decisions (post-Phase 1)

1. **Custom retry strategy** — Exponential backoff, jitter, etc. (current implementation uses simple retry with max 2)
2. **Snapshot testing strategy** — Whether to move from snapshot to explicit assertions for Sidebar
3. **Test coverage thresholds** — Whether to enforce minimum coverage percentages

## Implementation Scope

### Must-fix (Phase 1 blockers)
- `src/hooks/useChatStreaming.ts`: Uncomment lines 29-43, 74-75, 174-183
- `src/components/Sidebar.test.tsx`: Update snapshot
- `src/api/analysis.test.ts`: Uncomment lines 48-49, 98-99

### Must-add (Phase 1 requirements)
- Integration test: chat send → stream → render
- Integration test: knowledge entity search
- Anti-pattern scan results documented or resolved

### Gray Areas
- None identified — all items have clear root causes and fixes
