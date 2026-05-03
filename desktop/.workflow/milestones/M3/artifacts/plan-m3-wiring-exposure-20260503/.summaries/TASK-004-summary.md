# TASK-004 Summary: Add graph engine write operations with validation

**Status**: completed
**Completed**: 2026-05-03T20:15:00+08:00
**Duration**: 30min

## Changes

### graph-engine.js
- Added `createNode(entityType, name, properties)` — validates name non-empty, delegates to createEntity
- Added `updateNode(id, properties)` — ID-based update with validation, merges properties
- Added `deleteNode(id)` — ID-based delete with cascade (relations + entity), validates ID exists

### services/graph.js
- Added `graphCreateNode(entityType, name, properties)` — service wrapper with engine availability check
- Added `graphUpdateNode(id, properties)` — service wrapper
- Added `graphDeleteNode(id)` — service wrapper

### endpoints/graph.js
- Added `graphNodeCreateEndpoint` — POST handler for node creation
- Added `graphNodeUpdateEndpoint` — POST handler for ID-based update
- Added `graphNodeDeleteEndpoint` — POST handler for ID-based delete
- Added `graphRelationCreateEndpoint` — POST handler using existing graphAddRelation
- Updated imports to include new service functions

### routes/content.js
- Registered 4 new routes: /graph/node/create, /graph/node/update, /graph/node/delete, /graph/relation/create

### index.js / index.d.ts
- Added barrel exports for all 4 new endpoints

### knowledge.ts
- Added `createGraphNode(type, name, properties?, options?)` — POST /graph/node/create
- Added `updateGraphNode(id, properties, options?)` — POST /graph/node/update
- Added `deleteGraphNode(id, options?)` — POST /graph/node/delete
- Added `createGraphRelation(fromName, toName, relationType, properties?, options?)` — POST /graph/relation/create

## Convergence
- createNode/updateNode/deleteNode/createRelation methods exist in graph-engine.js
- Write methods validate input (name required, ID existence checked)
- 4 POST endpoints registered in content.js routes
- knowledge.ts exports createGraphNode, updateGraphNode, deleteGraphNode, createGraphRelation
