## Summary
Collapsed duplicated integration-adapter ownership so ServiceContainer now explicitly creates the shared bundle and passes it into MemoryEngineAdapter/SearchEngineAdapter, while UnifiedMemoryEngine no longer defines its own reduced adapter factory.

## Files Modified
- `src-ts/container/ServiceContainer.ts`
- `src-ts/container/adapters.ts`
- `src-ts/memory/unified-memory.ts`

## Key Decisions
- Kept `src-ts/integrations/adapters.ts` as the single bundle factory and made ServiceContainer an explicit consumer.
- Preserved direct-constructor behavior for `SearchEngineAdapter` by supporting optional injected bundles rather than forcing all callers through the container.
- Removed duplicate adapter typing/factory logic from `UnifiedMemoryEngine` but preserved public type exports expected by `memory/index.ts`.

## Tests
- `npm --prefix src-ts run test -- tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/container/search-engine-adapter.default-constructor.test.ts tests/container/ServiceContainer.test.ts`
- `npm --prefix src-ts run typecheck`
