# Finding: Context Pipeline Bottleneck

> Role: system-architect | Impact: HIGH

## Description

The Context Scraper stage is the shared bottleneck across all three Co-Writing modes (Auto, Guided, Directed). All three modes converge on the same context gathering logic before diverging in prompt assembly and output aggregation. Latency in the Context Scraper directly impacts generation responsiveness for every mode.

The bottleneck arises from three factors:

1. **SB entity resolution** — The Context Scraper must query the Story Bible for all entities relevant to the current chapter, which involves multiple KE lookups and relationship traversals
2. **Session Intelligence integration** — Reading the current session state (tension level, character focus, plot thread status) adds an additional service call
3. **Shrink Ray summarization** — When context exceeds the window budget, the summarizer must process early chapters, which is compute-intensive

Sudowrite's architecture validates that context gathering is the critical path — their Context Scraper is heavily optimized with caching and incremental updates. The design research indicates that 20K-word context windows with 25 linked chapters require sophisticated context management to maintain responsiveness.

## Affected Features

- F-002 (Auto mode) — Context Scraper latency directly delays continuation delivery
- F-003 (Guided mode) — Context Scraper latency delays all three options, compounding the impact
- F-004 (Directed mode) — Context Scraper latency delays instruction-grounded generation
- F-001 (Story Bible) — SB query performance is a major contributor to Context Scraper latency
- SA-07 (Shrink Ray) — Summarization is the most expensive operation in the Context Scraper

## Recommendation

Implement a three-tier optimization strategy:

1. **SB caching layer** — Cache SB entity lookups per chapter with invalidation on SB mutation. The cache SHOULD be keyed by chapter_id + SB_version to avoid stale reads. Cache hits reduce SB resolution from O(n) entity lookups to O(1) cache retrieval.

2. **Session Intelligence snapshot** — Snapshot the session state at the start of each co-writing session rather than querying on every generation. The snapshot is updated only when the user explicitly changes narrative focus (e.g., switches to a different character's POV). This reduces session integration from a service call to a local read.

3. **Incremental Shrink Ray** — Implement incremental summarization where early chapters are summarized once and cached. When the manuscript grows, only the newly-exceeded chapters are summarized, and the cached summaries are reused. This reduces summarization from O(n) chapters to O(1) new chapters per session.

The Context Scraper SHOULD emit a `context_gathering_latency_ms` metric to enable monitoring of bottleneck performance. The target latency for context gathering SHOULD be under 2 seconds for manuscripts under 50K words with a populated Story Bible.
