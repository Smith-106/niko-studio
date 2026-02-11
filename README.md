# AI Agent Platform

> **Version**: 2.7 (Platform Edition)  
> **Architecture**: Multi-Agent Collaboration + OpenKL Memory + CCW Workflow  
> **Positioning**: Cherry Studio / Claude-Code-Workflow style AI Agent Platform

---

## 🎯 Platform Overview

A local-first, extensible AI Agent platform that provides unified memory management, session orchestration, and multi-CLI integration. Designed to support multiple domain adapters including novel writing, code development, and knowledge management.

```
┌──────────────────────────────────────────────────────────────────┐
│                     AI Agent Platform                             │
├──────────────────────────────────────────────────────────────────┤
│                  Platform Core Layer                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐ │
│  │ Memory     │ │ Session    │ │ Multi-CLI  │ │ Knowledge      │ │
│  │ (OpenKL)   │ │ (CCW)      │ │ Orchestr.  │ │ Graph (Kùzu)   │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                  Domain Adapter Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Novel    │ │ Code     │ │ Knowled. │ │ Custom Domains...  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

### 🧠 Memory Layer (OpenKL)
- **File System Contract**: Grep-friendly file storage + Graph-derived indexing
- **Temporal Organization**: `memories/by_date/YYYY-MM/DD/<id>.md`
- **Topic Symlinks**: `memories/topics/<slug>/` for cross-referencing
- **Vector Search**: Kùzu HNSW indexes with 384-dim FastEmbed

### 📝 Session Management (CCW)
- **5-Level Workflow**: Rapid → Lite → Standard → Brainstorm → Coordinator
- **Resume Strategy**: Native / Prompt-Concat / Hybrid modes
- **Smart Search**: Fuzzy (FTS + ripgrep) + Semantic (Embedding + RRF)

### 🔗 Citation System (OpenKL)
- **Transient Citations**: Returned by search, not persisted
- **Persisted Citations**: SHA256 verification + GC cleanup
- **Distillation**: 6 prompt templates with DerivedFrom relationships

### 📊 Knowledge Graph (Kùzu DB)
- **Platform Nodes**: MemoryNote, Doc, Chunk, Entity, Topic
- **Domain Nodes**: Character, Scene, Foreshadowing (Novel Adapter)
- **Cross-Domain Relations**: CHARACTER_MENTIONED_IN, SCENE_DERIVED_FROM

## 🚀 Quick Start

### Prerequisites

```bash
# Python 3.11+
python --version

# Install dependencies
pip install -r requirements.txt

# Or use uv (recommended)
uv sync
```

### 测试命令（交付基线）

```bash
# 单元 + 集成（排除 e2e），覆盖率门槛 80%
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=term-missing --cov-fail-under=80
```

### Initialize Database

```bash
# Initialize Kùzu database and create schema
python -c "from src.graph.graph_manager import init_schema; init_schema()"
```

### Run Development Server

```bash
# Start the development server
python dev_run.py
```

## 📁 Project Structure

```
niko-studio/
├── docs/
│   ├── SDD_V8_FINAL.md     # System Design Document (V8)
│   └── TASKS_V10_OPTIMIZED.md # Development Task List (V10)
├── src/
│   ├── agents/             # Core Agents (Commander, Architect, Writer, Critic)
│   ├── memory/             # Memory Layer (MemoryManager, CitationManager)
│   ├── workflow/           # Workflow System (Levels, Sessions)
│   ├── search/             # Search Services (SmartSearch, VectorSearch)
│   ├── store/              # Document Store (StoreManager)
│   ├── graph/              # Knowledge Graph (GraphManager)
│   └── services/           # Platform Services
├── tests/
│   ├── unit/               # Unit Tests
│   └── integration/        # Integration Tests
├── .niko/                  # Runtime Data (Project Workspace)
│   ├── sessions/           # Active/Archived sessions
│   ├── memory/             # Long-term memories
│   ├── config/             # Project configuration
│   ├── drafts/             # Draft versions
│   └── exports/            # Export output
└── README.md
```

## 🛠️ Technology Stack

| Component | Choice | Source |
|-----------|--------|--------|
| Vector Storage | **Kùzu HNSW** | OpenKL |
| File Storage | **OpenKL File Contract** | OpenKL |
| Graph Database | **Kùzu DB (Embedded)** | OpenKL |
| Session Management | **Session Manager** | CCW |
| Resume Strategy | **Native/Hybrid** | CCW |
| Citation System | **CitationManager** | OpenKL |
| Embedding | **FastEmbed (384-dim)** | - |
| MCP Services | **Sequential Thinking** | Cherry |

## 📋 Development Phases

| Phase | Status | Modules | Lines |
|-------|--------|---------|-------|
| P1: Core Agents | ✅ 100% | Commander, Architect, Writer, Critic + 6 others | 5,061 |
| P2: Workflow Levels | ✅ 100% | L1-L5 (Rapid → Coordinator) + ResumeStrategy | 8,354 |
| P3: Memory Layer | ✅ 100% | 12 components (MemoryManager, Citation, Temporal, 6D, etc.) | 8,845 |
| P4: Citation & Distill | ✅ 100% | CitationManager, DistillationManager (6 templates) | (incl. P3) |
| P5: Session & Search | ✅ 100% | SessionManager, SmartSearch, VectorSearch, IterativeRetriever | 2,652 |
| P6: Knowledge Layer | ✅ 100% | StoreManager, GraphManager (Cypher), OpenKL Contract | 3,296 |
| P7-9: Services | ✅ 100% | BackupManager, TokenService, ObsidianService, Reranker (4 strategies) | 5,156 |
| P10: Testing | 🟡 45% | 74 test files (unit, integration, performance) | 18,183 |

**Total Codebase**: 166 source files, 62,163 lines | 74 test files, 18,183 lines

## 🤖 Jules Auto-Development

This project is designed for **Jules** automated development. See:

- [TASKS.md](docs/TASKS.md) - Complete task checklist
- [JULES.md](.github/JULES.md) - Development guidelines for Jules
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## 📚 Documentation

- [System Design (SDD V2.1)](docs/SDD_V2.md) - Architecture & API specifications
- [Task List (V2.7)](docs/TASKS.md) - Development roadmap
- [OpenKL Design](openkl/rfcs/0000-openkl-design.md) - Memory layer design

## 📄 License

Apache License 2.0

## 🙏 Acknowledgments

Built on concepts from:
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio) - AI Assistant Platform
- [Claude-Code-Workflow](https://github.com/anthropics/claude-code) - Workflow Patterns
- [OpenKL](https://github.com/wey-gu/openkl) - Open Knowledge Layer

---

*Version 2.7 Platform Edition | Updated: 2026-01-26*
