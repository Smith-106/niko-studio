# Reuse callApi/ApiResponse wrapper for new frontend API layers — 2026-06-21

**Source**: quality-retrospective M26-P1 (technical lens), INS-31c776c2
**Type**: pattern / convention

## When to use
Adding a new feature's frontend API layer in `desktop/src/api/`. Copy the existing convention verbatim rather than inventing a new fetch wrapper.

## Pattern (from desktop/src/api/writing-craft.ts, reused by reader.ts)
- One thin function per endpoint
- Direct `callApi` return — no inner envelope unwrap
- `params as unknown as Record<string, unknown>` to satisfy callApi's body signature
- Import `{ type ApiResponse, callApi } from './core'`

The body cast is an **accepted project-wide tradeoff**, not a per-file decision. Match it exactly.

## Evidence (M26)
- `desktop/src/api/reader.ts:1` — `import { type ApiResponse, callApi } from './core'`
- `desktop/src/api/reader.ts:190` — `createCustomPersona` uses `params as unknown as Record<string, unknown>`
- `.summaries/TASK-002-summary.md:56` — note: "consistent with existing API layer writing-craft.ts"

## Related
- [[KNW-retro-rule-first-llm-enhancement-2026-06-21]]
