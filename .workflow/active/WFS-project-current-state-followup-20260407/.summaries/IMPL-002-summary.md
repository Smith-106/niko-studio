## Summary
Added a first-pass repo-local JS/TS quality baseline with shared root config, bounded package-level lint/format commands, and authoritative `check:local` entrypoints for `desktop` and `src-ts`.

## Files Modified
- `desktop/package.json`
- `desktop/package-lock.json`
- `src-ts/package.json`
- `src-ts/package-lock.json`
- `eslint.config.mjs`
- `prettier.config.mjs`
- `.prettierignore`

## Key Decisions
- Used a root-level ESLint + Prettier configuration but kept the first-pass format scope limited to package manifests and shared quality-config files.
- Let source-code enforcement come from `lint`, `typecheck`, and existing high-signal tests instead of reformatting the whole repository.
- Kept governance/authority surfaces out of scope; this task only establishes the local developer-loop baseline.

## Tests
- `npm --prefix src-ts run check:local`
- `npm --prefix desktop run check:local`
