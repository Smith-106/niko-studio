# Finding: Story Bible Completeness as Generation Gate

> Role: subject-matter-expert | Impact: HIGH

## Description

Sudowrite's data shows that users who skip Story Bible setup produce significantly worse AI output (see design-research, PM-03 rationale). This suggests Story Bible completeness should function as a generation gate, not just an optional context source. However, making Story Bible strictly required creates a cold-start problem: new users with empty manuscripts cannot auto-extract entities and therefore cannot use AI generation.

The tension between "Story Bible improves output quality" and "mandatory Story Bible blocks new user adoption" requires a nuanced approach. A binary gate (complete/incomplete) is too coarse; a graduated system that enables progressively more capable AI generation based on Story Bible completeness is more appropriate.

## Affected Features

- F-001 (Story Bible): Auto-extraction quality directly determines downstream generation quality
- F-002 (Auto mode): Generation quality degrades without Story Bible context
- F-003 (Guided mode): Option scoring accuracy depends on character/world consistency data from Story Bible
- F-007 (Quality Control): Hard constraint accuracy for character consistency and plot coherence depends on Story Bible data

## Recommendation

The system MUST implement a Story Bible completeness score (0-100) based on: percentage of detected entities documented, required fields filled, and cross-reference integrity. Generation features MUST be available at all completeness levels, but the system SHOULD display a clear warning when completeness falls below a threshold (e.g., 40%). Below this threshold, Quality Control's character consistency and plot coherence dimensions SHOULD operate in reduced-accuracy mode with wider confidence intervals, and this reduced accuracy MUST be reflected in the metadata confidence scores (see SME-03). Auto-extraction MUST run automatically when a manuscript is first opened to minimize the cold-start gap.
