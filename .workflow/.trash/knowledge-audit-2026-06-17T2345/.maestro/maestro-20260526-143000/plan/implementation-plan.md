# Niko-Studio Performance Optimization Implementation Plan

## Overview

Based on the comparative analysis with maestro-flow, this plan addresses 15 optimization points across 4 phases. Each task includes specific file targets, line references, and expected outcomes.

---

## Phase 1: Quick Wins (1-2 days)

### Task 1.1: Fix InMemoryRateLimiter Memory Leak
- **File**: `src-ts/mcp/rate-limiter.ts`
- **Problem**: Map entries grow unbounded; cleanup only every 60s
- **Changes**:
  1. Add LRU eviction with `maxEntries` cap (default 10000)
  2. Replace fixed-window with sliding-window algorithm
  3. Add `setInterval(...).unref()` to prevent keeping process alive
  4. Cleanup on each `check()` call for expired entries (amortized, not just interval)
- **Test**: Add memory-growth test under sustained load
- **Risk**: Low — isolated module, no downstream API changes

### Task 1.2: Empty Catch Block Remediation
- **Scope**: 202 empty catch blocks across 84 files
- **Changes**:
  1. Add ESLint rule `no-empty: ["error", { "allowEmptyCatch": false }]` with custom formatter
  2. Script: auto-replace `catch (e) {}` → `catch (e) { logger.warn("...", e) }`
  3. For hot-path hooks (PostToolUse patterns from maestro-flow), add `// intentional: <reason>` comment
  4. Introduce domain error hierarchy: `WorkflowError`, `MemoryError`, `SearchError` extending base `NikoError`
- **Test**: Verify no behavioral change (catches still caught, just logged)
- **Risk**: Low — additive logging only

### Task 1.3: Atomic File Writes
- **Files**: `src-ts/memory/memory-manager.ts`, `src-ts/workflow/workflow-engine-core.ts`
- **Pattern** (from maestro-flow): `writeFileSync(path + '.tmp', data); renameSync(path + '.tmp', path)`
- **Changes**:
  1. Create utility `src-ts/utils/atomic-write.ts` with `atomicWriteSync(path, data)` and `atomicWriteFile(path, data)` (async)
  2. Replace critical write calls in MemoryManager and WorkflowEngine
- **Test**: Test crash-safety (write .tmp, simulate crash, verify original intact)
- **Risk**: Low — renameSync is atomic on most filesystems

---

## Phase 2: Core Performance (3-5 days)

### Task 2.1: MemoryManager Async I/O Migration
- **File**: `src-ts/memory/memory-manager.ts` (~870 lines)
- **Current State**: 20+ synchronous fs calls blocking the event loop
- **Migration Strategy** (3 sub-steps):

  **Step A — Interface extraction**:
  1. Extract `IMemoryStore` interface from MemoryManager with async methods:
     ```typescript
     interface IMemoryStore {
       add(memory: Memory): Promise<string>;
       get(id: string): Promise<Memory | null>;
       getBatch(ids: string[]): Promise<Memory[]>;
       search(query: SearchQuery): Promise<Memory[]>;
       update(id: string, updates: Partial<Memory>): Promise<void>;
       delete(id: string): Promise<void>;
       rebuildIndex(): Promise<void>;
     }
     ```
  2. Current file-based implementation becomes `FsMemoryStore implements IMemoryStore`

  **Step B — SQLite-backed store** (leveraging existing `better-sqlite3` dependency):
  1. Create `src-ts/memory/sqlite-memory-store.ts`
  2. Schema: `memories` table (id, content JSON, embedding BLOB, metadata JSON, timestamps)
  3. FTS5 virtual table for text search
  4. WAL mode + `busy_timeout=5000` (maestro-flow pattern)
  5. Batch operations use transactions

  **Step C — Auto-selection** (maestro-flow dual-backend pattern):
  1. `createMemoryStore()` detects SQLite availability, returns SqliteMemoryStore if available, FsMemoryStore fallback
  2. Wire into ServiceContainer via `ServiceTypes.MemoryStore`

