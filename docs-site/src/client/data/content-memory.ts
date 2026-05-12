export const memoryContent: Record<string, string> = {
  'material-upload': `
<h2>素材上传</h2>
<p>素材上传用于导入参考材料和写作素材，并建立后续检索基础。</p>
<ul>
  <li>纯文本。</li>
  <li>Markdown。</li>
  <li>PDF 文档。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/upload
POST /memory/add</code></pre>
  `,
  'semantic-search': `
<h2>语义搜索</h2>
<p>语义搜索基于向量嵌入，能够找到含义相关但关键词不完全一致的素材。</p>
<ul>
  <li>语义相似度搜索。</li>
  <li>混合搜索。</li>
  <li>按标签或时间过滤。</li>
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
<h3>端点</h3>
<pre><code>POST /memory/temporal</code></pre>
  `,
};
