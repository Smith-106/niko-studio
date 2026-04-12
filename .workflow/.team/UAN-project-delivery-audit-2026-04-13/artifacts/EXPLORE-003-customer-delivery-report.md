# EXPLORE-003 Customer Delivery Surface

## Verdict

- Delivery posture: `GO_with_caveats`
- Customer build deliverable now: `true`
- Experience completeness: `mostly_complete`
- Formal handoff pack complete inside repo: `false`
- Evidence basis date: `2026-04-13 00:32:53 HKT` release snapshot, plus live checks run during this exploration

## Product-Surface Signals

- The top-level delivery contract is aligned across root docs, desktop docs, and release docs: shipped surface is `desktop/` + Tauri host + local `src-ts/` gateway.
- Packaging cues are concrete, not aspirational: Tauri app metadata is versioned at `9.0.4`, sidecar binaries are staged in `desktop/src-tauri/bin/`, and a fresh debug packaging executable exists in `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/`.
- The desktop shell is coherent and customer-facing: sidebar, editor canvas, chat sidebar, settings, knowledge, evaluation, MCP status, restore banner, and runtime health are all wired into the main app shell.
- Current release evidence still says `GO`, and the lightweight live checks performed in this run also pass.

## Relevant Files

- `README.md`
- `desktop/README.md`
- `docs/release/RELEASE_NOTES.md`
- `docs/release/SIGN_OFF.md`
- `release-check-summary.md`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `desktop/package.json`
- `desktop/src/App.tsx`
- `desktop/src/components/Sidebar.tsx`
- `desktop/src/components/ChatArea.tsx`
- `desktop/src/components/AppHeader.tsx`
- `desktop/src/components/KnowledgeModal.tsx`
- `desktop/src/components/EvaluationPanel.tsx`
- `desktop/src/components/McpStatusPanel.tsx`
- `desktop/src/hooks/useAppStartup.ts`
- `desktop/src/hooks/useAppBackendBootstrap.ts`
- `desktop/src/api/evaluation.ts`
- `desktop/src/api/gateway/services.ts`
- `desktop/src/api/workflow/plans.ts`
- `desktop/src/api/wiki.ts`
- `desktop/src-tauri/src/main.rs`
- `desktop/src-tauri/tauri.conf.json`
- `src-ts/mcp/routes/content.ts`
- `src-ts/mcp/routes/platform.ts`
- `src-ts/mcp/routes/admin.ts`
- `src-ts/mcp/routes/workflow.ts`
- `src-ts/workflow/engine/risk.ts`

## UX / Completeness Findings

1. The primary writer experience is coherent. A first-time customer lands in a real shell, not a placeholder scaffold: empty-state guidance, quick actions, template entry, upload action, runtime status, checkpoint affordances, and error recovery all exist.
2. UI-to-backend mapping is materially real for the main promised journeys. Chat maps to `/chat` and `/chat/stream`; knowledge maps to memory/graph/wiki endpoints; workflow controls map to `/workflow/*` and `/ui-bridge/workflow/*`; MCP status maps to `/health`, `/metrics`, `/tools`, and `/admin/mcp/services*`.
3. Workflow control is not just exposed, it is guarded. The backend risk gate requires a confirmation token for destructive actions, and the integration test confirms the `waiting_confirmation -> confirmed execute` path.
4. Delivery proof is stronger than a stale document snapshot. This run rechecked `delivery_gate.py`, `check_authority_alignment.py`, targeted desktop UI/API tests, and targeted gateway route/integration tests.
5. The customer-facing surface is not fully polish-complete. A visible Evaluation panel action still appears to call a stale endpoint: frontend `novelQualityCheck()` posts to `/api/novel/quality-check`, while the gateway route registry exposes `/writing/quality`. This is an inference from source alignment, not from an interactive UI click-through, but it is a concrete likely defect because the button is live in `EvaluationPanel`.

## Customer-Handoff Risks

- Product risk: `medium`
  - Likely live defect in the Evaluation panel's "novel quality check" action due to endpoint drift.
- Handoff-pack risk: `medium`
  - `release-check-summary.md` and `.workflow/evidence/release/release-readiness-artifact.json` are present and fresh, but `SIGN_OFF.md` also says to keep `authority-alignment.json`, `vitest-production-guard*.xml`, `vitest-e2e*.xml`, and `governance-scripts.junit.xml`. Those artifacts are not currently preserved in the repo checkout.
- Process risk: `low`
  - The worktree is not carrying unrelated product edits in this run; the only `git status` delta observed was the new audit session directory itself.

## Live Verification Run In This Exploration

- `python scripts/delivery_gate.py` -> `PASS`
- `python scripts/check_authority_alignment.py` -> `PASS (49/49 rules)`
- `npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx src/components/KnowledgeModal.test.tsx` -> `PASS (3 files, 54 tests)`
- `npm --prefix src-ts exec -- vitest run tests/gateway-server.routes.test.ts tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/mcp-admin.test.ts tests/mcp/wiki-endpoints.test.ts --reporter=default` -> `PASS (4 files, 14 tests)`

## Evidence Refs

- Delivery contract alignment:
  - `README.md:57-87`
  - `desktop/README.md:7-12`
  - `docs/release/RELEASE_NOTES.md:10-31`
- Fresh release snapshot:
  - `release-check-summary.md:1-47`
  - `.workflow/evidence/release/release-readiness-artifact.json:1-120`
- Desktop shell and first-run guidance:
  - `desktop/src/App.tsx:11-30`
  - `desktop/src/components/ChatArea.tsx:782-847`
  - `desktop/src/components/AppHeader.tsx:1-145`
  - `desktop/src/components/DocumentEditor.tsx:14-114`
- Tauri/runtime bridge:
  - `desktop/src/hooks/useAppBackendBootstrap.ts:6-19`
  - `desktop/src/api/transport.ts:1-64`
  - `desktop/src-tauri/src/main.rs:304-437`
- API / workflow matching:
  - `desktop/src/api/workflow/plans.ts:15-145`
  - `desktop/src/api/gateway/services.ts:1-38`
  - `desktop/src/api/wiki.ts:1-122`
  - `src-ts/mcp/routes/content.ts:21-38`
  - `src-ts/mcp/routes/platform.ts:14-26`
  - `src-ts/mcp/routes/admin.ts:11-38`
  - `src-ts/mcp/routes/workflow.ts:17-30`
  - `src-ts/workflow/engine/risk.ts:79-125`
- Likely Evaluation quality-check defect:
  - `desktop/src/api/evaluation.ts:41-52`
  - `desktop/src/hooks/useEvaluationQualityCheck.ts:32-61`
  - `desktop/src/components/EvaluationPanel.tsx:208-211`
  - `desktop/src/components/EvaluationPanel.tsx:357-378`
  - `src-ts/mcp/routes/content.ts:35-37`