- **Expected**: 5-10x throughput improvement in I/O-bound scenarios
- **Risk**: Medium — interface change propagates to adapters, but DI isolates impact

### Task 2.2: QueryEmbeddingCache Lock Optimization
- **File**: `src-ts/memory/query-cache.ts`
- **Current**: Global `async-lock` serializes all getAsync/putAsync calls
- **Changes**:
  1. Replace `async-lock` with per-key `Promise` caching (stale-while-revalidate):
     ```typescript
     private pending = new Map<string, Promise<Float32Array>>();
     async getAsync(key: string): Promise<Float32Array | null> {
       if (this.cache.has(key)) return this.cache.get(key)!;
       if (this.pending.has(key)) return this.pending.get(key)!;
       const p = this.computeEmbedding(key)
         .finally(() => this.pending.delete(key));
       this.pending.set(key, p);
       return p;
     }
     ```
  2. Add LRU eviction with max size (prevent unbounded growth)
  3. Add TTL support (stale entries refresh in background)
- **Expected**: 3-5x concurrent lookup throughput
- **Risk**: Low — internal cache implementation change, external API unchanged

### Task 2.3: WorkflowEngine DI Compliance
- **File**: `src-ts/workflow/workflow-engine-core.ts`
- **Problem**: `_runGenerateDraft()` creates new `OpenAILLMProvider` per call
- **Changes**:
  1. Inject `ILLMService` via constructor (already available in ServiceContainer)
  2. Replace `new OpenAILLMProvider(config)` with `this.llmService.generateText()`
  3. Remove direct provider imports from engine file
- **Expected**: Connection reuse + consistency with rest of codebase
- **Risk**: Low — using existing DI service

---

## Phase 3: Reliability (3-5 days)

### Task 3.1: WorkflowEngine State Persistence
- **File**: `src-ts/workflow/workflow-engine-core.ts` (1737 lines)
- **Current**: Plans in `Map<string, WorkflowPlan>`, checkpoints in `Map<string, Checkpoint>`
- **Migration Strategy**:

  **Step A — Interface extraction**:
  ```typescript
  interface IWorkflowStateStore {
    savePlan(plan: WorkflowPlan): Promise<void>;
    loadPlan(planId: string): Promise<WorkflowPlan | null>;
    listPlans(): Promise<WorkflowPlan[]>;
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    loadCheckpoint(planId: string): Promise<Checkpoint | null>;
    deletePlan(planId: string): Promise<void>;
  }
  ```

  **Step B — InMemoryWorkflowStateStore** (zero-risk first step):
  1. Move Map-based logic behind the interface
  2. Engine uses interface, not Maps directly
  3. Tests pass with no behavior change

  **Step C — SqliteWorkflowStateStore**:
  1. Plans and checkpoints serialized as JSON in SQLite
  2. Event sourcing: append-only JSONL for step execution events (maestro-flow pattern)
  3. WAL mode for concurrent reads

  **Step D — Auto-selection** in ServiceContainer

- **Expected**: Crash recovery + production reliability
- **Risk**: Medium — requires careful state migration, but interface isolates risk

### Task 3.2: Structured Logging Unification
- **Scope**: 391 console.log/warn/error calls across 48 files
- **Changes**:
  1. Add ESLint rule `no-console` (warn level) in production config
  2. Create migration script: `console.log/warn/error` → `logger.info/warn/error`
  3. Priority files (most occurrences): memory-manager.ts (11), distillation-manager.ts (11), citation-manager.ts (11)
  4. Add child logger context: `createLogger('memory')`, `createLogger('workflow')`
- **Expected**: Production observability + log aggregation compatibility
- **Risk**: Low — logging is side-effect-only

### Task 3.3: Streaming Retry Mechanism
- **File**: `src-ts/services/llm-service.ts` (line ~348)
- **Current**: `stream()` explicitly skips retry; transient error = total failure
- **Changes**:
  1. Add `StreamRetryPolicy` with max attempts (default 2) + exponential backoff
  2. On retryable error (network timeout, 429, 5xx): reconnect stream with last-received offset
  3. Emit `retry` event to consumer for transparency
  4. Non-retryable errors (4xx except 429, auth): fail immediately
