# Guidance Specification: 写作工具新能力探索

## §1. Project Positioning & Goals

**Problem**: niko-studio 已具备成熟的写作分析能力（结构、节奏、角色、对话等）和叙事可视化，但缺乏 AI 驱动的主动创作辅助能力。用户需要从"被动分析"升级到"AI 共创"体验。

**Goal**: 在现有知识引擎 + MCP 架构基础上，构建三个用户可感知的 AI 驱动写作能力——AI 共创引擎、读者模拟面板、多模态故事智能——形成差异化竞争优势。

**Success Criteria**:
- AI 共创引擎支持 Auto/Guided/Directed 三种模式
- 读者模拟支持预设 + 自定义角色，覆盖 4 个检查维度
- 所有新能力通过 MCP 端点统一暴露
- MVP 阶段交付共创 + 读者模拟双能力

## §2. Concepts & Terminology

| Term | Definition | Aliases | Category |
|------|-----------|---------|----------|
| Knowledge Engine | 现有写作知识引擎，含 MCP 端点、分析服务、检测器 | KE | core |
| MCP Endpoint | Model Context Protocol 端点，服务间通信接口 | — | technical |
| Story Bible | 结构化故事知识库，含角色/世界观/情节线/时间线实体 | SB, 故事知识库 | core |
| Co-Writing Engine | AI 共创引擎，支持 Auto/Guided/Directed 三种模式 | CWE | core |
| Reader Simulation | 读者模拟引擎，多角色多维度检查 | RS | core |
| Multi-Modal Intelligence | 多模态故事智能，文本+视觉操作语义统一 | MMI | core |
| Quality Control | 质量控制机制，硬约束（分析服务）+ 软约束（创意谱图） | QC | core |
| Craft Analysis Service | 现有写作工艺分析服务（结构/节奏/角色/对话等） | CAS | technical |
| Revision Protocol | 修订协议，基于 IRevisionService 的 AI 修订流程 | — | technical |
| Session Intelligence | 会话智能，追踪写作会话上下文 | SI | technical |

## §3. Non-Goals (Out of Scope)

| Non-Goal | Rationale |
|----------|-----------|
| 发布平台功能 | 非写作核心能力，属于分发层 |
| 模板库系统 | 纯规则/模板系统，无 AI 驱动，不符合 AI 驱动优先约束 |
| 排版引擎 | 纯格式化功能，非 AI 驱动 |
| 实时多人协作 | 研究表明该领域尚未成熟，推迟到后续 milestone |
| 底层架构重构 | 本次聚焦新能力构建，复用现有架构 |
| 纯技术债务清理 | 不属于新能力探索范围 |

## §4. System Architect Decisions

**SA-01**: All new capabilities MUST be exposed through MCP endpoints following the existing pattern. The MCP layer serves as the unified integration surface.
- *Rationale*: MCP 端点统一确保前端通过一致 API 层调用，降低集成复杂度。

**SA-02**: Story Bible MUST extend the existing KnowledgeEngine with new entity types (CharacterProfile, WorldRule, PlotThread, TimelineEvent) and relationship schemas.
- *Rationale*: 扩展现有引擎避免并行引擎的数据同步问题，复用已有 MCP 注册和查询机制。

**SA-03**: The Co-Writing Engine MUST implement a three-mode architecture (Auto/Guided/Directed) with a shared context pipeline: Context Scraper → Prompt Assembler → Model Router → Output Aggregator → Post-Processing.
- *Rationale*: Sudowrite 验证的生产级架构，三模式共享上下文管道降低重复实现。

**SA-04**: Reader Simulation MUST run as a parallel dual-engine: reader personas and editorial analysis execute concurrently, neither blocks the other.
- *Rationale*: Slima 验证的双引擎架构，读者模拟和编辑分析独立运行提高效率。

**SA-05**: Quality Control MUST implement a two-tier constraint system: hard constraints from Craft Analysis Services (enforced) and soft constraints from creativity spectrum (advisory).
- *Rationale*: 硬约束保证基本质量，软约束保留创作自由度。

**SA-06**: Multi-Modal Intelligence MUST define operation semantics (filter, lasso, perspective shift) for text first, then extend to visual targets when image generation is added.
- *Rationale*: Vistoria 研究表明，先定义操作语义再添加模态目标，避免两个断连的编辑器。

**SA-07**: Context window management MUST implement automatic summarization (Shrink Ray pattern) for chapters beyond the current context window.
- *Rationale*: 即使 20K 词上下文也不够完整小说，自动摘要压缩早期章节。

## §5. Product Manager Decisions

**PM-01**: Delivery priority MUST follow: Co-Writing Engine → Reader Simulation → Multi-Modal Intelligence.
- *Rationale*: 共创引擎最高价值 + 差异化，读者模拟利用现有可视化，多模态最复杂。

