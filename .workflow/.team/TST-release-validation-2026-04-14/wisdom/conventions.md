# Strategist Conventions

- Package manager: `npm`
- Primary TypeScript test framework: `Vitest`
- Python governance test framework: `pytest` via `python scripts/run_targeted_pytest.py ...`
- Windows acceptance path: PowerShell scripts plus a background gateway process

## Detected Test Patterns

- `src-ts/tests/**/*.test.ts`
- `src-ts/tests/**/*.integration.test.ts`
- `desktop/src/**/*.test.ts`
- `desktop/src/**/*.test.tsx`
- `tests/unit/scripts/test_*.py`

## Authoritative Release Entrypoints

- `npm --prefix src-ts run check:local`
- `npm --prefix src-ts run test:release`
- `npm --prefix desktop run check:local`
- `npm --prefix desktop run local:selftest`
- `npm --prefix desktop run validate:package:dry-run`
- `python scripts/delivery_gate.py`
- `python scripts/check_authority_alignment.py`
- `python scripts/release_check_summary.py`
- `./scripts/check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1`

## Current HEAD Strategy Notes

- Current HEAD is `6345c1bc33812fb8f449bef4ec501a9dcda0ae01`.
- Current release baseline tag is `v9.0.6` (`6684b29`).
- The committed delta is concentrated in release workflows, governance scripts, desktop launcher scripts, packaging metadata, and docs.
- `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe` exists in this checkout, so the packaging conditional introduced in CI resolves to strict mode here.
- No new test files should be authored for release validation; existing gates are sufficient.
