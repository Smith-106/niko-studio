# Release Validation Quality Report

## Session

- Session: `TST-release-validation-2026-04-14`
- Date: `2026-04-14`
- HEAD: `6345c1bc33812fb8f449bef4ec501a9dcda0ae01`
- Strategy artifact: `strategy/test-strategy.md`
- Analyst verdict for current HEAD: `NO_GO`

## Executive Verdict

Current HEAD is not releasable from this session.

Reason: the strategy-defined strict Windows acceptance gate `./scripts/check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1` failed before any request-level assertions executed. The failure is a PowerShell parser error caused by garbled text literals in `scripts/check-writing-helper.ps1`, so L3 release proof is incomplete even though packaging dry-run and `scripts/release_check_summary.py` both exited `0`.

The regenerated `release-check-summary.md` reports `Decision: GO`, but that artifact does not reflect the failed writing-helper acceptance gate captured in `TESTRUN-004`. For release sign-off, the session verdict must follow the strategy's blocking command set, so the operational verdict remains `NO_GO`.

## Lane Outcomes

| Lane | Result | Commands | Duration | Notes |
| --- | --- | ---: | ---: | --- |
| Governance fast-fail | PASS | 3/3 | 6.170s | `delivery_gate.py`, `check_authority_alignment.py`, and targeted pytest all passed; authority alignment was `92/92` with `0` mismatches. |
| `src-ts` authoritative | PASS | 3/3 | 70.161s | `check:local` passed; phase4 coverage was `94.87%` statements, `80.8%` branches, `99.47%` functions, `94.87%` lines. Runtime and workflow integration pairs also passed. |
| Desktop authoritative | PASS | 3/3 | 100.662s | `desktop check:local`, `local:selftest`, and strict sidecar contract validation all passed. Desktop Vitest reported `22` files and `160` tests passed. |
| Final release proof | FAIL | 4/5 | 247.413s | Packaging dry-run passed, gateway start/stop succeeded, and `release_check_summary.py` generated refreshed evidence with `Decision: GO`; strict writing-helper acceptance failed immediately on PowerShell parse errors. |

Overall recorded command pass rate: `13/14` (`92.9%`).

## Coverage Analysis

| Layer | Coverage signal | Target | Status |
| --- | --- | --- | --- |
| L1 | Governance pytest `11` passed; `src-ts` phase4 coverage `94.87/80.8/99.47/94.87`; desktop Vitest `160` passed | `>= 80` | Met |
| L2 | Changed integration/runtime surfaces all green across `src-ts check:local`, targeted runtime/workflow pairs, desktop `check:local`, `local:selftest`, and strict sidecar contract | `>= 60` | Met |
| L3 | Strategy-required blocking commands passed `4/5` (`80%`); request-level writing-helper acceptance coverage is effectively `0%` because execution stopped at parse time | `100%` blocking commands | Below |

## Defect Patterns

| Pattern | Frequency | Severity | Operational impact |
| --- | ---: | --- | --- |
| `writing_helper_acceptance_script_parse_error` | 1 | LOW | Critical release blocker; strict acceptance never executed. |
| `release_summary_go_mismatch_with_session_gate` | 1 | LOW | High reporting risk; refreshed evidence says `GO` although a strategy-defined blocker failed. |
| `preexisting_port_18080_listener` | 1 | LOW | Advisory only; executor left unrelated PID `45200` untouched and still completed the managed gateway flow safely. |

## Coverage Gaps

| Area | Current | Gap | Reason | Recommendation |
| --- | ---: | ---: | --- | --- |
| Strict writing-helper acceptance | 0% request-level assertions executed | 100% | `scripts/check-writing-helper.ps1` cannot parse due to garbled string literals | Repair the script encoding/text literals, then rerun the strict acceptance command against a managed gateway. |
| L3 blocking-command completion | 80% | 20% | One required blocking gate failed | Re-run the full final release proof lane after the script fix, not just the isolated acceptance step. |
| Release evidence alignment with session truth | Partial | Partial | `release_check_summary.py` generated `GO` without reflecting the failed acceptance gate | Treat the summary as insufficient for sign-off until the acceptance gate is either included or separately enforced in the release checklist. |

## GC Loop Effectiveness

| Metric | Value | Assessment |
| --- | ---: | --- |
| Rounds | 0 | Not used in this session |
| Coverage improvement | 0% | N/A |
| Re-run efficiency | N/A | No generator-critic loop was required because the session reused existing repo gates |

## Quality Score

| Dimension | Score (1-10) | Weight |
| --- | ---: | ---: |
| Coverage Achievement | 6.0 | 30% |
| Test Effectiveness | 8.0 | 25% |
| Defect Detection | 8.0 | 25% |
| GC Loop Efficiency | 2.0 | 20% |

Weighted quality score: `6.2 / 10`.

## Timing

- Earliest lane start: `2026-04-14T23:32:56.7544903+08:00`
- Final lane completion: `2026-04-14T23:54:12.8901676+08:00`
- Session wall-clock span across recorded lanes: about `21m 16s`
- Sum of recorded lane durations: `424406 ms` (`7m 04.406s`)

## Trend Context

No prior `TST-*` session metadata exists in this workspace window, so no historical trend comparison is available.

## Recommended Next Actions

1. Fix the parser/encoding corruption in `scripts/check-writing-helper.ps1`.
2. Rerun the final release proof lane end-to-end: gateway start, strict writing-helper acceptance, gateway stop, and `python scripts/release_check_summary.py`.
3. Do not ship current HEAD from this evidence set unless the acceptance blocker is cleared and the release summary is consistent with the full blocking gate set.
