# Subject Matter Expert Analysis — Writing Tool New Capabilities

> Contract: guidance-specification.md §7 (decisions SME-01 through SME-04)
> Owns: Quality dimension definitions, reader persona specifications, AI output metadata standards, Story Bible auto-extraction domain rules
> Does not own: System architecture (SA), product prioritization (PM), UI/UX design (UX), data schemas (DA), test strategy (TS)

## 1. Role Mandate (<= 200 words)

The Subject Matter Expert defines the domain-specific quality standards, reader simulation parameters, and AI output transparency requirements for niko-studio's new AI-driven writing capabilities. This role owns the four-dimension quality framework (plot coherence, character consistency, style consistency, pacing/tension), the reader persona taxonomy and simulation parameters, the AI output metadata tagging standard, and the Story Bible auto-extraction domain rules that map Craft Analysis Service outputs to Story Bible entity types. The SME defers architectural decisions to the System Architect, prioritization to the Product Manager, interaction design to the UX Expert, and implementation details to development. The SME's core contribution is ensuring that AI-generated content meets fiction-writing quality standards drawn from industry research (Sudowrite, Slima, Beta Reader AI) and that the system's quality controls are calibrated to real writing-domain concerns rather than generic text quality metrics.

## 2. Decision Digest

### Decisions
| ID | Feature | Stance | Constraints (RFC 2119) |
|----|---------|--------|------------------------|
| SME-01 | F-007, cross-cutting | Four-dimension quality framework: plot coherence, character consistency, style consistency, pacing/tension | Quality Control MUST check all four dimensions; each dimension MUST map to existing CAS detectors |
| SME-02 | F-005 | Three preset reader personas (Suspense Enthusiast, Literary Critic, General Reader) plus custom persona support | Preset personas MUST cover primary reader types; custom personas MUST support age, taste, reading history parameters |
| SME-03 | F-002, F-003, F-004, cross-cutting | AI output metadata tagging: generation mode, confidence score, constraint violations | All AI-generated text MUST include mode, confidence, and violation metadata; metadata MUST be visible to users |
| SME-04 | F-001 | Story Bible auto-extraction reuses CAS detectors | Auto-extraction MUST use existing CAS as primary entity recognizer; no parallel entity recognition system permitted |

### Interfaces
| Name | Contract | Consumers |
|------|----------|-----------|
| QualityReport | `{ hardConstraints: HardConstraintResult[], softConstraints: SoftConstraintResult[], overallScore: number, pass: boolean }` | Co-Writing Engine, Writing Workspace, Reader Simulation |
| GenerationMetadata | `{ mode: "auto" | "guided" | "directed", confidence: number, violations: Violation[] }` | Co-Writing Engine, Writing Workspace |
| PersonaSpec | `{ type: "preset" | "custom", presetId?: string, customParams?: CustomPersonaParams }` | Reader Simulation Engine, Reader Visualization |
| ExtractionResult | `{ entities: ExtractedEntity[], confidence: number, completeness: number }` | Story Bible Engine, Quality Control |

### Cross-Cutting Positions
| Topic | Stance |
|-------|--------|
| Quality dimensions | Four dimensions (plot coherence, character consistency, style consistency, pacing/tension) are the mandatory quality framework for all AI output |
| AI transparency | All AI-generated text MUST carry metadata indicating mode, confidence, and constraint violations — transparency is non-negotiable |
| Story Bible as foundation | Story Bible completeness directly impacts AI output quality; the system MUST warn users about incomplete bibles before generation |
| Creativity vs. quality | Hard constraints are enforced (blocking); soft constraints from creativity spectrum are advisory (non-blocking); the two tiers MUST NOT be conflated |
| Reader persona consensus | Multi-persona agreement signals high-confidence problems; single-persona feedback is lower confidence and MUST be visually distinguished |

### Findings Summary
| Slug | Title | Impact |
|------|-------|--------|
| purple-prose-mitigation | Purple Prose and Over-Generation Mitigation | Quality Control needs explicit prose density metric to prevent AI over-generation beyond creativity spectrum controls |
| story-bible-completeness-gate | Story Bible Completeness as Generation Gate | Graduated completeness scoring enables generation at all levels while warning about reduced quality at low completeness |

## 3. Cross-Cutting Foundations

### Pitfall Taxonomy

The fiction-writing AI domain has well-documented failure modes that the system MUST guard against:

- **Over-generation / purple prose**: AI tends toward verbose, ornate language. The creativity spectrum (PM-05) partially addresses this, but Quality Control MUST include an explicit prose density check calibrated to the user's manuscript baseline. See [findings-purple-prose-mitigation](findings-purple-prose-mitigation.md).
- **Character inconsistency**: AI loses track of character traits across long manuscripts. Story Bible MUST serve as the authoritative character reference; Quality Control's character consistency dimension MUST cross-reference against Story Bible entries.
- **Plot incoherence**: AI generates events that contradict established plot threads. Story Bible's PlotThread entities MUST be checked during generation; the Decompose-and-Link pattern (see design-research) SHOULD propagate plot changes to affected scenes.
- **Context window exhaustion**: Long manuscripts exceed LLM context limits. The Shrink Ray automatic summarization pattern (SA-07) MUST compress early chapters while preserving key entity references from Story Bible.
- **Cold-start problem**: New users with empty Story Bibles produce poor AI output. Auto-extraction MUST run on manuscript load; graduated completeness scoring MUST enable generation at all levels with appropriate warnings. See [findings-story-bible-completeness-gate](findings-story-bible-completeness-gate.md).

