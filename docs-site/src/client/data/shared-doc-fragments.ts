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
