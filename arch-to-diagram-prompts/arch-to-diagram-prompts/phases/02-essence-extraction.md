# Phase 2: Design Essence Extraction

> **COMPACT SENTINEL [Phase 2: essence-extraction]**
> This phase contains 4 execution steps (Step 2.1 — 2.4).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/02-essence-extraction.md")`

Extract the architectural soul of the target system — its design philosophy, command chaining patterns, unique features, and supporting module functions.

## Objective

- Identify core design philosophy and principles
- Map command/workflow chaining patterns and execution flows
- Catalog unique features and innovations
- Document supporting module functions and their roles
- Produce a structured `essenceDoc` for diagram decomposition

## Execution

### Step 2.1: Core Design Philosophy Extraction

Read the system's key files to identify design principles:

**Priority reading order**:
1. `CLAUDE.md` / `README.md` — stated principles
2. Main orchestrator / entry point — implicit patterns
3. Config files — architectural decisions
4. 3-5 representative component files — recurring patterns

**Extract**:
```
corePhilosophy = {
  principles: [
    { name: "Principle Name", description: "What it means", evidence: "file:line" }
  ],
  metaphor: "The dominant metaphor (e.g., 'pipeline', 'tree', 'event-driven')",
  designStance: "What this system optimizes for (e.g., extensibility, simplicity, performance)"
}
```

Look for:
- Explicit principle statements ("Key Design Principles", "Core Beliefs")
- Implicit patterns (naming conventions, abstraction levels, error handling style)
- Trade-off decisions (what the system chose NOT to do)

### Step 2.2: Command Chaining & Flow Patterns

Analyze how components connect and execute:

**Scan for patterns**:
- Sequential chains: A → B → C
- Fan-out/fan-in: A → [B, C, D] → E
- Conditional routing: A → if X then B else C
- Recursive/iterative: A → B → A (with exit condition)
- Delegation: A dispatches to external tool, waits for result
- Event-driven: A emits event → B reacts

**Extract**:
```
chainPatterns = [
  {
    name: "Pattern Name (e.g., 'Orchestrator + Progressive Loading')",
    description: "How it works",
    components: ["involved components"],
    flow: "A → B → C (textual flow description)",
    frequency: "how often this pattern appears"
  }
]
```

### Step 2.3: Unique Features & Innovations

Identify what makes this system distinctive:

**Look for**:
- Novel abstractions not common in similar systems
- Clever solutions to common problems
- Integration patterns between heterogeneous tools
- Self-healing / self-organizing mechanisms
- Meta-capabilities (system that builds/extends itself)

**Extract**:
```
uniqueFeatures = [
  {
    name: "Feature Name",
    description: "What it does and why it's notable",
    mechanism: "How it works technically",
    impact: "What it enables"
  }
]
```

### Step 2.4: Supporting Module Map

> **CHECKPOINT**: Before proceeding, verify:
> 1. This phase is TodoWrite `in_progress` (active phase protection)
> 2. Full protocol (Step 2.1 — 2.4) is in active memory, not just sentinel
> If only sentinel remains → `Read("phases/02-essence-extraction.md")` now.

Catalog all supporting modules and their roles:

**For each module/component group**:
```
moduleMap = {
  "<module-name>": {
    purpose: "What this module does",
    responsibilities: ["list of responsibilities"],
    interfaces: ["what it exposes to other modules"],
    dependencies: ["what it depends on"],
    category: "core|support|utility|integration|meta"
  }
}
```

**Categories**:
- **core**: Essential to the system's primary function
- **support**: Enhances core but system works without it
- **utility**: Shared helpers, formatters, validators
- **integration**: Bridges to external systems
- **meta**: Self-referential capabilities (tooling that builds tooling)

### Step 2.5: Assemble Essence Document

Combine all extractions into `essenceDoc`:

```
essenceDoc = {
  systemName: "<from systemInventory>",
  corePhilosophy: { principles, metaphor, designStance },
  chainPatterns: [...],
  uniqueFeatures: [...],
  moduleMap: {...},
  designDecisions: [
    { decision: "What was chosen", alternative: "What was rejected", reason: "Why" }
  ],
  systemNarrative: "<2-3 sentence summary of what this system IS, as a whole>"
}
```

The `systemNarrative` should read like an elevator pitch — capturing the system's identity in a way that guides all subsequent diagram framing.

## Output

- **Variable**: `essenceDoc` — structured extraction of design philosophy, patterns, features, modules
- **TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 3: Diagram Decomposition](03-diagram-decomposition.md).
