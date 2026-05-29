# Context: M21 Phase 1 Docs Site Capability Routing + Architecture Deep Dive

## Source Inputs

- Roadmap: `.workflow/roadmap.md`
- Brainstorm: `.workflow/scratch/20260513-brainstorm-docs-site-detail-architecture-principles/`
- Feature specs: F-001..F-005
- Current docs-site content system: `docs-site/src/client/data/inventory.ts`, `docs-site/src/client/data/content-*.ts`, `docs-site/src/client/pages/LandingPage.tsx`
- Validation: `npm --prefix docs-site run build`

## Implementation Scope

Implement second-wave docs-site enhancement in one phase:

1. Add capability-routing guide based on role-routing-inspired pattern.
2. Deepen architecture/principles docs with runtime, request lifecycle, data authority, and boundaries.
3. Add or expose learning paths for writer/developer/integrator/maintainer readers.
4. Add capability status matrix or status labels.
5. Standardize diagrams, examples, troubleshooting, and related links.

## Key Constraints

- Do not change desktop runtime behavior, Gateway endpoints, sync implementation, or release pipeline.
- Avoid claiming roadmap/partial/historical features as fully shipped.
- Keep implementation inside docs-site content and navigation files unless validation requires small rendering support.
- Existing docs lint must pass.
