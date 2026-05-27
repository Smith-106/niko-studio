# Capability Matrix

**Status**: Authoritative single-source matrix for what Niko-Studio currently ships.
**Maintainer**: Updated alongside release tags. Cross-referenced (not duplicated) by `README.md`, `desktop/README.md`, `docs/release/SIGN_OFF.md`, and `docs/PRODUCTION_READINESS_TODO.md`.
**Schema** (status legend):

| Symbol | Label         | Meaning                                                                                  |
|--------|---------------|------------------------------------------------------------------------------------------|
| ✅      | supported     | Production-ready on the supported runtime; covered by tests + release-check signals.     |
| 🟡      | partial       | Functionally available but with documented limits (e.g. CJK path, manual operator step). |
| 🧪      | experimental  | Behind a flag; forced off in production runtime. May change without notice.              |
| ⛔      | disabled      | Code/stub exists but is gated off by policy; never silently activates.                   |
| 📜      | historical    | Retained for migration/reference only. Not part of current shipped surface.              |

---

## 1. Writer-Facing Capabilities (Desktop UI + Gateway)

| Capability                              | Status | Source of truth                                              | Notes                                                                                            |
|-----------------------------------------|:------:|--------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Conversational chat (LLM)               |   ✅    | `desktop/src/components/ChatArea.tsx`, `src-ts/mcp/endpoints/chat.ts` | Streaming + non-streaming; message persistence via IndexedDB.                                    |
| Writing Helper panel                    |   ✅    | `desktop/src/components/WritingHelperPanel.tsx`              | Multi-mode prompts; result persistence; skill-pack chips on result.                              |
| Skill packs (selection + application)   |   ✅    | `desktop/src/components/ChatAreaModeControls.tsx:149-167`, `WritingHelperPanel.tsx:1169-1197` | Dual surface (chat bar + helper panel); ISS-20260428-005 closed.                                 |
| Character analysis (5-dimension)        |   ✅    | `src-ts/narrative/character-manager.ts`                      | Explicit degraded mode when LLM unavailable (ISS-20260428-007 closed).                           |
| Knowledge tab (skill browse)            |   ✅    | `desktop/src/components/knowledge/SkillTab.tsx`              |                                                                                                  |
| Memory / search (single workspace)      |   ✅    | `src-ts/memory/unified-memory.ts`                            | Embedding fallback returns zero vector + warns; never throws.                                    |
| Multi-workspace MCP cache isolation     |   ✅    | `src-ts/mcp/services/workflow.ts:87-128`                     | Per-workspace cache map; cross-workspace bleed prevented (ISS-20260426-004 closed via tests).    |
| Workflow scheduler / lite-plan import   |   ✅    | `src-ts/mcp/services/workflow.ts` workflowSchedulerImportLitePlan | Authority-bound scheduler tasks; cross-workspace authority enforcement.                          |
| Import Learning (CAP-001)               |   ✅    | `src-ts/learning/import-pipeline.ts`, `src-ts/learning/extraction-utils.ts` | DocumentParser → EntityExtractor → StyleExtractor → WorldviewExtractor → DistillationPipeline. |
| Self-Evolving Writing (CAP-002)         |   ✅    | `src-ts/learning/self-evolving-agent.ts`, `src-ts/learning/rule-evolver.ts` | RuleEvolver + PreferenceTracker + StyleDriftDetector; Generator-Reflector-Curator loop.        |
| Reading Learning (CAP-003)              |   ✅    | `src-ts/learning/reading-pipeline.ts`, `src-ts/learning/spoiler-gate.ts` | SessionTracker → SpoilerGate (chapter-gated) → Light/HeavyExtractor → InsightDistiller (6-stage). |
| Learning Orchestrator                   |   ✅    | `src-ts/learning/learning-orchestrator.ts` | Unified pipeline orchestration; register/enable/disable by capability.                          |
| PhaseOrchestrator + Workflow Gate       |   ✅    | `src-ts/workflow/phase-orchestrator.ts` | Soft/hard gate evaluation; fix-retry exhaustion auto-force-complete.                            |
| DelegateBroker                          |   ✅    | `src-ts/workflow/delegate-broker.ts` | Task delegation, status tracking, result collection.                                            |
| WorkflowEventRelay (WebSocket)          |   ✅    | `src-ts/mcp/services/gateway-ws.ts` | Real-time status push; event type filtering; ping/pong heartbeat.                               |
| HookRegistry + HookType                 |   ✅    | `src-ts/workflow/hook-registry.ts` | WorkflowEngine constructor injection; extensible hook types.                                     |
| Narrative Visualization (MVP)           |   ✅    | `desktop/src/components/narrative/` | TimelineView (zoom+filter), TensionCurveView, CharacterGraphView (interactive).                 |
| Hook/Cliffhanger Detection              |   ✅    | `src-ts/narrative/hook-cliffhanger-detector.ts` | Hook strength scoring, cliffhanger type classification, reader-state model.                     |
| Voice Fingerprint                       |   ✅    | `src-ts/narrative/voice-fingerprint.ts` | Character voice consistency analysis; decoration markers.                                        |
| Emotional Arc Analysis                  |   ✅    | `src-ts/narrative/emotional-arc.ts` | Emotion trajectory tracking; show/tell ratio; immersion scoring.                                 |
| Dialogue Quality Analyzer               |   ✅    | `src-ts/narrative/dialogue-analyzer.ts` | 5-dimension dialogue quality: naturalness, distinctness, subtext, functionality, rhythm.        |
| Scene Quality Assessment                |   ✅    | `src-ts/narrative/scene-quality.ts` | 5-dimension scene quality: pacing, atmosphere, conflict density, info efficiency, change.        |
| Mystery Subtype Classification           |   ✅    | `src-ts/narrative/mystery-classifier.ts` | 4 types: honkaku, social faction, hardboiled, thriller; deduction chain analysis.               |
| Nowledge Mem 集成协议                    |   🧪   | `src-ts/protocols/nowledge-mem.ts` | `INowledgeMemService` 接口定义 + CLI 适配器测试; 实现待接入.                                      |
| Composition Root (控制平面解耦)           |   ✅    | `src-ts/composition-root/gateway-control-plane.ts` | container↔mcp 双向依赖重构; 独立 wiring 层.                                                    |

