# Rule-first + LLM enhancement layering — 2026-06-21

**Source**: quality-retrospective M26-P1 (technical lens), INS-8ab166cd
**Type**: technique / pattern

## When to use
Building an analysis feature where the rule surface is enumerable (AI-flavor, style metrics, readability stats). Prefer shipping rules first, then layer LLM on top only where rules are insufficient.

## Pattern
- **Layer 1 (rules)**: pure functions, regex + statistics, zero LLM dependency, runs in microseconds, deterministic, fully testable
- **Layer 2 (LLM enhancement)**: optional, only where rules insufficient
- **Degradation**: when LLM path unconfigured/unavailable, fall back to rule layer gracefully — never crash
- **Observability**: log which path executed (rules-only / LLM-enhanced) so UAT can identify the active mode

## Evidence (M26)
- `src-ts/reader/ai-flavor-detector.ts:470` — `detectAIFlavor` entry, no async/await, no fetch, pure rule-based
- `.summaries/TASK-004-summary.md:49` — pure rule layer, near-zero overhead
- `src-ts/services/revision-service.ts:199-201` — LLM path gracefully falls back to rule-based when env vars unset
- TASK-009 persona persistence: file I/O error degrades to in-memory storage (same graceful-degradation shape)

## Result
85% coverage, 12 deterministic tests, degrades gracefully when LLM rewrite path unconfigured.

## Related
- [[KNW-retro-verification-green-not-healthy-2026-06-21]] — why rule coverage alone can mask dimensional gaps
- [[KNW-retro-scope-deviation-deferred-record-2026-06-21]]
