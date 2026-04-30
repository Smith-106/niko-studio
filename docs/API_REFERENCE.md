# Niko Studio Gateway API Reference

**Version**: 9.2.0
**Updated**: 2026-04-30
**Base URL**: `http://localhost:8000`

---

## Overview

The Niko Studio Gateway exposes a REST API over HTTP, organized into 5 route groups with 69 endpoints total. All request/response bodies use JSON (`Content-Type: application/json`) unless noted otherwise.

### Common Patterns

- **Workspace context**: Most endpoints accept an optional `workspace` object for workspace-aware operations.
- **Error responses**: `{ "error": "message" }` with appropriate HTTP status code (400/404/500/503).
- **Streaming**: `/chat/stream` and `/writing/stream` use Server-Sent Events (`text/event-stream`).

---

## 1. Platform (11 endpoints)

### GET /health

Health check with service and engine status.

**Response 200**:
```json
{
  "status": "ok",
  "version": "9.2.0",
  "services": { "memory": "ok", "graph": "ok", ... },
  "engine_health": { ... },
  "agents": ["writer", "architect", ...],
  "skills_count": 12,
  "mcp_runtime": { ... }
}
```

### GET /metrics

Runtime metrics snapshot. Returns 404 if metrics are disabled.

**Response 200**:
```json
{
  "status": "ok",
  "metrics": { ... },
  "runtime": {
    "session_id": "uuid",
    "reconnect_attempts": 0,
    "last_probe_at": "ISO-8601",
    "last_error": null
  }
}
```

### GET /tools

List available tools by service.

**Response 200**:
```json
{ "memory": ["search", "add", ...], "graph": ["query", ...] }
```

### GET /models

List available LLM models. Query param `provider` (optional) filters by provider.

**Response 200**:
```json
{ "status": "ok", "providers": { "openai": ["gpt-4o", ...] } }
```

### GET /config

Read current gateway configuration.

**Response 200**:
```json
{
  "status": "ok",
  "config": { ... },
  "modifiable_fields": ["agent.default_model", ...]
}
```

### PUT /config

Update configuration fields. Also available via `POST /config`.

**Request**:
```json
{ "fields": { "agent.default_model": "gpt-4o-mini" } }
```

**Response 200**:
```json
{ "status": "ok", "updated": ["agent.default_model"] }
```

### GET /config/secrets

Read secret fields (values masked).

**Response 200**:
```json
{
  "status": "ok",
  "secrets": {
    "agent.openai_api_key": { "configured": true, "value": "sk-****" }
  }
}
```

### PUT /config/secrets

Update secret fields. Also available via `POST /config/secrets`.

**Request**:
```json
{ "secrets": { "agent.openai_api_key": "sk-..." } }
```

**Response 200**:
```json
{ "status": "ok", "updated": ["agent.openai_api_key"] }
```

### POST /config/reload

Hot-reload configuration from file.

**Response 200**:
```json
{ "status": "ok", "message": "Configuration reloaded" }
```

---

## 2. Content (17 endpoints)

### POST /chat

Synchronous chat completion with optional workflow, skills, and evaluation.

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "Help me write a scene" }
  ],
  "workflowLevel": "L1",
  "skills": ["worldbuilding"],
  "context": {},
  "workspace": {},
  "allowLlmFallback": true,
  "comparison": { "enabled": false }
}
```

Validation: max 128 messages, 24k chars/message, 120k total chars.

**Response 200**:
```json
{
  "content": "...",
  "skills_used": ["worldbuilding"],
  "writer_metadata": { ... },
  "workflow_info": { ... },
  "evaluation": { "score": 85, "feedback": "..." },
  "context": { ... },
  "workspace": { ... },
  "_contract": { "version": "1.0", "timestamp": 1714500000 }
}
```

### POST /chat/stream

Streaming chat via Server-Sent Events.

**Request**: Same as `POST /chat`.

**Response** (`Content-Type: text/event-stream`):
```
event: start
data: {"_contract":{"version":"1.0",...}}

event: routing
data: {"level":"L1","agent":"writer"}

event: content
data: {"chunk":"...","index":0}

event: evaluation
data: {"score":85,"feedback":"..."}

