### Roadmap Pointer Normalization Pattern
- Context: Lifecycle transitions can update PRD/milestone statuses and changelog in different steps.
- Implementation:
  - Normalize `currentPRD` and `currentMilestone` from canonical milestone/PRD statuses after each lifecycle transition.
  - Keep pointer writes coupled with status updates, not independent changelog-only events.
  - Preserve existing lifecycle action taxonomy (`prd_activated`, `prd_completed`, `milestone_completed`) as stable machine-consumable events.
- Example:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:756` PRD activation pointer write.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:777` PRD completion pointer clear.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:828` milestone completion status/changelog update.

### Roadmap Pointer Pre-Selection Normalization Pattern
- Context: Execute loops that select work from `currentPRD` can inherit stale pointers if normalization only runs after transitions.
- Implementation:
  - Run roadmap pointer normalization at the start of each execute-loop iteration before reading `currentPRD`.
  - Keep existing post-transition normalization so both selection-time and transition-time states converge to canonical milestone/PRD status.
- Example:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:687` execute-loop iteration boundary.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:688` pre-selection normalization invocation.

### Roadmap Lifecycle Event Ordering Pattern
- Context: Roadmap status transitions and lifecycle changelog actions must stay deterministic and replayable.
- Implementation:
  - Emit lifecycle actions in strict order per PRD cycle: `prd_activated` (pending -> in_progress), `prd_completed`, then conditional `milestone_completed`.
  - Keep milestone completion gated by "no non-completed PRDs remain in milestone" and project completion gated by "no incomplete milestones remain".
  - Run `normalize_roadmap_pointers` after each lifecycle status/changelog write to prevent contradictory pointer-state combinations.
- Example:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:776` PRD in-progress transition point.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:796` `prd_completed` append point.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:850` `milestone_completed` append point.

### Roadmap Lifecycle Changelog Schema Stability Pattern
- Context: Lifecycle governance events must remain machine-consumable and replay-safe across roadmap automation runs.
- Implementation:
  - Keep lifecycle action taxonomy stable (`prd_activated`, `prd_completed`, `milestone_completed`) and append-only.
  - For lifecycle events, keep deterministic payload envelope keys (`timestamp`, `action`, `description`) plus explicit identifier keys (`prdId` or `milestoneId`) instead of encoding machine-critical semantics only in free-form description text.
  - Preserve status-write and event-append coupling in the same control branch; validate roadmap JSON integrity before downstream replay/consumption.
