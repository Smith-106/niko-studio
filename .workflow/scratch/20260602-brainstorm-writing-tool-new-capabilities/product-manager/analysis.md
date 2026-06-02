# Product Manager Analysis — 写作工具新能力探索

> Contract: guidance-specification.md §5 (decisions PM-01 through PM-05)
> Owns: Delivery priority, MVP scope, Story Bible construction model, AI output positioning, creativity control
> Does not own: Technical architecture (SA-*), UX interaction design (UX-*), domain quality dimensions (SME-*)

## 1. Role Mandate (≤ 200 words)

The Product Manager decides what gets built, in what order, and for whom. This brainstorm focuses on three AI-driven writing capabilities — Co-Writing Engine, Reader Simulation, and Multi-Modal Intelligence — that transform niko-studio from a passive analysis tool into an active AI co-creation environment. The PM owns delivery priority (Co-Writing first, Reader Simulation second, Multi-Modal last), MVP scope (dual-capability MVP with Auto + Guided modes and basic Reader Simulation), Story Bible construction model (hybrid auto-extract + user supplement), AI output positioning (first draft with revision path), and creativity control (slider with sensible defaults). The PM defers technical architecture decisions to System Architect, interaction design to UX Expert, and domain quality dimensions to Subject Matter Expert. User context confirms the 共创→读者→多模态 priority and the dual-capability MVP strategy.

## 2. Decision Digest

### Decisions
| ID | Feature | Stance | Constraints (RFC 2119) |
|----|---------|--------|------------------------|
| PM-01 | Cross-cutting | Delivery priority: Co-Writing → Reader Simulation → Multi-Modal Intelligence | MUST follow this priority order; Multi-Modal MUST NOT precede Co-Writing or Reader Simulation |
| PM-02 | F-002, F-003, F-005 | MVP scope: Co-Writing (Auto + Guided) + Reader Simulation (3 preset personas) | MVP MUST include both capabilities; Directed mode (F-004) SHOULD be deferred |
| PM-03 | F-001 | Story Bible hybrid construction: auto-extract then user supplements | MUST use hybrid mode; auto-extraction MUST use existing Craft Analysis Services |
| PM-04 | F-002, F-003, F-004 | AI output framed as "first draft" with explicit revision path | MUST position AI as writing partner, not replacement; revision path MUST be visible |
| PM-05 | F-002, F-003, F-004 | Creativity slider with sensible defaults per mode | MUST include creativity control; default MUST be "Balanced"; MUST prevent over-generation |

### Interfaces
| Name | Contract | Consumers |
|------|----------|-----------|
| storyBible.query | { entityType, filters } → Entity[] | Co-Writing Engine, Reader Simulation |
| storyBible.extract | { manuscriptRange } → ExtractionResult | Auto-extraction pipeline |
| storyBible.upsert | { entity } → Entity | Inline editing (UX-04) |
| storyBible.validate | { entityId } → CompletenessScore | Quality Control (F-007) |
| coWriting.auto | { cursor, contextWindow, creativityLevel } → GeneratedText | Writing workspace |
| coWriting.guided | { cursor, contextWindow, creativityLevel } → GuidedResult | Writing workspace |
| coWriting.directed | { cursor, instruction, contextWindow, creativityLevel } → DirectedResult | Writing workspace (post-MVP) |
| readerSimulation.run | { manuscriptRange, personas[] } → SimulationResult | Visualization (F-006) |
| readerSimulation.consensus | { simulationId } → ConsensusReport | Quality Control (F-007) |
| qualityControl.validate | { text, mode } → ValidationResult | Co-Writing Engine, Reader Simulation |
| mmi.filter | { target, predicate } → FilteredResult | Writing workspace, visualization |
| mmi.lasso | { target, region } → LassoResult | Scene selection |
| mmi.perspectiveShift | { target, perspective } → ShiftedResult | Perspective rewriting |

### Cross-Cutting Positions
| Topic | Stance |
|-------|--------|
| Delivery Priority | Co-Writing Engine first, Reader Simulation second, Multi-Modal Intelligence last (PM-01) |
| MVP Strategy | Dual-capability MVP demonstrates capability linkage; single-capability MVP is insufficient (PM-02) |
| Story Bible as Foundation | Story Bible is the critical path dependency; incomplete Story Bible degrades all downstream capabilities (PM-03) |
| AI Positioning | AI is a "writing partner" producing first drafts; never a "writing replacement" producing final text (PM-04) |
| Creativity Control | User-controllable creativity with sensible defaults prevents over-generation and purple prose (PM-05) |
| Quality Baseline | Hard constraints enforce minimum quality; soft constraints preserve creative freedom (SA-05) |
| Competitive Differentiation | Integrated reader simulation + narrative visualization is the unique competitive advantage over standalone tools |
| Context Management | Automatic summarization (Shrink Ray) is essential for long-form fiction; context window limits are a real constraint (SA-07) |

### Findings Summary
| Slug | Title | Impact |
|------|-------|--------|
| mvp-scope-risk | MVP Scope Risk — 双能力 MVP 的实现复杂度 | HIGH — Story Bible critical path blocks both capabilities |
| competitive-positioning | 竞争定位窗口 — 读者模拟差异化机会 | MEDIUM — Narrowing window for integrated reader simulation |
| ai-output-positioning | AI 输出定位策略 — First Draft 作为用户期望锚点 | MEDIUM — Shapes entire revision UX pattern |

