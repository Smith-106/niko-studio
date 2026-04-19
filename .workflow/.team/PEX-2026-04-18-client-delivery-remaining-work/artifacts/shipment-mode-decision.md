# Shipment Mode Decision

## Result

- `task_id`: `EXEC-004`
- `issue_id`: `ISS-20260418-004`
- `baseline`: `4d63e03 / 9.0.8`
- `customer decision`: `unsigned demo/internal handoff`
- `decision`: `UNSIGNED_DEMO_INTERNAL_HANDOFF`
- `status`: `mode_recorded`

## Mode Options Against The Frozen Baseline

1. `unsigned demo/internal handoff`
   - Aligns with the intentionally unsigned local packaging evidence described in `docs/release/SIGN_OFF.md`.
   - Uses the frozen retained baseline `4d63e03db1f673379901fb827aff1a1f6947faa8 / 9.0.8` without triggering signing or rebuild work in this issue.
2. `signed external shipment`
   - Requires release-private certificate thumbprint and timestamp URL material outside git before a signed bundle can be produced.
   - Is not selected for this delivery session.

## Selected Mode

- `owner`: `user-confirmed delivery owner`
- `recorded_by`: `executor`
- `decision_date`: `2026-04-18`
- `selection_reason`: user input for `EXEC-004` explicitly chose `unsigned demo/internal handoff`.

Active next-step obligations for the selected mode:

1. `EXEC-006` may only bound evidence obligations that apply to an `unsigned demo/internal handoff` on frozen `Windows x64 / 4d63e03 / 9.0.8`.
2. `EXEC-006` must keep signing, certificate material lookup, timestamp configuration, and rebuild work out of scope unless a new shipment-mode decision supersedes this artifact.
3. `EXEC-007` must label the customer handoff bundle as `unsigned demo/internal handoff` and must not imply that the bundle is a signed external shipment.
4. The delivery owner must ensure recipients understand the bundle is for demo/internal handoff use only, not for a signed external customer release.

## Executed Outcome

- `EXEC-006` completed scope-bounding for the selected unsigned path without opening any signing work.
- `EXEC-007` assembled the customer handoff bundle with `shipment_mode = unsigned demo/internal handoff`.
- Final delivery readiness remained in hold state because the retained writer-smoke blocker remained active.
- Current hold artifacts:
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`

## Explicit Out-Of-Scope Branch

- `signed external shipment` is explicitly out of scope for this delivery.
- No signing workflow, certificate-thumbprint configuration, timestamp configuration, or signed package rebuild is authorized by this issue.
- If the shipment mode changes later, record a superseding shipment-mode decision first, then run the signed packaging/evidence flow on the exact signed artifact before updating the bundle contents.

## Downstream Contract

- `EXEC-006` must cite this artifact together with `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/platform-scope-decision.json` so scope-bounding stays limited to `Windows x64` and `unsigned demo/internal handoff`.
- `EXEC-006` must treat `signed external shipment` as excluded work for this session unless a later decision artifact replaces this one.
- `EXEC-007` must cite this artifact so the customer handoff bundle carries the correct shipment label and explicit out-of-scope note for signed external shipment.
- Final customer-delivery readiness remains tied to the retained writer-smoke hold artifacts above.
