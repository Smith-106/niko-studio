# 接口契约规范

本目录定义了 Niko-Studio 写作 Agent 的核心接口契约。所有实现必须遵循这些 Protocol 定义。

## 模块概览

| 模块 | 文件 | 接口 |
|------|------|------|
| Memory | `memory_contracts.py` | IMemoryService, ICitationService, IDistillationService |
| Workflow | `workflow_contracts.py` | IWorkflowService, ISessionService |
| Graph | `graph_contracts.py` | IGraphService |

## 接口说明

### Memory 模块

**IMemoryService** - 记忆服务
- `add(messages, options)` - 添加消息到记忆存储
- `search(query, options)` - 向量搜索
- `hybrid_search(query)` - 混合搜索（向量 + 关键词 + 图谱）
- `add_history(session_id, messages)` - 添加会话历史

**ICitationService** - 引用服务
- `create_transient_citation(source)` - 创建临时引用
- `make_citation(citation)` - 持久化引用
- `verify_citation(citation_id)` - SHA256 验证引用完整性

**IDistillationService** - 蒸馏服务
- `get_distillation_prompt(prompt_type)` - 获取蒸馏模板
- `create_memory_from_distillation(content, type)` - 从蒸馏创建记忆
- 支持 6 种类型：summary, insight, fact, decision, question, action

### Workflow 模块

**IWorkflowService** - 工作流服务
- `route_to_level(task)` - 路由任务到 L1-L5
- `execute_level(level, task)` - 执行工作流
- L1/L2 手动选择，L3-L5 动态路由

**ISessionService** - 会话服务
- `init/read/write/archive` - 会话生命周期管理
- `set_checkpoint/get_checkpoint` - 断点续传支持

### Graph 模块

**IGraphService** - 知识图谱服务
- `run_cypher(query)` - 执行 Cypher 查询
- `get_entity_stats()` - 获取统计信息
- `find_related_entities(id)` - 查找相关实体
- 实体 CRUD 和图算法支持

## 使用方式

```python
from docs.contracts import IMemoryService, IWorkflowService, IGraphService

# 类型检查
def process(memory: IMemoryService) -> None:
    results = memory.search("查询内容", SearchOptions(limit=5))
    
# 实现验证
class MyMemoryService:
    def add(self, messages, options): ...
    def search(self, query, options): ...
    # ...
    
# 静态检查会验证 MyMemoryService 是否满足 IMemoryService
```

## 设计原则

1. **Protocol 而非 ABC** - 使用结构化子类型，无需显式继承
2. **数据类优先** - 使用 dataclass 定义数据结构
3. **可选参数明确** - 使用 Optional 标注可空字段
4. **文档即规范** - docstring 包含完整的参数和返回值说明

## 验收标准

- [ ] 所有接口有完整的类型标注
- [ ] 所有方法有 docstring 说明
- [ ] 数据结构使用 dataclass 定义
- [ ] Protocol 方法签名与 IMPL_PLAN.md 一致