## 3. Cross-Cutting Foundations

### Personas

Three primary user personas drive product decisions:

1. **Stuck Writer** — Has narrative momentum but needs a push. Primary consumer of Auto mode (F-002). Values low-friction interaction; wants AI to continue where they left off without complex configuration.
2. **Explorer Writer** — Wants to see narrative alternatives before committing. Primary consumer of Guided mode (F-003). Values choice and comparison; wants scored options with clear narrative direction labels.
3. **Revision-Conscious Writer** — Actively seeks feedback on draft quality. Primary consumer of Reader Simulation (F-005). Values objective feedback from multiple perspectives; wants consensus findings that identify real problems.

All three personas share a common need: Story Bible as the shared knowledge foundation. Without it, AI output quality degrades significantly (Sudowrite data).

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Story Bible adoption rate | ≥ 80% of active projects have Story Bible | Auto-extraction trigger count |
| Co-Writing acceptance rate | 40-70% of generated text accepted (not too high = AI too conservative; not too low = AI too creative) | Accept/reject ratio |
| Reader Simulation usage | ≥ 50% of Co-Writing users also run Reader Simulation | Feature linkage rate |
| Revision path follow-through | ≥ 60% of accepted AI text is subsequently revised | Revision tracking |
| Creativity slider engagement | ≥ 30% of users adjust from "Balanced" default | Slider interaction events |

### Roadmap Shape

**Phase 1 (MVP)**: Story Bible + Co-Writing Auto/Guided + Reader Simulation basic (3 presets). Demonstrates capability linkage between co-writing and reader feedback.

**Phase 2**: Directed mode (F-004) + custom Reader Simulation personas + Quality Control refinement. Deepens existing capabilities rather than adding new ones.

**Phase 3**: Multi-Modal Intelligence (F-008) text operations + visual extension. Extends the platform into multimodal territory.

This phased approach follows the principle of deepening before widening — each phase makes existing capabilities more robust before adding new surface area.

### Prioritization Rationale

The Co-Writing → Reader Simulation → Multi-Modal priority order (PM-01) is justified by three factors:

1. **User value density**: Co-Writing directly addresses the core writing workflow; Reader Simulation adds feedback; Multi-Modal extends the canvas. Value density decreases with each layer.
2. **Competitive differentiation**: Co-Writing is table stakes (all competitors have it); Reader Simulation is the differentiator (few competitors integrate it with writing environment); Multi-Modal is the frontier (no competitor does it well).
3. **Technical dependency**: Co-Writing requires Story Bible; Reader Simulation requires Story Bible + narrative visualization; Multi-Modal requires both plus operation semantics. Dependencies accumulate.

## 4. File Index

| File | Type | Feature | Headings |
|------|------|---------|----------|
| [analysis-F-001-story-bible.md](analysis-F-001-story-bible.md) | feature | F-001 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-002-co-writing-auto.md](analysis-F-002-co-writing-auto.md) | feature | F-002 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-003-co-writing-guided.md](analysis-F-003-co-writing-guided.md) | feature | F-003 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-004-co-writing-directed.md](analysis-F-004-co-writing-directed.md) | feature | F-004 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-005-reader-simulation.md](analysis-F-005-reader-simulation.md) | feature | F-005 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-006-reader-visualization.md](analysis-F-006-reader-visualization.md) | feature | F-006 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-007-quality-control.md](analysis-F-007-quality-control.md) | feature | F-007 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [analysis-F-008-multimodal-intelligence.md](analysis-F-008-multimodal-intelligence.md) | feature | F-008 | Architecture, Interface Contract, Constraints (RFC 2119), Test Approach, TODOs |
| [findings-mvp-scope-risk.md](findings-mvp-scope-risk.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-competitive-positioning.md](findings-competitive-positioning.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-ai-output-positioning.md](findings-ai-output-positioning.md) | finding | — | Description, Affected Features, Recommendation |

## 5. Outstanding TODOs

- Define minimum viable Story Bible entity schema fields per type (CharacterProfile, WorldRule, PlotThread, TimelineEvent) — blocks F-001 implementation.
- Determine Story Bible completeness score calculation weights — blocks quality validation in F-001 and F-007.
- Define "sensible defaults" for creativity slider per genre — blocks F-002 and F-003 configuration.
- Specify confidence score calculation methodology for AI-generated text metadata (SME-03) — blocks F-002, F-003, F-004.
- Design feedback loop from Co-Writing reject reasons to future generation quality — post-MVP but needs data collection from MVP.
- Determine whether Guided mode option mixing (F-003) is MVP or post-MVP scope.
- Define narrative direction taxonomy for Guided mode option labeling — blocks F-003 UX.
- Specify consensus algorithm for Reader Simulation (simple majority vs weighted agreement) — blocks F-005.
- Assess whether phased MVP (1a: Story Bible + Auto; 1b: Reader Simulation) reduces risk sufficiently to justify the delay — decision needed before implementation starts.
- Study existing narrative visualization API for Reader Simulation overlay extension points — blocks F-006.
- Define complete Multi-Modal operation vocabulary beyond the three core operations — blocks F-008 design.
- Determine instruction template library for Directed mode — deferred to Phase 2.
