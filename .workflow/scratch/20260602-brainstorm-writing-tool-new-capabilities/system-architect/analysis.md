# System Architect Analysis — Writing Tool New Capabilities

> Contract: guidance-specification.md `4 (decisions SA-01 through SA-07)
> Owns: MCP endpoint architecture, Knowledge Engine extension, Co-Writing Engine pipeline, Reader Simulation dual-engine, Quality Control constraint tiers, Multi-Modal operation semantics, context window management
> Does not own: UI layout and interaction patterns (UX Expert), persona definitions and quality dimensions (SME), delivery priority and MVP scope (PM), test strategy (Test Strategist)

## 1. Role Mandate (<= 200 words)

The System Architect decides how the three new AI-driven capabilities — Co-Writing Engine, Reader Simulation, and Multi-Modal Story Intelligence — integrate into the existing niko-studio architecture. The mandate covers: extending the Knowledge Engine into a Story Bible, designing the shared context pipeline for three co-writing modes, defining the parallel dual-engine for reader simulation, establishing the two-tier quality control mechanism, and specifying operation semantics for future multi-modal expansion. All new capabilities MUST be exposed through MCP endpoints per SA-01. The architect defers UI/UX decisions to the UX Expert role, product prioritization to PM, and domain-specific quality criteria to SME. The architecture MUST reuse existing services (Craft Analysis, Revision Protocol, Session Intelligence, Narrative Visualization) rather than building parallel systems.

## 2. Decision Digest

### Decisions
| ID | Feature | Stance | Constraints (RFC 2119) |
|----|---------|--------|------------------------|
| SA-01 | cross-cutting | MCP endpoints as unified integration surface | All new capabilities MUST be exposed through MCP endpoints following existing registration pattern; no direct service-to-frontend calls |
| SA-02 | F-001 | Extend existing KnowledgeEngine for Story Bible | New entity types (CharacterProfile, WorldRule, PlotThread, TimelineEvent) MUST extend KE schema; MUST NOT create a parallel knowledge store |
| SA-03 | F-002, F-003, F-004 | Three-mode shared context pipeline | Co-Writing Engine MUST implement Context Scraper -> Prompt Assembler -> Model Router -> Output Aggregator -> Post-Processing; all three modes MUST share this pipeline |
| SA-04 | F-005 | Parallel dual-engine for reader simulation | Reader personas and editorial analysis MUST execute concurrently; neither engine MAY block the other |
| SA-05 | F-007 | Two-tier constraint system for quality | Hard constraints from Craft Analysis Services MUST be enforced; soft constraints from creativity spectrum SHOULD be advisory |
| SA-06 | F-008 | Text-first operation semantics for multi-modal | Operation semantics (filter, lasso, perspective shift) MUST be defined for text targets first; visual extension MAY follow when image generation is added |
| SA-07 | cross-cutting | Shrink Ray automatic context summarization | Context window management MUST implement automatic summarization for chapters beyond the current context window; the system SHOULD retain chapter linkage metadata after summarization |

### Interfaces
| Name | Contract | Consumers |
|------|----------|-----------|
| MCP Story Bible API | `GET/POST /mcp/story-bible/{entity_type}` with typed schemas (CharacterProfile, WorldRule, PlotThread, TimelineEvent) | Co-Writing Engine, Reader Simulation, Multi-Modal Intelligence |
| MCP Co-Writing API | `POST /mcp/co-writing/{mode}` with mode in {auto, guided, directed}; request body includes context_scope, creativity_level, instruction (directed only) | Writing Workspace frontend |
| MCP Reader Simulation API | `POST /mcp/reader-simulation/run` with persona_ids, chapter_range, dimensions[]; returns per-persona + consensus report | Narrative Visualization frontend |
| MCP Quality Control API | `POST /mcp/quality-control/check` with text_segment, constraint_tier; returns violation list + scores | Co-Writing Engine (post-processing), Reader Simulation (editorial engine) |
| Context Pipeline internal | `ContextScraper -> PromptAssembler -> ModelRouter -> OutputAggregator -> PostProcessor` typed pipeline with async stages | Co-Writing Engine modes (Auto, Guided, Directed) |
| Story Bible Auto-Extract | `POST /mcp/story-bible/extract` with manuscript_segment, entity_types[]; returns extracted entities with confidence scores | Story Bible management UI |

### Cross-Cutting Positions
| Topic | Stance |
|-------|--------|
| Data Model | Story Bible extends KE with four core entity types; relationships use existing KE edge schema; all entities carry confidence_score and source_chapter metadata |
| State Machine | Co-Writing session lifecycle: idle -> context_gathering -> generating -> review -> applied; each mode enters generating state with mode-specific transition logic |
| Error Handling | Classified into transient (model timeout, rate limit) and permanent (invalid SB data, constraint violation); transient errors MUST retry with exponential backoff; permanent errors MUST surface to user with diagnostic metadata |
| Observability | Pipeline latency per stage, model routing distribution, SB hit rate, quality violation frequency, context window utilization — all MUST emit structured metrics |
| Configuration | Creativity defaults per mode, model routing rules, summarization thresholds, quality constraint thresholds — all SHOULD be configurable via MCP config endpoints |
| Boundary Scenarios | Concurrent co-writing requests from same session MUST serialize; reader simulation engine failure MUST NOT crash editorial engine; context summarization MUST preserve entity references; shutdown MUST flush in-progress generation to draft state |

### Findings Summary
| Slug | Title | Impact |
|------|-------|--------|
| context-pipeline-bottleneck | Context Scraper is the shared bottleneck across all three modes | HIGH — latency in context gathering directly impacts generation responsiveness |
| sb-quality-gate | Story Bible completeness gates all downstream AI quality | HIGH — incomplete SB produces incoherent output; auto-extract must be robust |
| model-routing-flexibility | Model Router must support runtime model switching without pipeline restart | MEDIUM — Sudowrite validates per-task model routing for quality optimization |

## 3. Cross-Cutting Foundations

### Data Model

Four core entity types extend the existing Knowledge Engine schema. Each entity MUST carry a `confidence_score` (0.0-1.0) and `source_chapter` reference for traceability.

**CharacterProfile** — `{ id, name, aliases[], traits: Map<string,string>, relationships: Edge[], arc_stage: string, confidence_score, source_chapters[], last_updated }`

**WorldRule** — `{ id, domain, rule_text, exceptions[], related_entities[], confidence_score, source_chapters[] }`

**PlotThread** — `{ id, title, status: enum(active, resolved, abandoned), milestones: Event[], dependencies: ThreadRef[], confidence_score, source_chapters[] }`

**TimelineEvent** — `{ id, timestamp_narrative, timestamp_real?, participants: CharacterRef[], location, description, plot_threads[], confidence_score, source_chapters[] }`

Relationships use the existing KE edge schema with typed predicates (`knows`, `opposes`, `ally_of`, `member_of`). The Story Bible auto-extract service MUST populate these entities from manuscript text using Craft Analysis Services outputs (SME-04), tagging each with a confidence score. Entities below a configurable confidence threshold (default 0.6) SHOULD be flagged for user review rather than silently included.

### State Machine

The Co-Writing session lifecycle governs all three modes through a shared state machine with mode-specific entry conditions.

`
                    +-------+
                    | idle  |
                    +---+---+
                        |
              context_gathering
                    /   |   \
              auto   guided  directed
                |      |       |
           +----+------+-------+----+
           |       generating       |
           +----+------+-------+----+
                 |      |
            review   error_recovery
                 |      |
            +----+------+----+
            |    applied     |
            +----------------+
