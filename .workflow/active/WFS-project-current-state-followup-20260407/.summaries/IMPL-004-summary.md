## Summary
Tightened the deprecated web compatibility surface so root/forward/404 responses now carry explicit compatibility-only headers and primary-path hints while preserving the existing 410/302 gating behavior and websocket opt-in semantics.

## Files Modified
- `src-ts/web/app.ts`
- `src-ts/tests/web/app.test.ts`

## Key Decisions
- Kept the root policy unchanged: default 410, explicit validated forwarding only on http/https URLs.
- Added compatibility headers instead of adding new runtime branches, so callers can clearly detect this as a bounded fallback surface.
- Left websocket workflow opt-in logic intact; this task only makes the compatibility framing more explicit.

## Tests
- `npm --prefix src-ts run test -- tests/web/app.test.ts`
- `npm --prefix src-ts run typecheck`
