# DISCUSS-001 Initial Discussion

- Session: `UAN-project-delivery-audit-2026-04-13`
- Round: `1`
- Type: `initial`
- Timestamp: `2026-04-13T01:47:20.6660383+08:00`

## Convergent Themes

1. The repository is materially late-stage and the default standard workflow path is broadly aligned. Release gates, authority alignment, desktop build/test, and backend workflow route tests all point to a build candidate rather than an unfinished rewrite.
2. The main delivery risk is localized, not systemic. No analysis argues that workflow, config, admin, and desktop bootstrap are broadly broken.
3. `uiBridge` config-source drift is real, but every perspective treats it as scoped to a non-default optional mode. It only becomes customer-blocking if that mode is intentionally exposed as supported behavior.
4. The checkpoint authority seam is real. All perspectives agree create/list/restore are less scoped than the rest of the workflow control plane; they differ only on whether that is currently an acceptable bounded risk or an immediate customer blocker.
5. Formal handoff completeness is weaker than product-build readiness. Fresh GO release evidence exists, but the repository/package evidence shown in this session does not match the full retention contract documented in `SIGN_OFF.md`.

## Conflicts And Severity Splits

- `Build candidate` versus `formal client handoff` is the main judgment split. Technical and business analyses both narrow earlier GO conclusions: the product can likely ship as a candidate build, but that does not prove polished completeness or evidence-package completeness.
- The Evaluation quality-check mismatch has the strongest cross-role blocker signal, but it is still inferred from source alignment rather than reproduced by a live packaged click-through in this round.
- The checkpoint authority gap is confirmed technically, but blocker severity depends on product scope:
  - If checkpoint restore/recovery surfaces are exposed to customers, the architectural view treats this as a pre-delivery blocker.
  - If the shipped profile is single-user/single-workspace or restore UI is hidden, the technical view treats it as a bounded residual risk.
- `uiBridge` is agreed to be real drift, but its severity is conditional on whether the customer can see or select that mode.

## Top Discussion Points

1. The Evaluation panel still appears wired to `/api/novel/quality-check`, while the gateway exposes `/writing/quality`, and current tests reinforce the stale path. This is the clearest likely customer-visible defect.
2. The main workflow control plane should not be downgraded to a general mismatch story. Standard-mode workflow, config, and admin flows are materially aligned and tested.
3. Checkpoint authority coverage is the main architecture-level seam left inside an otherwise aligned control plane.
4. Release-readiness proof and formal sign-off proof should be treated separately. Current evidence supports GO-for-build more than GO-for-formal-handoff.
5. Prior GO conclusions from 2026-04-09 and 2026-04-12 remain useful baseline context, but this round adds enough current evidence to narrow them: they overstated either customer-experience completeness or formal sign-off completeness.

## Confirmed Blockers And Conditional Blockers

- Confirmed gap: the repository/package evidence visible in this session does not contain the full `SIGN_OFF.md` authority/XML retention set. That blocks a clean formal handoff package unless policy changed or evidence lives outside this checkout.
- Confirmed seam: checkpoint create/list/restore are not scoped like the rest of the authority-bound workflow APIs. This becomes a delivery blocker if checkpoint restore is available in customer-facing surfaces.
- High-confidence likely blocker: the Evaluation quality-check route is mismatched in source and tests. It should be treated as customer-blocking unless a compatibility alias exists outside this repository or the feature is explicitly out of delivery scope.
- Conditional blocker: `uiBridge` runtime enablement drift matters only if `workflowBackendMode=uiBridge` or related config controls are exposed as supported customer options.

## Remaining Uncertainty

- No live packaged runtime click-through was executed in this discussion round, so the Evaluation defect is strongly inferred rather than directly reproduced.
- The current delivery package may rely on artifacts stored outside git or outside the current checkout; this session only confirms that the repo snapshot and advertised package contents do not show them.
- The intended release profile is still unclear on two customer-scope questions:
  - Are `uiBridge` controls visible and supported?
  - Are checkpoint restore/recovery surfaces visible in the customer build?

## Working Discussion Verdict

Working consensus is converging on a two-level judgment:

- Product build candidate: `GO_with_watchlist`
- Polished customer-ready completeness: `not yet proven`
- Formal client handoff package: `not complete`

The next synthesis should therefore separate `can ship a build` from `can claim complete customer handoff`, and should explicitly call out the Evaluation defect, checkpoint-scope condition, and missing sign-off evidence pack.