## 2. External Integration Adapters

| Adapter                       | Status | Source of truth                                | Behavior                                                                                                                  |
|-------------------------------|:------:|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| postgres-shadow               |   🧪   | `src-ts/integrations/adapters.ts:97-146`       | Experimental; in `NIKO_ENV=production` forced `enabled=false` with code `INTEGRATION_EXPERIMENTAL_DISABLED_IN_PRODUCTION`. |
| redis-cache-rate-limit        |   🧪   | same                                           | Same gating.                                                                                                              |
| elasticsearch-search          |   🧪   | same                                           | Same gating; degraded local retrieval fallback when not active.                                                           |
| neo4j-projection              |   ⛔    | same                                           | `INTEGRATION_DISABLED_BY_POLICY`; stub returns false / null / empty arrays. Consumer guard at `src-ts/graph/graph-engine.ts:1312-1327`. |
| langflow-orchestration        |   ⛔    | same                                           | Same.                                                                                                                     |
| dbhub-governance              |   ⛔    | same                                           | Same.                                                                                                                     |

> Production code paths cannot silently fall into half-implemented integrations — `isProductionRuntime()` + `INTEGRATION_POLICY` enforce the gating. ISS-20260428-006 closed.

## 3. Desktop Runtime / Packaging

| Capability                              | Status | Source of truth                                                  | Notes                                                                                                          |
|-----------------------------------------|:------:|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| Tauri 2 desktop host                    |   ✅    | `desktop/src-tauri/`                                             | NSIS + 2 MSIs (en-US, zh-CN) per release.                                                                      |
| Bundled portable Node 20 sidecar        |   ✅    | `desktop/scripts/build_node_sidecar.cjs`, `NIKO_SIDECAR_BUNDLE_NODE=true` | No host Node install required (ISS-20260430-001 closed in v9.2.2).                                             |
| Rust launcher → Node TS gateway         |   ✅    | `desktop/src-tauri/src/bin/niko-gateway-launcher.rs`             | 216 KB launcher; multi-path resolution for NSIS install layouts.                                               |
| Native module ABI alignment             |   ✅    | `npm_config_target` injection                                    | better-sqlite3 NODE_MODULE_VERSION 115 (Node 20).                                                              |
| Layer 4 packaged-app smoke (CI)         |   ✅    | `.github/workflows/integration-tests.yml` `packaged-app-smoke` job, `scripts/packaged_app_smoke.py` | Blocking gate since v9.2.2; verifies install → launch → /health → CORS.                                        |
| Code signing (Windows Authenticode)     |   🟡   | `scripts/generate_signed_tauri_config.py`, `docs/operations/CODE_SIGNING.md` | Self-signed dry-run path implemented (v9.2.4); production CA cert procurement still open (ISS-20260428-004).   |
| SmartScreen warning on first install    |   🟡   | (consequence of unsigned EXE)                                    | Users must click "More info → Run anyway" until ISS-20260428-004 closes.                                       |

