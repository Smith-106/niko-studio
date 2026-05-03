# TASK-001: Audit L4/L5/SessionManager state machines and document failure modes

## Changes
- `.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/audit-l4-l5.md`: created (200+ lines)

## Verification
- [x] audit-l4-l5.md exists at plan dir
- [x] Contains `## L4 Brainstorm State Machine` (line 16)
- [x] Contains `## L5 Coordinator Phase Machine` (line 51)
- [x] Contains `## SessionManager Isolation Guarantees` (line 96)
- [x] Contains `## Suspected Failure Modes` (line 171)
- [x] `grep -c 'level4-brainstorm.js:'` returns 8 (>=3)
- [x] `grep -c '^## '` returns 6 (>=4)

## Tests
- (no test commands defined in task spec)

## Deviations
- None. Doc structure matches the 5-section mandate (L4 / L5 / SessionManager / ResumeStrategy / Failure Modes). Added a 6th section "Inputs for downstream tasks" with hand-off pointers for TASK-002, TASK-005, TASK-008 — purely additive.

## Key Findings (for downstream)

### Phase 2 SC-blocking failure modes
1. **FM-1 + FM-2 (SC-1 no-hang):** `Level4Brainstorm.execute()` (level4-brainstorm.js:221) calls the **sync sequential** `generateArtifacts` (line 271), not the async parallel variant. `timeout_per_role: 60` (line 258) is read into a local at line 273 then never used. One slow role hangs the whole 5-round chain.
2. **FM-3 (SC-2 resume-clean):** `executeChain` mutates `currentUnitIndex` and `overallProgress` in memory only (level5-coordinator.js:538-539). `persistState` is called at phase boundaries (lines 402/408/414/429/440) but **not between units**. Mid-chain crash → resume re-runs from unit 0.
3. **FM-5 (SC-3 isolation):** `_executeAnalyze` (level5-coordinator.js:698) uses the default analysis retriever built from `process.cwd()` (level5-coordinator.js:39-52). Two parallel L5 sessions share the same graph-manager (Phase 1 singleton).

### Non-blocking but documented (carry to M3)
- FM-4: SessionManager `_appendSnapshotIndex` (session-manager.js:348) is read-modify-write — race window on concurrent same-session writes
- FM-6: `.native_mapping.json` deletion silently degrades to concat fallback (resume-strategy.js:140-149)
- FM-7: `HybridStrategy.saveCheckpoint` only writes via concat strategy (resume-strategy.js:386) — native cannot resume after hybrid-only run

### Architectural notes for harness designer (TASK-002)
- L4 has **no internal state machine for rounds** — the 5-round semantic lives in the caller. Harness must drive the loop itself with accumulating `state.context`.
- L5 phase machine is `init → analyzing → planning → executing → completed|failed`. No "paused" phase — interrupt = process kill, resume = `_tryResume` reads disk.
- L5 does **not** use ResumeStrategy classes. ResumeStrategy is for chain-orchestration above L5. Harness for L5 mid-phase resume must exercise `loadState` (level5-coordinator.js:595), not `HybridStrategy.resume`.
- SessionManager.init failure is swallowed (level5-coordinator.js:381-388) → harness must assert session dir created, not just rely on `init()` return.

### Fix-candidate ranking (input to TASK-005)
1. **Easy + high impact:** Switch `execute()` line 221 to `await this.generateArtifactsAsync(...)` and wrap each `_analyzeAsRoleAsync` in `Promise.race([analyze(), timeout(timeoutPerRole*1000)])`. Closes FM-1 + FM-2.
2. **Medium + high impact:** Add `await this.persistState(this._coordinatorState)` inside the unit loop in `executeChain` (after each unit completes/fails). Closes FM-3.
3. **Larger + high impact:** Make `_analysisRetriever` per-session instead of constructor-default. Closes FM-5.

## Notes for downstream tasks
- **TASK-002:** Audit tables map directly to fixture inputs. See "Inputs for downstream tasks" section at the bottom of audit-l4-l5.md.
- **TASK-005:** Fix-candidate ranking already prioritized — start with FM-1/FM-2 (smallest patch, biggest SC win).
- **TASK-008:** FM-4, FM-6, FM-7 should be added to the M3 known-issues registry.
