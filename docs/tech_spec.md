# AI 写作 Agent 平台 - 技术规格说明

**版本**: 2.1  
**日期**: 2026-01-27  
**状态**: 设计阶段 + 部分实现

---

## 一、编程语言选择

### 1.1 核心后端：Python 3.10+

**为什么选择 Python？**

| 理由 | 详细说明 |
|------|---------|
| ✅ **AI 生态最佳** | LangChain、LangGraph、LlamaIndex 等主流 AI 框架原生支持 |
| ✅ **快速开发** | 动态类型、丰富库生态，适合 Agent 系统快速迭代 |
| ✅ **社区成熟** | OpenAI、Anthropic、Google 官方 SDK 优先支持 Python |
| ✅ **数据处理** | NumPy、Pandas 处理向量和知识图谱数据 |
| ✅ **易于维护** | 代码可读性高，适合 Jules 自动化开发 |

**版本要求**：
```python
# Python 3.10+ (支持 match/case 语法、类型提示增强)
python --version  # Python 3.10.0 或更高
```

### 1.2 前端界面：HTML5 + JavaScript/TypeScript

**为什么分离前后端？**

| 前端技术 | 应用场景 | 优势 |
|---------|---------|------|
| **Vanilla JS** | Web UI（Phase 2-3） | 无框架依赖、轻量级、参考 CCW |
| **TypeScript** | 复杂组件（可选） | 类型安全、IDE 支持好 |
| **Streamlit** | 快速原型（Phase 1） | Python 编写、快速验证 |

**技术栈对比**：

```
Phase 1 (当前):
  Streamlit (Python)
  ├─ 优势: 快速原型、Python 生态集成
  └─ 劣势: 定制受限、性能一般

Phase 2-3 (生产):
  FastAPI (Python) + Vanilla JS (前端)
  ├─ 优势: 完全定制、性能优秀、参考 CCW
  └─ 劣势: 开发成本稍高
```

---

## 二、架构设计

### 2.1 四层架构

```
┌─────────────────────────────────────────────────────────────────┐
│              【用户界面层 UI Layer】                              │
│  ┌────────────┬────────────┬────────────┬─────────────────────┐ │
│  │ Web UI     │ CLI        │ IDE Plugin │ API (REST/GraphQL)  │ │
│  │ (FastAPI + │ (Typer)    │ (VS Code)  │ (外部集成)           │ │
│  │  HTML/JS)  │            │            │                     │ │
│  └────────────┴────────────┴────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│            【领域适配层 Domain Adapters】                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │ Novel Adapter│ Code Adapter │ KM Adapter   │ Custom       │ │
│  │ (小说创作)    │ (代码开发)    │ (知识管理)    │ (自定义)     │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
│  • 领域特定状态 (NovelState / CodeState / KMState)              │
│  • 领域特定工作流 (Chapter / Feature / Research)                 │
│  • 领域特定评估 (LOCK / Code Quality / Knowledge Depth)         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ 适配器接口
┌─────────────────────────────────────────────────────────────────┐
│             【核心平台层 Platform Core】                          │
│  ┌────────────┬────────────┬────────────┬─────────────────┐    │
│  │ Agent      │ Memory     │ Workflow   │ Knowledge       │    │
│  │ Framework  │ Layer      │ Engine     │ Graph           │    │
│  ├────────────┼────────────┼────────────┼─────────────────┤    │
│  │ • BaseAgent│ • OpenKL   │ • LangGraph│ • Kùzu Graph DB │    │
│  │ • Commander│ • Citations│ • Sessions │ • Cypher Query  │    │
│  │ • Architect│ • Distill  │ • Resume   │ • HNSW Vector   │    │
│  │ • Writer   │ • Store    │ • L1-L5    │ • Sync to Graph │    │
│  │ • Critic   │ • Search   │            │                 │    │
│  └────────────┴────────────┴────────────┴─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↕ 数据访问层
┌─────────────────────────────────────────────────────────────────┐
│            【基础设施层 Infrastructure】                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │ Kùzu DB  │FastEmbed │ File I/O │ LLM      │ Monitoring   │  │
│  │ (图数据库)│ (嵌入)   │ (.writing│ Providers│ (日志/指标)   │  │
│  │          │          │  目录)   │          │              │  │
│  ├──────────┼──────────┼──────────┼──────────┼──────────────┤  │
│  │ • 图存储  │ • 本地   │ • OpenKL │ • Gemini │ • 结构化日志 │  │
│  │ • HNSW   │ • 无API  │   File   │ • Claude │ • Prometheus │  │
│  │ • Cypher │   调用   │   Contract│• Qwen   │ • Sentry     │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心技术栈

#### 后端（Python）

```python
# === 核心框架 ===
langgraph>=0.0.30          # 工作流编排（状态机）
langchain>=0.1.0           # LLM 抽象层
pydantic>=2.0.0            # 数据验证和序列化