**PM-02**: MVP scope MUST include Co-Writing Engine (Auto + Guided modes) + Reader Simulation (basic version with 3 preset personas), demonstrating capability linkage.
- *Rationale*: 双能力 MVP 展示两个能力联动，比单能力 MVP 更有说服力。

**PM-03**: Story Bible construction MUST use hybrid mode: auto-extract from manuscript text using existing Craft Analysis Services, then user supplements deep settings.
- *Rationale*: 自动提取降低使用门槛，用户补充保证深度。Sudowrite 数据显示跳过 Story Bible 的用户效果显著更差。

**PM-04**: AI output MUST be framed as "first draft" quality with explicit revision path, not publication-ready text.
- *Rationale*: 所有成功工具都将 AI 定位为"写作伙伴"而非"写作替代"，避免用户期望过高。

**PM-05**: Each Co-Writing mode MUST have a creativity slider with sensible defaults that constrain output style.
- *Rationale*: 防止 AI 过度生成/紫色散文问题（NovelAI Prose Augmenter 的已知问题）。

## §6. UX Expert Decisions

**UX-01**: AI co-writing suggestions MUST use a hybrid display: inline hints in the editor + sidebar detail panel, with user-switchable views.
- *Rationale*: 行内提示不打断写作流，侧边栏提供完整建议详情，混合式兼顾两种需求。

**UX-02**: Reader Simulation results MUST overlay on existing narrative visualization (tension curve, timeline) + independent detail panel with click-through linkage.
- *Rationale*: 叠加现有可视化降低学习成本，详情面板提供深度分析，点击联动实现快速切换。

**UX-03**: The creativity spectrum control MUST be a visual slider with labeled presets (Conservative / Balanced / Creative / Experimental).
- *Rationale*: 标签预设比纯数值更直观，用户可快速选择适合当前创作状态的自由度。

**UX-04**: Story Bible entries MUST be editable inline from the writing workspace, not requiring a separate management screen.
- *Rationale*: 减少上下文切换，写作时直接修正角色/世界观信息。

## §7. Subject Matter Expert Decisions

**SME-01**: Co-Writing quality control MUST check four dimensions: plot coherence, character consistency, style consistency, and pacing/tension.
- *Rationale*: 四维度覆盖写作质量核心要素，每个维度对应现有 Craft Analysis Service。

**SME-02**: Reader Simulation personas MUST include at minimum: Suspense Enthusiast, Literary Critic, General Reader, with customizable parameters (age, taste, reading history).
- *Rationale*: 三个预设角色覆盖主要读者类型，自定义参数支持细分受众分析。

**SME-03**: AI-generated text MUST be tagged with metadata indicating generation mode, confidence score, and constraint violations (if any).
- *Rationale*: 透明度让用户了解 AI 输出的可靠性，约束违规提示帮助用户判断是否需要修改。

**SME-04**: Story Bible auto-extraction MUST use existing Craft Analysis Services to identify characters, relationships, plot threads, and world rules from manuscript text.
- *Rationale*: 复用现有分析能力，避免重新实现实体识别。

## §8. Cross-Role Integration

- **SA-03 + PM-02**: Co-Writing Engine 三模式架构中，MVP 仅实现 Auto + Guided，Directed 复用现有 Revision Protocol 延后。
- **SA-02 + PM-03**: Story Bible 扩展 KnowledgeEngine 时，自动提取功能复用 Craft Analysis Services 输出。
- **SA-04 + UX-02**: Reader Simulation 双引擎架构中，读者结果叠加到现有叙事可视化面板。
- **SA-05 + SME-01**: Quality Control 硬约束直接调用 Craft Analysis Services 的四维度分析。
- **PM-05 + UX-03**: 创意谱图控制作为软约束，与 Quality Control 硬约束协同工作。
- **SA-06 + PM-01**: Multi-Modal Intelligence 推迟到共创 + 读者模拟之后，先定义文本操作语义。

## §9. Risks & Constraints

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Story Bible 数据不完整导致 AI 输出质量差 | High | 自动提取 + 必填字段验证 + 质量评分 |
| AI 过度生成/紫色散文 | Medium | 创意谱图控制 + 风格个性化约束 |
| 上下文窗口不足 | High | Shrink Ray 自动摘要 + 章节链接 |
| MCP 端点性能瓶颈 | Medium | 异步处理 + 缓存 + 批量查询 |
| 读者模拟角色定义主观性 | Low | 预设角色经过验证 + 多角色共识机制 |

## §10. Feature Decomposition

