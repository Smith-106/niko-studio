# Learnings

- `scripts/check-writing-helper.ps1` is the only top-level `scripts/*.ps1` file with non-ASCII source literals; it is saved as UTF-8 without BOM.
- On revision `6345c1bc33812fb8f449bef4ec501a9dcda0ae01`, `powershell.exe -File scripts/check-writing-helper.ps1 ...` reproduces the mojibake parser failure, while `pwsh -File ...` parses and executes.
- The fix must preserve the `POST /writing-helper/process` contract already covered by `src-ts/tests/mcp/writing-endpoints.test.ts`; the blocker is shell compatibility, not current endpoint semantics.
- `scripts/release_check_summary.py` computes `GO` or `NO_GO` only from its internal blocking checks array. It currently documents the writing-helper acceptance workflow but does not execute or score that gate in the decision model.
- The release sign-off truth surface is broader than the static governance surface: `docs/release/SIGN_OFF.md`, `.github/workflows/external-release-gate.yml`, and the 2026-04-14 release-validation strategy all treat strict writing-helper acceptance as blocking.
- `scripts/check_authority_alignment.py` and `scripts/delivery_gate.py` validate static anchors and wording, but they do not verify that retained release evidence reflects all operationally blocking gates. Any fix for summary drift should be backed by a regression in `tests/unit/scripts/test_governance_scripts.py`.
