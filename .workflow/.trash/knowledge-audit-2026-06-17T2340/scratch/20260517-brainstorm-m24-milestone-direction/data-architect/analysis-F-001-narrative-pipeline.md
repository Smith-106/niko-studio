# F-001: Narrative Analysis Data Pipeline

## Data Model Design

### Core Entities

**AnalysisResult** — Output of any narrative analyzer/evaluator:
```typescript
interface AnalysisResult {
  $schema_version: string;
  analyzer_id: string;          // e.g. "sensory-analyzer", "tension-curve"
  chapter_id: string;
  chapter_hash: string;         // content hash for cache invalidation
  timestamp: string;            // ISO 8601
  scores: DimensionScore[];
  findings: Finding[];
  metadata?: Record<string, unknown>;
}

interface DimensionScore {
  dimension: string;            // maps to craft-catalog dimension
  score: number;                // 0-100
  level: string;                // excellent|good|fair|poor|critical
  confidence: number;           // 0-1
  evidence?: string[];          // text excerpts supporting the score
}

interface Finding {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  message: string;
  location?: { start: number; end: number };
  suggestion?: string;
}
```

**AnalysisPipeline** — Orchestration metadata:
```typescript
interface PipelineRun {
  run_id: string;
  session_id: string;
  chapter_id: string;
  analyzers: string[];          // ordered list of analyzer IDs
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  results: Record<string, AnalysisResult>;
}
```

### Relationships

- PipelineRun 1:N AnalysisResult (one per analyzer)
- AnalysisResult N:1 Chapter (via chapter_id)
- DimensionScore references craft-catalog dimensions (via dimension string key)

## Storage Strategy

Analysis results MUST be stored as individual JSON files per pipeline run:
```
{session}/.data/analysis/{chapter_id}/{run_id}.json
```

Latest results SHOULD also be symlinked/copied to a `latest.json` for quick access without scanning timestamps.

Access patterns:
- **Write**: Sequential (one analyzer completes, appends to pipeline result)
- **Read**: Latest result per chapter (most common), historical comparison (occasional)

## Migration Path

Current state: Analyzers return ad-hoc objects, no unified schema. Each analyzer (sensory, tension-curve, conflict, etc.) defines its own output shape.

Migration:
1. Define `AnalysisResult` interface as the universal wrapper
2. Each analyzer's specific output becomes the `metadata` field
3. Extract common `DimensionScore[]` from each analyzer's output
4. Existing stored results: migrate-on-read with version detection (missing `$schema_version` = v0)

## Data Flow Changes

Current: `Analyzer → raw object → frontend panel`
Target: `Analyzer → AnalysisResult (normalized) → pipeline aggregator → frontend panel`

The normalization layer sits between analyzers and consumers. Each analyzer MUST implement a `normalize(): AnalysisResult` method that converts its internal output to the standard format.

## Backward Compatibility

- Existing analyzer interfaces remain unchanged internally
- The normalization layer is additive (new code, no modification to existing analyzers)
- Frontend panels that consume raw analyzer output SHOULD be updated to use normalized format, but MAY continue reading legacy format during transition via a compatibility adapter
- The `scoreToLevel()` utility in `narrative/types.ts` remains the canonical score-to-label mapping
