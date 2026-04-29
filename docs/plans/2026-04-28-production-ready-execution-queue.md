# Niko Studio Production-Ready Execution Queue

**Last updated**: 2026-04-28  
**Scope**: `desktop + src-ts` authoritative shipped path  
**Goal**: move project from **Feature-complete but not Release-complete** to **production-ready**  
**Current release state**: `NO_GO` (`release-check-summary.md`)  
**Queue status**: active, refined through iterative repo search and command validation

---

## Operating notes

- **Feature-complete** means core product capabilities are implemented and usable.
- **Release-complete** means the project can be validated, packaged, signed, accepted, and handed off with current-head evidence.
- P0 contains only issues that truly block deliverability.
- P1 contains high-priority completion and hardening work.
- P2 contains maturity and maintainability work.

---

# P0 — Release blockers

## P0-1. Unify and fix desktop packaged runtime contract

- **Type**: Release-complete remaining item
- **Problem**: Local authoritative runtime is Node-first, but strict packaged-desktop validation still depends on a hydrated Python compatibility sidecar artifact.
- **Impact**:
  - blocks `desktop_sidecar_readiness`
  - blocks `desktop_packaging_dry_run`
  - blocks `desktop check:local`
  - prevents trustworthy release packaging
- **Root cause**:
  - runtime contract split:
    - local runtime = Node/TypeScript
    - packaged compatibility runtime = Python sidecar
  - strict validator expects Windows compatibility artifact currently absent in checkout
  - current checkout cannot rebuild that packaged Python compatibility artifact from source unless legacy Python entry is restored
- **Evidence**:
  - `release-check-summary.md`
  - `desktop/scripts/validate_sidecar_contract.cjs`
  - `desktop/scripts/choose_sidecar.cjs`
  - `desktop/src-tauri/tauri.conf.json`
  - `scripts/build_gateway_sidecar.py`
  - `docs/release/RELEASE_NOTES.md`
  - `docs/operations/DESKTOP_RUNBOOK.md`
- **Files / directories to modify**:
  - `desktop/src-tauri/tauri.conf.json`
  - `desktop/scripts/validate_sidecar_contract.cjs`
  - `desktop/scripts/choose_sidecar.cjs`
  - `desktop/src-tauri/src/gateway_runtime.rs`
  - `.github/workflows/integration-tests.yml`
  - `.github/workflows/external-release-gate.yml`
  - `README.md`
  - `desktop/README.md`
  - `docs/release/RELEASE_NOTES.md`
  - `docs/operations/DESKTOP_RUNBOOK.md`
