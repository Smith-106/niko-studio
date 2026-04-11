# LLM Wiki Adaptation for Niko Studio

## Purpose

This document adapts the [organized LLM Wiki post](./LLM_WIKI_POST_ORGANIZED.md) to Niko Studio's writer-first desktop contract in [README.md](../README.md).

It is a target-state contract, not a claim that wiki canon authority already exists in the shipped product.

## Current Reality

- Niko Studio currently ships as a writer-first desktop product with Story Bible, knowledge browsing, chat drafting, and workflow assistance.
- Workspace-scoped state exists, but it is not yet a file-backed canon wiki.
- Story Bible is not canon authority today. It is an author-facing workspace surface.
- Graph and memory are not canon authority today. They are support and projection surfaces.
- There is no current product contract for manual promotion into canon, claim-level provenance, stable canon page identity, or fallback when a canon store is unavailable.

## Target State

- Add a workspace-scoped, file-backed markdown canon for durable project knowledge.
- Keep the canon subordinate to the writer-first desktop product contract. It supports the writing workflow; it does not redefine the product.
- Make manual promotion the first authority transfer mechanism.
- Treat raw evidence as immutable input, canon pages as curated knowledge, and graph or memory as derived consumers.
- Keep Story Bible, knowledge surfaces, and chat as writer-facing entry points rather than a separate wiki app.

Minimal MVP shape:

```text
<workspaceRoot>/.writing/wiki/
  raw/
  pages/
  index.md
  log.md
```

## Authority Contract

- `README.md` and release docs remain the authority for shipped product and runtime claims.
- The wiki canon does not exist as a shipped authority today.
- After the MVP lands, knowledge authority should flow in this order:
  1. Raw evidence and explicit author decisions.
  2. Promoted canon pages in the workspace wiki.
  3. Writer-facing surfaces that render or reference canon.
  4. Graph and memory projections.
  5. Unpromoted chat answers, scratch notes, and drafts.
- Story Bible and workspace-scoped state are not automatically canon authority.
- Graph and memory never outrank the canon page they were derived from.
- If evidence conflicts, the conflict stays under review until a human approves the canon update.

## Promotion Contract

- Promotion into canon is explicit. The MVP is manual-promotion-first.
- Eligible inputs include Story Bible notes, manuscript excerpts, research notes, chat outputs, and evaluation findings.
- A promotion action must do three things:
  1. Preserve or reference the raw evidence.
  2. Create or update the relevant canon page.
  3. Append an inspectable log entry.
- The MVP must not silently sync Story Bible content into canon.
- The MVP must not auto-promote graph, memory, or chat output into canon.

## Provenance Contract

- Canon claims must point to raw evidence, an explicit author decision, or both.
- Claims without provenance remain drafts, inbox material, or review candidates, not canon.
- Canon maintenance should update existing pages instead of creating duplicate pages for the same entity or concept.
- Stronger automation depends on stable page identity and rename-safe links, but this document does not assume those guarantees already exist today.

## Fallback Contract

- If `workspaceRoot` or wiki storage is unavailable, Niko Studio falls back to Story Bible, chat, or local notes as non-canon assistance.
- If no canon page exists for a question, the system may use graph, memory, or raw evidence, but it must not label the result as canon.
- If canon and a projection disagree, canon wins and the projection is treated as stale until reviewed.
- If provenance is missing or ambiguous, the claim should be surfaced as draft or unverified.

## Non-Goals

- Shipping a separate wiki app.
- Replacing Story Bible as the primary authoring surface.
- Declaring current Story Bible data, workspace state, graph, or memory to be automatic canon authority.
- Silent background sync from every writer action into canon.
- Full ingest automation, automatic lint remediation, or automatic conflict resolution in the MVP.
- Recreating the full Obsidian product surface.

## Phased Rollout

### Phase 0: Contract Correction

- Rewrite the documentation so current reality and target state are separate.
- Define authority, promotion, provenance, and fallback before implementation work transfers authority.

Exit condition: the team agrees that Niko Studio does not already ship wiki canon authority.

### Phase 1: Manual-Promotion-First MVP

- Create the workspace-scoped, file-backed canon with `raw/`, `pages/`, `index.md`, and `log.md`.
- Add explicit "Promote to Canon" and "Review Canon" flows from existing writer-facing surfaces.
- Keep all authority transfer inspectable and reversible.

Exit condition: promoted canon pages are provenance-backed and manually reviewable.

### Phase 2: Canon-First Retrieval and Inspectable Projections

- Prefer canon pages for answers when canon exists.
- Add graph and memory projections that clearly point back to canon pages and source evidence.
- Keep projections advisory until traceability is proven.

Exit condition: projections are inspectable and never outrank canon.

### Phase 3: Conflict Review and Limited Automation

- Add conflict review, stale projection detection, page identity hardening, and rename-safe maintenance.
- Add selective ingest or lint automation only after authority and provenance remain inspectable under degraded cases.

Exit condition: automation improves maintenance cost without creating silent authority transfer.
