# Finding: Suggestion Lifecycle Management Gap

> Role: ux-expert | Impact: MEDIUM

## Description

The current design defines how AI suggestions appear and how users accept or dismiss them, but lacks a complete lifecycle model for suggestions that are neither immediately accepted nor dismissed. Questions without defined answers include: how long do sidebar suggestions persist across sessions, how are suggestions archived or retrieved after the auto-timeout, can users batch-operate on multiple suggestions, and how do suggestions interact with undo/redo history.

Sudowrite stores all generated content in a revision history that users can browse later. Slima persists reader simulation results across revision reports. Both tools treat AI output as non-ephemeral data. The current niko-studio design risks losing valuable AI suggestions due to auto-timeout or session boundaries without a retrieval mechanism.

## Affected Features

- F-002 (Auto mode): inline suggestions auto-timeout after 10 seconds with no retrieval path
- F-003 (Guided mode): dismissed option sets have no archive
- F-004 (Directed mode): instruction history is proposed but not fully specified
- F-007 (Quality Control): violation markers may accumulate without batch management

## Recommendation

Define a suggestion lifecycle with four states: active (visible to user), snoozed (auto-timed out but retrievable from a suggestion history panel), accepted (inserted into document with AI metadata), and dismissed (explicitly rejected, removed from view but logged). The suggestion history panel SHOULD be accessible from the toolbar and SHOULD support filtering by mode, date, and acceptance status. This lifecycle model MUST be specified before MVP implementation to avoid data loss for users who generate valuable suggestions but do not immediately act on them.