# === Web 框架 ===
fastapi>=0.100.0           # REST API（生产环境）
uvicorn>=0.23.0            # ASGI 服务器
websockets>=11.0           # 实时通信（WebSocket）
streamlit>=1.28.0          # 快速原型（当前阶段）

# === 数据存储 ===
kuzudb>=0.1.0              # 图数据库（嵌入式）
sqlite3                    # 内置，会话/记忆存储
aiosqlite>=0.19.0          # 异步 SQLite

# === 向量搜索 ===
fastembed>=0.1.0           # 本地嵌入模型（无 API 调用）
sentence-transformers      # 备选嵌入模型

# === LLM 集成 ===
langchain-google-genai     # Google Gemini
langchain-openai           # OpenAI / 兼容 API
langchain-anthropic        # Claude

# === 工具库 ===
httpx>=0.24.0              # HTTP 客户端
aiohttp>=3.8.0             # 异步 HTTP
python-dotenv>=1.0.0       # 环境变量管理
pyyaml>=6.0                # YAML 配置

# === 测试 ===
pytest>=7.0.0              # 单元测试
pytest-asyncio>=0.21.0     # 异步测试
pytest-cov>=4.0.0          # 覆盖率
playwright>=1.40.0         # E2E 测试
```

#### 前端（Web UI）

```javascript
// === 核心库 ===
// 无框架依赖！参考 CCW 的 Vanilla JS 架构

// === 可视化 ===
plotly.js@2.x              // 图表（雷达图、折线图）
cytoscape.js@3.x           // 图谱可视化
d3.js@7.x                  // 高级可视化（可选）

// === UI 工具 ===
marked.js@11.x             // Markdown 渲染
sortable.js@1.x            // 拖拽功能（Kanban）
toastify.js@1.x            // Toast 通知

