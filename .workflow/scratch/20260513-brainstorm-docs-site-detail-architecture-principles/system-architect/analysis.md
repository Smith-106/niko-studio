# System Architect Analysis

## Role Summary

The docs MUST present current architecture truth: `desktop/` + Tauri host + local Node/TypeScript Gateway. Historical Python or browser-first surfaces MAY be mentioned only as compatibility or historical references when relevant.

## Data Model

| Entity | Purpose | Relationships |
|---|---|---|
| Workspace | Current project boundary for manuscript, settings, material, and cache. | Owns documents, materials, Wiki pages, analysis cache. |
| Document | Manuscript unit such as chapter or scene. | Belongs to workspace; produces analysis requests. |
| Capability | Product/API feature such as writing, critic, graph, memory, wiki, workflow. | Exposed by docs page, Gateway endpoint, and UI entry. |
| Canon Page | Author-confirmed long-term story knowledge. | Derived from raw evidence; feeds graph/memory projections. |
| Analysis Result | Structured response with score, evidence, suggestion, metadata. | Rendered in dashboard; may reference knowledge and canon. |

## State Machine

```text
[Reader Intent]
  -> [Choose Reader Path]
  -> [Capability Route]
  -> [Architecture/API Detail]
  -> [Example/Troubleshooting]
  -> [Next Page]
```

| From | Event | To |
|---|---|---|
| Reader Intent | writer task | Capability Route |
| Reader Intent | developer task | Architecture/API Detail |
| Capability Route | selected capability | Example/Troubleshooting |
| Architecture/API Detail | needs status | Capability Status Matrix |
| Example/Troubleshooting | unresolved issue | Related Docs / API |

## Architecture Requirements

- Docs MUST show a runtime layer diagram: Tauri host, React frontend, Gateway, intelligence modules, local storage, model providers.
- Docs MUST show request lifecycle diagrams for chat/stream/analyze operations.
- Docs MUST clarify authority order for Wiki/canon, graph projection, memory retrieval, and chat answers.
- API pages SHOULD include endpoint groups, request lifecycle, response shape, and failure behavior.
- Diagrams SHOULD be Mermaid-compatible and copyable, unless a visual renderer is added later.

## Observability / Maintenance Metrics

- Docs lint pass/fail.
- Number of pages with status labels.
- Number of API endpoint examples aligned with `docs/API_REFERENCE.md`.
- Broken link count.
- Pages with diagrams vs pages needing diagrams.
- Capability pages missing troubleshooting sections.

## Boundary Scenarios

- If Gateway is down, docs MUST route user to health check and local runtime troubleshooting.
- If model is unavailable, docs SHOULD explain config/model checks before suggesting code changes.
- If graph conflicts with Wiki, docs MUST state Wiki/canon authority wins.
- If a feature is experimental, docs MUST label it and avoid production promises.
