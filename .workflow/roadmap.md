# Roadmap: Niko-Studio M10

## Overview

M10 builds on M9's workflow/agent framework to deliver deep writing intelligence — multi-pass autonomous revision, style learning, cross-chapter consistency checking, and context-aware writing assistance. This milestone transforms the agent system from basic dispatch into a capable writing partner that understands story structure, maintains narrative consistency, and adapts to the author's voice.

## Phases

**Minimum-phase principle:** 1 phase. All features share the same agent infrastructure and can be parallelized via wave DAG — no hard dependency boundary warrants a split.

- [ ] **Phase 1: Deep Writing Intelligence** — Multi-pass revision engine, style learning, consistency checking, context-aware suggestions

## Phase Details

### Phase 1: Deep Writing Intelligence
**Goal**: Transform the agent system into a capable autonomous writing partner with quality gates, style adaptation, and cross-chapter awareness.
**Depends on**: Nothing (builds on M9's existing agent/workflow infrastructure)
**Requirements**: M10-REQ-001 through M10-REQ-008

**Success Criteria** (what must be TRUE):
1. Agent can autonomously revise a draft through multiple passes (draft → evaluate → revise → verify) with configurable quality gates, converging on target scores without human intervention
2. Style analysis extracts measurable writing patterns (sentence length distribution, vocabulary richness, dialogue ratio, tense preference) from user-provided writing samples and applies them to new generation
3. Cross-chapter consistency checker detects character name conflicts, timeline contradictions, unresolved plot threads, and trait drift across the full manuscript
4. Context-aware writing suggestions incorporate story bible entries, memory bank, character profiles, and plot structure when generating recommendations
5. All new features are accessible via existing MCP endpoints and integrated into the desktop UI (chat panel, evaluation panel, knowledge tabs)
6. Test coverage ≥ 80% for all new modules with integration tests validating agent end-to-end flows
7. No regression in existing M1-M9 capabilities (verified by existing test suite)

## Scope Decisions

- **In scope**:
  - Multi-pass revision engine with quality gates
  - Style analysis and learning module
  - Cross-chapter consistency checker
  - Context-aware suggestion engine (story bible + memory integration)
  - Desktop UI integration for all new features
  - MCP endpoint extensions for new capabilities
  - Test infrastructure for agent validation

- **Deferred**:
  - External integration activation (postgres, redis, ES, neo4j — remain experimental)
  - Plugin/extension architecture for user-created skills
  - Cloud sync / multi-device support
  - Code signing production CA cert procurement

- **Out of scope**:
  - Mobile companion app
  - Multi-user collaboration features
  - Publishing platform integrations (beyond existing export)
  - LLM fine-tuning or custom model training

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Deep Writing Intelligence | Not started | - |
