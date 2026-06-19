# Design Research: 写作工具新能力探索

## Key Findings

- **Context-aware generation is THE differentiator**: Sudowrite's 20,000-word context window + Story Bible + 25 linked chapters is the gold standard for AI fiction tools. 89% of writers using specialized fiction AI report better prose than general AI.
- **Multi-model orchestration beats single-model**: Sudowrite routes prompts to different LLMs by task type (Claude for context, GPT-5 for logic, proprietary for creative prose).
- **Reader simulation is an emerging competitive front**: Slima (dual-engine reader+editor), Beta Reader AI (multi-model consensus), ProWritingAid (virtual beta reader) all launched in 2024-2026.
- **Multi-agent narrative generation is the research frontier**: StoryForge (13 agents), CreAgentive (Story Prototype abstraction), NarrativeLoom (10-persona BVSR).
- **Collaborative AI writing is unsolved**: No product does real-time multi-user + AI agent co-writing well. Research shows AI should be a "shared resource" not a "team member".
- **Vistoria's Instrumental Interaction pattern**: Same operations (lasso, collage, filter, perspective shift) apply uniformly to text AND images, enabling image-text co-editing.

## Reference Projects / Implementations

### Sudowrite
Market leader in AI fiction writing. Co-writing environment with persistent story memory.
- Architecture: Context Scraper → Prompt Assembler → Model Router → Output Aggregator → Post-Processing
- Key pattern: **Story Bible as single source of truth** — all generation features read from it
- Key pattern: **Multi-mode generation** — Auto (free continuation), Guided (3 suggestion cards), Tone Shift (8 presets)

### Slima
AI beta reader with dual-engine architecture (readers + editors).
- Architecture: 5-8 AI reader personas run in parallel with 6 editor passes
- Key pattern: **Parallel dual-engine** — reader simulation and editorial analysis run concurrently
- Key pattern: **Reader persona persistence** — custom readers persist across revision reports

### Vistoria (Research)
Multimodal story writing via Instrumental Image-Text Co-Editing.
- Key pattern: **Polymorphic operations** — same gesture affects both text and images
- Key pattern: **Persistent visual memory store** — generated images stored with metadata

### CreAgentive (Research)
Agent workflow driven creative generation with Story Prototype abstraction.
- Key pattern: **Story Prototype** — text-independent intermediate representation enabling cross-genre transfer and long-range coherence

### CHI 2026 Collaborative AI Editing
- Key pattern: **AI as shared resource, not team member** — users incorporated agents into existing authorship norms

### Beta Reader AI
Multi-model consensus for manuscript feedback.
- Key pattern: **Multi-model consensus** — when independent models agree, the signal is almost certainly real

## Extractable Patterns

### Pattern: Context Engine + Story Bible
Central structured knowledge base that ALL AI features read from before generating.
- Applicability: niko-studio already has knowledge engine with MCP → maps directly. RECOMMENDED as foundation.
- Adaptation: Use existing MCP knowledge endpoints as "Story Bible" API. Add typed schemas for characters, world rules, plot threads, timeline events.

### Pattern: Multi-Mode Generation (Auto / Guided / Directed)
Three escalation levels of AI involvement matching different creative states.
- Applicability: Directly applicable. Extend revision service to co-writing with three modes.
- Adaptation: Auto uses session intelligence; Guided uses craft analysis to generate 3 scored options; Directed uses MCP + user instruction.

### Pattern: Reader Persona Simulation + Attention Curve
Multiple AI readers with distinct personas read the manuscript. Consensus identifies real problems.
- Applicability: niko-studio already has tension curve and reader state visualization → extend with persona-based simulation.
- Adaptation: Reuse narrative visualization. Add persona definitions. Run craft analysis per persona. Overlay on existing visualization.

### Pattern: Instrumental Interaction (Polymorphic Operations)
Same interaction primitives work on both text and images.
- Applicability: Applicable if adding visual/multimodal capabilities.
- Adaptation: Start with text-only operations (filter by character, lasso scene, perspective shift). Extend to visual later.

### Pattern: Decompose-and-Link (DLCI)
Story broken into individually editable components. Changes propagate via meta-prompting.
- Applicability: Directly applicable to existing knowledge engine entities.
- Adaptation: When character trait changes → flag affected scenes. When plot thread revised → flag downstream foreshadowing.

### Pattern: Agent-as-Shared-Resource
AI agents with visible profiles, explicit delegation, comment-based output.
- Applicability: For future collaborative features.

## Recommended Approach

**Architecture: Context Engine as Spine + Three Capability Layers**

1. **Co-Writing Engine** (highest impact, competitive differentiation): Multi-Mode Generation on top of existing revision service + session intelligence.
2. **Reader Simulation Panel** (user-perceivable, leverages existing visualization): Persona-based reader simulation with attention curves and emotion maps.
3. **Multi-Modal Story Intelligence** (differentiation, uses Instrumental Interaction): Visual-text co-editing via polymorphic operations.

## Pitfalls

- **Skipping Story Bible setup**: Must make structured story knowledge EASY to create, not optional. Auto-generate from manuscript text.
- **AI-as-replacement framing**: Position as "writing partner" not replacement. Default to draft-quality with revision path.
- **Over-generation / purple prose**: Style personalization from session intelligence constrains output; creativity slider with sensible defaults.
- **Context window limits**: Automatic context summarization (Shrink Ray pattern).
- **Real-time collaborative AI as first feature**: Still unsolved. Defer; focus on single-user AI first.
- **Multimodal without operation semantics**: Design operation semantics for text first, then add visual targets.
