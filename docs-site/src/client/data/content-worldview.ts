export const worldviewContent: Record<string, string> = {
  'worldview-extract': `
<h2>设定提取</h2>
<p>设定提取从文本中识别地理、历史、规则体系和文化设定，建立结构化设定库。</p>
<ul>
  <li>地理设定。</li>
  <li>历史设定。</li>
  <li>规则体系。</li>
  <li>文化设定。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m11/worldview/extract</code></pre>
  `,
  'worldview-manage': `
<h2>设定管理</h2>
<p>设定管理用于查询、编辑和验证已有世界观设定，保持叙事一致性。</p>
<ul>
  <li>设定查询。</li>
  <li>设定编辑。</li>
  <li>一致性验证。</li>
</ul>
<h3>端点</h3>
<pre><code>GET /m11/worldview
GET /m11/worldview/:category</code></pre>
  `,
};
