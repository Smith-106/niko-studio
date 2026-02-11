# Architecture Analysis Report

**Project**: niko-studio  
**Scope**: src/**/*.py (166 files, 62,163 lines)  
**Date**: 2026-02-09  

---

## Executive Summary

The niko-studio project demonstrates a well-structured layered architecture with clear separation of concerns. The codebase employs modern design patterns including Dependency Injection, Registry Pattern, and Protocol-based abstractions. However, there are coupling issues between layers that should be addressed to improve maintainability and testability.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 5 |
| **Total** | **10** |

---

## Architecture Overview

### Layer Structure

```
src/
├── agents/          # Agent Layer - LLM interaction, prompt building
├── memory/          # Memory Layer - Four-layer, six-dimensional memory
├── workflow/        # Workflow Engine - L1-L5 levels, adapters, session
│   ├── levels/      # Workflow level implementations
│   ├── adapters/    # Domain adapters (novel, code, knowledge)
│   └── session/     # Session management, resume strategy
├── services/        # Platform Services - backup, token, obsidian
├── graph/           # Knowledge Graph - Kuzu storage, queries
├── narrative/       # Narrative Evaluation - critic engine, analyzers
│   ├── analyzers/   # Tension, conflict, sensory analysis
│   └── evaluators/  # Character, voice, suspense evaluation
├── search/          # Search Services - vector, smart search
└── knowledge/services/  # LLM/Embedding Provider Abstraction
```

### Key Components

| Component | Path | Role |
|-----------|------|------|
| ServiceContainer | `src/container.py` | DI container with lazy loading |
| BaseAgent | `src/agents/base.py` | Agent abstraction + CCW 6-Field Protocol |
| WorkflowEngine | `src/workflow/workflow_engine.py` | L1-L5 task routing |
| BaseDomainAdapter | `src/workflow/adapters/base_adapter.py` | Domain-specific workflow |
| UnifiedMemoryEngine | `src/memory/unified_memory.py` | Four-layer memory management |

---

## Design Patterns Analysis

### Patterns Successfully Applied

1. **Dependency Injection (ServiceContainer)**
   - Centralized engine management
   - Lazy initialization
   - Mock injection for testing
   - Plugin system support

2. **Registry Pattern**
   - `AdapterRegistry` for domain adapters
   - `LevelRegistry` for workflow levels
   - Enables runtime extensibility

3. **Protocol/Interface Pattern**
   - `LLMService`, `EmbeddingService` protocols
   - `LLMProvider`, `EmbeddingProvider` protocols
   - Clean abstraction for multi-provider support

4. **Strategy Pattern**
   - Workflow levels (L1-L5) as interchangeable strategies
   - Domain adapters for novel/code/knowledge workflows

### Patterns Needing Improvement

1. **Factory Pattern**: Agent creation is scattered across workflow levels rather than centralized
2. **Facade Pattern**: MCP Gateway has too many direct dependencies

---

## Findings Detail

### HIGH Severity

#### ARCH-001: Workflow level directly instantiates Agent

**File**: `src/workflow/levels/level1_rapid.py:38`

```python
def execute(self, state: BaseState, **kwargs) -> BaseState:
    from ...agents.writer import WriterAgent
    writer = WriterAgent(name="rapid_writer")  # Direct instantiation
```

**Impact**: Tight coupling prevents testing workflow logic in isolation. Changes to WriterAgent constructor require changes in all workflow levels.

**Recommendation**: 
```python
def __init__(self, writer_agent: BaseAgent = None):
    self.writer = writer_agent or get_container().writer
```

---

#### ARCH-002: Multiple agent instantiations in workflow level

**File**: `src/workflow/levels/level3_standard.py:122,159,180`

Level3Standard creates new agent instances in each phase method:
- `_plan_phase`: `ArchitectAgent(name="standard_architect")`
- `_execute_phase`: `WriterAgent(name="standard_writer")`
- `_critic_phase`: `CriticAgent(name="standard_critic")`

**Impact**: No lifecycle management, no state sharing between phases, difficult to mock for testing.

**Recommendation**: Inject agents via constructor or resolve from ServiceContainer once during initialization.

