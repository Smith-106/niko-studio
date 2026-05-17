# Design Research: Role-Routing-Inspired Docs Pattern

## Reference Status

The requested reference page `https://catlog22.github.io/maestro-flow/guides/role-routing` returned 404 during research. Available public traces around Maestro Flow still suggest a useful documentation pattern: explain a concept, show routing rules, provide a registry/matrix, then give concrete examples and failure cases.

## Reference Projects / Implementations

### Maestro Flow role routing pattern

Likely structure:

1. User command or intent enters a unified command.
2. Router resolves explicit role, capability role, or default coordinator.
3. Role registry maps role IDs to role specs.
4. Worker executes role-specific lifecycle.
5. Failure states are explicit: missing role, unknown route, invalid mode.

### Documentation pattern to extract

| Pattern | Transfer to Niko Studio |
|---|---|
| Route table | Map writer intent to Niko Studio capability, page, component, and API. |
| Default route | Explain what happens when user just asks AI to help without selecting a tool. |
| Registry | Capability matrix: writing, critic, graph, memory, wiki, workflow, sync, config. |
| Failure behavior | Troubleshooting table: unavailable model, empty workspace, missing Gateway, stale canon. |
| Examples | Scenario cards: revise a scene, inspect character arc, query canon, run workflow. |

## Extractable Patterns

### Pattern 1: Concept before mechanics

Niko Studio pages SHOULD explain the writing problem first, then the internal implementation.

### Pattern 2: Routing as a decision table

A capability routing guide SHOULD include:

| User intent | Use capability | Why | API / page |
|---|---|---|---|
| Improve a scene | Writing + Critic | Needs evidence and revision loop | writing-api, critic-api |
| Check consistency | Wiki + Graph + Critic | Needs canon and relationship projection | wiki-api, graph-api |
| Ask for contextual draft | Agent + Memory | Needs workspace context and model | agent-api, memory-api |

### Pattern 3: Architecture diagrams as navigational tools

Diagrams SHOULD show where to go next, not just how code is arranged.

### Pattern 4: Status-aware docs

Every advanced capability page SHOULD mark status: shipped, partial, experimental, historical, or roadmap.

## Common Pitfalls

- Copying CLI role-routing terminology directly into writer-facing docs.
- Over-indexing on internal folders instead of user tasks.
- Publishing diagrams without status labels.
- Letting API lists drift from `docs/API_REFERENCE.md`.
- Hiding failure behavior; readers need to know what to do when Gateway, model, or workspace context is missing.
