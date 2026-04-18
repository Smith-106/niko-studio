# Decisions

- Use codex execution backend because the remaining work is multi-step and cross-cutting.
- Treat ANL-2026-04-18-为了交付客户还有哪些工作没做 as the primary upstream requirement source.
- `EXEC-001` freezes the authoritative customer-delivery baseline to `4d63e03 / 9.0.8`; downstream EXEC tasks should treat `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json` as the session-local source of truth instead of the current dirty workspace.
- `EXEC-002` freezes that same baseline into `.workflow/evidence/release/customer-delivery-baseline.json` and explicitly reuses the retained GO proof set under `.workflow/evidence/release/`; do not rerun release proof unless a later task selects a different SHA.
