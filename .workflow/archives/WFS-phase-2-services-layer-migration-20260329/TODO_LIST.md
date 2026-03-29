# Tasks: Phase 2 Services Layer Migration

## Services Migration (IMPL-007 to IMPL-010)

- [x] **IMPL-007**: Migrate DistillService to TypeScript → [📋](./.task/IMPL-007.json) | [✅](./.summaries/IMPL-007-summary.md)
- [x] **IMPL-008**: Migrate LLMService to TypeScript → [📋](./.task/IMPL-008.json) | [✅](./.summaries/IMPL-008-summary.md)
- [x] **IMPL-009**: Migrate EmbeddingService to TypeScript → [📋](./.task/IMPL-009.json) | [✅](./.summaries/IMPL-009-summary.md)
- [x] **IMPL-010**: Migrate KnowledgeService to TypeScript → [📋](./.task/IMPL-010.json) | [✅](./.summaries/IMPL-010-summary.md)

## Search Migration (IMPL-011 to IMPL-013)

- [x] **IMPL-011**: Migrate SmartSearch to TypeScript → [📋](./.task/IMPL-011.json) | [✅](./.summaries/IMPL-011-summary.md)
- [x] **IMPL-012**: Migrate HybridSearch to TypeScript → [📋](./.task/IMPL-012.json) | [✅](./.summaries/IMPL-012-summary.md)
- [x] **IMPL-013**: Migrate VectorSearch to TypeScript → [📋](./.task/IMPL-013.json) | [✅](./.summaries/IMPL-013-summary.md)

## Integration & Testing (IMPL-014 to IMPL-015)

- [x] **IMPL-014**: Register services to DI Container → [📋](./.task/IMPL-014.json) | [✅](./.summaries/IMPL-014-summary.md)
- [x] **IMPL-015**: Migrate service tests to vitest → [📋](./.task/IMPL-015.json) | [✅](./.summaries/IMPL-015-summary.md)

## Future Phases (Not in Current Session)

- [ ] **Phase 3**: Domain Logic Migration (agents/ 5,507行, workflow/ 13,890行, narrative/ 14,985行)
- [ ] **Phase 4**: Data Layer Migration (memory/ 9,401行, graph/ 1,717行, store/ 1,773行)
- [ ] **Phase 5**: Integration (Eliminate sidecar proxy, direct TypeScript backend)

## Status Legend

- `- [ ]` = Pending task
- `- [x]` = Completed task

## Execution Order

### Services First (Lower Dependencies)
1. IMPL-007: DistillService (core utility, minimal deps)
2. IMPL-008: LLMService (protocol implementation)
3. IMPL-009: EmbeddingService (protocol implementation)
4. IMPL-010: KnowledgeService (depends on LLM + Embedding)

### Search Second (Depends on Embedding)
5. IMPL-011: SmartSearch (implements SearchInterface)
6. IMPL-012: HybridSearch (combines multiple searches)
7. IMPL-013: VectorSearch (vector database integration)

### Integration Last
8. IMPL-014: DI Container registration
9. IMPL-015: Test migration

## Progress Tracking

- **Total Tasks**: 9 (Services: 4, Search: 3, Integration: 2)
- **Completed**: 9
- **In Progress**: 0
- **Pending**: 0
- **Estimated Time**: 2-3 weeks for Phase 2

## Dependencies

- IMPL-008, IMPL-009 depend on IMPL-007 (distill utilities)
- IMPL-010 depends on IMPL-008, IMPL-009 (knowledge uses LLM + embedding)
- IMPL-011, IMPL-012, IMPL-013 depend on IMPL-009 (search uses embedding)
- IMPL-014 depends on IMPL-007 to IMPL-013 (all services)
- IMPL-015 depends on IMPL-014 (DI registration first)

## Quality Gates

### Services Migration Gates
- [ ] Each service implements corresponding protocol interface
- [ ] TypeScript strict mode passing
- [ ] Unit tests migrated to vitest (coverage >= Python version)
- [ ] Python backend remains functional

### Integration Gates
- [ ] All services registered in DI container
- [ ] Lazy initialization working
- [ ] Mock injection for testing
- [ ] Dual runtime validated
