# F-003 Docs Learning Paths

## 1. Requirements Summary

Docs SHOULD provide role-based learning paths for writers, developers, integrators, and maintainers.

## 2. Design Decisions

Learning paths reduce cognitive load by ordering pages. The homepage should expose short paths; category pages may include deeper paths.

Recommended paths:

- Writer: Installation -> Quickstart -> Writing Dashboard -> Craft Analysis -> Wiki System.
- Developer: System Overview -> Data Flow -> Gateway API -> Workspace API -> Health API.
- Integrator: Gateway API -> Agent API -> Workflow API -> Skill API -> Config API.
- Maintainer: Capability Status Matrix -> Release Notes -> Operations Runbook -> Docs Lint.

## 3. Interface Contract

Homepage SHOULD show a compact path section. Detailed guide page MAY list all paths.

## 4. Constraints & Risks

Paths must not duplicate full page content. They should route readers to canonical pages.

## 5. Acceptance Criteria

- At least 4 persona paths.
- Each path has 4-6 steps.
- Each step links to an existing or planned page.

## 6. Detailed Analysis References

- @product-manager/analysis.md
- @ux-expert/analysis.md

## 7. Cross-Feature Dependencies

Works best after F-001 introduces capability routing.