| ID | Slug | Title | Priority | Related Roles |
|----|------|-------|----------|---------------|
| F-001 | story-bible | Story Bible 引擎（扩展 KE + 自动提取 + 语义层） | MUST | SA, PM, SME |
| F-002 | co-writing-auto | AI 自动续写模式（Auto mode） | MUST | SA, PM, UX |
| F-003 | co-writing-guided | AI 引导选择模式（Guided mode，3 选项评分） | MUST | SA, PM, UX |
| F-004 | co-writing-directed | AI 指令驱动模式（Directed mode，复用 revision protocol） | SHOULD | SA, PM |
| F-005 | reader-simulation | 读者模拟引擎（预设 + 自定义角色，4 维度检查） | MUST | SA, PM, SME |
| F-006 | reader-visualization | 读者模拟可视化（叠加现有 + 详情联动） | MUST | SA, UX |
| F-007 | quality-control | 质量控制机制（硬约束 + 软约束创意谱图） | MUST | SA, SME, UX |
| F-008 | multimodal-intelligence | 多模态故事智能（文本操作语义 + 可视化扩展） | MAY | SA, UX |

## §11. Appendix: Decision Tracking

| Decision ID | Source | Choice | Date |
|-------------|--------|--------|------|
| D-001 | Phase 1 Q1 | 三个方向并行探索 | 2026-06-02 |
| D-002 | Phase 1 Q2 | AI 交互多模式共存 | 2026-06-02 |
| D-003 | Phase 1 Q3 | Story Bible 混合模式 | 2026-06-02 |
| D-004 | Phase 1 Q4 | 读者模拟混合模式 | 2026-06-02 |
| D-005 | SA Q1 | MCP 端点统一 | 2026-06-02 |
| D-006 | SA Q2 | 扩展现有引擎 | 2026-06-02 |
| D-007 | PM Q1 | 共创→读者→多模态 | 2026-06-02 |
| D-008 | PM Q2 | 双能力 MVP | 2026-06-02 |
| D-009 | UX Q1 | 混合式展示 | 2026-06-02 |
| D-010 | UX Q2 | 叠加+详情联动 | 2026-06-02 |
| D-011 | SME Q1 | 硬约束+软约束 | 2026-06-02 |
| D-012 | SME Q2 | 四维度全选 | 2026-06-02 |

## §12. Cross-Role Resolutions

### Cross-Role Resolutions (added 2026-06-02)

| ID | Type | Source(s) | Resolution | Applied to |
|---|---|---|---|---|
| C-001 | conflict | PM PM-05 vs SA SA-03 | "Balanced" is the default preset label per mode, not a fixed global value. Each mode's "Balanced" maps to mode-calibrated default (auto=0.5, guided=0.6, directed=0.4). | PM + SA analysis files patched |
| C-002 | conflict | PM PM-02 vs SME SME-02 vs SA | MVP = 3 preset personas only; custom persona support is Phase 2. SA's 8-persona capacity is architectural ceiling, not MVP scope. | PM + SME analysis files patched |
| C-003 | conflict | SME cross-cutting vs SA SA-05 | Hard constraints enforced (blocking) in Auto/Guided; in Directed mode, hard constraint violations produce warnings, not blocks, since user explicitly requested generation. | SME + SA analysis files patched |
| G-001 | gap | PM silent on F-004 Directed scope | PM-06: Directed mode is Phase 2 with design-only MVP. Architecture and metadata contracts defined per SA-03/SME-03 but no frontend implementation in MVP. | PM analysis file appended |
| G-002 | gap | PM silent on F-008 scope | PM-07: Multi-Modal Intelligence is Phase 3 with text-only design exploration in Phase 2. No Multi-Modal implementation in MVP. | PM analysis file appended |
| G-003 | gap | SME silent on F-006 visualization | SME-05: Reader Simulation visualization priority — character consistency and pacing/tension first; consensus shown as agreement count, dissent as outlier markers. | SME analysis file appended |
| G-004 | gap | SA missing RS-to-Overlay bridge interface | RS-to-Overlay Bridge: Dual-engine output MUST be transformable into OverlayMarker[] for UX overlay; each marker maps one persona finding to text position with severity and consensus flag. | SA analysis file appended |
| S-001 | synergy | SA + PM + SME on Story Bible completeness | Unified SB completeness gate: SME graduated scoring → SA architectural gate → PM product-level warnings | All 3 role files annotated |
| S-002 | synergy | SA + PM + UX + SME on Creativity Spectrum | Complete 4-role alignment: PM scope → UX interaction → SA configuration → SME domain boundary | PM + UX files annotated |
| S-003 | synergy | SME + UX on AI Output Metadata | SME GenerationMetadata interface maps to UX metadata badge — data model drives visual distinction | SME + UX files annotated |
| S-004 | synergy | SA + UX on Context Pipeline Latency | UX streaming mitigates perceived latency; SA optimization addresses actual latency | SA + UX files annotated |