event: done
data: {"status":"ok","skills_used":["worldbuilding"]}
```

### POST /memory/search

Search memories by query with optional filtering.

**Request**:
```json
{
  "query": "character personality",
  "layer": "long_term",
  "dimensions": ["character"],
  "limit": 10,
  "workspace": {}
}
```

### POST /memory/add

Add a new memory entry.

**Request**:
```json
{
  "content": "Zhang San is an introverted programmer",
  "layer": "long_term",
  "dimension": "character",
  "importance": 0.8,
  "tags": ["character", "personality"],
  "workspace": {}
}
```

### POST /memory/upload

Upload and chunk a file into memory entries. Content must be base64-encoded.

**Request**:
```json
{
  "file_name": "chapter1.txt",
  "file_content_base64": "base64-string",
  "session_id": "uuid",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "workspace": {}
}
```

**Response 201**:
```json
{
  "status": "created",
  "file_name": "chapter1.txt",
  "session_id": "uuid",
  "chunks": 5,
  "memory_ids": ["m-1", "m-2", ...]
}
```

### POST /memory/temporal

Retrieve temporal memory for an entity at a point in time.

**Request**:
```json
{
  "entity_id": "character-zhang-san",
  "at_time": "2026-01-15T00:00:00Z",
  "workspace": {}
}
```

### POST /workspace/context

Retrieve workspace context summary.

**Request**:
```json
{ "identity": {}, "authority": {} }
```

**Response 200**:
```json
{
  "workspace": { ... },
  "summary": { ... },
  "compatibility": { ... }
}
```

### POST /graph/query

Execute a Cypher-style graph query.

**Request**:
```json
{
  "cypher": "MATCH (c:Character) RETURN c",
  "workspace": {}
}
```

### POST /graph/character

Get character data with optional relations and timeline.

**Request**:
```json
{
  "name": "Zhang San",
  "include_relations": true,
  "include_timeline": true,
  "workspace": {}
}
```

### POST /graph/foreshadows

Get foreshadowing elements, optionally filtered by status or chapter.

**Request**:
```json
{
  "status": "planted",
  "chapter": 3,
  "workspace": {}
}
```

### POST /wiki/list

List wiki pages, optionally filtered by status.

**Request**:
```json
{ "status": "curated", "limit": 20, "workspace": {} }
```

### POST /wiki/promote

Promote content to a wiki page.

**Request**:
```json
{
  "title": "Zhang San Character Profile",
  "body": "...",
  "slug": "zhang-san",
  "promoted_from": "story-bible",
  "status": "draft",
  "workspace": {}
}
```

### POST /wiki/page

Read a single wiki page by slug.

**Request**:
```json
{ "slug": "zhang-san", "workspace": {} }
```

### POST /writing/quality

Run novel quality check on content.

**Request**:
```json
{
  "content": "draft text...",
  "quality_level": "standard",
  "dimensions": ["style", "logic"],
  "quality_goals": {}
}
```

**Response 200**:
```json
{
  "status": "ok",
  "total_score": 82,
  "lock_score": 90,
  "style_score": 78,
  "logic_score": 85,
  "actionable_feedback": "...",
  "suggestions": [...]
}
```

### POST /writing/helper

Process text through writing helper (polish, rewrite, expand, summarize, outline, generate).

**Request**:
```json
{
  "content": "rough draft...",
  "mode": "polish",
  "instruction": "make it more vivid",
  "skill_ids": [],
  "api_key": "sk-...",
  "model": "gpt-4o"
}
```

**Response 200**:
```json
{
  "status": "ok",
  "mode": "polish",
  "processed_text": "polished text...",
  "skills_used": [],
  "provider": "openai"
}
```

Also available at `POST /writing-helper/process` (alias).

### POST /writing/stream

Streaming writing helper via SSE. Requires LLM provider config.

**Request**:
```json
{
  "content": "text...",
  "mode": "expand",
  "api_key": "sk-...",
  "model": "gpt-4o"
}
```

**Response** (`text/event-stream`):
```
event: start
data: {"status":"started"}

event: content
data: {"chunk":"...","index":0}

