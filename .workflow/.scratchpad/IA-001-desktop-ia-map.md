# M1 Desktop IA map（一级入口 / 主区视图 / 右侧面板 / 模态）

## 目标与约束
- 目标：把 Desktop 的主要能力（Chat / Knowledge / Prompts / Settings）变成**可发现、可切换**的一级入口；在不引入 router 的前提下，用 state 驱动的主壳切换。
- 约束：不破坏现有 Chat streaming / abort / fallback / checkpoint / templates / memory upload 等语义；“boring & obvious”。

---

## 一级入口（Sidebar）→ 主区映射

| Sidebar Entry | 主区（Main） | 右侧面板（Right Panel） | 模态（Modal） | 备注 |
|---|---|---|---|---|
| Chat | ChatArea（默认） | 可打开：PromptTemplatePanel 等 | 可打开：现有模态（如有） | ChatArea 保持现状为主 |
| Knowledge | KnowledgeView（主区切换） | 可选（M1 先不做） | 兼容保留 KnowledgeModal（如需要过渡） | M1 先“可达+可用”，不做深度增强 |
| Prompts | 主区仍为 Chat（或保持当前主区） | 打开 PromptTemplatePanel | 无 | 复用现有模板库；作为一级入口的“打开面板”动作 |
| Settings | Settings（可保持 Modal 或主区视图二选一，M1 不强制） | 不需要 | SettingsModal | 仅做 IA 分区重排，不改语义 |

> 注：M1 先采用“主区切换 + 右侧面板”的组合，不引入路由器；后续如需要更复杂的 deep link 再评估。

---

## 互斥/叠加规则

### 右侧面板（Right Panel）
- **互斥**：同一时刻最多打开一个右侧面板。
- **打开新面板**：打开 A 时若 B 已打开，则关闭 B 并打开 A（替换）。
- **关闭规则**：
  - 点击面板关闭按钮 → 关闭当前面板
  - 再次点击同一入口（例如 Prompts）→ toggle（开/关）

### 主区（Main）与右侧面板的关系
- 右侧面板**叠加在主区之上**（不替换主区），以确保 ChatArea 的会话上下文仍在。
- 进入 Knowledge 主区时：右侧面板可按需关闭（建议：切主区时默认关闭右侧面板，避免布局拥挤；具体在 IA-003 里落地）。

### 模态（Modal）
- 模态行为保持现状（例如 SettingsModal / KnowledgeModal 若仍存在）。
- M1 不引入“多个模态叠加”新语义；沿用现有库默认行为。

---

## 状态归属（Persistence vs UI State）

### 持久化到 settingsStore（跨会话）
- 用户偏好类：
  - 模型/后端模式/guard/retrieval knobs 等（现有字段不变）
  - Prompt Library：模板库内容、favorite/recent、变量 preset（已有实现则不动）
- 与信息架构相关但属于“偏好”的 UI：
  - 可选：上次打开的 Sidebar entry（如果当前已有类似字段；没有就不强加）

### UI 临时 state（不持久化）
- 当前打开的右侧面板类型、临时宽度（若允许拖拽）
- 当前主区视图（如果切换是临时的，不需要记忆）
- 模态的 open/close 状态（通常由 UI 控制）

---

## 验收清单（M1）
- Sidebar 至少包含：Chat / Knowledge / Prompts / Settings
- 不引入 router（仍为 state-driven 切换）
- 同一时刻最多一个右侧面板
- Chat streaming / abort / templates 等语义不回归（后续由 IA-007 测试护栏覆盖）