`

| Transition | Trigger | Guard |
|---|---|---|
| idle -> context_gathering | User invokes co-write action | SB has minimum required entities (SA-02) |
| context_gathering -> generating | Context pipeline completes | Context window within limits (SA-07) |
| generating -> review | Output aggregator returns | Quality check passes hard constraints (SA-05) |
| generating -> error_recovery | Model timeout / rate limit | Retry count < max_retries |
| review -> applied | User accepts suggestion | — |
| review -> idle | User rejects suggestion | Discard generated output |
| error_recovery -> generating | Retry succeeds | Exponential backoff elapsed |
| error_recovery -> idle | Max retries exceeded | MUST surface error to user |

Auto mode transitions directly from generating to review with a single continuation. Guided mode generates three scored options before entering review. Directed mode validates user instruction against SB entities before entering generating.

### Error Handling Strategy

**Classification**: Errors are classified as _transient_ (model timeout, rate limit, network blip) or _permanent_ (invalid SB data, constraint violation, schema mismatch).

**Recovery**: Transient errors MUST retry with exponential backoff (initial 1s, max 30s, jitter). Permanent errors MUST surface to the user with diagnostic metadata (offending entity, constraint violated, suggested fix). The Co-Writing pipeline MUST NOT silently drop errors; the Output Aggregator MUST attach error metadata to any partial output.

**Isolation**: Reader Simulation dual-engine (SA-04) requires fault isolation — if the reader persona engine fails, the editorial analysis engine MUST continue independently and vice versa. Each engine MUST report its own health status via MCP health endpoints.

### Observability Requirements

The system MUST emit structured metrics for operational visibility. Minimum required metrics:

1. `cowrite_pipeline_latency_ms` — per-stage latency histogram (context_scraper, prompt_assembler, model_router, output_aggregator, post_processor)
2. `cowrite_model_routing_count` — per-model invocation count for routing distribution analysis
3. `story_bible_hit_rate` — percentage of SB entity lookups that return populated data vs. empty
4. `quality_violation_count` — per-dimension violation frequency (plot, character, style, pacing)
5. `context_window_utilization_pct` — ratio of used to available context tokens
6. `reader_simulation_engine_health` — binary health per engine (reader, editorial)
7. `autoextract_confidence_distribution` — histogram of confidence scores from SB auto-extraction

Log events MUST include: session_id, mode, model_id, sb_entity_count, constraint_tier. Health checks MUST expose `/mcp/health` returning per-service status.

### Configuration Model

All configurable parameters MUST be exposed via MCP config endpoints and validated on update.

| Parameter | Type | Default | Validation |
|---|---|---|---|
| `creativity_default_auto` | float | 0.5 | range [0.0, 1.0] |
| `creativity_default_guided` | float | 0.6 | range [0.0, 1.0] |
| `creativity_default_directed` | float | 0.4 | range [0.0, 1.0] |
| `model_routing_rules` | Map<task, model_id> | {context: default, logic: default, creative: default} | each model_id MUST be registered |
| `summarization_threshold_chapters` | int | 10 | range [3, 50] |
| `quality_hard_constraint_threshold` | float | 0.7 | range [0.0, 1.0] |
| `sb_confidence_threshold` | float | 0.6 | range [0.0, 1.0] |
| `retry_max_attempts` | int | 3 | range [1, 10] |
| `retry_initial_backoff_ms` | int | 1000 | range [100, 10000] |

Configuration updates MUST be validated atomically; invalid configurations MUST be rejected without affecting current runtime.

### Boundary Scenarios

**Concurrency**: Concurrent co-writing requests from the same session MUST serialize at the context_gathering stage. The pipeline MUST NOT allow parallel generation for the same chapter to prevent conflicting SB updates.

**Rate Limiting**: Model Router MUST implement per-model rate limiting with configurable thresholds. When rate limit is hit, the router SHOULD attempt fallback model before entering error_recovery.

**Shutdown**: Graceful shutdown MUST flush in-progress generation to draft state. Partial output from the Output Aggregator MUST be persisted with a `draft: true` flag so users can recover work.

**Cleanup**: Abandoned co-writing sessions (idle > configurable timeout) SHOULD release held context window budget and clear cached SB snapshots.

**Scalability**: Reader Simulation persona count scales horizontally — each persona is an independent analysis pass. The system SHOULD support up to 8 concurrent personas without degradation (Slima validates 5-8 as practical range).

**Disaster Recovery**: SB data MUST be snapshot before each co-writing session. If generation produces SB-inconsistent output, the system MUST be able to restore the pre-session SB state.

## 4. File Index

| File | Type | Feature | Headings |
|------|------|---------|----------|
| [analysis-F-001-story-bible.md](analysis-F-001-story-bible.md) | feature | F-001 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-002-co-writing-auto.md](analysis-F-002-co-writing-auto.md) | feature | F-002 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-003-co-writing-guided.md](analysis-F-003-co-writing-guided.md) | feature | F-003 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-004-co-writing-directed.md](analysis-F-004-co-writing-directed.md) | feature | F-004 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-005-reader-simulation.md](analysis-F-005-reader-simulation.md) | feature | F-005 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-006-reader-visualization.md](analysis-F-006-reader-visualization.md) | feature | F-006 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-007-quality-control.md](analysis-F-007-quality-control.md) | feature | F-007 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-008-multimodal-intelligence.md](analysis-F-008-multimodal-intelligence.md) | feature | F-008 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [findings-context-pipeline-bottleneck.md](findings-context-pipeline-bottleneck.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-sb-quality-gate.md](findings-sb-quality-gate.md) | finding | — | Description, Affected Features, Recommendation |

## 5. Outstanding TODOs

- [ ] Study existing KnowledgeEngine schema and MCP registration patterns in codebase to validate SA-02 extension feasibility
- [ ] Map existing Craft Analysis Services output schemas to Story Bible auto-extract input requirements (SA-02 + SME-04)
- [ ] Audit existing Revision Protocol (IRevisionService) interfaces for Directed mode reuse (SA-03 + SA-03/PM-02 cross-reference)
- [ ] Define model routing rule schema — which model handles which task type for the Model Router stage (SA-03)
- [ ] Specify Shrink Ray summarization strategy — chapter-level vs. scene-level granularity, entity reference preservation (SA-07)
- [ ] Design SB snapshot mechanism for pre-session state recovery in disaster scenarios
- [ ] Benchmark context pipeline latency targets for acceptable user experience in co-writing
- [ ] Evaluate existing narrative visualization data contracts for Reader Simulation overlay compatibility (SA-04 + UX-02)
- [ ] Define polymorphic operation dispatch mechanism for Multi-Modal Intelligence text-first phase (SA-06)
- [ ] Resolve MCP endpoint versioning strategy — whether new endpoints share version namespace with existing KE endpoints
