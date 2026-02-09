# Jules Development Guide

This document provides guidelines for **Jules** to automatically develop the AI Agent Platform.

---

## 🎯 Development Priority

Execute tasks in this order:

### 🔴 Priority 0 (Critical Path)

```
Phase 4.1: CitationManager
↓
Phase 4.2: DistillationManager
↓
Phase 3.3: MemoryManager
```

### 🟡 Priority 1 (Important)

```
Phase 5.1: SessionManager
↓
Phase 5.4: VectorSearch
↓
Phase 6.3: StoreManager
↓
Phase 6.4: GraphManager
```

### 🟢 Priority 2 (Standard)

```
Phase 2.2-2.6: Level 1-5 Workflows
↓
Phase 3.1-3.2: MemoryService, CoreMemoryStore
```

---

## 📋 Task Checklist Reference

All tasks are defined in `docs/TASKS.md`. Mark items as:
- `[ ]` - Not started
- `[/]` - In progress
- `[x]` - Completed

---

## 🏗️ Implementation Guidelines

### 1. File Locations

| Module | Path |
|--------|------|
| CitationManager | `src/memory/citation_manager.py` |
| DistillationManager | `src/memory/distillation_manager.py` |
| MemoryManager | `src/memory/memory_manager.py` |
| SessionManager | `src/workflow/session/session_manager.py` |
| VectorSearch | `src/search/vector_search.py` |
| SmartSearch | `src/search/smart_search.py` |
| StoreManager | `src/store/store_manager.py` |
| GraphManager | `src/graph/graph_manager.py` |

### 2. API Specifications

All API specs are in `docs/SDD_V2.md`:
- **Section 7**: CCW modules (SessionManager, ResumeStrategy, etc.)
- **Section 8**: OpenKL modules (CitationManager, MemoryManager, etc.)

### 3. Data Structures

Use dataclasses for all data structures:

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class TransientCitation:
    id: str
    surface: str
    path: str
    sha256: str
    loc: dict
    quote: str
    context: Optional[dict] = None
    score: Optional[float] = None
```

### 4. Database Schema

Kùzu schema is defined in `docs/SDD_V2.md` Section 1.4. Key nodes:
- Platform: MemoryNote, Doc, Chunk, Entity, Topic
- Novel: Character, Scene, Foreshadowing

---

## 🧪 Testing Requirements

### Test File Naming

```
tests/integration/test_<module_name>.py
```

### Test Structure

```python
import pytest
from src.memory.citation_manager import CitationManager

class TestCitationManager:
    def test_create_transient_citation(self):
        # Arrange
        manager = CitationManager()
        
        # Act
        citation = manager.create_transient_citation(...)
        
        # Assert
        assert citation.id is not None
        assert citation.sha256 is not None
```

### Run Tests

```bash
pytest tests/integration/test_citation_manager.py -v
```

---

## 📁 OpenKL File Contract

Create directories on first use:

```python
from pathlib import Path

BASE_PATH = Path(".writing")
MEMORIES_PATH = BASE_PATH / "memories"
SESSIONS_PATH = BASE_PATH / "sessions"
STORE_PATH = BASE_PATH / "store"
CITATIONS_PATH = BASE_PATH / "citations"
KUZU_PATH = BASE_PATH / ".ok" / "kuzu"

# Ensure directories exist
for path in [MEMORIES_PATH, SESSIONS_PATH, STORE_PATH, CITATIONS_PATH]:
    path.mkdir(parents=True, exist_ok=True)
```

---

## 🔗 Dependencies

### Required Packages

```python
# Core
kuzu          # Graph database
fastembed     # Embedding
rich          # Console output

# Optional
yaml          # Config files
hashlib       # SHA256 for citations
```

### Import Pattern

```python
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime
import hashlib
import json
```

---

## ✅ Completion Checklist

After implementing each module:

1. ✅ Code matches SDD specification
2. ✅ Tests pass (`pytest tests/integration/test_<module>.py`)
3. ✅ Dataclasses defined
4. ✅ Docstrings added
5. ✅ Update `docs/TASKS.md` (mark as `[x]`)

---

## 🚨 Common Pitfalls

1. **Don't use LanceDB** - Use Kùzu HNSW instead
2. **Don't use SQLite for memory** - Use OpenKL File Contract
3. **Always use 384-dim vectors** - FastEmbed default
4. **Use SHA256 for citations** - Content-addressed IDs

---

## 📞 Reference Projects

Source code references in project root:
- `openkl/` - OpenKL reference implementation
- `Claude-Code-Workflow/` - CCW workflow patterns
- `cherry-studio/` - Cherry Studio services

---

*Last Updated: 2026-01-26*
