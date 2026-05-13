import { appendSectionToPages, outputFieldGlossaryMiniSection } from './shared-doc-fragments';

const baseWorldviewContent: Record<string, string> = {
  'worldview-extract': `
<h2>设定提取</h2>
<p>设定提取从文本中识别地理、历史、规则体系和文化设定，建立结构化设定库。</p>
<ul>
  <li>地理设定。</li>
  <li>历史设定。</li>
  <li>规则体系。</li>
  <li>文化设定。</li>
</ul>
<h2>案例：设定散落在正文里，自己也记不清</h2>
<p>很多作者不是没有世界观，而是设定散落在章节、对白和说明段里。设定提取适合先把这些零散信息捞出来，至少形成一个可检视的“候选设定层”，再由作者决定哪些应该进入长期 canon。</p>
<h2>提取后应怎么处理</h2>
<ol>
  <li>先区分“作者明确确认”与“文本暂时暗示”。</li>
  <li>再把稳定设定晋升到 Wiki / 世界观管理页。</li>
  <li>最后再让 Agent、Graph 或批评能力使用这些设定。</li>
</ol>
<h2>输入示例文本片段</h2>
<pre><code>雾港一年有九个月被海雾笼罩，外来船只只能在钟塔敲响后靠岸。城里人相信海雾会吞掉撒谎的人，所以交易前必须在雾镜前宣誓。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>提取出“地理设定：雾港”“规则体系：钟塔靠岸规则”“文化设定：雾镜宣誓”。</li>
  <li>把这些内容组织成候选设定条目，而不是只返回原文摘录。</li>
  <li>若有不确定项，应标注为待确认，而不是直接当 canon。</li>
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
<h2>案例：规则很多，但写到后面彼此打架</h2>
<p>例如力量体系、地理边界或历史事件在不同章节里出现互相冲突的说法。设定管理的价值不只是“存起来”，而是让你能按类别回看并统一修正，不再靠记忆维持世界观。</p>
<h2>推荐管理方式</h2>
<table>
  <thead><tr><th>类别</th><th>适合怎么维护</th></tr></thead>
  <tbody>
    <tr><td>地理与势力</td><td>按区域和组织分类，便于查冲突。</td></tr>
    <tr><td>规则体系</td><td>把限制条件和例外写清楚。</td></tr>
    <tr><td>历史事件</td><td>结合时间线管理，减少年代错误。</td></tr>
    <tr><td>文化设定</td><td>和角色行为、对白风格一起核对。</td></tr>
  </tbody>
</table>
<h2>期望输出形态</h2>
<ul>
  <li>按类别返回结构化设定列表，而不是混成一段大文本。</li>
  <li>允许作者快速看到“已确认 / 待确认 / 互相冲突”的状态。</li>
  <li>在冲突场景下，能把相关章节或来源一起列出来便于核对。</li>
</ul>
<h3>端点</h3>
<pre><code>GET /m11/worldview
GET /m11/worldview/:category</code></pre>
  `,
};

export const worldviewContent = appendSectionToPages(
  baseWorldviewContent,
  ['worldview-extract', 'worldview-manage'],
  outputFieldGlossaryMiniSection
);
