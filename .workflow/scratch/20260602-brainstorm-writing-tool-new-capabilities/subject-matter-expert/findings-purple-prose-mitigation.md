# Finding: Purple Prose and Over-Generation Mitigation

> Role: subject-matter-expert | Impact: HIGH

## Description

AI fiction writing tools have a well-documented tendency toward over-generation and purple prose — verbose, ornate language that prioritizes stylistic flourishes over narrative clarity. NovelAI's Prose Augmenter is cited as a specific example of this failure mode (see design-research). The creativity spectrum control (PM-05, UX-03) addresses this partially, but the four-dimension quality check alone may not sufficiently constrain stylistic excess.

The risk is compounded in Auto mode, where the system has maximum freedom and the user has minimum oversight. Without explicit anti-purple-prose mechanisms, the quality control's "style consistency" dimension may pass output that is consistently overwrought rather than consistently matched to the user's actual writing style.

## Affected Features

- F-002 (Auto mode): Highest risk — minimal user oversight of generation direction
- F-003 (Guided mode): Moderate risk — three options may all exhibit purple prose at high creativity settings
- F-007 (Quality Control): The "style consistency" dimension needs a specific anti-purple-prose check, not just consistency measurement

## Recommendation

Quality Control's style consistency dimension SHOULD include an explicit "prose density" metric that measures the ratio of descriptive/ornamental language to action/dialogue language. This metric MUST be calibrated against the user's existing manuscript style rather than an absolute standard. When prose density exceeds the manuscript baseline by a configurable margin, the system SHOULD flag the output as "over-generated" regardless of creativity spectrum setting. The default creativity level SHOULD be "Balanced" to prevent purple prose by default.
