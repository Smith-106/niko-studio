# TASK-004: Error recovery UI — typed error handling with auto-retry

## Changes
- `src/hooks/useChatStreaming.ts`:
  - Added retry loop inside `startStream()` with `maxRetries = 2`.
  - On recoverable error (`streamErrorPayload.recoverable`), waits `retry_after` seconds then retries the stream.
  - Captures error payload from `onError` callback including `error_class`, `recoverable`, `retry_after`.
  - Shows "Retrying (N/2)..." status via `onRecoverStatus`.
  - Resets streaming state between retries via `reset('')`.
  - Added `retryCountRef` for tracking across calls.
- `src/hooks/useChatRecovery.ts`:
  - Extended `RecoverStatus` type with `error_class`, `recoverable`, `retry_after` fields.
- `src/components/ChatAreaStreamStatus.tsx`:
  - Extended `ChatAreaStatus` interface with `error_class`, `recoverable`, `retry_after`.
  - Added error class badge display: shows uppercase error class label (e.g. "RATE LIMIT") in error card.

## Convergence
- [x] useChatStreaming.ts contains error_class and recoverable logic
- [x] useChatStreaming.ts contains auto-retry with retry_after delay
- [x] useChatRecovery.ts has recoverable field in RecoverStatus type
- [x] ChatAreaStreamStatus.tsx shows error class badge with Retry button