event: done
data: {"status":"done","chunks":5,"skills_used":[]}
```

---

## 3. Agent (12 endpoints)

### POST /agent/route

Route a task to the appropriate agent.

**Request**:
```json
{ "task": "Write a battle scene" }
```

### POST /agent/write

Generate content using the writer agent.

**Request**:
```json
{
  "scene_card": { "setting": "forest", "characters": ["Zhang San"] },
  "skills": ["worldbuilding"],
  "word_target": 500,
  "allow_llm_fallback": true,
  "quality_goals": {},
  "workspace": {}
}
```

### POST /agent/revise

Revise a draft based on feedback.

**Request**:
```json
{
  "draft": "original text...",
  "feedback": { "issues": ["pacing too slow"] },
  "allow_llm_fallback": true,
  "quality_goals": {}
}
```

Returns 400 for validation errors, 503 for LLM errors.

### POST /agent/context

Get context for a scene.

**Request**:
```json
{
  "scene_info": { "chapter": 3, "setting": "forest" },
  "context_types": ["character", "worldbuilding"]
}
```

### POST /critic/evaluate

Evaluate content quality across dimensions.

**Request**:
```json
{
  "content": "text to evaluate...",
  "scene_card": {},
  "dimensions": ["style", "character", "pacing"],
  "quality_goals": {}
}
```

### POST /critic/suggestions

Get improvement suggestions for content.

**Request**:
```json
{
  "content": "text...",
  "issues": ["weak dialogue"],
  "max_suggestions": 5
}
```

### POST /critic/consistency

Cross-chapter consistency analysis.

**Request**:
```json
{
  "chapters": ["Chapter 1 text...", "Chapter 2 text..."],
  "chapterMeta": [
    { "chapterNumber": 1, "title": "The Beginning" },
    { "chapterNumber": 2, "title": "The Journey" }
  ],
  "worldRules": [],
  "workspace": {}
}
```

**Response 200**:
```json
{
  "character": { ... },
  "timeline": { ... },
  "worldview": { ... },
  "combined": {
    "totalConflicts": 3,
    "criticalCount": 0,
    "majorCount": 1,
    "minorCount": 2,
    "overallScore": 87,
    "summary": "..."
  },
  "analyzedAt": "ISO-8601",
  "runId": "uuid"
}
```

### POST /consistency/check

Same as `/critic/consistency`, but auto-scans workspace directory for chapter files if none provided.

### GET /skills/list

List available skills. Query param `category` (optional) filters by category.

### POST /skills/load

Load a skill by ID.

**Request**:
```json
{ "skill_id": "worldbuilding" }
```

### POST /skills/match

Match skills to a task.

**Request**:
```json
{
  "task_type": "scene_writing",
  "keywords": ["battle", "tension"],
  "issue": "pacing"
}
```

### POST /skills/chain

Get a skill execution chain for a task type.

**Request**:
```json
{ "task_type": "full_chapter" }
```

---

## 4. Workflow (24 endpoints)

### POST /workflow/route

Route a workflow task to the appropriate level.

**Request**:
```json
{ "task": "Write chapter 5", "workspace": {} }
```

### POST /workflow/plan

Create a workflow execution plan.

**Request**:
```json
{
  "task": "Write chapter 5",
  "level": "L3",
  "genre": "fantasy",
  "recommendations": {},
  "workspace": {}
}
```

### POST /workflow/execute

Execute a workflow plan step.

**Request**:
```json
{
  "plan_id": "uuid",
  "step_id": "step-1",
  "confirm_token": "token",
  "recommendations": {},
  "workspace": {}
}
```

### POST /workflow/lifecycle

Manage workflow lifecycle (pause, resume, cancel).

**Request**:
```json
{
  "plan_id": "uuid",
  "action": "pause",
  "workspace": {}
}
```

### POST /workflow/rollback

Quick rollback a workflow to a previous state.

**Request**:
```json
{
  "plan_id": "uuid",
  "checkpoint_id": "cp-1",
  "reason": "quality regression",
  "workspace": {}
}
```

### POST /workflow/scheduler/register

Register a scheduled workflow task.

**Request**:
```json
{
  "task": { "type": "daily_review", "config": {} },
  "enabled": true,
  "workspace": {}
}
```

### POST /workflow/scheduler/list

List scheduled workflow tasks.

**Request**:
```json
{ "limit": 20, "workspace": {} }
```

### POST /workflow/scheduler/pause

Pause a scheduled task.

**Request**:
```json
{ "task_id": "uuid", "workspace": {} }
```

### POST /workflow/scheduler/resume

Resume a paused scheduled task.

**Request**:
```json
{ "task_id": "uuid", "workspace": {} }
```

### POST /workflow/scheduler/run-now

Immediately execute a scheduled task.

**Request**:
```json
{
  "task_id": "uuid",
  "confirm_token": "token",
  "recommendations": {},
  "workspace": {}
}
```

### POST /workflow/scheduler/import-lite-plan

Import a lite plan into the scheduler.

**Request**:
```json
{
  "session_id": "uuid",
  "force_level": "L2",
  "enabled": true,
  "workspace": {}
}
```

### POST /checkpoint/create

Create a workspace checkpoint.

**Request**:
```json
{
  "description": "Before chapter 5 rewrite",
  "auto_commit": true,
  "workspace": {}
}
```

### POST /checkpoint/restore

Restore workspace to a checkpoint.

**Request**:
```json
{
  "checkpoint_id": "cp-1",
  "confirm_token": "token",
  "workspace": {}
}
```

### POST /checkpoint/list

List available checkpoints.

**Request**:
```json
{ "limit": 20, "workspace": {} }
```

### UI Bridge Endpoints (10)

The following endpoints mirror the core workflow endpoints under `/ui-bridge/workflow/`, with an additional guard that returns 403 if the UI bridge is disabled:

- `POST /ui-bridge/workflow/route`
- `POST /ui-bridge/workflow/plan`
- `POST /ui-bridge/workflow/execute`
- `POST /ui-bridge/workflow/lifecycle`
- `POST /ui-bridge/workflow/scheduler/register`
- `POST /ui-bridge/workflow/scheduler/list`
- `POST /ui-bridge/workflow/scheduler/pause`
- `POST /ui-bridge/workflow/scheduler/resume`
- `POST /ui-bridge/workflow/scheduler/run-now`
- `POST /ui-bridge/workflow/scheduler/import-lite-plan`

Request and response shapes are identical to their non-bridged counterparts.

---

## 5. Admin (6 endpoints)

### GET /admin/mcp/services

List registered MCP services. Query param `services` (optional, format: `"service1:status1,service2:status2"`) filters results.

**Response 200**:
```json
{ "services": [{ "id": "memory", "enabled": true, ... }] }
```

### POST /admin/mcp/services

Register a new MCP service. Returns 409 if service already exists.

**Request**:
```json
{ "id": "custom-service", "endpoint": "http://localhost:9000", "enabled": true }
```

**Response 201**:
```json
{ "service": { "id": "custom-service", ... } }
```

### PUT /admin/mcp/services/:service_id

Update an existing MCP service configuration.

**Request**:
```json
{ "enabled": false, "endpoint": "http://localhost:9001" }
```

**Response 200**:
```json
{ "service": { "id": "custom-service", ... } }
```

### DELETE /admin/mcp/services/:service_id

Delete an MCP service. Returns 400 for built-in services, 404 if not found.

**Response 200**:
```json
{ "status": "deleted", "service_id": "custom-service" }
```

### POST /admin/mcp/services/:service_id/enabled

Toggle service enabled state.

**Request**:
```json
{ "enabled": true }
```

**Response 200**:
```json
{ "service": { "id": "custom-service", "enabled": true, ... } }
```

### POST /admin/mcp/services/:service_id/probe

Probe service health.

**Response 200**:
```json
{ "service": { "id": "custom-service", "status": "healthy", "checked_at": "ISO-8601" } }
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (POST /admin/mcp/services, POST /memory/upload) |
| 204 | No Content (OPTIONS preflight) |
| 400 | Validation error / bad request |
| 403 | UI bridge disabled |
| 404 | Not found / metrics disabled |
| 409 | Conflict (duplicate MCP service) |
| 429 | Rate limited (120 req/min per client per endpoint) |
| 500 | Internal server error |
| 503 | LLM provider unavailable |

## Rate Limiting

The gateway enforces in-memory rate limiting at 120 requests per minute per client IP per endpoint path. Exceeding the limit returns 429 with a `retryAfter` field.

## CORS

CORS headers are added to all responses. Allowed origins are configured via `NIKO_CORS_PROD_ORIGINS` environment variable (production) or default to localhost origins (development).