### Pattern Fingerprints

Domain patterns validated by reference implementations:

- **Context Engine + Story Bible** (Sudowrite): Central structured knowledge base that ALL AI features read from. niko-studio's existing Knowledge Engine with MCP maps directly. Story Bible MUST extend this engine, not replace it.
- **Multi-Mode Generation** (Sudowrite): Three escalation levels (Auto/Guided/Directed) matching different creative states. Each mode MUST apply the same four-dimension quality framework with mode-appropriate enforcement (blocking for Auto/Guided, advisory for Directed).
- **Parallel Dual-Engine** (Slima): Reader personas and editorial analysis run concurrently. Neither engine MAY block the other. Consensus between independent personas signals high-confidence issues.
- **Multi-Model Consensus** (Beta Reader AI): When independent models agree, the signal is almost certainly real. Reader Simulation MUST implement consensus reporting that distinguishes multi-persona agreement from single-persona feedback.
- **Instrumental Interaction** (Vistoria): Same operations apply to text and images. For niko-studio, text operation semantics MUST be defined first; visual extension MUST NOT alter text behavior.

### Domain-Silence Decisions

Decisions where the domain literature provides insufficient guidance, requiring niko-studio-specific judgment:

- **Confidence score methodology**: No industry standard exists for AI fiction output confidence. niko-studio MUST define its own methodology, likely based on Quality Control dimension scores and Story Bible completeness.
- **Hard constraint thresholds**: No validated thresholds exist for "acceptable" plot coherence or character consistency scores. Default thresholds MUST be set conservatively and tuned based on user feedback.
- **Persona weight profiles**: No validated weight profiles exist for reader persona types. Preset persona weights MUST be based on genre conventions and refined through user testing.
- **Prose density baseline**: No standard metric exists for measuring over-generation. niko-studio MUST define a prose density metric calibrated per-user against their existing manuscript style.

### Differentiation Thesis

niko-studio differentiates from competitors through three SME-domain advantages:

1. **Existing Craft Analysis Services**: niko-studio already has mature writing analysis (structure, pacing, character, dialogue, scene quality, mystery, show/tell, voice consistency, emotional arc, hook/cliffhanger). These services provide the hard constraint foundation that competitors build from scratch. Quality Control MUST leverage this existing capability rather than reimplementing analysis.
2. **Four-dimension quality framework with two-tier enforcement**: The hard/soft constraint split (SA-05) preserves creative freedom while maintaining quality floors. Competitors typically use single-tier quality checks that either over-constrain or under-constrain.
3. **Transparent AI output metadata**: Tagging all AI output with mode, confidence, and violations (SME-03) positions niko-studio as a trustworthy writing partner rather than a black-box generator. This transparency is a differentiator in a market where most tools hide AI confidence information.

### Crosswalk

Mapping between SME decisions and other role decisions:

| SME Decision | SA Decision | PM Decision | UX Decision |
|-------------|-------------|-------------|-------------|
| SME-01 (four dimensions) | SA-05 (two-tier constraints) | PM-05 (creativity slider) | UX-03 (spectrum control) |
| SME-02 (reader personas) | SA-04 (dual-engine) | — | UX-02 (overlay visualization) |
| SME-03 (output metadata) | SA-03 (shared pipeline) | PM-04 (first draft framing) | UX-01 (hybrid display) |
| SME-04 (CAS reuse) | SA-02 (extend KE) | PM-03 (hybrid extraction) | UX-04 (inline editing) |

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
| [findings-purple-prose-mitigation.md](findings-purple-prose-mitigation.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-story-bible-completeness-gate.md](findings-story-bible-completeness-gate.md) | finding | — | Description, Affected Features, Recommendation |

## 5. Outstanding TODOs

- Define minimum required fields per Story Bible entity type (CharacterProfile, WorldRule, PlotThread, TimelineEvent)
- Define confidence score calculation methodology for AI output metadata
- Define default hard constraint threshold values for each of the four quality dimensions
- Design prose density metric for purple prose detection, calibrated per-user
- Define dimension weight profiles for preset reader personas (Suspense Enthusiast, Literary Critic, General Reader)
- Design consensus algorithm for multi-persona reader simulation agreement
- Study CAS detector output schemas to design Story Bible Entity Mapper mapping table
- Define scoring algorithm for Guided mode three-option ranking
- Define instruction parsing grammar for Directed mode user directives
- Define Story Bible completeness score formula and warning threshold
- Study Sudowrite, Slima, and Beta Reader AI implementations for domain pattern validation (see design-research)
- Determine how Reader Simulation editorial analysis feeds into Quality Control hard constraints
