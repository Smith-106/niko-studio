# Finding: AI 输出定位策略 — First Draft 作为用户期望锚点

> Role: product-manager | Impact: MEDIUM

## Description

PM-04 frames AI output as "first draft" quality. This positioning serves as a user expectation anchor, preventing the disappointment cycle where users expect publication-ready text and receive AI-generated prose that requires revision. All successful AI writing tools (Sudowrite, NovelAI, Jasper) position AI as a "writing partner" rather than a "writing replacement."

The "first draft" framing has implications beyond marketing: it shapes the entire feedback and revision UX. If AI output is explicitly draft quality, the system MUST provide clear revision paths from every AI-generated segment. The revision path is not an optional feature — it is the logical continuation of the first-draft promise.

## Affected Features

- F-002 Auto mode (primary generation output)
- F-003 Guided mode (three-option output)
- F-004 Directed mode (instruction-driven output)
- F-007 Quality Control (enforces baseline quality)

## Recommendation

Embed the "first draft → revision" workflow as a first-class interaction pattern. Every AI-generated segment SHOULD display a visible revision affordance (not just an accept/reject binary). Track revision rates as a product health metric — high revision rates indicate the AI is useful but not final; low revision rates may indicate either exceptional quality or user disengagement.