---

### MEDIUM Severity

#### ARCH-003: Memory layer depends on Search layer

**File**: `src/memory/core_memory_store.py:9`

```python
from ..search.vector_search import VectorSearch
```

**Impact**: Creates horizontal dependency between peer modules. Changes to vector_search affect memory module.

**Recommendation**: Define `IVectorSearch` protocol in shared module, inject implementation.

---

#### ARCH-004: Service layer imports from Agent layer

**File**: `src/services/distill_service.py:28`

```python
from ..agents.base import BaseAgent
```

**Impact**: Services should be lower-level than agents. This creates an inverted dependency.

**Recommendation**: Extract reusable components (like Prompt Protocol) to a shared utility module.

---

#### ARCH-010: Duplicate CriticEngine implementations

**Files**: 
- `src/narrative/critic_engine.py`
- `src/narrative/evaluators/critic_engine.py`

**Impact**: Confusion about which implementation to use. Potential for divergent behavior.

**Recommendation**: Consolidate to single implementation or clearly document distinct responsibilities.

---

### LOW Severity

#### ARCH-005: Container properties return Any type

**File**: `src/container.py:139-223`

All engine properties return `Any`:
```python
@property
def memory(self) -> Any:  # No type safety
```

**Recommendation**: Define and use protocol types for type safety.

---

#### ARCH-006: Configuration loading mixed with DI container

**File**: `src/container.py:86-115`

Inline dataclass definitions and config loading inside container.

**Recommendation**: Extract to dedicated config module.

---

#### ARCH-007: BaseAgent handles too many responsibilities

**File**: `src/agents/base.py:83-311`

Combines: prompt construction, token counting, cost estimation, budget control, usage tracking.

**Recommendation**: Extract to separate utility classes (TokenCostEstimator, BudgetController).

---

#### ARCH-008: Inconsistent config type annotation

**File**: `src/workflow/adapters/base_adapter.py:149`

`get_default_config()` returns `BaseWorkflowConfig` but actually returns a dict literal.

**Recommendation**: Use TypedDict or dataclass for configuration.

---

#### ARCH-009: MCP Gateway imports from multiple layers

**File**: `src/mcp/gateway.py:34-58`

Imports from: container, workflow, knowledge.services, config (7+ imports from different layers).

**Recommendation**: Consider facade pattern to reduce direct dependencies.

---

## Dependency Graph

```
┌─────────────┐
│   CLI/MCP   │ ← Entry Points
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Container  │────▶│   Config    │
└──────┬──────┘     └─────────────┘
       │
       ├────────────────────────────────┐
       ▼                                ▼
┌─────────────┐                  ┌─────────────┐
│  Workflow   │─ ─ ─ ─ ─ ─ ─ ─ ─▶│   Agents    │ ← Coupling Issue
│   Engine    │                  │  (Writer,   │
│   Levels    │                  │   Critic)   │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       ▼                                ▼
┌─────────────┐                  ┌─────────────┐
│  Adapters   │                  │  Narrative  │
│  (Domain)   │                  │  Evaluators │
└──────┬──────┘                  └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Memory    │─ ─ ─│   Search    │ ← Coupling Issue
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Graph     │
│   Storage   │
└─────────────┘
```

---

## Strengths

1. **Clear Layer Separation**: Each layer has distinct responsibilities
2. **Plugin Architecture**: ServiceContainer supports plugin loading
3. **Extensibility**: Registry patterns allow runtime extension
4. **Protocol Abstractions**: LLM/Embedding services use clean protocols
5. **Consistent DTOs**: Dataclasses used throughout for data transfer

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| 1 | Inject agents into workflow levels via constructor/container |
| 2 | Define protocol types for ServiceContainer properties |
| 3 | Extract shared interfaces to break cross-layer dependencies |
| 4 | Consolidate duplicate CriticEngine implementations |
| 5 | Extract TokenCostEstimator from BaseAgent |

---

## Files Generated

- `D:/工作目录/niko-studio/.workflow/.review-module/dimensions/architecture.json`
- `D:/工作目录/niko-studio/.workflow/.review-module/reports/architecture-analysis.md`
