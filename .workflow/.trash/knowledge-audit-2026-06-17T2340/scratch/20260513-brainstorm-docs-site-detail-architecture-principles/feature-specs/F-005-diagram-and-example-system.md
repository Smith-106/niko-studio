# F-005 Diagram and Example System

## 1. Requirements Summary

Docs SHOULD standardize diagrams, examples, and troubleshooting tables so detailed pages remain consistent and maintainable.

## 2. Design Decisions

Diagram types:

- Flowchart: capability routing, writing loop, sync flow.
- Sequence diagram: request lifecycle, streaming, workflow execution.
- Table: routing rules, status matrix, endpoint group summary.
- Scenario card: writer-facing examples.

Example sections should show realistic inputs and expected outputs without secrets.

## 3. Interface Contract

The existing HTML-string content system can support Mermaid as copyable code blocks immediately. A future renderer MAY transform Mermaid blocks visually.

## 4. Constraints & Risks

Do not add screenshot dependencies unless screenshots are current, sanitized, and stored under docs-site public assets.

## 5. Acceptance Criteria

- Defines at least 4 diagram patterns.
- Defines at least 3 example patterns: writer scenario, API request, troubleshooting case.
- Adds guidance for no external scripts in self-contained examples.

## 6. Detailed Analysis References

- @system-architect/analysis.md
- @ux-expert/analysis.md

## 7. Cross-Feature Dependencies

Supports F-001, F-002, and F-003.
