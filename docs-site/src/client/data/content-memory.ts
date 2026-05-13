export const memoryContent: Record<string, string> = {
  'material-upload': `
<h2>素材上传</h2>
<p>素材上传用于导入参考材料和写作素材，并建立后续检索基础。</p>
<pre><code>flowchart LR
  File[外部素材] --> Upload[memory/upload]
  Upload --> Parse[文本解析]
  Parse --> Index[索引 / 嵌入]
  Index --> Search[语义搜索]
  Search --> Agent[Agent / Writing / Wiki]</code></pre>
<ul>
  <li>纯文本。</li>
  <li>Markdown。</li>
  <li>PDF 文档。</li>
</ul>
<h2>导入建议</h2>
<ul>
  <li>把来源明确的资料单独上传，避免多个主题混在同一文件里。</li>
  <li>对长篇资料，优先保留标题、章节层级和来源信息。</li>
  <li>上传后若检索命中差，优先检查解析质量，而不是只怀疑搜索算法。</li>
</ul>
<h2>输入示例</h2>
<pre><code>素材文件：
- 雾港历史设定.md
- 林砚人物备忘录.pdf
- chapter-03-notes.txt</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>每份材料都被独立解析并保留来源。</li>
  <li>后续搜索结果能区分“来自正文”还是“来自外部素材”。</li>
  <li>若某份文件无法解析，应明确指出失败文件。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/upload
POST /memory/add</code></pre>
  `,
  'semantic-search': `
<h2>语义搜索</h2>
<p>语义搜索基于向量嵌入，能够找到含义相关但关键词不完全一致的素材。</p>
<h2>搜索流程</h2>
<pre><code>sequenceDiagram
  participant User as User / Agent
  participant Query as Query Builder
  participant Memory as Memory Search
  participant Result as Ranked Results

  User->>Query: 输入问题或目标
  Query->>Memory: 发送语义检索请求
  Memory-->>Result: 返回相关片段
  Result-->>User: 展示素材、来源和排序</code></pre>
<ul>
  <li>语义相似度搜索。</li>
  <li>混合搜索。</li>
  <li>按标签或时间过滤。</li>
</ul>
<h2>什么时候它特别有用</h2>
<table>
  <thead><tr><th>场景</th><th>价值</th></tr></thead>
  <tbody>
    <tr><td>只记得大意，不记得关键词</td><td>能找回语义接近的设定或素材。</td></tr>
    <tr><td>想给 Agent 补项目证据</td><td>可把相关片段作为上下文，而不是整库塞入。</td></tr>
    <tr><td>长篇项目跨章节追设定</td><td>比人工翻查更快定位来源。</td></tr>
  </tbody>
</table>
<h2>结果判读</h2>
<p>语义相关不等于 canonical。检索结果是候选证据，若涉及核心设定，仍应与 Wiki / 作者确认事实交叉核对。</p>
<h2>输入示例</h2>
<pre><code>查询：那个和黑色钥匙有关、但没明说地下室秘密的片段</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回语义相关片段，而不是只做关键词命中。</li>
  <li>每条结果应带来源和排序。</li>
  <li>若涉及核心设定，应能继续跳向 Wiki 或正文核对。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/search</code></pre>
  `,
  'temporal-query': `
<h2>时间线查询</h2>
<p>时间线查询用于按创建时间、修改时间或版本历史检索素材。它适合在长篇项目中回溯某段设定、素材或草稿最早出现的位置。</p>
<h2>查询维度</h2>
<ul>
  <li>创建时间：按素材首次加入时间筛选。</li>
  <li>修改时间：查看近期变动内容。</li>
  <li>版本历史：追踪内容的演变过程。</li>
</ul>
<h2>适合的排查问题</h2>
<ul>
  <li>这个设定最早在哪一章或哪份素材里出现。</li>
  <li>某个角色关系是什么时候被改写的。</li>
  <li>最近一次影响当前分析结论的资料变动来自哪里。</li>
</ul>
<h2>与语义搜索的区别</h2>
<table>
  <thead><tr><th>能力</th><th>时间线查询</th><th>语义搜索</th></tr></thead>
  <tbody>
    <tr><td>主维度</td><td>时间与演变</td><td>语义相关性</td></tr>
    <tr><td>更适合</td><td>回溯来源与变化</td><td>找相近内容</td></tr>
    <tr><td>常见使用者</td><td>维护者、长篇作者</td><td>作者、Agent、分析链路</td></tr>
  </tbody>
</table>
<h2>输入示例</h2>
<pre><code>问题：黑色钥匙这个设定最早在哪份材料里出现，后来被哪些章节改写过？</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>按时间顺序列出首次出现、后续变动和最近引用。</li>
  <li>能看出变化轨迹，而不是只返回零散片段。</li>
  <li>若资料不足，应提示时间线不完整。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/temporal</code></pre>
  `,
};
