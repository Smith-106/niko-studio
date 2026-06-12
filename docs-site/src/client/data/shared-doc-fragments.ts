export const outputFieldGlossaryMiniSection = `
<h2>输出字段词典</h2>
<ul>
  <li><code>score</code>：表示强弱、风险或优先级的信号分，不等于最终真相。</li>
  <li><code>evidence</code>：支撑判断的文本证据、设定来源或结构化依据。</li>
  <li><code>suggestion</code>：建议下一步动作或修订方向，不是必须照单全收的答案。</li>
  <li><code>status</code>：表示能力状态或执行状态，例如 Supported、Partial、running、completed，不直接表示文本质量。</li>
  <li><code>canon</code>：作者确认后的长期事实，优先级高于图谱投影、语义召回和聊天临时结论。</li>
</ul>
<p><strong>字段优先级</strong>：<code>canon</code> > <code>evidence</code> > <code>suggestion</code>；<code>score</code> 用来帮助排序和判断，不替代作者决定。完整说明见 <a href="/guides/output-field-glossary">输出字段词典</a>。</p>
`;

export const releaseSnapshotMiniSection = `
<h2>当前发布快照</h2>
<p><strong>当前推荐版本：</strong><code>v11.0.1</code>。当前对外发布入口为 GitHub Releases：<a href="https://github.com/Smith-106/niko-studio/releases/tag/v11.0.1">Niko-Studio v11.0.1</a>。</p>
<table>
  <thead><tr><th>版本</th><th>日期</th><th>核心更新</th></tr></thead>
  <tbody>
    <tr><td><code>v11.0.1</code></td><td>2026-06-12</td><td>标准交付版本刷新、生产 CORS 校准、NSIS 重打包验收、release 证据重建</td></tr>
    <tr><td><code>v11.0.0</code></td><td>2026-05-30</td><td>新手引导系统、模板管理增强、跨章节 AI 上下文、编辑器状态持久化、localStorage 防抖写入</td></tr>
    <tr><td><code>v9.27.0</code></td><td>2026-05-26</td><td>知识图谱 + AI 辅助写作 + 工作流引擎</td></tr>
  </tbody>
</table>
<h2>v11.0.1 变更日志</h2>
<ul>
  <li><strong>标准交付版本刷新</strong> — src-ts/config/index.ts、desktop/package.json、Cargo.toml、tauri.conf.json 等版本源统一提升至 11.0.1</li>
  <li><strong>生产 CORS 校准</strong> — 发布配置明确保留 <code>tauri://localhost</code> 与 <code>https://tauri.localhost</code></li>
  <li><strong>安装包重新验收</strong> — Windows NSIS 安装包重新构建，并补齐 packaged-app smoke、安装级 E2E 与 release readiness retained evidence</li>
  <li><strong>公开文档同步</strong> — README 与 docs-site 的推荐版本、下载入口和发布快照同步刷新到当前 release</li>
  <li><strong>版本治理</strong> — desktop/package.json、Cargo.toml、tauri.conf.json 版本号统一至 11.0.1</li>
</ul>
<h2>v11.0.0 变更日志</h2>
<ul>
  <li><strong>新手引导系统</strong> — 首次启动自动检测配置状态，引导用户完成 LLM 提供商设置和模板选择</li>
  <li><strong>模板管理增强</strong> — 支持模板收藏、最近使用记录、变量预设持久化</li>
  <li><strong>跨章节 AI 上下文</strong> — 写作助手自动携带前 N 章节摘要作为上下文，提升长篇连贯性</li>
  <li><strong>编辑器状态持久化</strong> — 自动保存编辑器滚动位置、光标位置和折叠状态</li>
  <li><strong>localStorage 防抖写入</strong> — 减少频繁 JSON.stringify + 写盘，修复 removeItem/setItem 竞态条件</li>
  <li><strong>jsdom 测试兼容</strong> — debounce 定时器增加 localStorage 存在性守卫</li>
  <li><strong>E2E 写作流验证</strong> — 完整的稿件创建→编辑→AI 辅助→导出链路测试覆盖</li>
  <li><strong>UI/UX 打磨</strong> — 设置面板布局优化、模板选择交互改进、加载状态反馈增强</li>
  <li><strong>版本同步</strong> — desktop/package.json、Cargo.toml、tauri.conf.json 版本号统一至 11.0.0</li>
</ul>
<h2>当前交付状态</h2>
<ul>
  <li>Current-head local sign-off：<strong>GO</strong></li>
  <li>GitHub release tag：<code>v11.0.1</code></li>
</ul>
`;

export function appendSectionToPages(
  entries: Record<string, string>,
  pageIds: string[],
  section: string
): Record<string, string> {
  const idSet = new Set(pageIds);
  return Object.fromEntries(
    Object.entries(entries).map(([id, html]) => [id, idSet.has(id) ? `${html}\n${section}` : html])
  );
}
