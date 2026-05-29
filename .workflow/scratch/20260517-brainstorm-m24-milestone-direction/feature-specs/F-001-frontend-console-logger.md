# F-001: Frontend Console Logger Migration

## 1. Requirements Summary

The frontend MUST migrate all 17 files containing direct `console.*` calls to a unified LogService interface. The LogService MUST support runtime level switching, structured JSON output, and production-environment auto-suppression. This migration MUST NOT alter any user-visible behavior.

## 2. Design Decisions [CORE]

### Architecture: Singleton LogService with React Context

The LogService follows the backend's existing structured logger pattern. A singleton instance is created at app initialization and injected via React Context for component access, with a direct import path for non-component code (hooks, services).

**Why singleton over per-module instances**: The frontend has a single execution context (renderer process). A singleton simplifies level management and output routing. The React Context wrapper enables testing isolation.

**LogService Interface** (from system-architect cross-cutting):
```typescript
interface LogService {
  debug(tag: string, message: string, meta?: Record<string, unknown>): void;
  info(tag: string, message: string, meta?: Record<string, unknown>): void;
  warn(tag: string, message: string, meta?: Record<string, unknown>): void;
  error(tag: string, message: string, error?: Error, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
}
```

**Production behavior**: In production builds, `debug` and `info` calls are no-ops (zero overhead via build-time dead code elimination or runtime level check). `warn` and `error` always emit.

**Tag convention**: `module.component` format (e.g., `api.chat`, `hooks.editorAI`, `services.revision`).

### Migration Strategy: File-by-File Replacement

Each of the 17 files receives a mechanical transformation:
1. Import `logger` from the LogService module
2. Replace `console.log` → `logger.info(TAG, ...)`
3. Replace `console.warn` → `logger.warn(TAG, ...)`
4. Replace `console.error` → `logger.error(TAG, ..., error)`
5. Remove any `// eslint-disable-next-line no-console` comments

**Files in scope** (17):
- `api/chat.ts`, `api/core.ts`, `api/gateway/models.ts`
- `components/knowledge/PersistedEntityTab.tsx`, `components/knowledge/SkillTab.tsx`
- `components/StoryBiblePanel.tsx`
- `hooks/useEditorAI.ts`, `hooks/useEvaluationData.ts`
- `services/revisionOrchestrator.ts`
- `utils/export-edge.test.ts` (test file — use test logger mock)
- 7 test files (use vi.mock or test logger)

## 3. Interface Contract

```typescript
// Public API — MUST NOT change after M24
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface Logger {
  debug(tag: string, msg: string, meta?: Record<string, unknown>): void;
  info(tag: string, msg: string, meta?: Record<string, unknown>): void;
  warn(tag: string, msg: string, meta?: Record<string, unknown>): void;
  error(tag: string, msg: string, err?: Error, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}
```

## 4. Constraints & Risks

- **Risk**: Test files using `console.error` for assertion verification → use `vi.spyOn(logger, 'error')` instead
- **Constraint**: MUST NOT introduce new dependencies (use native console under the hood)
- **Constraint**: Production bundle size increase MUST be < 1KB

## 5. Acceptance Criteria

- [ ] Zero `console.*` calls in non-test source files
- [ ] LogService supports runtime level switching
- [ ] Production build suppresses debug/info output
- [ ] All existing tests pass without modification (or with minimal mock updates)
- [ ] Structured output format: `{ timestamp, level, tag, message, meta? }`

## 6. Detailed Analysis References

- @system-architect/analysis-F-001-frontend-console-logger.md — LogService interface design, shared infrastructure
- @product-manager/analysis-F-001-frontend-console-logger.md — Priority justification, user stories
- @data-architect/analysis-F-001-narrative-pipeline.md — Score schema context

## 7. Cross-Feature Dependencies

- **Produces**: LogService module (consumed by F-002 split components, F-007 visualization)
- **Depends on**: None (first in execution order)
- **EP-004 applied**: Observability metric `frontend.log.volume` counter
