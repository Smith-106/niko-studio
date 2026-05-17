# Synthesis Changelog

## Inputs

- User topic: 文档站内容更加详细，架构、原理等等。
- Reference: Maestro Flow role-routing guide URL. The page returned 404 during research, so synthesis used extracted public pattern: concept -> routing rules -> registry -> examples -> troubleshooting.
- Project context: README, API_REFERENCE, .workflow/state.json.

## Enhancements Applied

- EP-001: Adapt role-routing to Niko Studio capability routing.
- EP-002: Add architecture truth and authority source rules.
- EP-003: Add persona-based learning paths.
- EP-004: Add public capability status matrix to prevent overclaiming.
- EP-005: Standardize Mermaid diagrams, tables, examples, and troubleshooting sections.

## Conflicts Resolved

- [RESOLVED] Writer-facing docs vs developer docs: use progressive disclosure and persona paths.
- [RESOLVED] Current architecture vs historical docs: current runtime truth wins; historical references must be labeled.
- [RESOLVED] Mermaid rendering vs dependency risk: use copyable Mermaid code blocks first; renderer is optional later.

## Review Notes

Complexity score: 5/8 because this touches IA, architecture explanation, status governance, and API accuracy. Implementation should be staged: F-001 + F-002 first, then F-003/F-004/F-005.
