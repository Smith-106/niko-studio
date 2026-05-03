# M2 — Intelligence & Extensibility

**Status:** ✅ Complete
**Closed:** 2026-05-03
**Audit Verdict:** PASS (9 artifacts, 20/20 tasks, 12/12 SCs)

---

## What Shipped

### Phase 1: Semantic Search, Skill CRUD & Rich Attachments
- **VectorSearch DI wiring** — GraphManager accepts optional VectorSearch via `setVectorSearch()`, embedding entities on create/update/delete with fire-and-forget graceful degradation
- **Hybrid semantic search** — `searchEntities()` upgraded from keyword-only to hybrid (FTS5 + vector RRF fusion) as a transparent backend change; frontend consumers unchanged
- **Drag-drop attachments** — Composer accepts image/document drops with preview chips and remove action
- **Skill Tab CRUD** — Full create/edit/rename/delete with confirmation dialogs
- **Tech debt cleanup** — `retryCountRef` removed, `StreamErrorPayload` properly typed

### Phase 2: L4/L5 Workflow Hardening
- **L4 parallel artifact generation** — Fixed sequential bottleneck → 5x speedup (37500ms → 7534ms) with `Promise.race` per-role timeout
- **L5 cascade stress testing** — 3-step command chain end-to-end verified, clean resume from mid-chain checkpoint confirmed
- **Concurrent session isolation** — Two parallel L4 sessions on shared project verified no cross-session data leaks
- **Stress test harness** — Reusable `createMockContainer`, `withTimeout`, `validateNoUnhandledRejections` foundation

## Test Baseline

| Suite | Count | Status |
|-------|-------|--------|
| Frontend | 860/860 | Baseline preserved |
| Sidecar | 2334/2338 | 0 new failures (3 pre-existing + 1 environmental) |

## Known Deferrals

| Item | Severity | Detail |
|------|----------|--------|
| ISS-20260502-066 | low | L5 mid-executeChain interrupt edge case → M3 backlog |
| HV-001 | low | Manual fastembed e2e test in build with model available |
| REV-005 F-001 | minor | Dead `renameSkill` import in SkillTab.tsx — 1-line cleanup |

## Key Learnings

1. Inject optional ML services via method injection, not constructor coupling — fire-and-forget embedding preserves core CRUD paths
2. Transparent backend upgrades (same API shape, internal hybrid search) avoid breaking consumer contracts
3. Build reusable stress harness before workflow-specific tests — DRY investment scales across L4/L5/L6+
4. Verify parallelism configs are actually used in hot loops, not just documented
5. Smoke + env-gated e2e tiers for optional ML dependencies prevent false CI failures
6. Track exact test counts at phase boundaries for reliable regression classification
