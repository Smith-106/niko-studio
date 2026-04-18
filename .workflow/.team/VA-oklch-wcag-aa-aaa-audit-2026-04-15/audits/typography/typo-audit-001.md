# Typography Accessibility Audit - 001
[typo-auditor]

## Summary
- Total checks audited: 11
- Pass: 5 | Fail: 6
- WCAG level: AA/AAA
- Critical issues: 0
- High issues: 3
- Audit mode: mixed evidence. Chrome runtime attachment was unavailable, so this audit used historical rendered desktop snapshots from the archived `.workflow/.team/TFD-ui-debug-2026-04-15` session (`evidence/VERIFY-001-evaluation-snapshot.html` and `evidence/VERIFY-002-settings-snapshot.html`), plus source review for the prompt template panel and shared shell styles.

## Evidence Base
- Historical rendered shell and editor snapshot from archived TFD session: `.workflow/.team/TFD-ui-debug-2026-04-15/evidence/VERIFY-001-evaluation-snapshot.html`
- Historical rendered settings snapshot from archived TFD session: `.workflow/.team/TFD-ui-debug-2026-04-15/evidence/VERIFY-002-settings-snapshot.html`
- Global typography and editor CSS: `desktop/src/styles/globals.css`
- Shell and panel sources: `desktop/src/components/AppHeader.tsx`, `desktop/src/components/AppMainContent.tsx`, `desktop/src/components/AppContextFooter.tsx`, `desktop/src/components/DocumentEditor.tsx`, `desktop/src/components/SettingsModal.tsx`, `desktop/src/components/PromptTemplatePanel.tsx`, `desktop/src/components/EvaluationPanel.tsx`
- Typography reference used: `docs/ui_design_guide.md` section 8.2. A dedicated `specs/typography-scale.md` file was not present.

## Font Size and Readability
| Surface | Evidence | Observed size | Threshold | Status |
|---|---|---:|---:|---|
| Main editor body | `desktop/src/styles/globals.css:253-261` | 18px, line-height 1.8 | 16px minimum | PASS |
| Main editor measure | `desktop/src/styles/globals.css:253-261` | max-width 680px | 45-75ch target | PASS |
| Document title | `desktop/src/components/DocumentEditor.tsx:58-66` | `text-2xl` to `md:text-3xl` | heading scale appropriate | PASS |
| Header app title | `desktop/src/components/AppHeader.tsx:73` | `text-base` | 16px minimum | PASS |
| Shell context bar | `desktop/src/components/AppMainContent.tsx:32-38` | `text-[11px]` | 14px preferred for utility copy | FAIL |
| Footer status bar | `desktop/src/components/AppContextFooter.tsx:8` and `desktop/src/components/DocumentEditor.tsx:77-107` | `text-[11px]` | 14px preferred for persistent UI copy | FAIL |
| Sidebar utility labels | rendered snapshot and `desktop/src/components/Sidebar.tsx` usage | 10px to 12px | 14px preferred | FAIL |
| Settings form labels | `desktop/src/components/SettingsModal.tsx:428`, `:659`, `:856`, `:1284` and many peers | mostly `text-xs` | 14px preferred | FAIL |
| Prompt template cards and chips | `desktop/src/components/PromptTemplatePanel.tsx:261`, `:279`, `:331`, `:336`, `:391` | 11px to 13px | 14px preferred for dense panel copy | FAIL |
| Evaluation supporting copy | `desktop/src/components/EvaluationPanel.tsx:374`, `:407`, `:448`, `:503`, `:537`, `:679`, `:721-722` | 11px to 12px | 14px preferred for analysis copy | FAIL |

## Line Height Audit
| Surface | Evidence | Observed | Expected | Status |
|---|---|---:|---:|---|
| Editor body | `desktop/src/styles/globals.css:253-261` | 1.8 | 1.5-1.75 typical, 1.8 still readable | PASS |
| Editor headings | `desktop/src/styles/globals.css:277-301` | 1.3 / 1.35 / 1.4 | 1.1-1.3 headings | PASS |
| Prompt template excerpt | `desktop/src/components/PromptTemplatePanel.tsx:336` | `leading-relaxed` | acceptable | PASS |
| Shell microcopy | many `text-xs` / `text-[11px]` without explicit relaxed leading | browser default / Tailwind default | marginal at 10-11px | FAIL |

## Reading Width and Zoom Resilience
| Surface | Evidence | Observation | Status |
|---|---|---|---|
| Editor canvas | `desktop/src/components/DocumentEditor.tsx:58` and `desktop/src/styles/globals.css:253-261` | 680px body width keeps measure in a readable range for prose | PASS |
| Settings modal | `desktop/src/components/SettingsModal.tsx:359-421` | `max-w-5xl` with `h-[85vh]` and internal scrolling is reasonable on desktop and should reflow better than fixed side panels | PASS |
| Prompt template panel | `desktop/src/components/PromptTemplatePanel.tsx:212-223` | hard-coded `w-[420px]` plus a 2/3 split grid makes the left list and right preview narrow under zoom or reduced desktop widths | FAIL |
| Evaluation panel | `desktop/src/components/EvaluationPanel.tsx:100`, `:390-738` | hard-coded `w-80` (320px) is tight for long Chinese analysis text and structured forms at 200% zoom | FAIL |
| Breakpoint behavior | `desktop/src/styles/globals.css:114-117` | only sidebar width changes at `max-width: 1024px`; no typography-specific breakpoint tuning or fluid scaling found | FAIL |