// === 开发工具 ===
esbuild                    // 构建工具（快速）
typescript@5.x             // 类型检查（可选）
```

### 2.3 文件结构

```
AI-Writing-Agent-Platform/
├── src/                              # 源代码（Python）
│   ├── agents/                       # Agent 实现
│   │   ├── base.py                   # BaseAgent 抽象类
│   │   ├── commander.py              # 指挥官 Agent
│   │   ├── architect.py              # 架构师 Agent
│   │   ├── writer.py                 # 写作 Agent
│   │   └── critic.py                 # 批评家 Agent
│   ├── workflow/                     # 工作流引擎
│   │   ├── graph.py                  # LangGraph 状态图
│   │   ├── state.py                  # 领域状态（NovelState）
│   │   ├── base_state.py             # 跨领域基础状态
│   │   ├── base_workflow.py          # 工作流抽象
│   │   ├── adapters/                 # 领域适配器
│   │   │   ├── base_adapter.py       # 适配器基类
│   │   │   ├── novel_adapter.py      # 小说适配器
│   │   │   └── code_adapter.py       # 代码适配器
│   │   ├── levels/                   # L1-L5 工作流
│   │   └── session/                  # 会话管理
│   │       ├── session_manager.py    # 会话管理器
│   │       └── resume_strategy.py    # 断点续写
│   ├── memory/                       # 记忆层（OpenKL + CCW）
│   │   ├── memory_manager.py         # 时序记忆
│   │   ├── citation_manager.py       # 引用管理
│   │   ├── distillation_manager.py   # 知识蒸馏
│   │   ├── core_memory_store.py      # 核心记忆（SQLite）
│   │   └── session_cluster.py        # 会话聚类
│   ├── search/                       # 搜索系统（CCW）
│   │   ├── smart_search.py           # RRF 融合搜索
│   │   ├── vector_search.py          # 向量搜索（Kùzu HNSW）
│   │   └── fts_search.py             # 全文搜索（SQLite FTS5）
│   ├── graph/                        # 知识图谱（Kùzu）
│   │   ├── graph_manager.py          # 图管理器
│   │   ├── schema.py                 # Cypher Schema DDL
│   │   └── sync_service.py           # 文件→图同步
│   ├── services/                     # 业务服务
│   │   ├── distill_service.py        # 蒸馏服务
│   │   └── quality_service.py        # 质量评估
│   ├── ui/                           # 用户界面
│   │   ├── streamlit_app.py          # Streamlit 原型
│   │   ├── api/                      # FastAPI 后端
│   │   │   ├── server.py             # 服务器入口
│   │   │   ├── routes/               # API 路由
│   │   │   └── websocket.py          # WebSocket 端点
│   │   └── web/                      # 纯 Web UI
│   │       ├── index.html            # 单页入口
│   │       ├── css/                  # 样式（模块化）
│   │       ├── js/                   # JavaScript（模块化）
│   │       └── assets/               # 静态资源
│   └── utils/                        # 工具函数
├── tests/                            # 测试用例
│   ├── test_agents.py                # Agent 单元测试
│   ├── test_workflow.py              # 工作流集成测试
│   ├── test_memory.py                # 记忆系统测试
│   └── e2e/                          # E2E 测试（Playwright）
├── docs/                             # 文档
│   ├── ARCHITECTURE.md               # 架构设计
│   ├── SDD_V2.md                     # 软件设计文档
│   ├── TASKS.md                      # 任务清单
│   └── TDD.md                        # 测试策略
├── .writing/                         # OpenKL 数据目录
│   ├── store/                        # 原始文件存储
│   ├── memories/                     # 长期记忆
│   ├── sessions/                     # 会话状态
│   └── graph.db/                     # Kùzu 数据库
├── requirements.txt                  # Python 依赖
├── pyproject.toml                    # 项目配置
├── .env.example                      # 环境变量示例
└── README.md                         # 项目概览
```

---

## 三、国际化支持（中英双界面）

### 3.1 当前状态

**❌ 尚未实现**（规划中）

### 3.2 设计方案（参考 CCW Dashboard）

#### 方案 A：后端 i18n（Python）

```python
# 使用 Flask-Babel 或 gettext
from gettext import gettext as _

# src/i18n/zh_CN.po
msgid "Dashboard"
msgstr "仪表盘"

msgid "Session Manager"
msgstr "会话管理"

# 使用
print(_("Dashboard"))  # 输出: "仪表盘"
```

#### 方案 B：前端 i18n（JavaScript）⭐ 推荐

**参考 CCW Dashboard 实现**：

```javascript
// src/ui/web/js/i18n.js
const translations = {
  en: {
    'dashboard': 'Dashboard',
    'session_manager': 'Session Manager',
    'core_memory': 'Core Memory',
    'lock_score': 'LOCK Score',
    'quality_dimensions': '8-Dimension Quality',
    'draft_preview': 'Draft Preview'
  },
  zh: {
    'dashboard': '仪表盘',
    'session_manager': '会话管理',
    'core_memory': '核心记忆',
    'lock_score': 'LOCK 评分',
    'quality_dimensions': '8维度质量',
    'draft_preview': '草稿预览'
  }
};

// 语言切换
let currentLang = localStorage.getItem('lang') || 'zh';

function t(key) {
  return translations[currentLang][key] || key;
}

// 使用
document.getElementById('title').textContent = t('dashboard');
```

**UI 实现**：

```html
<!-- 顶部操作栏语言切换 -->
<div class="header">
  <button id="lang-toggle">
    <span class="lang-icon">🌐</span>
    <span class="lang-text">EN / 中文</span>
  </button>
</div>

<script>
document.getElementById('lang-toggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('lang', currentLang);
  updateUI();  // 刷新所有文本
});
</script>
```

### 3.3 实施计划

```
Phase 1 (当前): 仅中文
  - Streamlit 原型暂不支持 i18n

Phase 2 (Web UI 迁移): 增加英文支持
  - 前端 i18n（参考 CCW）
  - 翻译文件: src/ui/web/locales/{en,zh}.json
  - 语言切换按钮: 顶部操作栏

Phase 3 (完善): 多语言扩展
  - 支持日语、韩语等
  - RTL 语言支持（阿拉伯语等）
