## Summary
Extracted the live desktop invoke surface into a shared Tauri contract plus transport helper layer, then updated `client.ts`, `useAppBackendBootstrap.ts`, and `SettingsModal.tsx` to consume that contract instead of inlining command strings.

## Files Modified
- `desktop/src/api/client.ts`
- `desktop/src/api/tauri-contract.ts`
- `desktop/src/api/transport.ts`
- `desktop/src/hooks/useAppBackendBootstrap.ts`
- `desktop/src/components/SettingsModal.tsx`

## Key Decisions
- Preserved the existing 5-command Rust surface and moved only the desktop-side ownership of command names, request envelope, and runtime-base caching.
- Kept gateway behavior unchanged; this task only thins the frontend-to-host seam.
- Reused the transport helper in the two additional live invoke call sites so `client.ts` is no longer the only place that knows command strings.

## Tests
- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run test -- src/api/client.test.ts src/components/SettingsModal.test.tsx`
- `cargo check --manifest-path desktop/src-tauri/Cargo.toml`
