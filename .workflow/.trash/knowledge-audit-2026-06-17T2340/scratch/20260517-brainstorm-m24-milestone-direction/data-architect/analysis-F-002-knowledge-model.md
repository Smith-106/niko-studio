# F-002: Knowledge System Data Model

## Data Model Design

### Core Entities

**KnowledgeEntry** — A single piece of writing craft knowledge:
```typescript
interface KnowledgeEntry {
  $schema_version: string;
  id: string;                   // stable UUID
  type: 'rule' | 'pattern' | 'technique' | 'reference';
  category: string;             // e.g. "satisfaction-patterns", "narrative-voice"
  title: string;
  content: string;              // markdown body
  tags: string[];
  source?: string;              // book/reference origin
  relationships: KnowledgeRelation[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

interface KnowledgeRelation {
  target_id: string;
  relation_type: 'depends_on' | 'conflicts_with' | 'extends' | 'related_to';
  weight?: number;              // 0-1 relevance strength
}
```

**KnowledgeGraph** — Index structure for traversal:
```typescript
interface KnowledgeGraphIndex {
  $schema_version: string;
  nodes: Record<string, KnowledgeNodeMeta>;
  edges: KnowledgeEdge[];
  categories: string[];
  last_rebuilt: string;
}

interface KnowledgeNodeMeta {
  id: string;
  title: string;
  type: string;
  category: string;
  tag_vector: string[];         // for similarity search
}

interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}
```

### Relationships

- KnowledgeEntry N:N KnowledgeEntry (via relationships)
- KnowledgeEntry N:1 Category (via category field)
- KnowledgeEntry references craft-catalog dimensions (via tags)

## Storage Strategy

Knowledge entries MUST be stored as individual JSON files organized by category:
```
data/knowledge/
  rules/
    {id}.json
  patterns/
    {id}.json
  techniques/
    {id}.json
  references/
    {id}.json
  _index.json              // KnowledgeGraphIndex
```

The graph index (`_index.json`) is a derived artifact rebuilt from individual entries. It SHOULD be rebuilt on any entry change and cached in memory.

Access patterns:
- **Search**: Full-text across titles/content/tags (frequent)
- **Traverse**: Follow relationships from a node (moderate)
- **Write**: Individual entry CRUD (infrequent)

## Migration Path

Current state: Knowledge stored in the existing `knowledge/` module with provider-based access. The `graph/` module provides graph operations.

Migration:
1. Define canonical `KnowledgeEntry` schema
2. Export existing knowledge data to individual JSON files
3. Build graph index from exported entries
4. Update knowledge module to read from file-based store
5. Retain existing provider interface as facade

## Data Flow Changes

Current: `Knowledge providers → in-memory → query`
Target: `JSON files → load + index → in-memory graph → query`

The graph module (`src-ts/graph/`) SHOULD become the primary query interface. Knowledge providers become data sources that populate the file store.

## Backward Compatibility

- Existing `knowledge/providers/` interfaces remain stable
- The `OpenAILLMProvider` and other providers continue to function
- New file-based storage is additive — providers can write to both old and new format during transition
- Graph index rebuild is non-destructive (derived data, can always be regenerated)
