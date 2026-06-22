# TASK-004 Summary: Add weight NaN/Infinity/range validation to persona endpoints (SEC-004)

## Status: COMPLETED

## Files Modified
- `src-ts/reader/mcp/reader-endpoints.ts` — Added validateWeight import + guards + NaN safety in adjustPersonaWeights

## Implementation

1. **Import**: Added `validateWeight` to existing import from `../../mcp/input-validation.js`

2. **rsCreateCustomPersonaEndpoint** — Added validateWeight call inside the numericFields loop:
   ```typescript
   if (value !== undefined) {
     const weightErr = validateWeight(value, 0, 1, `parameters.${field}`);
     if (weightErr) return weightErr;
   }
   ```
   This validates all 5 weight fields (plotWeight, characterWeight, styleWeight, pacingWeight, toleranceThreshold) for:
   - NaN → 400 "must be a finite number"
   - Infinity → 400 "must be a finite number"
   - Out of [0, 1] range → 400 "must be between 0 and 1"

3. **adjustPersonaWeights** — Replaced NaN-unsafe pattern:
   - Before: `const currentWeight = (persona.parameters[paramKey] as number | undefined) ?? 0.5;`
   - After: `const raw = persona.parameters[paramKey]; const currentWeight = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : 0.5;`
   - Defense-in-depth: even if corrupted data bypasses input validation, NaN falls back to 0.5

## Convergence Criteria Verification

| Criterion | Status |
|-----------|--------|
| reader-endpoints.ts contains 'validateWeight' import | ✅ PASS (1 import + 1 call) |
| Number.isFinite in adjustPersonaWeights | ✅ PASS (1 match) |
| validateWeight >= 5 calls (runtime) | ✅ PASS (loop covers 5 fields) |
| npx tsc --noEmit passes | ✅ PASS (zero errors) |

## Deviations
- None. Implementation follows plan exactly.