## 4. Release / Sign-off

| Capability                              | Status | Source of truth                                                  | Notes                                                                                          |
|-----------------------------------------|:------:|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Release-check summary scorecard         |   ✅    | `scripts/release_check_summary.py`, `release-check-summary.md`   | 30+ deterministic signals; GO/NO_GO contract.                                                  |
| Authority alignment (docs ↔ code)       |   ✅    | `scripts/check_authority_alignment.py`                           | Blocking P0 signal.                                                                            |
| Same-head evidence freshness            |   ✅    | `scripts/refresh_release_evidence.py`                            | Single operator path (ISS-20260428-009 closed).                                                |
| Installed-package E2E acceptance        |   ✅    | `npm --prefix desktop run package:e2e:checklist`, `docs/operations/E2E_VERIFICATION.md` | Retained evidence in `.workflow/evidence/release/package-e2e-acceptance.json`.                 |
| Dependabot dependency updates           |   ✅    | `.github/dependabot.yml`                                         | Monthly cadence across 5 ecosystems (npm × 2, cargo, pip, github-actions). ISS-20260428-012.   |
| `src-ts` audit:high (CI)                |   ✅    | `.github/workflows/integration-tests.yml`                        | Both desktop + src-ts run `npm audit --audit-level=high`. ISS-20260428-011.                    |
| Local pre-commit hook                   |   ✅    | `.pre-commit-config.yaml`, `scripts/run_local_pre_commit.py`     | eslint --max-warnings 0 + prettier --check + ruff (F, I) on changed scope.                     |
| Python static gates (ruff)              |   ✅    | `pyproject.toml`, `.github/workflows/integration-tests.yml`      | py311 target; F + I rules on `scripts/` and `tests/unit/scripts/`. ISS-20260428-008.           |
| Container DI canonical runtime contract |   ✅    | `src-ts/container/workflow-runtime-provider.ts` `IWorkflowEngineRuntime` | Provider returns typed runtime instead of `unknown`; bridge casts removed. ISS-20260426-005.   |

## 5. Internal Architecture (deferred / future)

| Capability                              | Status | Tracking                                                         | Notes                                                                                          |
|-----------------------------------------|:------:|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Multi-workspace MCP cache isolation     |   ✅    | (see §1)                                                         | Was deferred ISS-20260426-004 — verified already implemented; closed in v9.2.5.               |
| Container DI canonical runtime contract |   ✅    | (see §4)                                                         | Was deferred ISS-20260426-005 — closed in v9.2.5.                                              |
| Authoritative capability matrix         |   ✅    | This document                                                    | Was deferred ISS-20260428-010 — closed by this matrix landing in v9.2.5.                       |

## 6. Historical / Reference Surfaces (📜 not part of shipped runtime)

| Surface                                 | Source of truth                                                  | Why retained                                                                                   |
|-----------------------------------------|------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| `docs/TASKS_V10_OPTIMIZED.md`           | (file)                                                           | Historical architecture roadmap; not authoritative for current release-readiness.              |
| `docs/PDD.md` neo4j/elasticsearch §41-42 | (file)                                                           | Gate-semantics-mapping for upstream agent/* projects, NOT product capability claims.           |
| `docs/ui_design_guide.md`               | (file)                                                           | Migration/design reference; superseded by current `desktop/src/components/`.                   |
| `docs/workflow-entrypoint-inventory.md` | (file)                                                           | Migration/inventory reference; current authority is code + `docs/INDEX.md`.                    |
| `src/mcp/**` (legacy Python sources)    | (path)                                                           | Advisory compatibility surface; `--runtime python` legacy override only.                       |
| Browser-first web entry                 | (removed)                                                        | Deprecated and removed from codebase.                                                          |

---

## Maintenance Rule

When a capability changes status:

1. Update its row in this matrix first (single source of truth).
2. Update any cross-reference in README/desktop README/SIGN_OFF only if the *contract surface* changes (status label change ✅↔🟡↔🧪↔⛔). Internal source-of-truth path changes do NOT require README edits.
3. Run `python scripts/check_authority_alignment.py` before commit; matrix changes must not cause authority drift.
4. If a row moves to ⛔ or 📜, document the deprecation in the relevant ISS issue and link from `status` cell.
