# F-002 Architecture Principles Deep Dive

## 1. Requirements Summary

Architecture docs MUST explain runtime layers, boundaries, request lifecycle, state authority, and current vs historical architecture truth.

## 2. Design Decisions

The architecture section should be split into digestible pages:

- Runtime Layers: Tauri, React, Gateway, intelligence modules, local storage, model providers.
- Request Lifecycle: chat, stream, analyze, memory search, workflow execution.
- Data Authority: workspace, document, Wiki/canon, graph projection, memory retrieval.
- Security/Boundary: frontend permissions, Gateway boundary, secrets, local storage.

Each page SHOULD start with a diagram and a one-paragraph summary.

## 3. Interface Contract

Use Mermaid code blocks initially. If Mermaid rendering is later added, existing blocks should become renderable without content migration.

## 4. Constraints & Risks

Historical docs MUST be labeled as historical or design reference. Current runtime truth MUST be sourced from README, CAPABILITY_MATRIX, API_REFERENCE, and operations runbooks.

## 5. Acceptance Criteria

- System overview has runtime layer diagram.
- Data flow has at least one sequence diagram.
- Architecture pages mention current authority sources.
- Historical/partial surfaces are clearly labeled.

## 6. Detailed Analysis References

- @system-architect/analysis.md
- @ux-expert/analysis.md

## 7. Cross-Feature Dependencies

Feeds F-001 routing and F-003 learning paths.
