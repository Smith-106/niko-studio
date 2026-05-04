# M6 Learnings: Performance & Technical Debt

**Milestone**: M6
**Extracted**: 2026-05-05T01:15:00.000Z

---

<spec-entry category="learning" keywords="react-lazy,named-export,code-splitting" date="2026-05-05" source="M6/TASK-2.1">
React.lazy requires default exports. Named-export components need `.then(m => ({ default: m.ComponentName }))` wrapper pattern. Applies to any component using `export function` or `export const` syntax.
</spec-entry>

<spec-entry category="learning" keywords="zustand,selector,over-subscription,re-render" date="2026-05-05" source="M6/TASK-2.3">
Bare `useAppStore()` destructuring subscribes to all store changes, causing re-renders on any state mutation. Targeted selectors (`useAppStore(s => s.specificField)`) subscribe only to the selected slice. Action selectors (returning stable function references) prevent re-renders from unrelated state changes.
</spec-entry>

<spec-entry category="learning" keywords="lighthouse,bundle-size,performance-baseline" date="2026-05-05" source="M6/TASK-001">
Lighthouse baselines should be captured before optimization work begins. Score 72 with 457KB bundle established realistic targets: ≥80 score, ≤320KB bundle, FCP <1800ms, LCP <2500ms, TBT <200ms.
</spec-entry>

<spec-entry category="learning" keywords="suspense,fallback,ux,loading-state" date="2026-05-05" source="M6/TASK-2.2">
Lazy-loaded panels need meaningful Suspense fallbacks (skeleton/spinner) rather than null or empty divs, to prevent layout shift and provide visual feedback during chunk loading.
</spec-entry>

<spec-entry category="learning" keywords="selector-pattern,test-stability" date="2026-05-05" source="M6/TASK-2.5">
New Zustand selectors should have corresponding test coverage verifying: (1) initial value, (2) reactive updates via setState, (3) stable reference for action selectors across rerenders. Test count went from 899 → 903 with 4 new assertions covering 3 selectors.
</spec-entry>
