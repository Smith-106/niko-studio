# Implementation Plan: 写作工具新能力探索

## Source
- Brainstorm: BRN-20260602-writing-tool-new-capabilities
- Context Package: .workflow/scratch/20260602-brainstorm-writing-tool-new-capabilities/context-package.json

## MVP Scope
- **MUST**: F-001, F-002, F-003, F-005, F-007
- **MVP + 可视化**: F-006
- **Phase 2**: F-004 (Directed mode)
- **Phase 3**: F-008 (Multi-Modal Intelligence)

## Delivery Phases

### Phase 1 (M26): Story Bible + Co-Writing Engine + QC
**Goal**: AI 共创核心能力可用 — Story Bible 构建故事知识库，Auto/Guided 模式生成续写，QC 保障输出质量

#### Wave 1.1: Foundation (F-001 + F-007 partial)

| Task | Description | Depends | Est. | Files |
|------|------------|---------|------|-------|
| T-001 | Define SB entity types in KnowledgeEngine | — | S | `src-ts/knowledge/entities/*.ts` |
| T-002 | Implement CharacterProfile entity + schema | T-001 | S | `src-ts/knowledge/entities/CharacterProfile.ts` |
| T-003 | Implement WorldRule entity + schema | T-001 | S | `src-ts/knowledge/entities/WorldRule.ts` |
| T-004 | Implement PlotThread entity + schema | T-001 | S | `src-ts/knowledge/entities/PlotThread.ts` |
| T-005 | Implement TimelineEvent entity + schema | T-001 | S | `src-ts/knowledge/entities/TimelineEvent.ts` |
| T-006 | SB auto-extraction from manuscript (uses CAS) | T-002..T-005 | M | `src-ts/knowledge/extraction/StoryBibleExtractor.ts` |
| T-007 | SB completeness gate (graduated scoring) | T-002..T-005 | S | `src-ts/knowledge/StoryBibleCompleteness.ts` |
| T-008 | QC hard constraint engine (4 dimensions from CAS) | T-001 | M | `src-ts/quality/HardConstraintEngine.ts` |
| T-009 | QC creativity spectrum config + defaults | T-001 | S | `src-ts/quality/CreativitySpectrum.ts` |
| T-010 | MCP endpoint registration for SB + QC | T-006, T-008 | S | `src-tauri/src/mcp/sb_endpoints.rs`, `src-tauri/src/mcp/qc_endpoints.rs` |

#### Wave 1.2: Co-Writing Engine (F-002 + F-003)

| Task | Description | Depends | Est. | Files |
|------|------------|---------|------|-------|
| T-011 | Context Scraper — assemble SB + session + chapter context | T-010 | M | `src-ts/cowriting/ContextScraper.ts` |
| T-012 | Prompt Assembler — build mode-specific prompts | T-011 | M | `src-ts/cowriting/PromptAssembler.ts` |
| T-013 | Model Router — select LLM by task type | T-011 | S | `src-ts/cowriting/ModelRouter.ts` |
| T-014 | Output Aggregator — post-process AI output | T-013 | M | `src-ts/cowriting/OutputAggregator.ts` |
| T-015 | Shrink Ray context summarization | T-011 | S | `src-ts/cowriting/ContextSummarizer.ts` |
| T-016 | Auto mode implementation | T-012, T-014, T-009 | M | `src-ts/cowriting/AutoMode.ts` |
| T-017 | Guided mode implementation (3 scored options) | T-012, T-014, T-009 | M | `src-ts/cowriting/GuidedMode.ts` |
| T-018 | QC integration — hard constraint enforcement in output | T-016, T-017, T-008 | S | `src-ts/cowriting/QCIntegration.ts` |
| T-019 | AI output metadata tagging (mode, confidence, violations) | T-016, T-017 | S | `src-ts/cowriting/OutputMetadata.ts` |
| T-020 | MCP endpoint for Co-Writing | T-016, T-017 | S | `src-tauri/src/mcp/cowriting_endpoints.rs` |

#### Wave 1.3: Frontend — SB + Co-Writing UI

| Task | Description | Depends | Est. | Files |
|------|------------|---------|------|-------|
| T-021 | Story Bible panel (inline editing in workspace) | T-010 | L | `desktop/src/components/story-bible/*.tsx` |
| T-022 | SB entity cards (Character/World/Plot/Timeline) | T-021 | M | `desktop/src/components/story-bible/EntityCards.tsx` |
| T-023 | SB auto-extract trigger + confirmation UI | T-006, T-021 | S | `desktop/src/components/story-bible/AutoExtractButton.tsx` |
| T-024 | SB completeness indicator | T-007, T-021 | S | `desktop/src/components/story-bible/CompletenessIndicator.tsx` |
| T-025 | Co-Writing sidebar panel | T-020 | L | `desktop/src/components/cowriting/*.tsx` |
| T-026 | Inline suggestion hints in editor | T-025 | M | `desktop/src/components/cowriting/InlineHints.tsx` |
| T-027 | Mode switcher (Auto/Guided) | T-025 | S | `desktop/src/components/cowriting/ModeSwitcher.tsx` |
| T-028 | Creativity spectrum slider with presets | T-009, T-025 | S | `desktop/src/components/cowriting/CreativitySlider.tsx` |
| T-029 | Guided mode — 3 option cards with scores | T-017, T-025 | M | `desktop/src/components/cowriting/GuidedOptions.tsx` |
| T-030 | AI output metadata badge | T-019, T-026 | S | `desktop/src/components/cowriting/MetadataBadge.tsx` |

