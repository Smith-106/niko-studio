# External Design Research: Next-Generation Writing Assistant Architecture

## Reference Projects & Implementations

### 1. Y.js + Hocuspocus (Real-time Collaboration)
- CRDT-based collaborative editing, industry standard for Tiptap integration
- Hocuspocus is the official Tiptap collaboration backend
- Applicability: Future M25+ if multi-user editing becomes a goal

### 2. LangGraph (AI Workflow Orchestration)
- State-driven agent orchestration with DAG execution
- Current CommanderAgent already mirrors LangGraph concepts
- Built-in: state checkpointing, time-travel debugging, HITL support
- Applicability: workflow-engine refactor (F-006) could adopt formal patterns

### 3. VS Code / Obsidian / Figma (Plugin Architecture)
- VS Code: Extension Host process isolation + well-defined API
- Obsidian: Markdown-first with JS plugin hooks
- Figma: Sandboxed JS/Wasm execution within declarative framework
- Applicability: Current SKILL.md system is already a declarative plugin model

## Extractable Patterns

### Pattern 1: State-Driven Agent Orchestration
- CommanderAgent routes to WorkflowLevels (L1-L5)
- TaskAssignment DAG with dependsOn relationships
- Resembles LangGraph's state machine approach
- **Recommendation for F-006**: Formalize state machine, extract orchestration from business logic

### Pattern 2: Declarative Plugin System
- SKILL.md defines workflows as decision trees in Markdown
- Secure by design (no arbitrary code execution)
- **Enhancement path**: Hybrid declarative/imperative (optional sandboxed JS for complex logic)

### Pattern 3: WebView + Detached Backend (Tauri + Sidecar)
- Tauri manages lightweight system WebView
- Node.js sidecar handles heavy AI computation
- Communication via invoke bridge (transport.ts)
- **Recommendation**: Retain current architecture, optimize sidecar communication

### Pattern 4: Editor Virtualization
- @tanstack/react-virtual already in dependencies
- Critical for large document performance
- Debounce state updates in Zustand store
- Code-split Tiptap extensions for lazy loading

## Architecture Approaches for M24

### Approach A: Tech Debt First (Recommended)
- Focus M24 entirely on code health
- Enables faster feature development in M25+
- Lower risk, high certainty of completion

### Approach B: Parallel Track
- 70% tech debt + 30% one new feature (narrative visualization)
- Higher complexity but delivers user-visible value
- Risk: scope creep if tech debt takes longer than expected

### Approach C: Feature-Led with Opportunistic Cleanup
- Lead with narrative visualization, clean up touched code
- Highest user value but may leave systemic debt unaddressed
- Not recommended given current debt level

## Common Pitfalls to Avoid

1. **Over-engineering the workflow refactor** — Keep the same API surface, just restructure internals
2. **Breaking i18n key paths** during translations split — Maintain exact key structure
3. **Premature abstraction** in component splits — Extract by domain, not by size alone
4. **Hot-reload complexity** for externalized catalog — Start with build-time JSON, add hot-reload later
5. **Scope creep** from "while we're at it" improvements — Strict feature boundaries
