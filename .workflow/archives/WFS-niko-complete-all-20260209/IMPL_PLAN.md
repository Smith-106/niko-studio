# Implementation Plan: Niko Studio Completion

**Session**: WFS-niko-complete-all-20260209
**Created**: 2026-02-09
**Status**: Planning Complete

---

## 1. Overview

**Goal**: Complete all incomplete modules in Niko Studio project
**Scope**: Phase 8 (CLI), Phase 10 (Integration), Phase 15-17 (Writing Theory, AI Tools, Memory System)
**Estimated Effort**: 6 tasks, ~40 hours total

### Current Progress
| Layer | Progress | Status |
|-------|----------|--------|
| Core Agents | 92% | Commander/Writer/Critic/Architect complete |
| Services | 80% | TokenService/BackupManager implemented |
| Memory | 70% | DistillationManager/CitationManager implemented |
| Workflow | 65% | L1/L3 complete, L2/L4/L5 partial |
| CLI | 0% | Not started |
| Storage | 30% | Basic store_manager exists |

---

## 2. Task Groups by Priority

### P0 - Critical (Must Complete First)

#### IMPL-001: Memory System Layer Completion
- **Phase**: 17
- **Status**: Partially complete
- **Existing**: memory_manager.py, unified_memory.py, query_cache.py
- **Need**: memory_layers.py, temporal_memory.py, conflict_resolver.py, six_dimensional_memory.py
- **Effort**: 8 hours

#### IMPL-002: Writing Theory Integration Verification
- **Phase**: 15
- **Status**: Verify completeness
- **Existing**: fictional_dream/, suspense_analyzer.py, character_depth.py, evaluators/
- **Action**: Verify integration with Critic Agent, add missing connections
- **Effort**: 4 hours

### P1 - High Priority

#### IMPL-003: CLI Orchestration Layer
- **Phase**: 8
- **Status**: Not started
- **Need**: src/cli/__init__.py, src/cli/main.py, src/cli/commands/
- **Dependencies**: IMPL-001 (Memory system for session management)
- **Effort**: 10 hours

#### IMPL-004: AI Tools Layer
- **Phase**: 16
- **Status**: Not started
- **Need**: skill_enforcer.py, writing_hooks.py, context/providers.py, modes/
- **Dependencies**: IMPL-002 (Writing theory for hooks)
- **Effort**: 8 hours

#### IMPL-005: Integration Validation
- **Phase**: 10
- **Status**: Not started
- **Need**: End-to-end workflow tests
- **Dependencies**: IMPL-001, IMPL-002, IMPL-003, IMPL-004
- **Effort**: 6 hours

### P2 - Medium Priority

#### IMPL-006: Storage Unification
- **Phase**: 12
- **Status**: Not started
- **Need**: file_builder.py, json_file_builder.py
- **Dependencies**: IMPL-001 (Memory layer patterns)
- **Effort**: 4 hours

---

## 3. Dependency Graph

```
IMPL-001 (Memory) ─────┬───────────────────────────────────> IMPL-005 (Integration)
                       │                                          ↑
IMPL-002 (Writing) ────┼──> IMPL-004 (AI Tools) ─────────────────┘
                       │          ↑
                       ├──> IMPL-003 (CLI) ──────────────────────┘
                       │
                       └──> IMPL-006 (Storage)
```

---

## 4. Technical Approach

### Memory System (IMPL-001)
- Extend UnifiedMemoryEngine with dedicated layer managers
- Implement MemoryLayer enum handlers (ephemeral, session, user, project)
- Add MemoryDimension processors (timeline, context, character, worldview, preference, experience)
- Create standalone ConflictResolver module (extract from unified_memory.py)

### Writing Theory (IMPL-002)
- Verify all evaluators are connected to CriticAgent
- Ensure fictional_dream/ modules integrate with evaluation pipeline
- Add missing narrative analysis hooks

### CLI (IMPL-003)
- Use Click framework (consistent with Python ecosystem)
- Commands: init, run, chat, evaluate, export
- Session management with UnifiedMemoryEngine

### AI Tools (IMPL-004)
- SkillEnforcer: Validate skill execution against constraints
- WritingHooks: Pre/post processing for writing operations
- ContextProviders: Dynamic context injection for agents

---

## 5. Constraints

1. **Backward Compatibility**: Preserve existing Agent APIs
2. **OpenKL Compliance**: Follow file system contracts
3. **LangGraph Patterns**: Maintain workflow orchestration patterns
4. **Memory Interfaces**: Respect IDistillationService protocol

---

## 6. Quality Gates

- [ ] All existing tests pass
- [ ] New modules have >80% test coverage
- [ ] Type hints complete (mypy clean)
- [ ] Documentation updated

---

## 7. Files Reference

### Existing (DO NOT recreate)
- src/services/token_service.py
- src/services/backup_manager.py
- src/services/obsidian_service.py
- src/memory/distillation_manager.py
- src/memory/citation_manager.py
- src/memory/memory_manager.py
- src/memory/unified_memory.py
- src/config.py

### To Create
- src/memory/memory_layers.py
- src/memory/temporal_memory.py
- src/memory/conflict_resolver.py
- src/memory/six_dimensional_memory.py
- src/cli/__init__.py
- src/cli/main.py
- src/cli/commands/*.py
- src/skills/skill_enforcer.py
- src/hooks/writing_hooks.py
- src/context/providers.py
- src/workflow/modes/plan_act.py
- src/storage/file_builder.py
- src/storage/json_file_builder.py
