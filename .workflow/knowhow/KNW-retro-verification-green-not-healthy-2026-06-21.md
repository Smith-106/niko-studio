---
related:
  - "knowhow-knw-retro-reuse-callapi-wrapper-2026-06-21"
  - "knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21"
  - "knowhow-knw-retro-scope-deviation-deferred-record-2026-06-21"
---
# Structural verification green ≠ code healthy — 2026-06-21

**Source**: quality-retrospective M26-P1 (quality lens), INS-f54a8bff
**Type**: gotcha / lesson

## The trap
`verification.json` checks truth/artifact/key_link existence. M26-P1 verified 6/6 truths passed, **0 gaps**, coverage 0.85 — a green signal. But the same batch of code yielded **21 review findings** in dimensional review, including **2 high** severity (ConsensusEngine division-by-zero, RevisionService LLM without HTTPS/timeout).

The structural verification's 0-gap green masked real risk because the must-have truths did not include boundary/security constraints.

## Lesson
When planning `must_have.truths`, include not just existence checks but **boundary conditions and security constraints**:
- empty-array / division guards (catches CORR-003 除零)
- protocol enforcement (catches SEC-003 HTTPS)
- timeout / abort signals (catches SEC-003 fetch hang)
- input range validation (catches SEC-004 NaN/Infinity)

A dimensional review is **never optional** even when verification is green. The two layers measure different things:
- verification = "does the structure exist and wire up"
- review = "does the code behave correctly across dimensions"

## Evidence
- `.workflow/scratch/20260618-plan-P1-reader-simulation-anti-ai-flavor/verification.json` — gaps: [], coverage 0.85
- `.workflow/scratch/20260619-review-P1-reader-simulation-anti-ai-flavor/review.json` — severity_distribution 2 high / 12 med / 7 low
- Both high findings mapped to UAT accepted_risk (T-012 CORR-003, T-013 SEC-003) — verification did not surface them

## Related
- [[knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21]]
- [[knowhow-knw-retro-scope-deviation-deferred-record-2026-06-21]]