## Text Spacing Override Tolerance
| Check | Evidence | Observation | Status |
|---|---|---|---|
| Letter/word spacing override | `desktop/src/components/PromptTemplatePanel.tsx:331-336`, `:261`, `desktop/src/components/EvaluationPanel.tsx:537`, shell snapshot utility chips | uppercase 11px chips and line-clamped excerpts have low tolerance for `letter-spacing: 0.12em` and `word-spacing: 0.16em`; truncation risk is high | FAIL |
| 200% zoom resilience | fixed-width right panels above | likely to remain scrollable but become cramped, especially for multi-column prompt panel content | FAIL |

## Font Loading Strategy
| Check | Evidence | Observation | Status |
|---|---|---|---|
| Fallback stack | `desktop/src/styles/globals.css:81-88`, `desktop/tailwind.config.js:13-17` | defined for sans, serif, and mono | PASS |
| Webfont loading | project search for `@font-face`, `font-display`, `clamp(` | no custom webfont loading or preload found; no FOIT risk, but user-selected font consistency depends on installed local fonts | PASS |

## High Severity Issues
1. User font-size preference is persisted but never applied to the shell or reading surfaces.
   Evidence: `desktop/src/stores/settings/types.ts:141`, `desktop/src/stores/settings/state.ts:242`, `desktop/src/stores/settings/state.ts:354`, `desktop/src/components/SettingsModal.tsx:1284-1289`.
   Why it matters: users can select `small`, `medium`, or `large`, but there is no corresponding class, CSS variable, or layout hook consuming that setting. This blocks the expected readability control and weakens WCAG 1.4.4 compliance posture because users cannot enlarge text through the app’s own UI.

2. Persistent shell microcopy relies heavily on 10px to 11px text.
   Evidence: `desktop/src/components/AppMainContent.tsx:32-38`, `desktop/src/components/AppContextFooter.tsx:8`, `desktop/src/components/AppHeader.tsx:95-110`, rendered shell snapshot utility labels and sidebar pills.
   Why it matters: these sizes are below the 14px best-practice floor described in `docs/ui_design_guide.md` and are especially fragile for Chinese copy, where dense glyphs lose differentiation quickly.

3. Major right-side panels are fixed-width and become typographically cramped under zoom.
   Evidence: `desktop/src/components/PromptTemplatePanel.tsx:212-223`, `desktop/src/components/EvaluationPanel.tsx:100`.
   Why it matters: the prompt panel uses a hard `420px` shell with an internal 2/3 grid, while the evaluation panel is locked to `320px`. Both layouts compress long-form labels, helper copy, and structured actions when the user zooms or uses a narrower desktop window.

## Medium Severity Issues
1. Settings modal form labels and helper text are almost entirely `text-xs`, which is serviceable for short labels but weak for long bilingual descriptions and diagnostics.
2. Typography is mostly static. No `clamp()` or typography-specific media rules were found, so the shell does not adapt its text scale across breakpoints beyond one sidebar-width change.
3. Prompt template cards use `line-clamp-2` excerpts and 11px uppercase category chips, which are likely to truncate or become visually noisy under user text-spacing overrides.

## Passes
1. The editor reading surface is the strongest typography implementation in the app: 18px serif body, 1.8 line-height, and a 680px max width create a readable prose measure.
2. Settings modal containment is structurally sound for desktop: `max-w-5xl`, `h-[85vh]`, and scrollable body regions reduce clipping risk compared with the fixed side panels.
3. Font fallback stacks are defined for sans, serif, and mono usage. Because the app does not ship custom webfonts, it avoids FOIT-style failures.

## Recommended Remediation Order
1. Apply the persisted `fontSize` setting globally via a root data attribute or CSS custom property and scale shell/panel text tokens from that source.
2. Replace persistent 10px to 11px utility copy in shell chrome with at least 12px to 14px, prioritizing header status, footer text, sidebar labels, and panel metadata.
3. Convert right panel widths from fixed pixels to responsive constraints such as `minmax()` or `clamp()`, and allow the prompt template panel to collapse from a 2/3 split to a stacked layout when space tightens.
4. Reduce use of `line-clamp` on dense instructional copy and give small uppercase controls more size or lower tracking so WCAG 1.4.12 overrides remain usable.

## Overall Verdict
The main prose editor passes the typography audit, but the surrounding shell chrome and analysis/configuration panels do not. Readability problems are concentrated in microcopy sizing, missing user-controlled text scaling, and fixed-width panel layouts that are likely to degrade sharply under zoom or text-spacing overrides.
