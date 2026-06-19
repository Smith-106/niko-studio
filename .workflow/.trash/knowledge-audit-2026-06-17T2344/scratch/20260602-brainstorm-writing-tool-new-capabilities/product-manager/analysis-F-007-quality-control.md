# F-007 — 质量控制机制（硬约束 + 软约束创意谱图）

> Role: product-manager | Related decisions: SA-05, SME-01, PM-05, UX-03

## Architecture

Quality Control implements a two-tier constraint system (SA-05): hard constraints from Craft Analysis Services are enforced (generation MUST pass), and soft constraints from the creativity spectrum are advisory (generation SHOULD consider). This dual-tier approach preserves quality baselines while retaining creative freedom.

Hard constraints map directly to the four quality dimensions (SME-01): plot coherence, character consistency, style consistency, and pacing/tension. Any generation that violates hard constraints is flagged and MUST be revised before acceptance.

Soft constraints are governed by the creativity slider (PM-05, UX-03) with four labeled presets: Conservative, Balanced, Creative, Experimental. The slider controls how strictly soft constraints are applied — Conservative enforces them tightly, Experimental relaxes them substantially.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `qualityControl.validate` | `{ text, mode } → ValidationResult` | Co-Writing Engine, Reader Simulation |
| `qualityControl.hardConstraints` | `→ Constraint[]` | Constraint management |
| `qualityControl.softConstraints` | `{ creativityLevel } → Constraint[]` | Creativity slider integration |
| `qualityControl.report` | `{ validationId } → QualityReport` | Detail display |

## Constraints (RFC 2119)

- Quality Control MUST implement two tiers: hard constraints (enforced) and soft constraints (advisory) (SA-05).
- Hard constraints MUST cover four dimensions: plot coherence, character consistency, style consistency, pacing/tension (SME-01).
- Generation that violates hard constraints MUST be flagged and MUST NOT be accepted without revision.
- Soft constraints MUST be governed by the creativity slider with four presets: Conservative, Balanced, Creative, Experimental (PM-05, UX-03).
- The creativity slider default MUST be "Balanced" to prevent over-generation.
- Quality reports SHOULD include specific violation locations and suggested remediation.

## Test Approach

- Unit: Hard constraint validation logic, soft constraint scaling with creativity level.
- Integration: Co-Writing generation → Quality Control validation → acceptance/rejection flow.
- E2E: Writer generates text, quality report shows violations, writer revises.
- Edge case: Verify that "Experimental" creativity level does not bypass hard constraints.

## TODOs

- Define hard constraint threshold values per dimension.
- Specify soft constraint scaling formula across creativity levels.
- Design quality report display format for non-technical users.
- Determine whether quality reports feed into Reader Simulation persona configurations.
