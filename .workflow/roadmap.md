# Roadmap: Niko-Studio M11

## Overview

M11 completes the writing intelligence vision by connecting M10's backend services to the desktop UI, enriching cross-chapter analysis with timeline and trait drift detection, and activating the deferred external integrations (embedding search, graph queries) for production use.

## Phases

- [x] **Phase 1: UI Integration & Analysis Completion** — Wire M10 API clients into EvaluationPanel, AnalysisPanel, and Settings; implement timeline/trait drift detection; activate external integrations

## Phase Details

### Phase 1: UI Integration & Analysis Completion
**Goal**: Make M10's deep writing intelligence features fully accessible from the desktop UI and complete the cross-chapter analysis capabilities.
**Depends on**: M10 (completed)

**Success Criteria**:
1. EvaluationPanel has multi-pass revision controls: target score input, max iterations, progress display showing score per iteration
2. AnalysisPanel has cross-chapter consistency tab showing name conflicts, timeline issues, unresolved threads, and trait drifts with chapter references
3. Settings/Profile section allows extracting and viewing style profiles for the current project
4. ChatArea shows context-aware suggestion indicators when M10 analysis is available
5. Timeline analysis and trait drift detection produce meaningful results (not empty arrays)
6. External integrations (embedding search, graph queries) activated for production use in consistency checking and context assembly
7. All new UI surfaces have i18n keys in both zh-CN and en-US
8. No regression in existing capabilities

## Scope Decisions

- **In scope**:
  - EvaluationPanel multi-pass revision controls
  - AnalysisPanel cross-chapter consistency display
  - Style profile management in Settings/Knowledge
  - Context-aware indicators in ChatArea
  - Timeline analysis implementation
  - Trait drift detection implementation
  - External integration activation (embedding search, graph queries)
  - i18n for all new UI
  - End-to-end tests for UI integration

- **Deferred**:
  - Plugin/extension architecture
  - Cloud sync / multi-device
  - Code signing production CA cert

- **Out of scope**:
  - Mobile companion
  - Multi-user collaboration
  - LLM fine-tuning

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. UI Integration & Analysis Completion | Done | 2026-05-06 |
