# Phase 3 实施方案：Python + TypeScript 生产级架构

**版本**: 1.0  
**日期**: 2026-01-27  
**目标**: 将系统升级

为企业级架构，实现类型安全、高可维护性

---

## 一、架构设计

### 1.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│                    TypeScript + React + Vite                     │
└──────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌──────────────────────────────────────────────────────────────────┐
│                      API Gateway (Nginx)                         │
│                    静态资源 + 反向代理                            │
└──────────────────────────────────────────────────────────────────┘
                              ↕ 
┌──────────────────────────────────────────────────────────────────┐
│                   Backend API (FastAPI)                          │
│                   Python 3.10+ + Pydantic                        │
└──────────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────────┐
│                   Core Services (Python)                         │
│         Agents + Workflow + Memory + Search                      │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18.2+ |
| 类型系统 | TypeScript | 5.3+ |
| 构建工具 | Vite | 5.0+ |
| 状态管理 | Zustand | 4.5+ |
| UI 组件 | shadcn/ui | - |
| 样式方案 | TailwindCSS | 3.4+ |
| 图表库 | Recharts | 2.10+ |
| 后端框架 | FastAPI | 0.109+ |
| 类型验证 | Pydantic | 2.5+ |
| 工作流 | LangGraph | 0.0.30+ |

---

## 二、项目结构

```
ai-writing-agent-platform/
├── backend/                          # Python 后端
│   ├── src/
│   │   ├── api/                      # API 层
│   │   │   ├── main.py               # FastAPI 入口
│   │   │   ├── routes/               # API 路由
│   │   │   ├── schemas/              # Pydantic 模型
│   │   │   └── middleware/           # 中间件
│   │   ├── core/                     # 核心业务（现有代码）
│   │   │   ├── agents/
│   │   │   ├── workflow/
│   │   │   └── memory/
│   │   └── services/                 # 服务层
│   └── requirements.txt
│
├── frontend/                         # TypeScript 前端
│   ├── src/
│   │   ├── api/                      # API 客户端
│   │   ├── components/               # React 组件
│   │   ├── hooks/                    # 自定义 Hooks
│   │   ├── store/                    # 状态管理
│   │   └── i18n/                     # 国际化
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── docker-compose.yml
```

---

## 三、类型安全的 API 设计

### 3.1 Python Pydantic 模型

```python
# backend/src/api/schemas/session.py
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class WorkMode(str, Enum):
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    L4 = "L4"
    L5 = "L5"

class SessionCreate(BaseModel):
    name: str = Field(..., min_length=1)
    work_mode: WorkMode = WorkMode.L3
    model_name: str = "gemini-2.0-flash"

class SessionResponse(BaseModel):
    id: str
    name: str
    work_mode: WorkMode
    status: str
    created_at: datetime
```

### 3.2 自动生成 TypeScript 类型

```typescript
// frontend/src/api/types.ts (自动生成)
export enum WorkMode {
  L1 = "L1",
  L2 = "L2",
  L3 = "L3",
  L4 = "L4",
  L5 = "L5",
}

export interface SessionCreate {
  name: string;
  work_mode?: WorkMode;
  model_name?: string;
}

export interface SessionResponse {
  id: string;
  name: string;
  work_mode: WorkMode;
  status: string;
  created_at: string;
}
```

### 3.3 类型安全的 API 客户端

```typescript
// frontend/src/api/sessions.ts
import { apiClient } from './client';
import type { SessionCreate, SessionResponse } from './types';

export const sessionsApi = {
  async create(data: SessionCreate): Promise<SessionResponse> {
    const response = await apiClient.post<SessionResponse>('/api/sessions', data);
    return response.data;
  },

  async list(): Promise<SessionResponse[]> {
    const response = await apiClient.get<SessionResponse[]>('/api/sessions');
    return response.data;
  },
};
```

---

## 四、React 组件示例

### 4.1 会话列表

```typescript
// frontend/src/components/views/SessionList.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@/api/sessions';

export const SessionList: React.FC = () => {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {sessions?.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
};
```

### 4.2 工作流执行

```typescript
// frontend/src/components/views/WorkflowExecutor.tsx
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sessionsApi } from '@/api/sessions';

export const WorkflowExecutor: React.FC = () => {
  const [input, setInput] = useState('');

  const mutation = useMutation({
    mutationFn: sessionsApi.executeWorkflow,
    onSuccess: (data) => {
      console.log('执行成功:', data);
    },
  });

  return (
    <div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入创作需求..."
      />
      <button
        onClick={() => mutation.mutate({ user_input: input })}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? '执行中...' : '开始创作'}
      </button>
    </div>
  );
};
```

---

## 五、迁移路线图（4周）

### Week 1: 环境搭建
- Day 1-2: 后端 API 改造（FastAPI + Pydantic）
- Day 3-4: 前端项目初始化（Vite + React + TypeScript）
- Day 5: 类型生成自动化

### Week 2: 核心功能
- Day 6-7: 会话管理 UI
- Day 8-9: 工作流执行 UI
- Day 10: LOCK/8维度可视化

### Week 3: 高级功能
- Day 11-12: 草稿预览 + 版本对比
- Day 13-14: 场景看板 + 依赖图
- Day 15: 核心记忆管理

### Week 4: 测试部署
- Day 16-17: E2E 测试（Playwright）
- Day 18-19: 性能优化
- Day 20: Docker 部署上线

---

## 六、部署方案

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./.writing:/app/.writing

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

---

## 七、总结

### ✅ Phase 3 核心价值

1. **类型安全**：前后端接口完全类型化
2. **开发体验**：IDE 智能补全、重构支持
3. **可维护性**：大型项目首选
4. **现代化**：React 18 + Vite 最新技术栈
5. **生产就绪**：Docker 部署、监控告警

### 📋 检查清单

- [ ] 后端 API 改造
- [ ] 前端项目初始化
- [ ] 类型生成自动化
- [ ] 核心组件开发
- [ ] WebSocket 实时通信
- [ ] E2E 测试
- [ ] Docker 部署

---

**预计时间**：4 周  
**团队规模**：2-3 人  
**难度等级**：⭐⭐⭐⭐ 中高