**Phase 1 Total**: 30 tasks | ~20 SM + 8 M + 2 L

---

### Phase 2 (M27): Reader Simulation + Visualization

#### Wave 2.1: Reader Simulation Engine (F-005)

| Task | Description | Depends | Est. | Files |
|------|------------|---------|------|-------|
| T-031 | Reader persona definition (3 presets + custom schema) | T-001 | M | `src-ts/reader/PersonaDefinition.ts` |
| T-032 | Dual-engine architecture (reader + editor parallel) | T-031 | L | `src-ts/reader/DualEngine.ts` |
| T-033 | 4-dimension analysis per persona (plot/character/style/pacing) | T-032, T-008 | L | `src-ts/reader/DimensionAnalyzer.ts` |
| T-034 | Multi-persona consensus mechanism | T-033 | M | `src-ts/reader/ConsensusEngine.ts` |
| T-035 | RS-to-Overlay bridge (transform to OverlayMarker[]) | T-034 | M | `src-ts/reader/OverlayBridge.ts` |
| T-036 | MCP endpoint for Reader Simulation | T-034 | S | `src-tauri/src/mcp/reader_endpoints.rs` |

#### Wave 2.2: Reader Visualization + QC Frontend (F-006 + F-007 frontend)

| Task | Description | Depends | Est. | Files |
|------|------------|---------|------|-------|
| T-037 | Reader overlay on tension curve | T-035, T-036 | M | `desktop/src/components/reader/ReaderOverlay.tsx` |
| T-038 | Reader detail panel with click-through linkage | T-037 | M | `desktop/src/components/reader/DetailPanel.tsx` |
| T-039 | Persona selector + custom persona editor | T-031, T-037 | S | `desktop/src/components/reader/PersonaSelector.tsx` |
| T-040 | QC visualization (constraint status dashboard) | T-008, T-009 | M | `desktop/src/components/quality/QCDashboard.tsx` |
| T-041 | RS report generation (consensus + dissent) | T-034, T-038 | M | `desktop/src/components/reader/ReportGenerator.tsx` |

**Phase 2 Total**: 11 tasks | ~3 S + 5 M + 2 L

---

## Risk Mitigations

| Risk | Mitigation | Owner |
|------|-----------|-------|
| SB data incomplete → poor AI output | T-007 completeness gate + graduated scoring | SA |
| AI over-generation / purple prose | T-009 creativity spectrum + T-018 QC enforcement | PM+UX |
| Context window limits | T-015 Shrink Ray auto-summarization | SA |
| MCP endpoint performance | Async processing + caching in endpoint design | SA |
| Persona definition subjectivity | T-034 multi-persona consensus mechanism | SME |

## Dependency Graph (Critical Path)

```
T-001 → T-002..T-005 → T-006 → T-010 → T-011 → T-012 → T-016/T-017 → T-020 → T-025
                   ↘ T-007 ↘                    ↘ T-013 → T-014 ↗        ↘ T-026
                   ↘ T-008 → T-018 ↗            ↘ T-015                  ↘ T-027..T-030
                   ↘ T-009 → T-016/T-017 ↗      ↘ T-019
```

Critical path: T-001 → T-002..T-005 → T-006 → T-010 → T-011 → T-012 → T-016 → T-020 → T-025

## Test Strategy

- **Unit**: Each TS class (entity schemas, extractors, engines, mode implementations)
- **Integration**: MCP endpoint E2E (SB CRUD → Co-Writing request → QC validation)
- **Frontend**: Component tests for SB panel, Co-Writing sidebar, reader overlay
- **E2E**: Full flow — manuscript → SB auto-extract → Auto mode → QC check → accept output

## Open Decisions

| ID | Question | Options | Default |
|----|----------|---------|---------|
| OD-001 | Which LLM provider for Model Router? | Claude API / OpenAI / Local | Claude API |
| OD-002 | SB entity versioning strategy? | Immutable + snapshot / Mutable + audit log | Mutable + audit log |
| OD-003 | Reader Simulation: synchronous or async batch? | Sync (simpler) / Async (better UX) | Async with progress |