- **Suggested owner type**: Desktop / Release Engineering / DevOps
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run build:sidecar
  npm --prefix desktop run validate:sidecar-contract
  npm --prefix desktop run validate:package:dry-run
  ```
- **Definition of Done**:
  1. One packaged-runtime story is chosen and documented.
  2. Strict sidecar validation passes on the supported target.
  3. Packaging contract, CI, and docs all describe the same runtime/package semantics.
- **Risk & rollback points**:
  - Risk: changing packaging assumptions may break Tauri build or CI expectations.
  - Rollback: revert validator/config/runtime-selection changes together as one package.

---

## P0-2. Make `desktop check:local` pass on a clean checkout

- **Type**: Release-complete remaining item
- **Problem**: The authoritative local desktop quality gate currently fails.
- **Impact**:
  - desktop local release proof is invalid
  - release scorecard stays red
  - QA/release sign-off cannot use current local gate as final authority
- **Root cause**:
  - `check:local` includes sidecar build/validation and build path
  - failure comes from packaged-sidecar/runtime contract, not from normal frontend test failures
- **Evidence**:
  - `desktop/package.json`
  - `release-check-summary.md`
  - direct command result from `npm --prefix desktop run check:local`
- **Files / directories to modify**:
  - `desktop/package.json`
  - `desktop/scripts/*`
  - `desktop/src-tauri/*`
  - desktop tests only if needed for stability
- **Suggested owner type**: Desktop
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run check:local
  npm --prefix desktop run test:ci
  npm --prefix desktop run build
  ```
- **Definition of Done**:
  1. `npm --prefix desktop run check:local` passes in a clean environment.
  2. The command is reusable as authoritative desktop local gate.
  3. No release-blocking failure remains in desktop local validation path.
- **Risk & rollback points**:
  - Risk: weakening strict checks just to turn pipeline green.
  - Rollback: preserve strict checks; revert any gate-lowering changes that hide real packaging issues.

---

## P0-3. Regenerate current-head release evidence and clear superseded proof state

- **Type**: Release-complete remaining item
- **Problem**: release evidence exists, but writing-helper acceptance and related retained proof are not valid for the current HEAD in release-summary semantics; `local:selftest` is therefore still mandatory.
- **Impact**:
  - `writing_helper_acceptance_signal` fails
  - `local_selftest_enforcement` fails
  - release summary remains `NO_GO`
- **Root cause**:
  - retained release evidence uses freshness + same-head semantics
  - historical PASS evidence is currently marked superseded/non-current
- **Evidence**:
  - `release-check-summary.md`
  - `.workflow/evidence/release/*`
  - `docs/release/SIGN_OFF.md`
  - `.github/workflows/writing-helper-acceptance.yml`
  - `scripts/release_check_summary.py`
- **Files / directories to modify**:
  - `.workflow/evidence/release/*`
  - `release-check-summary.md`
  - `scripts/release_check_summary.py`
  - `docs/release/SIGN_OFF.md`
  - `scripts/check-writing-helper.ps1` (if acceptance output schema/process needs adjustment)
- **Suggested owner type**: Release Engineering / QA
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run local:selftest
  python scripts/check_authority_alignment.py
  python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
  python scripts/release_check_summary.py
  ```
- **Definition of Done**:
  1. Retained release-evidence sources are fresh and current for the same HEAD.
  2. `writing_helper_acceptance_signal` no longer fails due to superseded/head mismatch.
  3. `local_selftest_enforcement` passes.
- **Risk & rollback points**:
  - Risk: refreshing evidence without fixing underlying release issues.
  - Rollback: keep prior evidence artifacts; only mark new proof authoritative when generated from passing checks.

---

## P0-4. Establish signed external release path

- **Type**: Release-complete remaining item
- **Problem**: repo currently proves at best `unsigned_local_proof`; it does not, by itself, produce a signed external desktop release.
- **Impact**:
  - cannot honestly claim production-ready external release capability
  - SmartScreen / trust chain / external shipment path remain incomplete
- **Root cause**:
  - signing materials and timestamp configuration are intentionally external to git
  - no closed-loop signed release execution path is validated end-to-end
  - operator guidance is split between repo-null config policy and instructions that suggest editing `tauri.conf.json` directly
- **Evidence**:
  - `desktop/src-tauri/tauri.conf.json`
  - `docs/release/RELEASE_NOTES.md`
  - `docs/release/SIGN_OFF.md`
  - `docs/operations/CODE_SIGNING.md`
- **Files / directories to modify**:
  - `desktop/src-tauri/tauri.conf.json`
  - `docs/operations/CODE_SIGNING.md`
  - `docs/release/SIGN_OFF.md`
  - `.github/workflows/external-release-gate.yml`
  - external release-host / secret management configuration (outside git)
- **Suggested owner type**: Release Engineering / DevOps
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run tauri:build
  python scripts/release_check_summary.py
  ```
  Plus Windows-side signature verification:
  ```powershell
  Get-AuthenticodeSignature desktop/src-tauri/target/release/bundle/nsis/*.exe | Format-List
  ```
- **Definition of Done**:
  1. Signed release procedure is executable on release host.
  2. Signed bundle is generated with valid trust chain and timestamp.
  3. Release state can graduate from `unsigned_local_proof` / `prerequisite_missing_hold` to `signed_external_release`.
- **Risk & rollback points**:
  - Risk: release host/certificate misconfiguration blocks builds.
  - Rollback: keep unsigned local proof path for internal validation while signed flow is repaired.

---

# P1 — High-priority completion and hardening

## P1-1. Strengthen skill-pack usage in primary writing flow

- **Type**: Feature-complete remaining item
- **Problem**: skill packs are browseable/matchable/loadable, but direct user-facing application inside primary writing flow is weaker than the architecture suggests.
- **Impact**:
  - lowers perceived completeness of skill system
  - weakens value of skill-pack architecture in shipped UX
- **Root cause**:
  - capability exists in architecture and APIs
  - top-level interaction path is indirect (`selectedSkills`, side panels, knowledge tab)
- **Evidence**:
  - `desktop/src/components/ChatArea.tsx`
  - `desktop/src/components/ChatAreaModeControls.tsx`
  - `desktop/src/components/knowledge/SkillTab.tsx`
  - `desktop/src/api/skills.ts`
- **Files / directories to modify**:
  - `desktop/src/components/ChatArea.tsx`
  - `desktop/src/components/ChatAreaModeControls.tsx`
  - `desktop/src/components/knowledge/SkillTab.tsx`
  - `desktop/src/components/WritingHelperPanel.tsx`
  - `desktop/src/api/skills.ts`
- **Suggested owner type**: Frontend / Backend / QA
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run test
  npm --prefix desktop run check:local
  ```
- **Definition of Done**:
  1. Users can intentionally apply/select skill packs from primary writing flow.
  2. Result payload and UI reflect actual skill usage.
  3. Tests cover selection -> request -> result path.
- **Risk & rollback points**:
  - Risk: overloading main writing UI.
  - Rollback: preserve current side-panel path and gate new top-level affordances behind minimal UI change set.

---

## P1-2. Classify or disable unfinished external integration adapters

- **Type**: Feature-complete remaining item
- **Problem**: multiple adapters remain `unsupported`, `degraded`, or future-integration stubs.
- **Impact**:
  - makes platform breadth appear larger than runtime truth
  - introduces confusing degraded behavior paths
- **Root cause**:
  - integration skeletons landed before full external service implementations
- **Evidence**:
  - `src-ts/integrations/adapters.ts`
  - related integration tests under `src-ts/tests/integrations/*`
- **Files / directories to modify**:
  - `src-ts/integrations/adapters.ts`
  - `src-ts/container/*`
  - `src-ts/protocols/*`
  - product docs if support matrix changes
- **Suggested owner type**: Backend
- **Acceptance commands**:
  ```bash
  npm --prefix src-ts run test
  npm --prefix src-ts run check:local
  ```
- **Definition of Done**:
  1. Every adapter is explicitly categorized: supported / experimental / disabled.
  2. Production path cannot silently fall into half-implemented integrations.
  3. Product docs do not over-claim unsupported integrations.
- **Risk & rollback points**:
  - Risk: removing stubs may slow future integration work.
  - Rollback: keep code paths but default them to disabled with explicit status messaging.

---

## P1-3. Replace silent mock/fallback behavior with explicit degraded-mode policy

- **Type**: Feature-complete remaining item
- **Problem**: some narrative/analysis behavior falls back to mock outputs when real LLM client is absent.
- **Impact**:
  - weakens trust in AI-assisted output quality
  - makes production/runtime diagnosis harder
- **Root cause**:
  - dev-friendly resilience retained inside core runtime logic
- **Evidence**:
  - `src-ts/narrative/character-manager.ts`
- **Files / directories to modify**:
  - `src-ts/narrative/character-manager.ts`
  - adjacent narrative/services/agents files if fallback semantics propagate
  - any user-facing error/reporting surface for degraded mode
- **Suggested owner type**: Backend / QA
- **Acceptance commands**:
  ```bash
  npm --prefix src-ts run test
  npm --prefix src-ts run check:local
  ```
- **Definition of Done**:
  1. Production mode never silently substitutes mock analysis as normal output.
  2. Degraded mode is explicit, observable, and test-covered.
  3. Development-only fallback behavior is clearly scoped.
- **Risk & rollback points**:
  - Risk: stricter behavior may reduce convenience in local dev.
  - Rollback: keep development fallback while disallowing silent production fallback.

---

## P1-4. Add Python static quality gates for governance/release helper stack

- **Type**: Release-complete strengthening item
- **Problem**: TS stack has strong lint/format/type/test gates; Python helper stack relies mostly on targeted pytest and custom scripts.
- **Impact**:
  - governance/release helper regressions may evade static analysis
  - cross-language quality posture is uneven
- **Root cause**:
  - Python moved into helper/governance role, but static tooling was not brought to parity
- **Evidence**:
  - `requirements.txt`
  - `pytest.ini`
  - absence of `pyproject.toml`, `mypy.ini`, `.pre-commit-config.yaml`
- **Files / directories to modify**:
  - add `pyproject.toml` or equivalent Python tooling config
  - `pytest.ini`
  - `scripts/*.py`
  - `.github/workflows/integration-tests.yml`
- **Suggested owner type**: Backend / DevOps
- **Acceptance commands**:
  ```bash
  python -m pytest tests/unit/scripts/test_governance_scripts.py -q
  ```
  If tooling is added:
  ```bash
  ruff check .
  black --check .
  mypy scripts tests
  ```
- **Definition of Done**:
  1. Python helper stack has at least lint + formatting + tests.
  2. CI runs Python static checks.
  3. Helper-stack quality posture is no longer materially weaker than JS/TS baseline.
- **Risk & rollback points**:
  - Risk: enabling strict lint everywhere creates noisy backlog.
  - Rollback: scope first to `scripts/` and `tests/unit/scripts/`, then expand.

---

## P1-5. Productize release-evidence refresh into one operator path

- **Type**: Release-complete strengthening item
- **Problem**: current release-evidence semantics are good, but evidence refresh and validation are operationally fragmented.
- **Impact**:
  - increases chance of stale or superseded proof
  - makes QA/release sign-off more error-prone
- **Root cause**:
  - retained evidence and summary are strict, but operator flow is multi-command and distributed across docs/scripts
- **Evidence**:
  - `scripts/release_check_summary.py`
  - `docs/release/SIGN_OFF.md`
  - `.workflow/evidence/release/*`
- **Files / directories to modify**:
  - `scripts/release_check_summary.py`
  - `docs/release/SIGN_OFF.md`
  - optionally add a dedicated evidence-refresh helper script
- **Suggested owner type**: Release Engineering / QA
- **Acceptance commands**:
  ```bash
  python scripts/release_check_summary.py
  ```
- **Definition of Done**:
  1. Release-evidence refresh steps are single-path and documented.
  2. Operators do not need to remember scattered commands to restore fresh/current proof.
  3. Same-head evidence refresh can be executed reliably before sign-off.
- **Risk & rollback points**:
  - Risk: over-centralizing too much logic into one brittle script.
  - Rollback: preserve granular underlying commands as documented fallback path.

---

# P2 — Maturity, maintainability, and operational hardening

## P2-1. Build authoritative capability matrix and trim historical ambiguity

- **Type**: Feature-complete strengthening item
- **Problem**: current docs mix authoritative shipped-path docs with historical reference documents, which increases completion-status ambiguity.
- **Impact**:
  - product/release communication risk
  - audit/review overhead
  - easier to over-claim completion
- **Root cause**:
  - historical docs are preserved correctly but not unified behind a single capability matrix
- **Files / directories to modify**:
  - `README.md`
  - `desktop/README.md`
  - `docs/INDEX.md`
  - `docs/PDD.md`
  - `docs/TASKS_V10_OPTIMIZED.md`
  - optional new file: `docs/capability-matrix.md`
- **Suggested owner type**: Release Engineering / QA / Documentation owner
- **Acceptance commands**:
  ```bash
  python scripts/check_authority_alignment.py
  ```
- **Definition of Done**:
  1. There is one authoritative capability matrix.
  2. Each capability is labeled supported / partial / experimental / historical.
  3. Authority alignment remains green after doc changes.
- **Risk & rollback points**:
  - Risk: removing context from historical docs too aggressively.
  - Rollback: add matrix first, then de-emphasize old docs gradually.

---

## P2-2. Add `src-ts` dependency audit coverage to CI/release governance

- **Type**: Release-complete strengthening item
- **Problem**: dependency auditing is visible for `desktop`, but not equivalently enforced for `src-ts`.
- **Impact**:
  - weaker supply-chain visibility for backend/gateway package set
- **Root cause**:
  - audit step currently targets only desktop package lane
- **Files / directories to modify**:
  - `.github/workflows/integration-tests.yml`
  - `.github/workflows/external-release-gate.yml`
  - `src-ts/package.json`
- **Suggested owner type**: DevOps / Backend
- **Acceptance commands**:
  ```bash
  npm --prefix src-ts audit --audit-level=high
  npm --prefix desktop audit --audit-level=high
  ```
- **Definition of Done**:
  1. Both desktop and src-ts participate in dependency audit policy.
  2. High-severity findings are either blocking or formally risk-accepted.
- **Risk & rollback points**:
  - Risk: too many advisory failures early.
  - Rollback: start advisory, then promote to blocking where stable.

---

## P2-3. Add local pre-commit quality gates

- **Type**: Release-complete strengthening item
- **Problem**: quality gates are strong in CI, but there is no clear local commit-time enforcement layer.
- **Impact**:
  - more trivial failures reach CI
  - slower feedback for contributors
- **Root cause**:
  - project relies on CI/post-hoc validation rather than lightweight pre-commit checks
- **Files / directories to modify**:
  - hook configuration of choice
  - `desktop/package.json`
  - `src-ts/package.json`
  - optional root hook config files
- **Suggested owner type**: Frontend / Backend / DevOps
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run lint
  npm --prefix src-ts run lint
  ```
- **Definition of Done**:
  1. Commit-time checks catch basic lint/format issues locally.
  2. Hook runtime is lightweight enough for normal development use.
- **Risk & rollback points**:
  - Risk: overly heavy hooks hurt development velocity.
  - Rollback: keep only fast checks locally; leave expensive tests in CI.

---

## P2-4. Add package-level end-to-end QA acceptance

- **Type**: Release-complete strengthening item
- **Problem**: source/test/release checks are strong, but installation/package-level user-path verification is still thinner than ideal for production-ready delivery.
- **Impact**:
  - final-user confidence gap
  - risk of package-only regressions
- **Root cause**:
  - validation is strong at code and gate level, but less formalized at installed-artifact level
- **Files / directories to modify**:
  - `docs/operations/E2E_VERIFICATION.md`
  - `docs/release/SIGN_OFF.md`
  - optional QA automation scripts
- **Suggested owner type**: QA / Desktop
- **Acceptance commands**:
  ```bash
  npm --prefix desktop run local:selftest
  python scripts/release_check_summary.py
  ```
  plus installed-package smoke verification on Windows host
- **Definition of Done**:
  1. Installed package smoke-test checklist exists and is repeatable.
  2. External release sign-off includes package install/start/use validation.
  3. Evidence from package-level acceptance is retained with release artifacts.
- **Risk & rollback points**:
  - Risk: over-automation cost for Windows package checks.
  - Rollback: start with manual checklist and incrementally automate.

---

## P2-5. Add dependency update automation and repository hygiene automation

- **Type**: Release-complete strengthening item
- **Problem**: no visible Dependabot/Renovate/update automation was found.
- **Impact**:
  - dependency freshness lags
  - security maintenance is more manual than necessary
- **Root cause**:
  - update management appears manual today
- **Files / directories to modify**:
  - `.github/dependabot.yml` or `renovate.json`
  - optional workflow docs
- **Suggested owner type**: DevOps
- **Acceptance commands**:
  - Configuration validation via chosen bot/platform
- **Definition of Done**:
  1. Automated dependency update policy exists.
  2. Update cadence and ownership are defined.
- **Risk & rollback points**:
  - Risk: noisy PR volume.
  - Rollback: start with monthly cadence or limited scopes.

---

# Items explicitly checked and confirmed absent / weak

These absences are already reflected in the queue above and do not currently require additional separate tasks unless strategy changes:

- No `pyproject.toml`
- No `mypy.ini`
- No `.pre-commit-config.yaml`
- No `.github/dependabot.yml`
- No `renovate.json`
- No `Dockerfile`
- No `docker-compose.yml`
- No `docker-compose.yaml`

Interpretation:
- Dockerized deployment is not currently the shipped desktop path, so absence is not a P0 blocker.
- Python static tooling absence is a P1 quality-hardening item.
- dependency-update automation absence is a P2 maintenance item.

---

# Suggested execution order

## Week 1
1. P0-1 unify packaged runtime contract
2. P0-2 make `desktop check:local` pass
3. P0-3 regenerate current-head release evidence
4. rerun:
   ```bash
   npm --prefix desktop run check:local
   npm --prefix src-ts run check:local
   python scripts/release_check_summary.py
   ```

## Week 2
1. P0-4 signed external release path
2. P1-4 Python static quality gates
3. P1-5 release-evidence refresh productization
4. P2-4 package-level QA acceptance

## If only 3 things can be fixed
1. P0-1 unify/fix desktop packaged runtime contract
2. P0-2 make `desktop check:local` pass
3. P0-3 regenerate current-head release evidence

---

# Queue maintenance note

This file is intended to be updated as the authoritative production-ready task queue.  
After iterative repo scans on 2026-04-28, no additional higher-priority blockers beyond the queue above were found.
