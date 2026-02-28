# Project Gotchas

### Guided CLI Flow: Divergent Registration Paths
- Problem: Defining command modules without exporting/registering in both `src/cli/commands/__init__.py` and `src/cli/main.py` leads to invisible commands.
- Solution:
  - Always complete the 3-part path: module definition -> command export -> explicit add_command registration.

### Workflow Stage Logic: Skipping Canonical Transition Gates
- Problem: Directly mutating step/runner states can violate deterministic contracts and break lifecycle assertions.
- Solution:
  - Keep transitions aligned to engine allowlists and canonical aliases in `src/workflow/workflow_engine.py`.
  - Validate behavior with existing workflow engine lifecycle tests before merging.

### Pytest Global Coverage Gate During Targeted Validation
- Problem: Repository-level pytest defaults include `--cov-fail-under=100`, causing targeted local test runs to fail even when all selected tests pass.
- Solution:
  - For scoped validation, override addopts explicitly: `python -m pytest -o addopts="--tb=short --strict-markers -v -m 'not e2e'" <targets>`.
  - Keep full coverage gate enforcement in CI/full-suite runs.

- Problem: Applying transforms without explicit ordered version chain can produce inconsistent final state.
- Solution:
  - Use explicit migration order and pure transform functions.
  - Always re-run canonical normalization and invariant validation after migration.

### Persisted State Version Detection
- Problem: Payloads may carry legacy aliases (`contract_version`) or blank schema fields.
- Solution:
  - Normalize schema version through ordered candidate fallback before migration.
  - Reject unknown/unsupported versions at validation boundary with structured error.

### Release Evidence Signals Ignore Template Files
- Problem: Counting template files as execution evidence can produce false-positive readiness.
- Solution:
  - Use only non-template markdown files for readiness metrics.
  - Keep templates prefixed as `TEMPLATE-` and write run evidence to dated files.

### Weekly Governance Drift Without Executable Checks
- Problem: Defining cadence/ownership only in prose can drift from actual release decision signals.
- Solution:
  - Couple weekly governance documentation with executable release summary checks (`evidence_freshness_signal`, evidence completeness blockers).
  - Keep ownership and evidence paths explicit in weekly/release artifacts so GO/NO_GO decisions stay auditable.

### Policy/Runtime Semantic Drift Around Decision Defaults
- Problem: Policy defines strict blocker semantics (`P0 => NO_GO/BLOCKED`), but runtime fallback/default mappings (e.g., missing decision => `go`) can silently soften enforcement.
- Solution:
  - Add explicit conformance checks comparing documented thresholds/blocker rules and runtime/release mappings.
  - Keep deterministic machine-readable assertions in tests to catch drift at boundary values (99/95/94/<50 and evidence-missing branches).

### Desktop Typecheck Strictness in Release Gate
- Problem: `desktop_check` is a blocking P0 signal; small TypeScript hygiene issues in desktop tests/components can force release `NO_GO`.
- Solution:
  - Keep desktop `tsconfig` strict diagnostics enabled and fix code-level issues directly (`TS2591`, `TS6133`, `TS2578`) instead of downgrading compiler checks.
  - Verify `desktop/package.json` check chain (`typecheck && build`) remains executable under release path.


