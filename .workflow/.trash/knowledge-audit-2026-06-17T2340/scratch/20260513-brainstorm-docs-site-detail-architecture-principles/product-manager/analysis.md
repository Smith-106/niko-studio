# Product Manager Analysis

## Role Summary

The docs-site SHOULD become a product adoption surface, not just a reference catalog. The key product problem is reader orientation: writers need to understand what to do next, while developers need to understand runtime boundaries and extension points.

## Product Decisions

- The landing page MUST explain Niko Studio in one sentence and route readers by role: Writer, Developer, Integrator, Maintainer.
- Capability pages SHOULD use scenario-first copy: start with a user task, then show capability, status, and deeper technical links.
- Public docs MUST distinguish shipped, partial, experimental, historical, and roadmap capability status.
- The reference role-routing page SHOULD inspire a Niko-specific capability-routing guide, not a CLI role router clone.

## Feature Priorities

1. F-001 Capability Routing Guide is P0 because it makes the whole docs site navigable.
2. F-002 Architecture Principles Deep Dive is P0 because it prevents confusion around desktop, Gateway, old architecture docs, and current runtime truth.
3. F-004 Capability Status Matrix is P1 but high-risk if delayed, because docs can overclaim partial features.

## Suggested Reader Journeys

| Reader | Start | Then | Goal |
|---|---|---|---|
| Writer | Quickstart | Writing Dashboard | Complete first analysis loop. |
| Power writer | Capability Routing | Wiki System | Build long-term story knowledge. |
| Developer | System Overview | Gateway API | Understand runtime/API boundary. |
| Integrator | API Reference | Workflow API | Automate writing tasks. |
| Maintainer | Capability Matrix | Release/runbook docs | Keep public claims accurate. |

## Risks

- Marketing-style docs can weaken trust if they do not show boundaries.
- Too much architecture on first-read pages can overwhelm writers.
- Feature docs without status badges will age poorly.
