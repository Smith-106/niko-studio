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
<p><strong>当前推荐版本：</strong><code>v11.0.2</code>。当前对外发布入口为 GitHub Releases：<a href="https://github.com/Smith-106/niko-studio/releases/tag/v11.0.2">Niko-Studio v11.0.2</a>。</p>
<table>
  <thead><tr><th>版本</th><th>日期</th><th>核心更新</th></tr></thead>
  <tbody>
    <tr><td><code>v11.0.2</code></td><td>2026-06-20</td><td>Story Bible、AI 共创引擎、读者模拟 (M26)、去 AI 味重写、A/B 版本对比</td></tr>
    <tr><td><code>v11.0.0</code></td><td>2026-05-30</td><td>写作工具新能力三模块、测试覆盖加固</td></tr>
    <tr><td><code>v10.0.0</code></td><td>2026-05-28</td><td>新手引导系统、模板管理增强、跨章节 AI 上下文</td></tr>
  </tbody>
</table>
<h2>v11.0.2 变更日志</h2>
<ul>
  <li><strong>Story Bible</strong> — 实体 CRUD、从稿件自动提取、完整性评分</li>
  <li><strong>AI 共创引擎</strong> — 自动/引导式共创生成、创意模式与预设</li>
  <li><strong>Reader Simulation (M26)</strong> — 多画像阅读模拟、AI 味检测、去 AI 味重写、反馈权重调整、A/B 版本对比</li>
  <li><strong>代码质量加固</strong> — 空 catch 修复、fire-and-forget 调用修复、setInterval.unref 防进程阻塞</li>
  <li><strong>测试覆盖</strong> — src-ts 99.93% 分支覆盖，desktop 98.36% 分支覆盖，9,352 测试用例</li>
</ul>
<h2>v10.0.0 变更日志</h2>
<ul>
  <li><strong>新手引导系统</strong> — 首次启动自动检测配置状态，引导用户完成 LLM 提供商设置和模板选择</li>
  <li><strong>模板管理增强</strong> — 支持模板收藏、最近使用记录、变量预设持久化</li>
  <li><strong>跨章节 AI 上下文</strong> — 写作助手自动携带前 N 章节摘要作为上下文，提升长篇连贯性</li>
  <li><strong>编辑器状态持久化</strong> — 自动保存编辑器滚动位置、光标位置和折叠状态</li>
  <li><strong>localStorage 防抖写入</strong> — 减少频繁 JSON.stringify + 写盘，修复 removeItem/setItem 竞态条件</li>
</ul>
<h2>当前交付状态</h2>
<ul>
  <li>Current-head local sign-off：<strong>GO</strong></li>
  <li>GitHub release tag：<code>v11.0.2</code></li>
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
