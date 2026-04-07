## Summary
Retired the legacy Python coverage defaults from `pytest.ini` and aligned the local semantic gate with the new `check:local` anchors in `desktop/package.json` and `src-ts/package.json`.

## Files Modified
- `pytest.ini`
- `scripts/delivery_gate.py`

## Key Decisions
- Kept pytest markers and developer-friendly output intact while removing the stale `--cov=src` / `--cov-fail-under=100` defaults.
- Limited delivery-gate changes to local-baseline anchors only; no `.github`, authority-alignment, or release-summary rules were touched.

## Tests
- `python -m pytest tests/unit/scripts/test_governance_scripts.py -q`
- `python scripts/delivery_gate.py`
