# Roadmap: Niko Studio Docs Site Detail Architecture Principles

## Overview

This roadmap turns the docs site into a more detailed documentation hub for writers and developers. It builds directly on the brainstorm specs for capability routing, architecture/principles deep dives, learning paths, status matrix, and reusable diagram/example patterns. The work is intentionally kept in one phase because all features share the same docs-site information architecture and can be ordered through task waves instead of phase barriers.

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases count toward the total phase limit.

- [ ] **Phase 1: Docs Site Capability Routing + Architecture Deep Dive** - Add role-routing-inspired capability guidance, architecture/principles pages, learning paths, status matrix, and reusable diagram/example conventions.

## Phase Details

### Phase 1: Docs Site Capability Routing + Architecture Deep Dive
**Goal**: Deliver a second-wave docs-site enhancement that lets readers understand what Niko Studio does, which capability to use, how the desktop/Gateway/knowledge systems work, and what is shipped versus partial or historical.
**Depends on**: Nothing (first phase)
**Requirements**: F-001, F-002, F-003, F-004, F-005
**Success Criteria** (what must be TRUE):
  1. Docs site includes a capability-routing guide that maps user intent to Niko Studio capability, UI/API entry, and next docs page.
  2. Architecture docs explain runtime layers, request lifecycle, data authority, Gateway boundaries, and current-vs-historical architecture status with diagrams.
  3. Homepage or guide pages provide role-based learning paths for writers, developers, integrators, and maintainers.
  4. Capability docs expose status labels or a matrix for supported, partial, experimental, historical, and roadmap capabilities.
  5. Detailed pages use consistent Mermaid diagrams, routing tables, realistic examples, troubleshooting notes, and related links.
  6. `npm --prefix docs-site run build` passes after implementation.

## Scope Decisions

- **In scope**:
  - New or expanded docs-site content for capability routing, architecture/principles, learning paths, status matrix, and diagram/example conventions.
  - Updates to docs-site inventory/content files when new pages are required.
  - Alignment with `README.md`, `docs/API_REFERENCE.md`, `docs/CAPABILITY_MATRIX.md`, and brainstorm feature specs.
  - Docs lint/build validation.

- **Deferred**:
  - Mermaid visual rendering dependency; copyable Mermaid code blocks are sufficient for this phase.
  - New screenshots, unless existing screenshots are verified as current and sanitized.
  - Automated API doc generation from source code.

- **Out of scope**:
  - Changes to desktop product behavior, Gateway endpoints, sync implementation, or release pipeline.
  - Rewriting historical architecture docs outside the docs-site unless needed for source-of-truth links.
  - Publishing or deployment; release can happen after implementation validation.

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Docs Site Capability Routing + Architecture Deep Dive | Not started | - |
