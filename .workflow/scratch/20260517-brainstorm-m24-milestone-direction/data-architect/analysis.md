# Data Architect Analysis: M24 Milestone Direction

## Role Perspective Overview

M24 targets structural data improvements across Niko Studio's backend and frontend layers. The current architecture embeds large static datasets (craft-catalog 1584 lines, translations 2892 lines) directly in TypeScript source, mixes state management with orchestration logic (workflow-engine 1970 lines), and lacks formal schema evolution governance. This analysis addresses data model design, storage strategy, migration paths, and backward compatibility for each feature.

## Feature Point Index

| Feature | Analysis File | Key Decisions |
|---------|--------------|---------------|
| F-001 Narrative Analysis Data Pipeline | [analysis-F-001-narrative-pipeline.md](./analysis-F-001-narrative-pipeline.md) | Score schema versioning, analyzer output normalization |
| F-002 Knowledge System Data Model | [analysis-F-002-knowledge-model.md](./analysis-F-002-knowledge-model.md) | Entity graph schema, rule storage format |
| F-003 Session State Persistence | [analysis-F-003-session-state.md](./analysis-F-003-session-state.md) | Snapshot format, resume metadata contract |
| F-004 Translation Externalization | [analysis-F-004-translations.md](./analysis-F-004-translations.md) | Module boundary, key namespace, hot-reload |
| F-005 Craft Catalog Externalization | [analysis-F-005-craft-catalog.md](./analysis-F-005-craft-catalog.md) | JSON vs YAML, versioning, hot-reload strategy |
| F-006 Workflow Engine Decomposition | [analysis-F-006-workflow-engine.md](./analysis-F-006-workflow-engine.md) | State machine data model, event sourcing |
| F-007 Configuration Data Model | [analysis-F-007-config-model.md](./analysis-F-007-config-model.md) | Layered config schema, validation strategy |
| F-008 Frontend-Backend Data Contract | [analysis-F-008-data-contract.md](./analysis-F-008-data-contract.md) | API schema typing, contract versioning |

## Cross-Cutting Concerns

See [analysis-cross-cutting.md](./analysis-cross-cutting.md)

## Key Recommendations

1. Adopt a unified schema version header (`$schema_version`) across all persisted JSON artifacts to enable forward-compatible readers.
2. Externalize craft-catalog to JSON (not YAML) with TypeScript type generation at build time — preserves type safety while enabling hot-reload.
3. Introduce namespace-scoped translation keys (`module.component.key`) with per-module JSON files loaded on demand.
4. Decompose workflow-engine state into a formal state machine with event log, separating orchestration logic from state transitions.
5. Establish a data contract registry (TypeScript interfaces + JSON Schema) for all frontend-backend boundaries.