- Example:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:780` lifecycle append contract for `prd_activated`.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:806` lifecycle append contract for `prd_completed`.
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:860` lifecycle append contract for `milestone_completed`.

### Revision Round Checkpoint Artifact Pattern
- Context: Implementing deterministic revision loops where each round must be auditable and resumable.
- Implementation:
  - Emit one persisted checkpoint artifact per revision round with explicit `round_id` semantics.
  - Reuse workflow state persistence primitives (`state.json` snapshot + `snapshot-index.json` append index) instead of separate ad-hoc storage.
  - Include traceable linkage fields (`session_id` + checkpoint/revision identifiers) compatible with evidence contract consumers.
- Example:
  - `src/workflow/workflow_engine.py:715` state snapshot envelope construction.
  - `src/workflow/workflow_engine.py:764` deterministic state persistence with retained checkpoint/recovery data.
  - `src/workflow/session/session_manager.py:505` incremental snapshot index append path.

### Guided CLI Command Registration Pattern
- Context: Adding new user-facing CLI workflows while keeping entrypoint behavior consistent.
- Implementation:
  - Define command in `src/cli/commands/<name>.py` using Click decorators.
  - Export command symbol from `src/cli/commands/__init__.py`.
  - Register command explicitly in `src/cli/main.py` via `cli.add_command(...)`.
  - Mirror command behavior tests with `click.testing.CliRunner` and dependency patching.
- Example:
  - `src/cli/main.py:33` command imports + `src/cli/main.py:41` registrations.
  - `src/cli/commands/run.py:16` click option declaration style.
  - `tests/unit/test_cli_runtime_commands.py:26` command invocation + patch pattern.

### Workflow Deterministic Transition Map Pattern
- Context: Workflow execution paths must remain reproducible across CLI and engine invocations.
- Implementation:
  - Centralize runner and step transitions as explicit allowlists.
  - Keep canonical phase aliases for legacy state payload normalization.
  - Enforce contract defaults through one normalization entrypoint.
- Example:
  - `src/workflow/workflow_engine.py:69` runner transition map.
  - `src/workflow/workflow_engine.py:82` step transition map.
  - `src/workflow/workflow_engine.py:121` canonical phase alias map.
  - `src/workflow/levels/types.py:65` contract default normalization.


### CLI Validation Boundary Pattern
- Context: Exposing user-facing workflow generation controls while keeping runtime behavior deterministic.
- Implementation:
  - Validate user inputs at CLI boundary with Click option constraints (`click.Choice`, typed options) plus explicit `click.BadParameter` guards for semantic rules.
  - Keep adapter/workflow layer focused on normalized value consumption and execution decisions.
  - Surface runtime environment failures separately (`click.Abort` / `click.ClickException`) instead of treating them as input validation errors.
- Example:
  - `src/cli/commands/guided_draft.py:26` style/length control enums via `click.Choice`.
  - `src/cli/commands/guided_draft.py:84` repeatable `--constraint` semantic guard via `click.BadParameter`.
  - `src/cli/commands/guided_draft.py:95` normalized controls propagated as workflow recommendations.
  - `src/cli/commands/runtime.py:52` transport/runtime failure mapped to abort semantics.

### Workflow Control Propagation via Recommendations
- Context: Passing CLI generation controls to workflow execution without widening adapter signatures.
- Implementation:
  - Convert CLI control bundle (`style`, `length`, `constraints`) into deterministic recommendation payload.
  - Inject recommendation at `engine.plan(...)` boundary and keep fallback for legacy plan signatures.
  - Treat controls as explicit plan metadata so downstream evidence/replay can remain stable.
- Example:
  - `src/cli/commands/guided_draft.py:108` `_controls_to_recommendations` canonical action envelope.
  - `src/cli/commands/guided_draft.py:151` plan invocation with recommendations + compatibility fallback.
  - `tests/unit/test_cli_commands.py:782` verifies control recommendation propagation.

- Context: Keeping workflow adapters interchangeable across domains without interface drift.
- Implementation:
  - Define one shared contract matrix for adapter boundary invariants (domain identity, init-state boundary, evaluate result shape, registry/factory wiring).
  - Parameterize matrix rows across adapter domains instead of duplicating assertions per adapter file.
  - Keep contract assertions deterministic and boundary-focused (schema + behavior invariants only).
- Example:
  - `src/workflow/adapters/base_adapter.py` shared adapter contract surface.
  - `src/workflow/graph_factory.py` adapter instantiation + unknown-domain failure boundary.
  - `tests/unit/workflow/test_base_adapter.py` + `tests/unit/workflow/test_evaluator_code_adapter.py` existing invariant coverage to normalize.

### Workflow State Migration Contract
- Context: Evolving persisted workflow state across schema versions.
- Implementation:
  - Keep a single migration entrypoint.
  - Use deterministic ordered transforms from source version to current target.
  - Apply additive defaults and canonical normalization after each transform chain.
  - Validate required invariants after migration.
- Example:
  - `src/workflow/workflow_engine.py:700` phase canonicalization.
  - `src/workflow/workflow_engine.py:764` persisted state read + stable fallback handling.
  - `src/workflow/levels/types.py:66` deterministic contract default application.

### Additive Schema Evolution First
- Context: Backward-safe schema upgrades for persisted JSON payloads.
- Implementation:
  - Add optional fields with defaults instead of renaming/removing required fields.
  - Preserve compatibility aliases/mapped legacy fields until migration coverage exists.
  - Bump schema version for breaking changes only.
- Example:
  - `src/workflow/workflow_engine.py:115` + `src/workflow/workflow_engine.py:116` frozen schema version/policy constants.

### Runtime Policy Drift Matrix Pattern
- Context: Detecting threshold/blocker semantic drift across runtime and release layers must remain deterministic and mode-aware.
- Implementation:
  - Extract policy contract from authoritative docs and runtime contract from executable mappings.
  - Compare threshold semantics (`99/95/94/<50`) and blocker semantics (`P0 => NO_GO/BLOCKED`) via explicit mismatch keys.
  - Keep machine output stable with ordered `key=value` detail strings for CI assertions.
- Example:
  - `scripts/release_check_summary.py:208` policy contract extraction.
  - `scripts/release_check_summary.py:236` runtime contract probes (including mode consistency and gateway publish mapping).
  - `scripts/release_check_summary.py:268` conformance mismatch evaluation and deterministic output.

### Evidence Metadata Traceability Contract
- Context: Evidence artifacts must correlate to workflow runs for auditability across e2e, quality, and release gates.
- Implementation:
  - Keep canonical envelope fields required across artifacts (`artifact_type`, `schema_version`, `date`, `owner`, `input`, `output`, `result`, `evidence_links`, `trace`).
  - Require `trace` identifiers aligned to artifact type (`session_id` + `run_id`/`revision_id`/`check_id`).
  - Keep release check machine payload deterministic (`decision`, `go_no_go_reasons`, `checks`) and `detail` as ordered `key=value` pairs.
- Example:
  - `.workflow/evidence/README.md:21` envelope requirements.
  - `docs/PDD.md:301` section 16 minimum fields and trace mapping.
  - `scripts/release_check_summary.py:132` deterministic detail formatter.


### Feedback Artifact Integration Boundary Pattern
- Context: Introducing structured actionable feedback without breaking existing critic/revision contracts.
- Implementation:
  - Generate additive `feedback_artifacts` at the deterministic critic→revision-loop update boundary.
  - Keep propagation path explicit: `update_from_critic` → `get_feedback_for_writer` → writer input, with summary export for auditability.
  - Preserve legacy critic payload fields (`decision`, `total_score`, `actionable_feedback`, `revision_instructions`) and append new artifact metadata only.
  - Reuse existing round identifiers (`round-<n>`) for deterministic artifact linkage.
- Example:
  - `src/workflow/revision_loop.py:217` feedback artifact builder.
  - `src/workflow/revision_loop.py:269` critic update integration point.
  - `src/workflow/revision_loop.py:355` writer handoff payload.
  - `src/workflow/revision_loop.py:378` summary payload export.

### Adapter Feedback Propagation Parity Pattern
- Context: Keeping graph-based novel workflow critic outputs aligned with revision-loop feedback artifact contract.
- Implementation:
  - Reuse a single deterministic feedback artifact mapping strategy in adapter critic output path rather than creating a divergent schema.
  - Emit `feedback_artifacts` alongside existing `feedback_context` and `revision_instructions` fields.
  - Keep additive extension only; existing consumer-facing keys remain unchanged.
- Example:
  - `src/workflow/adapters/novel_adapter.py:433` critic response payload assembly.
  - `src/workflow/adapters/novel_adapter.py:434` additive `feedback_artifacts` output.
  - `tests/unit/workflow/test_novel_adapter.py:934` parity assertion on emitted artifact metadata.

### Session-Scoped Feedback Artifact Persistence Pattern
- Context: Persisting revision feedback artifacts for audit/release evidence without introducing new storage models.
- Implementation:
  - Reuse `SessionManager` content routing to persist deterministic per-round artifacts (`REVISION_CHECKPOINT` + `GENERATION_SNAPSHOT`).
  - Emit feedback envelope using canonical evidence fields (`artifact_type`, `schema_version`, `date`, `owner`, `input`, `output`, `result`, `evidence_links`, `trace`).
  - Link snapshot and checkpoint paths through deterministic ids (`revision-round-<n>`, `<checkpoint>-feedback`).
- Example:
  - `src/workflow/revision_loop.py:425` session manager initialization for loop persistence.
  - `src/workflow/revision_loop.py:479` revision checkpoint write via `ContentType.REVISION_CHECKPOINT`.
  - `src/workflow/revision_loop.py:499` feedback snapshot envelope write via `ContentType.GENERATION_SNAPSHOT`.

### Release Linkage Signal Pattern
- Context: Release evidence needs machine-verifiable confirmation that persisted feedback artifacts are linked and trace-complete.
- Implementation:
  - Add additive signal check scanning session snapshots for `quality_feedback` artifacts.
  - Validate required trace/evidence fields and summarize with deterministic detail keys.
  - Keep output machine payload contract unchanged (`checks` entries with stable `detail` formatting).
- Example:
  - `scripts/release_check_summary.py:443` `feedback_artifact_linkage_signal` check implementation.
  - `scripts/release_check_summary.py:592` additive check registration in release summary `checks`.
  - `tests/unit/scripts/test_release_check_summary.py:433` deterministic pass/warn coverage.

### Canonical Narrative Entity Schema Additive Mapping Pattern
- Context: Introducing a versioned narrative entity model for consistency checks without breaking existing distillation outputs.
- Implementation:
  - Define canonical additive schema (`narrative_entity.v1`) over existing extraction payloads (`entities`, `relations`, `events`) instead of replacing them.
  - Use deterministic identity/scope fields (`entity_id`, `entity_type`, `scope`) and preserve legacy payload keys as compatibility aliases during migration.
  - Reuse existing trace conventions (`session_id`, `scene_id`/checkpoint identifiers) for lineage and auditability.
- Example:
  - `src/workflow/state.py:87` distillation payload contract roots (`entities`, `relations`, `events`).
  - `src/workflow/graph.py:230` extraction output assembly with stable root keys.
  - `src/services/knowledge_layer.py:42` entity/relation persistence contract used as compatibility anchor.

### Canonical Trace Tuple Compatibility Guard Pattern
- Context: Ensuring canonical narrative artifacts remain consumable by downstream consistency/evidence consumers.
- Implementation:
  - Keep canonical artifact outputs additive (`canonical_entities`, `canonical_relations`, `canonical_trace`) while preserving legacy roots (`entities`, `relations`, `events`).
  - Treat `canonical_trace` as deterministic required tuple (`session_id`, `run_id`, `revision_id`).
  - Lock contract via focused state/graph regression assertions rather than introducing premature cross-module coupling.
- Example:
  - `src/workflow/graph.py:220` canonical trace emission.
  - `tests/unit/workflow/test_graph.py:224` canonical trace assertions.
  - `tests/unit/workflow/test_graph_distillation.py:172` canonical trace assertions.

### Contradiction Primitive Reuse Pattern
- Context: Implementing workflow-level conflict detection without introducing a parallel contradiction model.
- Implementation:
  - Reuse `SceneCoherenceDetector` contradiction primitives (`ContradictionType`, `Severity`, deterministic `CTD-*` IDs) as the canonical detector shape.
  - Map detector output additively onto workflow canonical artifact views (`canonical_entities`, `canonical_relations`, `canonical_trace`) instead of replacing legacy distillation payload roots.
  - Preserve release check machine payload determinism by keeping stable `key=value` detail serialization.
- Example:
  - `src/narrative/scene_coherence.py:33` contradiction taxonomy.
  - `src/narrative/scene_coherence.py:45` severity levels.
  - `src/narrative/scene_coherence.py:411` deterministic contradiction id generation.
  - `src/workflow/graph.py:217` canonical artifact output roots.

### Canonical Conflict Artifact Pattern
- Context: Exposing narrative contradiction signals for workflow/release consumers while preserving distillation compatibility.
- Implementation:
  - Emit additive `canonical_conflicts` in distillation output with deterministic fields (`conflict_id`, `conflict_type`, `severity`, `description`, `source_refs`).
  - Generate conflict IDs deterministically using stable `CTD-<index>` order within one distillation result.
  - Link conflict `source_refs` to canonical trace tuple fields (`session_id`, `run_id`, `revision_id`) for auditability.
- Example:
  - `src/workflow/state.py:107` distillation result typed contract with `canonical_conflicts`.
  - `src/workflow/graph.py:210` additive conflict artifact emission in `distillation_result`.
  - `tests/unit/workflow/test_graph.py:224` and `tests/unit/workflow/test_graph_distillation.py:172` deterministic conflict assertions.

### Conflict Artifact Release Linkage Signal Pattern
- Context: Release gates must verify that canonical conflict artifacts are persisted with traceable linkage, especially for critical contradictions.
- Implementation:
  - Add one additive release signal scanning generation snapshots for `output.canonical_conflicts` and validating trace tuple + evidence links.
  - Count linked conflict artifacts and linked critical conflicts separately, then emit deterministic detail keys in fixed order.
  - Keep release machine payload schema unchanged by appending a new `checks[]` entry only.
- Example:

### Repeated-Run Freshness/Trace Drift Guard Pattern
- Context: Release artifacts are regenerated repeatedly and must remain audit-compatible across runs.
- Implementation:
  - Execute deterministic double-run harness and compare targeted check rows by `check_id` across report payload and release artifact (`priority`, `blocking`, `status`, `detail`).
  - Enforce trace-shape invariants (`session_id`, `run_id`, artifact/report path suffixes, `trace_id` prefix) using shape checks instead of absolute paths.
  - Keep per-run `generated_at` aligned between payload and artifact while allowing expected cross-run timestamp progression.
- Example:
  - `tests/unit/scripts/test_release_check_summary.py:2165` repeated-run freshness/trace contract test.

### Release Cross-Surface Check Row Parity Pattern
- Context: Release report machine payload and release-readiness artifact must keep blocker provenance stable for downstream audit consumers.
- Implementation:
  - Build `checks[]` rows once via shared formatter path and reuse them across both report JSON payload and artifact payload.
  - Assert provenance-critical rows by `check_id` map parity (`priority`, `blocking`, `status`, `detail`) across both surfaces.
  - Keep `detail` key ordering deterministic (`key=value` pairs) to preserve repeatability.
- Example:
  - `scripts/release_check_summary.py:68` shared check row envelope.
  - `scripts/release_check_summary.py:162` artifact payload includes shared `checks` rows.
  - `tests/unit/scripts/test_release_check_summary.py:1900` cross-surface blocker provenance parity assertion.

### Chapter Gate Deterministic Signal Pattern
- Context: Introducing chapter release go/no-go checks must remain deterministic and compatible with existing release machine payload contracts.
- Implementation:
  - Reuse existing quality evaluator outputs (`quality_score`, `critical_issue_count`, `publish_recommendation`) as gate signal inputs instead of computing a parallel score path.
  - Encode blocker semantics as explicit machine-checkable predicates (critical count > 0 => no-go) and keep detail serialization in ordered `key=value` pairs.
  - Integrate signals additively into release `checks[]` with stable check IDs and unchanged envelope keys.
- Example:
  - `src/workflow/novel_quality.py:180` deterministic quality evaluator entry and score output.
  - `scripts/release_check_summary.py:61` shared `build_check_result` envelope contract.
  - `scripts/release_check_summary.py:132` `_format_detail_pairs` deterministic detail formatting.
  - `tests/unit/scripts/test_release_check_summary.py:496` stable signal detail assertions.


### Chapter Gate Evidence Linkage Signal Pattern
- Context: Release gate decisions need auditable linkage from chapter gate checks to persisted release evidence artifacts.
- Implementation:
  - Add one additive release signal that scans persisted `release_gate_run` snapshots and validates canonical trace tuple fields (`session_id`, `run_id`, `check_id`) plus non-empty `evidence_links`.
  - Confirm chapter-gate linkage through explicit machine fields (`trace.check_id`, `output.check_id`, or `output.checks[].check_id`) instead of free-form text matching.
  - Emit deterministic ordered detail keys (`snapshots_scanned`, `linked_release_gate_runs`, `chapter_gate_checks_linked`, `invalid_snapshots`) and register as additive `checks[]` entry without changing payload envelope.
- Example:
  - `scripts/release_check_summary.py:595` `chapter_gate_evidence_linkage_signal` additive linkage check.
  - `scripts/release_check_summary.py:1008` additive check registration in release summary `checks[]`.
  - `tests/unit/scripts/test_release_check_summary.py:635` deterministic pass/warn coverage for linkage/missing-field scenarios.

### Weekly Evidence Governance Cadence Pattern
- Context: KPI/evidence governance needs recurring freshness/comparability checks without introducing separate scheduler infrastructure.
- Implementation:
  - Use weekly evidence artifacts (`plan/review/trend`) as cadence anchors and keep owner metadata explicit (`core-workflow`).
  - Enforce governance at release check boundary via deterministic signals over weekly+quality evidence corpus.
  - Keep freshness/completeness checks machine-readable and additive (`check_id` + ordered `key=value` detail pairs) so GO/NO_GO decisions remain auditable.
- Example:
  - `.workflow/evidence/weekly/TEMPLATE-plan.md:3` owner metadata field.
  - `.workflow/evidence/weekly/2026-W09-review.md:4` active owner assignment.
  - `scripts/release_check_summary.py:595` evidence freshness signal.
  - `scripts/release_check_summary.py:1483` final GO/NO_GO derivation.


- Context: Stage handoff/lifecycle control must reject invalid transitions through one canonical policy path.
- Implementation:
  - Keep runner and step transition policy as explicit allowlists (`RUNNER_ALLOWED_TRANSITIONS`, `STEP_ALLOWED_TRANSITIONS`) and route all state changes through guard functions.
  - Preserve deterministic rejection behavior with stable machine-checkable fields (`from`, `to`, `reason`) via audit events and explicit `ValueError` rejection strings.
  - Derive handoff blocked/pending semantics from canonical step states in one handoff assembly path (`pending_steps != done`, `blocked_by = failed`).
- Example:
  - `src/workflow/workflow_engine.py:70` runner transition allowlist.
  - `src/workflow/workflow_engine.py:83` step transition allowlist.
  - `src/workflow/workflow_engine.py:902` step transition guard + rejection audit event.
  - `src/workflow/workflow_engine.py:1255` runner transition guard.
  - `src/workflow/workflow_engine.py:444` handoff pending/blocked derivation.

### Gate Approval Audit Trail Pattern
- Context: Gate decisions must remain auditable with deterministic, machine-checkable approval/rejection context.
- Implementation:
  - Reuse centralized gate decision + audit append boundaries (`_evaluate_risk_gate` + `_append_audit_event`) instead of introducing parallel approval stores.
  - Emit additive approval/rejection fields with stable keys (`decision`, `reason_code`, `confirmed`, `action`, `from`, `to`) in both response payload and audit events.
  - Preserve sensitive-token handling by keeping confirmation token redacted in responses and excluded from persisted raw audit payload.
- Example:
  - `src/workflow/workflow_engine.py:971` canonical risk gate decision payload.
  - `src/workflow/workflow_engine.py:1968` `confirm_trace` audit append boundary.
  - `src/workflow/workflow_engine.py:1255` runner transition rejection audit boundary.
  - `tests/unit/workflow/test_workflow_engine.py:1283` confirmation redaction + audit persistence assertions.

### Desktop Check P0 Gate Mapping Pattern
- Context: Desktop quality check participates in release GO/NO_GO as a blocking P0 signal.
- Implementation:
  - Keep `desktop_check` registration as `priority=P0` and `blocking=true` in release checks.
  - Derive GO/NO_GO only from blocking non-PASS checks (`no_go_reasons`) to preserve deterministic contract.
  - Fix upstream desktop typecheck/build failures rather than weakening gate semantics.
- Example:
  - `scripts/release_check_summary.py:1365` `desktop_check` check registration.
  - `scripts/release_check_summary.py:1619` deterministic `no_go_reasons` reduction.
  - `scripts/release_check_summary.py:1624` final `GO` vs `NO_GO` decision rule.

### Policy-Runtime Conformance Deterministic Check Pattern
- Context: Runtime quality gates and policy docs can drift across workflow/gateway/release layers.
- Implementation:
  - Treat `docs/quality/QUALITY_CRITERIA.md` + `docs/PDD.md` as policy source-of-truth for thresholds/blocker semantics.
  - Build deterministic conformance checks that compare runtime mappings (`state.py`, `novel_quality.py`, `novel_adapter.py`, `gateway.py`) and release checks (`release_check_summary.py`).
  - Emit machine-readable detail as ordered `key=value` pairs for stable CI assertions.
- Example:
  - `docs/quality/QUALITY_CRITERIA.md:12` strict pass threshold (>=99%).
  - `docs/PDD.md:1098` P0 semantics (`NO_GO/BLOCKED`).
  - `scripts/release_check_summary.py:1478` deterministic `no_go_reasons` -> decision reduction.
  - `tests/unit/scripts/test_release_check_summary.py:42` deterministic detail-order assertion.