- **Expected**: Stream reliability improvement, especially on unstable connections
- **Risk**: Medium — requires careful stream state management

---

## Phase 4: Engineering Maturity (3-5 days)

### Task 4.1: Configuration Centralization
- **New file**: `src-ts/config/index.ts`
- **Pattern** (from maestro-flow): Three-layer merge + Zod validation
  ```typescript
  const ConfigSchema = z.object({
    gateway: z.object({ port: z.number().default(3210), host: z.string().default('localhost') }),
    memory: z.object({ backend: z.enum(['sqlite', 'fs']).default('sqlite') }),
    workflow: z.object({ persistence: z.enum(['sqlite', 'memory']).default('sqlite') }),
    llm: z.object({ defaultProvider: z.string(), retryAttempts: z.number().default(3) }),
    logging: z.object({ level: z.enum(['debug','info','warn','error']).default('info') })
  });
  ```
- **Merge order**: defaults < `~/.niko/config.json` < `.niko/config.json` < env vars
- **Risk**: Low — additive, no existing code breaks

### Task 4.2: Hook/Plugin System
- **New file**: `src-ts/core/hooks.ts`
- **Pattern** (from maestro-flow): 87-line tapable-inspired engine
  ```typescript
  class SyncHook<T> { tap(name, fn); call(arg: T); }
  class AsyncSeriesHook<T> { tapPromise(name, fn); promise(arg: T); }
  class AsyncSeriesBailHook<T, R> { tapPromise(name, fn); promise(arg: T): Promise<R|undefined>; }
  ```
- **Lifecycle hooks** (initial set):
  - `beforeWorkflowStart`, `afterWorkflowStep`, `onWorkflowError`
  - `beforeMemoryAdd`, `afterMemorySearch`
  - `beforeLLMCall`, `afterLLMCall`
- **Risk**: Low — new system, no existing code forced to use it

### Task 4.3: JSONL Logging + Rotation
- **Extension of**: `src-ts/logger/index.ts`
- **Pattern** (from maestro-flow):
  - Append-only JSONL file output
  - `tailLast()` reads only last 64KB for large files
  - Rotation by ISO week (`rotateIfLarge()`)
- **Risk**: Low — extending existing logger

### Task 4.4: Connection Pool Hardening
- **File**: `src-ts/db/pool.ts`
- **Changes**: Replace `_pool` private field access with `pg.Pool` public API
- **Risk**: Low — using documented API

### Task 4.5: Lazy Initialization Systematization
- **Pattern**: DI container lazy binding + module-level cache decorators
- **Risk**: Low — additive performance optimization

### Task 4.6: HybridSearch Concurrency Safety
- **File**: `src-ts/search/hybrid-search.ts`
- **Changes**: Make strategies array immutable; `addStrategy`/`removeStrategy` return new instance
- **Risk**: Low — internal change, API signature may need minor update

---

## Execution Metrics

| Phase | Tasks | Estimated Days | Key Metrics |
|-------|-------|----------------|-------------|
| Phase 1 | 3 | 1-2 | RateLimiter memory stable, 202 catches logged, atomic writes |
| Phase 2 | 3 | 3-5 | MemoryManager async, cache throughput 3-5x, DI compliance |
| Phase 3 | 3 | 3-5 | Workflow persistence, 391 console→logger, stream retry |
| Phase 4 | 6 | 3-5 | Central config, hooks, JSONL logs, pool, lazy, search |
| **Total** | **15** | **10-17** | |

## Verification Checkpoints

- After Phase 1: `npm test` passes + rate-limiter stress test stable
- After Phase 2: MemoryManager benchmark shows async improvement + no regression
- After Phase 3: Gateway restart preserves workflow state + logs structured
- After Phase 4: All new patterns have test coverage + documentation
