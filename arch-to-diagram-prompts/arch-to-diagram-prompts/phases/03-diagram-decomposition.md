# Phase 3: Diagram Decomposition

> **COMPACT SENTINEL [Phase 3: diagram-decomposition]**
> This phase contains 3 execution steps (Step 3.1 — 3.3).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/03-diagram-decomposition.md")`

Decompose the extracted design essence into discrete, diagrammable concepts — each capturing one architectural facet with defined visual elements and relationships.

## Objective

- Select diagram types based on what the system's essence reveals
- Define visual elements, layout, and relationships for each diagram
- Ensure each diagram has a single clear narrative focus
- Produce `diagramSpecs[]` array for prompt synthesis

## Execution

### Step 3.1: Diagram Type Selection

Select from the **Diagram Catalog** based on `essenceDoc` content. Not all types apply — choose only those that illuminate the system:

| Diagram Type | When to Use | Captures |
|-------------|-------------|----------|
| **System Overview** | Always (required) | High-level architecture, component groups, overall topology |
| **Flow Choreography** | When `chainPatterns` has 2+ patterns | Execution flows, sequencing, branching |
| **Module Constellation** | When `moduleMap` has 4+ modules | Module relationships, dependency clusters |
| **Philosophy Mandala** | When `corePhilosophy.principles` has 3+ items | Design principles as radiating structure |
| **Feature Landscape** | When `uniqueFeatures` has 3+ features | Feature terrain showing capability breadth |
| **Decision Tree** | When `designDecisions` has notable trade-offs | Architectural decisions and their alternatives |
| **Integration Web** | When system bridges multiple external tools/services | External connection points and protocols |
| **Lifecycle Timeline** | When system has clear phase/stage progression | Temporal evolution of a process |

**Selection rules**:
- Minimum 3 diagrams, maximum 8
- If `diagramCount` is "auto": select all applicable types
- If `diagramCount` is a number: prioritize by information density (Overview > Flow > Modules > others)
- System Overview is always included as Diagram 1

### Step 3.2: Per-Diagram Specification

> **CHECKPOINT**: Before proceeding, verify:
> 1. This phase is TodoWrite `in_progress`
> 2. Full protocol (Step 3.1 — 3.3) is in active memory
> If only sentinel remains → `Read("phases/03-diagram-decomposition.md")` now.

For each selected diagram, build a specification:

```
diagramSpec = {
  id: "diagram-{N}",
  type: "<from catalog>",
  title: {
    en: "English title",
    zh: "中文标题"
  },
  narrative: "One sentence: what story does this diagram tell?",
  perspective: "bird-eye | cross-section | timeline | radial | layered | network",
  elements: [
    {
      name: "Element name",
      visualRole: "node | connector | container | label | annotation | accent",
      shape: "circle | rectangle | diamond | line | arrow | cluster | ring",
      content: "What this element represents",
      emphasis: "primary | secondary | tertiary"
    }
  ],
  relationships: [
    {
      from: "element-name",
      to: "element-name",
      type: "flow | dependency | containment | association | hierarchy",
      label: "Optional relationship label"
    }
  ],
  layout: {
    orientation: "horizontal | vertical | radial | freeform",
    symmetry: "symmetric | asymmetric",
    density: "sparse | balanced | dense",
    focusPoint: "Where the eye should land first"
  },
  colorIntent: "What the color variation should encode (e.g., 'module category', 'execution phase', 'importance level')",
  annotationNotes: ["Key labels or annotations to include"]
}
```

**Per-type guidance**:

**System Overview**: Use layered or concentric layout. Core at center, supporting modules around. Show major flow paths.

**Flow Choreography**: Use horizontal left-to-right or top-to-bottom. Branching as diamond nodes. Parallel paths shown side-by-side.

**Module Constellation**: Use network/cluster layout. Group related modules. Edge thickness = coupling strength.

**Philosophy Mandala**: Use radial layout. Central concept, principles radiating outward. Concentric rings for abstraction levels.

**Feature Landscape**: Use terrain/map metaphor. Features as regions. Proximity = relatedness. Size = scope.

**Decision Tree**: Use tree layout. Decision points as diamonds. Chosen path highlighted, rejected paths dimmed.

**Integration Web**: Use hub-and-spoke. System at center, external tools at periphery. Protocol labels on connections.

**Lifecycle Timeline**: Use horizontal timeline. Phases as segments. Key events as markers. Data flow as arrows between phases.

### Step 3.3: Cross-Diagram Coherence Check

Verify the diagram set as a whole:

- [ ] No two diagrams tell the same story
- [ ] Together they cover: structure (static) + behavior (dynamic) + philosophy (conceptual)
- [ ] Each diagram can stand alone without requiring others for context
- [ ] Visual complexity is balanced — no single diagram is overloaded
- [ ] Key system concepts appear in at least one diagram

If gaps exist, add a diagram. If overlap exists, merge or reframe.

## Output

- **Variable**: `diagramSpecs[]` — array of diagram specifications
- **TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 4: Prompt Synthesis](04-prompt-synthesis.md).
