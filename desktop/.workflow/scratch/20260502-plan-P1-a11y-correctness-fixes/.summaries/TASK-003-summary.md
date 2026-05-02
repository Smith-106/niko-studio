# TASK-003 Summary: Update test files for Wave 1 fixes

## File Modified

- `src/components/ChatAreaComposer.test.tsx`

## Changes Applied

### 1. Trash2 button tests (MNT-007 fix)
- **Empty-input test**: Changed from `getByTitle('clear draft')` to `getByRole('button', { name: 'clear draft' })` since `aria-hidden` was removed. Added `toHaveAttribute('tabindex', '-1')` assertion matching the new `tabIndex={input.length === 0 ? -1 : undefined}` logic.
- **Non-empty-input test**: Added `toHaveClass('opacity-100')` positive assertion and `not.toHaveAttribute('tabindex')` assertion.

### 2. Copy live region test
- Added new test `'announces copy status via live region for screen readers'` that verifies the `role="status"` sr-only element contains `'Copied!'` after clicking copy, and clears to `''` after 1500ms timer advance.

### 3. `vi.unstubAllGlobals()` cleanup
- Extracted clipboard-related tests into a dedicated `describe('ChatAreaComposer clipboard tests', ...)` block with `afterEach(() => vi.unstubAllGlobals())` to prevent navigator stub leaking into other suites.

### 4. Paperclip focus ring test
- Added new test `'paperclip button has focus-visible ring class'` asserting the upload button has `focus-visible:ring-2`.

### 5. `debouncedPersist.call()` update
- No-op: confirmed `ChatArea.test.tsx` does not reference `debouncedPersist` or `makeDebounce` directly.

## Test Results

- 84 test files, 841 tests -- all passing
- ChatAreaComposer.test.tsx: 11 tests (up from 9, 2 new tests added)
