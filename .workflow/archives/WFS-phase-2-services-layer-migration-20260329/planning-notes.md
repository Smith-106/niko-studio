# Planning Notes

**Session**: WFS-phase-2-services-layer-migration-20260329
**Created**: 2026-03-29T09:50:00Z

## User Intent (Phase 1)

- **GOAL**: Phase 2: Services Layer Migration - 将 services/ (6,006行) 和 search/ (3,160行) 迁移到TypeScript
- **KEY_CONSTRAINTS**:
  - 使用Phase 1的DI容器和协议接口
  - 保持双运行时（Python后端继续运行）
  - 测试覆盖率>= Python版本
  - TypeScript strict mode
  - 无破坏性变更

---

## Context Findings (Phase 2)

### Phase 1 成果

**已完成的基础设施**:
- ✅ TypeScript DI容器 (InversifyJS, src-ts/container/)
- ✅ 11个协议接口 (src-ts/protocols/)
- ✅ AgentFactory集成
- ✅ SearchInterface抽象
- ✅ 共享协议模块
- ✅ 6531 Python测试通过
- ✅ 99 TypeScript测试通过

**Git Commit**: 8ab598a

### 服务模块分析

**services/ 目录** (6,006行):
- services/distill_service.py - 核心蒸馏服务
- services/llm_service.py - LLM服务抽象
- services/embedding_service.py - Embedding服务抽象
- services/service_manager.py - 服务管理器
- services/knowledge_service.py - 知识服务

**search/ 目录** (3,160行):
- search/smart_search.py - 智能搜索
- search/hybrid_search.py - 混合搜索
- search/vector_search.py - 向量搜索
- search/search_engine.py - 搜索引擎抽象

### 依赖关系

```
services/ 依赖:
  ├── src-ts/protocols/ (LLMService, EmbeddingService)
  ├── src-ts/container/ (DI容器)
  ├── Python LLM providers (LangChain, OpenAI, etc.)
  └── Python embeddings (FastEmbed)

search/ 依赖:
  ├── src-ts/protocols/ (SearchInterface)
  ├── src-ts/container/ (DI容器)
  ├── 向量数据库
  └── Embedding服务
```

### 技术栈映射

| Python | TypeScript |
|--------|------------|
| services/distill_service.py | src-ts/services/distill-service.ts |
| services/llm_service.py | src-ts/services/llm-service.ts |
| services/embedding_service.py | src-ts/services/embedding-service.ts |
| search/smart_search.py | src-ts/search/smart-search.ts |
| search/hybrid_search.py | src-ts/search/hybrid-search.ts |

---

## Task Generation (Phase 4)

### 迁移策略

**渐进式迁移**:
1. 先迁移协议实现（services实现协议接口）
2. 再迁移具体服务逻辑
3. 注册到DI容器
4. 编写测试
5. 验证功能等价

**任务分组**:
- IMPL-007 to IMPL-010: Services迁移 (distill, llm, embedding, knowledge)
- IMPL-011 to IMPL-013: Search迁移 (smart, hybrid, vector)
- IMPL-014: DI容器集成
- IMPL-015: 测试迁移

---

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| 使用Phase 1协议接口 | 复用已定义的LLMService, EmbeddingService, SearchInterface | No |
| 渐进式迁移 | 保持双运行时，降低风险 | No |
| TypeScript strict mode | 类型安全，避免运行时错误 | No |

### Deferred
- [ ] Phase 3: Domain Logic Migration (agents/, workflow/, narrative/)
- [ ] Phase 4: Data Layer Migration (memory/, graph/, store/)
- [ ] Phase 5: Integration (sidecar elimination)
