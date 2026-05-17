# F-001 Capability Routing Guide

## 1. Requirements Summary

The docs site MUST include a role-routing-inspired capability routing guide for Niko Studio. It SHOULD map reader intent to product capability, UI entry, API entry, and related documentation.

## 2. Design Decisions

The guide should not explain internal Maestro roles. Instead, it should adapt the pattern: intent enters a router, router maps to capability, capability links to implementation and examples.

Recommended sections:

1. What capability routing means in Niko Studio.
2. User intent table.
3. Capability registry.
4. Default route when the user is unsure.
5. Examples.
6. Troubleshooting.

Routing table example:

| User intent | Recommended capability | UI entry | API/docs |
|---|---|---|---|
| Improve a scene | Writing + Critic | Writing panel | writing-api, critic-api |
| Check character consistency | Wiki + Graph + Critic | Story Bible, Graph | wiki-api, graph-api |
| Ask for contextual drafting | Agent + Memory | Chat | agent-api, memory-api |
| Automate a repeated workflow | Workflow + Skill | Skill panel | workflow-api, skill-api |

## 3. Interface Contract

The page SHOULD be added under architecture or a new concepts/guides category. It MUST link to writing, critic, graph, memory, wiki, agent, workflow, and API pages.

## 4. Constraints & Risks

It MUST avoid copying Maestro Flow CLI-specific language. It SHOULD use writer-facing labels first and developer labels second.

## 5. Acceptance Criteria

- Routing table covers at least 8 user intents.
- Includes a Mermaid flowchart.
- Includes failure behavior for unknown intent, missing model, missing workspace, and stale context.

## 6. Detailed Analysis References

- @product-manager/analysis.md
- @system-architect/analysis.md
- @ux-expert/analysis.md

## 7. Cross-Feature Dependencies

Depends on F-004 for status labels and F-005 for diagram/table conventions.
