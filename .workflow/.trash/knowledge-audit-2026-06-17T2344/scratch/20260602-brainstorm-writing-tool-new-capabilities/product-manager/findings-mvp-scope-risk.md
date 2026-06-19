# Finding: MVP Scope Risk — 双能力 MVP 的实现复杂度

> Role: product-manager | Impact: HIGH

## Description

PM-02 mandates a dual-capability MVP (Co-Writing + Reader Simulation), which increases implementation surface area compared to a single-capability MVP. The shared dependency on Story Bible (F-001) creates a critical path: both capabilities require Story Bible context, meaning any delay in Story Bible delivery blocks both Co-Writing and Reader Simulation.

Sudowrite's success data indicates that Story Bible quality directly correlates with generation quality. A dual-capability MVP that ships with incomplete Story Bible support risks demonstrating both capabilities at suboptimal quality, undermining the MVP's persuasive purpose.

## Affected Features

- F-001 Story Bible (critical path dependency)
- F-002 Co-Writing Auto mode (blocked by incomplete Story Bible)
- F-005 Reader Simulation (blocked by incomplete Story Bible)
- F-007 Quality Control (depends on both hard/soft constraint tiers)

## Recommendation

Consider a phased MVP: Phase 1a delivers Story Bible + Co-Writing Auto mode only; Phase 1b adds Reader Simulation basic version. This reduces the critical path to one capability at a time while still achieving the dual-capability vision within the MVP milestone. The phased approach also allows quality validation of the Story Bible → Co-Writing integration before adding the second capability.