```

**翻译文件示例**：

```json
// src/ui/web/locales/zh.json
{
  "app_name": "AI 写作工作台",
  "sidebar": {
    "project": "项目",
    "sessions": "会话",
    "memory": "记忆",
    "settings": "设置"
  },
  "views": {
    "chat": "协作对话流",
    "draft": "草稿预览",
    "lock": "LOCK 评分",
    "quality": "8维度质量",
    "kanban": "场景看板",
    "graph": "依赖关系图",
    "memory": "核心记忆"
  }
}

// src/ui/web/locales/en.json
{
  "app_name": "AI Writing Workbench",
  "sidebar": {
    "project": "Project",
    "sessions": "Sessions",
    "memory": "Memory",
    "settings": "Settings"
  },
  "views": {
    "chat": "Collaborative Chat",
    "draft": "Draft Preview",
    "lock": "LOCK Score",
    "quality": "8-Dimension Quality",
    "kanban": "Scene Kanban",
    "graph": "Dependency Graph",
    "memory": "Core Memory"
  }
}
```

---

## 四、开发工具链

### 4.1 IDE 推荐

| IDE | 推荐度 | 理由 |
|-----|-------|------|
| **VS Code** | ⭐⭐⭐ | Python、JavaScript 双支持，插件丰富 |
| **PyCharm** | ⭐⭐ | Python 专业 IDE，智能补全强 |
| **Cursor** | ⭐⭐⭐ | AI 编程助手，适合快速开发 |

### 4.2 代码规范

```python
# === PEP 8 + Type Hints ===
from typing import List, Dict, Optional
from pydantic import BaseModel

class NovelState(BaseModel):
    """小说创作状态"""
    user_idea: str
    chapter_title: Optional[str] = None
    draft_content: str = ""
    lock_scores: Dict[str, int] = {}
    quality_scores: Dict[str, float] = {}
    
    def validate_lock(self) -> bool:
        """验证 LOCK 评分"""
        total = sum(self.lock_scores.values())
        return total >= 28  # 阈值
```

### 4.3 测试策略

```bash
# 单元测试（覆盖率 ≥ 80%）
pytest tests/test_agents.py -v --cov=src/agents

# 集成测试
pytest tests/test_workflow.py -v

# E2E 测试（Playwright）
pytest tests/e2e/test_writing_flow.py --headed
```

---

## 五、部署方式

### 5.1 本地部署（推荐）

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 GEMINI_API_KEY 等

# 3. 启动 Web UI
python -m src.ui.api.server --port 8000
# 自动打开浏览器 http://localhost:8000

# 或使用 Streamlit 原型
streamlit run src/ui/streamlit_app.py
```

### 5.2 Docker 部署（未来）

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "src.ui.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.3 云端部署（可选）

```bash
# Vercel / Netlify（前端静态托管）
# Railway / Render（后端 API）
# Supabase（数据库，如需云端）
```

---

## 六、总结

### ✅ 确定的技术选择

| 层级 | 技术 | 理由 |
|------|------|------|
| **后端语言** | **Python 3.10+** | AI 生态最佳、LangGraph 原生支持 |
| **前端语言** | **HTML5 + Vanilla JS** | 轻量级、参考 CCW、无框架依赖 |
| **工作流引擎** | **LangGraph** | 状态机编排、Agent 协作 |
| **API 框架** | **FastAPI** | 高性能、异步支持、自动文档 |
| **图数据库** | **Kùzu** | 嵌入式、支持 Cypher + HNSW |
| **会话存储** | **SQLite** | 轻量级、无需额外服务 |
| **向量嵌入** | **FastEmbed** | 本地嵌入、无 API 调用 |

### ✅ 架构特点

1. **四层分离**: UI / 领域适配 / 核心平台 / 基础设施
2. **本地优先**: 所有数据存储本地，隐私保护
3. **领域无关**: 核心平台支持多领域（小说/代码/知识）
4. **可扩展**: 模块化设计，易于添加新功能

### ⚠️ 国际化支持

- **当前状态**: 仅中文（Streamlit 原型）
- **规划**: Phase 2 增加英文（前端 i18n，参考 CCW）
- **实现方式**: JSON 翻译文件 + 语言切换按钮

---

**下一步**: 继续 Jules 自动化开发，优先实现 P0 任务（CitationManager、DistillationManager、MemoryManager）
