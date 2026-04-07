## Summary
Extracted the shared desktop gateway DTO families into `contracts.ts` so `client.ts` now focuses on endpoint behavior and facade logic while preserving its public type surface through re-exports.

## Files Modified
- `desktop/src/api/client.ts`
- `desktop/src/api/contracts.ts`

## Key Decisions
- Moved the three cross-cutting families called out in the plan: gateway health/runtime, gateway service config admin, and writing-helper request/response.
- Preserved downstream imports by re-exporting the moved types from `client.ts`.
- Left backend config and endpoint-local shapes in `client.ts`; this task only separated the shared contract layer.

## Tests
- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run test -- src/api/client.test.ts`
