# UX Expert Analysis

## Role Summary

The docs experience SHOULD teach by progressive disclosure: overview first, then routing, then architecture, then API details. Writers and developers should not be forced through the same path.

## Information Architecture

Recommended top-level additions:

1. Start Here
   - What is Niko Studio?
   - 5-minute writing loop
   - Choose your path
2. Concepts
   - Workspace
   - Capability routing
   - Canon/Wiki authority
   - Gateway runtime
3. Architecture
   - Runtime layers
   - Data flow
   - Request lifecycle
   - State authority
4. Capability Guides
   - Writing intelligence
   - Critic and revision
   - Graph and relationships
   - Memory and materials
   - Wiki / Story Bible
   - Workflow automation
5. API Reference
   - Endpoint groups
   - Examples
   - Errors/troubleshooting

## Page Template

Each detailed page SHOULD follow this order:

1. What problem this solves.
2. Mental model diagram.
3. When to use it.
4. How it works internally.
5. Example workflow.
6. API/component references.
7. Status and limitations.
8. Troubleshooting.
9. Related pages.

## Visual System

- Use Mermaid diagrams for architecture and flow because they are reviewable in source.
- Use routing tables for user intent mapping.
- Use status badges or tables for capability maturity.
- Use scenario cards for writer-facing workflows.
- Avoid screenshot dependence unless screenshots are refreshed and sanitized.

## UX Risks

- Long pages without progressive headings will feel like implementation dumps.
- Architecture diagrams without a reading guide are intimidating.
- API pages without examples force developers to infer too much.
- Internal artifact names should be linked only when helpful; user-facing concepts should lead.
