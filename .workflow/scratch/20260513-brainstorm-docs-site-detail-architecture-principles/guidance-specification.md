# Guidance Specification: Docs Site Detail, Architecture, and Principles

## Project Positioning & Goals

Niko Studio docs site MUST evolve from a page inventory into a learning-oriented product and developer documentation hub. The user goal is to make the docs more detailed, especially around architecture, principles, capability routing, and explanatory diagrams, while using Maestro Flow role-routing style as a reference for structured explanation.

Success means a reader can answer:

- What is Niko Studio?
- How does the desktop product work end to end?
- Which capability should I use for a writing task?
- How do frontend, Gateway, knowledge engine, Agent, Wiki, memory, graph, and workflow relate?
- What is shipped, partial, experimental, or roadmap-only?

## Concepts & Terminology

| Term | Definition | Category |
|---|---|---|
| Documentation Hub | The docs-site entry experience that routes users by task, capability, and technical depth. | core |
| Capability Routing | A documentation pattern that maps user intent to product capability, API, component, and troubleshooting page. | core |
| Desktop Runtime | The shipped product path: Tauri desktop host + React frontend + local Node/TypeScript Gateway. | technical |
| Gateway | Local HTTP boundary for config, health, chat, memory, graph, Agent, workflow, and model access. | technical |
| Writing Intelligence | Craft, narrative, character, scene, dialogue, critic, and web-novel analysis capabilities. | core |
| Canon / Wiki | Author-confirmed long-term story knowledge that outranks temporary chat answers and derived graph/memory projections. | business |
| Projection Surface | Graph or memory view derived from source/canon data, useful for discovery but not final authority. | technical |
| Release Truth | Current capability status validated by README, CAPABILITY_MATRIX, release notes, and runbooks. | business |

## Non-Goals

- The docs MUST NOT claim roadmap-only or partial features as fully shipped.
- The docs MUST NOT copy Maestro Flow internals verbatim; it SHOULD adapt the explanation structure to Niko Studio.
- The docs MUST NOT replace source API references with stale hand-written endpoint guesses.
- The docs SHOULD NOT introduce new docs-site dependencies unless rendering value is clearly higher than plain HTML/code blocks.
- The docs MUST NOT expose secrets, local private paths, or internal failure artifacts as public user-facing guidance.

## Selected Roles

Auto mode selected three roles by default:

1. Product Manager — structure, user journeys, priority, public messaging.
2. System Architect — architecture, data flow, routing model, status truth.
3. UX Expert — information architecture, learning path, diagrams, navigation.

## Feature Decomposition

| ID | Slug | Priority | Description | Related Roles |
|---|---|---|---|---|
| F-001 | capability-routing-guide | P0 | Add a role-routing-inspired guide that maps user intent to Niko Studio writing, knowledge, Agent, Wiki, workflow, and API capabilities. | product-manager, system-architect, ux-expert |
| F-002 | architecture-principles-deep-dive | P0 | Expand architecture docs with runtime layers, boundaries, data flow, state authority, and Mermaid diagrams. | system-architect, ux-expert |
| F-003 | docs-learning-paths | P1 | Add learning paths for writers, developers, integrators, and maintainers. | product-manager, ux-expert |
| F-004 | capability-status-matrix | P1 | Surface shipped/partial/experimental/historical status in user-facing docs to reduce overclaiming. | product-manager, system-architect |
| F-005 | diagram-and-example-system | P1 | Standardize diagrams, endpoint examples, request lifecycle examples, and troubleshooting tables across pages. | system-architect, ux-expert |

## Cross-Role Integration

The docs SHOULD use a consistent page template:

1. Concept: what problem this page solves.
2. Mental model: diagram or table.
3. How it works: architecture/principle explanation.
4. When to use: capability routing rules.
5. Example: realistic writing or API scenario.
6. Boundaries: shipped/partial/experimental notes.
7. Related pages: next reading links.

## Risks & Constraints

- Accuracy risk: current source docs include historical architecture references. Pages MUST cite current runtime truth before using historical diagrams.
- Scope risk: adding many pages at once can create drift. Implementation SHOULD start with 5 feature pages and use existing docs lint.
- UX risk: overly technical pages can overwhelm writers. Pages SHOULD provide role-based reading paths.
- Maintenance risk: API endpoint lists SHOULD be generated or checked against `docs/API_REFERENCE.md` and `docs-site/scripts/docs-lint.mjs`.

## Appendix: Decision Tracking

- CONFIRMED: The user wants more detailed docs-site content about architecture and principles.
- CONFIRMED: Reference style is Maestro Flow role-routing style, adapted to Niko Studio.
- SELECTED: Default roles are product-manager, system-architect, ux-expert.
- SELECTED: Use scratch artifacts only; do not modify source code during brainstorming.
